import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
export interface SchemaObject { type: string; name: string; tbl_name: string; rootpage: number; sql: string | null }
export interface PhysicalColumn { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number; hidden: number }
export interface PhysicalForeignKey { id: number; seq: number; table: string; from: string; to: string | null; on_update: string; on_delete: string; match: string }
export interface PhysicalIndex { name: string; unique: number; origin: string; partial: number; sql: string | null; columns: { seqno: number; cid: number; name: string | null; desc: number; coll: string; key: number }[] }
export interface PhysicalTable { name: string; columns: PhysicalColumn[]; foreignKeys: PhysicalForeignKey[]; indexes: PhysicalIndex[] }
export interface Inspection { sqliteVersion: string; encoding: string; foreignKeys: boolean; objects: SchemaObject[]; tables: PhysicalTable[]; fingerprint: string }
/** Values are bound; SQLite identifiers are quoted, including embedded double quotes. */
export const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
export function inspectDatabase(db: Database.Database): Inspection {
 const objects = db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all() as SchemaObject[];
 const tables = objects.filter(o => o.type === 'table' && !o.name.startsWith('sqlite_')).map(o => ({ name: o.name,
  columns: db.prepare('SELECT * FROM pragma_table_xinfo(?) ORDER BY cid').all(o.name) as PhysicalColumn[],
  foreignKeys: db.prepare('SELECT * FROM pragma_foreign_key_list(?) ORDER BY id,seq').all(o.name) as PhysicalForeignKey[],
  indexes: (db.prepare('SELECT * FROM pragma_index_list(?) ORDER BY name').all(o.name) as { name: string; unique: number; origin: string; partial: number }[]).map(i => ({ name: i.name, unique: i.unique, origin: i.origin, partial: i.partial, sql: objects.find(o => o.name === i.name)?.sql ?? null, columns: db.prepare('SELECT * FROM pragma_index_xinfo(?) ORDER BY seqno').all(i.name) as PhysicalIndex['columns'] })),
 }));
 const sqliteVersion = String(db.prepare('SELECT sqlite_version()').pluck().get());
 const encoding = String(db.pragma('encoding', { simple: true }));
 // Root pages are allocator details; original SQL and all physical PRAGMA metadata are retained.
 const fingerprint = createHash('sha256').update(JSON.stringify({ encoding, objects: objects.map(({ rootpage: _, ...o }) => o), tables })).digest('hex');
 return { sqliteVersion, encoding, foreignKeys: db.pragma('foreign_keys', { simple: true }) === 1, objects, tables, fingerprint };
}
