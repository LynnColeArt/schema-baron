import { afterEach, expect, test } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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


test('real Git lint preserves verbatim evidence captures while rejecting authored whitespace', () => {
  const fixture = directory();
  const script = join(fixture, 'scripts/workspace/verify.mjs');
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(resolve('scripts/workspace/verify.mjs'), script);
  writeFileSync(join(fixture, '.nvmrc'), process.versions.node + '\n');
  const git = (...args: string[]) => spawnSync('git', args, { cwd: fixture, encoding: 'utf8' });
  const write = (path: string, content: string) => {
    const full = join(fixture, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  };
  const captures = [
    'docs/evidence/legacy/output.log', 'docs/evidence/legacy/worker.trace',
    'packages/example/tests/roundtrip/evidence/nested/output.log', 'packages/example/tests/roundtrip/evidence/worker.trace',
    'scripts/release/evidence/output.log', 'scripts/release/evidence/worker.trace',
    'tests/e2e/roundtrip/evidence/output.log', 'tests/e2e/roundtrip/evidence/worker.trace'
  ];
  const authored = ['docs/evidence/notes.ts', 'docs/evidence/notes.md', 'docs/evidence/notes with spaces.md', 'docs/evidence/notes\nline.md', 'docs/evidence/notes.txt', 'docs/outside-evidence.log', 'docs/evidence-ish/output.log', 'packages/example/tests/roundtrip/evidence-ish/output.log', 'tests/e2e/roundtrip/evidence-ish/output.log', 'scripts/release/evidence-ish/output.log'];
  const sourceFiles = ['docs/evidence/source with spaces.mjs', 'docs/evidence/source\nline.mjs'];
  const jsonFiles = ['docs/evidence/result with spaces.json', 'docs/evidence/result\nline.json'];
  for (const path of [...captures, ...authored]) write(path, 'initial\n');
  for (const path of sourceFiles) write(path, 'export const value = 1;\n');
  for (const path of jsonFiles) write(path, '{}\n');
  expect(git('init', '-q').status).toBe(0);
  expect(git('add', '.').status).toBe(0);
  expect(git('-c', 'user.name=Lint regression', '-c', 'user.email=lint@localhost', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'baseline').status).toBe(0);
  const baseline = git('rev-parse', 'HEAD').stdout.trim();
  const verbatim = 'verbatim result \n\n';
  for (const path of captures) write(path, verbatim);
  // Establish actual Git whitespace violations independently of the verifier's classification.
  expect(git('diff', '--check', baseline, '--').status).not.toBe(0);
  const lint = () => spawnSync(process.execPath, [script, 'lint'], { cwd: fixture, encoding: 'utf8', env: { ...process.env, SCHEMA_BARON_LINT_BASE: baseline } });
  const captured = lint();
  expect(captured.status, captured.stdout + captured.stderr).toBe(0);
  for (const path of captures) expect(readFileSync(join(fixture, path), 'utf8')).toBe(verbatim);
  for (const path of authored) {
    write(path, verbatim);
    const rejected = lint();
    expect(rejected.status, path).not.toBe(0);
    expect(rejected.stdout + rejected.stderr).toContain(path);
    write(path, 'initial\n');
  }
  expect(lint().status).toBe(0);
  for (const path of sourceFiles) {
    write(path, 'export const value = 2;\n');
    const valid = lint();
    expect(valid.status, valid.stdout + valid.stderr).toBe(0);
    write(path, 'export const = ;\n');
    const invalid = lint();
    expect(invalid.status).not.toBe(0);
    expect(invalid.stdout + invalid.stderr).toContain(path);
    write(path, 'export const value = 1;\n');
  }
  for (const path of jsonFiles) {
    write(path, '{"value":2}\n');
    const valid = lint();
    expect(valid.status, valid.stdout + valid.stderr).toBe(0);
    write(path, '{ invalid }\n');
    expect(lint().status).not.toBe(0);
    write(path, '{}\n');
  }
  expect(lint().status).toBe(0);
});
