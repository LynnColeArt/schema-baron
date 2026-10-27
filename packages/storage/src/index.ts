import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { canonicalJson, parseProject, operationRecordSchema, FORMAT_VERSION } from '@schema-baron/model';
import type { Connection, Job, Project } from '@schema-baron/model';
export class StorageError extends Error { constructor(readonly code: string, message: string) { super(message); } }
export const hash = (value: unknown): string => createHash('sha256').update(canonicalJson(value)).digest('hex');
function definitionFilename(id: string): string { const encoded = encodeURIComponent(id); return `${encoded.length <= 200 ? encoded : `%long-${hash(id)}`}.json`; }
export type SaveBoundary = 'intent' | 'metadata' | 'replacement' | 'cleanup';
export interface StorageOptions { metadataRoot: string; approvedRoots: Record<string, string>; fault?: (boundary: SaveBoundary) => void }
/** Reject symlinks at every existing component, including the approved root itself. */
export function safePath(root: string, locator: string): string {
 const base = resolve(root); const target = resolve(base, locator); const rel = relative(base, target);
 if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new StorageError('PATH_OUTSIDE_ROOT', 'Path leaves an approved root.');
 let cursor = resolve('/'); for (const part of target.split(sep).filter(Boolean)) { cursor = join(cursor, part); if (existsSync(cursor) || (() => { try { lstatSync(cursor); return true; } catch { return false; } })()) { if (lstatSync(cursor).isSymbolicLink()) throw new StorageError('PATH_OUTSIDE_ROOT', 'Symbolic links are not approved paths.'); } }
 return target;
}
/** SQLite may open these companion paths itself after the main database opens. */
function databasePath(root: string, name: string): string {
 const path = safePath(root, name);
 for (const suffix of ['', '-journal', '-wal', '-shm']) {
  const child = safePath(root, `${name}${suffix}`);
  if (existsSync(child) && lstatSync(child).nlink > 1) throw new StorageError('PATH_OUTSIDE_ROOT', 'SQLite files must not alias files outside their configured location.');
 }
 return path;
}
function exclusiveLease(path: string, message: string): Database.Database {
 const lease = new Database(path);
 try { lease.pragma('busy_timeout = 0'); lease.exec('BEGIN EXCLUSIVE'); return lease; }
 catch { lease.close(); throw new StorageError('PROJECT_BUSY', message); }
}
function syncDirectory(path: string) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function replace(path: string, content: string) {
 const temporary = join(dirname(path), `.save-${randomUUID()}`); const fd = openSync(temporary, 'wx', 0o600);
 try { writeFileSync(fd, content); fsyncSync(fd); } finally { closeSync(fd); }
 try { renameSync(temporary, path); syncDirectory(dirname(path)); } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}
interface ProjectRow { id: string; root: string; locator: string; snapshot: string }
export interface StoredRecord { requestId: string; payloadHash: string; actor: string; baseRevision: number; newRevision?: number; outcome: unknown }
interface Journal extends ProjectRow { beforeHash: string | null; record: string; event: string }
export class ProjectStorage {
 private db: Database.Database; private lease: Database.Database; private rootLeases: Database.Database[] = []; private definitionLeases = new Map<string, Database.Database>(); private blocked = false;
 readonly roots: Record<string, string>;
 constructor(private options: StorageOptions) {
  this.roots = Object.freeze(Object.fromEntries(Object.entries(options.approvedRoots).map(([id, root]) => [id, safePath(root, '.')])));
  const metadata = safePath(options.metadataRoot, '.');
  for (const root of Object.values(this.roots)) { const r = relative(root, metadata); const inverse = relative(metadata, root); if ((r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r)) || (inverse !== '..' && !inverse.startsWith(`..${sep}`) && !isAbsolute(inverse))) throw new StorageError('PATH_OUTSIDE_ROOT', 'Metadata and definitions need separate roots.'); mkdirSync(root, { recursive: true }); }
  mkdirSync(metadata, { recursive: true, mode: 0o700 });
  const metadataPath = databasePath(metadata, 'metadata.sqlite');
  const writerPath = databasePath(metadata, 'writer.sqlite');
  const rootPaths = [...new Set(Object.values(this.roots))].sort().map(root => databasePath(root, '.schema-baron-writer.sqlite'));
  this.lease = exclusiveLease(writerPath, 'Another writer owns this store.');
  try {
   for (const path of rootPaths) this.rootLeases.push(exclusiveLease(path, 'Another writer owns an approved project root.'));
   this.db = new Database(metadataPath);
  } catch (error) { for (const lock of this.rootLeases) lock.close(); this.lease.close(); throw error; }
  try {
   const version = this.db.pragma('user_version', { simple: true }); if (version !== 0 && version !== 1) throw new StorageError('UNSUPPORTED_FORMAT', 'Unsupported metadata version.');
   this.db.pragma('user_version = 1'); this.db.pragma('journal_mode = WAL'); this.db.pragma('synchronous = FULL');
   this.db.exec(`CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, root TEXT NOT NULL, locator TEXT NOT NULL, snapshot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS journal(id TEXT PRIMARY KEY, root TEXT NOT NULL, locator TEXT NOT NULL, snapshot TEXT NOT NULL, beforeHash TEXT, record TEXT NOT NULL, event TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS operations(project TEXT NOT NULL, request TEXT NOT NULL, payloadHash TEXT NOT NULL, outcome TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(project,request));
    CREATE TABLE IF NOT EXISTS events(sequence INTEGER NOT NULL, project TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(project,sequence));
    CREATE TABLE IF NOT EXISTS plans(project TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(project,id));
    CREATE TABLE IF NOT EXISTS jobs(project TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(project,id));`);
   this.recover();
  } catch (error) { this.db.close(); for (const lock of this.definitionLeases.values()) lock.close(); for (const lock of this.rootLeases) lock.close(); this.lease.close(); throw error; }
 }
 /** Key exclusion by the resolved file path, not by a configurable root ID or boundary.
  * The stable sidecar survives atomic JSON replacement and works across metadata stores. */
 private acquireDefinition(path: string) {
  if (existsSync(path) && lstatSync(path).nlink > 1) throw new StorageError('PATH_OUTSIDE_ROOT', 'Hard-linked definitions cannot preserve alias identity under atomic replacement.');
  if (this.definitionLeases.has(path)) return;
  const sidecar = databasePath(dirname(path), `.schema-baron-definition-${hash(basename(path))}.sqlite`);
  const lease = exclusiveLease(sidecar, 'Another writer owns this project definition.');
  this.definitionLeases.set(path, lease);
 }
 private path(row: Pick<ProjectRow, 'root' | 'locator'>) { const root = this.roots[row.root]; if (!root) throw new StorageError('PATH_OUTSIDE_ROOT', 'Reconnect this approved root before opening the project.'); return safePath(root, row.locator); }
 private assertReady() { if (this.blocked) throw new StorageError('RECOVERY_REQUIRED', 'Restart the project store to reconcile an interrupted save.'); }
 private completeRecord(project: string, record: StoredRecord, event: unknown) {
  const exists = this.db.prepare('SELECT 1 FROM operations WHERE project=? AND request=?').get(project, record.requestId);
  if (exists) return;
  const sequence = (this.db.prepare('SELECT coalesce(max(sequence),0) AS next FROM events WHERE project=?').get(project) as { next: number }).next + (event ? 1 : 0);
  this.db.prepare('INSERT INTO operations VALUES(?,?,?,?,?)').run(project, record.requestId, record.payloadHash, JSON.stringify(record.outcome), JSON.stringify(operationRecordSchema.parse({ requestId: record.requestId, payloadHash: record.payloadHash, actor: record.actor, baseRevision: record.baseRevision, ...(record.newRevision === undefined ? {} : { newRevision: record.newRevision }), outcome: (record.outcome as { ok?: boolean }).ok ? 'committed' : 'failed', eventSequence: sequence })));
  if (event) this.db.prepare('INSERT INTO events VALUES(?,?,?)').run(sequence, project, JSON.stringify(event));
 }
 private installMetadata(j: Journal) {
  this.db.prepare('INSERT OR REPLACE INTO projects VALUES(?,?,?,?)').run(j.id, j.root, j.locator, j.snapshot);
  this.completeRecord(j.id, JSON.parse(j.record) as StoredRecord, JSON.parse(j.event));
 }
 complete(project: string, record: StoredRecord, event: unknown, job?: Job) { this.assertReady(); this.db.transaction(() => { if (job) this.putJob(project, job.id, job); this.completeRecord(project, record, event); })(); }
 operation(project: string, request: string): unknown { this.snapshot(project); const row = this.db.prepare('SELECT record FROM operations WHERE project=? AND request=?').get(project, request) as { record: string } | undefined; return row && JSON.parse(row.record); }
 readonly recovery: { projectId: string; outcome: 'rolled-forward' }[] = [];
 private recover() {
  for (const j of this.db.prepare('SELECT * FROM journal').all() as Journal[]) {
   const path = this.path(j); this.acquireDefinition(path); const after = parseProject(JSON.parse(j.snapshot));
   const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as unknown : null;
   if (current !== null && hash(current) !== hash(after) && hash(current) !== j.beforeHash) throw new StorageError('RECOVERY_REQUIRED', 'Definition changed outside the interrupted save; preserve and reconcile it.');
   this.db.transaction(() => this.installMetadata(j))(); replace(path, `${JSON.stringify(after, null, 2)}\n`);
   this.db.prepare('DELETE FROM journal WHERE id=?').run(j.id); this.recovery.push({ projectId: j.id, outcome: 'rolled-forward' });
  }
 }
 snapshot(id: string): Project { this.assertReady(); const row = this.db.prepare('SELECT * FROM projects WHERE id=?').get(id) as ProjectRow | undefined; if (!row) throw new StorageError('NOT_FOUND', 'Unknown project.'); const path = this.path(row); this.acquireDefinition(path); const value = JSON.parse(readFileSync(path, 'utf8')) as { formatVersion?: number }; if (value.formatVersion !== FORMAT_VERSION) throw new StorageError('UNSUPPORTED_FORMAT', 'Unsupported definition version; no overwrite performed.'); const project = parseProject(value); if (hash(project) !== hash(JSON.parse(row.snapshot))) throw new StorageError('REVISION_CONFLICT', 'Definition changed externally; reopen or import it.'); return project; }
 open(id: string, locator: string): Project {
  this.assertReady();
  if (locator === id) return this.snapshot(id);
  const separator = locator.indexOf(':'); const rootId = locator.slice(0, separator); const root = this.roots[rootId];
  if (separator < 1 || !root) throw new StorageError('PATH_OUTSIDE_ROOT', 'Use an approvedRootId:relativePath locator.');
  const local = locator.slice(separator + 1); const path = safePath(root, local); this.acquireDefinition(path);
  const input = JSON.parse(readFileSync(path, 'utf8')) as { formatVersion?: number };
  if (input.formatVersion !== FORMAT_VERSION) throw new StorageError('UNSUPPORTED_FORMAT', 'Unsupported definition version; no overwrite performed.');
  const project = parseProject(input); if (project.id !== id) throw new StorageError('INVALID_INPUT', 'Project identity does not match this locator.');
  const previous = this.db.prepare('SELECT * FROM projects WHERE id=?').get(id) as ProjectRow | undefined;
  if (previous) { if (this.path(previous) !== path) throw new StorageError('REVISION_CONFLICT', 'This identity is registered at another location.'); return this.snapshot(id); }
  this.db.prepare('INSERT INTO projects VALUES(?,?,?,?)').run(id, rootId, local, JSON.stringify(project));
  return project;
 }
 list(root: string) { this.assertReady(); if (!this.roots[root]) throw new StorageError('PATH_OUTSIDE_ROOT', 'Unknown approved root.'); return (this.db.prepare('SELECT id FROM projects WHERE root=? ORDER BY id').all(root) as { id: string }[]).map(row => { const p = this.snapshot(row.id); return { id: p.id, name: p.name, revision: p.revision }; }); }
 lookup(id: string, request: string): { payloadHash: string; outcome: unknown } | undefined { this.assertReady(); const row = this.db.prepare('SELECT payloadHash,outcome FROM operations WHERE project=? AND request=?').get(id, request) as { payloadHash: string; outcome: string } | undefined; return row && { payloadHash: row.payloadHash, outcome: JSON.parse(row.outcome) }; }
 save(project: Project, root: string | undefined, record: StoredRecord, event: unknown) {
  this.assertReady(); project = parseProject(project); const previous = this.db.prepare('SELECT * FROM projects WHERE id=?').get(project.id) as ProjectRow | undefined;
  const row = { id: project.id, root: previous?.root ?? root ?? '', locator: previous?.locator ?? definitionFilename(project.id), snapshot: JSON.stringify(project) }; const path = this.path(row); this.acquireDefinition(path);
  if (previous && project.revision !== JSON.parse(previous.snapshot).revision + 1) throw new StorageError('REVISION_CONFLICT', 'Existing project mutations must advance its current revision.');
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as unknown : null;
  if ((previous && hash(current) !== hash(JSON.parse(previous.snapshot))) || (!previous && current !== null)) throw new StorageError('REVISION_CONFLICT', 'Definition already exists or changed outside this writer.');
  const j: Journal = { ...row, beforeHash: current === null ? null : hash(current), record: JSON.stringify(record), event: JSON.stringify(event) };
  this.db.prepare('INSERT INTO journal VALUES(?,?,?,?,?,?,?)').run(j.id, j.root, j.locator, j.snapshot, j.beforeHash, j.record, j.event);
  try { this.options.fault?.('intent'); this.db.transaction(() => this.installMetadata(j))(); this.options.fault?.('metadata'); replace(path, `${JSON.stringify(project, null, 2)}\n`); this.options.fault?.('replacement'); this.options.fault?.('cleanup'); this.db.prepare('DELETE FROM journal WHERE id=?').run(j.id); }
  catch (error) { this.blocked = true; throw new StorageError('RECOVERY_REQUIRED', 'Save interrupted; restart to reconcile the durable journal.'); }
 }
 export(id: string, rootId: string, locator: string) { const p = this.snapshot(id); const root = this.roots[rootId]; if (!root) throw new StorageError('PATH_OUTSIDE_ROOT', 'Unknown approved root.'); const destination = safePath(root, locator); this.acquireDefinition(destination); if (existsSync(destination)) { const existing = JSON.parse(readFileSync(destination, 'utf8')) as unknown; if (hash(existing) !== hash(p)) throw new StorageError('OUTPUT_CONFLICT', 'Export destination exists with different content.'); } replace(destination, `${JSON.stringify(p, null, 2)}\n`); return { destination: `${rootId}:${locator}`, modelHash: hash(p), includedData: false }; }
 latestSequence(id: string) { this.snapshot(id); return (this.db.prepare('SELECT coalesce(max(sequence),0) AS sequence FROM events WHERE project=?').get(id) as { sequence: number }).sequence; }
 events(id: string, after: number, limit = 100) { this.snapshot(id); if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new StorageError('INVALID_INPUT', 'Invalid replay range.'); return (this.db.prepare('SELECT sequence,body FROM events WHERE project=? AND sequence>? ORDER BY sequence LIMIT ?').all(id, after, limit) as { sequence: number; body: string }[]).map(row => ({ ...JSON.parse(row.body) as object, sequence: row.sequence })); }
 /** Imported JSON cannot attest that a baseline came from our real adapter. Reuse
  * the existing immutable inspect outcomes, scoped to this project and intended
  * bound connection; no separate baseline store or client assertion is trusted. */
 hasInspectedConnection(project: string, connection: Connection): boolean {
  this.snapshot(project);
  if (!connection.inspectedSchema || connection.inspectedForConnectionId !== connection.id) return false;
  const rows = this.db.prepare("SELECT outcome FROM operations WHERE project=? AND json_extract(outcome,'$.ok')=1 AND json_extract(outcome,'$.result.connection.inspectedForConnectionId')=? AND json_extract(outcome,'$.result.connection.fingerprint')=?").all(project, connection.id, connection.fingerprint) as { outcome: string }[];
  const observed = (value: Connection) => ({ inspectedForConnectionId: value.inspectedForConnectionId, locator: value.locator, fingerprint: value.fingerprint, capabilities: value.capabilities, physical: value.physical, inspectedSchema: value.inspectedSchema });
  return rows.some(row => { const outcome = JSON.parse(row.outcome) as { result: { connection: Connection } }; return hash(observed(outcome.result.connection)) === hash(observed(connection)); });
 }
 putPlan(project: string, id: string, body: unknown) { this.snapshot(project); if (this.plan(project, id) !== undefined) throw new StorageError('IDEMPOTENCY_CONFLICT', 'Reviewed plans are immutable; create a new plan ID.'); this.db.prepare('INSERT INTO plans VALUES(?,?,?)').run(project, id, JSON.stringify(body)); }
 plan(project: string, id: string): unknown { this.snapshot(project); const row = this.db.prepare('SELECT body FROM plans WHERE project=? AND id=?').get(project, id) as { body: string } | undefined; return row && JSON.parse(row.body); }
 putJob(project: string, id: string, body: unknown) { const snapshot = this.snapshot(project); this.db.transaction(() => { this.db.prepare('INSERT OR REPLACE INTO jobs VALUES(?,?,?)').run(project, id, JSON.stringify(body)); const sequence = (this.db.prepare('SELECT coalesce(max(sequence),0)+1 AS next FROM events WHERE project=?').get(project) as { next: number }).next; this.db.prepare('INSERT INTO events VALUES(?,?,?)').run(sequence, project, JSON.stringify({ kind: 'job', revision: snapshot.revision, jobId: id, objectIds: [], diagnostics: [] })); })(); }
 job(project: string, id: string): unknown { this.snapshot(project); const row = this.db.prepare('SELECT body FROM jobs WHERE project=? AND id=?').get(project, id) as { body: string } | undefined; return row && JSON.parse(row.body); }
 close() { this.db.close(); for (const lock of this.definitionLeases.values()) lock.close(); for (const lock of this.rootLeases) lock.close(); this.lease.close(); }
}
