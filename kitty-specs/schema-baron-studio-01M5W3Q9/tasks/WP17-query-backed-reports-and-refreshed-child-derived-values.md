---
work_package_id: WP17
title: Query-backed reports and refreshed child-derived values
dependencies:
- WP12
- WP16
requirement_refs:
- C-007
- FR-014
- FR-019
- FR-020
- NFR-006
- NFR-009
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T081
- T082
- T083
- T084
- T085
phase: Queries and flow
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/generator/src/templates/report/
create_intent:
- packages/generator/src/templates/report/index.ts
- packages/generator/src/templates/derived/index.ts
- packages/generator/tests/reports/behavior.test.ts
- apps/studio/src/report-bindings/index.tsx
- tests/e2e/reports/workflow.spec.ts
execution_mode: code_change
owned_files:
- packages/generator/src/templates/report/**
- packages/generator/src/templates/derived/**
- packages/generator/tests/reports/**
- apps/studio/src/report-bindings/**
- tests/e2e/reports/**
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

# WP17 — Query-backed reports and refreshed child-derived values

## Objective and success criteria

Use saved queries to generate public filterable reports with child links, exact totals
and correct refresh after writes.

**Independent demonstration**:

Bind the aggregate query to a report, add/edit/delete a child amount and verify totals
plus minimum-total filtering update before and after regeneration.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-014, FR-019, FR-020, NFR-006, NFR-009, C-007.

**Dependencies**: WP12, WP16.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP17 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/generator/src/templates/report/**`
- `packages/generator/src/templates/derived/**`
- `packages/generator/tests/reports/**`
- `apps/studio/src/report-bindings/**`
- `tests/e2e/reports/**`

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

### T081 — Build report/query binding properties

**Implementation**:

1. Choose saved query, parameter mappings, result fields, formatting and row links
2. Validate declared key/filter propagation to parent/child routes
3. Keep report a Grid composition rather than adding a separate giant builder

**Observable proof**:

Report settings are canonical editable properties and survive project reopen.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T081` completion through the event-sourced CLI after verifying it.

### T082 — Generate reusable query execution modules

**Implementation**:

1. Emit the same typed query semantics and exact-decimal helpers as preview
2. Validate runtime parameters and compile server-only query/data modules
3. Keep public reads independent of protected write actions

**Observable proof**:

Preview and generated runtime agree on values for zero-child, outer-join and HAVING
fixtures.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T082` completion through the event-sourced CLI after verifying it.

### T083 — Generate derived fields and dependency refresh

**Implementation**:

1. Compile read-only child-derived values and explicit source dependencies
2. Invalidate or avoid cached reads after successful mutations
3. Prevent editable stored fields from competing with declared derived values

**Observable proof**:

A changed line updates totals immediately on redirect and derived controls cannot be
submitted as authoritative input.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T083` completion through the event-sourced CLI after verifying it.

### T084 — Generate report navigation and filter UX

**Implementation**:

1. Expose minimum-total and other declared parameters with clear invalid/empty states
2. Generate typed customer-equivalent parent/child links without fixed names
3. Preserve safe report return/filter context through protected record operations

**Observable proof**:

Public report links work signed out, and login resumes the requested filtered child
record.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T084` completion through the event-sourced CLI after verifying it.

### T085 — Verify totals and persistence through regeneration

**Implementation**:

1. Assert independent exact-decimal values before/after child add/edit/delete
2. Regenerate twice after WP20 is available; until then record that final cycle as
   pending, not passed
3. Verify saved query/report/filter/link settings reopen unchanged

**Observable proof**:

Completed report behavior has a real oracle and final regeneration evidence is required
by acceptance packages.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T085` completion through the event-sourced CLI after verifying it.

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

Correct designer preview is insufficient if generated SQL differs or route caching keeps
old totals after a save.

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
