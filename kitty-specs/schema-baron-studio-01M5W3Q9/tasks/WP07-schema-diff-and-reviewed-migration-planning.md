---
work_package_id: WP07
title: Schema diff and reviewed migration planning
dependencies:
- WP06
- WP02
requirement_refs:
- C-007
- FR-007
- FR-008
- FR-009
- FR-010
- NFR-003
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T031
- T032
- T033
- T034
- T035
phase: Workspace and schema
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/sqlite/src/schema-plans/
create_intent:
- packages/sqlite/src/schema-plans/index.ts
- packages/sqlite/tests/schema-plans/behavior.test.ts
- packages/core/src/schema-preview/index.ts
- fixtures/schema-plans/project.json
execution_mode: code_change
owned_files:
- packages/sqlite/src/schema-plans/**
- packages/sqlite/tests/schema-plans/**
- packages/core/src/schema-preview/**
- fixtures/schema-plans/**
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

# WP07 — Schema diff and reviewed migration planning

## Objective and success criteria

Compile desired schema changes into immutable reviewed SQL/data-impact plans with
explicit SQLite support boundaries.

**Independent demonstration**:

Plan a rename plus required-field backfill against populated data, inspect exact impact,
and reject unsupported trigger-dependent changes before apply.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-007, FR-008, FR-009, FR-010, NFR-003, C-007.

**Dependencies**: WP06, WP02.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP07 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/sqlite/src/schema-plans/**`
- `packages/sqlite/tests/schema-plans/**`
- `packages/core/src/schema-preview/**`
- `fixtures/schema-plans/**`

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

### T031 — Define stable-ID schema diff semantics

**Implementation**:

1. Compare inspected schema with desired logical schema using stable IDs
2. Distinguish rename/add/drop/type/key/index/relationship changes
3. Detect dependent bindings and require coordinated repairs in the candidate model

**Observable proof**:

A rename produces preservation semantics, while an intentional drop has explicit
destructive impact.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T031` completion through the event-sourced CLI after verifying it.

### T032 — Compile constrained SQLite DDL

**Implementation**:

1. Quote identifiers and compile defaults/checks from supported expression nodes
2. Choose native ALTER capabilities or generalized rebuild based on actual SQLite
   version
3. Retain unsupported objects and block transformations whose semantics cannot be
   preserved

**Observable proof**:

Reserved names and composite constraints compile safely; opaque dependencies never
vanish silently.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T032` completion through the event-sourced CLI after verifying it.

### T033 — Compute data impact and backfill requirements

**Implementation**:

1. Detect null/unique/FK violations and require explicit conversions/backfills
2. Enumerate dependent objects and destructive impact IDs
3. Record row/data fingerprints, backup policy and recovery instructions

**Observable proof**:

A required field with existing rows cannot be applied without a validated backfill;
preview changes no rows.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T033` completion through the event-sourced CLI after verifying it.

### T034 — Register immutable schema preview plans

**Implementation**:

1. Use core reviewed-plan persistence for revision/hash/expiry and DB fingerprint
2. Publish readable SQL, diagnostics and acknowledgement requirements
3. Include restore-plan metadata without performing a restore

**Observable proof**:

Changing project or database state invalidates the reviewed plan; a generic approval
cannot authorize a different plan.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T034` completion through the event-sourced CLI after verifying it.

### T035 — Verify planning with independent schema assertions

**Implementation**:

1. Build diverse real DB fixtures and compare plans to intended transformations
2. Test unsupported generated/virtual objects, checks and triggers explicitly
3. Assert preview never executes migration DDL and fails closed on unsafe semantics

**Observable proof**:

Tests prove preservation intent beyond SQL string snapshots and cover quoted/composite
schemas.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T035` completion through the event-sourced CLI after verifying it.

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

Name-based diffing can mistake renames for drop/create and silently lose data or
dependent objects.

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
