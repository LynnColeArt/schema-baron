import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
try {
  const evidence = JSON.parse(readFileSync(join(root, 'scripts/workspace/evidence/native.json'), 'utf8'));
  const target = process.platform === 'linux' && !process.report.getReport().header.glibcVersionRuntime ? 'linuxmusl' : process.platform;
  const binary = `prebuilds/${target}-${process.arch}.node`;
  if (!evidence.sha256[binary]) throw new Error(`No reviewed ${target}-${process.arch} prebuild; do not enable lifecycle scripts. Review a targeted source build and toolchain first.`);
  for (const file of ['package.json', 'binding.gyp', 'lib/binding.js', binary]) {
    const actual = createHash('sha256').update(readFileSync(join(root, 'node_modules/better-sqlite3', file))).digest('hex');
    if (actual !== evidence.sha256[file]) throw new Error(`Native artifact changed: ${file}; reinstall reviewed lockfile`);
  }
  const result = spawnSync(process.execPath, [join(root, 'scripts/workspace/verify.mjs'), 'sqlite'], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
