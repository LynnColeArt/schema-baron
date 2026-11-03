import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Observers never write business data. Expected money stays in decimal strings.
export function libraryRows(path: string): Record<string, Record<string, unknown>[]> {
 const db = new Database(path, { readonly: true });
 try { return Object.fromEntries(['authors', 'books', 'book_authors', 'copies', 'loans'].map(table => [table, db.prepare(`SELECT * FROM "${table}" ORDER BY ${table === 'book_authors' ? 'book_id, author_id' : 'id'}`).all() as Record<string, unknown>[]])); }
 finally { db.close(); }
}
export function fileHash(path: string): string { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
export const authorCounts = [['1', 'Mara Vale', '2'], ['2', 'Jules Wren', '1'], ['3', 'Unassigned Author', '0']];
export const bookTotals = [['1', 'The Glass Orchard', '19.75'], ['2', 'North Sea', '10.00'], ['3', 'Uncatalogued Stories', '0.00']];
