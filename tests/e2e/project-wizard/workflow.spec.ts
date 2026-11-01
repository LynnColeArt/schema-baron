import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
test.use({ trace: 'off', actionTimeout: 15000, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);
let home: string, url: string, child: ChildProcess, exited: Promise<unknown>;
test.beforeAll(async () => {
 home = mkdtempSync(join(tmpdir(), 'schema-baron-wizard-ui-'));
 const env = { ...process.env, HOME: home, PORT: '0', SCHEMA_BARON_BROWSER_MODE: 'local', NEXT_TELEMETRY_DISABLED: '1' };
 delete (env as Record<string, string | undefined>).SCHEMA_BARON_OWNER_CONFIG;
 child = spawn(process.execPath, [resolve('apps/studio/dist/main.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] }); exited = once(child, 'exit');
 url = await new Promise<string>((done, fail) => { let logs = ''; const timer = setTimeout(() => fail(Error('Studio readiness timeout')), 30000); child.stderr!.on('data', chunk => { logs += String(chunk); const match = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timer); done(match[1]!); } }); child.once('exit', () => { clearTimeout(timer); fail(Error('Studio exited before readiness')); }); });
});
test.afterAll(async () => { child?.kill('SIGTERM'); const deadline = setTimeout(() => child?.kill('SIGKILL'), 10000); try { await exited; } finally { clearTimeout(deadline); rmSync(home, { recursive: true, force: true }); } });
async function connect(page: Page) {
 await page.goto(url); await page.getByRole('button', { name: 'Workspace settings…', exact: true }).waitFor({ state: 'visible' });
 if (await page.getByRole('heading', { name: 'Workspace settings', exact: true }).isVisible()) { await page.getByRole('button', { name: 'Save workspace settings', exact: true }).click(); await expect(page.getByRole('dialog')).toBeHidden(); }
}
async function start(page: Page, name: string) {
 await page.getByRole('button', { name: 'New project…', exact: true }).click();
 await page.getByLabel('Project name', { exact: true }).fill(name);
}
async function next(page: Page) { await page.getByRole('dialog').getByRole('button', { name: 'Next', exact: true }).click(); }
async function table(page: Page, name: string) {
 const editor = page.getByRole('dialog').getByRole('region', { name: 'Schema editor', exact: true });
 await editor.getByRole('button', { name: '＋ Table', exact: true }).click(); await editor.getByLabel('Table name', { exact: true }).fill(name);
 await editor.getByRole('button', { name: '＋ Column', exact: true }).click(); await editor.getByLabel('Column name', { exact: true }).fill('id'); await editor.getByLabel('Logical type', { exact: true }).selectOption('integer'); await editor.getByRole('checkbox', { name: 'Allow NULL', exact: true }).uncheck();
 await editor.getByRole('button', { name: '＋ Column', exact: true }).click(); await editor.getByLabel('Column name', { exact: true }).fill('description'); await editor.getByRole('checkbox', { name: 'Allow NULL', exact: true }).uncheck();
 await editor.getByRole('tab', { name: 'Keys', exact: true }).click(); await editor.getByRole('checkbox', { name: 'id', exact: true }).check();
}
test('new SQLite wizard saves keys, preserves Back edits, renders Mermaid, creates linked protected pages and reuses schema/map tools', async ({ page }) => {
 await connect(page); await start(page, 'Workshop'); await next(page); await next(page);
 await table(page, 'work_orders'); await next(page);
 await expect(page.getByRole('checkbox', { name: 'Record work_orders', exact: true })).toBeChecked();
 await page.getByRole('button', { name: 'Back', exact: true }).click(); await expect(page.getByLabel('Table name', { exact: true })).toHaveValue('work_orders');
 await page.getByRole('dialog').getByRole('checkbox', { name: 'id', exact: true }).uncheck(); await next(page);
 await expect(page.getByRole('checkbox', { name: 'Record work_orders', exact: true })).not.toBeChecked();
 await expect(page.getByRole('checkbox', { name: 'Record work_orders', exact: true })).toBeDisabled();
 await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.getByRole('dialog').getByRole('checkbox', { name: 'id', exact: true }).check(); await next(page);
 await page.getByRole('checkbox', { name: 'Record work_orders', exact: true }).check();
 await next(page); await page.getByRole('checkbox', { name: 'Enable simple visitor login' }).check(); await next(page); await next(page);
 await expect(page.getByRole('heading', { name: 'Review Workshop', exact: true })).toBeVisible();
 await expect(page.locator('.application-mermaid svg')).toBeVisible({ timeout: 20000 });
 await expect(page.getByRole('button', { name: 'Complete', exact: true })).toBeEnabled();
 await page.screenshot({ path: resolve('.local/wizard-review.png'), fullPage: true });
 await expect(page.getByText('3 pages · 3 forms · 1 table', { exact: true })).toBeVisible();
 expect(existsSync(join(home, 'projects/schema-baron/Workshop'))).toBe(false);
 await page.getByRole('button', { name: 'Mermaid source', exact: true }).click(); await expect(page.getByLabel('Mermaid source', { exact: true })).toContainText('work_orders');
 await page.getByRole('button', { name: 'Mermaid diagram', exact: true }).click();
 const completion = page.waitForResponse(response => response.url().endsWith('/api/v1/setup/complete'));
 await page.getByRole('button', { name: 'Complete', exact: true }).click(); const outcome = await (await completion).json(); expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
 await expect(page.getByRole('dialog')).toBeHidden();
 await page.getByRole('button', {name:'Generate…',exact:true}).click();
 await expect(page.getByLabel('Output location',{exact:true})).toHaveValue(`${outcome.result.outputConfig.approvedRootId}:generated/app`);
 await page.getByRole('button',{name:'Preview files',exact:true}).click();
 await expect(page.getByRole('button',{name:'Create application',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Create application',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created.');
 expect(existsSync(join(home,'projects/schema-baron/Workshop/generated/app/package.json'))).toBe(true);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 const db = new Database(join(home, 'projects/schema-baron/Workshop/application.sqlite')); expect(db.pragma('table_info(work_orders)')).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'id', pk: 1 }), expect.objectContaining({ name: 'description', notnull: 1 })])); db.close();
 await expect(page.getByRole('region', { name: 'Application behavior map', exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Mermaid diagram', exact: true }).click(); await expect(page.locator('.application-mermaid svg')).toBeVisible();
 await page.getByRole('button', { name: 'Schema', exact: true }).click(); await expect(page.getByRole('button', { name: 'Review migration…', exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Schema', exact: true }).click();
 await page.getByRole('button', { name: 'Open / Switch…', exact: true }).click();
 await page.getByRole('dialog').getByRole('button', { name: 'Open settings for Workshop', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Project settings', exact: true })).toBeVisible(); await expect(page.getByRole('dialog')).toContainText('Workshop'); await page.getByRole('button', { name: 'Close', exact: true }).click();
 await page.getByRole('button', { name: 'Open / Switch…', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Show flow chart for Workshop', exact: true }).click(); await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.getByRole('tabpanel', { name: 'Application flow map', exact: true })).toBeVisible();
});
test('existing SQLite review is clear, compound keys are retained, Cancel is read-only and Complete leaves rows unchanged', async ({ page }) => {
 await connect(page); const directory = join(home, 'external'); mkdirSync(directory); const path = join(directory, 'books.sqlite');
 const db = new Database(path); db.exec("CREATE TABLE books (publisher TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL, PRIMARY KEY(publisher, code)); INSERT INTO books VALUES('North','B1','Atlas');"); db.close(); const before = readFileSync(path);
 await start(page, 'Canceled library'); await next(page); await page.getByRole('radio', { name: 'Use an existing SQLite database', exact: true }).check(); await page.getByLabel('SQLite database path', { exact: true }).fill(path); await page.getByRole('button', { name: 'Read database and continue', exact: true }).click();
 await expect(page.getByRole('status').filter({ hasText: 'Database read successfully' })).toBeVisible(); await expect(page.getByRole('cell', { name: 'publisher, code', exact: true })).toBeVisible();
 await next(page); await next(page); await next(page); await next(page); await expect(page.locator('.application-mermaid svg')).toBeVisible(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
 expect(existsSync(join(home, 'projects/schema-baron/Canceled library'))).toBe(false); expect(readFileSync(path)).toEqual(before);
 await start(page, 'Library'); await next(page); await page.getByRole('radio', { name: 'Use an existing SQLite database', exact: true }).check(); await page.getByLabel('SQLite database path', { exact: true }).fill(path); await page.getByRole('button', { name: 'Read database and continue', exact: true }).click(); await next(page); await next(page); await next(page); await next(page); await page.getByRole('button', { name: 'Complete', exact: true }).click(); await expect(page.getByRole('dialog')).toBeHidden(); expect(readFileSync(path)).toEqual(before);
 await page.getByRole('button', { name: 'Open / Switch…', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Show flow chart for Workshop', exact: true }).click(); await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.locator('.explorer-project')).toContainText('Workshop');
});
test('nested relationship dialogs keep their own labels and Escape preserves the wizard schema', async ({ page }) => {
 await connect(page); await start(page, 'Relationship draft'); await next(page); await next(page);
 await table(page, 'parents'); await table(page, 'children');
 await page.getByRole('dialog', { name: 'New project', exact: true }).getByRole('button', { name: '＋ Relationship', exact: true }).click();
 await expect(page.getByRole('dialog', { name: 'Create relationship', exact: true })).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog', { name: 'Create relationship', exact: true })).toBeHidden();
 const wizard = page.getByRole('dialog', { name: 'New project', exact: true }); await expect(wizard).toBeVisible();
 await expect(wizard.getByLabel('Table name', { exact: true })).toHaveValue('children');
 await expect(wizard.locator('.schema-table-list').getByRole('button')).toHaveCount(2);
 await wizard.getByRole('button', { name: '＋ Relationship', exact: true }).click();
 const relationship = page.getByRole('dialog', { name: 'Create relationship', exact: true });
 await relationship.getByLabel('Local table', { exact: true }).selectOption({ label: 'children' });
 await relationship.getByLabel('Referenced table', { exact: true }).selectOption({ label: 'parents' });
 await relationship.getByLabel('Local column 1', { exact: true }).selectOption({ label: 'id' });
 await relationship.getByLabel('Referenced column 1', { exact: true }).selectOption({ label: 'id' });
 await relationship.getByRole('button', { name: 'Add relationship draft', exact: true }).click();
 await expect(relationship).toBeHidden();
 await next(page); await next(page); await next(page); await next(page);
 await page.getByRole('button', { name: 'Mermaid source', exact: true }).click();
 await expect(page.getByLabel('Mermaid source', { exact: true })).toContainText('references');
 await wizard.getByRole('button', { name: 'Cancel', exact: true }).click();
 expect(existsSync(join(home, 'projects/schema-baron/Relationship draft'))).toBe(false);
});
