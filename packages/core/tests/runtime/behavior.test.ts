import { test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { ProjectCore } from '../../src/index.js';
import { createId } from '@schema-baron/model';
import { authored, waitJob } from './fixture.js';
test('real managed Record-only build/run/route, promotion shutdown and separate portable output', async () => {
  const f = await authored();
  try {
    const npm = '/home/lynn/.nvm/versions/node/v24.22.1/lib/node_modules/npm/bin/npm-cli.js';
    expect(spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--offline'], {
      cwd: f.app,
      encoding: 'utf8'
    }).status).toBe(0);
    const authored = await f.run('extension.read', {
      extensionId: f.extension,
      approvedPath: 'output:app/authored/private-validator.ts'
    });
    const handwritten = authored.content + '\n// handwritten-byte-preservation\n';
    await f.run('extension.write', {
      extensionId: f.extension,
      approvedPath: 'output:app/authored/private-validator.ts',
      expectedFileHash: authored.hash,
      content: handwritten
    });
    const bootstrap = readFileSync(join(f.app, 'next-env.d.ts'), 'utf8');
    const build = await f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'build'
    });
    expect(build).toMatchObject({
      status: 'building',
      cwd: f.app,
      intent: 'build'
    });
    expect(await waitJob(f, build.jobId)).toMatchObject({
      status: 'succeeded',
      outcome: {
        result: {
          exitCode: 0
        }
      }
    });
    expect(readFileSync(join(f.app, 'next-env.d.ts'), 'utf8')).toBe(bootstrap);
    const running = await f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'run'
    });
    expect(running.status).toBe('starting');
    for (let i = 0; i < 200; i++) {
      const state = await f.run('runtime.status', {
        generatedRevision: 1
      });
      if (state.status === 'running') break;
      await new Promise(r => setTimeout(r, 100));
    }
    const route = await f.run('runtime.route', {
      generatedRevision: 1,
      pageId: f.saved,
      parameters: {}
    });
    expect(route.url).toMatch(/http:\/\/127.0.0.1:\d+\/saved$/);
    expect(await (await fetch(route.url)).text()).toContain('Complete');
    expect(await f.generate()).toMatchObject({
      manifest: {
        outputTreeRevision: 2
      }
    });
    expect(await f.run('runtime.status', {
      generatedRevision: 2
    })).toMatchObject({
      status: 'stopped'
    });
    expect(await fetch(route.url).then(() => true, () => false)).toBe(false);
    const updated = f.core.snapshot('owner', f.id).pages.find(p => p.id === f.saved)!;
    await f.run('project.batch', {
      operations: [{
        kind: 'put',
        entity: 'page',
        id: f.saved,
        value: {
          ...updated,
          route: '/finished'
        }
      }]
    });
    expect(await f.generate()).toMatchObject({
      manifest: {
        outputTreeRevision: 3
      }
    });
    expect(spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--offline'], {
      cwd: f.app,
      encoding: 'utf8'
    }).status).toBe(0);
    const rebuilt = await f.run('runtime.start', {
      generatedRevision: 3,
      intent: 'build'
    });
    expect(await waitJob(f, rebuilt.jobId)).toMatchObject({
      status: 'succeeded'
    });
    await f.run('runtime.start', {
      generatedRevision: 3,
      intent: 'run'
    });
    for (let i = 0; i < 200; i++) {
      const state = await f.run('runtime.status', {
        generatedRevision: 3
      });
      if (state.status === 'running') break;
      await new Promise(r => setTimeout(r, 100));
    }
    const newer = await f.run('runtime.route', {
      generatedRevision: 3,
      pageId: f.saved,
      parameters: {}
    });
    expect(newer.url).toContain('/finished');
    expect(await (await fetch(newer.url)).text()).toContain('Complete');
    await expect(f.run('runtime.route', {
      generatedRevision: 3,
      pageId: f.saved,
      parameters: {
        arbitrary: 'bad'
      }
    })).rejects.toThrow('INVALID_INPUT');
    await f.run('project.export', {
      destination: 'output:portable',
      includeData: true
    });
    const port = join(f.output, 'portable', 'app');
    expect(readFileSync(join(port, 'authored/private-validator.ts'), 'utf8')).toBe(handwritten);
    await f.core.close();
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      APPLICATION_DATABASE_PATH: join(f.output, 'portable', 'data', 'application.sqlite'),
      NEXT_TELEMETRY_DISABLED: '1'
    };
    for (const args of [['ci', '--ignore-scripts', '--offline'], ['run', 'typecheck'], ['test'], ['run', 'build']]) {
      const result = spawnSync(process.execPath, [npm, ...args], {
        cwd: port,
        env,
        encoding: 'utf8'
      });
      writeFileSync(join(f.root, 'portable-' + args[0] + args.slice(1).join('-') + '.log'), result.stdout + result.stderr);
      expect(result.status, result.stdout + result.stderr).toBe(0);
    }
    const standalone = spawn(process.execPath, ['./node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '0'], {
      cwd: port,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let logs = '';
    standalone.stdout!.on('data', chunk => {
      logs += String(chunk);
    });
    standalone.stderr!.on('data', chunk => {
      logs += String(chunk);
    });
    try {
      let origin = '';
      for (let i = 0; i < 200; i++) {
        const match = logs.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match && logs.includes('Ready in')) {
          origin = match[0];
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }
      expect(origin, logs).not.toBe('');
      expect(await (await fetch(origin + '/finished')).text()).toContain('Complete');
      const definition = JSON.parse(readFileSync(join(f.output, 'portable/project.json'), 'utf8'));
      const record = definition.forms.find((r: any) => r.kind === 'Record'),
        table = definition.schema.tables[0];
      const key = record.id + ':key:' + table.primaryKey[0];
      expect(await (await fetch(origin + '/?' + new URLSearchParams({
        [key]: 'A'
      }))).text()).toContain('Original');
      writeFileSync(join(f.root, 'proof.json'), JSON.stringify({
        route,
        newer,
        build,
        portable: port,
        standalone: origin,
        studioStopped: true
      }));
    } finally {
      if (standalone.pid) process.kill(-standalone.pid, 'SIGTERM');
      await new Promise<void>(resolve => standalone.once('close', () => resolve()));
    }
  } finally {
    await f.core.close();
  }
}, 300000);
