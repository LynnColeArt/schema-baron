import { afterEach, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectCore } from '@schema-baron/core';
const roots: string[] = []; afterEach(() => roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })));
const edit = { requestId: 'edit', projectId: 'p', operation: 'project.batch', expectedRevision: 1, input: { operations: [{ kind: 'put', entity: 'page', id: 'page', value: { id: 'page', route: '/catalog', title: 'Catalog', formIds: [], document: [] } }] } };
function fixture() { const root = mkdtempSync(join(tmpdir(), 'baron-crash-')); roots.push(root); const definitions = join(root, 'definitions'); mkdirSync(definitions); return { root, definitions, options: { ownerId: 'owner', metadataRoot: join(root, 'metadata'), approvedRoots: { projects: definitions } } }; }
for (const boundary of ['intent', 'metadata', 'replacement', 'cleanup']) test(`real process termination after ${boundary} recovers one coherent revision and original retry`, () => {
 const { options, definitions } = fixture();
 const script = `import { ProjectCore } from '@schema-baron/core';
 let armed = false; const core = new ProjectCore({ ...${JSON.stringify(options)}, fault: stage => { if (armed && stage === ${JSON.stringify(boundary)}) process.exit(73); } });
 const created = core.execute('owner', { requestId:'create', projectId:'p', operation:'project.create',expectedRevision:0,input:{name:'Catalog',approvedRoot:'projects',target:'next-typescript-sqlite'}});
 if(!created.ok) throw new Error(JSON.stringify(created)); armed = true; core.execute('owner', ${JSON.stringify(edit)}); throw new Error('fault did not run');`;
 const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }); expect(child.status, child.stderr).toBe(73);
 const before = new Database(join(options.metadataRoot, 'metadata.sqlite'), { readonly: true });
 expect((before.prepare('SELECT count(*) AS n FROM journal').get() as { n: number }).n).toBe(1);
 const metadataRevision = JSON.parse((before.prepare('SELECT snapshot FROM projects WHERE id=?').get('p') as { snapshot: string }).snapshot).revision;
 const fileRevision = JSON.parse(readFileSync(join(definitions, 'p.json'), 'utf8')).revision;
 expect(metadataRevision).toBe(boundary === 'intent' ? 1 : 2); expect(fileRevision).toBe(['replacement', 'cleanup'].includes(boundary) ? 2 : 1); before.close();
 const core = new ProjectCore(options); expect(core.recovery).toEqual([{ projectId: 'p', outcome: 'rolled-forward' }]);
 expect(core.snapshot('owner', 'p')).toMatchObject({ revision: 2, pages: [{ id: 'page' }] });
 expect(core.execute('owner', edit)).toMatchObject({ ok: true, revision: 2 }); expect(core.events('owner', 'p', 0).events).toHaveLength(2); core.close();
 const oracle = new Database(join(options.metadataRoot, 'metadata.sqlite'), { readonly: true });
 expect((oracle.prepare('SELECT count(*) AS n FROM journal').get() as { n: number }).n).toBe(0);
 expect(JSON.parse((oracle.prepare('SELECT snapshot FROM projects WHERE id=?').get('p') as { snapshot: string }).snapshot)).toEqual(JSON.parse(readFileSync(join(definitions, 'p.json'), 'utf8')));
 expect((oracle.prepare('SELECT count(*) AS n FROM operations WHERE project=? AND request=?').get('p', 'edit') as { n: number }).n).toBe(1); oracle.close();
 const reopened = new ProjectCore(options); expect(reopened.recovery).toEqual([]); expect(reopened.snapshot('owner', 'p').revision).toBe(2); reopened.close();
});
test('unresolved external edits preserve files and prevent reopening for mutations', () => {
 const { options, definitions } = fixture(); let armed = false;
 const core = new ProjectCore({ ...options, fault: boundary => { if (armed && boundary === 'metadata') throw new Error('power loss'); } });
 expect(core.execute('owner', { requestId: 'create', projectId: 'p', operation: 'project.create', expectedRevision: 0, input: { name: 'P', approvedRoot: 'projects', target: 'next-typescript-sqlite' } }).ok).toBe(true);
 armed = true; expect(core.execute('owner', edit)).toMatchObject({ error: { code: 'RECOVERY_REQUIRED' } }); expect(() => core.snapshot('owner', 'p')).toThrow('Restart'); core.close();
 const path = join(definitions, 'p.json'); const original = JSON.parse(readFileSync(path, 'utf8')); writeFileSync(path, JSON.stringify({ ...original, name: 'External edit' })); const outside = readFileSync(path, 'utf8');
 expect(() => new ProjectCore(options)).toThrow('changed outside'); expect(readFileSync(path, 'utf8')).toBe(outside);
});
