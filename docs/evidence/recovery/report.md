# Cross-boundary recovery acceptance — WP24

Observed on 2026-10-27, Linux x64, Node v24.22.1, npm 11.19.1. Baseline: `85458603eab99bac192983e18bc7713f947e5e62` (includes WP23). No production files or dependencies changed. Exact commands are retained in [commands.txt](commands.txt), with [environment metadata](environment.json). The authoritative acceptance surface is `tests/integration/recovery-matrix/`.

The owned suite authors a blank project through ordinary `ProjectCore` operations, binds an independently supplied WAL SQLite database, constructs a Grid and authored validator contract, and generates a real application source tree. SQL supplies application data only. Every test root is created with `mkdtemp` under `/tmp/baron-cross-boundary-*`; the child refuses other roots. Harness roots are removed after completion. Existing study roots and the old repository are untouched.

## Observed verification

| Check | Result | Retained record |
|---|---|---|
| Pinned offline install, lifecycle scripts disabled | Passed; 0 audited vulnerabilities | [install.log](install.log) |
| Workspace production builds | Passed; Studio production build included | [build.log](build.log) |
| Owned cross-boundary suite | 14 tests passed | [recovery-matrix.log](recovery-matrix.log) |
| Existing recovery/security suites | 50 tests passed in 8 files | [package-regressions.log](package-regressions.log) |
| Real generated application auth/return/secrets | 1 production integration test passed | [generated-auth.log](generated-auth.log), [direct observations](generated-auth-observations.json) |
| Final external-after-commit rejection assertion | 1 targeted test passed after the full matrix; 9 unrelated cases intentionally filtered | [blocked-mutation.log](blocked-mutation.log) |
| Credential scanner | Passed | [credentials.log](credentials.log) |
| Strict acceptance TypeScript | Passed | [strict-acceptance.log](strict-acceptance.log) |
| Workspace typecheck | Passed; empty `@schema-baron/ui` explicitly reports NOT IMPLEMENTED | [typecheck.log](typecheck.log) |
| Baseline-relative syntax/JSON/whitespace lint | Passed | [lint.log](lint.log) |

Reproduce on Linux with Node 24.22.1 and `strace` on PATH (the latter independently observes worker exits without tracing data):

```sh
npm ci --ignore-scripts --offline
npm run build
npx vitest run tests/integration/recovery-matrix
node scripts/workspace/verify.mjs module tests/integration/recovery-matrix
npm run typecheck
SCHEMA_BARON_LINT_BASE=85458603eab99bac192983e18bc7713f947e5e62 npm run lint
```

Set `SCHEMA_BARON_RECOVERY_EVIDENCE` to an alternate directory for a fresh evidence run. Evidence is atomically flushed before each scenario and after each observed boundary; failed assertions retain a failure record and do not become successful injections. Child exit status, signal, stderr and timeout are checked independently. Owner exits 73/87/88/91 are distinct from an assertion exit. Worker fault cases independently assert exit 86 in retained `worker-*.trace` process-only strace records; the surviving owner reports/reconciles its durable outcome. The inherited migration matrix separately retains the worker-boundary observations in [migrations/](migrations/).

## T116–T118: save, database and source promotion

Nine complete sequences combine save interruption, migration interruption and source promotion interruption. They are sequences rather than a Cartesian product; no claim is made that every combination ran.

| Evidence | Save exit point | Migration exit point | Source promotion exit point |
|---|---|---|---|
| [boundary-0](boundary-0.json) | intent | before-backup | stage-complete |
| [boundary-1](boundary-1.json) | metadata | after-backup | before-journal-write |
| [boundary-2](boundary-2.json) | replacement | during-rebuild | after-journal-write |
| [boundary-3](boundary-3.json) | cleanup | before-db-commit | before-old-rename |
| [boundary-4](boundary-4.json) | intent | after-db-commit | after-old-rename |
| [boundary-5](boundary-5.json) | metadata | before-reconcile | before-new-rename |
| [boundary-6](boundary-6.json) | replacement | after-reconcile | after-new-rename |
| [boundary-7](boundary-7.json) | cleanup | metadata-save | before-journal-clear |
| [boundary-8](boundary-8.json) | intent | before-reconcile | after-journal-clear |

Each new owner process independently reopens production storage. The parent oracle reads JSON definitions and metadata SQLite directly, checks coherent snapshots and an empty save journal after recovery, and checks the interrupted journal had one intent before reopening. Retried save commands preserve the original committed result.

The application database oracle checks exact affected and unrelated rows, WAL mode, named index SQL, the preserved CHECK constraint on the unrelated child table, foreign key definitions, actual FK/CHECK/NOT NULL rejection probes, `foreign_key_check` and `integrity_check`. Validated backups are independently opened and checked against original parent/child rows, integrity and FK results; their SHA-256 is retained. Committed retries retain one migration marker excluding its authority row. Precommit crashes roll back; generation correctly refuses the still-unapplied desired schema with `DATABASE_CHANGED`, followed by a fresh explicitly reviewed migration before the source-promotion experiment.

Source observations retain complete before/after path-to-SHA-256 maps. Before the promotion journal is durable, the complete old tree remains active; no uncommitted generation retry is silently used to change that observation. After journal durability, canonical preview recovery finishes the complete new tree and the entire prior tree matches the retained backup map. The authored validator bytes, external database checksum and a separate external secret-file checksum survive. A second new process observes the identical project and complete active tree. No generated runtime or build is claimed for each interrupted tree; source completeness is the assertion here. The separately executed production auth application supplies runtime verification.

[external-after-crash.json](external-after-crash.json) adds external schema/data after DB commit but before owner reconciliation. Reopening reports `recovery-pending`; retry reports the true committed/recovery-required state and both changed and unrelated rows survive.

## T119: concurrency, cancellation and security

[external-wal.json](external-wal.json) records a real WAL write lock preventing apply, external row changes invalidating the reviewed data fingerprint, and external DDL invalidating a later reviewed schema fingerprint. External rows survive without an overwritten table.

[cancel-before-ddl.json](cancel-before-ddl.json) cancels the actual running migration worker through the registered public cancellation operation. It reports `canceled`, `committed:false`, and the apply reports `CANCELED`; original rows remain. [cancel-before-reconcile.json](cancel-before-reconcile.json) requests cancellation after the worker has durably committed. The concurrent revision advance causes an honest `REVISION_CONFLICT`; a current-revision cancellation retry reports `succeeded`, `committed:true`, and independently queried renamed-column rows prove the commit. Both boundaries also reject a concurrent model mutation as `PROJECT_BUSY` and an intruder as `ACCESS_DENIED`. No synthetic `recordJob` is used for these proofs.

[security-conflicts.json](security-conflicts.json) exercises actual HTTP forged capability, cross-origin request, browser session without CSRF, oversized input, traversal and symlink export requests. Modified owned files, unknown files and an output symlink block generation and preserve authored/unknown bytes. Invalid transient password input is absent from response, project and metadata files; the owner capability is absent from metadata too. This invalid-input test is not counted as a generated login return-target proof. The production generated-auth suite separately checks external/undeclared/duplicate return targets, protected reads/writes, CSRF, retained typed context, session lifecycle and secret absence in generated source/client output.

## T120: dispositions and limits

No production repair was required by this package. The initial fixture attempted a rename involving an opaque CHECK constraint: SQLite planning correctly refused with `UNSUPPORTED_SCHEMA_OBJECT` rather than guessing how to rewrite it. The supported migration case therefore keeps CHECK on the unchanged related table and independently verifies its preservation. Opaque constraint rewriting remains unsupported and is not claimed as passing coverage. The initial harness also replayed a rolled-back crash request before observing rollback; that observer error was corrected so rollback is inspected first, then the desired migration is reviewed afresh. Neither adjustment masks a product failure.

Existing package regression coverage additionally exercises altered promotion backup refusal, migration restore interruption, namespace-marker forgery, restore boundaries, owner paths and browser transport semantics. The owned combined cases provide the cross-boundary proof; those package passes alone are not treated as completing WP24.

No hosted authentication or charter was created. No dependencies were upgraded and no lifecycle scripts were enabled. The Python `tests.architectural` suite is unavailable in this TypeScript workspace and is **no_coverage / unverified**, not passed. WP25 owns visual/performance acceptance and WP26 owns final release/readiness aggregation; this report does not claim those gates are complete.
