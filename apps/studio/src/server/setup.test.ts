import { afterEach, expect, test } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { createId, effectiveAccess } from '@schema-baron/model';
import type { Project, Schema, Table } from '@schema-baron/model';
import { compileProject, emitApplication } from '@schema-baron/generator';
import { startOwner } from './index.js';
import { LocalWorkspace } from './workspace.js';
import type { ApplicationOptions, SetupPreview } from './setup.js';
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const id = (value: string) => createId(() => value);
const column = (name: string, type: 'text' | 'integer' = 'text') => ({ id: id(name), physicalName: name, type: { kind: type }, nullable: false });
function schema(): Schema {
 const warehouses: Table = { id: id('warehouses'), physicalName: 'warehouses', columns: [column('warehouse_id', 'integer'), column('warehouse_name')], primaryKey: [id('warehouse_id')], foreignKeys: [], uniqueConstraints: [], checks: [], indexes: [] };
 const items: Table = { id: id('stock-items'), physicalName: 'stock_items', columns: [column('item_warehouse', 'integer'), column('item_code'), column('description')], primaryKey: [id('item_warehouse'), id('item_code')], foreignKeys: [{ id: id('warehouse-fk'), columnIds: [id('item_warehouse')], referencedTableId: warehouses.id, referencedColumnIds: [id('warehouse_id')], onUpdate: 'restrict', onDelete: 'restrict', deferrable: false }], uniqueConstraints: [], checks: [], indexes: [] };
 return { id: id('inventory-schema'), revision: 1, tables: [warehouses, items], opaqueObjects: [] };
}
function options(s: Schema): ApplicationOptions { return { tables: s.tables.map(t => ({ tableId: t.id, list: true, record: !!t.primaryKey.length, search: true })), login: true, protectWrites: true, menu: true, startTableId: s.tables[0]!.id }; }
async function fixture() {
 const root = mkdtempSync(join(tmpdir(), 'schema-baron-guided-')); cleanup.push(() => rmSync(root, { recursive: true, force: true }));
 const workspace = new LocalWorkspace(join(root, 'private/workspace.json')); workspace.save(join(root, 'projects'));
 const owner = await startOwner({ ownerId: 'setup-owner', capability: 'test-only-setup-capability-'.repeat(3), metadataRoot: join(root, 'metadata'), approvedRoots: {}, localBrowser: true, workspace }); cleanup.push(() => owner.close());
 const response = await fetch(`${owner.url}/api/v1/session`, { method: 'POST', headers: { origin: owner.url, 'sec-fetch-site': 'same-origin', 'x-schema-baron-local': '1', 'content-type': 'application/json' }, body: '{}' });
 const session = await response.json();
 const headers = { origin: owner.url, cookie: response.headers.get('set-cookie')!.split(';')[0]!, 'x-csrf-token': session.result.csrfToken, 'content-type': 'application/json' };
 const call = async (path: string, body: unknown) => (await fetch(`${owner.url}/api/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body) })).json();
 return { root, workspace, owner, call, headers };
}
test('review is read-only; Complete creates unrelated tables, composite keys, relationships, linked pages and login from the reviewed model', async () => {
 const { root, call, owner } = await fixture(); const s = schema();
 const body = { requestId: 'inventory-project', name: 'Inventory', projectsFolder: join(root, 'nested/new/location'), database: { kind: 'new', file: 'inventory.sqlite' }, schema: s, options: options(s) };
 const proposed = await call('setup/preview', body);
 expect(proposed.ok, JSON.stringify(proposed)).toBe(true); const preview = proposed.result as SetupPreview;
 expect(existsSync(join(root, 'nested'))).toBe(false);
 expect(preview.project.pages).toHaveLength(5);
 const complete = await call('setup/complete', { planId: preview.planId });
 expect(complete.ok, JSON.stringify(complete)).toBe(true); const project = complete.result as Project;
 expect(project.pages).toEqual(preview.project.pages); expect(project.actions).toEqual(preview.project.actions);
 expect(project.forms).toEqual(preview.project.forms);
 for (const grid of project.forms.filter(f => f.kind === 'Grid')) {
  const record = project.forms.find(f => f.kind === 'Record' && f.sourceRef?.id === grid.sourceRef?.id)!;
  expect(project.actions.filter(a => a.formId === grid.id && a.destination?.pageId === record.pageId && !a.destination.keyMapping.length)).toHaveLength(1);
 }
 const folder = join(root, 'nested/new/location/Inventory');
 const db = new Database(join(folder, 'inventory.sqlite'));
 expect(db.pragma('table_info(stock_items)')).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'item_warehouse', pk: 1 }), expect.objectContaining({ name: 'item_code', pk: 2 })]));
 expect(db.pragma('foreign_key_list(stock_items)')).toEqual(expect.arrayContaining([expect.objectContaining({ table: 'warehouses', from: 'item_warehouse', to: 'warehouse_id' })])); db.close();
 for (const f of project.forms.filter(f => f.kind === 'Grid')) expect(effectiveAccess(project, f.pageId).access).toBe('public');
 for (const f of project.forms.filter(f => f.kind === 'Record')) expect(effectiveAccess(project, f.pageId).access).toBe('authenticated');
 expect((await call('setup/complete', { planId: preview.planId })).result.id).toBe(project.id);
 const files = emitApplication(compileProject(project), join(folder, 'inventory.sqlite'));
 const grid = files.find(f => f.path === 'components/grid-0.tsx')?.content ?? '';
 expect(grid).toContain('Go to stock_items'); expect(grid).toContain('Add warehouses');
 expect(grid).toContain('NavigationLink');
 expect(readdirSync(folder).filter(name => name.endsWith('.json'))).toHaveLength(1);
 expect(owner.service.core.snapshot('setup-owner', project.id).schema.tables).toHaveLength(2);
});
test('existing SQLite review preserves database bytes and imported keys; completed connection roots survive restart', async () => {
 const { root, call, owner, workspace } = await fixture(); const directory = join(root, 'existing'); mkdirSync(directory);
 const path = join(directory, 'library.sqlite'); const db = new Database(path);
 db.exec("CREATE TABLE publications (publisher TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL, PRIMARY KEY(publisher, code)); INSERT INTO publications VALUES('North','A1','Book');"); db.close();
 const before = readFileSync(path);
 const inspection = await call('setup/inspect', { path }); expect(inspection.ok, JSON.stringify(inspection)).toBe(true);
 const s = inspection.result.schema as Schema;
 expect(s.tables[0]!.primaryKey).toHaveLength(2);
 const proposal = await call('setup/preview', { requestId: 'library-project', name: 'Library', projectsFolder: join(root, 'projects'), database: { kind: 'existing', inspectionId: inspection.result.inspectionId }, schema: s, options: { ...options(s), login: false, protectWrites: false } });
 expect(proposal.ok, JSON.stringify(proposal)).toBe(true); expect(readFileSync(path)).toEqual(before);
 const complete = await call('setup/complete', { planId: proposal.result.planId }); expect(complete.ok, JSON.stringify(complete)).toBe(true);
 expect(readFileSync(path)).toEqual(before);
 expect(complete.result.schema.tables[0].primaryKey).toEqual(s.tables[0]!.primaryKey);
 await owner.close();
 const restored = new LocalWorkspace(join(root, 'private/workspace.json'));
 const reopened = await startOwner({ ownerId: 'setup-owner', capability: 'test-only-setup-capability-'.repeat(3), metadataRoot: join(root, 'metadata'), approvedRoots: restored.roots, workspace: restored }); cleanup.push(() => reopened.close());
 expect(reopened.service.core.snapshot('setup-owner', 'library-project').connections[0]!.locator.approvedRootId).toMatch(/^database-/);
 expect(restored.roots).toEqual(workspace.roots);
});
test('a changed existing database invalidates Complete before creating the project folder', async () => {
 const { root, call } = await fixture(); const directory = join(root, 'external'); mkdirSync(directory); const path = join(directory, 'changed.sqlite');
 const db = new Database(path); db.exec('CREATE TABLE entries (id INTEGER PRIMARY KEY, title TEXT NOT NULL)'); db.close();
 const inspection = await call('setup/inspect', { path }); const s = inspection.result.schema;
 const proposal = await call('setup/preview', { requestId: 'changed-project', name: 'Changed', projectsFolder: join(root, 'projects'), database: { kind: 'existing', inspectionId: inspection.result.inspectionId }, schema: s, options: options(s) });
 expect(proposal.ok, JSON.stringify(proposal)).toBe(true);
 const changed = new Database(path); changed.exec('ALTER TABLE entries ADD COLUMN extra TEXT'); changed.close();
 const result = await call('setup/complete', { planId: proposal.result.planId });
 expect(result.error.code).toBe('DATABASE_CHANGED'); expect(existsSync(join(root, 'projects/Changed'))).toBe(false);
});
test('setup routes require session/CSRF; invalid paths, symlinks and foreign inspection IDs fail without writes', async () => {
 const { root, call, owner, headers } = await fixture();
 expect((await fetch(`${owner.url}/api/v1/setup/inspect`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
 const { 'x-csrf-token': _csrf, ...withoutCsrf } = headers;
 expect((await fetch(`${owner.url}/api/v1/setup/inspect`, { method: 'POST', headers: withoutCsrf, body: '{}' })).status).toBe(403);
 expect((await call('setup/inspect', { path: 'relative.sqlite' })).error.code).toBe('INVALID_INPUT');
 const directory = join(root, 'external'); mkdirSync(directory); const link = join(root, 'alias'); symlinkSync(directory, link);
 expect((await call('setup/inspect', { path: join(link, 'no.sqlite') })).error.code).toBe('PATH_OUTSIDE_ROOT');
 const s = schema(); const invalid = await call('setup/preview', { requestId: 'invalid', name: 'Invalid', projectsFolder: join(root, 'projects'), database: { kind: 'existing', inspectionId: 'another-project' }, schema: s, options: options(s) });
 expect(invalid.error.code).toBe('PLAN_EXPIRED'); expect(readdirSync(join(root, 'projects'))).toHaveLength(0);
});
