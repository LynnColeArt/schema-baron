import { expect, test } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { parseProject } from '@schema-baron/model';
import { compileProject, emitApplication, observeOutput, writeInitialOutput } from '../../src/index.js';

function decimalProject() {
 const routes = [ ['eq', '/equality'], ['gte', '/minimum'], ['lte', '/maximum'], ['eq', '/warehouse/public_items'] ] as const;
 return parseProject({
  id: 'decimal-regression-project', formatVersion: 1, revision: 1, name: 'Nullable decimal regression', target: 'next-typescript-sqlite', targetVersion: '1',
  connectionRefs: ['connection'], connections: [{ id: 'connection', name: 'External data', locator: { approvedRootId: 'data', relativePath: 'live.sqlite' }, fingerprint: '0'.repeat(64), capabilities: { sqliteVersion: '3', foreignKeys: true, returning: true, strictTables: true, unsupportedObjects: [] } }],
  schema: { id: 'schema', revision: 1, opaqueObjects: [], tables: [{ id: 'ledger', physicalName: 'ledger " figures', columns: [
   { id: 'row-field', physicalName: 'row key', type: { kind: 'integer' }, nullable: false },
   { id: 'amount-field', physicalName: 'exact amount', type: { kind: 'decimal', scale: 2, precision: 38, encoding: 'text', rounding: 'half-up' }, nullable: true },
   { id: 'scaled-field', physicalName: 'scaled value', type: { kind: 'decimal', scale: 2, precision: 18, encoding: 'scaled-integer', rounding: 'half-up' }, nullable: true },
  ], primaryKey: ['row-field'], foreignKeys: [], uniqueConstraints: [], checks: [], indexes: [] }] },
  queries: [],
  pages: routes.map(([, route], index) => ({ id: 'page-' + index, route, title: 'Decimal list', document: [{ kind: 'form', formId: 'form-' + index }], formIds: ['form-' + index] })),
  forms: routes.map(([operator], index) => ({ id: 'form-' + index, pageId: 'page-' + index, kind: 'Grid', sourceRef: { kind: 'table', id: 'ledger' }, keyMapping: [], controlIds: ['amount-' + index, 'row-' + index], actionIds: [], search: [{ fieldId: 'amount-field', operator }], sorting: [{ fieldId: 'scaled-field', direction: 'asc' }], paging: { pageSize: 20 }, appearance: { label: 'Exact amounts' } })),
  controls: routes.flatMap((_, index) => ['amount', 'row'].map(field => ({ id: field + '-' + index, formId: 'form-' + index, kind: 'label', binding: { kind: 'stored', fieldId: field + '-field' }, readOnly: true, appearance: { label: field }, validation: { required: false }, events: [] }))),
  actions: [], policies: [{ id: 'public-policy', scope: 'global', ownerId: 'decimal-regression-project', access: 'public' }], globalPolicyId: 'public-policy', outputConfig: { approvedRootId: 'output', relativePath: 'app' }, extensionContracts: [],
 });
}

test('emitted production pages preserve NULL decimal comparisons, exact values, sorting and missing-file behavior', async () => {
 const root = mkdtempSync(join(tmpdir(), 'wp10-cycle1-runtime-'));
 const output = join(root, 'application'), databasePath = join(root, 'live.sqlite');
 const db = new Database(databasePath);
 db.exec('CREATE TABLE "ledger "" figures"("row key" INTEGER PRIMARY KEY,"exact amount" TEXT,"scaled value" INTEGER)');
 const insert = db.prepare('INSERT INTO "ledger "" figures" VALUES(?,?,?)');
 insert.run(1, '1000000000000000000.25', 100000000000000025n);
 insert.run(2, '9.75', 975n);
 insert.run(3, null, null);
 insert.run(4, '0.00', 0n);
 insert.run(5, '-3.25', -325n);
 db.close();
 const before = readFileSync(databasePath);
 const project = decimalProject();
 writeInitialOutput(output, emitApplication(compileProject(project), databasePath), observeOutput(output));
 writeFileSync('/tmp/wp10-cycle1-runtime-root.txt', root);
 const npmCli = join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
 const env = { PATH: dirname(process.execPath) + ':/usr/bin:/bin', HOME: process.env.HOME ?? '', NODE_PATH: '', npm_config_ignore_scripts: 'true', npm_config_workspaces: 'false', npm_config_registry: 'https://registry.npmjs.org/', NEXT_TELEMETRY_DISABLED: '1' };
 for (const args of [['ci', '--ignore-scripts', '--offline'], ['run', 'typecheck'], ['run', 'test'], ['run', 'build']]) {
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: output, env, encoding: 'utf8', timeout: 90000, maxBuffer: 5_000_000 });
  writeFileSync(join(root, args.join('-') + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  expect(result.error, args.join(' ')).toBeUndefined();
  expect(result.status, (result.stdout ?? '') + (result.stderr ?? '')).toBe(0);
 }
 const child = spawn(process.execPath, [join(output, 'node_modules/next/dist/bin/next'), 'start', '-p', '0', '-H', '127.0.0.1'], { cwd: output, env, stdio: ['ignore', 'pipe', 'pipe'] });
 const exited = once(child, 'exit');
 try {
  const url = await new Promise<string>((resolve, reject) => {
   let logs = '';
   const timer = setTimeout(() => reject(Error('Generated server readiness timeout: ' + logs)), 15000);
   child.stdout!.on('data', chunk => { logs += String(chunk); const match = logs.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); } });
   child.stderr!.on('data', chunk => { logs += String(chunk); });
   child.once('exit', () => { clearTimeout(timer); reject(Error('Generated server exited: ' + logs)); });
  });
  async function read(route: string, parameters: Record<string, string> = {}) {
   const response = await fetch(url + route + '?' + new URLSearchParams(parameters));
   const html = await response.text();
   expect(response.status).toBe(200);
   const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
   const rows = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(row => [...row[1]!.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(cell => cell[1]!));
   return { rows, html };
  }
  const initial = await read('/minimum');
  expect(initial.rows.map(row => row[1])).toEqual(['3', '5', '4', '2', '1']);
  expect(initial.rows[0]?.[0]).toBe('—');
  expect(initial.html).toContain('1000000000000000000.25');
  for (const [route, form, value, expected] of [
   ['/equality', 'form-0', '1000000000000000000.25', ['1']],
   ['/equality', 'form-0', '0.00', ['4']],
   ['/minimum', 'form-1', '10.00', ['1']],
   ['/minimum', 'form-1', '1000000000000000000.25', ['1']],
   ['/maximum', 'form-2', '10.00', ['5', '4', '2']],
   ['/maximum', 'form-2', '1000000000000000000.25', ['5', '4', '2', '1']],
  ] as const) {
   const result = await read(route, { [form + ':filter:amount-field']: value });
   expect(result.html).not.toContain('The list could not be read.');
   expect(result.rows.map(row => row[1])).toEqual(expected);
  }
  const sorted = await read('/minimum', { 'form-1:sort': 'scaled-field', 'form-1:direction': 'desc' });
  expect(sorted.rows.map(row => row[1])).toEqual(['1', '2', '4', '5', '3']);
  expect((await read('/warehouse/public_items')).rows).toHaveLength(5);
  renameSync(databasePath, databasePath + '.saved');
  try { expect((await read('/minimum')).html).toContain('The list could not be read.'); expect(existsSync(databasePath)).toBe(false); }
  finally { renameSync(databasePath + '.saved', databasePath); }
  expect(readFileSync(databasePath)).toEqual(before);
  writeFileSync(join(root, 'observations.json'), JSON.stringify({ output, databasePath, cases: 'eq/gte/lte, SQL NULL, zero, large exact values, supported sort, literal nested route, missing database', dataPreserved: true }, null, 2));
 } finally {
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  child.kill('SIGTERM'); await exited; clearTimeout(timer);
 }
}, 180000);
