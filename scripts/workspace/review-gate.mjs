// Spec Kitty's declared-command gate runs the repository's real TypeScript suite.
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pinnedBinPath, pinnedNpmCli } from '../release/toolchain.mjs';

export function inspectReviewCheckout(root) {
  const modules = join(root, 'node_modules');
  let installedRoot;
  try { installedRoot = lstatSync(modules); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (installedRoot && (!installedRoot.isDirectory() || installedRoot.isSymbolicLink())) {
    throw new Error('Review setup refuses borrowed or symlinked node_modules; prepare checkout-local dependencies.');
  }
  const local = (path, expectedRoot) => {
    const location = relative(realpathSync(expectedRoot), realpathSync(path));
    return location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location);
  };
  let dependenciesReady = true;
  for (const executable of ['vitest/vitest.mjs', 'typescript/bin/tsc', '.bin/vitest', '.bin/tsc']) {
    const path = join(modules, executable);
    if (!existsSync(path)) dependenciesReady = false;
    else if (!local(path, modules)) throw new Error(`Review setup refuses borrowed package executable: ${executable}.`);
  }
  const artifacts = ['apps/studio/dist/main.js', 'apps/mcp/dist/main.js', 'apps/studio/.next/BUILD_ID',
    'packages/generator/dist/templates/base/package-lock.template', 'packages/generator/dist/templates/auth/store.template'];
  for (const group of ['apps', 'packages']) {
    for (const directory of readdirSync(join(root, group))) {
      const workspace = join(root, group, directory);
      const manifest = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8'));
      const installed = join(modules, manifest.name);
      if (!existsSync(installed)) dependenciesReady = false;
      else if (realpathSync(installed) !== realpathSync(workspace)) {
        throw new Error(`Review setup refuses workspace ${manifest.name} resolved outside this checkout.`);
      }
      const exports = value => {
        if (typeof value === 'string' && value.startsWith('./dist/')) artifacts.push(join(group, directory, value));
        else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) if (key !== 'types') exports(child);
      };
      exports(manifest.exports);
    }
  }
  return { dependenciesReady, artifactsReady: artifacts.every(path => existsSync(join(root, path)) && local(join(root, path), root)) };
}

export function runReviewCommand(command, args, options) {
  const result = spawnSync(command, args, options);
  if (result.error || result.status !== 0) {
    const error = new Error(result.error?.message ?? `Review command failed (${result.signal ?? result.status}): ${args.slice(0, 3).join(' ')}`);
    error.status = result.status ?? 1;
    error.signal = result.signal;
    throw error;
  }
}

function main() {
  const [report, ...extra] = process.argv.slice(2);
  if (!report || !isAbsolute(report) || extra.length) {
    console.error('Usage: node scripts/workspace/review-gate.mjs /absolute/path/to/junit.xml');
    process.exitCode = 2;
    return;
  }
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  if (realpathSync(process.cwd()) !== root) throw new Error('Run the review gate from its own checkout root.');
  // A new private root per invocation also separates concurrent baseline/head runs.
  const evidence = mkdtempSync(join(tmpdir(), 'schema-baron-review-gate-'));
  const options = {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: pinnedBinPath,
      npm_config_ignore_scripts: 'true',
      NEXT_TELEMETRY_DISABLED: '1',
      SCHEMA_BARON_PARITY_EVIDENCE: join(evidence, 'parity'),
      SCHEMA_BARON_RECOVERY_EVIDENCE: join(evidence, 'recovery'),
      SCHEMA_BARON_MIGRATION_EVIDENCE: join(evidence, 'migrations'),
    },
  };
  const stages = [];
  const gateStarted = performance.now();
  const stage = (label, args) => {
    const started = performance.now();
    console.log(`Review gate: ${label}`);
    let status = 'passed';
    try { runReviewCommand(process.execPath, args, options); }
    catch (error) { status = 'failed'; throw error; }
    finally {
      const elapsedSeconds = (performance.now() - started) / 1000;
      stages.push({ label, status, elapsedSeconds });
      writeFileSync(`${report}.stages.json`, JSON.stringify({ stages, wallSeconds: (performance.now() - gateStarted) / 1000 }, null, 2), { mode: 0o600 });
      console.log(`Review gate: ${label} elapsed ${elapsedSeconds.toFixed(2)}s`);
    }
  };
  const before = inspectReviewCheckout(root);
  if (!before.dependenciesReady) {
    try { stage('offline dependency preparation (lifecycle scripts denied)', [pinnedNpmCli, 'ci', '--ignore-scripts', '--offline']); }
    catch (error) {
      console.error('Offline review preparation failed. Explicitly acquire the pinned lockfile/cache with scripts denied before retrying; there is no network fallback.');
      throw error;
    }
    if (!inspectReviewCheckout(root).dependenciesReady) throw new Error('Offline install did not produce checkout-local workspace dependencies.');
  }
  stage('locked dependency verification', [join(root, 'scripts/workspace/dependencies.mjs'), 'verify']);
  stage('reviewed native prebuild verification', [join(root, 'scripts/workspace/native.mjs')]);
  if (!before.artifactsReady) stage('production build preparation', [pinnedNpmCli, 'run', 'build']);
  if (!inspectReviewCheckout(root).artifactsReady) throw new Error('Review setup is incomplete: compiled runtime or Studio production artifacts are missing.');
  stage('Vitest JUnit suite', [pinnedNpmCli, 'test', '--', '--reporter=junit', `--outputFile=${report}`]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    console.error(error.message);
    // Preserve a killed child's outcome instead of turning an absent exit code green.
    if (error.signal) process.kill(process.pid, error.signal);
    else process.exitCode = error.status ?? 1;
  }
}
