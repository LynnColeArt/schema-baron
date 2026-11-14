---
status: active
owner: migration-maintainer
updated: 2026-10-27
---

# WP09 migration apply and recovery evidence

Audience: independent implement/review agents evaluating T041–T045. This is observed implementation evidence, not mission acceptance or self-approval.

Environment: assigned lane-i, Node 24.22.1, npm 11.19.1, packaged better-sqlite3 13.0.3, SQLite 3.53.4. Dependencies installed with `npm ci --ignore-scripts --offline`; no lifecycle scripts enabled and no dependencies changed.

## Observed results

- `npm run build`: passed all implemented workspaces, including production Next build and stdio MCP. Generator/UI empty-package notices are inherited and do not count as implemented features.
- `npm run typecheck`: passed implemented workspaces.
- `node scripts/workspace/verify.mjs module packages/sqlite/tests/migrations` and `... module tests/e2e/migrations`: passed strict checking of the new tests as well as source interfaces.
- `SCHEMA_BARON_MIGRATION_EVIDENCE=packages/sqlite/tests/migrations/evidence npm test`: **224 tests / 25 files passed**, 21.90 seconds. The focused migration set contains 27 tests.
- `npx playwright test tests/e2e/migrations/workflow.spec.ts`: **1 passed**, actual production owner/browser, 2.7 seconds test execution. UI-created blank project and inspected/bound SQLite, transport-authored rename/preview/apply, visible history, explicit later-data restore impact, disabled Apply until acknowledgement, Cancel preserves both rows, explicit restore leaves original row and records both backups. No hidden model/JSON edits. Schema editor integration itself belongs to the separately reviewed WP08 lane.
- `npm run lint`: diff-scoped syntax/JSON/whitespace passed. `npm run check:credentials`: heuristic scan passed. `npm run native:verify`: real insert, transaction and online backup passed. `npm audit --offline`: 0 findings from cached metadata; this is not a fresh network advisory audit.

Raw command outputs are in [evidence](evidence/). Passing tests assert independent rows, object SQL, physical PK/index directions, NULL insertion behavior, rowids, foreign-key/integrity checks, history, project revisions, and marker counts. The backfill test requires the exact disclosed acknowledgement and leaves dependent rows unchanged. Wrong purpose/hash, stale project/data, expiry, changed backup, competing writers, forged marker namespace, unauthorized/stale cancellation and conflicting request IDs refuse effects.

## Actual hard exits

`failure-matrix.test.ts` spawns the real Node executable with:

```
node packages/sqlite/tests/migrations/crash-owner.mjs <isolated-temp-root> <point>
```

Points `before-backup`, `after-backup`, `during-rebuild`, `before-db-commit`, `after-db-commit` call `process.exit(86)` in the isolated native worker. The owner waits for actual exit before reading its marker. The injected call occurs respectively before opening the backup, after exact backup validation, after a real reviewed SQL step, immediately before COMMIT, or immediately after COMMIT. They are not caught-JavaScript substitutes for process termination.

Points `before-reconcile` / `after-reconcile` call owner `process.exit(87)` at the named project-finalization boundary. `metadata-save` calls owner `process.exit(88)` after metadata installation while the canonical project-file replacement journal is pending. Separate restore cases `restore-after-db-commit` and `restore-before-reconcile` prove a second committed marker/revision and preservation of both safety backups. No timed sleeps stand in for a transaction boundary.

The eight per-point JSON files retain observed **owner** exit codes, original/unrelated rows, index SQL, checks, revision and journal outcomes. Owner code 0 on worker-fault cases is expected: the worker's hard exit is reconciled by its surviving parent. Before commit: original `title`, row 1, unrelated child row 9, revision 3, rolled-back journal. After commit: `caption`, same rows, revision 4, committed journal, one non-authority marker and identical retry outcome. Restore cases reach revision 5 with original `title` and two committed markers. An external schema addition after committed crash keeps recovery unresolved and blocks new mutations without deleting that evidence or restoring automatically.

The soft postcommit error test separately pins the initial response and exact matching retry as `committed:true,recoveryRequired:true` at the unreconciled source revision; a conflicting payload fails idempotency. Restart finalizes to the successful revision without executing DDL again.

## Persistence and restore strategy

The existing metadata SQLite database holds migration intent/history and provenance, under the existing owner/root/definition leases. The real application transaction writes its durable marker plus resulting schema fingerprint. Parent finalization uses the existing `ProjectStorage.save` journal and canonical operations table. Startup first recovers that file-replacement journal, then compares actual database markers before finalizing migration metadata. No alternate project or baseline persistence exists.

Apply authenticates immutable persisted plan purpose/hash/expiry/acknowledgements. A project lease blocks other model mutations; the isolated worker creates a SQLite online backup, validates its integrity **and exact reviewed source state**, then obtains `BEGIN IMMEDIATE`. It rechecks live schema/data fingerprints and confirms owner revision/model while holding that transaction before executing the exact reviewed SQL. Foreign keys are disabled only on that isolated connection before BEGIN. FK and integrity failures roll back; closing the worker ends those connection-local settings. Cancellation waits for confirmed child exit and reads the marker before claiming rollback or commit.

Restore previews bind the original validated backup's exact fingerprints, current destination fingerprints/revision and explicit later-data loss acknowledgements. Apply first creates another safety backup, attaches the selected backup, and holds destination/attached-source write exclusion in `BEGIN IMMEDIATE`. It fingerprints the exact attached snapshot consumed by the reviewed SQL. Raw backup DDL/rowids/indexes are preserved, destination FK/integrity checks pass, and the restored schema/data must exactly match the reviewed backup before the marker and COMMIT. Tests attempt writes to both destination and attached backup at the pre-DDL handshake and independently observe SQLite lock refusal. No live DB/WAL filesystem copy or generic-error automatic restore occurs. Virtual table restore is explicitly unsupported; unprovable restoration fails transaction validation.

## Necessary shared integration

- `model/src/commands.ts`: additive restore purpose + `schema.restoreApply` and strict history contract; the old contract had no restore apply operation or backup outcome details.
- `core/src/project/index.ts`: production registration, migration lease/recovery guard, pending committed-outcome handling and migration-aware shutdown. Existing async idempotency reservations still precede effects; existing no-worker synchronous lease release remains compatible.
- `storage/src/index.ts`: canonical migration journal/authority methods and successful-migration inspected-baseline provenance, using the same metadata store.
- `sqlite/src/index.ts` / `introspection/index.ts`: export the implemented adapter and inspect an attached backup consistently; internal marker metadata is excluded from business schema fingerprints, while apply verifies its exact schema and owner provenance before adoption.
- `core/src/plans/index.ts`: missing plans return an actionable invalid-input outcome instead of an incidental parse/recovery error.
- `studio/server/service.ts`: shared job cancellation awaits the real migration worker before reporting its state; existing cancellation controllers retain their behavior.
- `studio/workspace/index.tsx`: minimal owned history component entry point. WP08 is coordinated to consume the advertised `schema.apply` capability.
- `apps/mcp/tests/parity.test.ts`: updates the old unavailable-capability expectation because `schema_apply` is now genuinely registered.

Root approved these narrowly necessary integration changes. Ownership globs were not expanded; no unreviewed lane source was merged.

## UI artifacts and limits

See `tests/e2e/migrations/evidence/restore-review-1280x800.png`, `restore-review-1024x600.png`, and `restore-committed.png`. The reduced-height screenshot shows the bounded scroll region and pinned Cancel/Apply controls; no owner credentials appear. Trace recording is disabled during ephemeral owner sign-in.

CUA inventory was checked and provided no existing signed-in browser session. No manual authenticated CUA claim is made; the executed software E2E is the browser proof. Its isolated owner/root/port were removed on completion. There is no persistent server to hand off. This package does not claim final generated-application workflow acceptance, which depends on later packages.
