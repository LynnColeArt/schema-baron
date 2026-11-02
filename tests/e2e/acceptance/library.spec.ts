import { libraryJourney } from './library-journey.js';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { button, label, startIsolatedStudio, connectLocal, wizardNext, selectObject, saveProject, runOutput, freePort } from './helpers.js';
import { fileHash } from './oracles.js';

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
 await libraryJourney(page, browser, info, studio, { onVisitor: (context, surface) => { visitor = context; app = surface; } });
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
