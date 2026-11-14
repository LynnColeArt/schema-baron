---
work_package_id: WP06
title: SQLite connections and lossless introspection
dependencies:
- WP04
- WP05
requirement_refs:
- C-007
- FR-006
- FR-029
- NFR-004
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: 8d38831441c59c81fa55a7fb273cb55439c0654e
created_at: '2026-10-27T03:34:50.902651+00:00'
subtasks:
- T026
- T027
- T028
- T029
- T030
phase: Workspace and schema
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/sqlite/src/adapter/
create_intent:
- packages/sqlite/src/adapter/index.ts
- packages/sqlite/src/introspection/index.ts
- packages/sqlite/src/workers/index.ts
- packages/sqlite/tests/introspection/behavior.test.ts
- packages/core/src/connections/index.ts
- apps/studio/src/connections/index.tsx
- tests/e2e/connections/workflow.spec.ts
execution_mode: code_change
owned_files:
- packages/sqlite/src/adapter/**
- packages/sqlite/src/introspection/**
- packages/sqlite/src/workers/**
- packages/sqlite/tests/introspection/**
- packages/core/src/connections/**
- apps/studio/src/connections/**
- tests/e2e/connections/**
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

# WP06 — SQLite connections and lossless introspection

## Objective and success criteria

Connect/create real SQLite databases through Studio and MCP with explicit capabilities
and lossless unsupported-object reporting.

**Independent demonstration**:

Connect an external DB containing quoted identifiers, composite keys, indexes and a
trigger, then reconnect it after relocation without changing its data.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-006, FR-029, NFR-004, C-007.

**Dependencies**: WP04, WP05.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP06 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/sqlite/src/adapter/**`
- `packages/sqlite/src/introspection/**`
- `packages/sqlite/src/workers/**`
- `packages/sqlite/tests/introspection/**`
- `packages/core/src/connections/**`
- `apps/studio/src/connections/**`
- `tests/e2e/connections/**`

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

### T026 — Implement the SQLite worker adapter

**Implementation**:

1. Wrap prepared statements, transaction/backup primitives and worker lifecycle
2. Configure busy handling, foreign-key policy and bounded cancellation
3. Keep all database access server-side and constrain paths through storage ports

**Observable proof**:

A long read cannot freeze Studio interaction; worker errors return structured
diagnostics.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T026` completion through the event-sourced CLI after verifying it.

### T027 — Implement capability-aware introspection

**Implementation**:

1. Inspect sqlite_schema and PRAGMAs for columns, ordered keys, indexes and FKs
2. Preserve unknown SQL and report read-only unsupported constructs
3. Record SQLite version, logical types/encodings and physical schema fingerprints

**Observable proof**:

Imported trigger/view definitions and row counts remain unchanged; no DDL runs during
inspection.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T027` completion through the event-sourced CLI after verifying it.

### T028 — Register connection inspect/bind operations

**Implementation**:

1. Validate owner path scope and inspected fingerprint before binding
2. Represent separate connection identity and portable project locator
3. Support missing-file/reconnect diagnostics rather than silently creating a
   replacement DB

**Observable proof**:

Stale inspected state or relocated missing file produces actionable rejection without
hidden data creation.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T028` completion through the event-sourced CLI after verifying it.

### T029 — Build connection setup and inspection UI

**Implementation**:

1. Offer new-empty versus existing SQLite file with clear selected location
2. Display schema/capability preview and unsupported objects
3. Bind through shared operations and refresh schema consumers

**Observable proof**:

A user can see where the connected data lives and proceed without editing project JSON.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T029` completion through the event-sourced CLI after verifying it.

### T030 — Verify connection safety and parity

**Implementation**:

1. Use real temporary databases with composite keys, nullability, quoted names and WAL
2. Compare UI/MCP outcomes and ensure preview inspection is read-only
3. Test permissions, locking, corrupt file and missing location diagnostics

**Observable proof**:

All paths fail safely; a snapshot before/after inspection has identical database objects
and data.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T030` completion through the event-sourced CLI after verifying it.

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

Copying a live WAL file or normalizing unknown triggers/constraints away can corrupt
imported applications; introspection must retain opaque source.

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
