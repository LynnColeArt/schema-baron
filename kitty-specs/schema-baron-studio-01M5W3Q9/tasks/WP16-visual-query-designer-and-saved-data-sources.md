---
work_package_id: WP16
title: Visual query designer and saved data sources
dependencies:
- WP08
- WP15
requirement_refs:
- C-002
- FR-018
- FR-019
- NFR-005
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T076
- T077
- T078
- T079
- T080
phase: Queries and flow
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: apps/studio/src/query-designer/
create_intent:
- apps/studio/src/query-designer/index.tsx
- tests/e2e/query-designer/workflow.spec.ts
execution_mode: code_change
owned_files:
- apps/studio/src/query-designer/**
- tests/e2e/query-designer/**
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the
frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `frontend-freddy`
- **Role**: `implementer`
- **Agent/tool**: `codex`

# WP16 — Visual query designer and saved data sources

## Objective and success criteria

Provide the focused Data Source query window with visible joins, projections,
parameters, grouping and bounded results.

**Independent demonstration**:

Build and save a joined aggregate query in the designer, inspect SQL/results and reopen
it through a form Data Source property.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-018, FR-019, NFR-005, C-002.

**Dependencies**: WP08, WP15.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP16 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `apps/studio/src/query-designer/**`
- `tests/e2e/query-designer/**`

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

### T076 — Build focused source/join canvas

**Implementation**:

1. Open from a form Data Source property or named-query explorer entry
2. Add sources/aliases and inner/outer join mappings using canonical IDs
3. Keep layout separate and provide keyboard/list join editing

**Observable proof**:

Moving nodes never changes query meaning; invalid/composite join mappings receive clear
errors.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T076` completion through the event-sourced CLI after verifying it.

### T077 — Build field/expression/group/sort editors

**Implementation**:

1. Select projected fields, aggregates, expressions, WHERE/HAVING and ordering
2. Show supported grammar, types, grouping and aggregate-grain diagnostics
3. Preserve unsaved query drafts and focus through result rerenders

**Observable proof**:

The author can understand and correct fanout/grouping errors without editing saved JSON.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T077` completion through the event-sourced CLI after verifying it.

### T078 — Build typed parameter and review panels

**Implementation**:

1. Declare parameters/defaults and distinguish required/null values
2. Preview compiled SQL read-only and bounded sample/result columns
3. Show cancellation, query limits and diagnostics from the real shared preview service

**Observable proof**:

Parameters alter results through bound values; the SQL view is not an arbitrary
executable escape hatch.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T078` completion through the event-sourced CLI after verifying it.

### T079 — Save and reuse named queries

**Implementation**:

1. Persist query AST/result shape and bind forms to stable query IDs
2. Reopen the same designer from each consumer and report dependency effects
3. Keep query parameter mappings and formatting choices separate from canvas view state

**Observable proof**:

Rename/reopen does not lose bindings, and incompatible result changes block dependent
generation visibly.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T079` completion through the event-sourced CLI after verifying it.

### T080 — Verify the complete query-authoring path

**Implementation**:

1. Author joins, aggregate and minimum-total parameter through UI
2. Compare displayed preview to independent SQLite/decimal values and MCP inspect
3. Test draft preservation, empty data, invalid grouping and save/reopen

**Observable proof**:

No hidden SQL/model edit substitutes for the visual designer; all errors select relevant
query objects.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T080` completion through the event-sourced CLI after verifying it.

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

A second manually maintained SQL representation or unrestricted raw execution bypass
would drift from the typed query model.

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
