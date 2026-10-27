import { test, expect } from 'vitest';
import { authored } from './fixture.js';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
test('concurrent distinct runtime starts cannot replace owned process authority', async () => {
  const f = await authored();
  let pids: number[] = [];
  try {
    const dir = join(f.app, 'node_modules/next/dist/bin');
    mkdirSync(dir, {
      recursive: true
    });
    writeFileSync(join(dir, 'next'), "console.log('ready');setInterval(()=>{},1000)");
    const settled = await Promise.allSettled([f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'run'
    }), f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'run'
    })]);
    const results = settled.filter(x => x.status === 'fulfilled').map(x => (x as any).value);
    for (const r of results) {
      const j: any = f.core.job('owner', f.id, r.jobId);
      pids.push(j.outcome.result.pid);
    }
    await f.core.close();
    const live = pids.filter(pid => existsSync(`/proc/${pid}/stat`) && !readFileSync(`/proc/${pid}/stat`, 'utf8').includes(') Z '));
    console.log(JSON.stringify({
      fulfilled: results.length,
      pids,
      liveAfterClose: live
    }));
    expect(results.length).toBe(1);
    expect(live).toEqual([]);
  } finally {
    await f.core.close();
    for (const pid of pids) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {}
    }
  }
});
test('project mutation while includeData awaits must not publish stale export', async () => {
  const f = await authored();
  try {
    const exporting = f.run('project.export', {
      destination: 'output:review-stale',
      includeData: true
    });
    await new Promise(resolve => setImmediate(resolve));
    const page = f.core.snapshot('owner', f.id).pages.find(p => p.id === f.saved)!;
    await f.run('project.batch', {
      operations: [{
        kind: 'put',
        entity: 'page',
        id: f.saved,
        value: {
          ...page,
          title: 'Changed during export'
        }
      }]
    });
    const result = await Promise.allSettled([exporting]);
    const published = existsSync(join(f.output, 'review-stale'));
    console.log(JSON.stringify({
      exportStatus: result[0].status,
      published,
      currentRevision: f.core.snapshot('owner', f.id).revision
    }));
    expect(published).toBe(false);
  } finally {
    await f.core.close();
  }
});
test('a pending launch can be canceled at the probe boundary without executing or losing its job', async () => {
  let cancel: Promise<unknown> | undefined;
  let action = () => {};
  const f = await authored({
    runtimeFault: () => action()
  });
  try {
    const dir = join(f.app, 'node_modules/next/dist/bin');
    mkdirSync(dir, {
      recursive: true
    });
    writeFileSync(join(dir, 'next'), "require('node:fs').writeFileSync('launched','bad');setInterval(()=>{},1000)");
    let jobId = '';
    action = () => {
      const result = f.core.execute('owner', {
        operation: 'runtime.status',
        projectId: f.id,
        requestId: crypto.randomUUID(),
        expectedRevision: f.core.snapshot('owner', f.id).revision,
        input: {}
      });
      if (!result.ok) throw Error();
      jobId = (result.result as any).jobId;
      cancel = f.core.cancelRuntime('owner', f.id, jobId);
    };
    await expect(f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'run'
    })).rejects.toThrow('CANCELED');
    expect(await cancel).toMatchObject({
      id: jobId,
      status: 'canceled'
    });
    expect(existsSync(join(f.app, 'launched'))).toBe(false);
  } finally {
    await f.core.close();
  }
});
test('core.close fences a pending probe and awaits the failed command and all job callbacks', async () => {
  let closing: Promise<void> | undefined;
  let action = () => {};
  const f = await authored({
    runtimeFault: () => action()
  });
  try {
    const dir = join(f.app, 'node_modules/next/dist/bin');
    mkdirSync(dir, {
      recursive: true
    });
    writeFileSync(join(dir, 'next'), "require('node:fs').writeFileSync('launched','bad');setInterval(()=>{},1000)");
    action = () => {
      closing = f.core.close();
    };
    await expect(f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'run'
    })).rejects.toThrow();
    await closing;
    expect(existsSync(join(f.app, 'launched'))).toBe(false);
  } finally {
    await f.core.close();
  }
});
test('source promotion fences a pending start through its source swap', async () => {
  let promoting: Promise<any> | undefined;
  let action = () => {};
  const f = await authored({
    runtimeFault: () => action()
  });
  try {
    const dir = join(f.app, 'node_modules/next/dist/bin');
    mkdirSync(dir, {
      recursive: true
    });
    writeFileSync(join(dir, 'next'), "require('node:fs').writeFileSync('launched','bad');setInterval(()=>{},1000)");
    const plan = await f.run('generation.preview', {
      target: 'next-typescript-sqlite',
      projectRevision: f.core.snapshot('owner', f.id).revision,
      outputRoot: 'output:app'
    });
    action = () => {
      promoting = f.run('generation.apply', {
        planId: plan.id,
        hash: plan.hash,
        acknowledgedImpactIds: plan.requiredAcknowledgementIds
      });
    };
    await expect(f.run('runtime.start', {
      generatedRevision: 1,
      intent: 'run'
    })).rejects.toThrow('PROJECT_BUSY');
    expect(await promoting).toMatchObject({
      manifest: {
        outputTreeRevision: 2
      }
    });
    expect(existsSync(join(f.app, 'launched'))).toBe(false);
  } finally {
    await f.core.close();
  }
});
test('stale export refusal is durable and retry leaves no destination or staging', async () => {
  const f = await authored();
  try {
    const input = {
      operation: 'project.export',
      projectId: f.id,
      requestId: crypto.randomUUID(),
      expectedRevision: f.core.snapshot('owner', f.id).revision,
      input: {
        destination: 'output:stale-durable',
        includeData: true
      }
    };
    const exporting = f.core.executeAsync('owner', input);
    await new Promise(resolve => setImmediate(resolve));
    const page = f.core.snapshot('owner', f.id).pages.find(p => p.id === f.saved)!;
    await f.run('project.batch', {
      operations: [{
        kind: 'put',
        entity: 'page',
        id: page.id,
        value: {
          ...page,
          title: 'Changed'
        }
      }]
    });
    const result = await exporting;
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'REVISION_CONFLICT'
      }
    });
    expect(await f.core.executeAsync('owner', input)).toEqual(result);
    expect(f.core.operation('owner', f.id, input.requestId)).toMatchObject({
      outcome: 'failed'
    });
    expect(existsSync(join(f.output, 'stale-durable'))).toBe(false);
    expect((await import('node:fs')).readdirSync(f.output).some(p => p.startsWith('.portable-'))).toBe(false);
  } finally {
    await f.core.close();
  }
});
test('authored source edit during data export invalidates the exact captured bytes without changing model revision', async () => {
  const f = await authored();
  try {
    const before = await f.run('extension.read', {
        extensionId: f.extension,
        approvedPath: 'output:app/authored/private-validator.ts'
      }),
      revision = f.core.snapshot('owner', f.id).revision;
    const exporting = f.run('project.export', {
      destination: 'output:stale-authored',
      includeData: true
    });
    await new Promise(resolve => setImmediate(resolve));
    await f.run('extension.write', {
      extensionId: f.extension,
      approvedPath: 'output:app/authored/private-validator.ts',
      expectedFileHash: before.hash,
      content: before.content + '\n// authored edit during export\n'
    });
    expect(f.core.snapshot('owner', f.id).revision).toBe(revision);
    await expect(exporting).rejects.toThrow('OUTPUT_CONFLICT');
    expect(existsSync(join(f.output, 'stale-authored'))).toBe(false);
    expect((await import('node:fs')).readdirSync(f.output).some(p => p.startsWith('.portable-'))).toBe(false);
  } finally {
    await f.core.close();
  }
});
