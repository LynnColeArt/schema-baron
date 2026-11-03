---
work_package_id: WP03
title: Project storage and revision-checked command core
dependencies:
- WP02
requirement_refs:
- C-003
- FR-001
- FR-005
- FR-025
- FR-029
- NFR-003
- NFR-007
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: daa98cc357f4ae716c6b0407a231b7d34ba3f0a1
created_at: '2026-10-27T01:33:46.587552+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
phase: Foundation
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/storage/src/
create_intent:
- packages/storage/src/index.ts
- packages/storage/tests/index.ts
- packages/core/src/project/index.ts
- packages/core/src/commands/index.ts
- packages/core/src/plans/index.ts
- packages/core/src/events/index.ts
- packages/core/tests/project/behavior.test.ts
- packages/core/tests/commands/behavior.test.ts
execution_mode: code_change
owned_files:
- packages/storage/src/**
- packages/storage/tests/**
- packages/core/src/project/**
- packages/core/src/commands/**
- packages/core/src/plans/**
- packages/core/src/events/**
- packages/core/tests/project/**
- packages/core/tests/commands/**
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

# WP03 — Project storage and revision-checked command core

## Objective and success criteria

Persist readable project definitions safely, provide the shared command registry and
reject stale or partially valid writes.

**Independent demonstration**:

Create, batch-edit, save and reopen a project; retry a request; then inject a crash
between metadata and file replacement and recover one coherent revision.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-001, FR-005, FR-025, FR-029, NFR-003, NFR-007, C-003.

**Dependencies**: WP02.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP03 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/storage/src/**`
- `packages/storage/tests/**`
- `packages/core/src/project/**`
- `packages/core/src/commands/**`
- `packages/core/src/plans/**`
- `packages/core/src/events/**`
- `packages/core/tests/project/**`
- `packages/core/tests/commands/**`

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

### T011 — Implement owner-scoped storage and locking

**Implementation**:

1. Resolve approved roots and reject traversal or symlink escape
2. Store readable project JSON separately from metadata, application data, secrets and
   output
3. Acquire one writer lease and refuse unsupported format overwrites

**Observable proof**:

Traversal and competing-writer tests cannot alter files outside approved roots.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T011` completion through the event-sourced CLI after verifying it.

### T012 — Implement revisioned command execution

**Implementation**:

1. Register operation-specific validators/handlers with no transport dependency
2. Apply entity batches against a validated candidate snapshot and increment revision
   once
3. Hash idempotent payloads and distinguish same-request retries from payload conflicts

**Observable proof**:

Invalid batch and stale revision leave all entities unchanged; identical retries return
the original result.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T012` completion through the event-sourced CLI after verifying it.

### T013 — Implement save journal and recovery

**Implementation**:

1. Journal intent before metadata/file changes and use same-filesystem atomic
   replacement
2. Record enough before/after identity to reconcile interrupted saves
3. Reconcile at startup before releasing the project for mutations

**Observable proof**:

Failure at each journal boundary results in exactly one valid old or new revision and an
honest recovery outcome.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T013` completion through the event-sourced CLI after verifying it.

### T014 — Publish revisions and immutable plan records

**Implementation**:

1. Persist sequenced revision/diagnostic events and bounded replay
2. Store immutable reviewed plans with expiry/hash/source revision
3. Expose snapshot and job/plan lookup ports needed by later adapters

**Observable proof**:

A sequence gap can trigger refetch; altering plan content invalidates its hash and does
not produce an applyable plan.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T014` completion through the event-sourced CLI after verifying it.

### T015 — Verify lifecycle and exportable definitions

**Implementation**:

1. Exercise create/list/open/switch and portable secret-free definition serialization
2. Test unknown newer files and reconnectable external locations
3. Record request/recovery results without secret values

**Observable proof**:

Project isolation, repeatable reopen and zero partial batch writes are proven against
real storage.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T015` completion through the event-sourced CLI after verifying it.

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

JSON files and SQLite metadata cannot commit atomically together; journal actual
outcomes and reconcile before accepting another writer.

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
