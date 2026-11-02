import { expect, type Page, type TestInfo } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import type { Project } from '@schema-baron/model';
import { authorCounts, bookTotals } from './oracles.js';
import type { AccessFixture } from './access-contract.js';
import { button, label, runOutput, startIsolatedStudio, wizardNext, schemaTable } from './helpers.js';

export const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export const revision = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
export function processIdentity(pid: number) {
 const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]!.split(' ');
 return { pid, birth: stat[19], cwd: readlinkSync(`/proc/${pid}/cwd`), executable: readlinkSync(`/proc/${pid}/exe`), uid: lstatSync(`/proc/${pid}`).uid };
}
export function identityPath(f: AccessFixture) { return f.database + '.auth-' + sha(f.project.id).slice(0, 32) + '.sqlite'; }
export function identities(f: AccessFixture) {
 const db = new Database(identityPath(f), { readonly: true });
 try { return db.prepare('SELECT project,id,username,password FROM identities ORDER BY project,id').all(); } finally { db.close(); }
}
export function observedRows(database: string, project: Project) {
 const db = new Database(database, { readonly: true });
 const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
 try { return Object.fromEntries(project.schema.tables.map(t => [t.physicalName, db.prepare(`SELECT * FROM ${quote(t.physicalName)} ORDER BY ${t.primaryKey.map(id => quote(t.columns.find(c => c.id === id)!.physicalName)).join(',')}`).all()])); } finally { db.close(); }
}
export async function stopManaged(page: Page) {
 const stop = button(page, 'Stop runtime');
 if (await stop.isEnabled()) await stop.click();
 await expect(page.getByRole('region', { name: 'Managed generated runtime' }).locator('strong').first()).toHaveText('Generated runtime · stopped');
}
export async function generate(page: Page, destination?: string, apply = true) {
 await button(page, 'Generate…').click();
 if (destination) await label(page, 'Output location').fill(destination);
 const preview = page.waitForResponse(r => r.url().includes('/commands') && r.request().postDataJSON()?.operation === 'generation.preview');
 await button(page, 'Preview files').click();
 const outcome = await (await preview).json(); expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
 await expect(page.getByRole('dialog')).toContainText('files to create/change/delete or preserve');
 if (!apply) return;
 const dialog = page.getByRole('dialog');
 for (const check of await dialog.getByRole('checkbox').all()) await check.check();
 await expect(button(dialog, 'Create application')).toBeEnabled();
 await button(dialog, 'Create application').click();
 await expect(dialog.getByRole('status')).toContainText('Application created.');
 await button(dialog, 'Close').click();
}
export async function buildRun(page: Page, f: AccessFixture, info: TestInfo, phase: string, studio: Awaited<ReturnType<typeof startIsolatedStudio>>) {
 const directory = join(f.directory, 'generated/app');
 await runOutput(directory, ['ci', '--ignore-scripts', '--offline'], info.outputPath(phase + '-install.log'));
 for (const script of ['typecheck', 'test']) await runOutput(directory, ['run', script], info.outputPath(phase + '-' + script + '.log'));
 await button(page, 'Build generated output').click();
 await expect(button(page, 'Start / retry')).toBeEnabled({ timeout: 120000 });
 await label(page, 'Runtime port').fill(new URL(f.origin).port);
 await button(page, 'Start / retry').click();
 await expect(page.getByRole('region', { name: 'Managed generated runtime' }).locator('strong').first()).toHaveText('Generated runtime · running', { timeout: 30000 });
}
async function observeManaged(studio: Awaited<ReturnType<typeof startIsolatedStudio>>, f: AccessFixture, info: TestInfo, phase: string) {
 const owner = JSON.parse(readFileSync(studio.config, 'utf8'));
 const command = async (operation: string, input: unknown) => {
  const response = await fetch(`${studio.url}/api/v1/projects/${f.project.id}/commands`, { method: 'POST', headers: { authorization: `Bearer ${owner.capability}`, 'content-type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), operation, expectedRevision: f.project.revision, input }) });
  const body = await response.json(); expect(body.ok).toBe(true); return body.result;
 };
 const state = await command('runtime.status', {}); expect(state.status).toBe('running');
 const job = await command('job.inspect', { jobId: state.jobId }); expect(job.outcome.ok).toBe(true);
 const identity = processIdentity(job.outcome.result.pid);
 expect(identity.executable).toBe(process.execPath); expect(identity.cwd).toBe(join(f.directory, 'generated/app'));
 writeFileSync(info.outputPath(phase + '-managed-process.json'), JSON.stringify({ identity, ownerIdentity: processIdentity(studio.child.pid!), readiness: state.status, job: state.jobId }, null, 2), { mode: 0o600 });
}
export function route(f: AccessFixture, tableName: string, kind: string) {
 const table = f.project.schema.tables.find(t => t.physicalName === tableName)!;
 const form = f.project.forms.find(form => form.kind === kind && form.sourceRef?.id === table.id)!;
 return f.project.pages.find(p => p.id === form.pageId)!.route;
}
export async function hookBehavior(f: AccessFixture) {
 const library = f.project.name === 'Library Catalog', table = library ? 'authors' : 'workshops';
 const before = f.rows(), app = f.app;
 await app.goto(f.origin + route(f, table, 'Grid'));
 await app.getByRole('link', { name: 'Edit record', exact: true }).first().click();
 const original = await label(app, 'name').inputValue();
 await label(app, 'name').fill('WP07 rejected value'); await button(app, 'Save').click();
 await expect(app.getByRole('alert').filter({ hasText: 'Authored verification rejected this name.' })).toBeVisible();
 expect(f.rows()).toEqual(before);
 await label(app, 'name').fill(original + ' verified'); await button(app, 'Save').click();
 await expect(app.getByText('Record saved.', { exact: false })).toBeVisible(); expect(f.rows()).not.toEqual(before);
 await app.goto(f.origin + route(f, table, 'Grid')); await app.getByRole('link', { name: 'Edit record', exact: true }).first().click();
 await label(app, 'name').fill(original); await button(app, 'Save').click();
 await expect(app.getByText('Record saved.', { exact: false })).toBeVisible(); expect(f.rows()).toEqual(before);
}
export async function parentContext(f: AccessFixture) {
 const library = f.project.name === 'Library Catalog', parent = library ? 'books' : 'workshops', child = library ? 'copies' : 'sessions';
 const before = f.rows(), app = f.app;
 await app.goto(f.origin + route(f, parent, 'Grid'));
 await app.getByRole('link', { name: library ? 'Uncatalogued Stories' : 'Garden Design', exact: true }).click();
 const filtered = app.url(); await expect(app.getByText('No records', { exact: false })).toBeVisible();
 await app.getByRole('link', { name: 'Add ' + child, exact: true }).click();
 await expect(label(app, library ? 'book_id' : 'workshop_id')).toHaveValue(library ? '3' : '2');
 await button(app, 'Cancel').click(); await expect(app).toHaveURL(filtered); expect(f.rows()).toEqual(before);
}
export async function customizeAndRegenerate(page: Page, f: AccessFixture, studio: Awaited<ReturnType<typeof startIsolatedStudio>>, info: TestInfo) {
 await page.getByRole('tab', { name: 'Code', exact: true }).click();
 const destination = f.project.outputConfig.approvedRootId + ':' + f.project.outputConfig.relativePath;
 await expect(label(page, 'Source output')).toHaveValue(destination);
 await label(page, 'Owned source path').fill('server/connection.ts'); await button(page, 'Read source').click();
 await expect(label(page, 'Source code')).toHaveValue(/databasePath/); await expect(label(page, 'Source code')).toHaveAttribute('readonly', '');
 await stopManaged(page);
 await page.getByText('Declare authored hook', { exact: true }).click();
 await label(page, 'Module name').fill('verification'); await button(page, 'Declare hook').click();
 await expect(label(page, 'Source module').locator('option')).toHaveCount(2);
 f.project = await studio.project(f.project.id);
 await generate(page);
 const contract = f.project.extensionContracts.find(c => c.relativePath === 'authored/verification.ts')!;
 await label(page, 'Source module').selectOption(contract.id); await button(page, 'Read source').click();
 await expect(label(page, 'Source code')).toHaveValue(/Authored validator interface v1/);
 const source = await label(page, 'Source code').inputValue();
 const table = f.project.schema.tables.find(t => t.physicalName === (f.project.name === 'Library Catalog' ? 'authors' : 'workshops'))!;
 const name = table.columns.find(c => c.physicalName === 'name')!.id;
 const authored = source.replace('(_context) => ({})', `(context) => context.values[${JSON.stringify(name)}] === 'WP07 rejected value' ? { [${JSON.stringify(name)}]: 'Authored verification rejected this name.' } : ({})`);
 expect(authored).not.toBe(source);
 await label(page, 'Source code').fill(authored);
 const saved = page.waitForResponse(r => r.url().includes('/commands') && r.request().postDataJSON()?.operation === 'extension.write');
 await button(page, 'Save authored source').click(); expect((await (await saved).json()).ok).toBe(true);
 await page.getByRole('region', { name: 'Source editor', exact: true }).screenshot({ path: info.outputPath('authored-source.png') });
 const file = join(f.directory, 'generated/app', contract.relativePath);
 expect(readFileSync(file, 'utf8')).toBe(authored);
 const before = { rows: f.rows(), identity: identities(f), model: await studio.project(f.project.id), authored: sha(authored) };
 await buildRun(page, f, info, 'authored', studio); await observeManaged(studio, f, info, 'authored'); await hookBehavior(f); await parentContext(f); await reportBehavior(f);
 for (let cycle = 1; cycle <= 2; cycle++) {
  await stopManaged(page); await generate(page);
  expect(f.rows()).toEqual(before.rows); expect(identities(f)).toEqual(before.identity);
  expect(await studio.project(f.project.id)).toEqual(before.model); expect(readFileSync(file, 'utf8')).toBe(authored);
  await buildRun(page, f, info, 'regeneration-' + cycle, studio); await observeManaged(studio, f, info, 'regeneration-' + cycle); await hookBehavior(f); await parentContext(f); await reportBehavior(f);
 }
 // Deliberate source mutation occurs only in an isolated fault copy.
 await stopManaged(page);
 const fault = join(f.directory, 'generated-conflict-copy');
 await generate(page, f.project.outputConfig.approvedRootId + ':generated-conflict-copy');
 const owned = join(fault, 'server/connection.ts'), reviewed = readFileSync(owned, 'utf8');
 writeFileSync(owned, reviewed + '\n// isolated owned-source conflict\n');
 await generate(page, f.project.outputConfig.approvedRootId + ':generated-conflict-copy', false);
 await expect(button(page.getByRole('dialog'), 'Create application')).toBeDisabled();
 await expect(page.getByRole('dialog')).toContainText(/modified|conflict/i);
 await button(page.getByRole('dialog'), 'Cancel').click();
 writeFileSync(join(studio.root, 'conflicted-owned-source.txt'), readFileSync(owned)); writeFileSync(owned, reviewed);
 await generate(page, f.project.outputConfig.approvedRootId + ':generated-conflict-copy', false);
 await expect(button(page.getByRole('dialog'), 'Create application')).toBeEnabled(); await button(page.getByRole('dialog'), 'Cancel').click();
 expect(f.rows()).toEqual(before.rows); expect(identities(f)).toEqual(before.identity); expect(await studio.project(f.project.id)).toEqual(before.model);
 await generate(page); await buildRun(page, f, info, 'fault-return', studio);
 expect(readFileSync(file, 'utf8')).toBe(authored); expect(identities(f)).toEqual(before.identity); expect(f.rows()).toEqual(before.rows);
 writeFileSync(info.outputPath('regeneration-summary.json'), JSON.stringify({ revision: revision(), application: f.project.name, mode: 'ui_journey', cycles: 2, authoredHash: before.authored, rowsHash: sha(JSON.stringify(before.rows)), modelHash: sha(JSON.stringify(before.model)), identityInvariantsPreserved: true, fault: { mode: 'fault', isolatedCopy: true, promotionBlocked: true, restoredReviewedBytesAndFreshPreview: true } }, null, 2), { mode: 0o600 });
 return { authoredHash: before.authored, authoredPath: contract.relativePath };
}
export function inventory(root: string): string[] {
 return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  const path = join(root, entry.name); expect(lstatSync(path).isSymbolicLink()).toBe(false);
  return entry.isDirectory() ? inventory(path).map(p => entry.name + '/' + p) : [entry.name];
 }).sort();
}
export async function exportPair(page: Page, f: AccessFixture, studio: Awaited<ReturnType<typeof startIsolatedStudio>>, info: TestInfo) {
 f.project = await studio.project(f.project.id);
 await stopManaged(page); await generate(page);
 await page.getByText('Portable definition and output export', { exact: true }).click();
 const checkbox = page.getByRole('checkbox', { name: /I reviewed including a private snapshot/ });
 await expect(checkbox).not.toBeChecked();
 const exports: string[] = [];
 for (const includeData of [false, true]) {
  const name = includeData ? 'portable-snapshot' : 'portable-default';
  await label(page, 'Export destination').fill(f.project.outputConfig.approvedRootId + ':' + name);
  if (includeData) await checkbox.check();
  const response = page.waitForResponse(r => r.url().includes('/commands') && r.request().postDataJSON()?.operation === 'project.export');
  await button(page, 'Export portable application').click(); const outcome = await (await response).json(); expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
  const directory = join(f.directory, name), files = inventory(directory); exports.push(directory);
  expect(files.some(path => /(?:^|\/)(?:node_modules|\.next|owner\.json|\.kittify|\.studio|credentials)(?:\/|$)/i.test(path))).toBe(false);
  expect(files.filter(path => /\.(sqlite|sqlite3|db)(?:-|$)/.test(path))).toEqual(includeData ? ['data/application.sqlite'] : []);
  const publicText = files.filter(path => !/\.(sqlite|sqlite3|db)$/.test(path)).map(path => readFileSync(join(directory, path), 'utf8')).join('\n');
  for (const privateValue of [studio.root, f.database, f.secret, f.username, ...identities(f).map(row => (row as { password: string }).password), JSON.parse(readFileSync(studio.config, 'utf8')).capability]) expect(publicText).not.toContain(privateValue);
  const authored = f.project.extensionContracts.find(c => c.relativePath === 'authored/verification.ts')!;
  expect(readFileSync(join(directory, 'app', authored.relativePath))).toEqual(readFileSync(join(f.directory, 'generated/app', authored.relativePath)));
  if (includeData) {
   const snapshot = join(directory, 'data/application.sqlite'); expect(observedRows(snapshot, f.project)).toEqual(f.rows());
   const db = new Database(snapshot, { readonly: true }), original = new Database(f.database, { readonly: true });
   try {
    const allowed = f.project.schema.tables.map(table => ({ name: table.physicalName }));
    // This engine ledger belongs to the business DB after a reviewed migration;
    // managed visitor accounts/sessions belong to a different private SQLite file.
    if (original.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='__schema_baron_migrations'").get()) allowed.push({ name: '__schema_baron_migrations' });
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()).toEqual(allowed.sort((a, b) => a.name.localeCompare(b.name)));
    expect(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('identities','schema_baron_identity_store','attempts','provisions')").all()).toEqual([]);
   } finally { db.close(); original.close(); }
  }
  const portable = JSON.parse(readFileSync(join(directory, 'project.json'), 'utf8'));
  expect(portable.outputConfig).toEqual({ approvedRootId: 'portable', relativePath: 'app' });
  for (const connection of portable.connections) { expect(connection.locator).toEqual({ approvedRootId: 'portable', relativePath: 'data/application.sqlite' }); expect(connection.secretRef).toBeUndefined(); }
  writeFileSync(info.outputPath(name + '-inventory.json'), JSON.stringify({ files, privateDatabaseIncluded: includeData, identityIncluded: false, authoredHash: sha(readFileSync(join(directory, 'app', authored.relativePath))) }, null, 2));
 }
 return exports;
}

export async function crossProjectCode(page: Page, f: AccessFixture, studio: Awaited<ReturnType<typeof startIsolatedStudio>>) {
 const original = readFileSync(join(f.directory, 'generated/app/server/connection.ts'), 'utf8');
 await page.getByRole('tab', { name: 'Code', exact: true }).click();
 await label(page, 'Source module').selectOption(''); await label(page, 'Owned source path').fill('server/connection.ts');
 await button(page, 'Read source').click(); await expect(label(page, 'Source code')).toHaveValue(original);
 await button(page, 'New project…').click(); await label(page, 'Project name').fill('Source isolation witness'); await label(page, 'Project location').fill(studio.projects);
 await wizardNext(page); await wizardNext(page);
 await schemaTable(page.getByRole('region', { name: 'Schema editor', exact: true }), 'witness', [['id', 'integer'], ['description', 'text']]);
 for (let step = 0; step < 4; step++) await wizardNext(page);
 const completed = page.waitForResponse(r => r.url().endsWith('/api/v1/setup/complete')); await button(page, 'Complete').click();
 const result = await (await completed).json(); expect(result.ok).toBe(true); const other = await studio.project(result.result.id);
 await generate(page);
 if (await button(page, 'Flow map').getAttribute('aria-pressed') === 'true') await button(page, 'Flow map').click();
 await page.getByRole('tab', { name: 'Code', exact: true }).click();
 await expect(label(page, 'Source output')).toHaveValue(other.outputConfig.approvedRootId + ':' + other.outputConfig.relativePath);
 await expect(label(page, 'Source code')).toHaveValue(''); await expect(label(page, 'Source code')).toHaveAttribute('readonly', '');
 await expect(label(page, 'Source module').locator('option')).toHaveCount(1); await expect(button(page, 'Save authored source')).toHaveCount(0);
 await label(page, 'Owned source path').fill('server/connection.ts'); await button(page, 'Read source').click();
 const otherBytes = readFileSync(join(studio.projects, other.name, 'generated/app/server/connection.ts'), 'utf8');
 expect(otherBytes).not.toBe(original); await expect(label(page, 'Source code')).toHaveValue(otherBytes);
 await button(page, 'Open / Switch…').click(); await page.getByRole('dialog').getByRole('button').filter({ hasText: f.project.name }).first().click();
 if (await button(page, 'Flow map').getAttribute('aria-pressed') === 'true') await button(page, 'Flow map').click();
 await page.getByRole('tab', { name: 'Code', exact: true }).click();
 await expect(label(page, 'Source output')).toHaveValue(f.project.outputConfig.approvedRootId + ':' + f.project.outputConfig.relativePath);
 await label(page, 'Source module').selectOption(''); await label(page, 'Owned source path').fill('server/connection.ts'); await button(page, 'Read source').click();
 await expect(label(page, 'Source code')).toHaveValue(original);
 expect(await studio.project(f.project.id)).toEqual(f.project);
}

export async function reportBehavior(f: AccessFixture) {
 const report = async (path: string) => { await f.app.goto(f.origin + path); return Promise.all((await f.app.locator('tbody tr').all()).map(async row => (await row.getByRole('cell').allTextContents()).map(cell => cell.trim()))); };
 if (f.project.name === 'Library Catalog') { expect(await report('/counts')).toEqual(authorCounts); expect(await report('/totals')).toEqual(bookTotals); }
 else expect(await report('/workshop-report')).toEqual([['1', 'Introduction to Woodworking', '3'], ['2', 'Garden Design', '0']]);
}
