---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T05:37:09Z'
reviewer_agent: reviewer-renata
wp_id: WP09
---

# WP09 independent review — changes requested

Reviewer: codex / reviewer-renata. Reviewed product source: 0340a599fbbe191817a577bd0a4c6efe45812be5 against approved WP07 dependency 80e4341. Current lane HEAD differs only in coordination artifacts. No product changes were made by this review.

## [P1] Recheck marker namespace ownership under the actual write transaction

Affected: packages/sqlite/src/migrations/worker.ts:72–73,130–145 and state.ts:13–32,60. The authority-aware check runs at worker.ts:40 before the asynchronous online backup. A concurrent external SQLite writer can create a table named __schema_baron_migrations with exactly markerDDL while that backup is running. The transaction's fingerprints(db) only checks its DDL without the required authority; introspection excludes this table from the reviewed schema/data fingerprints. Consequently the stale namespace is accepted, reviewed DDL executes, the marker creation branch is skipped, and INSERT writes the migration into the foreign/user table. The first subsequent authority check happens after COMMIT and fails. This violates FR-010 object preservation and FR-009/FR-029 freshness and creates recovery that restart cannot resolve.

Independent reproduction uses the public ProjectCore commands through the existing fixture: create/inspect/bind; author title→caption; preview; start schema.apply; observe the online-backup file first appearing; a separate SQLite connection creates the matching-DDL reserved table; await apply. No migration fault hook, plan editing, private storage editing, or product patch is involved. 100,000 rows of 500-character values make the async backup window observable; the test polls an actual file boundary, not an assumed sleep boundary. This reproduced three times.

Observed detailed run: before columns [id,title], rows 100000/id range 1–100000; apply returned ok:true, revision:3, committed:true, recoveryRequired:true; after columns [id,caption], rows 100000/id range 1–100000; foreign marker table has 1 migration row and 0 @authority rows. Restart retains revision 3, marks history recovery-pending, and refuses schema.preview with RECOVERY_REQUIRED. Full output: /tmp/wp09-review-renata/namespace-repro-detailed.log. Reproducer: /tmp/wp09-review-renata/reviewer-namespace.test.ts (copy beside existing fixture.ts and run npx vitest run packages/sqlite/tests/migrations/reviewer-namespace.test.ts; remove after use).

Required narrow repair: validate namespace provenance with the owner authority under the SAME BEGIN IMMEDIATE transaction before any reviewed DDL or marker writes. Reject any foreign/user namespace even when its DDL matches. Do not adopt or overwrite it. Cover both apply and restore paths as applicable, including a namespace inserted/replaced by an external writer during backup, with unchanged business data/schema and unchanged foreign marker contents on refusal. Keep existing honest reporting and evidence retention for already committed/unresolved recovery. A schema hash comparison alone cannot fix this because the internal namespace is deliberately excluded.

## Verification and limits

Independent `PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH npx vitest run packages/sqlite/tests/migrations`: 27 passed / 6 files, including real process crashes, restore source/destination locking, cancellation and transport coverage. The additional independent probe fails on object preservation as above. Existing build/typecheck/strict-module/224-test/E2E evidence was inspected; those broader commands were not independently rerun because this demonstrated blocker requires a source correction first. No manual authenticated browser claim is made. No dependency changes. No hosted sync opt-in; no charter gate; upgrade remains canceled.

## Required eight-item checklist

1. Dead code — PASS. Production imports/call sites connect registerSchemaApply from ProjectCore, MigrationWorker via apply/restore preview, state helpers via worker/core, restoreStatements via preview-worker, and MigrationHistory via workspace entry point.
2. Synthetic-fixture test — PASS. Existing tests exercise production core/service/native worker with real SQLite, and subprocess hard exits; preservation assertions query real DB state.
3. Silent empty return — PASS. Missing marker is an intentional absent-record result; guarded catches retain recovery authority/evidence or return explicit RECOVERY_REQUIRED. No additional silent failure found.
4. FR coverage — FAIL. Meaningful existing assertions cover all five refs, but independent concurrent namespace assertion demonstrates FR-010 preservation and freshness are not satisfied for an external writer in the backup window.
5. Frozen surface — N/A. No expressly frozen file identified in these WP/spec/plan contracts; no unrelated product lane source merged.
6. Locked decision — FAIL. The race permits writing a foreign user object and committing a migration after external namespace change despite the preservation/freshness requirements. Restore and apply share this worker boundary.
7. Shared-file ownership — PASS. EVIDENCE.md records one-line integration rationales for model/core/storage/SQLite exports-introspection/owner service/workspace/MCP parity. Root explicitly coordinated these minimal corrections and WP08 consumption; no automatic scope objection.
8. Production fragility — FAIL. A transient external namespace race produces a committed database plus unreconcilable metadata despite ordinary restart; ownership must be checked before mutation under the write lock. Other deliberate fail-loud paths protect freshness, integrity and unresolved recovery.
