import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectCore } from '../../src/index.js';
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })));
function setup() { const root = mkdtempSync(join(tmpdir(), 'baron-core-')); roots.push(root); const definitions = join(root, 'definitions'); mkdirSync(definitions); return { root, definitions, options: { ownerId: 'owner', metadataRoot: join(root, 'metadata'), approvedRoots: { projects: definitions } } }; }
test('public callable API creates, atomically edits, retries and reopens persisted project', () => {
 const { options, definitions } = setup(); let core = new ProjectCore(options);
 const create = { requestId: 'create', projectId: 'p', expectedRevision: 0, operation: 'project.create', input: { name: 'Books', approvedRoot: 'projects', target: 'next-typescript-sqlite' } };
 const created = core.execute('owner', create); expect(created.ok).toBe(true);
 const cmd = { requestId: 'batch', projectId: 'p', expectedRevision: 1, operation: 'project.batch', input: { operations: [{ kind: 'put', entity: 'page', id: 'page', value: { id: 'page', route: '/books', title: 'Books', formIds: [], document: [] } }] } };
 const edited = core.execute('owner', cmd); expect(edited).toMatchObject({ ok: true, revision: 2 });
 expect(core.execute('owner', cmd)).toEqual(edited);
 expect(core.operation('owner', 'p', 'batch')).toMatchObject({ actor: 'owner', baseRevision: 1, newRevision: 2, outcome: 'committed', eventSequence: 2 });
 expect(core.execute('owner', { ...cmd, input: { operations: [] } })).toMatchObject({ ok: false });
 expect(core.execute('owner', { ...cmd, requestId: 'stale' })).toMatchObject({ error: { code: 'REVISION_CONFLICT' } });
 expect(core.execute('other', cmd)).toMatchObject({ error: { code: 'ACCESS_DENIED' } });
 expect(JSON.parse(readFileSync(join(definitions, 'p.json'), 'utf8')).revision).toBe(2);
 core.close(); core = new ProjectCore(options);
 expect(core.snapshot('owner', 'p').pages.map(p => p.id)).toEqual(['page']); expect(core.execute('owner', cmd)).toEqual(edited); core.close();
});
