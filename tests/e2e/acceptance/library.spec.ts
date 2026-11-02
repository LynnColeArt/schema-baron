import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import type { Project } from '@schema-baron/model';
import { button, label, startIsolatedStudio, connectLocal, wizardNext, selectObject, saveProject, runOutput, freePort } from './helpers.js';
import { libraryRows, fileHash, authorCounts, bookTotals } from './oracles.js';

test.use({ trace: 'off', actionTimeout: 15000, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ retries: 0 });
test.setTimeout(900000);
let studio: Awaited<ReturnType<typeof startIsolatedStudio>>;
let visitor: BrowserContext | undefined, app: Page | undefined;
test.beforeEach(async () => { studio = await startIsolatedStudio('schema-baron-library-ui-'); });
test.afterEach(async ({ page }, info) => {
 if (info.status !== info.expectedStatus) {
  for (const [name, surface] of [['studio', page], ['visitor', app]] as const) if (surface && !surface.isClosed()) {
   await surface.screenshot({ path: info.outputPath(name + '-failure.png'), fullPage: true, mask: [surface.locator('input[type=password]')] });
   writeFileSync(info.outputPath(name + '-failure.txt'), await surface.locator('body').innerText(), { mode: 0o600 });
  }
 }
 await visitor?.close(); visitor = undefined; app = undefined; await studio?.stop();
});

test('Library schema, ordered identities and exact reports are authored through ordinary controls', async ({ page, browser }, info) => {
 const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
 const fixture = JSON.parse(readFileSync('fixtures/acceptance/library.json', 'utf8')) as { rows: Record<string, Record<string, unknown>[]> };
 writeFileSync(info.outputPath('run-provenance.json'), JSON.stringify({ revision, root: studio.root, ownerPid: studio.child.pid, ownerBirth: readFileSync(`/proc/${studio.child.pid}/stat`, 'utf8').split(') ')[1]?.split(' ')[19], ownerUrl: studio.url, node: process.version, browser: browser.version(), retries: 0, fixtureHash: fileHash('fixtures/acceptance/library.json'), testHash: fileHash('tests/e2e/acceptance/library.spec.ts'), mode: 'UI journey', definitionAndDataWrites: 'visible Studio and generated forms only' }, null, 2), { mode: 0o600 });
 await connectLocal(page, studio);
 const directory = join(studio.projects, 'Library Catalog');
 await button(page, 'New project…').click();
 await label(page, 'Project name').fill('Library Catalog'); await label(page, 'Project location').fill(studio.projects);
 await wizardNext(page); await wizardNext(page);
 const editor = page.getByRole('region', { name: 'Schema editor', exact: true });
 const definitions: [string, [string, string, boolean?][], string[], string?][] = [
  ['authors', [['id', 'integer'], ['name', 'text']], ['id']],
  ['books', [['id', 'integer'], ['catalog_code', 'text'], ['title', 'text'], ['publication_date', 'date', true]], ['id'], 'catalog_code'],
  ['book_authors', [['book_id', 'integer'], ['author_id', 'integer']], ['book_id', 'author_id']],
  ['copies', [['id', 'integer'], ['barcode', 'text'], ['book_id', 'integer'], ['replacement_cost', 'decimal', true], ['note', 'text', true]], ['id'], 'barcode'],
  ['loans', [['id', 'integer'], ['copy_id', 'integer'], ['checked_out', 'date'], ['returned_at', 'date', true]], ['id']],
 ];
 for (const [tableName, columns, keys, unique] of definitions) {
  await button(editor, '＋ Table').click(); await label(editor, 'Table name').fill(tableName); await editor.getByRole('tab', { name: 'Columns', exact: true }).click();
  for (const [name, type, nullable] of columns) {
   await button(editor, '＋ Column').click(); await label(editor, 'Column name').fill(name); await label(editor, 'Logical type').selectOption(type);
   await label(editor, 'Allow NULL').setChecked(!!nullable);
   if (type === 'decimal') { await label(editor, 'Physical encoding').selectOption('text'); await label(editor, 'Decimal precision').fill('12'); await label(editor, 'Decimal scale').fill('2'); }
  }
  await editor.getByRole('tab', { name: 'Keys', exact: true }).click(); for (const key of keys) await label(editor, key).check();
  if (unique) { await editor.getByRole('tab', { name: 'Constraints', exact: true }).click(); await label(editor, unique).check(); await button(editor, 'Add unique constraint').click(); }
 }
 for (const [local, column, parent] of [['book_authors', 'book_id', 'books'], ['book_authors', 'author_id', 'authors'], ['copies', 'book_id', 'books'], ['loans', 'copy_id', 'copies']] as const) {
  await button(editor, '＋ Relationship').click(); const dialog = page.getByRole('dialog', { name: 'Create relationship', exact: true });
  await label(dialog, 'Local table').selectOption({ label: local }); await label(dialog, 'Referenced table').selectOption({ label: parent });
  await label(dialog, 'Local column 1').selectOption({ label: column }); await label(dialog, 'Referenced column 1').selectOption({ label: 'id' });
  await label(dialog, 'On delete').selectOption('restrict'); await button(dialog, 'Add relationship draft').click(); await expect(dialog).toBeHidden();
 }
 await wizardNext(page); await expect(label(page, 'Record book_authors')).toBeChecked(); await wizardNext(page);
 await label(page, 'Enable simple visitor login').check(); await wizardNext(page); await wizardNext(page);
 await expect(page.locator('.application-mermaid svg')).toBeVisible();
 const completion = page.waitForResponse(r => r.url().endsWith('/api/v1/setup/complete')); await button(page, 'Complete').click();
 const result = await (await completion).json(); expect(result.ok, JSON.stringify(result)).toBe(true);
 const projectId = result.result.id as string; let p: Project = await studio.project(projectId);
 const table = (name: string) => p.schema.tables.find(t => t.physicalName === name)!;
 const column = (name: string, field: string) => table(name).columns.find(c => c.physicalName === field)!;
 const form = (name: string, kind: string) => p.forms.find(f => f.sourceRef?.id === table(name).id && f.kind === kind)!;
 const route = (name: string, kind: string) => p.pages.find(page => page.id === form(name, kind).pageId)!.route;
 const database = join(directory, 'application.sqlite'), rows = () => libraryRows(database);
 expect(table('book_authors').primaryKey.map(id => table('book_authors').columns.find(c => c.id === id)!.physicalName)).toEqual(['book_id', 'author_id']);
 expect(column('copies', 'replacement_cost')).toMatchObject({ nullable: true, type: { kind: 'decimal', precision: 12, scale: 2, encoding: 'text' } });
 const db = new Database(database, { readonly: true });
 try {
  expect(db.pragma('table_info(book_authors)')).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'book_id', pk: 1 }), expect.objectContaining({ name: 'author_id', pk: 2 })]));
  for (const [child, field, parent] of [['book_authors', 'book_id', 'books'], ['book_authors', 'author_id', 'authors'], ['copies', 'book_id', 'books'], ['loans', 'copy_id', 'copies']] as const) expect(db.pragma(`foreign_key_list(${child})`)).toEqual(expect.arrayContaining([expect.objectContaining({ table: parent, from: field, to: 'id', on_delete: 'RESTRICT' })]));
 } finally { db.close(); }
 // Named confirmations and lookup labels are ordinary property edits.
 for (const [name, display] of [['authors', 'name'], ['books', 'title'], ['copies', 'barcode']]) {
  await selectObject(page, form(name!, 'Record').id); const box = page.getByRole('group', { name: 'Record name fields for delete confirmation', exact: true }).getByLabel(display!, { exact: true });
  if (!await box.isChecked()) { await box.check(); await saveProject(page); }
 }
 for (const [child, foreign, parent, display] of [['book_authors', 'book_id', 'books', 'title'], ['book_authors', 'author_id', 'authors', 'name'], ['copies', 'book_id', 'books', 'title'], ['loans', 'copy_id', 'copies', 'barcode']] as const) {
  for (const kind of ['Grid', 'Record']) {
   await selectObject(page, p.controls.find(c => c.formId === form(child, kind).id && c.binding?.kind === 'stored' && c.binding.fieldId === column(child, foreign).id)!.id);
   await label(page, 'Lookup relationship').selectOption(table(parent).id); await label(page, 'Lookup label field').selectOption(column(parent, display).id); if (await button(page, '▣ Save').isEnabled()) await saveProject(page);
  }
 }
 await selectObject(page, form('book_authors', 'Record').id); const compositeName = page.getByRole('group', { name: 'Record name fields for delete confirmation', exact: true }); await label(compositeName, 'book_id').check(); await label(compositeName, 'author_id').check(); if (await button(page, '▣ Save').isEnabled()) await saveProject(page);
 const username = 'library-verifier', secret = randomBytes(24).toString('base64url');
 await button(page, 'Login and access…').click(); await label(page, 'Visitor username').fill(username); await label(page, 'Visitor password').fill(secret); await button(page, 'Provision user').click();
 await expect(page.getByText('User provisioned. Credentials were cleared.', { exact: true })).toBeVisible(); await button(page, 'Close').click();
 const reports: Record<string, string> = {};
 async function authorReport(kind: 'counts' | 'totals') {
  const totals = kind === 'totals', parent = totals ? 'books' : 'authors', child = totals ? 'copies' : 'book_authors', foreign = totals ? 'book_id' : 'author_id', title = totals ? 'title' : 'name', aggregate = totals ? 'sum' : 'count';
  await button(page, 'Queries').click(); await button(page, 'New query').click(); await label(page, 'Query name').fill(totals ? 'Book copy totals' : 'Author distinct books');
  const section = async (name: string) => button(page.getByRole('navigation', { name: 'Query sections', exact: true }), name).click();
  const expression = async (name: string, value: string) => label(page, name + ' kind').selectOption(value);
  const field = async (name: string, value: string) => { await expression(name, 'field'); await label(page, name + ' field').selectOption({ label: value }); };
  for (const [index, source, alias] of [[1, parent, 'p'], [2, child, 'c']] as const) { await label(page, 'Add source').selectOption({ label: 'table: ' + source }); await label(page, `Source ${index} alias`).fill(alias); }
  await button(page, 'Add join').click(); await label(page, 'Join 1 leftAlias').selectOption('p'); await label(page, 'Join 1 rightAlias').selectOption('c'); await label(page, 'Join 1 kind').selectOption('left'); await label(page, 'Join 1 cardinality').selectOption('one-to-many');
  await expression('Join 1 condition', 'binary'); await field('Join 1 condition left', 'p.id'); await field('Join 1 condition right', 'c.' + foreign);
  await section('Fields'); await label(page, 'Aggregate grain').selectOption('grouped');
  for (const [index, name] of [[1, 'id'], [2, title]] as const) { await button(page, 'Add projection').click(); await label(page, `Projection ${index} name`).fill(name); await field(`Projection ${index}`, 'p.' + name); await button(page, `Group by projection ${index}`).click(); await page.getByRole('checkbox', { name, exact: true }).check(); }
  const aggregateExpression = async (name: string) => { await expression(name, 'aggregate'); await label(page, name + ' aggregate').selectOption(aggregate); await field(name + ' argument', 'c.' + (totals ? 'replacement_cost' : 'book_id')); await label(page, name + ' zero children').selectOption('zero'); if (!totals) await page.getByLabel('Distinct', { exact: true }).check(); };
  await button(page, 'Add projection').click(); await label(page, 'Projection 3 name').fill(totals ? 'total' : 'book_count'); await aggregateExpression('Projection 3');
  if (totals) {
   await section('Parameters'); await button(page, 'Add parameter').click(); await label(page, 'Parameter 1 name').fill('minimum_total'); await label(page, 'Parameter 1 type').selectOption('decimal'); await label(page, 'Parameter 1 type precision').fill('12'); await label(page, 'Parameter 1 type scale').fill('2'); await label(page, 'Has default').check(); await label(page, 'Parameter 1 default').fill('0.00');
   await section('Fields'); await button(page, 'Add having').click(); await expression('HAVING', 'binary'); await label(page, 'HAVING operator').selectOption('>='); await aggregateExpression('HAVING left'); await expression('HAVING right', 'parameter'); await label(page, 'HAVING right parameter').selectOption({ label: 'minimum_total' });
  }
  await button(page, 'Run preview').click(); await expect(page.getByRole('status').filter({ hasText: 'Preview complete' })).toBeVisible(); await button(page, 'Save query').click(); await expect(page.getByRole('status').filter({ hasText: 'Query saved' })).toBeVisible(); await button(page, 'Return to page').click();
  p = await studio.project(projectId); const query = p.queries.find(q => q.name === (totals ? 'Book copy totals' : 'Author distinct books'))!;
  await button(page, '＋ Page').click(); await label(page, 'Page title').fill(totals ? 'Copy value report' : 'Author book report'); await label(page, 'Internal route').fill('/' + kind); await button(page, 'Add page').click(); await saveProject(page);
  await button(page, '＋ Form').click(); await label(page, 'Form label').fill(kind); await label(page, 'Form kind').selectOption('Grid'); await label(page.getByRole('dialog'), 'Data source').selectOption('query:' + query.id); await button(page, 'Next').click();
  for (const box of await page.getByRole('group', { name: 'Fields, in selection order', exact: true }).getByRole('checkbox').all()) await box.check();
  for (let index = 0; index < 3; index++) await button(page, 'Next').click(); await button(page, 'Finish').click(); await expect(page.getByRole('dialog')).toBeHidden();
  p = await studio.project(projectId); const report = p.forms.find(f => f.sourceRef?.id === query.id)!; reports[kind] = report.id;
  if (totals) { await selectObject(page, report.id); await label(page, 'Input source minimum_total').selectOption('runtime'); await label(page, 'Runtime name minimum_total').fill('minimum_total'); await saveProject(page); }
 }
 await authorReport('counts'); await authorReport('totals');
 await button(page, 'Generate…').click(); await button(page, 'Preview files').click(); await button(page, 'Create application').click(); await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created.'); await button(page, 'Close').click();
 await runOutput(join(directory, 'generated', 'app'), ['ci', '--ignore-scripts', '--offline'], info.outputPath('output-install.log'));
 if (await button(page, 'Flow map').getAttribute('aria-pressed') === 'true') await button(page, 'Flow map').click();
 await button(page, 'Build generated output').click(); await expect(button(page, 'Start / retry')).toBeEnabled({ timeout: 120000 }); const port = await freePort(); await label(page, 'Runtime port').fill(String(port)); await button(page, 'Start / retry').click();
 await expect(page.getByRole('region', { name: 'Managed generated runtime' }).locator('strong').first()).toHaveText('Generated runtime · running', { timeout: 30000 });
 const origin = 'http://127.0.0.1:' + port; visitor = await browser.newContext(); app = await visitor.newPage(); const ui = app;
 await ui.goto(origin + route('authors', 'Grid')); await ui.getByRole('link', { name: 'Add authors', exact: true }).click(); await label(ui, 'Username').fill(username); await label(ui, 'Password').fill(secret); await button(ui, 'login').click(); await expect(label(ui, 'id')).toBeVisible();
 async function fill(fields: Record<string, unknown>) {
  for (const [name, value] of Object.entries(fields)) { if (value === null) continue; const control = label(ui, name); if (await control.evaluate(el => el.tagName === 'SELECT')) await control.selectOption(String(value)); else await control.fill(String(value)); }
 }
 async function saved() { await button(ui, 'Save').click(); await expect(ui.getByText('Record saved.', { exact: false })).toBeVisible(); }
 async function newRecord(tableName: string) { await ui.goto(origin + route(tableName, 'Grid')); await ui.getByRole('link', { name: 'Add ' + tableName, exact: true }).click(); }
 async function add(tableName: string, fields: Record<string, unknown>) { await newRecord(tableName); await fill(fields); await saved(); }
 for (const name of ['authors', 'books', 'book_authors', 'copies', 'loans']) for (const record of fixture.rows[name]!) await add(name, record);
 expect(rows()).toEqual(fixture.rows);
 async function report(kind: string, minimum?: string) {
  await ui.goto(origin + '/' + kind);
  if (minimum !== undefined) { await label(ui, 'minimum_total').fill(minimum); await ui.getByRole('combobox', { name: 'Input mode', exact: true }).selectOption('value'); await button(ui, 'Apply parameters').click(); await expect(ui).toHaveURL(url => url.searchParams.get(reports[kind] + ':parameter:minimum_total') === minimum); }
  const result: string[][] = []; for (const row of await ui.locator('tbody tr').all()) { const cells = await row.getByRole('cell').allTextContents(); if (cells.length === 3) result.push(cells.map(c => c.trim())); } return result;
 }
 expect(await report('counts')).toEqual(authorCounts); expect(await report('totals', '0')).toEqual(bookTotals); expect(await report('totals', '15')).toEqual([bookTotals[0]]);
 await ui.screenshot({ path: info.outputPath('library-totals.png'), fullPage: true });
 async function editRow(tableName: string, identity: string[]) {
  await ui.goto(origin + route(tableName, 'Grid')); let row = ui.getByRole('row'); for (const value of identity) row = row.filter({ has: ui.getByRole('cell', { name: value, exact: true }) }); await row.getByRole('link', { name: 'Edit record', exact: true }).click();
 }
 const before = rows();
 // Every old key component must select the tuple, and changing a component must preserve its neighbour.
 await editRow('book_authors', ['The Glass Orchard', 'Jules Wren']); await fill({ book_id: 3 }); await saved();
 expect(rows().book_authors).toEqual([{ book_id: 1, author_id: 1 }, { book_id: 2, author_id: 1 }, { book_id: 3, author_id: 2 }]);
 await editRow('book_authors', ['Uncatalogued Stories', 'Jules Wren']); await fill({ book_id: 1, author_id: 1 }); await button(ui, 'Save').click(); await expect(ui.getByRole('alert').filter({ hasText: 'A record with these unique values already exists.' })).toBeVisible(); expect(rows().book_authors).toEqual([{ book_id: 1, author_id: 1 }, { book_id: 2, author_id: 1 }, { book_id: 3, author_id: 2 }]);
 await button(ui, 'Cancel').click(); await editRow('book_authors', ['Uncatalogued Stories', 'Jules Wren']); await fill({ book_id: 1 }); await saved(); expect(rows()).toEqual(before);
 for (const [name, record] of [['book_authors', { book_id: 1, author_id: 1 }], ['books', { id: 4, catalog_code: 'CAT-001', title: 'Duplicate trial' }], ['copies', { id: 4, barcode: 'COPY-001', book_id: 2, replacement_cost: '6.25' }]] as const) {
  await newRecord(name); await fill(record); await button(ui, 'Save').click(); await expect(ui.getByRole('alert').filter({ hasText: 'A record with these unique values already exists.' })).toBeVisible(); expect(rows()).toEqual(before); await button(ui, 'Cancel').click();
 }
 await newRecord('copies'); await fill({ id: 4, barcode: 'INVALID-AMOUNT', book_id: 2, replacement_cost: '6.251' }); await button(ui, 'Save').click(); await expect(ui.getByRole('alert').filter({ hasText: 'Amount exceeds configured precision or scale.' })).toBeVisible(); expect(rows()).toEqual(before); await button(ui, 'Cancel').click();
 await newRecord('loans'); await fill({ id: 3, copy_id: 3 }); await button(ui, 'Save').click(); await expect(ui.getByRole('alert').filter({ hasText: 'Enter a value.' })).toBeVisible(); expect(rows()).toEqual(before); await button(ui, 'Cancel').click();
 await editRow('books', ['North Sea']); await fill({ publication_date: '2026-01-01', title: 'Canceled revision' }); await button(ui, 'Cancel').click(); expect(rows()).toEqual(before);
 for (const [name, identity, confirmation] of [['copies', ['COPY-001'], 'COPY-001'], ['books', ['The Glass Orchard'], 'CAT-001 · The Glass Orchard']] as const) {
  await editRow(name, [...identity]); await label(ui, 'Confirm deletion of ' + confirmation).check(); await button(ui, 'Delete').click(); await expect(ui.getByRole('alert').filter({ hasText: 'Related records prevent deletion.' })).toBeVisible(); expect(rows()).toEqual(before); await button(ui, 'Cancel').click();
 }
 await add('copies', { id: 4, barcode: 'COPY-004', book_id: 2, replacement_cost: '6.25' }); expect(await report('totals', '15')).toEqual([bookTotals[0], ['2', 'North Sea', '16.25']]);
 await editRow('copies', ['COPY-004']); await fill({ replacement_cost: '10.00' }); await saved(); expect(await report('totals', '15')).toEqual([bookTotals[0], ['2', 'North Sea', '20.00']]);
 await editRow('copies', ['COPY-004']); await label(ui, 'Confirm deletion of COPY-004').check(); await button(ui, 'Delete').click(); await expect(ui).toHaveURL(origin + route('copies', 'Grid')); expect(await report('totals', '15')).toEqual([bookTotals[0]]); expect(rows()).toEqual(before);
 await add('copies', { id: 5, barcode: 'COPY-005', book_id: 3 }); expect(await report('totals', '0')).toEqual(bookTotals); await editRow('copies', ['COPY-005']); await label(ui, 'Confirm deletion of COPY-005').check(); await button(ui, 'Delete').click(); await expect(ui).toHaveURL(origin + route('copies', 'Grid')); expect(rows()).toEqual(before);
 // A supported SQLite backup is a declared existing-database input, never a cold-UI seed.
 const supplied = join(studio.root, 'supplied-library.sqlite'), source = new Database(database, { readonly: true }); try { await source.backup(supplied); } finally { source.close(); }
 const suppliedHash = fileHash(supplied), suppliedRows = libraryRows(supplied);
 await button(page, 'New project…').click(); await label(page, 'Project name').fill('Inspected Library'); await label(page, 'Project location').fill(studio.projects); await wizardNext(page); await page.getByLabel('Use an existing SQLite database', { exact: false }).check(); await label(page, 'SQLite database path').fill(supplied); await button(page.getByRole('dialog'), 'Read database and continue').click();
 await expect(page.getByRole('heading', { name: 'Review existing database', exact: true })).toBeVisible(); await expect(page.getByRole('dialog').getByRole('row')).toHaveCount(6); await button(page.getByRole('dialog'), 'Cancel').click(); expect(fileHash(supplied)).toBe(suppliedHash); expect(libraryRows(supplied)).toEqual(suppliedRows); expect(rows()).toEqual(before);
 await add('authors', { id: 4, name: 'Mara Vale' }); expect(await report('counts')).toEqual([...authorCounts, ['4', 'Mara Vale', '0']]);
 await newRecord('book_authors'); const duplicateChoices = label(ui, 'author_id'); const firstAuthor = duplicateChoices.locator('option[value="1"]'), fourthAuthor = duplicateChoices.locator('option[value="4"]');
 expect(await firstAuthor.innerText(), 'Duplicate author names need distinguishable visible choices').not.toBe(await fourthAuthor.innerText()); await duplicateChoices.selectOption('4'); await expect(duplicateChoices).toHaveValue('4'); await fill({ book_id: 3 }); await saved();
 expect(rows().book_authors).toEqual([...before.book_authors!, { book_id: 3, author_id: 4 }]); expect(rows().authors!.find(row => row.id === 1)).toEqual({ id: 1, name: 'Mara Vale' }); expect(await report('counts')).toEqual([...authorCounts, ['4', 'Mara Vale', '1']]);
 await editRow('book_authors', ['Uncatalogued Stories', 'Mara Vale']); await label(ui, 'Confirm deletion of 3 · 4').check(); await button(ui, 'Delete').click(); await expect(ui).toHaveURL(origin + route('book_authors', 'Grid')); expect(rows().book_authors).toEqual(before.book_authors);
 await editRow('authors', ['4', 'Mara Vale']); await label(ui, 'Confirm deletion of Mara Vale').check(); await button(ui, 'Delete').click(); await expect(ui).toHaveURL(origin + route('authors', 'Grid')); expect(rows()).toEqual(before);
 writeFileSync(info.outputPath('public-summary.json'), JSON.stringify({ revision, fixtureHash: fileHash('fixtures/acceptance/library.json'), testHash: fileHash('tests/e2e/acceptance/library.spec.ts'), oracleHash: fileHash('tests/e2e/acceptance/oracles.ts'), scope: 'WP03 Library UI only; supplied-DB variant separately recorded; final mission acceptance pending', reports: { authorCounts, bookTotals, mutationTotals: ['16.25', '20.00', '10.00'] }, existingDatabase: { hashBefore: suppliedHash, hashAfter: fileHash(supplied) }, businessRows: rows(), retries: 0 }, null, 2), { mode: 0o600 });
});

test('declared raw existing-db variant preserves quoted identifiers and truthful 200/201 lookups', async ({ page, browser }, info) => {
 // Explicit supplied raw-DB preparation is separate from the cold UI-authored Library proof.
 const suppliedRoot = join(studio.root, 'supplied raw input'); mkdirSync(suppliedRoot); const input = join(suppliedRoot, 'quoted-lookup-variant.sqlite');
 const seed = new Database(input);
 try {
  seed.exec('CREATE TABLE "shelf ""labels""" (id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE "book ""notes""" (id INTEGER PRIMARY KEY, shelf_id INTEGER NOT NULL REFERENCES "shelf ""labels"""(id) ON DELETE RESTRICT, "copy title" TEXT NOT NULL);');
  const insert = seed.prepare('INSERT INTO "shelf ""labels"""(id,name) VALUES (?,?)');
  seed.transaction(() => { for (let id = 1; id <= 200; id++) insert.run(id, id <= 2 ? 'Same label' : `Shelf ${id}`); })();
 } finally { seed.close(); }
 const variantRows = () => { const db = new Database(input, { readonly: true }); try { return { parents: db.prepare('SELECT * FROM "shelf ""labels""" ORDER BY id').all(), children: db.prepare('SELECT * FROM "book ""notes""" ORDER BY id').all() }; } finally { db.close(); } };
 const inputHash = fileHash(input);
 writeFileSync(info.outputPath('variant-provenance.json'), JSON.stringify({ mode: 'supplied raw existing-db variant', inputHash, preparation: 'Two quoted-identifier tables; 200 keyed parents, first two share a display label; no prepared Studio model', revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), retries: 0 }, null, 2));
 await connectLocal(page, studio);
 await button(page, 'New project…').click(); await label(page, 'Project name').fill('Quoted Lookup Variant'); await label(page, 'Project location').fill(studio.projects); await wizardNext(page); await page.getByLabel('Use an existing SQLite database', { exact: false }).check(); await label(page, 'SQLite database path').fill(input); await button(page.getByRole('dialog'), 'Read database and continue').click();
 await expect(page.getByRole('heading', { name: 'Review existing database', exact: true })).toBeVisible(); expect(fileHash(input)).toBe(inputHash);
 await wizardNext(page); await wizardNext(page); await wizardNext(page); await wizardNext(page);
 const complete = page.waitForResponse(r => r.url().endsWith('/api/v1/setup/complete')); await button(page, 'Complete').click(); const result = await (await complete).json(); expect(result.ok, JSON.stringify(result)).toBe(true);
 const p = await studio.project(result.result.id as string);
 const route = (name: string, kind: string) => { const table = p.schema.tables.find(t => t.physicalName === name)!; const form = p.forms.find(f => f.kind === kind && f.sourceRef?.id === table.id)!; return p.pages.find(page => page.id === form.pageId)!.route; };
 expect(p.schema.tables.map(t => t.physicalName).sort()).toEqual(['book "notes"', 'shelf "labels"']);
 const parent = 'shelf "labels"', child = 'book "notes"';
 const parentTable = p.schema.tables.find(t => t.physicalName === parent)!, childTable = p.schema.tables.find(t => t.physicalName === child)!, record = p.forms.find(f => f.kind === 'Record' && f.sourceRef?.id === childTable.id)!;
 await selectObject(page, p.controls.find(c => c.formId === record.id && c.binding?.kind === 'stored' && c.binding.fieldId === childTable.columns.find(column => column.physicalName === 'shelf_id')!.id)!.id);
 await label(page, 'Lookup relationship').selectOption(parentTable.id); await label(page, 'Lookup label field').selectOption(parentTable.columns.find(column => column.physicalName === 'name')!.id); if (await button(page, '▣ Save').isEnabled()) await saveProject(page);

 await button(page, 'Generate…').click(); await button(page, 'Preview files').click(); await button(page, 'Create application').click(); await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created.'); await button(page, 'Close').click();
 await runOutput(join(studio.projects, 'Quoted Lookup Variant', 'generated', 'app'), ['ci', '--ignore-scripts', '--offline'], info.outputPath('output-install.log'));
 if (await button(page, 'Flow map').getAttribute('aria-pressed') === 'true') await button(page, 'Flow map').click();
 await button(page, 'Build generated output').click(); await expect(button(page, 'Start / retry')).toBeEnabled({ timeout: 120000 }); const port = await freePort(); await label(page, 'Runtime port').fill(String(port)); await button(page, 'Start / retry').click(); await expect(page.getByRole('region', { name: 'Managed generated runtime' }).locator('strong').first()).toHaveText('Generated runtime · running', { timeout: 30000 });
 visitor = await browser.newContext(); app = await visitor.newPage(); const ui = app, origin = 'http://127.0.0.1:' + port;
 await ui.goto(origin + route(child, 'Grid')); await ui.getByRole('link', { name: 'Add ' + child, exact: true }).click(); const choice = label(ui, 'shelf_id'); await expect(choice).toBeVisible(); await expect(choice.getByRole('option')).toHaveCount(201);
 const names = await choice.getByRole('option').allTextContents();
 writeFileSync(info.outputPath('lookup-200-labels.json'), JSON.stringify({ optionCount: names.length - 1, firstNames: names.slice(1, 3), values: await choice.getByRole('option').evaluateAll(options => options.slice(1, 3).map(option => (option as HTMLOptionElement).value)) }, null, 2));
 writeFileSync(info.outputPath('duplicate-label-observation.json'), JSON.stringify({ expected: 'Distinct human-readable labels for keys1/2', actual: names.slice(1, 3), passed: names[1] !== names[2] }, null, 2));
 await label(ui, 'id').fill('1'); await choice.selectOption('2'); await label(ui, 'copy title').fill('Quoted identifier round trip'); await button(ui, 'Save').click(); await expect(ui.getByText('Record saved.', { exact: false })).toBeVisible();
 const read = new Database(input, { readonly: true }); try { expect(read.prepare('SELECT * FROM "book ""notes"""').all()).toEqual([{ id: 1, shelf_id: 2, 'copy title': 'Quoted identifier round trip' }]); } finally { read.close(); }
 await ui.goto(origin + route(parent, 'Grid')); await ui.getByRole('link', { name: 'Add ' + parent, exact: true }).click(); await label(ui, 'id').fill('201'); await label(ui, 'name').fill('Boundary exceeded'); await button(ui, 'Save').click(); await expect(ui.getByText('Record saved.', { exact: false })).toBeVisible(); const beforeExceeded = variantRows();
 await ui.goto(origin + route(child, 'Grid')); await ui.getByRole('link', { name: 'Add ' + child, exact: true }).click(); writeFileSync(info.outputPath('lookup-exceeded-observation.json'), JSON.stringify({ expected: 'Useful lookup200 bound diagnostic', actual: await ui.getByRole('main').getByRole('alert').innerText() }, null, 2)); await expect(ui.getByRole('main').getByRole('alert')).toContainText('200'); await expect(ui.getByRole('main').getByRole('alert')).toContainText(/lookup/i); await expect(label(ui, 'shelf_id')).toHaveCount(0); expect(variantRows()).toEqual(beforeExceeded);
 expect(names[1], 'Duplicate display names need distinguishable labels while retaining stable keys').not.toBe(names[2]);
 writeFileSync(info.outputPath('public-variant-summary.json'), JSON.stringify({ inputHash, supportedOptions: 200, exceededOptions: 201, firstNames: names.slice(1, 3), quotedIdentifiers: ['shelf "labels"', 'book "notes"', 'copy title'], expectedStoredParent: 2, exceededDiagnostic: await ui.getByRole('main').getByRole('alert').innerText(), mode: 'supplied raw existing-db variant' }, null, 2));
});
