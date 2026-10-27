import { cpSync, existsSync, mkdtempSync, lstatSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const fail = message => { throw new Error(message); };
const tool = name => join(root, 'node_modules', name);
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) { const error = new Error(`${command} failed (${result.status ?? result.signal})`); error.status = result.status ?? 1; throw error; }
}
function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', '.next', 'dist', 'coverage', '.local', '.kittify', '.worktrees'].includes(entry.name)) return [];
    const full = join(path, entry.name);
    return entry.isDirectory() ? files(full) : entry.isFile() ? [full] : [];
  });
}
function runtime() {
  const expected = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
  if (process.versions.node !== expected) fail(`Use Node ${expected}; found ${process.versions.node}`);
}
function workspaceCheck(kind) {
  for (const group of ['apps', 'packages']) {
    for (const name of readdirSync(join(root, group))) {
      const directory = join(root, group, name);
      const manifest = json(join(directory, 'package.json'));
      const source = files(directory).filter(path => /\.(ts|tsx)$/.test(path) && !path.endsWith('next.config.ts'));
      if (!source.length) { console.log(`NOT IMPLEMENTED: ${manifest.name} (${kind})`); continue; }
      if (kind === 'typecheck') run(process.execPath, [tool('typescript/bin/tsc'), '--project', join(directory, 'tsconfig.json')]);
      else {
        if (!manifest.scripts?.build) fail(`${manifest.name} has source but no build script`);
        run('npm', ['run', 'build', '--workspace', manifest.name]);
      }
    }
  }
}
function moduleCheck(path) {
  path = resolve(path ?? fail('module requires a directory'));
  const sources = files(path).filter(file => file.endsWith('.ts'));
  if (!sources.length) fail('No TypeScript module found');
  run(process.execPath, [tool('typescript/bin/tsc'), '--strict', '--noUncheckedIndexedAccess', '--exactOptionalPropertyTypes', '--target', 'ES2023', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--noEmit', '--skipLibCheck', ...sources]);
}
function cleanOutput(command, args) {
  if (!command) fail('clean-output requires an explicit command');
  const output = mkdtempSync(join(tmpdir(), 'schema-baron-output-'));
  try { run(command, args, { env: { ...process.env, SCHEMA_BARON_TEST_OUTPUT: output } }); }
  finally { rmSync(output, { recursive: true, force: true }); console.log('Temporary output removed'); }
}
function generated(path) {
  if (!path) fail('generated requires a standalone output directory; no generated application exists at bootstrap');
  path = realpathSync(resolve(path));
  const location = relative(root, path);
  if (location !== '..' && !location.startsWith(`..${sep}`)) fail('Generated checks must run outside workspace resolution');
  const manifestPath = join(path, 'package.json');
  if (!existsSync(manifestPath)) fail('Generated output lacks package.json');
  const manifest = json(manifestPath);
  for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (name.startsWith('@schema-baron/') || /^(workspace:|link:|file:)/.test(version)) fail(`Forbidden workspace dependency: ${name}`);
  }
  if (!existsSync(join(path, 'package-lock.json'))) fail('Generated output lacks its standalone package-lock.json');
  for (const script of ['typecheck', 'test', 'build']) if (!manifest.scripts?.[script]) fail(`Generated output lacks ${script} script`);
  const isolated = mkdtempSync(join(tmpdir(), 'schema-baron-standalone-'));
  try {
    cpSync(path, isolated, { recursive: true, filter: (source) => {
      const name = source.split(sep).at(-1);
      if (['node_modules', '.git', '.next', 'dist', 'coverage'].includes(name)) return false;
      if (lstatSync(source).isSymbolicLink()) fail('Generated source must not contain symlinks');
      return true;
    } });
    const lock = json(join(isolated, 'package-lock.json'));
    for (const [name, entry] of Object.entries(lock.packages ?? {})) {
      if (entry.link || (entry.resolved && !entry.resolved.startsWith('https://registry.npmjs.org/'))) fail(`Non-registry generated lock entry: ${name}`);
    }
    run('npm', ['ci', '--ignore-scripts', '--offline'], { cwd: isolated, env: { ...process.env, NODE_PATH: '' } });
    for (const script of ['typecheck', 'test', 'build']) run('npm', ['run', script], { cwd: isolated, env: { ...process.env, NODE_PATH: '' } });
  } finally { rmSync(isolated, { recursive: true, force: true }); }
}
function credentials(path) {
  let candidates;
  if (path) candidates = files(resolve(path));
  else {
    const tracked = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
    if (tracked.error || tracked.status !== 0) fail('Git credential-scan discovery failed');
    candidates = tracked.stdout.split('\0').filter(Boolean).map(file => join(root, file));
  }
  const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bAKIA[0-9A-Z]{16}\b/, /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/];
  if (!path) {
    for (const name of readdirSync(join(root, 'apps'))) {
      const bundle = join(root, 'apps', name, '.next/static');
      if (existsSync(bundle)) candidates.push(...files(bundle));
    }
  }
  const findings = candidates.filter(file => existsSync(file) && patterns.some(pattern => pattern.test(readFileSync(file, 'utf8'))));
  if (findings.length) fail(`Possible credentials in: ${findings.map(file => relative(root, file)).join(', ')}`);
  console.log(`Credential patterns checked in ${candidates.length} files (heuristic; not a guarantee)`);
}
async function sqlite() {
  const { default: Database } = await import('better-sqlite3');
  const path = mkdtempSync(join(tmpdir(), 'schema-baron-sqlite-'));
  const db = new Database(join(path, 'source.sqlite'));
  try {
    db.exec('CREATE TABLE proof (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    db.prepare('INSERT INTO proof(value) VALUES (?)').run('native ABI verified');
    db.transaction(() => db.prepare('INSERT INTO proof(value) VALUES (?)').run('transaction verified'))();
    await db.backup(join(path, 'backup.sqlite'));
    const backup = new Database(join(path, 'backup.sqlite'), { readonly: true });
    try { if (backup.prepare('SELECT count(*) AS count FROM proof').get().count !== 2) fail('SQLite backup mismatch'); }
    finally { backup.close(); }
    console.log(`SQLite ${db.prepare('SELECT sqlite_version() AS version').get().version}: native insert, transaction and online backup passed`);
  } finally { db.close(); rmSync(path, { recursive: true, force: true }); }
}
function lint() {
  run('git', ['diff', '--check', process.env.SCHEMA_BARON_LINT_BASE ?? 'HEAD', '--']);
  const result = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', process.env.SCHEMA_BARON_LINT_BASE ?? 'HEAD', '--'], { cwd: root, encoding: 'utf8' });
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  for (const check of [result, untracked]) if (check.error || check.status !== 0) fail(`Git lint discovery failed: ${check.error?.message ?? check.stderr.trim()}`);
  const changed = [...new Set((result.stdout + '\n' + untracked.stdout).split('\n').filter(Boolean))];
  for (const path of changed) {
    if (/\.mjs$/.test(path)) run(process.execPath, ['--check', join(root, path)]);
    if (/\.json$/.test(path)) json(join(root, path));
  }
  console.log(`Diff-scoped syntax/JSON/whitespace lint checked ${changed.length} files; TypeScript semantic validation is separate`);
}
async function main() {
  runtime();
  const [mode = 'all', ...args] = process.argv.slice(2);
  switch (mode) {
    case 'typecheck': {
      workspaceCheck(mode);
      // Typecheck the real harness/configuration even before product modules exist.
      const temporary = mkdtempSync(join(tmpdir(), 'schema-baron-types-'));
      try {
        const config = join(temporary, 'tsconfig.json');
        writeFileSync(config, JSON.stringify({ extends: join(root, 'tsconfig.base.json'), compilerOptions: { noEmit: true, types: [], skipLibCheck: true }, files: [join(root, 'vitest.config.ts'), join(root, 'playwright.config.ts'), join(root, 'apps/studio/next.config.ts'), join(root, 'scripts/workspace/verify.test.ts')] }));
        run(process.execPath, [tool('typescript/bin/tsc'), '-p', config]);
      } finally { rmSync(temporary, { recursive: true, force: true }); }
      break;
    }
    case 'build': workspaceCheck(mode); break;
    case 'module': moduleCheck(args[0]); break;
    case 'clean-output': cleanOutput(args[0], args.slice(1)); break;
    case 'generated': generated(args[0]); break;
    case 'credentials': credentials(args[0]); break;
    case 'sqlite': await sqlite(); break;
    case 'lint': lint(); break;
    case 'all':
      run(process.execPath, [join(root, 'scripts/workspace/native.mjs')]);
      for (const part of ['typecheck', 'lint', 'build', 'credentials']) run(process.execPath, [fileURLToPath(import.meta.url), part]);
      run(process.execPath, [tool('vitest/vitest.mjs'), 'run']);
      run(process.execPath, [join(root, 'scripts/workspace/dependencies.mjs'), 'verify']);
      break;
    default: fail(`Unknown verification mode: ${mode}`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = error.status || 1; });
