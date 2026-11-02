import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { cpus, loadavg, totalmem } from 'node:os';
import { execFileSync } from 'node:child_process';
import { button, label, startIsolatedStudio, connectLocal, wizardNext, schemaTable, saveProject } from './helpers.js';

test.use({ trace: 'off', actionTimeout: 15000, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ retries: 0 });
test.setTimeout(120000);
let studio: Awaited<ReturnType<typeof startIsolatedStudio>>;
let businessFiles: Map<string, string>;
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
test.beforeEach(async ({ browser }, info) => {
 studio = await startIsolatedStudio('schema-baron-drafts-ui-');
 businessFiles = new Map();
 writeFileSync(info.outputPath('provenance.json'), JSON.stringify({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), fixture: 'Fresh UI wizard; Studio-only author drafts; no generated runtime', mode: 'ui_journey', node: process.version, browser: browser.version(), ownerPid: studio.child.pid, zeroRetries: true }, null, 2));
});
test.afterEach(async () => {
 try { for (const [path, before] of businessFiles) expect(hash(path), 'Business database bytes changed during owner draft editing').toBe(before); }
 finally { await studio?.stop(); }
});
test.afterEach(async ({ page }, info) => {
 if (info.status !== info.expectedStatus) {
  await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true });
  writeFileSync(info.outputPath('visible-failure.txt'), await page.locator('body').innerText(), { mode: 0o600 });
 }
});
async function create(page: Page, name: string) {
 await button(page, 'New project…').click();
 await label(page, 'Project name').fill(name);
 await label(page, 'Project location').fill(join(studio.root, 'authored projects'));
 await wizardNext(page); await wizardNext(page);
 await schemaTable(page.getByRole('region', { name: 'Schema editor', exact: true }), name.includes('Library') ? 'books' : 'workshops', [['id', 'integer'], ['cost', 'decimal']]);
 for (let i = 0; i < 4; i++) await wizardNext(page);
 const completed = page.waitForResponse(r => r.url().endsWith('/api/v1/setup/complete'));
 await button(page, 'Complete').click();
 const outcome = await (await completed).json(); expect(outcome.ok).toBe(true);
 await expect(page.getByRole('dialog')).toBeHidden();
 const database = join(studio.root, 'authored projects', name, 'application.sqlite');
 businessFiles.set(database, hash(database));
 return studio.project(outcome.result.id);
}
async function open(page: Page, name: string) {
 await button(page, 'Open / Switch…').click();
 await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${name}\\s*r`) }).click();
 await expect(page.getByRole('dialog')).toBeHidden();
}
async function properties(page: Page, id: string) {
 await page.locator(`[role=treeitem][data-object-id="${id}"]`).dblclick();
 await page.getByRole('tab', { name: 'Format', exact: true }).click();
}
async function selectRange(input: Locator, start: number, end: number) {
 await input.focus();
 await input.press('Home');
 for (let i = 0; i < start; i++) await input.press('ArrowRight');
 for (let i = start; i < end; i++) await input.press('Shift+ArrowRight');
}
test('page draft restores its active text control and selection after reload', async ({ page }) => {
 await connectLocal(page, studio); const project = await create(page, 'Workshop draft recovery');
 await properties(page, project.pages[0]!.id);
 const title = label(page, 'Title'); await title.fill('Unfinished Workshop title'); await selectRange(title, 3, 9);
 await page.locator(`[role=treeitem][data-object-id="${project.pages[1]!.id}"]`).dblclick();
 await page.locator(`[role=treeitem][data-object-id="${project.pages[0]!.id}"]`).dblclick();
 await expect(title).toHaveValue('Unfinished Workshop title'); await expect(title).toBeFocused();
 expect(await title.evaluate((e: HTMLInputElement) => [e.selectionStart,e.selectionEnd])).toEqual([3,9]);
 page.on('dialog', dialog => void dialog.accept());
 await page.reload();
 await expect(title).toHaveValue('Unfinished Workshop title');
 await expect(title).toBeFocused();
 expect(await title.evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd])).toEqual([3, 9]);
 expect(await studio.project(project.id)).toEqual(project);
});
test('schema partial decimal text survives view switch and reload without normalization', async ({ page }) => {
 await connectLocal(page, studio); const other = await create(page, 'Workshop schema isolation'); const project = await create(page, 'Library schema draft recovery');
 await button(page, 'Schema').click();
 const schema = page.getByRole('region', { name: 'Schema editor', exact: true });
 await schema.locator('.schema-table-list button').first().click();
 await schema.getByRole('tab', { name: 'Columns', exact: true }).click();
 await schema.locator('.schema-column-list').getByRole('button', { name: 'cost · decimal', exact: true }).click();
 const scale = label(schema, 'Decimal scale');
 await label(schema, 'Table name').fill('books_unsaved');
 await scale.fill(''); await scale.pressSequentially('-');
 await expect(scale).toHaveValue('-');
 await button(schema, 'Save schema').click();
 await expect(schema.locator('.schema-messages [role=status]')).toContainText('Correct incomplete numeric');
 await expect(scale).toHaveValue('-');
 await button(page, 'Schema').click(); await button(page, 'Schema').click();
 await expect(scale).toHaveValue('-');
 await open(page, other.name); expect(await studio.project(other.id)).toEqual(other);
 await open(page, project.name); await expect(scale).toHaveValue('-');
 page.on('dialog', dialog => void dialog.accept()); await page.reload(); await button(page, 'Schema').click();
 await expect(scale).toHaveValue('-');
 await expect(scale).toBeFocused();
 expect(await scale.evaluate((e: HTMLInputElement) => [e.selectionStart,e.selectionEnd])).toEqual([1,1]);
 await expect(label(schema, 'Table name')).toHaveValue('books_unsaved');
 expect(await studio.project(project.id)).toEqual(project);
});

test('control numeric and query scalar drafts retain invalid text and actionable rejected Save through recovery', async ({ page }) => {
 await connectLocal(page, studio); const other = await create(page, 'Workshop control isolation'); const project = await create(page, 'Library control and query recovery');
 const control = project.controls.find(c => c.kind !== 'button')!;
 await properties(page, control.id);
 await label(page, 'Label').fill('Unfinished control caption');
 const width = label(page, 'Width'); await width.fill('-'); await selectRange(width, 0, 1);
 await button(page, '▣ Save').click();
 await expect(page.getByRole('alert').filter({ hasText: /Width/ }).first()).toBeVisible();
 await expect(width).toHaveValue('-'); expect(await studio.project(project.id)).toEqual(project);
 await button(page, 'Schema').click(); await button(page, 'Schema').click();
 await expect(width).toHaveValue('-'); await expect(width).toBeFocused();
 page.on('dialog', dialog => void dialog.accept()); await page.reload();
 await expect(label(page, 'Label')).toHaveValue('Unfinished control caption'); await expect(width).toHaveValue('-');
 await expect(width).toBeFocused(); expect(await width.evaluate((e: HTMLInputElement) => [e.selectionStart,e.selectionEnd])).toEqual([0,1]);
 await button(page, 'Queries').click(); await button(page, 'New query').click();
 await label(page, 'Query name').fill('Unfinished query name');
 const query = page.locator('.qd');
 await button(page.getByRole('navigation', { name: 'Query sections', exact: true }), 'Parameters').click();
 await button(page, 'Add parameter').click(); await label(page, 'Has default').check();
 const scalar = label(page, 'Parameter 1 default'); await scalar.fill('-'); await selectRange(scalar,0,1);
 await button(page, 'Save query').click();
 await expect(query.getByRole('status').first()).toContainText(/correct|diagnostic|invalid|failed/i);
 await expect(scalar).toHaveValue('-'); expect(await studio.project(project.id)).toEqual(project);
 await button(page, 'Queries').click(); await button(page, 'Queries').click();
 await expect(scalar).toHaveValue('-'); await expect(scalar).toBeFocused();
 await open(page, other.name); expect(await studio.project(other.id)).toEqual(other);
 await open(page, project.name); await expect(scalar).toHaveValue('-');
 await page.reload(); await button(page, 'Queries').click();
 await expect(label(page, 'Query name')).toHaveValue('Unfinished query name'); await expect(scalar).toHaveValue('-');
 await expect(scalar).toBeFocused(); expect(await scalar.evaluate((e: HTMLInputElement) => [e.selectionStart,e.selectionEnd])).toEqual([0,1]);
 await button(page, 'Queries').click();
 await expect(label(page, 'Label')).toHaveValue('Unfinished control caption'); await expect(width).toHaveValue('-');
 expect(await studio.project(project.id)).toEqual(project);
});

test('thirty received UI revisions retain draft selection; conflicts and two project drafts stay isolated', async ({ page, context, browser }, info) => {
 await connectLocal(page, studio);
 const workshop = await create(page, 'Workshop notification drafts');
 const library = await create(page, 'Library isolation drafts');
 const libraryPage = library.pages[0]!;
 await properties(page, libraryPage.id); await label(page, 'Title').fill('Library unsaved title');
 await selectRange(label(page, 'Title'), 2, 7);
 await open(page, workshop.name);
 const draftPage = workshop.pages[0]!, unrelated = workshop.pages[1]!;
 await properties(page, draftPage.id);
 const title = label(page, 'Title'); await title.fill('Workshop unsaved title'); await selectRange(title, 4, 11);
 const remote = await context.newPage(); await remote.goto(studio.url); await open(remote, workshop.name);
 await properties(remote, unrelated.id);
 const samples: { sample: number; feedbackMs: number; saveMs: number; receiptMs: number; load: number[] }[] = [];
 for (let i = 0; i < 30; i++) {
  const next = `Unrelated received revision ${i + 1}`, started = performance.now();
  await label(remote, 'Title').fill(next);
  await expect(remote.locator(`[role=treeitem][data-object-id="${unrelated.id}"]`)).toContainText(next);
  const feedbackMs = performance.now() - started, saveStart = performance.now();
  await saveProject(remote); const saveMs = performance.now() - saveStart;
  // This visible title proves the actual revision reached the drafting tab.
  await expect(page.locator(`[role=treeitem][data-object-id="${unrelated.id}"]`)).toContainText(next);
  await expect(title).toHaveValue('Workshop unsaved title'); await expect(title).toBeFocused();
  expect(await title.evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd])).toEqual([4, 11]);
  await expect(title).toHaveCount(1);
  samples.push({ sample: i + 1, feedbackMs, saveMs, receiptMs: performance.now() - saveStart, load: loadavg() });
  writeFileSync(info.outputPath('draft-timings.json'), JSON.stringify({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version, browser: browser.version(), cpu: cpus()[0]?.model, cores: cpus().length, totalMemory: totalmem(), concurrentLoad: 'Other mission verification may run; final NFR verdict belongs to WP08', zeroRetries: true, thresholds: { feedbackMs: 2000, saveMs: 5000 }, samples }, null, 2));
 }
 expect(samples).toHaveLength(30);
 expect([...samples].sort((a,b) => a.feedbackMs-b.feedbackMs)[28]!.feedbackMs).toBeLessThanOrEqual(2000);
 expect(Math.max(...samples.map(s => s.saveMs))).toBeLessThanOrEqual(5000);
 const received = await studio.project(workshop.id);
 expect(received.pages.find(p => p.id === draftPage.id)).toEqual(draftPage);
 expect(await studio.project(library.id)).toEqual(library);
 // Ordinary same-field Save in another tab is a separately labeled competing revision.
 await properties(remote, draftPage.id); await label(remote, 'Title').fill('Competing service title'); await saveProject(remote);
 await expect(page.getByText('Conflicting service revision', { exact: true })).toBeVisible();
 await page.screenshot({ path: info.outputPath('explicit-conflict.png'), fullPage: true });
 await expect(title).toHaveValue('Workshop unsaved title'); await expect(button(page, '▣ Save')).toBeDisabled();
 const competing = await studio.project(workshop.id);
 await button(page, 'Keep my draft').click();
 await title.fill(''); await button(page, '▣ Save').click();
 await expect(page.getByRole('status').filter({ hasText: 'Correct the highlighted properties before saving.' }).first()).toBeVisible();
 await expect(page.getByRole('region', { name: 'Diagnostic messages', exact: true })).toContainText('title:');
 await expect(title).toHaveValue(''); expect(await studio.project(workshop.id)).toEqual(competing);
 await title.fill('Workshop resolved author title'); await selectRange(title, 3, 8);
 await open(page, library.name);
 await expect(label(page, 'Title')).toHaveValue('Library unsaved title'); await expect(label(page, 'Title')).toBeFocused();
 expect(await label(page, 'Title').evaluate((e: HTMLInputElement) => [e.selectionStart, e.selectionEnd])).toEqual([2,7]);
 expect(await studio.project(library.id)).toEqual(library);
 await open(page, workshop.name); await expect(title).toHaveValue('Workshop resolved author title');
 await saveProject(page);
 const saved = await studio.project(workshop.id);
 expect(saved.pages.find(p => p.id === draftPage.id)?.title).toBe('Workshop resolved author title');
 expect(saved.schema).toEqual(workshop.schema); expect(saved.controls).toEqual(workshop.controls); expect(saved.forms).toEqual(workshop.forms);
 expect(saved.pages.find(p => p.id === unrelated.id)).toEqual(competing.pages.find(p => p.id === unrelated.id));
 expect(await studio.project(library.id)).toEqual(library);
 await open(page, library.name); await expect(title).toHaveValue('Library unsaved title');
 await expect(title).toBeFocused(); expect(await title.evaluate((e: HTMLInputElement) => [e.selectionStart,e.selectionEnd])).toEqual([2,7]);
 await remote.close();
});
