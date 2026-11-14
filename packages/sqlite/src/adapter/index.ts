import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { closeSync, existsSync, lstatSync, openSync } from 'node:fs';
import type { SchemaPlanInput, SchemaPlanResult } from '../schema-plans/index.js';
import type { CompiledQuery, QueryCostOptions, QueryPreviewResult } from '../query/index.js';
import type { Inspection } from '../introspection/index.js';
export class SQLiteError extends Error { constructor(readonly code: string) { super(({ NOT_FOUND: 'Selected SQLite file is missing. Reconnect its new location or explicitly create an empty database.', ACCESS_DENIED: 'Selected SQLite file cannot be accessed with the required permissions.', PROJECT_BUSY: 'SQLite is locked. Close the external writer and inspect again.', UNSUPPORTED_FORMAT: 'Selected file is corrupt or is not a supported SQLite database.', CANCELED: 'SQLite worker stopped. Inspect actual database state before retrying a write.', TIMEOUT: 'SQLite work exceeded its time limit. Inspect a smaller database or retry.', OUTPUT_CONFLICT: 'Backup destination already exists. Select an unused file.', VALIDATION_FAILED: 'SQLite could not complete the requested operation.', INVALID_QUERY_GRAIN: 'Join comparison matches multiple rows despite its declared unique grain. Group the child query by its logical key or correct the source encoding and cardinality.', QUERY_COST_EXCEEDED: 'Preview scan budget exceeded. Reduce the source size or use a grouped child query.', TYPE_MISMATCH: 'Exact decimal or result data is invalid, overflows precision, or does not match its declared type.', DATABASE_CHANGED: 'SQLite schema or keys changed. Inspect the connection again.' } as Record<string,string>)[code] ?? 'SQLite worker is unavailable.'); } }
interface RequestOptions { signal?: AbortSignal; timeoutMs?: number }
/** One worker/connection per bounded task. OS termination interrupts native long reads; close waits for process exit. */
export class SQLiteWorker {
 private worker?: ChildProcess; private exited?: Promise<void>; private ready?: Promise<void>; private id = 0; private stopped = false; private stopCode?: string;
 private onParentExit = () => { this.worker?.kill('SIGKILL'); };
 private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: SQLiteError) => void }>();
 constructor(readonly path: string, private options: { readonly?: boolean; busyMs?: number } = {}) {}
 private start() {
  if (this.stopped) return Promise.reject(new SQLiteError('CANCELED'));
  if (this.ready) return this.ready;
  if (!existsSync(this.path)) return Promise.reject(new SQLiteError('NOT_FOUND'));
  if (!lstatSync(this.path).isFile() || !(lstatSync(this.path).mode & 0o444)) return Promise.reject(new SQLiteError('ACCESS_DENIED'));
  const compiled = new URL('../workers/index.js', import.meta.url); const url = existsSync(compiled) ? compiled : new URL('../workers/index.ts', import.meta.url);
  const worker = this.worker = fork(url, [], { env: { ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), SCHEMA_BARON_SQLITE_WORKER: JSON.stringify({ path: this.path, readonly: this.options.readonly ?? true, busyMs: this.options.busyMs ?? 150 }) }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], serialization: 'advanced', execArgv: [] });
  process.once('exit', this.onParentExit);
  this.exited = new Promise<void>(resolve => worker.once('exit', () => { process.removeListener('exit', this.onParentExit); resolve(); }));
  this.ready = new Promise<void>((resolve, reject) => { worker.once('message', (message: { ready: boolean; code?: string }) => message.ready ? resolve() : reject(new SQLiteError(message.code ?? 'VALIDATION_FAILED'))); worker.once('error', () => reject(new SQLiteError('VALIDATION_FAILED'))); worker.once('exit', () => reject(new SQLiteError(this.stopCode ?? 'CANCELED'))); });
  worker.on('message', (message: { id?: number; code?: string; result?: unknown }) => { if (message.id === undefined) return; const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); if (message.code) pending.reject(new SQLiteError(message.code)); else pending.resolve(message.result); });
  worker.on('error', () => this.fail('VALIDATION_FAILED')); worker.on('exit', () => this.fail(this.stopCode ?? 'CANCELED'));
  return this.ready;
 }
 private fail(code: string) { for (const p of this.pending.values()) p.reject(new SQLiteError(code)); this.pending.clear(); }
 private async request<T>(kind: string, input: object = {}, options: RequestOptions = {}): Promise<T> {
  if (options.signal?.aborted) throw new SQLiteError('CANCELED');
  let timer: ReturnType<typeof setTimeout> | undefined; let abort: (() => void) | undefined;
  try {
   return await new Promise<T>((resolve, reject) => {
    const stop = (code: string) => { this.stopCode = code; this.stopped = true; this.worker?.kill('SIGKILL'); if (this.exited) void this.exited.then(() => reject(new SQLiteError(code))); else reject(new SQLiteError(code)); };
    abort = () => stop('CANCELED'); options.signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => stop('TIMEOUT'), Math.max(1, Math.min(options.timeoutMs ?? 5000, 30000)));
    void this.start().then(() => { if (this.stopped) return; const id = ++this.id; this.pending.set(id, { resolve: value => resolve(value as T), reject }); this.worker!.send({ id, kind, ...input }, error => { if (error) this.fail('VALIDATION_FAILED'); }); }, reject);
   });
  } finally { if (timer) clearTimeout(timer); if (abort) options.signal?.removeEventListener('abort', abort); }
 }
 schemaPlan(input: SchemaPlanInput, options?: RequestOptions) { return this.request<SchemaPlanResult>('schema-plan', { input }, options); }
 queryPreview(compiled: CompiledQuery, cost: QueryCostOptions & { expectedFingerprint?: string } = {}, options?: RequestOptions) { return this.request<QueryPreviewResult>('query-preview', { compiled, cost }, options); }
 inspect(options?: RequestOptions) { return this.request<Inspection>('inspect', {}, options); }
 query(sql: string, parameters: unknown[] = [], options?: RequestOptions) { return this.request<unknown[]>('query', { sql, parameters }, options); }
 transaction(statements: { sql: string; parameters: unknown[] }[], options?: RequestOptions) { return this.request<unknown[]>('transaction', { statements }, options); }
 async backup(destination: string, options?: RequestOptions) { try { const fd = openSync(destination, 'wx', 0o600); closeSync(fd); } catch { throw new SQLiteError('OUTPUT_CONFLICT'); } return this.request('backup', { destination }, options); }
 async close() {
  const graceful = !this.stopped && this.pending.size === 0 && this.worker?.connected; this.stopped = true; this.stopCode ??= 'CANCELED';
  if (graceful) this.worker!.send({ id: ++this.id, kind: 'close' }, error => { if (error) this.worker?.kill('SIGKILL'); }); else this.worker?.kill('SIGKILL');
  const timer = setTimeout(() => this.worker?.kill('SIGKILL'), 200);
  try { await this.exited; } finally { clearTimeout(timer); this.fail(this.stopCode); }
 }
}
