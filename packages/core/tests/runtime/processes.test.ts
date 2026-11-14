import { test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { ProjectCore } from '../../src/index.js';
import { createId } from '@schema-baron/model';
import { authored, waitJob } from './fixture.js';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
function next(app: string, content: string) {
  const path = join(app, 'node_modules/next/dist/bin');
  mkdirSync(path, {
    recursive: true
  });
  writeFileSync(join(path, 'next'), content);
}
test('real failure, bounded redacted logs, port conflict and native descendant cancellation', async () => {
  const f = await authored();
  const server = createServer((_req, res) => res.end('user application'));
  try {
    next(f.app, "console.error('Bearer never-export-this-secret');console.log('x'.repeat(50000));process.exit(7)");
    const failed = await f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'build'
    });
    const job = await waitJob(f, failed.jobId);
    expect(job).toMatchObject({
      status: 'failed',
      outcome: {
        result: {
          exitCode: 7
        }
      }
    });
    expect(JSON.stringify(job)).not.toContain('never-export-this-secret');
    expect(job.outcome.result.logs.length).toBeLessThanOrEqual(32768);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as {
      port: number;
    };
    await expect(f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'run',
      port: address.port
    })).rejects.toThrow('PROJECT_BUSY');
    expect(await (await fetch(`http://127.0.0.1:${address.port}/`)).text()).toBe('user application');
    const sqlite = join(process.cwd(), 'node_modules/better-sqlite3/lib/index.js');
    next(f.app, `const {spawn}=require('node:child_process');const {mkdirSync,writeFileSync}=require('node:fs');mkdirSync('.next',{recursive:true});const child=spawn(process.execPath,['-e',${JSON.stringify(`const Database=require(${JSON.stringify(sqlite)});const db=new Database(':memory:');process.on('SIGTERM',()=>{});console.log('native-ready');db.prepare('WITH RECURSIVE seq(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM seq WHERE x<1000000000) SELECT sum(x) FROM seq').get();`)}],{stdio:['ignore','pipe','inherit']});child.stdout.on('data',()=>writeFileSync('.next/native-pids.json',JSON.stringify([process.pid,child.pid])));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`);
    const running = await f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'build'
    });
    const proof = join(f.app, '.next/native-pids.json');
    for (let i = 0; i < 100 && !existsSync(proof); i++) await delay(30);
    expect(existsSync(proof)).toBe(true);
    const pids = JSON.parse(readFileSync(proof, 'utf8')) as number[];
    expect(await f.core.cancelRuntime('owner', f.id, running.jobId)).toMatchObject({
      status: 'canceled'
    });
    for (const pid of pids) {
      const stat = existsSync(`/proc/${pid}/stat`) ? readFileSync(`/proc/${pid}/stat`, 'utf8') : '';
      expect(stat === '' || stat.includes(') Z ')).toBe(true);
    }
    expect(await f.run('runtime.status', {
      generatedRevision: 1
    })).toMatchObject({
      status: 'stopped'
    });
    next(f.app, "process.exit(0)");
    const retry = await f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'build'
    });
    expect(await waitJob(f, retry.jobId)).toMatchObject({
      status: 'succeeded'
    });
  } finally {
    server.close();
    await f.core.close();
  }
});
test('no execution on open; symlink and stale output cannot launch jobs', async () => {
  const f = await authored();
  try {
    expect(await f.run('runtime.status', {})).toMatchObject({
      status: 'stopped',
      generatedRevision: 1
    });
    const target = mkdtempSync(join(tmpdir(), 'wp21-outside-'));
    symlinkSync(target, join(f.app, 'node_modules'));
    await expect(f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'build'
    })).rejects.toThrow('OUTPUT_CONFLICT');
    rmSync(join(f.app, 'node_modules'));
    await expect(f.run('runtime.start', {
      generatedRevision: 999,
      intent: 'build'
    })).rejects.toThrow('REVISION_CONFLICT');
  } finally {
    await f.core.close();
  }
});
test('probe-to-launch directory swap cannot execute the replacement', async () => {
  let action = () => {};
  const f = await authored({
    runtimeFault: () => action()
  });
  try {
    next(f.app, "require('node:fs').writeFileSync('.next-executed','unsafe')");
    action = () => {
      renameSync(f.app, f.app + '-original');
      mkdirSync(f.app);
      writeFileSync(join(f.app, 'keep'), 'replacement');
    };
    await expect(f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'build'
    })).rejects.toThrow();
    expect(readFileSync(join(f.app, 'keep'), 'utf8')).toBe('replacement');
    expect(existsSync(join(f.app, '.next-executed'))).toBe(false);
    expect(existsSync(join(f.app + '-original', '.next-executed'))).toBe(false);
  } finally {
    await f.core.close();
  }
});
test('an unrelated HTTP200 between probe and launch never becomes managed readiness', async () => {
  let action = () => {};
  const server = createServer((_req, res) => res.end('unmanaged-user-app'));
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, resolve));
  const port = (probe.address() as {
    port: number;
  }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const f = await authored({
    runtimeFault: () => action()
  });
  try {
    next(f.app, "const server=require('node:http').createServer((_req,res)=>res.end('managed'));server.on('error',()=>process.exit(4));server.listen(Number(process.argv.at(-1)),'127.0.0.1',()=>console.log('Ready in 1ms'));");
    action = () => {
      server.listen(port);
    };
    const started = await f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'run',
      port
    });
    expect(started.status).toBe('starting');
    expect(await waitJob(f, started.jobId)).toMatchObject({
      status: 'failed',
      outcome: {
        result: {
          exitCode: 4
        }
      }
    });
    expect(await f.run('runtime.status', {
      generatedRevision: 1
    })).toMatchObject({
      status: 'failed'
    });
    expect(await (await fetch(`http://127.0.0.1:${port}`)).text()).toBe('unmanaged-user-app');
  } finally {
    server.close();
    await f.core.close();
  }
});
test('promotion refusal preserves the active source tree after managed process shutdown', async () => {
  let refuse = false;
  const f = await authored({
    runtimeLifecycle: {
      stopForPromotion: async () => {
        if (refuse) throw Error('refuse promotion');
        return {
          status: 'unmanaged'
        };
      }
    }
  });
  try {
    refuse = true;
    next(f.app, "console.log('waiting');setInterval(()=>{},1000)");
    const started = await f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'build'
    });
    const source = readFileSync(join(f.app, 'server/connection.ts'), 'utf8');
    await expect(f.generate()).rejects.toThrow('RECOVERY_REQUIRED');
    expect(readFileSync(join(f.app, 'server/connection.ts'), 'utf8')).toBe(source);
    expect(await waitJob(f, started.jobId)).toMatchObject({
      status: 'canceled'
    });
    expect(await f.run('runtime.status', {})).toMatchObject({
      generatedRevision: 1,
      status: 'stopped'
    });
  } finally {
    await f.core.close();
  }
});
