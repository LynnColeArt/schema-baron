import { expect, test, type BrowserContext } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Project } from '@schema-baron/model';
import { pinnedBinPath } from '../../../scripts/release/toolchain.mjs';
import { button, label, freePort, runOutput } from './helpers.js';
import { hookBehavior, identities, observedRows, parentContext, processIdentity, revision, route, sha } from './portability.js';
import { authorCounts, bookTotals } from './oracles.js';
import type { AccessFixture } from './access-contract.js';

test.use({ trace: 'off', actionTimeout: 15000, viewport: { width: 1440, height: 1000 } });
test.describe.configure({ retries: 0 });
test.setTimeout(900000);
for (const name of ['workshop', 'library']) test(name + ' portable application runs with its Studio owner stopped', async ({ browser }, info) => {
 const handoff = process.env.SCHEMA_BARON_PORTABILITY_HANDOFF;
 expect(handoff, 'Run regeneration phase first with this fresh private handoff directory').toBeTruthy();
 const path = join(handoff!, name + '.json'); expect(existsSync(path), 'No missing or silently seeded handoff').toBe(true);
 const record = JSON.parse(readFileSync(path, 'utf8')) as { fixtureHash: string; journeyHash: string; revision: string; runId: string; project: Project; directory: string; database: string; username: string; secret: string; rows: unknown; identityHash: string; ownerIdentity: ReturnType<typeof processIdentity>; ownerUrl: string; ownerStopped: boolean; originalJourneyCompleted: boolean; exports: string[]; authored: { authoredHash: string; authoredPath: string } };
 expect(record.fixtureHash).toBe(sha(readFileSync('fixtures/acceptance/' + name + '.json'))); expect(record.journeyHash).toBe(sha(readFileSync('tests/e2e/acceptance/' + name + '-journey.ts')));
 expect(record.revision).toBe(revision()); expect(record.runId).toBe(handoff!.split('/').at(-1)); expect(record.ownerStopped).toBe(true); expect(record.originalJourneyCompleted).toBe(true);
 expect(record.project.name).toBe(name === 'library' ? 'Library Catalog' : 'Workshop Planner');
 expect(existsSync(`/proc/${record.ownerIdentity.pid}`), 'Original owner process is stopped').toBe(false);
 await expect(fetch(record.ownerUrl, { signal: AbortSignal.timeout(3000) })).rejects.toThrow();
 writeFileSync(join(handoff!, name + '.consumed'), JSON.stringify({ revision: revision(), test: info.title }), { flag: 'wx', mode: 0o600 });
 const appRoot = join(record.exports[0]!, 'app');
 expect(sha(readFileSync(join(appRoot, record.authored.authoredPath)))).toBe(record.authored.authoredHash);
 expect(observedRows(record.database, record.project)).toEqual(record.rows);
 // Deployment deliberately points at the original external business DB + adjacent
 // managed identity pair; neither credential-bearing file came from the export.
 for (const args of [['ci', '--ignore-scripts', '--offline'], ['run', 'typecheck'], ['run', 'test'], ['run', 'build']]) await runOutput(appRoot, args, info.outputPath('independent-' + args.at(-1) + '.log'));
 const port = await freePort(), origin = 'http://127.0.0.1:' + port;
 const runtime = spawn(process.execPath, [join(appRoot, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: appRoot, env: { PATH: pinnedBinPath, HOME: process.env.HOME, NEXT_TELEMETRY_DISABLED: '1', APPLICATION_DATABASE_PATH: record.database }, stdio: ['ignore', 'pipe', 'pipe'] });
 const exited = once(runtime, 'exit'); let output = ''; runtime.stdout!.on('data', chunk => output += String(chunk)); runtime.stderr!.on('data', chunk => output += String(chunk));
 let context: BrowserContext | undefined;
 try {
  const runtimeIdentity = processIdentity(runtime.pid!);
  await expect.poll(() => output, { timeout: 30000 }).toContain('Ready in');
  context = await browser.newContext(); const app = await context.newPage();
  const f: AccessFixture = { project: record.project, directory: record.directory, database: record.database, origin, context, app, username: record.username, secret: record.secret, rows: () => observedRows(record.database, record.project) };
  expect(sha(JSON.stringify(identities(f)))).toBe(record.identityHash);
  const parent = name === 'library' ? 'books' : 'workshops';
  await app.goto(origin + route(f, parent, 'Grid')); await expect(app.getByRole('link', { name: name === 'library' ? 'The Glass Orchard' : 'Introduction to Woodworking', exact: true })).toBeVisible();
  await app.getByRole('link', { name: 'Add ' + parent, exact: true }).click(); await expect(label(app, 'Username')).toBeVisible();
  await label(app, 'Username').fill(record.username); await label(app, 'Password').fill(record.secret); await button(app, 'login').click(); await expect(label(app, 'id')).toBeVisible(); await button(app, 'Cancel').click();
  await hookBehavior(f); await parentContext(f);
  // A fresh independent visitor adds, edits and deletes through a filtered child list.
  const child = name === 'library' ? 'copies' : 'sessions';
  const filtered = app.url(); await app.getByRole('link', { name: 'Add ' + child, exact: true }).click();
  await label(app, 'id').fill('97'); await label(app, name === 'library' ? 'barcode' : 'title').fill('Independent 97');
  if (name === 'library') await label(app, 'replacement_cost').fill('6.25');
  await button(app, 'Save').click(); await expect(app).toHaveURL(filtered);
  const rows = f.rows() as Record<string, Record<string, unknown>[]>;
  const added = name === 'library' ? { id: 97, barcode: 'Independent 97', book_id: 3, replacement_cost: '6.25', note: null } : { id: 97, workshop_id: 2, title: 'Independent 97', duration_minutes: null };
  expect(rows[child]).toEqual([...(record.rows as Record<string, unknown[]>)[child]!, added]);
  await app.getByRole('link', { name: 'Edit record', exact: true }).click();
  await label(app, name === 'library' ? 'barcode' : 'title').fill('Independent edited 97'); await button(app, 'Save').click(); await expect(app).toHaveURL(filtered);
  expect((f.rows() as Record<string, Record<string, unknown>[]>)[child]!.at(-1)).toEqual({ ...added, [name === 'library' ? 'barcode' : 'title']: 'Independent edited 97' });
  await app.getByRole('link', { name: 'Edit record', exact: true }).click(); await app.locator('input[name="_confirmed"]').check(); await button(app, 'Delete').click(); await expect(app).toHaveURL(filtered); expect(f.rows()).toEqual(record.rows);
  const report = async (path: string) => { await app.goto(origin + path); return Promise.all((await app.locator('tbody tr').all()).map(async row => (await row.getByRole('cell').allTextContents()).map(cell => cell.trim()))); };
  if (name === 'library') { expect(await report('/counts')).toEqual(authorCounts); expect(await report('/totals')).toEqual(bookTotals); }
  else expect(await report('/workshop-report')).toEqual([['1', 'Introduction to Woodworking', '3'], ['2', 'Garden Design', '0']]);
  expect(sha(JSON.stringify(identities(f)))).toBe(record.identityHash); expect(f.rows()).toEqual(record.rows);
  await expect(fetch(record.ownerUrl, { signal: AbortSignal.timeout(3000) })).rejects.toThrow();
  writeFileSync(info.outputPath('independent-summary.json'), JSON.stringify({ revision: revision(), runId: record.runId, application: record.project.name, originalOwnerStopped: true, ownerProbeUnavailableBeforeAndAfter: true, runtimeIdentity, privateIdentity: 'Original external adjacent managed store explicitly retained; no identities exported', checks: ['offline install with scripts denied', 'typecheck', 'test', 'build', 'real Next start readiness', 'anonymous public grid', 'fresh visitor login', 'authored validator rejection and successful edits', 'parent filtered Add/Cancel', 'filtered Add/Edit/Delete exact tuples', 'independent reports', 'identity account invariants'], rowsHash: sha(JSON.stringify(record.rows)), authoredHash: record.authored.authoredHash }, null, 2), { mode: 0o600 });
 } finally {
  await context?.close();
  if (runtime.exitCode === null && runtime.signalCode === null) { runtime.kill('SIGTERM'); const timer = setTimeout(() => { if (runtime.exitCode === null && runtime.signalCode === null) runtime.kill('SIGKILL'); }, 10000); try { await exited; } finally { clearTimeout(timer); } }
  writeFileSync(info.outputPath('independent-runtime.log'), output, { mode: 0o600 });
 }
});
