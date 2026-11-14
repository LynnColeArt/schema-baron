// Test/release tools follow the selected pinned runtime, never a developer home.
import { realpathSync, readFileSync } from 'node:fs';
import { dirname, join, delimiter } from 'node:path';
const bin = dirname(realpathSync(process.execPath));
export const pinnedNpmCli = realpathSync(join(bin, '../lib/node_modules/npm/bin/npm-cli.js'));
export const pinnedNpmExecutable = join(bin, 'npm');
export const pinnedBinPath = [bin, '/usr/bin', '/bin'].join(delimiter);
if (process.versions.node !== '24.22.1' || JSON.parse(readFileSync(join(dirname(pinnedNpmCli), '../package.json'), 'utf8')).version !== '11.19.1') {
  throw new Error('Release verification requires Node 24.22.1 and npm 11.19.1 beside that runtime');
}
