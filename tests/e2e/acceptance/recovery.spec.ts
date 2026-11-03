import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createServer } from 'node:http';
import { libraryJourney } from './library-journey.js';
import { button, label, startIsolatedStudio, wizardNext, schemaTable } from './helpers.js';
import { libraryRows, fileHash } from './oracles.js';

test.use({ trace: 'off', actionTimeout: 15000, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ retries: 0 });
test.setTimeout(900000);
let studio: Awaited<ReturnType<typeof startIsolatedStudio>>, visitor: BrowserContext | undefined;
test.beforeEach(async () => { studio = await startIsolatedStudio('schema-baron-recovery-ui-'); });
test.afterEach(async ({ page }, info) => {
 if (info.status !== info.expectedStatus) {
  await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true });
  writeFileSync(info.outputPath('visible-failure.txt'), await page.locator('body').innerText(), { mode: 0o600 });
 }
 await visitor?.close(); visitor = undefined; await studio?.stop();
});

test('Library nullable migration, destructive Cancel and explicit declaration restoration preserve exact tuples and another UI project', async ({ page, browser }, info) => {
 await libraryJourney(page, browser, info, studio, {
  onVisitor: context => { visitor = context; },
  populated: async fixture => {
   const before = libraryRows(fixture.database);
   await button(page, 'Stop runtime').click();
   const runtime = page.getByRole('region', { name: 'Managed generated runtime' }).locator('strong').first();
   await expect(runtime).toHaveText('Generated runtime · stopped');
   // An owned occupied-port sentinel is never mistaken for the generated application.
   const sentinel = createServer((_request, response) => response.end('owned occupied-port witness'));
   await new Promise<void>(done => sentinel.listen(0, '127.0.0.1', done));
   const address = sentinel.address(); if (!address || typeof address === 'string') throw Error('No sentinel port');
   try {
    await label(page, 'Runtime port').fill(String(address.port));
    const refused = page.waitForResponse(r => r.url().includes('/commands') && r.request().postDataJSON()?.operation === 'runtime.start');
    await button(page, 'Start / retry').click(); expect(await (await refused).json()).toMatchObject({ ok: false, error: { code: 'PROJECT_BUSY' } });
    await expect(runtime).not.toHaveText('Generated runtime · running');
    expect(await (await fetch('http://127.0.0.1:' + address.port)).text()).toBe('owned occupied-port witness');
   } finally { await new Promise<void>((done, fail) => sentinel.close(error => error ? fail(error) : done())); }
   await label(page, 'Runtime port').fill(new URL(fixture.origin).port);
   // The isolation witness is independently authored through the normal wizard.
   await button(page, 'New project…').click(); await label(page, 'Project name').fill('Unrelated Recovery Witness'); await label(page, 'Project location').fill(studio.projects);
   await wizardNext(page); await wizardNext(page);
   await schemaTable(page.getByRole('region', { name: 'Schema editor', exact: true }), 'witness', [['id', 'integer'], ['name', 'text']]);
   for (let i = 0; i < 4; i++) await wizardNext(page);
   const completed = page.waitForResponse(r => r.url().endsWith('/api/v1/setup/complete')); await button(page, 'Complete').click();
   const result = await (await completed).json(); expect(result.ok).toBe(true);
   const witness = await studio.project(result.result.id), witnessDb = join(studio.projects, 'Unrelated Recovery Witness', 'application.sqlite'), witnessHash = fileHash(witnessDb);
   await button(page, 'Open / Switch…').click(); await page.getByRole('dialog').getByRole('button', { name: /^Library Catalog\s*r/ }).click(); await expect(page.getByRole('dialog')).toBeHidden();
   await button(page, 'Schema').click();
   const editor = page.getByRole('region', { name: 'Schema editor', exact: true });
   await editor.locator('.schema-table-list').getByRole('button', { name: 'books', exact: false }).click(); await editor.getByRole('tab', { name: 'Columns', exact: true }).click();
   const save = async () => { await button(editor, 'Save schema').click(); await expect(page.locator('.schema-messages p[role=status]')).toContainText('Schema definition saved'); };
   const addSubtitle = async () => { await button(editor, '＋ Column').click(); await label(editor, 'Column name').fill('subtitle'); await label(editor, 'Logical type').selectOption('text'); await label(editor, 'Allow NULL').check(); await save(); };
   const apply = async () => { await button(page, 'Review migration…').click(); await expect(page.getByRole('dialog', { name: 'Review migration', exact: true })).toBeVisible(); await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeVisible(); for (const box of await page.getByRole('dialog').getByRole('checkbox').all()) await box.check(); await button(page, 'Apply reviewed migration').click(); await expect(page.locator('.schema-messages p[role=status]')).toContainText('Migration committed'); };
   await addSubtitle(); await button(page, 'Review migration…').click(); await expect(page.getByRole('dialog')).toContainText('subtitle'); await page.screenshot({ path: info.outputPath('library-migration-review.png'), fullPage: true }); await button(page, 'Apply reviewed migration').click(); await expect(page.locator('.schema-messages p[role=status]')).toContainText('Migration committed');
   const expected = { ...before, books: before.books!.map(row => ({ ...row, subtitle: null })) }; expect(fixture.rows()).toEqual(expected);
   const committed = await studio.project(fixture.project.id);
   await editor.locator('.schema-table-list').getByRole('button', { name: 'books', exact: false }).click(); await editor.locator('.schema-column-list').getByRole('button', { name: 'subtitle · text', exact: true }).click(); await button(editor, 'Delete column').click(); await save();
   await button(page, 'Review migration…').click(); await expect(page.getByRole('dialog')).toContainText(/DROP TABLE/); await page.screenshot({ path: info.outputPath('library-destructive-review.png'), fullPage: true }); await button(page.getByRole('dialog'), 'Cancel review').click();
   expect(fixture.rows()).toEqual(expected);
   expect((await studio.project(fixture.project.id)).schema.tables.find(t => t.physicalName === 'books')!.columns.some(c => c.physicalName === 'subtitle')).toBe(false);
   // Cancel keeps the desired declaration pending. Restore it explicitly in the editor.
   await addSubtitle(); await apply();
   const restored = await studio.project(fixture.project.id); expect(restored.revision).toBeGreaterThan(committed.revision);
   expect(restored.schema.tables.find(t => t.physicalName === 'books')!.columns.find(c => c.physicalName === 'subtitle')).toMatchObject({ nullable: true, type: { kind: 'text' } });
   expect(fixture.rows()).toEqual(expected); expect(await studio.project(witness.id)).toEqual(witness); expect(fileHash(witnessDb)).toBe(witnessHash);
   const db = new Database(fixture.database, { readonly: true });
   let schema: unknown;
   try { expect(db.pragma('foreign_key_check')).toEqual([]); expect(db.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]); schema = db.pragma('table_info(books)'); expect(schema).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'subtitle', type: 'TEXT', notnull: 0 })])); } finally { db.close(); }
   await page.reload(); expect(libraryRows(fixture.database)).toEqual(expected);
   writeFileSync(info.outputPath('library-migration-summary.json'), JSON.stringify({ mode: 'ui_journey', before, after: fixture.rows(), committedRevision: committed.revision, restoredRevision: restored.revision, schema, foreignKeys: [], integrity: 'ok', destructiveCancel: 'physical schema and tuples retained; desired declaration pending', restoration: 'visible add column, Save schema, Review, Apply', occupiedPort: 'PROJECT_BUSY; owned sentinel still served its exact response; explicit original-port retry', unrelatedModelUnchanged: true, unrelatedDatabaseUnchanged: true }, null, 2));
   await label(page, 'Runtime port').fill(new URL(fixture.origin).port); await button(page, 'Start / retry').click(); await expect(runtime).toHaveText('Generated runtime · running', { timeout: 30000 });
  },
 });
});
