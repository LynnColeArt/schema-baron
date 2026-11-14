import { expect, type Locator, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pinnedBinPath, pinnedNpmCli } from '../../../scripts/release/toolchain.mjs';
import type { Project } from '@schema-baron/model';
export const button = (scope: Page | Locator, name: string) => scope.getByRole('button', { name, exact: true });
export const label = (scope: Page | Locator, name: string) => scope.getByLabel(name, { exact: true });
export async function freePort(): Promise<number> {
 const server = createServer(); await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
 const address = server.address(); if (!address || typeof address === 'string') throw Error('No owned test port');
 await new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done())); return address.port;
}
export async function startIsolatedStudio(prefix: string) {
 const root = mkdtempSync(join(tmpdir(), prefix));
 const config = join(root, 'config', 'owner.json'), projects = join(root, 'workspace projects');
 expect(existsSync(projects)).toBe(false);
 const child = spawn(process.execPath, [resolve('apps/studio/dist/main.js')], {
  env: { ...process.env, PATH: pinnedBinPath, PORT: '0', SCHEMA_BARON_BROWSER_MODE: 'local', SCHEMA_BARON_OWNER_CONFIG: config, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
 });
 const exited = once(child, 'exit');
 const url = await new Promise<string>((done, fail) => {
  let output = ''; const timer = setTimeout(() => fail(Error('Isolated owner readiness timeout')), 30000);
  child.stderr!.on('data', chunk => { output += String(chunk); const match = output.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timer); done(match[1]!); } });
  child.once('exit', () => { clearTimeout(timer); fail(Error('Isolated owner exited before readiness')); });
 });
 const owner = JSON.parse(readFileSync(config, 'utf8')) as { capability: string };
 async function project(id: string): Promise<Project> {
  const response = await fetch(`${url}/api/v1/projects/${id}`, { headers: { authorization: `Bearer ${owner.capability}` } });
  const body = await response.json(); expect(body.ok).toBe(true); return body.result;
 }
 async function stop() {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM'); const timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 10000);
  try { await exited; } finally { clearTimeout(timer); }
 }
 return { root, config, projects, child, url, project, stop };
}
export async function connectLocal(page: Page, studio: Awaited<ReturnType<typeof startIsolatedStudio>>) {
 await page.goto(studio.url);
 await expect(button(page, 'Workspace settings…')).toBeVisible();
 const dialog = page.getByRole('dialog', { name: 'Workspace settings', exact: true });
 await expect(dialog).toBeVisible(); await label(dialog, 'Projects folder').fill(studio.projects);
 await button(dialog, 'Save workspace settings').click(); await expect(dialog).toBeHidden();
}
export async function wizardNext(page: Page) { await button(page.getByRole('dialog', { name: 'New project', exact: true }), 'Next').click(); }
export async function schemaTable(editor: Locator, name: string, columns: [string, string][]) {
 await button(editor, '＋ Table').click(); await label(editor, 'Table name').fill(name);
 await editor.getByRole('tab', { name: 'Columns', exact: true }).click();
 for (const [column, type] of columns) { await button(editor, '＋ Column').click(); await label(editor, 'Column name').fill(column); await label(editor, 'Logical type').selectOption(type); await label(editor, 'Allow NULL').uncheck(); }
 await editor.getByRole('tab', { name: 'Keys', exact: true }).click(); await label(editor, 'id').check();
}
export async function selectObject(page: Page, id: string) {
 await page.locator(`[role=treeitem][data-object-id="${id}"]`).dblclick(); await page.getByRole('tab', { name: 'Data', exact: true }).click();
}
export async function saveProject(page: Page) {
 await expect(button(page, '▣ Save')).toBeEnabled();
 const saved = page.waitForResponse(r => r.url().includes('/commands') && r.request().method() === 'POST' && r.request().postDataJSON()?.operation === 'project.batch');
 await button(page, '▣ Save').click(); const outcome = await (await saved).json(); expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
 await expect(page.getByRole('status').filter({ hasText: 'Saved' }).first()).toBeVisible();
}
export async function runOutput(directory: string, args: string[], log: string) {
 const child: ChildProcess = spawn(process.execPath, [pinnedNpmCli, ...args], { cwd: directory, env: { ...process.env, PATH: pinnedBinPath, npm_config_ignore_scripts: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
 let output = ''; child.stdout!.on('data', chunk => { output += String(chunk); }); child.stderr!.on('data', chunk => { output += String(chunk); });
 const [code, signal] = await once(child, 'exit'); mkdirSync(resolve(log, '..'), { recursive: true }); writeFileSync(log, output, { mode: 0o600 });
 expect(signal, 'Dependency/output check terminated').toBe(null); expect(code, `Check failed; see ${log}`).toBe(0);
}
