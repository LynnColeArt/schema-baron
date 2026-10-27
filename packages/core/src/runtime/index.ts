import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { compileProject } from '@schema-baron/generator';
import type { RuntimeLifecyclePort } from '@schema-baron/generator';
import { createId, idSchema } from '@schema-baron/model';
import type { Project, Job, OperationResult } from '@schema-baron/model';
import { safePath, StorageError } from '@schema-baron/storage';
import type { ProjectStorage } from '@schema-baron/storage';
import type { CommandRegistry } from '../commands/index.js';
import { routeParameters } from './parameters.js';
import { outputAuthority } from './output.js';
type State = OperationResult<'runtime.status'>;
interface Managed {
  projectId: string;
  path: string;
  state: State;
  job: Job;
  child: ChildProcess;
  pid: number;
  fd: number;
  moduleFd: number;
  done: Promise<void>;
  logs: string;
  pendingLog: string;
  canceling: boolean;
  closed: boolean;
}
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
// Only process groups created here are ever signalled. Ignore zombies (already dead,
// awaiting the OS parent reaper); live descendants must all disappear before promotion.
function alive(pgid: number) {
  if (process.platform !== 'linux') {
    try {
      process.kill(-pgid, 0);
      return true;
    } catch {
      return false;
    }
  }
  return readdirSync('/proc').some(name => {
    if (!/^\d+$/.test(name)) return false;
    try {
      const line = readFileSync(`/proc/${name}/stat`, 'utf8'),
        parts = line.slice(line.lastIndexOf(')') + 2).split(' ');
      return parts[0] !== 'Z' && Number(parts[2]) === pgid;
    } catch {
      return false;
    }
  });
}
async function portAvailable(port: number) {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new StorageError('PROJECT_BUSY', 'Port is already in use. Stop that application or choose another port and retry.')));
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const chosen = typeof address === 'object' && address ? address.port : 0;
      server.close(error => error ? reject(error) : resolve(chosen));
    });
  });
}
export class RuntimeManager implements RuntimeLifecyclePort {
  private managed = new Map<string, Managed>();
  private states = new Map<string, State>();
  private closed = false;
  constructor(private options: {
    approvedRoots: Record<string, string>;
    runtimeSecrets?: string[];
    runtimeFault?: (point: 'after-port-probe') => void;
  }, private storage: ProjectStorage) {}
  private output(project: Project, revision: number) {
    const result = outputAuthority(this.storage, project.id, this.options.approvedRoots);
    if (result.current.outputTreeRevision !== revision) throw new StorageError('REVISION_CONFLICT', 'Generated output changed. Refresh its output-tree revision before this action.');
    return result;
  }
  private save(m: Managed) {
    m.job.outcome = {
      ok: true,
      revision: m.state.modelRevision,
      result: {
        executable: m.state.executable,
        arguments: m.state.arguments,
        cwd: m.path,
        intent: m.state.intent,
        outputTreeRevision: m.state.generatedRevision,
        ...(m.job.outcome?.ok ? m.job.outcome.result as object : {}),
        logs: m.logs,
        pid: m.pid
      },
      diagnostics: m.job.diagnostics
    };
    this.storage.putJob(m.projectId, m.job.id, m.job);
  }
  private log(m: Managed, chunk: Buffer, flush = false) {
    m.pendingLog += chunk.toString('utf8');
    const end = flush ? m.pendingLog.length : m.pendingLog.lastIndexOf('\n') + 1;
    if (!end) {
      if (m.pendingLog.length > 32768) m.pendingLog = '[Overlong unterminated output omitted]';
      return;
    }
    let text = m.pendingLog.slice(0, end);
    m.pendingLog = m.pendingLog.slice(end);
    for (const secret of this.options.runtimeSecrets ?? []) if (secret) text = text.split(secret).join('[REDACTED]');
    text = text.replace(/(Bearer\s+|(?:password|token|secret|capability)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]').replace(/scrypt\$[^\s'"<>]+/g, '[REDACTED]');
    m.logs = (m.logs + text).slice(-32768);
    this.save(m);
  }
  status(project: Project, revision?: number): State {
    revision ??= outputAuthority(this.storage, project.id, this.options.approvedRoots).current.outputTreeRevision;
    const output = this.output(project, revision),
      state = this.states.get(project.id);
    if (state && state.generatedRevision === revision && state.cwd === output.path) return structuredClone(state);
    return {
      status: 'stopped',
      generatedRevision: revision,
      modelRevision: output.current.modelRevision,
      executable: process.execPath,
      arguments: [],
      cwd: output.path
    };
  }
  async start(project: Project, revision: number, intent: 'build' | 'run', requestedPort?: number): Promise<State> {
    if (this.closed) throw new StorageError('RECOVERY_REQUIRED', 'Runtime owner has closed.');
    if (this.managed.has(project.id)) throw new StorageError('PROJECT_BUSY', 'Stop or cancel the current runtime job before retrying.');
    const output = this.output(project, revision);
    const port = intent === 'run' ? await portAvailable(requestedPort ?? 0) : undefined;
    this.options.runtimeFault?.('after-port-probe');
    // Revalidate source and the approved cwd after asynchronous port selection.
    if (this.closed || this.storage.snapshot(project.id).revision !== project.revision) throw new StorageError('REVISION_CONFLICT', 'Project changed before launch.');
    const latest = this.output(project, revision);
    if (latest.identity !== output.identity) throw new StorageError('OUTPUT_CONFLICT', 'Output directory changed before process launch.');
    const modulePath = safePath(output.path, 'node_modules/next/dist/bin/next');
    let moduleFd: number;
    try {
      moduleFd = openSync(modulePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const file = fstatSync(moduleFd);
      if (!file.isFile() || file.nlink !== 1) {
        closeSync(moduleFd);
        throw Error();
      }
    } catch {
      throw new StorageError('NOT_FOUND', 'Install the generated app dependencies explicitly with npm ci --ignore-scripts, then retry.');
    }
    const fd = openSync(output.path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (`${stat.dev}:${stat.ino}` !== output.identity) {
      closeSync(fd);
      closeSync(moduleFd);
      throw new StorageError('OUTPUT_CONFLICT', 'Output directory changed before launch.');
    }
    const args = [`/proc/${process.pid}/fd/${moduleFd}`, ...(intent === 'build' ? ['build', '--webpack'] : ['start', '--hostname', '127.0.0.1', '--port', String(port)])];
    const env: NodeJS.ProcessEnv = {
      PATH: `${join(process.execPath, '..')}:/usr/bin:/bin`,
      LANG: 'C.UTF-8',
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_ENV: 'production'
    };
    const state: State = {
      status: intent === 'build' ? 'building' : 'starting',
      generatedRevision: revision,
      modelRevision: output.current.modelRevision,
      jobId: createId(),
      executable: process.execPath,
      arguments: args,
      cwd: output.path,
      intent,
      ...(port ? {
        port
      } : {})
    };
    const child = spawn(process.execPath, args, {
      cwd: `/proc/${process.pid}/fd/${fd}`,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let finish!: () => void;
    const done = new Promise<void>(resolve => {
      finish = resolve;
    });
    const managed: Managed = {
      projectId: project.id,
      path: output.path,
      state,
      job: {
        id: state.jobId!,
        status: 'running',
        committed: false,
        diagnostics: []
      },
      child,
      pid: child.pid ?? 0,
      fd,
      moduleFd,
      done,
      logs: '',
      pendingLog: '',
      canceling: false,
      closed: false
    };
    this.managed.set(project.id, managed);
    this.states.set(project.id, state);
    this.save(managed);
    child.stdout?.on('data', (chunk: Buffer) => this.log(managed, chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.log(managed, chunk));
    child.once('error', () => {
      state.message = 'Process launch failed. Verify installed dependencies and retry.';
    });
    child.once('exit', () => {
      void this.terminate(managed).catch(() => {
        state.status = 'failed';
        state.message = 'Owned descendants could not be stopped. Retry Stop before promotion.';
      });
    });
    child.once('close', (code, signal) => {
      managed.closed = true;
      this.log(managed, Buffer.alloc(0), true);
      delete state.runningRevision;
      managed.job.status = managed.canceling ? 'canceled' : code === 0 ? 'succeeded' : 'failed';
      state.status = managed.canceling || code === 0 ? 'stopped' : 'failed';
      if (code !== 0 && !managed.canceling) state.message = 'Process failed. Inspect the bounded job log, fix the cause, then retry.';
      if(managed.job.status==='failed')managed.job.diagnostics=[{code:'VALIDATION_FAILED',severity:'error',objectId:idSchema.parse(project.id),field:'runtime',message:state.message??'Runtime process failed.'}];
      managed.job.outcome = {
        ok: true,
        revision: state.modelRevision,
        result: {
          exitCode: code,
          signal
        },
        diagnostics: []
      };
      this.save(managed);
      finish();
    });
    // Reap the whole owned group even when its initial process exits before a child.
    void done.then(async () => {
      await this.terminate(managed);
      if (this.managed.get(project.id) === managed) this.managed.delete(project.id);
    }).catch(() => {
      state.status = 'failed';
      state.message = 'Owned child group could not be verified stopped. Retry Stop before promotion.';
    });
    if (intent === 'run') void this.ready(managed, port!);
    return structuredClone(state);
  }
  private async ready(m: Managed, port: number) {
    const deadline = Date.now() + 20000;
    while (!m.closed && !m.canceling && Date.now() < deadline) {
      try {
        if (!/Ready in/.test(m.logs)) {
          await delay(100);
          continue;
        }
        const response = await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(500),
          redirect: 'manual'
        });
        await response.body?.cancel();
        if (!m.closed && !m.canceling) {
          m.state.status = 'running';
          m.state.runningRevision = m.state.generatedRevision;
          this.save(m);
        }
        return;
      } catch {}
      await delay(100);
    }
    if (!m.closed && !m.canceling) {
      m.state.message = 'Application did not become ready within 20 seconds. Inspect logs and retry.';
      await this.stop(m);
      m.state.status = 'failed';
      m.job.status = 'failed';
      this.save(m);
    }
  }
  private async terminate(m: Managed) {
    if (m.pid) {
      if (alive(m.pid)) {
        try {
          process.kill(-m.pid, 'SIGTERM');
        } catch {}
        const deadline = Date.now() + 1500;
        while (alive(m.pid) && Date.now() < deadline) await delay(25);
        if (alive(m.pid)) {
          try {
            process.kill(-m.pid, 'SIGKILL');
          } catch {}
        }
        const killed = Date.now() + 1500;
        while (alive(m.pid) && Date.now() < killed) await delay(25);
        if (alive(m.pid)) throw new StorageError('PROJECT_BUSY', 'Owned runtime process group did not stop; active output was preserved.');
      }
    }
    if (m.fd >= 0) {
      closeSync(m.fd);
      m.fd = -1;
    }
    if (m.moduleFd >= 0) {
      closeSync(m.moduleFd);
      m.moduleFd = -1;
    }
  }
  private async stop(m: Managed) {
    m.canceling = true;
    await this.terminate(m);
    await m.done;
  }
  async stopForPromotion(input: {
    projectId: string;
    outputPath: string;
  }) {
    const m = this.managed.get(input.projectId);
    if (!m) return {
      status: 'unmanaged' as const
    };
    await this.stop(m);
    return {
      status: 'stopped' as const
    };
  }
  async stopProject(project: Project, revision: number) {
    this.output(project, revision);
    const m = this.managed.get(project.id);
    if (m) await this.stop(m);
    return this.status(project, revision);
  }
  async cancel(projectId: string, id: string) {
    const m = this.managed.get(projectId);
    if (!m || m.job.id !== id) return undefined;
    await this.stop(m);
    return structuredClone(m.job);
  }
  route(project: Project, revision: number, pageId: string, parameters: Record<string, string | number | boolean | null>) {
    const output = this.output(project, revision),
      state = this.status(project, revision);
    if (state.status !== 'running' || !state.port || state.runningRevision !== revision) throw new StorageError('PROJECT_BUSY', 'Start the current generated revision before opening Live Page.');
    const ir = compileProject(output.current.project),
      route = ir.routes.find(r => r.id === pageId);
    if (!route) throw new StorageError('NOT_FOUND', 'Selected page is absent from generated output; save and generate it first.');
    const query = routeParameters(ir, route, parameters);
    return {
      url: `http://127.0.0.1:${state.port}${route.path}${query.size ? '?' + query.toString() : ''}`,
      generatedRevision: revision,
      pageId
    };
  }
  register(registry: CommandRegistry) {
    for (const op of ['runtime.start', 'runtime.stop'] as const) registry.registerAsync(op, async (command, project) => {
      if (!project || command.operation !== 'runtime.start' && command.operation !== 'runtime.stop') throw new StorageError('INVALID_INPUT', 'Open a project.');
      return {
        result: command.operation === 'runtime.start' ? await this.start(project, command.input.generatedRevision, command.input.intent, command.input.port) : await this.stopProject(project, command.input.generatedRevision)
      };
    });
    registry.register('runtime.status', (c, p) => {
      if (c.operation !== 'runtime.status' || !p) throw new StorageError('INVALID_INPUT', 'Open a project.');
      return {
        result: this.status(p, c.input.generatedRevision)
      };
    });
    registry.register('runtime.route', (c, p) => {
      if (c.operation !== 'runtime.route' || !p) throw new StorageError('INVALID_INPUT', 'Open a project.');
      return {
        result: this.route(p, c.input.generatedRevision, c.input.pageId, c.input.parameters)
      };
    });
  }
  hasActive() {
    return this.managed.size > 0;
  }
  async close() {
    this.closed = true;
    await Promise.all([...this.managed.values()].map(m => this.stop(m)));
  }
}
