---
affected_files: []
cycle_number: 2
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T04:53:25Z'
reviewer_agent: codex/reviewer-renata
wp_id: WP07
---

# WP07 review cycle 2 — changes requested

Reviewer: codex / reviewer-renata. Reviewed repair `8aaba8a` over original source `570a5b8`; dependency-aware original base remains WP06 repair `45fb008`. Repair source scope is only planner, primary-key tests and evidence.

## Resolved finding

The exact original probe was rerun unchanged (SHA-256 `6830a90e6ed5601594e0256d4599892a12a56fe45cdff922cda17edaddc1caec`). Both original independent-key cases now retain rowid 50/key 7 and reject NULL keys; the native rename control retains rowid/key 7 and NULL auto-allocation. Results: `/tmp/wp07-cycle2-original-review.jsonl`. The former row-loss/NULL-behavior defect is resolved.

## P2 — preserve every unchanged primary-key index direction or block the rebuild

Affected production code: `packages/sqlite/src/schema-plans/index.ts`, `rebuildLayout` and `createTable` (approximately lines 40–73). The layout retains the descending direction only for the single exact `INTEGER PRIMARY KEY DESC` rowid exception. Other descending primary-key indexes are silently emitted as ascending.

Independent public-command reproduction:

1. Seed an external disposable database with `CREATE TABLE t(k INTEGER NOT NULL,v TEXT NOT NULL,PRIMARY KEY(k DESC,v ASC)); INSERT INTO t(rowid,k,v) VALUES(50,7,'kept');`.
2. Create project, `connection.inspect`, `connection.bind`, then `project.batch` to add only one nullable text column `added`.
3. `schema.preview` succeeds with only `Add column added` change/impact and no required acknowledgements.
4. Execute the exact plan SQL on a separate identically seeded database. Source remains unchanged. Actual result table SQL is `CREATE TABLE "t" ("k" INTEGER NOT NULL, "v" TEXT NOT NULL, "added" TEXT, PRIMARY KEY ("k", "v"))`.
5. Actual `pragma_index_xinfo` on the PK index changes the key parts from `(k,desc=1,BINARY),(v,desc=0,BINARY)` to `(k,desc=0,BINARY),(v,desc=0,BINARY)`. Rowid 50 and values ARE preserved; this finding does not allege the former data loss.
6. `EXPLAIN QUERY PLAN SELECT k,v FROM t ORDER BY k DESC,v ASC` originally uses the covering PK index; after the reviewed rebuild it additionally reports `USE TEMP B-TREE FOR LAST TERM OF ORDER BY`. This is an observed changed physical index and execution behavior, not a SQL-string-only comparison.

Also reproduced for `CREATE TABLE t(k INT NOT NULL PRIMARY KEY DESC,v TEXT)` and `CREATE TABLE t(k INT NOT NULL,v TEXT,PRIMARY KEY(k DESC))`: add-column preview succeeds but actual PK `desc` flips 1 -> 0. No key/index change was requested or disclosed.

This violates T032's preservation/fail-closed boundary and FR-010's unaffected-object preservation. Preserve the observed direction of every unchanged primary-key part when compiling the rebuild, or explicitly reject layouts the compiler cannot preserve with actionable `UNSUPPORTED_SCHEMA_OBJECT`. No requirement to add descending-key authoring UI or generalize beyond this preservation boundary. Do not silently normalize imported key indexes or hide the normalization behind generic acknowledgements. Add public-command regressions for the independent INT and mixed-direction composite cases; execute allowed SQL on a separate DB and assert actual index metadata and row identities, or assert a blocked plan plus unchanged source.

Reproduction: `/tmp/wp07-cycle2-review/variations.mjs`; complete plans, actual SQL, row/column/index metadata and query plans: `/tmp/wp07-cycle2-review/variations.jsonl`.
Command: `PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH node /tmp/wp07-cycle2-review/variations.mjs`.

## Verification and limits

- `npm test -- packages/sqlite/tests/schema-plans`: PASS, 3 files / 32 cases.
- `npm run typecheck`: PASS for implemented workspaces; generator/UI explicitly NOT IMPLEMENTED at this dependency stage.
- Strict standalone `tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2023 --module NodeNext --moduleResolution NodeNext --noEmit --skipLibCheck` on all three planning test files: PASS.
- `git diff --check`: PASS.
- Eight independent syntax/metadata variations: quoted INTEGER alias, quoted INTEGER DESC independent key, lowercase/named INT key and shadowed-rowid cases preserve inspected state; WITHOUT ROWID blocks correctly; three descending-key cases expose the residual issue above.
- Source workers remain pinned read-only; independent SQL execution used only a second disposable DB. No production apply/restore or UI claim is made. Full build/native/audit results remain implementer evidence; scoped checks above were rerun independently.
- Shared integration rationale/coordination from cycle 1 remains valid; repair adds no shared edits or dependency changes.

## Eight-item review checklist

1. Dead code: PASS — rebuildLayout is called by the real planner; existing worker/registry/storage caller checks remain live.
2. Synthetic-fixture tests: PASS — tests invoke public commands and real SQLite, including executing plans on separate DBs.
3. Silent empty return: PASS — no new unexplained empty/failure suppression; support failures return structured diagnostics.
4. FR coverage: PASS — behavioral assertions cover listed requirements; residual defect is independently demonstrated despite passing coverage.
5. Frozen surface: N/A — no marked frozen file changed.
6. Locked decision: FAIL — unsupported physical PK-index directions silently normalize instead of preserving or blocking unchanged semantics.
7. Shared-file ownership: PASS — original documented shared-file rationale and WP15 coordination remain applicable; repair itself touches only owned files.
8. Production fragility: PASS — new fail-loud paths have explicit physical-semantics safety rationale; no unexplained race crash identified.

Verdict: changes requested for the narrow P2 index-preservation correction. Reviewer made no product edits and no other-WP state changes.
