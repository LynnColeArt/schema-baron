// Online evidence collection is explicit; normal verify is offline and read-only.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const lock = read('package-lock.json');
const evidencePath = 'scripts/workspace/evidence/registry.json';
const hash = () => createHash('sha256').update(readFileSync(join(root, 'package-lock.json'))).digest('hex');
function assert(ok, message) { if (!ok) throw new Error(message); }
const entries = Object.entries(lock.packages).filter(([path, p]) => path.includes('node_modules/') && !p.link);
function nameOf(path) { return path.split('node_modules/').at(-1); }
async function collect() {
  const records = [];
  let next = 0;
  const cache = new Map();
  async function metadata(name) {
    if (!cache.has(name)) cache.set(name, fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`).then(response => { assert(response.ok, `Registry failed for ${name}: ${response.status}`); return response.json(); }));
    return cache.get(name);
  }
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < entries.length) {
      const [path, p] = entries[next++];
      assert(p.resolved?.startsWith('https://registry.npmjs.org/'), `Unexpected registry: ${path}`);
      const name = nameOf(path), meta = await metadata(name), v = meta.versions[p.version];
      assert(v && v.dist.integrity === p.integrity && v.dist.tarball === p.resolved, `Exact artifact mismatch: ${path}`);
      records.push({ path, name, version: p.version, firstPublished: meta.time.created, published: meta.time[p.version], packageModified: meta.time.modified, repository: v.repository ?? null, maintainers: v.maintainers?.map(m => m.name) ?? [], integrity: p.integrity, tarball: p.resolved, signatures: v.dist.signatures ?? [], provenance: v.dist.attestations ?? null, lifecycle: Object.fromEntries(Object.entries(v.scripts ?? {}).filter(([key]) => ['preinstall','install','postinstall','prepare'].includes(key))), scriptsDenied: true });
    }
  }));
  records.sort((a,b) => a.path.localeCompare(b.path));
  mkdirSync(join(root, dirname(evidencePath)), { recursive: true });
  writeFileSync(join(root, evidencePath), JSON.stringify({ observedAt: new Date().toISOString(), clientDate: '2026-10-26', lockSha256: hash(), meaning: 'Official registry metadata and lock integrity comparison; availability of provenance is not signature verification. All lifecycle execution denied; packaged native prebuilds require no script exception.', records }, null, 2) + '\n');
  console.log(`Retained exact registry evidence for ${records.length} locked artifacts`);
}
function verify() {
  const evidence = read(evidencePath);
  assert(evidence.lockSha256 === hash(), 'Registry evidence is stale: recollect after lockfile changes');
  let installed = 0, absentOptional = 0;
  for (const [path, p] of entries) {
    const record = evidence.records.find(record => record.path === path);
    assert(record?.version === p.version && record?.integrity === p.integrity && record?.tarball === p.resolved, `Registry evidence mismatch: ${path}`);
    assert(p.resolved.startsWith('https://registry.npmjs.org/'), `Unexpected registry: ${path}`);
    const manifest = join(root, path, 'package.json');
    if (!existsSync(manifest)) { assert(p.optional, `Missing installed dependency: ${path}`); absentOptional++; continue; }
    const actual = JSON.parse(readFileSync(manifest, 'utf8'));
    assert(actual.name === nameOf(path) && actual.version === p.version, `Installed metadata mismatch: ${path}`);
    installed++;
  }
  console.log(`Installed metadata matches lock: ${installed}; platform-optional absent: ${absentOptional}; registry artifacts: ${entries.length}`);
}
try { if (process.argv[2] === 'collect') await collect(); else if (process.argv[2] === 'verify') verify(); else throw new Error('Use collect (online) or verify (offline)'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
