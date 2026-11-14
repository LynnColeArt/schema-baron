---
work_package_id: WP18
title: Application behavior map and endpoint projection
dependencies:
- WP14
- WP17
requirement_refs:
- C-003
- FR-021
- FR-022
- NFR-002
- NFR-005
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T086
- T087
- T088
- T089
- T090
phase: Queries and flow
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: packages/core/src/flow/
create_intent:
- packages/core/src/flow/index.ts
- packages/core/tests/flow/behavior.test.ts
- apps/studio/src/flow-map/index.tsx
- tests/e2e/flow-map/workflow.spec.ts
execution_mode: code_change
owned_files:
- packages/core/src/flow/**
- packages/core/tests/flow/**
- apps/studio/src/flow-map/**
- tests/e2e/flow-map/**
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

# WP18 — Application behavior map and endpoint projection

## Objective and success criteria

Derive a selectable flow chart of application behavior and parameter movement, separate
from schema relationships.

**Independent demonstration**:

Follow list to record to login to save/Cancel in the map, edit one edge mapping in
Properties and observe the map update from canonical state.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-021, FR-022, NFR-002, NFR-005, C-003.

**Dependencies**: WP14, WP17.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP18 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/core/src/flow/**`
- `packages/core/tests/flow/**`
- `apps/studio/src/flow-map/**`
- `tests/e2e/flow-map/**`

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

### T086 — Derive application nodes and semantic edges

**Implementation**:

1. Project pages/forms/actions/navigation and success/Cancel destinations from
   canonical objects
2. Annotate login gates and effective policies
3. Carry stable source IDs and typed key/filter mappings on edges

**Observable proof**:

No independently persisted graph semantics can diverge from actual generated
routes/actions.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T086` completion through the event-sourced CLI after verifying it.

### T087 — Implement endpoint and diagnostic projections

**Implementation**:

1. Offer route/handler inventory as another view of the same definitions
2. Diagnose missing destinations, invalid parameters and auth/return inconsistencies
3. Link every diagnostic to a selectable source object

**Observable proof**:

The endpoint view is useful without replacing the behavior map or schema ERD.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T087` completion through the event-sourced CLI after verifying it.

### T088 — Render compact selectable behavior chart

**Implementation**:

1. Use custom nodes/edges with filters and parameter inspection
2. Selecting a node/edge opens the real contextual Properties object
3. Persist layout separately and keep user selection through projection updates

**Observable proof**:

A property change immediately changes the corresponding map edge; moving it does not
alter behavior.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T088` completion through the event-sourced CLI after verifying it.

### T089 — Provide keyboard navigation and scalable layout

**Implementation**:

1. Add search/list alternative, pan/zoom and focused subgraph navigation
2. Avoid recomputing entire graphs for unrelated view-state edits
3. Test the 100-node fixture with stable IDs and useful empty/error states

**Observable proof**:

Keyboard users can inspect the same behavior and draft selection survives repeated graph
updates.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T089` completion through the event-sourced CLI after verifying it.

### T090 — Verify map/runtime correspondence

**Implementation**:

1. Compare projected paths to emitted route/action definitions and live navigation
2. Exercise login-return, Save/Cancel, parent filter and broken-link cases
3. Retain annotated diagram/screenshots with source object IDs

**Observable proof**:

The map explains real behavior and is not a manually drawn acceptance illustration.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T090` completion through the event-sourced CLI after verifying it.

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

A route inventory alone misses the killer feature; edges must show auth gates, write
outcomes, Cancel and return context.

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
