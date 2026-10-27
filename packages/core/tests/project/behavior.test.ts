import Database from 'better-sqlite3';
import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectCore, planHash } from '../../src/index.js';
import { hash } from '@schema-baron/storage';
const roots: string[] = []; afterEach(() => roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })));
function fixture() { const root = mkdtempSync(join(tmpdir(), 'baron-lifecycle-')); roots.push(root); const definitions = join(root, 'definitions'); mkdirSync(definitions); return { root, definitions, options: { ownerId: 'owner', metadataRoot: join(root, 'metadata'), approvedRoots: { projects: definitions } } }; }
function create(core: ProjectCore, id = 'p') { const result = core.execute('owner', { requestId: `create-${id}`, projectId: id, expectedRevision: 0, operation: 'project.create', input: { name: id, approvedRoot: 'projects', target: 'next-typescript-sqlite' } }); expect(result.ok).toBe(true); }
function batch(core: ProjectCore, id: string, ops: unknown[], expectedRevision = 1, requestId = 'edit') { return core.execute('owner', { requestId, projectId: id, expectedRevision, operation: 'project.batch', input: { operations: ops } }); }
const page = (id: string, route = `/${id}`) => ({ kind: 'put', entity: 'page', id, value: { id, route, title: id, formIds: [], document: [] } });
test('invalid final candidates leave every entity, revision, event and file unchanged', () => {
 const { options, definitions } = fixture(); const core = new ProjectCore(options); create(core);
 const before = readFileSync(join(definitions, 'p.json'), 'utf8'); const events = core.events('owner', 'p', 0);
 expect(batch(core, 'p', [page('one'), page('two', '/one')])).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
 expect(readFileSync(join(definitions, 'p.json'), 'utf8')).toBe(before); expect(core.events('owner', 'p', 0).events.slice(0, events.events.length)).toEqual(events.events);
 expect(core.events('owner', 'p', 0).events.at(-1)).toMatchObject({ kind: 'diagnostic' });
 expect(batch(core, 'p', [page('one')], 1, 'valid')).toMatchObject({ ok: true, revision: 2 });
 expect(batch(core, 'p', [page('two')], 1, 'valid')).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } }); core.close();
});
test('projects stay isolated, switch by ID, export portable definitions, and reconnect moved roots', () => {
 const { options, root, definitions } = fixture(); let core = new ProjectCore(options); create(core); create(core, 'q');
 expect(batch(core, 'p', [page('one')]).ok).toBe(true); expect(core.snapshot('owner', 'q').pages).toEqual([]);
 expect(core.execute('owner', { requestId: 'list', projectId: 'p', expectedRevision: 0, operation: 'project.list', input: { approvedRoot: 'projects' } })).toMatchObject({ ok: true, result: [{ id: 'p', revision: 2 }, { id: 'q', revision: 1 }] });
 const result = core.execute('owner', { requestId: 'export', projectId: 'p', expectedRevision: 2, operation: 'project.export', input: { destination: 'projects:portable.json' } }); expect(result.ok).toBe(true);
 const portable = JSON.parse(readFileSync(join(definitions, 'portable.json'), 'utf8')); expect(portable).toEqual(core.snapshot('owner', 'p')); expect(JSON.stringify(portable)).not.toContain(root);
 core.close(); const moved = join(root, 'moved-definitions'); renameSync(definitions, moved); core = new ProjectCore({ ...options, approvedRoots: { projects: moved } }); expect(core.snapshot('owner', 'p').revision).toBe(2); expect(core.snapshot('owner', 'q').revision).toBe(1); core.close();
});
test('newer definitions are refused and preserved without overwrite', () => {
 const { options, definitions } = fixture(); const core = new ProjectCore(options); create(core); const path = join(definitions, 'p.json'); const newer = { ...core.snapshot('owner', 'p'), formatVersion: 900 }; writeFileSync(path, JSON.stringify(newer)); const before = readFileSync(path, 'utf8');
 expect(batch(core, 'p', [page('one')], 1, 'valid')).toMatchObject({ error: { code: 'UNSUPPORTED_FORMAT' } }); expect(readFileSync(path, 'utf8')).toBe(before); core.close();
});
test('writer exclusion, traversal and symlink escapes cannot alter outside files', () => {
 const { options, root, definitions } = fixture(); const core = new ProjectCore(options); expect(() => new ProjectCore(options)).toThrow('Another writer'); expect(() => new ProjectCore({ ...options, metadataRoot: join(root, 'other-metadata') })).toThrow('Another writer'); create(core);
 const outside = join(root, 'outside.json'); writeFileSync(outside, 'keep'); symlinkSync(root, join(definitions, 'escape'));
 for (const destination of ['projects:../outside.json', 'projects:escape/outside.json']) expect(core.execute('owner', { requestId: destination, projectId: 'p', expectedRevision: 1, operation: 'project.export', input: { destination } })).toMatchObject({ error: { code: 'PATH_OUTSIDE_ROOT' } });
 expect(readFileSync(outside, 'utf8')).toBe('keep'); core.close();
});
test('immutable reviewed plan content, expiry, acknowledgements and source revision are checked', () => {
 const { options } = fixture(); let core = new ProjectCore(options); create(core); const p = core.snapshot('owner', 'p');
 const content = { id: 'plan', kind: 'generation', sourceRevision: 1, modelHash: hash(p), createdAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-02T00:00:00Z', impact: [{ id: 'impact', kind: 'change', description: 'Replace generated output', requiresAcknowledgement: true }], requiredAcknowledgementIds: ['impact'], generatorVersion: '1', outputFingerprint: '0'.repeat(64), outputRootId: 'output', extensionHashes: {}, steps: [] };
 const plan = { ...content, hash: planHash(content) };
 core.plans.record('owner', 'p', plan); expect(() => core.plans.record('owner', 'p', plan)).toThrow('immutable'); expect(() => core.plans.record('owner', 'p', { ...plan, generatorVersion: 'tampered' })).toThrow('hash');
 core.close(); core = new ProjectCore(options); expect(core.plans.inspect('owner', 'p', 'plan')).toMatchObject({ generatorVersion: '1' });
 const input = { planId: 'plan', hash: plan.hash, acknowledgedImpactIds: ['impact'] }; const observed = { fingerprint: '0'.repeat(64), now: '2026-01-01T12:00:00Z' };
 expect(core.plans.validate('owner', 'p', input, observed)).toEqual([]);
 expect(core.plans.validate('owner', 'p', { ...input, acknowledgedImpactIds: [] }, observed)).toMatchObject([{ code: 'IMPACT_NOT_ACKNOWLEDGED' }]);
 expect(core.plans.validate('owner', 'p', { ...input, hash: 'f'.repeat(64) }, observed)).toMatchObject([{ code: 'PLAN_HASH_MISMATCH' }]);
 expect(core.plans.validate('owner', 'p', input, { ...observed, fingerprint: 'f'.repeat(64) })).toMatchObject([{ code: 'OUTPUT_CONFLICT' }]);
 expect(core.plans.validate('owner', 'p', input, { ...observed, now: '2026-02-01T00:00:00Z' })).toMatchObject([{ code: 'PLAN_EXPIRED' }]);
 batch(core, 'p', [page('one')]); expect(core.plans.validate('owner', 'p', input, observed)).toMatchObject([{ code: 'REVISION_CONFLICT' }]); core.close();
 const metadata = new Database(join(options.metadataRoot, 'metadata.sqlite')); metadata.prepare('UPDATE plans SET body=? WHERE project=? AND id=?').run(JSON.stringify({ ...plan, generatorVersion: 'changed-on-disk' }), 'p', 'plan'); metadata.close();
 core = new ProjectCore(options); expect(() => core.plans.inspect('owner', 'p', 'plan')).toThrow('content changed'); core.close();
});

test('duplicate create cannot replace a project and exported files open through the same core in a new store', () => {
 const { options, definitions, root } = fixture(); const core = new ProjectCore(options); create(core);
 const before = readFileSync(join(definitions, 'p.json'), 'utf8');
 const command = { requestId: 'another-create', projectId: 'p', expectedRevision: 0, operation: 'project.create', input: { name: 'Replacement', approvedRoot: 'projects', target: 'next-typescript-sqlite' } };
 expect(core.execute('owner', command)).toMatchObject({ error: { code: 'REVISION_CONFLICT' } }); expect(readFileSync(join(definitions, 'p.json'), 'utf8')).toBe(before); core.close();
 const imported = new ProjectCore({ ...options, metadataRoot: join(root, 'new-metadata') });
 expect(imported.execute('owner', { requestId: 'open', projectId: 'p', operation: 'project.open', expectedRevision: 1, input: { locator: 'projects:p.json' } })).toMatchObject({ ok: true, revision: 1 });
 expect(imported.snapshot('owner', 'p').name).toBe('p'); imported.close();
});
test('sequenced event replay and persisted job ports remain project-scoped', () => {
 const { options } = fixture(); let core = new ProjectCore(options); create(core); create(core, 'q');
 batch(core, 'p', [page('one')]); batch(core, 'q', [page('two')]);
 expect(core.events('owner', 'p', 0).events.map(e => e.sequence)).toEqual([1, 2]);
 expect(core.events('owner', 'p', 99).refetchRequired).toBe(true);
 expect(core.events('owner', 'p', 1, 1)).toMatchObject({ events: [{ sequence: 2 }], refetchRequired: false });
 core.recordJob('owner', 'p', { id: 'job', status: 'running', committed: false, diagnostics: [] }); core.close(); core = new ProjectCore(options);
 expect(core.job('owner', 'p', 'job')).toMatchObject({ status: 'running' }); expect(core.job('owner', 'q', 'job')).toBeUndefined();
 expect(core.events('owner', 'p', 2).events).toMatchObject([{ sequence: 3, kind: 'job', jobId: 'job' }]); core.close();
});

test('unknown properties and transient credential operations never persist raw values', () => {
 const { options } = fixture(); const core = new ProjectCore(options); create(core);
 const marker = 'transient-test-value-123';
 expect(core.execute('owner', { requestId: 'password', projectId: 'p', expectedRevision: 1, operation: 'identity.provision', input: { identitySourceRef: 'source', username: 'user', password: marker } })).toMatchObject({ error: { code: 'INVALID_INPUT' } });
 expect(core.execute('owner', { requestId: 'unknown', projectId: 'p', expectedRevision: 1, operation: 'project.inspect', input: { password: marker } })).toMatchObject({ error: { code: 'INVALID_INPUT' } });
 expect(JSON.stringify(core.snapshot('owner', 'p'))).not.toContain(marker); expect(core.operation('owner', 'p', 'password')).toBeUndefined(); core.close();
 const metadata = new Database(join(options.metadataRoot, 'metadata.sqlite'), { readonly: true });
 for (const table of ['projects', 'operations', 'events', 'journal', 'plans', 'jobs']) expect(JSON.stringify(metadata.prepare(`SELECT * FROM ${table}`).all())).not.toContain(marker); metadata.close();
});

test('metadata cannot be nested in definition roots even with dot-prefixed names', () => {
 const { options, definitions } = fixture();
 expect(() => new ProjectCore({ ...options, metadataRoot: join(definitions, '..metadata') })).toThrow('separate roots');
});

test('opaque long IDs remain valid without exceeding filesystem filename limits', () => {
 const { options } = fixture(); const core = new ProjectCore(options); const id = 'é'.repeat(200); create(core, id);
 expect(core.snapshot('owner', id).id).toBe(id); core.close();
});
