---
work_package_id: WP24
title: Cross-boundary failure and recovery acceptance
dependencies:
- WP09
- WP20
- WP21
- WP23
requirement_refs:
- FR-010
- FR-025
- FR-026
- FR-029
- NFR-003
- NFR-004
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: 734e15cde4a3e194b374490613977f4ac9a2514d
created_at: '2026-10-27T15:57:00.726021+00:00'
subtasks:
- T116
- T117
- T118
- T119
- T120
phase: Acceptance and readiness
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: tests/integration/recovery-matrix/
create_intent:
- tests/integration/recovery-matrix/behavior.test.ts
- fixtures/recovery/project.json
- docs/evidence/recovery/report.md
execution_mode: code_change
owned_files:
- tests/integration/recovery-matrix/**
- fixtures/recovery/**
- docs/evidence/recovery/**
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

# WP24 — Cross-boundary failure and recovery acceptance

## Objective and success criteria

Validate recovery across actual process crashes, external DB changes, output conflicts
and concurrent requests at subsystem boundaries.

**Independent demonstration**:

Crash isolated test processes at each durable boundary, restart and independently
compare active model, data, output, extensions and recovery journal.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-010, FR-025, FR-026, FR-029, NFR-003, NFR-004.

**Dependencies**: WP09, WP20, WP21, WP23.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP24 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `tests/integration/recovery-matrix/**`
- `fixtures/recovery/**`
- `docs/evidence/recovery/**`

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

### T116 — Build a process-level fault harness

**Implementation**:

1. Launch real service/workers in disposable approved roots
2. Inject deterministic crash signals at save/migration/promotion boundaries
3. Preserve per-run journal and checksums for independent inspection

**Observable proof**:

The harness distinguishes an injected crash from an assertion error and never targets
retained user databases.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T116` completion through the event-sourced CLI after verifying it.

### T117 — Verify project and migration reconciliation

**Implementation**:

1. Exercise save interruption and DB commit before history update
2. Include busy leases, WAL, external schema/data mutation and retry request IDs
3. Independently check migration markers, rows, indexes, constraints and coherent
   revisions

**Observable proof**:

Every outcome is either rolled back, committed/reconciled or explicitly blocked for
recovery, with no double DDL.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T117` completion through the event-sourced CLI after verifying it.

### T118 — Verify generation conflict and promotion recovery

**Implementation**:

1. Interrupt before/after tree swap with authored extension and modified owned-file
   conflicts
2. Verify unknown files and external data/secrets are preserved
3. Restart and compare one complete active tree plus recoverable prior output

**Observable proof**:

No partial source tree is treated as ready and generation never seeds/resets the
database.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T118` completion through the event-sourced CLI after verifying it.

### T119 — Challenge cross-boundary security and cancellation

**Implementation**:

1. Test unsafe path/symlink, forged capabilities, CSRF/return targets and oversized
   inputs
2. Cancel jobs around commit points and verify actual outcome reporting
3. Scan logs/recovery artifacts/client output for transient secrets

**Observable proof**:

Recovery does not introduce an authorization bypass or disguise a completed mutation as
canceled.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T119` completion through the event-sourced CLI after verifying it.

### T120 — Retain recovery and preservation results

**Implementation**:

1. Record failure-point IDs, environment and before/after checksum maps
2. Summarize defect dispositions with links to owning packages
3. Rerun repaired failure cases and mark unrecoverable/unsupported cases honestly

**Observable proof**:

NFR-003 evidence covers actual restarts; a passing happy path alone cannot close this
package.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T120` completion through the event-sourced CLI after verifying it.

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

Unit-level injected exceptions do not prove real restart behavior across database commit
and filesystem promotion.

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
