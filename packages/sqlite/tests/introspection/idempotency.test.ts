import {delayFlowDispatch} from '../../../core/tests/flow/async-fixture.js';
import { afterEach, expect, test } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectCore } from '@schema-baron/core';
import { StorageError } from '@schema-baron/storage';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const command = <Input>(operation: string, input: Input, requestId: string, expectedRevision = 1) => ({ projectId: 'p', requestId, operation, input, expectedRevision });
const inspect = (path: string, requestId: string) => command('connection.inspect', { approvedPath: `projects:${path}`, mode: 'read-only', createEmpty: true }, requestId);
function setup() {
 const root = mkdtempSync(join(tmpdir(), 'wp06-idempotency-'));
 const options = { ownerId: 'owner', metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'databases') } };
 const core = new ProjectCore(options);
 cleanup.push(async () => { await core.close(); rmSync(root, { recursive: true, force: true }); });
 expect(core.execute('owner', command('project.create', { name: 'Public retry boundary', approvedRoot: 'projects', target: 'next-typescript-sqlite' }, 'create', 0))).toMatchObject({ ok: true, revision: 1 });
 return { core, options, root, file: (name: string) => join(root, 'databases', name) };
}
test.each(['before handler', 'during worker'])('matching concurrent createEmpty requests execute once and replay after reopening: %s', async stage => {
 const { core, file, options } = setup(); const request = inspect('matching.sqlite', 'matching');
 const events = core.events('owner', 'p', 0);
 const pending = core.executeAsync('owner', request); if (stage === 'during worker') { await Promise.resolve(); expect(existsSync(file('matching.sqlite'))).toBe(true); }
 const duplicate = { ...request, input: { createEmpty: true, mode: 'read-only', approvedPath: 'projects:matching.sqlite' } };
 const [first, second] = await Promise.all([pending, core.executeAsync('owner', duplicate)]);
 expect(first).toMatchObject({ ok: true, revision: 1 }); expect(second).toEqual(first);
 expect(existsSync(file('matching.sqlite'))).toBe(true);
 expect(core.operation('owner', 'p', 'matching')).toMatchObject({ requestId: 'matching', outcome: 'committed', baseRevision: 1 });
 expect(core.snapshot('owner', 'p')).toMatchObject({ revision: 1, connections: [] });
 expect(core.events('owner', 'p', 0)).toEqual(events);
 expect(await core.executeAsync('owner', request)).toEqual(first);
 const record = core.operation('owner', 'p', 'matching'); await core.close(); const reopened = new ProjectCore(options);
 try { expect(await reopened.executeAsync('owner', request)).toEqual(first); expect(reopened.operation('owner', 'p', 'matching')).toEqual(record); }
 finally { await reopened.close(); }
});
test.each(['before handler', 'during worker'])('conflicting createEmpty payload rejects before creating its file: %s', async stage => {
 const { core, file } = setup();
 const winner = inspect('a.sqlite', 'conflicting'); const loser = inspect('b.sqlite', 'conflicting');
 const pending = core.executeAsync('owner', winner); if (stage === 'during worker') { await Promise.resolve(); expect(existsSync(file('a.sqlite'))).toBe(true); }
 const [first, second] = await Promise.all([pending, core.executeAsync('owner', loser)]);
 expect(first).toMatchObject({ ok: true, revision: 1 }); expect(second).toMatchObject({ ok: false, error: { code: 'IDEMPOTENCY_CONFLICT' } });
 expect([existsSync(file('a.sqlite')), existsSync(file('b.sqlite'))]).toEqual([true, false]);
 const record = core.operation('owner', 'p', 'conflicting'); expect(record).toMatchObject({ outcome: 'committed', baseRevision: 1 });
 expect(await core.executeAsync('owner', winner)).toEqual(first); expect(await core.executeAsync('owner', loser)).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } });
 expect(core.operation('owner', 'p', 'conflicting')).toEqual(record); expect(core.snapshot('owner', 'p').revision).toBe(1);
});
test('synchronous matching and conflicting calls cannot run or poison a reserved asynchronous request', async () => {
 const { core, file } = setup(); const request = inspect('async.sqlite', 'mixed'); const pending = core.executeAsync('owner', request);
 expect(core.execute('owner', request)).toMatchObject({ ok: false, error: { code: 'PROJECT_BUSY', retryable: true } });
 expect(core.execute('owner', inspect('rejected.sqlite', 'mixed'))).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } });
 expect(core.execute('owner', command('project.batch', { operations: [{ kind: 'put', entity: 'page', id: 'rejected', value: { id: 'rejected', route: '/rejected', title: 'Rejected', document: [], formIds: [] } }] }, 'mixed'))).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } });
 await Promise.resolve(); expect(existsSync(file('async.sqlite'))).toBe(true);
 expect(core.execute('owner', request)).toMatchObject({ error: { code: 'PROJECT_BUSY', retryable: true } });
 expect(core.execute('owner', inspect('rejected-after-await.sqlite', 'mixed'))).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } });
 expect(existsSync(file('rejected-after-await.sqlite'))).toBe(false);
 expect(core.operation('owner', 'p', 'mixed')).toBeUndefined();
 const result = await pending; expect(result).toMatchObject({ ok: true, revision: 1 }); expect(core.execute('owner', request)).toEqual(result);
 expect(existsSync(file('rejected.sqlite'))).toBe(false); expect(core.snapshot('owner', 'p')).toMatchObject({ revision: 1, pages: [] });
 expect(core.operation('owner', 'p', 'mixed')).toMatchObject({ outcome: 'committed' });
});
test('shared failures persist once and later retries cannot create a file after the external failure is repaired', async () => {
 const { core, file } = setup(); const request = inspect('missing/failed.sqlite', 'failure');
 const [first, second] = await Promise.all([core.executeAsync('owner', request), core.executeAsync('owner', request)]);
 expect(first).toMatchObject({ error: { code: 'ACCESS_DENIED' } }); expect(second).toEqual(first);
 const record = core.operation('owner', 'p', 'failure'); expect(record).toMatchObject({ outcome: 'failed' });
 mkdirSync(file('missing')); expect(await core.executeAsync('owner', request)).toEqual(first);
 expect(existsSync(file('missing/failed.sqlite'))).toBe(false); expect(core.operation('owner', 'p', 'failure')).toEqual(record);
});
test('reservation precedes the handler first await; generic canceled work is shared and conflicting sync calls never enter it', async () => {
 const { core } = setup(); let calls = 0; let release!: () => void;
 delayFlowDispatch(core.registry, async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); throw new StorageError('CANCELED', 'Canceled before commit.'); });
 const request = command('flow.inspect', { projection: 'schema' }, 'generic-cancel');
 const first = core.executeAsync('owner', request); const second = core.executeAsync('owner', request);
 await Promise.resolve(); expect(calls).toBe(1);
 expect(core.execute('owner', command('flow.inspect', { projection: 'application' }, 'generic-cancel'))).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } });
 release(); const result = await first; expect(result).toMatchObject({ error: { code: 'CANCELED' } }); expect(await second).toEqual(result);
 expect(await core.executeAsync('owner', request)).toEqual(result); expect(calls).toBe(1);
 expect(core.operation('owner', 'p', 'generic-cancel')).toMatchObject({ outcome: 'failed' });
});
test.each(['before handler', 'during worker'])('close settles matching reservations and the writer lease excludes a second core: %s', async stage => {
 const { core, file, options } = setup(); expect(() => new ProjectCore(options)).toThrowError('Another writer owns this store.');
 expect(() => new ProjectCore({ ...options, metadataRoot: join(options.metadataRoot, '../other-metadata') })).toThrowError('Another writer owns an approved project root.');
 const request = inspect('closed.sqlite', 'closing'); const first = core.executeAsync('owner', request); if (stage === 'during worker') await Promise.resolve(); const second = core.executeAsync('owner', request);
 await core.close(); const result = await first; expect(result).toMatchObject({ error: { code: 'RECOVERY_REQUIRED' } }); expect(await second).toEqual(result);
 expect(existsSync(file('closed.sqlite'))).toBe(stage === 'during worker');
 const reopened = new ProjectCore(options);
 try { expect(reopened.snapshot('owner', 'p')).toMatchObject({ revision: 1, connections: [] }); expect(reopened.operation('owner', 'p', 'closing')).toBeUndefined(); expect(await reopened.executeAsync('owner', request)).toMatchObject(stage === 'during worker' ? { error: { code: 'OUTPUT_CONFLICT' } } : { ok: true }); }
 finally { await reopened.close(); }
});
test('mutating caller input cannot change a reserved payload or its external location', async () => {
 const { core, file } = setup(); const request = inspect('original.sqlite', 'immutable'); const copy = structuredClone(request);
 const pending = core.executeAsync('owner', request); request.input.approvedPath = 'projects:changed.sqlite';
 const result = await pending; expect(result).toMatchObject({ ok: true, result: { connection: { locator: { relativePath: 'original.sqlite' } } } });
 expect(await core.executeAsync('owner', copy)).toEqual(result); expect(await core.executeAsync('owner', request)).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } });
 expect([existsSync(file('original.sqlite')), existsSync(file('changed.sqlite'))]).toEqual([true, false]);
});
test('a revision that advances before handler execution rejects without creating its file or claiming its key', async () => {
 const { core, file } = setup(); const request = inspect('stale.sqlite', 'stale'); const pending = core.executeAsync('owner', request);
 expect(core.execute('owner', command('project.batch', { operations: [{ kind: 'put', entity: 'page', id: 'page', value: { id: 'page', route: '/page', title: 'Before handler', document: [], formIds: [] } }] }, 'advance'))).toMatchObject({ ok: true, revision: 2 });
 expect(await pending).toMatchObject({ error: { code: 'REVISION_CONFLICT' } }); expect(existsSync(file('stale.sqlite'))).toBe(false); expect(core.operation('owner', 'p', 'stale')).toBeUndefined();
 expect(await core.executeAsync('owner', { ...request, expectedRevision: 2 })).toMatchObject({ ok: true, revision: 2 });
});
