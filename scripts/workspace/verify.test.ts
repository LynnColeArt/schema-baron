import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/workspace/verify.mjs', ...args], { encoding: 'utf8' });
const directory = () => { const path = mkdtempSync(join(tmpdir(), 'schema-baron-check-')); temporary.push(path); return path; };

test('temporary strict TypeScript modules compile and errors propagate', () => {
  const path = directory();
  writeFileSync(join(path, 'index.ts'), 'export const value: number = 42;');
  expect(run('module', path).status).toBe(0);
  writeFileSync(join(path, 'index.ts'), 'export const value: number = "wrong";');
  expect(run('module', path).status).not.toBe(0);
});

test('clean-output runner preserves failure and removes only its temporary output', () => {
  const script = resolve(directory(), 'child.mjs');
  writeFileSync(script, 'import {writeFileSync} from "node:fs"; writeFileSync(process.env.SCHEMA_BARON_TEST_OUTPUT + "/proof", "proof"); process.exit(17);');
  const result = run('clean-output', process.execPath, script);
  expect(result.status).toBe(17);
  expect(result.stdout).toContain('Temporary output removed');
});

test('generated-app verification refuses missing output instead of reporting success', () => {
  const result = run('generated', directory());
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('package.json');
});

test('generated-app verification rejects workspace dependencies', () => {
  const path = directory();
  writeFileSync(join(path, 'package.json'), JSON.stringify({ dependencies: { model: 'workspace:*' } }));
  const result = run('generated', path);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('workspace');
});

test('credential scan detects a synthetic private key without echoing contents', () => {
  const path = directory();
  writeFileSync(join(path, 'secret.txt'), ['-----BEGIN', 'PRIVATE KEY-----'].join(' '));
  const result = run('credentials', path);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('secret.txt');
  expect(result.stderr).not.toContain('BEGIN');
});

test('standalone harness runs real package checks and propagates a failing test', () => {
  const path = directory();
  const scripts = { typecheck: 'node -e "process.exit(0)"', test: 'node -e "process.exit(19)"', build: 'node -e "process.exit(0)"' };
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name: 'temporary-harness', version: '1.0.0', scripts }));
  writeFileSync(join(path, 'package-lock.json'), JSON.stringify({ name: 'temporary-harness', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'temporary-harness', version: '1.0.0' } } }));
  expect(run('generated', path).status).not.toBe(0);
  scripts.test = 'node -e "process.exit(0)"';
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name: 'temporary-harness', version: '1.0.0', scripts }));
  expect(run('generated', path).status).toBe(0);
});

test('unknown verification modes fail explicitly', () => {
  const result = run('unknown-mode');
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Unknown verification mode');
});

test('diff lint refuses an unavailable baseline', () => {
  const result = spawnSync(process.execPath, ['scripts/workspace/verify.mjs', 'lint'], { encoding: 'utf8', env: { ...process.env, SCHEMA_BARON_LINT_BASE: 'refs/heads/nonexistent-bootstrap-test' } });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('refs/heads/nonexistent-bootstrap-test');
});

test('generated checks reject misleading dot-prefixed workspace children', () => {
  const path = mkdtempSync(resolve('..bootstrap-proof-'));
  temporary.push(path);
  const result = run('generated', path);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('outside workspace resolution');
});

test('public npm generated check cannot borrow undeclared workspace executables', () => {
  const path = directory();
  const scripts = { typecheck: 'tsc --version', test: 'tsc --version', build: 'tsc --version' };
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name: 'isolated-tool-probe', version: '1.0.0', scripts }));
  writeFileSync(join(path, 'package-lock.json'), JSON.stringify({ name: 'isolated-tool-probe', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'isolated-tool-probe', version: '1.0.0' } } }));
  const result = spawnSync('npm', ['run', 'check:generated', '--', path], { encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stdout).not.toContain('Version 7.0.2');
  expect(result.stderr).toMatch(/tsc.*(?:not found|not recognized)/i);
});

test('public npm generated check installs and uses its own declared compiler offline', () => {
  const path = directory();
  const scripts = { typecheck: 'tsc --strict --noEmit --skipLibCheck index.ts', test: 'node environment.mjs && tsc --version', build: 'tsc --outDir dist --skipLibCheck index.ts' };
  writeFileSync(join(path, 'environment.mjs'), `
    import assert from 'node:assert/strict';
    assert.ok(!process.env.PATH.includes(${JSON.stringify(resolve('.'))}));
    assert.equal(process.env.NODE_PATH, '');
    assert.equal(process.env.NODE_OPTIONS, undefined);
    assert.equal(process.env.INIT_CWD, process.cwd());
  `);
  const dependency = { typescript: '7.0.2' };
  const workspaceLock = JSON.parse(readFileSync(resolve('package-lock.json'), 'utf8'));
  writeFileSync(join(path, 'index.ts'), 'export const answer: number = 42;');
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name: 'independent-tool-probe', version: '1.0.0', scripts, devDependencies: dependency }));
  writeFileSync(join(path, 'package-lock.json'), JSON.stringify({ name: 'independent-tool-probe', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'independent-tool-probe', version: '1.0.0', devDependencies: dependency }, ...Object.fromEntries(Object.entries(workspaceLock.packages).filter(([name]) => name === 'node_modules/typescript' || name.startsWith('node_modules/@typescript/'))) } }));
  const result = spawnSync('npm', ['run', 'check:generated', '--', path], { encoding: 'utf8', env: { ...process.env, NODE_PATH: resolve('node_modules'), NODE_OPTIONS: '--no-warnings' } });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout).toContain('Version 7.0.2');
});
