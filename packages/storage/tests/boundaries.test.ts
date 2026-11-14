import { afterEach, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, linkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectCore } from '@schema-baron/core';
const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
function fixture() { const root = mkdtempSync(join(tmpdir(), 'baron-boundaries-')); temporary.push(root); const definitions = join(root, 'defs'); mkdirSync(definitions); return { root, definitions }; }
for (const leaf of ['metadata.sqlite', 'writer.sqlite', 'metadata.sqlite-wal', 'metadata.sqlite-shm', 'metadata.sqlite-journal', 'writer.sqlite-journal', 'writer.sqlite-wal', 'writer.sqlite-shm', '.schema-baron-writer.sqlite', '.schema-baron-writer.sqlite-journal', '.schema-baron-writer.sqlite-wal', '.schema-baron-writer.sqlite-shm']) test(`native SQLite rejects ${leaf} symlinks before touching outside data`, () => {
 const { root, definitions } = fixture(); const metadataRoot = join(root, 'meta'); mkdirSync(metadataRoot);
 const outside = join(root, 'outside.sqlite'); const seed = new Database(outside); seed.exec("CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES('keep')"); seed.close();
 const before = readFileSync(outside); const base = leaf.startsWith('.schema-baron') ? definitions : metadataRoot; symlinkSync(outside, join(base, leaf));
 let core: ProjectCore | undefined; let failure: unknown;
 try { core = new ProjectCore({ ownerId: 'o', metadataRoot, approvedRoots: { projects: definitions } }); } catch (error) { failure = error; } finally { core?.close(); }
 // Read the oracle even if construction unexpectedly succeeds: the outside DB must remain exact.
 const bytes = readFileSync(outside); const oracle = new Database(outside, { readonly: true });
 const tables = oracle.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all(); const sentinel = oracle.prepare('SELECT value FROM sentinel').all(); oracle.close();
 expect(failure).toMatchObject({ code: 'PATH_OUTSIDE_ROOT' }); expect(bytes).toEqual(before); expect(tables).toEqual([{ name: 'sentinel' }]); expect(sentinel).toEqual([{ value: 'keep' }]);
});
const edit = (id: string, revision = 1) => ({ requestId: id, projectId: 'p', operation: 'project.batch', expectedRevision: revision, input: { operations: [{ kind: 'put', entity: 'page', id, value: { id, route: `/${id}`, title: id, formIds: [], document: [] } }] } });
for (const reverse of [false, true]) test(`overlapping parent/child roots refuse the second actual-file writer (${reverse ? 'child first' : 'parent first'})`, () => {
 const { root, definitions } = fixture(); const nested = join(definitions, 'nested'); mkdirSync(nested);
 const base = { ownerId: 'o', metadataRoot: join(root, 'seed'), approvedRoots: { projects: nested } };
 const seed = new ProjectCore(base); expect(seed.execute('o', { requestId: 'create', projectId: 'p', operation: 'project.create', expectedRevision: 0, input: { name: 'P', approvedRoot: 'projects', target: 'next-typescript-sqlite' } }).ok).toBe(true); seed.close();
 let secondResult: ReturnType<ProjectCore['execute']> | undefined;
 const first = new ProjectCore({ ...base, metadataRoot: join(root, 'first'), approvedRoots: { parentAlias: reverse ? nested : definitions }, fault: stage => { if (stage === 'metadata') secondResult = second.execute('o', edit('second')); } });
 const second = new ProjectCore({ ...base, metadataRoot: join(root, 'second'), approvedRoots: { childAlias: reverse ? definitions : nested } });
 const open = (core: ProjectCore, locator: string, expectedRevision = 1) => core.execute('o', { requestId: `open-${expectedRevision}`, projectId: 'p', operation: 'project.open', expectedRevision, input: { locator } });
 try {
  expect(open(first, reverse ? 'parentAlias:p.json' : 'parentAlias:nested/p.json').ok).toBe(true);
  const secondOpen = open(second, reverse ? 'childAlias:nested/../nested/p.json' : 'childAlias:./p.json');
  const firstResult = first.execute('o', edit('first')); expect(firstResult).toMatchObject({ ok: true, revision: 2 }); expect(secondResult?.ok, 'Two revision-1 writers must never both acknowledge revision 2').toBe(false);
  expect(secondOpen).toMatchObject({ ok: false, error: { code: 'PROJECT_BUSY' } });
  const definition = JSON.parse(readFileSync(join(nested, 'p.json'), 'utf8')); expect(definition.pages.map((p: { id: string }) => p.id)).toEqual(['first']);
  const oracleA = new Database(join(root, 'first/metadata.sqlite'), { readonly: true }); const oracleB = new Database(join(root, 'second/metadata.sqlite'), { readonly: true });
  expect(JSON.parse((oracleA.prepare('SELECT snapshot FROM projects WHERE id=?').get('p') as { snapshot: string }).snapshot)).toEqual(definition);
  expect(oracleA.prepare("SELECT request FROM operations WHERE request='first'").all()).toHaveLength(1); expect(oracleB.prepare('SELECT * FROM projects').all()).toHaveLength(0); expect(oracleB.prepare('SELECT * FROM operations').all()).toHaveLength(0); oracleA.close(); oracleB.close();
 } catch (error) { second.close(); throw error; } finally { first.close(); }
 // Closing the first writer releases the canonical-file lease; the next writer observes revision 2.
 try { expect(open(second, reverse ? 'childAlias:nested/p.json' : 'childAlias:p.json', 2)).toMatchObject({ ok: true, revision: 2 }); expect(second.execute('o', edit('second-after-release', 2))).toMatchObject({ ok: true, revision: 3 }); expect(second.snapshot('o', 'p').pages.map(p => p.id)).toEqual(['first', 'second-after-release']); } finally { second.close(); }
});

for (const suffix of ['', '-journal', '-wal', '-shm']) test(`definition-file lease refuses a pre-existing ${suffix || 'database'} symlink`, () => {
 const { root, definitions } = fixture(); const options = { ownerId: 'o', metadataRoot: join(root, 'meta'), approvedRoots: { projects: definitions } };
 let core = new ProjectCore(options); const beforeCreate = new Set(readdirSync(definitions));
 expect(core.execute('o', { requestId: 'create', projectId: 'p', operation: 'project.create', expectedRevision: 0, input: { name: 'P', approvedRoot: 'projects', target: 'next-typescript-sqlite' } }).ok).toBe(true); core.close();
 const leaseFiles = readdirSync(definitions).filter(name => !beforeCreate.has(name) && name.endsWith('.sqlite')); expect(leaseFiles).toHaveLength(1);
 const outside = join(root, 'outside.sqlite'); const seed = new Database(outside); seed.exec('CREATE TABLE sentinel(value TEXT)'); seed.close(); const bytes = readFileSync(outside);
 const link = join(definitions, leaseFiles[0]! + suffix); if (suffix === '') unlinkSync(link); symlinkSync(outside, link);
 core = new ProjectCore(options); try { expect(core.execute('o', { requestId: 'inspect', projectId: 'p', operation: 'project.inspect', expectedRevision: 1, input: {} })).toMatchObject({ error: { code: 'PATH_OUTSIDE_ROOT' } }); } finally { core.close(); }
 expect(readFileSync(outside)).toEqual(bytes); const oracle = new Database(outside, { readonly: true }); expect(oracle.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toEqual([{ name: 'sentinel' }]); oracle.close();
});
test('hard-linked definition aliases are refused before atomic replacement could split their identity', () => {
 const { root, definitions } = fixture(); const options = { ownerId: 'o', metadataRoot: join(root, 'meta'), approvedRoots: { projects: definitions } };
 let core = new ProjectCore(options); expect(core.execute('o', { requestId: 'create', projectId: 'p', operation: 'project.create', expectedRevision: 0, input: { name: 'P', approvedRoot: 'projects', target: 'next-typescript-sqlite' } }).ok).toBe(true); core.close();
 const original = join(definitions, 'p.json'); const alias = join(root, 'alias.json'); linkSync(original, alias); const bytes = readFileSync(original);
 core = new ProjectCore(options); try { expect(core.execute('o', edit('blocked'))).toMatchObject({ error: { code: 'PATH_OUTSIDE_ROOT' } }); } finally { core.close(); }
 expect(readFileSync(original)).toEqual(bytes); expect(readFileSync(alias)).toEqual(bytes);
});

test('native metadata files reject hard-link aliases as well as symbolic aliases', () => {
 const { root, definitions } = fixture(); const metadataRoot = join(root, 'meta'); mkdirSync(metadataRoot);
 const outside = join(root, 'outside.sqlite'); const seed = new Database(outside); seed.exec('CREATE TABLE sentinel(value TEXT)'); seed.close(); const bytes = readFileSync(outside);
 linkSync(outside, join(metadataRoot, 'metadata.sqlite'));
 expect(() => new ProjectCore({ ownerId: 'o', metadataRoot, approvedRoots: { projects: definitions } })).toThrow('must not alias'); expect(readFileSync(outside)).toEqual(bytes);
});
