import Database from 'better-sqlite3';
import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startOwner } from '../../../../apps/studio/src/server/index.js';
import { request as httpRequest } from 'node:http';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function fixture() {
 const root = mkdtempSync(join(tmpdir(), 'baron-http-'));
 const owner = await startOwner({ ownerId: 'owner', capability: 'a'.repeat(48), metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'definitions') }, maxPayloadBytes: 4096 });
 cleanup.push(async () => { await owner.close(); rmSync(root, { recursive: true, force: true }); });
 return { owner, root, request: (path: string, init: RequestInit = {}) => fetch(owner.url + '/api/v1' + path, { ...init, headers: { authorization: 'Bearer ' + 'a'.repeat(48), ...init.headers } }) };
}
const command = (operation: string, input: unknown, expectedRevision = 1, requestId: string = crypto.randomUUID()) => ({ projectId: 'p', requestId, expectedRevision, operation, input });
async function post(request: (path: string, init?: RequestInit) => Promise<Response>, body: unknown) { return request('/projects/p/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
async function create(request: (path: string, init?: RequestInit) => Promise<Response>) { const response = await post(request, command('project.create', { name: 'Blank', approvedRoot: 'projects', target: 'next-typescript-sqlite' }, 0)); expect(response.status).toBe(200); }
const page = (id = 'page') => ({ kind: 'put', entity: 'page', id, value: { id, title: id, route: '/' + id, formIds: [], document: [] } });
test('real HTTP uses strict commands, atomic validation, revisions, retry IDs, paths and honest capabilities', async () => {
 const { request, root } = await fixture(); await create(request);
 const before = readFileSync(join(root, 'definitions/p.json'), 'utf8');
 for (const [body, status, code] of [
  [command('project.batch', { operations: [page(), page('other')], sql: 'DROP TABLE secret' }), 400, 'INVALID_INPUT'],
  [command('schema.apply', { planId: 'x', hash: 'f'.repeat(64), acknowledgedImpactIds: [] }), 400, 'INVALID_INPUT'],
  [command('project.batch', { operations: [page(), { ...page('other'), value: { ...page('other').value, route: '/page' } }] }), 422, 'VALIDATION_FAILED'],
  [command('project.export', { destination: 'projects:../outside.json' }), 403, 'PATH_OUTSIDE_ROOT'],
 ] as const) { const response = await post(request, body); expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ ok: false, error: { code } }); expect(readFileSync(join(root, 'definitions/p.json'), 'utf8')).toBe(before); }
 const edit = command('project.batch', { operations: [page()] }, 1, 'edit');
 const result = await (await post(request, edit)).json(); expect(result).toMatchObject({ ok: true, revision: 2 });
 expect(await (await post(request, edit)).json()).toEqual(result);
 expect(await (await post(request, { ...edit, input: { operations: [page('two')] } })).json()).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } });
 expect((await post(request, command('project.batch', { operations: [page('stale')] }))).status).toBe(409);
 expect(await (await request('/projects/p')).json()).toMatchObject({ ok: true, revision: 2, result: { pages: [{ id: 'page' }] } });
});
test('owner, origin, host, browser session CSRF, payload and route boundaries protect every read/write', async () => {
 const { owner, request, root } = await fixture(); await create(request);
 const before = readFileSync(join(root, 'definitions/p.json'), 'utf8');
 for (const headers of [{ authorization: '' }, { authorization: 'Bearer forged' }, { origin: 'https://evil.test' }, { 'sec-fetch-site': 'cross-site' }]) { expect((await request('/projects/p', { headers })).status).toBe(headers.authorization !== undefined ? 401 : 403); }
 const forgedHost = await new Promise<number>(resolve => { const req = httpRequest(owner.url + '/api/v1/projects/p', { headers: { host: 'evil.test', authorization: 'Bearer ' + 'a'.repeat(48) } }, response => { response.resume(); resolve(response.statusCode!); }); req.end(); }); expect(forgedHost).toBe(403);
 const exchange = await request('/session', { method: 'POST', headers: { origin: owner.url, 'content-type': 'application/json' }, body: '{}' });
 expect(exchange.status).toBe(200); const cookie = exchange.headers.get('set-cookie')!.split(';')[0]!; const { result: { csrfToken } } = await exchange.json();
 expect(await (await fetch(owner.url + '/api/v1/session', { headers: { cookie, 'sec-fetch-site': 'same-origin' } })).json()).toMatchObject({ result: { csrfToken } });
 const browserHeaders = { cookie, origin: owner.url, 'content-type': 'application/json' };
 expect((await fetch(owner.url + '/api/v1/projects/p')).status).toBe(401);
 expect((await fetch(owner.url + '/api/v1/projects/p', { headers: { cookie } })).status).toBe(403);
 expect((await fetch(owner.url + '/api/v1/projects/p', { headers: browserHeaders })).status).toBe(200);
 expect((await fetch(owner.url + '/api/v1/projects/p', { headers: { cookie, 'sec-fetch-site': 'same-origin' } })).status).toBe(200);
 const browserCommand = { method: 'POST', headers: browserHeaders, body: JSON.stringify(command('project.batch', { operations: [page()] })) };
 expect((await fetch(owner.url + '/api/v1/projects/p/commands', browserCommand)).status).toBe(403);
 expect((await request('/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(403);
 expect((await request('/projects/p/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(5000) })).status).toBe(413);
 expect((await request('/projects/p/commands', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status).toBe(400);
 expect((await request('/projects/p/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })).status).toBe(400);
 expect((await request('/projects/p?extra=value')).status).toBe(400);
 expect((await request('/projects/unknown')).status).toBe(404);
 const hiddenSecret = 'transient-input-do-not-store'; const invalid = await post(request, command('project.inspect', { password: hiddenSecret })); expect(await invalid.text()).not.toContain(hiddenSecret);
 expect((await post(request, { ...command('project.inspect', {}), projectId: 'different' })).status).toBe(400);
 expect(readFileSync(join(root, 'definitions/p.json'), 'utf8')).toBe(before);
 expect((await fetch(owner.url + '/api/v1/projects/p/commands', { ...browserCommand, headers: { ...browserHeaders, 'x-csrf-token': csrfToken } })).status).toBe(200);
 expect((await fetch(owner.url + '/api/v1/session', { method: 'DELETE', headers: { ...browserHeaders, 'x-csrf-token': csrfToken } })).status).toBe(200);
 expect((await fetch(owner.url + '/api/v1/projects/p', { headers: browserHeaders })).status).toBe(401);
});
test('jobs use same core and idempotency; cancellation cannot erase committed work; event gaps require snapshot', async () => {
 const { owner, request } = await fixture(); await create(request);
 owner.service.core.recordJob('owner', 'p', { id: 'job', status: 'running', committed: false, diagnostics: [] });
 expect(await (await request('/jobs/job?projectId=p')).json()).toMatchObject({ result: { status: 'running' } });
 owner.service.registerJobCanceler('p', 'job', job => ({ ...job, status: 'canceled' }));
 expect(await (await post(request, command('job.cancel', { jobId: 'job' }, 1, 'cancel'))).json()).toMatchObject({ result: { status: 'canceled', committed: false } });
 owner.service.core.recordJob('owner', 'p', { id: 'committed', status: 'succeeded', committed: true, diagnostics: [] });
 expect(await (await request('/jobs/committed?projectId=p&requestId=late&expectedRevision=1', { method: 'DELETE' })).json()).toMatchObject({ result: { status: 'succeeded', committed: true } });
 expect((await request('/jobs/missing?projectId=p')).status).toBe(404);
 const replay = await (await request('/projects/p/events?afterSequence=0')).text(); expect(replay).toContain('event: revision'); expect(replay).toContain('event: job');
 const gap = await (await request('/projects/p/events?afterSequence=999')).text(); expect(gap).toContain('event: refetch'); expect(gap).toContain('"refetchRequired":true');
 expect((await request('/projects/p/events?afterSequence=-1')).status).toBe(400);
 const firstPage = await (await request('/projects/p/events?afterSequence=0&limit=1')).text(); expect(firstPage).toContain('id: 1'); expect(firstPage).toContain('\"lastSequence\":1');
 const nextPage = await (await request('/projects/p/events?afterSequence=1&limit=1')).text(); expect(nextPage).toContain('id: 2');
});
test('registered features flow through canonical validators and freshness checks', async () => {
 const { owner, request } = await fixture(); await create(request);
 owner.service.register('flow.inspect', (_c, snapshot) => ({ result: { nodes: snapshot!.pages.map(p => ({ id: p.id, sourceObjectId: p.id, kind: 'page' })), edges: [] } }));
 expect((await post(request, command('flow.inspect', { projection: 'schema', raw: true }))).status).toBe(400);
 expect((await post(request, command('flow.inspect', { projection: 'schema' }, 2))).status).toBe(409);
 expect((await post(request, command('flow.inspect', { projection: 'schema' }))).status).toBe(200);
 expect(() => owner.service.register('flow.inspect', () => ({ result: { nodes: [], edges: [] } }))).toThrow();
});
test('job metadata rolls back with failed command completion and stale/duplicate cancellation never calls worker', async () => {
 const { owner, request, root } = await fixture(); await create(request);
 owner.service.core.recordJob('owner', 'p', { id: 'active', status: 'running', committed: false, diagnostics: [] });
 let calls = 0; let successful: unknown; let finalEvents: unknown; owner.service.registerJobCanceler('p', 'active', job => { calls++; return { ...job, status: 'canceled', outcome: { ok: false, revision: 1, error: { code: 'INVALID_INPUT', message: 'Canceled before commit.', retryable: false }, diagnostics: [] } }; });
 const db = new Database(join(root, 'metadata/metadata.sqlite'));
 try {
  db.exec("CREATE TRIGGER completion_failure BEFORE INSERT ON operations WHEN NEW.request = 'cancel-fail' BEGIN SELECT RAISE(ABORT, 'injected'); END");
  expect(await (await post(request, command('job.cancel', { jobId: 'active' }, 1, 'cancel-fail'))).json()).toMatchObject({ error: { code: 'RECOVERY_REQUIRED' } });
  expect(await (await request('/jobs/active?projectId=p')).json()).toMatchObject({ result: { status: 'running' } });
  expect(owner.service.core.events('owner', 'p', 0).events).toHaveLength(2);
  expect(owner.service.core.operation('owner', 'p', 'cancel-fail')).toBeUndefined();
  db.exec('DROP TRIGGER completion_failure');
  const cancel = command('job.cancel', { jobId: 'active' }, 1, 'cancel-ok');
  successful = await (await post(request, cancel)).json(); expect(successful).toMatchObject({ ok: true, result: { status: 'canceled', outcome: { ok: false } } }); expect(await (await post(request, cancel)).json()).toEqual(successful); expect(calls).toBe(2);
  finalEvents = owner.service.core.events('owner', 'p', 0);
  expect((await post(request, command('job.cancel', { jobId: 'active' }, 2, 'stale'))).status).toBe(409); expect(calls).toBe(2);
 } finally { db.close(); }
 await owner.close();
 const recovered = await startOwner({ ownerId: 'owner', capability: 'a'.repeat(48), metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'definitions') } });
 cleanup.push(() => recovered.close());
 expect(recovered.service.core.job('owner', 'p', 'active')).toMatchObject({ status: 'canceled' });
 const retry = recovered.service.core.execute('owner', command('job.cancel', { jobId: 'active' }, 1, 'cancel-ok')); expect(retry).toEqual(successful);
 expect(recovered.service.core.events('owner', 'p', 0)).toEqual(finalEvents);
 expect(recovered.service.core.operation('owner', 'p', 'cancel-ok')).toMatchObject({ eventSequence: recovered.service.core.events('owner', 'p', 0).events.at(-1)!.sequence });
 expect(recovered.service.core.operation('owner', 'p', 'cancel-fail')).toBeUndefined();
});
test('production generation apply cannot be replaced by an injected reviewed handler', async () => {
 const { owner, request } = await fixture(); await create(request);
 let applied=0;
 expect(()=>owner.service.registerReviewedApply('generation.apply', {
  withLease: (_command,work)=>work({fingerprint:'0'.repeat(64),now:new Date().toISOString()}),
  apply:()=>{applied++;throw Error('Injected handler must never run');}
 })).toThrow('Operation already registered');
 expect(await(await post(request,command('generation.apply',{planId:'missing',hash:'0'.repeat(64),acknowledgedImpactIds:[]}))).json()).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(applied).toBe(0);
});
