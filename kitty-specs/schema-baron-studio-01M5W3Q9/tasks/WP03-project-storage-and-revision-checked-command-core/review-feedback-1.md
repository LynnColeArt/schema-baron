# WP03 review — changes requested

Reviewer: codex / reviewer-renata. Source: `9bd5c0d`. Review compares the generated mission-base diff while attributing only the WP03 source commit (`9bd5c0d^..9bd5c0d`); inherited approved WP01/WP02 are dependencies, not new WP03 scope. The callable exported core/storage package is the current live boundary. No HTTP/MCP/UI or generated-application implementation is required here.

## P1 — Overlapping definition roots bypass the writer lease and lose successful edits

Location: `packages/storage/src/index.ts:39–42`.

Each configured root has a different `.schema-baron-writer.sqlite`. The supported root-relative open API lets two stores with distinct metadata roots reach the same definition through a parent root and a child root. Both constructors successfully acquire leases, although their writable file scopes overlap. The snapshot hash check cannot repair this because it runs before intent/metadata/file replacement.

Independent reproduction, using the built public `@schema-baron/core` package:

1. Create a real revision-1 `p.json` in `defs/nested` with a temporary seed store, then close it.
2. Open store A with root `defs`, metadata `metaA`, and open locator `projects:nested/p.json`. Open store B with root `defs/nested`, metadata `metaB`, and locator `projects:p.json`. Both opens succeed.
3. Execute a batch adding page `first` in A. At A's supplied `fault('metadata')` scheduling boundary, execute B's batch adding page `second`, both using expected revision 1 and distinct request IDs. The hook only schedules B; it does not throw or modify files directly. This models a second process running while A is between metadata commit and atomic replacement.
4. Both commands return `{ok:true, revision:2}`. Independently read the JSON: its only page is `first`; B's committed `second` is lost. B's snapshot subsequently throws `REVISION_CONFLICT`. Each store has recorded its own successful operation at revision 2.

Observed exact results: A write `ok:true/revision:2/changedIds:[first]`; B write `ok:true/revision:2/changedIds:[second]`; final file pages `[first]`.

Fix the exclusion boundary so every store capable of writing the same physical definition shares a lease (including ancestor/descendant root aliases and external locators). Root mappings are valid trusted configuration in this reproduction and never change during store lifetime; do not rely on the host silently avoiding overlap. Add a public API regression with independent file/metadata assertions. This blocks T011/T012 and FR-029/NFR-003/NFR-007 preservation.

## P1 — SQLite metadata child symlinks escape the approved metadata root

Location: `packages/storage/src/index.ts:36,44`.

Only the metadata directory itself goes through `safePath`; `writer.sqlite` and `metadata.sqlite` are passed directly to SQLite using `join`. A pre-existing symbolic link at either child bypasses the documented symlink rejection. This does not require concurrent directory changes or an untrusted process during execution.

Independent reproduction: make a real outside SQLite database containing a `sentinel` table; make `metadataRoot/metadata.sqlite` a symlink to it; construct and close the public `ProjectCore` with ordinary separate approved roots. Construction succeeds. A separate read-only SQLite connection to the outside database sees newly created `projects`, `journal`, `operations`, `events`, `plans`, and `jobs` tables alongside `sentinel`; an independent byte comparison confirms the outside file changed. It also has its format/journal pragmas changed. No project command was required.

Validate metadata database/lease child paths before SQLite can follow them, and cover SQLite-created companion files as appropriate. Refuse with a path diagnostic while preserving independent outside checksums/tables. Add regression coverage for metadata and writer symlinks, including pre-existing links. This blocks T011's explicit requirement to reject symlink escapes and preserve outside files.

## Verification and scoped coverage

`PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH npm run verify` passed: native SQLite smoke, relevant typecheck/build, credential/dependency checks and all 90 tests (16 WP03). Later unimplemented packages are honestly reported. Existing four subprocess hard-exit/restart tests exercise production exported core, real SQLite, and independent file/SQL oracles; coherent roll-forward and exact retry work under the tested single-root topology. No upgrade, install, hosted opt-in, or product fix was performed.

Reviewed tests/code cover ordinary create/list/open/switch/export/reopen, invalid whole-model batches, stale/idempotency conflicts, newer-format refusal, exact-root lease exclusion across distinct metadata stores, definition traversal/symlink rejection, owner denial, root reconnection, immutable plan hash/source/expiry/fingerprint/acknowledgement checks, event sequencing/replay/project isolation and persistent jobs. The two independently reproduced cases above remain untested boundary violations.

## Required anti-pattern checklist

1. **Dead code — PASS.** Core root export connects project/command/plan/event surfaces; project imports and instantiates registry/plans/storage, registry handlers invoke batch/storage, plans invoke model validation/storage. The callable package API is the staged production boundary; event interface is exported type support. Later adapter callers are WP04 scope.
2. **Synthetic-fixture test — PASS.** WP03 assertions invoke production core/storage and inspect real files/SQLite; crash cases import the built package in native subprocesses. Model fixtures supply inputs rather than precomputed outcomes.
3. **Silent empty return — PASS.** Empty diagnostics/collections and optional missing job/operation lookups represent documented outcomes. Recovery exceptions block writes; rejected persistence is surfaced as RECOVERY_REQUIRED rather than success.
4. **FR coverage — FAIL.** Scoped model/revision/plan/lifecycle behaviors have real assertions, but T011's full path/exclusion and FR-029/NFR-003/NFR-007 preservation claims fail the independent overlap and metadata-symlink cases. Later UI continuity and generation preview remain unclaimed integration scope.
5. **Frozen surface — PASS.** WP03 source commit does not alter the approved model implementation or frozen/reference artifacts.
6. **Locked decision — FAIL.** Two live writers can overwrite a successfully committed edit, and initialization can mutate a database outside its metadata root, contradicting scoped no-partial-persistence/preservation and approved-path constraints.
7. **Shared-file ownership — PASS.** Minimal manifests, build configs, lock workspace edges, core export and evidence refresh are documented in README/EVIDENCE and implementation handoff; they connect owned modules. The lock reuses existing exact dependencies and registry artifacts remain unchanged.
8. **Production fragility — PASS.** Fail-loud conditions enforce ownership, semantic validity, revision/hash/freshness, lease contention and recovery. Registry invariant throws are guarded by parsed discriminants and handler registration. No unsupported later handler is claimed as available.

Verdict: **REJECT**. Preserve the working single-root recovery/plan behavior while closing both storage boundary gaps. WP04 depends on this package and should consume/rebase only after the corrected WP03 review passes.

## Exact disposable-data regression probes

Run from the lane root after the model, storage and core builds. Each probe uses only the public built package, temporary SQLite/files, and Node assertions. These currently reproduce the defects. After correction, the overlap must be refused before the second writer can mutate the shared file; the symlink constructor must refuse before touching the outside file.

```sh
PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { ProjectCore } from '@schema-baron/core';
import Database from 'better-sqlite3';
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const root = mkdtempSync(join(tmpdir(), 'wp03-review-'));
const defs = join(root, 'defs'); const nested = join(defs, 'nested');
mkdirSync(nested, { recursive: true });
const base = { ownerId: 'o', metadataRoot: join(root, 'seed'), approvedRoots: { projects: nested } };
const edit = id => ({ requestId: id, projectId: 'p', operation: 'project.batch', expectedRevision: 1,
 input: { operations: [{ kind: 'put', entity: 'page', id, value: { id, route: `/${id}`, title: id, formIds: [], document: [] } }] } });
let seed = new ProjectCore(base);
assert.equal(seed.execute('o', { requestId: 'create', projectId: 'p', operation: 'project.create', expectedRevision: 0,
 input: { name: 'P', approvedRoot: 'projects', target: 'next-typescript-sqlite' } }).ok, true);
seed.close();
let second, secondResult;
const first = new ProjectCore({ ...base, metadataRoot: join(root, 'first'), approvedRoots: { projects: defs },
 fault: stage => { if (stage === 'metadata') secondResult = second.execute('o', edit('second')); } });
second = new ProjectCore({ ...base, metadataRoot: join(root, 'second') });
const open = (core, locator) => core.execute('o', { requestId: 'open', projectId: 'p', operation: 'project.open', expectedRevision: 1, input: { locator } });
assert.equal(open(first, 'projects:nested/p.json').ok, true);
assert.equal(open(second, 'projects:p.json').ok, true);
const firstResult = first.execute('o', edit('first'));
assert.equal(firstResult.ok, true); assert.equal(secondResult.ok, true);
const final = JSON.parse(readFileSync(join(nested, 'p.json'), 'utf8'));
assert.deepEqual(final.pages.map(p => p.id), ['first']);
console.log('REPRODUCED: both stores acknowledge revision 2, final file loses second');
// Required invariant: two conflicting writes from revision 1 must never both succeed.
// A successful command must not lose its acknowledged edit to another revision-1 write.
first.close(); second.close();

const metadata = join(root, 'linked-meta'); mkdirSync(metadata);
const outside = join(root, 'outside.sqlite');
const db = new Database(outside); db.exec("CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES('keep')"); db.close();
const before = readFileSync(outside);
symlinkSync(outside, join(metadata, 'metadata.sqlite'));
const linked = new ProjectCore({ ...base, metadataRoot: metadata }); linked.close();
const oracle = new Database(outside, { readonly: true });
assert.equal(oracle.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('projects','journal','operations','events','plans','jobs')").get().n, 6);
assert.equal(before.equals(readFileSync(outside)), false);
oracle.close();
console.log('REPRODUCED: constructor follows metadata symlink and creates six tables outside root');
// Required invariant: constructor rejects PATH_OUTSIDE_ROOT, before == after bytes,
// and only the original sentinel table exists in the independent outside SQLite oracle.
rmSync(root, { recursive: true, force: true });
JS
```
