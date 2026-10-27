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
const directionCases = [
 { name: 'INT inline DESC', definition: 'k INT NOT NULL PRIMARY KEY DESC,v TEXT NOT NULL', first: 'k', second: 'v', ordering: 'k DESC,v ASC', composite: false },
 { name: 'INT table DESC', definition: 'k INT NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k DESC)', first: 'k', second: 'v', ordering: 'k DESC,v ASC', composite: false },
 { name: 'composite DESC/ASC', definition: 'k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k DESC,v ASC)', first: 'k', second: 'v', ordering: 'k DESC,v ASC', composite: true },
 { name: 'composite ASC/DESC', definition: 'k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k ASC,v DESC)', first: 'k', second: 'v', ordering: 'k ASC,v DESC', composite: true },
 { name: 'composite DESC/DESC', definition: 'k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k DESC,v DESC)', first: 'k', second: 'v', ordering: 'k DESC,v DESC', composite: true },
 { name: 'composite ASC/ASC control', definition: 'k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k ASC,v ASC)', first: 'k', second: 'v', ordering: 'k ASC,v ASC', composite: true },
 { name: 'quoted composite mixed direction', definition: '"select "" key" INTEGER NOT NULL,"from value" TEXT NOT NULL,PRIMARY KEY("select "" key" DESC,"from value" ASC)', first: '"select "" key"', second: '"from value"', ordering: '"select "" key" DESC,"from value" ASC', composite: true },
] as const;
function primaryKeyMetadata(db: Database.Database) {
 const pk = (db.pragma('index_list(t)') as { name: string; origin: string }[]).find(i => i.origin === 'pk');
 if (!pk) throw new Error('Fixture must have an independent physical PK index');
 return db.prepare('SELECT seqno,cid,name,desc,coll,key FROM pragma_index_xinfo(?) ORDER BY seqno').all(pk.name);
}
test.each(directionCases)('preserves full physical PK metadata and actual ORDER BY plan: $name', async c => {
 const sql = `CREATE TABLE t(${c.definition});INSERT INTO t(_rowid_,${c.first},${c.second}) VALUES(50,7,'b'),(60,3,'z'),(70,9,'a')${c.composite?",(80,7,'a')":''}`;
 const { db, run, project, close } = await author(sql); const trial = new Database(':memory:');
 try {
  trial.exec(sql); const statement = `SELECT ${c.first},${c.second} FROM t ORDER BY ${c.ordering}`;
  const observed = () => ({ keys: primaryKeyMetadata(db), rows: db.prepare('SELECT _rowid_ AS identity_value,* FROM t ORDER BY _rowid_').all(), columns: db.pragma('table_xinfo(t)'), objects: db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all(), queryPlan: db.prepare('EXPLAIN QUERY PLAN '+statement).all() });
  const before = observed(); const ordered = db.prepare(statement).all();
  const schema = structuredClone(project.schema); schema.revision++; schema.tables[0]!.columns.push({ id: createId(), physicalName: 'added', type: { kind: 'text' }, nullable: true });
  expect(await run('project.batch', { operations: [{ kind: 'put', entity: 'schema', id: schema.id, value: schema }] }, 2)).toMatchObject({ ok: true });
  const preview = await run('schema.preview', { desiredSchemaRevision: schema.revision, backfills: [] }, 3); expect(preview).toMatchObject({ ok: true }); if (!preview.ok) throw new Error(preview.error.code);
  expect(observed()).toEqual(before);
  const plan = preview.result as Extract<ReviewedPlan, { kind: 'migration' }>;
  expect(plan.changes).toEqual([expect.objectContaining({ kind: 'add' })]); expect(plan.requiredAcknowledgementIds).toEqual([]);
  trial.exec('BEGIN'); for (const step of plan.steps) trial.exec(step.sql); expect(trial.pragma('integrity_check', { simple: true })).toBe('ok'); trial.exec('COMMIT');
  expect(primaryKeyMetadata(trial)).toEqual(before.keys);
  expect(trial.prepare('SELECT _rowid_ AS identity_value,* FROM t ORDER BY _rowid_').all()).toEqual(before.rows.map(row => ({ ...(row as object), added: null })));
  expect((trial.pragma('table_xinfo(t)') as unknown[]).slice(0, 2)).toEqual(before.columns);
  expect(trial.prepare(statement).all()).toEqual(ordered);
  const actualPlan = trial.prepare('EXPLAIN QUERY PLAN '+statement).all();
  // SQLite's estimated cost changes with the added column width; compare the
  // actual access/sort strategy rather than the auxiliary estimate.
  const strategy = (rows: unknown[]) => rows.map(row => { const { id, parent, detail } = row as { id: number; parent: number; detail: string }; return { id, parent, detail }; });
  expect(strategy(actualPlan)).toEqual(strategy(before.queryPlan));
  if(c.composite) { expect(actualPlan).toEqual(expect.arrayContaining([expect.objectContaining({ detail: expect.stringContaining('COVERING INDEX') })])); expect(actualPlan).not.toEqual(expect.arrayContaining([expect.objectContaining({ detail: expect.stringContaining('TEMP B-TREE') })])); }
 } finally { trial.close(); await close(); }
});
test.each(['NOCASE','RTRIM'])('unsupported PK collation %s blocks instead of silently normalizing its descriptor', async collation => {
 const { db, run, project, close } = await author(`CREATE TABLE t(k INTEGER NOT NULL,v TEXT COLLATE ${collation} NOT NULL,PRIMARY KEY(k DESC,v ASC));INSERT INTO t(_rowid_,k,v) VALUES(50,7,'kept')`);
 try {
  const keys = primaryKeyMetadata(db); expect(keys).toEqual(expect.arrayContaining([expect.objectContaining({ coll: collation })])); const before = db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all();
  const schema = structuredClone(project.schema); schema.revision++; schema.tables[0]!.columns.push({ id: createId(), physicalName: 'added', type: { kind: 'text' }, nullable: true }); await run('project.batch', { operations: [{ kind: 'put', entity: 'schema', id: schema.id, value: schema }] }, 2);
  expect(await run('schema.preview', { desiredSchemaRevision: schema.revision, backfills: [] }, 3)).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_SCHEMA_OBJECT' } });
  expect(primaryKeyMetadata(db)).toEqual(keys); expect(db.prepare('SELECT _rowid_ AS identity_value,* FROM t').all()).toEqual([{ identity_value: 50, k: 7, v: 'kept' }]); expect(db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all()).toEqual(before);
 } finally { await close(); }
});
test('an imported descending UNIQUE absent from the logical model must not disappear in a rebuild', async () => {
 const { db, run, project, close } = await author('CREATE TABLE t(k INT NOT NULL PRIMARY KEY,v TEXT,UNIQUE(v DESC));INSERT INTO t(_rowid_,k,v) VALUES(50,7,\'kept\')');
 try {
  const before = db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all(); const schema = structuredClone(project.schema); schema.revision++; schema.tables[0]!.columns.push({ id: createId(), physicalName: 'added', type: { kind: 'text' }, nullable: true }); await run('project.batch', { operations: [{ kind: 'put', entity: 'schema', id: schema.id, value: schema }] }, 2);
  expect(await run('schema.preview', { desiredSchemaRevision: schema.revision, backfills: [] }, 3)).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_SCHEMA_OBJECT' } });
  expect(db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all()).toEqual(before); expect(() => db.exec("INSERT INTO t(k,v) VALUES(8,'kept')")).toThrow(); expect(db.prepare('SELECT _rowid_ AS identity_value,* FROM t').all()).toEqual([{ identity_value: 50, k: 7, v: 'kept' }]);
 } finally { await close(); }
});
test('a represented ASC UNIQUE and ordinary index remain enforced and present after a supported rebuild', async () => {
 const sql = 'CREATE TABLE t(k INT NOT NULL PRIMARY KEY,v TEXT NOT NULL,UNIQUE(v ASC));CREATE INDEX ordinary_index ON t(k,v);INSERT INTO t(_rowid_,k,v) VALUES(50,7,\'kept\')';
 const { db, run, project, close } = await author(sql); const trial = new Database(':memory:');
 try {
  trial.exec(sql); const schema = structuredClone(project.schema); schema.revision++; schema.tables[0]!.columns.push({ id: createId(), physicalName: 'added', type: { kind: 'text' }, nullable: true }); await run('project.batch', { operations: [{ kind: 'put', entity: 'schema', id: schema.id, value: schema }] }, 2);
  const preview = await run('schema.preview', { desiredSchemaRevision: schema.revision, backfills: [] }, 3); expect(preview).toMatchObject({ ok: true }); if (!preview.ok) throw new Error(preview.error.code);
  for (const step of (preview.result as Extract<ReviewedPlan,{kind:'migration'}>).steps) trial.exec(step.sql);
  expect(trial.pragma('index_list(t)')).toEqual(db.pragma('index_list(t)'));
  expect(trial.prepare('SELECT _rowid_ AS identity_value,* FROM t').all()).toEqual([{ identity_value: 50, k: 7, v: 'kept', added: null }]);
  expect(() => trial.exec("INSERT INTO t(k,v) VALUES(8,'kept')")).toThrow(); expect(() => trial.exec("INSERT INTO t(k,v) VALUES(7,'different')")).toThrow(); expect(trial.pragma('integrity_check',{simple:true})).toBe('ok');
 } finally { trial.close(); await close(); }
});
