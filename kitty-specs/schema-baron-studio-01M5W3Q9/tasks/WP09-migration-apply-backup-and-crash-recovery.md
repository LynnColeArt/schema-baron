---
work_package_id: WP09
title: Migration apply, backup and crash recovery
dependencies:
- WP07
- WP04
requirement_refs:
- FR-009
- FR-010
- FR-029
- NFR-003
- NFR-007
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: 8eabb961bad9cc4c4752fde8e582f07ce66f8eb2
created_at: '2026-10-27T05:08:13.301785+00:00'
subtasks:
- T041
- T042
- T043
- T044
- T045
phase: Workspace and schema
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/sqlite/src/migrations/
create_intent:
- packages/sqlite/src/migrations/index.ts
- packages/sqlite/tests/migrations/behavior.test.ts
- packages/core/src/schema-apply/index.ts
- apps/studio/src/migration-history/index.tsx
- tests/e2e/migrations/workflow.spec.ts
execution_mode: code_change
owned_files:
- packages/sqlite/src/migrations/**
- packages/sqlite/tests/migrations/**
- packages/core/src/schema-apply/**
- apps/studio/src/migration-history/**
- tests/e2e/migrations/**
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the
frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `codex`

# WP09 — Migration apply, backup and crash recovery

## Objective and success criteria

Apply reviewed schema plans with real SQLite transactions/backups, durable outcome
markers and startup reconciliation.

**Independent demonstration**:

Apply a data-preserving rebuild, crash immediately after DB commit, restart and
reconcile one committed migration with unchanged unrelated rows.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-009, FR-010, FR-029, NFR-003, NFR-007.

**Dependencies**: WP07, WP04.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP09 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/sqlite/src/migrations/**`
- `packages/sqlite/tests/migrations/**`
- `packages/core/src/schema-apply/**`
- `apps/studio/src/migration-history/**`
- `tests/e2e/migrations/**`

These are primary ownership boundaries. Keep implementation and verification within them
where possible. A minimal necessary edit to a shared bootstrap manifest, export or
registration file is allowed only with a recorded one-line rationale and coordination
with its owner. Do not add overlapping ownership globs or leave working code
disconnected merely to avoid integration.

Do not modify unrelated doctrine, task status or archived experiments. If an upstream
contract is insufficient, record the concrete mismatch and make a narrowly reviewed
correction; do not work around it with fixture names, hidden model edits or a second
persistence path.

## Subtasks and detailed guidance

### T041 — Implement plan freshness and apply leases

**Implementation**:

1. Authenticate exact plan/hash/acknowledgements and acquire project migration lease
2. Recheck project revision plus schema/data fingerprints under the transaction
3. Refuse expired, stale or already conflicting plans before DDL

**Observable proof**:

Competing writers and external row changes cannot apply a previously reviewed
destructive plan.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T041` completion through the event-sourced CLI after verifying it.

### T042 — Implement backups and rebuild execution

**Implementation**:

1. Create validated backups through SQLite backup API before mutation
2. Follow safe rebuild order with explicit FK settings and dependent objects
3. Run foreign_key_check/integrity_check and commit only validated results

**Observable proof**:

Successful rename/backfill preserves rows, constraints and indexes; a failed check rolls
back every row change.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T042` completion through the event-sourced CLI after verifying it.

### T043 — Journal actual commit state and reconcile

**Implementation**:

1. Write durable migration ID/marker inside the DB transaction
2. Reconcile database marker, project revision and metadata after interruption
3. Make retries idempotent and block new work while recovery is unresolved

**Observable proof**:

Post-commit failure reports committed/recovery-pending honestly and does not duplicate
schema operations.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T043` completion through the event-sourced CLI after verifying it.

### T044 — Expose history and reviewed restore

**Implementation**:

1. Provide migration/backup history and actionable outcomes in Studio/MCP
2. Preview restore impact including any later data before explicit restore apply
3. Never auto-restore on a generic error or erase evidence

**Observable proof**:

The user can inspect and recover without copying live DB/WAL files by hand.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T044` completion through the event-sourced CLI after verifying it.

### T045 — Verify failure matrix and preservation

**Implementation**:

1. Inject failure before backup, during rebuild, before/after DB commit and during
   reconciliation
2. Compare rows, object SQL, indexes, foreign keys and journal entries independently
3. Test cancellation boundaries and repeat apply request IDs

**Observable proof**:

Only expected data changes occur; every failed/retried migration has a coherent durable
outcome.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T045` completion through the event-sourced CLI after verifying it.

## Verification strategy

Tests are required by the confirmed spec and this package includes behavior
verification. Use real SQLite and real generated applications where persistence or
output behavior is claimed. Mock only external ports needed for a focused unit case; do
not replace an end-to-end authoring proof with a prebuilt project fixture.

Run the relevant workspace typecheck/tests plus the package-specific verification above.
Run production output builds when templates or runtime modules change. Repeat broader
checks only when new changes, failures or unresolved integration concerns justify them.
Report unavailable tools or unexecuted cases explicitly.

## Risks and exception behavior

Database commit can succeed before project/history finalization; a retry must not run
DDL twice or restore over later data.

- Preserve unrelated user data, authored source, drafts and secrets.
- Preview/apply must stay tied to the same revision, hash and observed external state.
- An unavailable capability produces actionable diagnostics, never a false success.
- Use server validation and permissions even if UI controls already restrict input.

## Definition of done and reviewer guidance

- The independent demonstration succeeds through the actual product or documented package interface.
- Every included subtask has observed verification and relevant edge-case evidence.
- Review real behavior/data/output effects, not only snapshots or presence of named files.
- Both transport paths use the same implemented operations where this package exposes commands.
- New dependencies obey the pinned lockfile/script policy and have recorded evidence.
- No acceptance-specific table, field or route constants have entered engine behavior.
- Explain any necessary shared-file integration edit and remaining integration dependencies.
- Do not mark later-feature integration cases passed until their prerequisites really exist.

## Review feedback and activity

Check runtime status for the current review feedback reference before claiming completion.
Address every returned finding and append chronological activity notes with observed evidence.
Do not edit a task checkbox or frontmatter lane to manufacture status.
- 2026-10-26T13:35:53Z — codex — Prompt created; implementation and verification not started.

Track subtask completion with:
`spec-kitty agent tasks mark-status <Txxx> --status done --mission schema-baron-studio-01M5W3Q9`.
Use the canonical runtime for WP state transitions and review handoff.
