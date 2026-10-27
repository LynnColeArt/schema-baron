import Database from 'better-sqlite3';

import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
// Native Node type stripping is used only when running the source test tree.
const moduleUrl = new URL('../introspection/index.js', import.meta.url);
const { inspectDatabase } = await import(existsSync(moduleUrl) ? moduleUrl.href : pathToFileURL(new URL('../introspection/index.ts', import.meta.url).pathname).href) as typeof import('../introspection/index.js');
const plannerUrl = new URL('../schema-plans/index.js', import.meta.url);
const { planSchema } = await import(existsSync(plannerUrl) ? plannerUrl.href : new URL('../schema-plans/index.ts', import.meta.url).href) as typeof import('../schema-plans/index.js');
const options = JSON.parse(process.env.SCHEMA_BARON_SQLITE_WORKER ?? '{}') as { path: string; readonly: boolean; busyMs: number };
let db: Database.Database;
try { db = new Database(options.path, { readonly: options.readonly, fileMustExist: true, timeout: options.busyMs }); db.pragma('foreign_keys = ON'); db.pragma('trusted_schema = OFF'); if (options.readonly) db.pragma('query_only = ON'); }
catch (error) { process.send!({ ready: false, code: classify(error) }); throw new Error('SQLite worker could not open the selected database.'); }
function classify(error: unknown) { const code = (error as { code?: string }).code ?? ''; if (code.includes('BUSY') || code.includes('LOCKED')) return 'PROJECT_BUSY'; if (code.includes('CANTOPEN') || code === 'ENOENT') return 'NOT_FOUND'; if (code.includes('READONLY') || code === 'EACCES' || code === 'EPERM') return 'ACCESS_DENIED'; if (code.includes('CORRUPT') || code.includes('NOTADB')) return 'UNSUPPORTED_FORMAT'; return 'VALIDATION_FAILED'; }
process.send!({ ready: true });
process.on('message', async (request: { id: number; kind: string; sql?: string; parameters?: unknown[]; statements?: { sql: string; parameters: unknown[] }[]; destination?: string; input?: import('../schema-plans/index.js').SchemaPlanInput }) => {
 try {
  let result: unknown;
  if (request.kind === 'schema-plan') result = planSchema(db, request.input!);
  else if (request.kind === 'inspect') result = db.transaction(() => inspectDatabase(db))();
  else if (request.kind === 'query') result = db.prepare(request.sql!).all(...request.parameters!);
  else if (request.kind === 'transaction') result = db.transaction(() => request.statements!.map(s => db.prepare(s.sql).run(...s.parameters)))();
  else if (request.kind === 'backup') { await db.backup(request.destination!); result = { backedUp: true }; }
  else if (request.kind === 'close') { db.close(); process.send!({ id: request.id, result: null }); process.disconnect(); return; }
  else throw new Error('Unknown worker operation');
  process.send!({ id: request.id, result });
 } catch (error) { process.send!({ id: request.id, code: classify(error) }); }
});

process.on('disconnect', () => { if (db.open) db.close(); process.exit(0); });
