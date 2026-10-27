import { expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectCore } from '@schema-baron/core';
import { createId } from '@schema-baron/model';
import type { Project, ReviewedPlan } from '@schema-baron/model';

async function author(sql: string) {
 const root = mkdtempSync(join(tmpdir(), 'baron-physical-key-'));
 const core = new ProjectCore({ ownerId: 'owner', metadataRoot: join(root, 'metadata'), approvedRoots: { projects: join(root, 'projects') } });
 let db: Database.Database | undefined;
 const run = (operation: string, input: unknown, expectedRevision: number) => core.executeAsync('owner', { projectId: 'p', requestId: crypto.randomUUID(), operation, expectedRevision, input });
 try {
  expect(await run('project.create', { name: 'Physical key preservation', approvedRoot: 'projects', target: 'next-typescript-sqlite' }, 0)).toMatchObject({ ok: true });
  db = new Database(join(root, 'projects', 'source.sqlite')); db.exec(sql);
  const inspected = await run('connection.inspect', { approvedPath: 'projects:source.sqlite', mode: 'read-only' }, 1);
  if (!inspected.ok) throw new Error(inspected.error.code);
  const c = (inspected.result as { connection: { id: string; fingerprint: string } }).connection;
  expect(await run('connection.bind', { connectionId: c.id, fingerprint: c.fingerprint }, 1)).toMatchObject({ ok: true, revision: 2 });
  const read = await run('project.inspect', {}, 2); if (!read.ok) throw new Error(read.error.code);
  return { db, run, project: read.result as Project, close: async () => { await core.close(); db!.close(); rmSync(root, { recursive: true, force: true }); } };
 } catch (error) { await core.close(); db?.close(); rmSync(root, { recursive: true, force: true }); throw error; }
}
function nullKeyBehavior(db: Database.Database) {
 db.exec('SAVEPOINT key_behavior');
 try {
  try { db.exec('INSERT INTO t(k) VALUES(NULL)'); return { accepted: true, rows: db.prepare('SELECT rowid AS __review_rowid__,k FROM t ORDER BY rowid').all() }; }
  catch (error) { return { accepted: false, code: (error as { code?: string }).code }; }
 } finally { db.exec('ROLLBACK TO key_behavior; RELEASE key_behavior'); }
}
const cases = [
 ['INT independent key', 'CREATE TABLE t(k INT NOT NULL PRIMARY KEY,v TEXT); INSERT INTO t(rowid,k,v) VALUES(50,7,\'kept\')', false],
 ['INTEGER inline DESC independent key', 'CREATE TABLE t(k INTEGER PRIMARY KEY DESC NOT NULL,v TEXT); INSERT INTO t(rowid,k,v) VALUES(50,7,\'kept\')', false],
 ['INT table primary key', 'CREATE TABLE t(k INT NOT NULL,v TEXT,PRIMARY KEY(k)); INSERT INTO t(rowid,k,v) VALUES(50,7,\'kept\')', false],
 ['ordinary INTEGER rowid alias', 'CREATE TABLE t(k INTEGER PRIMARY KEY,v TEXT); INSERT INTO t(k,v) VALUES(7,\'kept\')', true],
 ['INTEGER table DESC remains a rowid alias', 'CREATE TABLE t(k INTEGER NOT NULL,v TEXT,PRIMARY KEY(k DESC)); INSERT INTO t(k,v) VALUES(7,\'kept\')', true],
 ['composite rowid-table key', 'CREATE TABLE t(k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k,v)); INSERT INTO t(rowid,k,v) VALUES(50,7,\'kept\')', false],
] as const;
test.each(cases)('public add-column rebuild preserves physical key/rowid and future NULL behavior: %s', async (_name, sql, nullAccepted) => {
 const { db, run, project, close } = await author(sql);
 const trial = new Database(':memory:');
 try {
  trial.exec(sql);
  const before = db.prepare('SELECT rowid AS __review_rowid__,* FROM t').all();
  const beforeObjects = db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all();
  const beforeColumns = db.pragma('table_xinfo(t)');
  const beforeKeys = db.pragma('index_list(t)') as { name: string; origin: string }[];
  const keyColumns = beforeKeys.filter(k => k.origin === 'pk').map(k => db.prepare('SELECT name,desc,coll,key FROM pragma_index_xinfo(?) ORDER BY seqno').all(k.name));
  const beforeNull = nullKeyBehavior(db); expect(beforeNull.accepted).toBe(nullAccepted);
  const schema = structuredClone(project.schema); schema.revision++;
  schema.tables[0]!.columns.push({ id: createId(), physicalName: 'added', type: { kind: 'text' }, nullable: true });
  expect(await run('project.batch', { operations: [{ kind: 'put', entity: 'schema', id: schema.id, value: schema }] }, 2)).toMatchObject({ ok: true, revision: 3 });
  const preview = await run('schema.preview', { desiredSchemaRevision: schema.revision, backfills: [] }, 3);
  expect(preview).toMatchObject({ ok: true }); if (!preview.ok) throw new Error(preview.error.code);
  const plan = preview.result as Extract<ReviewedPlan, { kind: 'migration' }>;
  expect(plan.changes).toEqual([expect.objectContaining({ kind: 'add' })]); expect(plan.requiredAcknowledgementIds).toEqual([]);
  expect(db.prepare('SELECT rowid AS __review_rowid__,* FROM t').all()).toEqual(before);
  expect(db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all()).toEqual(beforeObjects);
  trial.exec('PRAGMA foreign_keys=OFF; BEGIN'); for (const step of plan.steps) trial.exec(step.sql);
  expect(trial.pragma('foreign_key_check')).toEqual([]); expect(trial.pragma('integrity_check', { simple: true })).toBe('ok'); trial.exec('COMMIT');
  expect(trial.prepare('SELECT rowid AS __review_rowid__,* FROM t').all()).toEqual(before.map(row => ({ ...(row as object), added: null })));
  expect((trial.pragma('table_xinfo(t)') as unknown[]).slice(0, 2)).toEqual(beforeColumns);
  const afterKeys = trial.pragma('index_list(t)') as { name: string; origin: string }[];
  expect(afterKeys.filter(k => k.origin === 'pk').map(k => trial.prepare('SELECT name,desc,coll,key FROM pragma_index_xinfo(?) ORDER BY seqno').all(k.name))).toEqual(keyColumns);
  expect(nullKeyBehavior(trial)).toEqual(beforeNull);
 } finally { trial.close(); await close(); }
});
test('WITHOUT ROWID composite keys remain opaque and cannot be silently converted by add-column planning', async () => {
 const sql = 'CREATE TABLE t(k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k,v)) WITHOUT ROWID; INSERT INTO t VALUES(7,\'kept\')';
 const { db, run, project, close } = await author(sql); const trial = new Database(':memory:');
 try {
  trial.exec(sql); const before = db.prepare('SELECT * FROM t').all(); const originalSql = db.prepare("SELECT sql FROM sqlite_schema WHERE name='t'").pluck().get();
  const schema = structuredClone(project.schema); schema.revision++; schema.tables[0]!.columns.push({ id: createId(), physicalName: 'added', type: { kind: 'text' }, nullable: true });
  expect(await run('project.batch', { operations: [{ kind: 'put', entity: 'schema', id: schema.id, value: schema }] }, 2)).toMatchObject({ ok: true });
  expect(await run('schema.preview', { desiredSchemaRevision: schema.revision, backfills: [] }, 3)).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_SCHEMA_OBJECT' } });
  for (const observed of [db, trial]) { expect(observed.prepare('SELECT * FROM t').all()).toEqual(before); expect(observed.prepare("SELECT sql FROM sqlite_schema WHERE name='t'").pluck().get()).toBe(originalSql); expect(() => observed.prepare('SELECT rowid FROM t')).toThrow(); expect(() => observed.exec('INSERT INTO t(k,v) VALUES(NULL,\'invalid\')')).toThrow(); }
 } finally { trial.close(); await close(); }
});
test('a new INTEGER alias cannot silently replace an existing independent row identity', async () => {
 const { db, run, project, close } = await author('CREATE TABLE t(k INTEGER NOT NULL,v TEXT);INSERT INTO t(rowid,k,v) VALUES(50,7,\'kept\')');
 try {
  const schema = structuredClone(project.schema); schema.revision++; schema.tables[0]!.primaryKey = [schema.tables[0]!.columns[0]!.id];
  expect(await run('project.batch', { operations: [{ kind: 'put', entity: 'schema', id: schema.id, value: schema }] }, 2)).toMatchObject({ ok: true });
  expect(await run('schema.preview', { desiredSchemaRevision: schema.revision, backfills: [] }, 3)).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_SCHEMA_OBJECT' }, diagnostics: [expect.objectContaining({ objectId: schema.tables[0]!.id })] });
  expect(db.prepare('SELECT rowid AS __review_rowid__,* FROM t').all()).toEqual([{ __review_rowid__: 50, k: 7, v: 'kept' }]);
 } finally { await close(); }
});
test('an explicit conversion away from a rowid alias still enforces the desired non-null key', async () => {
 const sql = 'CREATE TABLE t(k INTEGER PRIMARY KEY,v TEXT);INSERT INTO t VALUES(7,\'kept\')';
 const { db, run, project, close } = await author(sql); const trial = new Database(':memory:');
 try {
  trial.exec(sql); const schema = structuredClone(project.schema); schema.revision++; const table = schema.tables[0]!, key = table.columns[0]!; key.type = { kind: 'real' };
  expect(await run('project.batch', { operations: [{ kind: 'put', entity: 'schema', id: schema.id, value: schema }] }, 2)).toMatchObject({ ok: true });
  const preview = await run('schema.preview', { desiredSchemaRevision: schema.revision, backfills: [{ tableId: table.id, columnId: key.id, expression: { kind: 'literal', value: 7, type: { kind: 'real' } } }] }, 3);
  expect(preview).toMatchObject({ ok: true }); if (!preview.ok) throw new Error(preview.error.code);
  const plan = preview.result as Extract<ReviewedPlan, { kind: 'migration' }>; expect(plan.requiredAcknowledgementIds.length).toBeGreaterThan(0);
  for (const step of plan.steps) trial.exec(step.sql);
  expect(trial.prepare('SELECT rowid AS __review_rowid__,* FROM t').all()).toEqual([{ __review_rowid__: 7, k: 7, v: 'kept' }]);
  expect(nullKeyBehavior(trial)).toMatchObject({ accepted: false, code: 'SQLITE_CONSTRAINT_NOTNULL' });
  expect(db.prepare('SELECT rowid AS __review_rowid__,* FROM t').all()).toEqual([{ __review_rowid__: 7, k: 7, v: 'kept' }]);
 } finally { trial.close(); await close(); }
});
