---
mission: schema-baron-studio-01M5W3Q9
work_package: WP07
status: verified-for-independent-review
---

# Schema planning evidence and handoff

The audience is the independent WP07 reviewer and the WP08/WP09 implementers. The
production operation is `schema.preview` on the existing `ProjectCore` registry;
HTTP and MCP use that same handler. It records a reviewed migration plan and never
runs its migration DDL. Apply, backups, restore execution and schema UI are later
work packages and are not claimed here.

## Observed behavior

- T031: the inspected logical baseline keeps table/column IDs separately from the
  desired schema. Rename/add/drop/type/key/index/foreign-key/constraint changes
  are disclosed. A target rename includes incoming foreign-key SQL repairs.
  Canonical candidate validation rejects orphan consumers; a coordinated
  `project.batch` that repairs/removes the consumer succeeds.
- T032: identifiers and literal defaults are quoted; CHECK/default/backfill nodes
  use the constrained model AST. Native isolated renames use the actual SQLite
  version; coordinated changes stage replacement tables, copy data, drop old
  tables and rename replacements. Rebuilds preserve accessible implicit rowids.
  Generated/virtual/opaque table transformations and trigger/view dependencies
  fail closed. Untouched opaque table SQL and rows remain exact.
- T033: one child-process read transaction observes schema plus all row data.
  Fingerprints retain 64-bit integers, blobs, duplicate rows and accessible
  rowids. Projected values are checked for logical type/nullability, unique and
  primary keys, CHECKs and composite foreign keys. Backfills are typed using the
  public canonical model validator and then checked against actual projected
  rows. Integer overflow and implicit SQLite coercion are rejected. Backfill and
  destructive impacts disclose row counts and require exact acknowledgements.
- T034: plans use `PlanRepository` for immutable persistence, content hash, source
  revision/model hash, schema/data fingerprints and five-minute expiry. The plan
  includes readable SQL, changes, exact acknowledgement IDs, approved backup root,
  online-backup policy and recovery/restore-review instructions. Imported JSON
  cannot attest its own baseline: existing durable real inspection outcomes must
  match project, intended connection ID, locator, fingerprint, physical snapshot,
  capabilities and logical baseline. Otherwise inspect/bind is required. A real
  restart and relocation retain legitimate inspection provenance and stable IDs.
- T035: disposable real SQLite databases are seeded as external databases, then
  inspected/bound/edited through production commands. Tests execute reviewed SQL
  on a different disposable database and assert rows, rowids, actual FK/index
  metadata, constraint failures and integrity. Source rows/schema are separately
  checked unchanged. Actual authenticated HTTP and stdio MCP return identical
  plans and stale failures. Native source workers and compiled workers both run;
  timeout waits for worker exit before returning.

## Verification commands

Use Node 24.22.1/npm 11.19.1 via
`PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH`.

- `npm run verify`: native ABI/backup smoke, all workspace strict source checks,
  diff-scoped lint, production builds including Next, credential-pattern scan,
  complete Vitest suite and offline dependency-evidence verification.
- `node node_modules/typescript/bin/tsc --strict --noUncheckedIndexedAccess
  --exactOptionalPropertyTypes --target ES2023 --module NodeNext
  --moduleResolution NodeNext --noEmit --skipLibCheck
  packages/sqlite/tests/schema-plans/behavior.test.ts
  packages/sqlite/tests/schema-plans/transport.test.ts`: strict test-source check.
- `npm audit --ignore-scripts --json`: zero reported vulnerabilities at this run.
- `git diff --check`: no whitespace errors.

The committed tests are the fixtures' source of truth; no prebuilt project JSON
substitutes for the public authoring/transport proof. Runtime databases, owner
metadata, ports and MCP configuration are isolated temporary resources and are
removed after each test.

Observed final results: `npm run verify` passed all 18 Vitest files / 177 tests,
including 23 schema-planning cases, with the native SQLite 3.53.4 smoke and the
production Next build passing. The strict test-source command and diff lint
passed. The generator and shared UI packages explicitly report NOT IMPLEMENTED
at this dependency stage; this is not a claim of later mission completion. No
manual schema UI or actual production apply/restore was run in WP07.

## Necessary shared edits

- Model connection baseline/provenance fields: names alone cannot prove stable-ID
  rename intent, and portable JSON must not forge an owner inspection.
- Storage `hasInspectedConnection`: queries existing immutable inspection outcomes
  rather than introducing a second baseline persistence path.
- Core connection/preview registration and lifecycle: preview must be reachable
  through both real transports, preserve shutdown behavior and propagate linked
  diagnostics; arbitrary connection snapshot replacement via batch is refused.
- Reviewed migration optional changes/recovery fields: retain backward-compatible
  plan parsing while disclosing executor prerequisites.
- SQLite adapter/worker dispatch and public input/result types: keep planning and
  row scans in the existing interruptible isolated child, with one read snapshot.
- SQLite manifest/lock and registry evidence: add only the local sqlite-to-model
  workspace edge. All 258 external package entries compare exactly to the base;
  all 258 registry evidence records and their observation date remain unchanged.
  Only lockSha256 changes to
  `0c63551491f8eb7d1d819e68d558d86139a3d4fa26e68a8a0166bdcbb41b226a`.
  This is not a fresh registry provenance or freshness claim. Lifecycle scripts
  remained denied; no external version or native artifact changed.

Shared worker/core changes were coordinated with WP15. Integration must union the
additive schema-preview and query-preview dispatch/registration/cleanup changes.

## Support boundaries for the next work packages

The core still supports one bound schema connection. Unknown trigger/view
semantics conservatively block schema transformations. Opaque table/index SQL is
retained when untouched. Decimal literals/backfills preserve declared text or
scaled-integer encoding, precision and scale; decimal arithmetic/comparisons/abs
in schema expressions are refused until the exact-decimal compiler is integrated.
Generated/virtual authoring remains unsupported. No unsupported object is silently
approximated.

WP09 must acquire its real lease/write transaction, recheck both fingerprints and
plan freshness, perform/verify online backup, disable FK enforcement before a
rebuild transaction, execute the exact steps, reject failed `foreign_key_check`
and `integrity_check`, journal/mark the actual durable outcome and restore original
connection settings. Restore needs a new reviewed plan. After a successful apply,
refresh the actual inspection/baseline through the canonical connection path;
never treat a client-supplied desired schema as proof of an observed database.
The planner's projected checks do not substitute for transaction-time checks.

## Review cycle 1 — physical primary-key preservation repair

The independent rejection event `01M5XTH5WZASQPJ297FVZBMG13` identified a real
preservation defect in source `570a5b8`: logical integer type was incorrectly used
as proof of an SQLite rowid alias. The original reviewer files remain unchanged:

- `/tmp/wp07-independent-review/probe.mjs`, SHA-256
  `6830a90e6ed5601594e0256d4599892a12a56fe45cdff922cda17edaddc1caec`.
- `/tmp/wp07-independent-review/results.jsonl`, SHA-256
  `4b743a4308cf892695a9812c10745568869cb2251033bbe39dbc4ff1b587e50e`.

The exact original command was rerun without modifying the probe. Fresh results
were written separately to `/tmp/wp07-cycle1-before.jsonl` and
`/tmp/wp07-cycle1-after.jsonl`. For both `INT NOT NULL PRIMARY KEY` and inline
`INTEGER PRIMARY KEY DESC NOT NULL`, the original plan changed rowid 50 to 7 and
made NULL insertion succeed. The repaired plans retain rowid 50/key 7 and reject
NULL insertion with the original NOT NULL failure. The native rename control
retains rowid/key 7 and its original NULL auto-allocation behavior.

The compiler now takes retained type declarations, observed NOT NULL flags and
physical PK-index metadata from the actual pinned inspection. `INT` remains
`INT`; the independent inline `INTEGER PRIMARY KEY DESC` exception remains an
inline descending key. It copies an independent rowid explicitly. It does not add
NOT NULL to an unchanged true alias whose physical flag was zero. When an alias
is explicitly converted away, the desired non-null constraint is emitted rather
than incorrectly carrying forward the former implicit constraint. Creating a new
alias over an existing independent identity or replacing aliased identities by a
backfill is blocked with an actionable unsupported diagnostic. No generic
acknowledgement is used to conceal identity changes.

Nine new public-command tests cover the two exact heldouts, table-level INT,
ordinary INTEGER aliases, table-level INTEGER DESC (which remains an alias),
composite rowid keys, explicit conversion away from an alias, unsafe new-alias
refusal, and composite WITHOUT ROWID refusal. Supported plans execute unchanged
on a separately seeded SQLite database and compare rows/rowids, column PRAGMAs,
PK index direction/collation, NULL behavior and integrity; preview leaves the
source schema/rows unchanged. WITHOUT ROWID remains an opaque unsupported rebuild
boundary: no plan or DDL is authorized, and its original no-rowid/non-null behavior
is asserted unchanged. This is not a claim of WITHOUT ROWID authoring support.

Before production repair the first eight tests yielded five failures and three
passes (`/tmp/wp07-cycle1-red-tests.log`). After repair all nine pass as part of
`npm run verify`: 19 files / 186 tests passed, along with production Next build,
workspace source checks, native SQLite 3.53.4 smoke, credential-pattern scan and
all existing dependency evidence. The strict standalone TypeScript command above
also included `packages/sqlite/tests/schema-plans/primary-key-semantics.test.ts`
and passed. Fresh npm audit reports zero vulnerabilities; diff-scoped lint passes.
Only the owned planner, new tests and this evidence changed in the repair. No
shared registration, dependency, runtime upgrade, hosted sync, UI or apply changes
were made.
