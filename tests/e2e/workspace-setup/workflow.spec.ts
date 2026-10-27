import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test.use({ trace: 'off', viewport: { width: 1280, height: 800 } });
test('keyless first run, project folders, changed preference and restart', async ({ page }) => {
 test.setTimeout(120000);
 const home = mkdtempSync(join(tmpdir(), 'schema-baron-first-run-'));
 let child: ChildProcess | undefined, exited: Promise<unknown> | undefined;
 async function stop() {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const deadline = setTimeout(() => child?.kill('SIGKILL'), 10000);
  try { await exited; } finally { clearTimeout(deadline); }
 }
 async function start(port = '0') {
  const env = { ...process.env, HOME: home, PORT: port, SCHEMA_BARON_BROWSER_MODE: 'local', NEXT_TELEMETRY_DISABLED: '1' };
  delete (env as Record<string, string | undefined>).SCHEMA_BARON_OWNER_CONFIG;
  child = spawn(process.execPath, [resolve('apps/studio/dist/main.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  exited = once(child, 'exit');
  return new Promise<string>((resolveUrl, reject) => {
   const timer = setTimeout(() => reject(Error('Studio readiness timed out')), 30000);
   let output = '';
   child!.stderr!.on('data', chunk => { output += String(chunk); const match = output.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/); if (match) { clearTimeout(timer); resolveUrl(match[1]!); } });
   child!.once('exit', () => { clearTimeout(timer); reject(Error('Studio exited before readiness')); });
  });
 }
 try {
  const url = await start();
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Workspace settings', exact: true })).toBeVisible();
  await expect(page.getByLabel('Studio service owner key')).toHaveCount(0);
  await expect(page.getByLabel('Projects folder')).toHaveValue(join(home, 'projects/schema-baron'));
  // Unfinished setup remains unfinished after a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Workspace settings', exact: true })).toBeVisible();
  await page.getByLabel('Projects folder').fill('relative/path');
  await page.getByRole('button', { name: 'Save workspace settings' }).click();
  await expect(page.getByText('Choose an absolute projects folder, or a path beginning with ~/.', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Projects folder').fill(join(home, 'projects/schema-baron'));
  await page.getByRole('button', { name: 'Save workspace settings' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  async function create(name: string, base: string) {
   await page.getByRole('button', { name: 'New project…', exact: true }).click();
   await page.getByLabel('Project name', { exact: true }).fill(name);
   await expect(page.getByText(`${base}/${name}`, { exact: true })).toBeVisible();
   await page.getByRole('button', { name: 'Create project', exact: true }).click();
   await expect(page.getByRole('dialog')).toBeHidden();
   const definitions = readdirSync(join(base, name)).filter(file => file.endsWith('.json'));
   expect(definitions).toHaveLength(1);
   return readFileSync(join(base, name, definitions[0]!), 'utf8');
  }
  const first = await create('First project', join(home, 'projects/schema-baron'));
  expect(JSON.parse(first).outputConfig.relativePath).toBe('generated/app');
  await page.getByRole('button', { name: 'Workspace settings…', exact: true }).click();
  await page.getByLabel('Projects folder').fill(join(home, 'another-workspace'));
  await page.getByRole('button', { name: 'Save workspace settings' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await create('Second project', join(home, 'another-workspace'));
  await stop(); await start(new URL(url).port);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open / Switch…', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Studio service owner key')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open / Switch…', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('First project', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Second project', { exact: true })).toBeVisible();
  const firstPath = join(home, 'projects/schema-baron/First project');
  expect(readFileSync(join(firstPath, readdirSync(firstPath).find(file => file.endsWith('.json'))!), 'utf8')).toBe(first);
 } finally { await stop(); rmSync(home, { recursive: true, force: true }); }
});
