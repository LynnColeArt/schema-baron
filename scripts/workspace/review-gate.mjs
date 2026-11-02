// Spec Kitty's declared-command gate runs the repository's real TypeScript suite.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pinnedBinPath, pinnedNpmCli } from '../release/toolchain.mjs';

const [report, ...extra] = process.argv.slice(2);
if (!report || !isAbsolute(report) || extra.length) {
  console.error('Usage: node scripts/workspace/review-gate.mjs /absolute/path/to/junit.xml');
  process.exitCode = 2;
} else {
  // A new private root per invocation also separates concurrent baseline/head runs.
  const evidence = mkdtempSync(join(tmpdir(), 'schema-baron-review-gate-'));
  const result = spawnSync(process.execPath, [
    pinnedNpmCli, 'test', '--', '--reporter=junit', `--outputFile=${report}`,
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: pinnedBinPath,
      npm_config_ignore_scripts: 'true',
      SCHEMA_BARON_PARITY_EVIDENCE: join(evidence, 'parity'),
      SCHEMA_BARON_RECOVERY_EVIDENCE: join(evidence, 'recovery'),
      SCHEMA_BARON_MIGRATION_EVIDENCE: join(evidence, 'migrations'),
    },
  });
  if (result.error) console.error(`Review test runner failed: ${result.error.message}`);
  if (result.signal) {
    // Preserve a killed child's outcome instead of turning an absent exit code green.
    console.error(`Review test runner terminated by ${result.signal}`);
    process.kill(process.pid, result.signal);
  } else {
    process.exitCode = result.status ?? 1;
  }
}
