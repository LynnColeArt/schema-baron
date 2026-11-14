import { closeSync, existsSync, lstatSync, openSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { createId, parseProject } from '@schema-baron/model';
import type { Connection, Project, Schema, Table } from '@schema-baron/model';
import { safePath, StorageError } from '@schema-baron/storage';
import { SQLiteError, SQLiteWorker } from '@schema-baron/sqlite';
import type { Inspection } from '@schema-baron/sqlite';
import type { CommandRegistry } from '../commands/index.js';
interface Options { approvedRoots: Record<string,string>; metadataRoot: string }
interface Preview { reconnectId?: Connection['id']; projectId: string; revision: number; connection: Connection; schema: Schema; path: string; identity: string; expires: number }
/** Paths pass the storage boundary before SQLite (including companion files) opens them. */
export function connectionPath(roots: Record<string,string>, locator: string, metadataRoot: string) {
 const split = locator.indexOf(':'); const rootId = locator.slice(0, split); const root = roots[rootId]; const local = locator.slice(split + 1);
 if (split < 1 || !root || !local || isAbsolute(local) || local.split(/[\\/]/).some(p => p === '..') || local.includes('\\')) throw new StorageError('PATH_OUTSIDE_ROOT', 'Select an approved root and a relative SQLite file path.');
 const path = safePath(root, local); const metadataRelative = relative(metadataRoot, path);
 if (!metadataRelative.startsWith('..') && !isAbsolute(metadataRelative) || /(^|[/\\])\.schema-baron-|\.(json|sqlite-(?:wal|shm|journal))$/i.test(local) || /-(wal|shm|journal)$/.test(local)) throw new StorageError('PATH_OUTSIDE_ROOT', 'Choose an application SQLite file separate from definitions and owner metadata.');
 for (const suffix of ['', '-wal', '-shm', '-journal']) { const file = safePath(root, local + suffix); if (existsSync(file) && lstatSync(file).nlink > 1) throw new StorageError('PATH_OUTSIDE_ROOT', 'SQLite files cannot alias another location.'); }
 return { path, locator: { approvedRootId: rootId, relativePath: local } };
}
const identity = (path: string) => { if (!existsSync(path)) throw new StorageError('NOT_FOUND', 'Selected SQLite file is missing. Reconnect its new location; existing-file inspection never creates a replacement.'); const stat = lstatSync(path); return `${stat.dev}:${stat.ino}`; };
const action = (value: string): Table['foreignKeys'][number]['onDelete'] => value.toLowerCase().replaceAll(' ', '-') as Table['foreignKeys'][number]['onDelete'];
export function schemaFromInspection(inspection: Inspection, previous: Schema): Schema {
 const schema: Schema = { id: previous.id, revision: previous.revision + 1, tables: [], opaqueObjects: [] };
 const opaque = (kind: string, name: string, sql: string, dependencies: Schema['opaqueObjects'][number]['dependencies'] = []) => { const old = previous.opaqueObjects.find(o => o.kind === kind && o.physicalName === name); schema.opaqueObjects.push({ id: old?.id ?? createId(), kind, physicalName: name, sql, dependencies, readOnly: true }); };
 for (const physical of inspection.tables) {
  const old = previous.tables.find(t => t.physicalName === physical.name);
  const source = inspection.objects.find(o => o.name === physical.name && o.type === 'table');
  const integerPrimaryKey = physical.columns.filter(c => c.pk).length === 1 && !/\bDESC\b/i.test(source?.sql ?? '');
  const columns = physical.columns.map(c => ({ id: old?.columns.find(v => v.physicalName === c.name)?.id ?? createId(), physicalName: c.name, type: { kind: /INT/i.test(c.type) ? 'integer' as const : /CHAR|CLOB|TEXT/i.test(c.type) ? 'text' as const : /REAL|FLOA|DOUB/i.test(c.type) ? 'real' as const : 'blob' as const }, nullable: !(c.notnull || (c.pk && integerPrimaryKey && /^INTEGER$/i.test(c.type))) }));
  // SQLite permits nullable primary keys in ordinary rowid tables. Keep that observation.
  const table: Table = { id: old?.id ?? createId(), physicalName: physical.name, columns, primaryKey: physical.columns.filter(c => c.pk > 0).some(c => columns.find(v => v.physicalName === c.name)!.nullable) ? [] : physical.columns.filter(c => c.pk > 0).sort((a,b) => a.pk-b.pk).map(c => columns.find(v => v.physicalName === c.name)!.id), foreignKeys: [], uniqueConstraints: [], checks: [], indexes: [] };
  for (const index of physical.indexes) {
   const keys = index.columns.filter(c => c.key); const ids = keys.flatMap(c => columns.find(v => v.physicalName === c.name)?.id ?? []);
   if (keys.some(c => c.cid < 0 || c.coll !== 'BINARY' || c.desc) || index.partial || ids.length !== keys.length) { if (index.sql) opaque('index', index.name, index.sql, [table.id]); continue; }
   if (index.origin === 'u') table.uniqueConstraints.push({ id: old?.uniqueConstraints.find(u => JSON.stringify(u.columnIds) === JSON.stringify(ids))?.id ?? createId(), columnIds: ids });
   if (index.origin === 'c' && ids.length) table.indexes.push({ id: old?.indexes.find(i => i.physicalName === index.name)?.id ?? createId(), physicalName: index.name, columnIds: ids, unique: !!index.unique });
  }
  const object = inspection.objects.find(o => o.name === physical.name && o.type === 'table');
  if (object?.sql && (/\b(CHECK|DEFAULT|GENERATED|VIRTUAL|STRICT|WITHOUT|COLLATE|AUTOINCREMENT|DEFERRABLE|CONFLICT)\b/i.test(object.sql) || physical.columns.some(c => (c.pk && columns.find(v => v.physicalName === c.name)!.nullable) || c.hidden || !/^(INTEGER|INT|REAL|TEXT|BLOB)$/i.test(c.type)))) opaque('table', physical.name, object.sql, [table.id]);
  schema.tables.push(table);
 }
 for (const physical of inspection.tables) {
  const table = schema.tables.find(t => t.physicalName === physical.name)!;
  for (const id of [...new Set(physical.foreignKeys.map(f => f.id))]) {
   const keys = physical.foreignKeys.filter(f => f.id === id).sort((a,b) => a.seq-b.seq); const first = keys[0]!; const target = schema.tables.find(t => t.physicalName === first.table);
   const from = keys.flatMap(k => table.columns.find(c => c.physicalName === k.from)?.id ?? []);
   const to = keys.flatMap((k,i) => k.to === null ? target?.primaryKey[i] ?? [] : target?.columns.find(c => c.physicalName === k.to)?.id ?? []);
   if (!target || from.length !== keys.length || to.length !== keys.length || ![target.primaryKey, ...target.uniqueConstraints.map(u => u.columnIds), ...target.indexes.filter(i => i.unique).map(i => i.columnIds)].some(ids => JSON.stringify(ids) === JSON.stringify(to)) || keys.some((k,i) => ['SET DEFAULT'].includes(k.on_delete) || ['SET DEFAULT'].includes(k.on_update) || (['SET NULL'].includes(k.on_delete) || ['SET NULL'].includes(k.on_update)) && !table.columns.find(c => c.id === from[i])?.nullable || JSON.stringify(table.columns.find(c => c.id === from[i])?.type) !== JSON.stringify(target?.columns.find(c => c.id === to[i])?.type)) || /\bDEFERRABLE\b/i.test(inspection.objects.find(o => o.name === physical.name)?.sql ?? '')) { const object = inspection.objects.find(o => o.name === physical.name); if (object?.sql && !schema.opaqueObjects.some(o => o.physicalName === physical.name)) opaque('table', physical.name, object.sql, [table.id]); continue; }
   const old = previous.tables.find(t => t.id === table.id)?.foreignKeys.find(f => JSON.stringify(f.columnIds) === JSON.stringify(from));
   table.foreignKeys.push({ id: old?.id ?? createId(), columnIds: from, referencedTableId: target.id, referencedColumnIds: to, onDelete: action(first.on_delete), onUpdate: action(first.on_update), deferrable: false });
  }
 }
 for (const object of inspection.objects.filter(o => o.type === 'view' || o.type === 'trigger')) if (object.sql) opaque(object.type, object.name, object.sql, schema.tables.filter(t => t.physicalName === object.tbl_name).map(t => t.id));
 return schema;
}
export function registerConnections(registry: CommandRegistry, options: Options, hasBaseline: (projectId: string, connection: Connection) => boolean) {
 const workers = new Set<SQLiteWorker>();
 async function inspect(path: string): Promise<Inspection> { const worker = new SQLiteWorker(path); workers.add(worker); try { return await worker.inspect(); } catch (error) { if (error instanceof SQLiteError) throw new StorageError(error.code, error.message); throw error; } finally { await worker.close(); workers.delete(worker); } }
 const previews = new Map<string, Preview>();
 registry.registerAsync('connection.inspect', async (command, project) => {
  if (command.operation !== 'connection.inspect' || !project) throw new StorageError('INVALID_INPUT', 'Open a project first.');
  const { path, locator } = connectionPath(options.approvedRoots, command.input.approvedPath, options.metadataRoot);
  const prior = command.input.connectionId ? project.connections.find(c => c.id === command.input.connectionId) : undefined;
  if (command.input.connectionId && !prior) throw new StorageError('NOT_FOUND', 'Unknown connection to reconnect.');
  if (command.input.createEmpty) {
   // An empty SQLite file is valid. Exclusive creation cannot truncate an existing DB.
   try { const fd = openSync(path, 'wx', 0o600); closeSync(fd); } catch (error) { throw new StorageError((error as { code?: string }).code === 'EEXIST' ? 'OUTPUT_CONFLICT' : 'ACCESS_DENIED', 'Empty database could not be created. Choose an unused file in an existing writable approved directory.'); }
  }
  const before = identity(path); const physical = await inspect(path); if (identity(path) !== before) throw new StorageError('DATABASE_CHANGED', 'SQLite file was replaced during inspection. Inspect again.');
  const schema = schemaFromInspection(physical, prior?.fingerprint === physical.fingerprint && hasBaseline(project.id, prior) ? prior.inspectedSchema ?? project.schema : project.schema);
  const previewId = createId();
  const connection: Connection = { id: previewId, inspectedForConnectionId: prior?.id ?? previewId, name: locator.relativePath, locator: { approvedRootId: createId(() => locator.approvedRootId), relativePath: locator.relativePath }, fingerprint: physical.fingerprint, inspectedSchema: schema, capabilities: { sqliteVersion: physical.sqliteVersion, foreignKeys: physical.foreignKeys, returning: physical.sqliteVersion.split('.').slice(0,2).map(Number).reduce((a,b) => a*100+b,0) >= 335, strictTables: physical.sqliteVersion.split('.').slice(0,2).map(Number).reduce((a,b) => a*100+b,0) >= 337, unsupportedObjects: schema.opaqueObjects.map(o => o.id) }, physical: { encoding: physical.encoding, objects: physical.objects, tables: physical.tables } };
  for (const [id, preview] of previews) if (preview.expires < Date.now()) previews.delete(id);
  if (previews.size >= 100) previews.delete(previews.keys().next().value!);
  previews.set(connection.id, { ...(prior ? { reconnectId: prior.id } : {}), projectId: project.id, revision: project.revision, connection, schema, path, identity: before, expires: Date.now()+300000 });
  return { result: { connection, schema } };
 });
 registry.registerAsync('connection.bind', async (command, project) => {
  if (command.operation !== 'connection.bind' || !project) throw new StorageError('INVALID_INPUT', 'Open a project first.');
  const preview = previews.get(command.input.connectionId);
  if (!preview || preview.projectId !== project.id || preview.expires < Date.now()) throw new StorageError('DATABASE_CHANGED', 'Inspection is missing or expired. Inspect the selected location again.');
  if (preview.revision !== project.revision || preview.connection.fingerprint !== command.input.fingerprint) throw new StorageError('DATABASE_CHANGED', 'Inspection does not match this project revision or fingerprint. Inspect again.');
  const { path } = connectionPath(options.approvedRoots, `${preview.connection.locator.approvedRootId}:${preview.connection.locator.relativePath}`, options.metadataRoot);
  if (identity(path) !== preview.identity || (await inspect(path)).fingerprint !== command.input.fingerprint || identity(path) !== preview.identity) throw new StorageError('DATABASE_CHANGED', 'SQLite schema or file changed after inspection. Inspect again before binding.');
  if (project.connections.length && !project.connections.some(c => c.id === preview.reconnectId)) throw new StorageError('VALIDATION_FAILED', 'This project already has a schema connection. Select its connection ID to reconnect it.');
  const candidate = parseProject({ ...project, revision: project.revision+1, connections: [{ ...preview.connection, id: preview.reconnectId ?? preview.connection.id }], connectionRefs: [preview.reconnectId ?? preview.connection.id], schema: preview.schema });
  return { result: { changedIds: [preview.reconnectId ?? preview.connection.id, preview.schema.id] }, candidate, changedIds: [preview.reconnectId ?? preview.connection.id, preview.schema.id] };
 });
 return async () => { previews.clear(); await Promise.all([...workers].map(worker => worker.close())); };
}
