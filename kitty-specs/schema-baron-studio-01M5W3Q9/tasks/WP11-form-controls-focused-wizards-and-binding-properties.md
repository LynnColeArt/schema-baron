---
work_package_id: WP11
title: Form controls, focused wizards and binding properties
dependencies:
- WP08
- WP10
requirement_refs:
- C-002
- FR-003
- FR-004
- FR-011
- FR-024
- NFR-005
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T051
- T052
- T053
- T054
- T055
phase: Generated application
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: apps/studio/src/forms/
create_intent:
- apps/studio/src/forms/index.tsx
- packages/core/src/form-construction/index.ts
- tests/e2e/forms/workflow.spec.ts
- packages/core/tests/form-construction/behavior.test.ts
execution_mode: code_change
owned_files:
- apps/studio/src/forms/**
- packages/core/src/form-construction/**
- tests/e2e/forms/**
- packages/core/tests/form-construction/**
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

# WP11 — Form controls, focused wizards and binding properties

## Objective and success criteria

Create and then edit Grid, Record, Search and Login forms as ordinary page objects, with
field-aware controls and explicit links/actions.

**Independent demonstration**:

Construct a multi-form page, cancel another wizard, and change a field binding or
Save/Cancel destination through contextual Properties.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-003, FR-004, FR-011, FR-024, NFR-005, C-002.

**Dependencies**: WP08, WP10.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP11 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `apps/studio/src/forms/**`
- `packages/core/src/form-construction/**`
- `tests/e2e/forms/**`
- `packages/core/tests/form-construction/**`

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

### T051 — Implement atomic form construction commands

**Implementation**:

1. Materialize form/control/action objects from validated source/field/key selections
2. Use the shared project.batch validation path and one revision
3. Expose capability diagnostics for source shapes unsuitable for a form

**Observable proof**:

Canceled or invalid construction creates no half-form; both transports return the same
ordinary objects.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T051` completion through the event-sourced CLI after verifying it.

### T052 — Build focused form wizards

**Implementation**:

1. Provide source/fields/keys/actions/search/sort/style steps as appropriate per kind
2. Support linked Grid/Record creation with explicit key mappings
3. Finish by selecting editable created objects and close the wizard

**Observable proof**:

Every first-four form kind is constructible, and no wizard remains permanently attached
to a page.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T052` completion through the event-sourced CLI after verifying it.

### T053 — Provide controls and contextual data bindings

**Implementation**:

1. Support labels, text/numeric/date inputs, checkbox, lookup/select, link and button
2. Map types/defaults/validation and read-only derived bindings
3. Show key tuples and relationship choices explicitly

**Observable proof**:

An incompatible binding produces a localized diagnostic rather than silently coercing
data.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T053` completion through the event-sourced CLI after verifying it.

### T054 — Expose appearance and declared actions/events

**Implementation**:

1. Edit layout/formatting and allowed navigation/submission/lifecycle hook references
2. Configure success/Cancel/child-filter mappings with typed parameters
3. Keep business hooks as source references, not evaluated code strings

**Observable proof**:

Property edits affect the same canonical objects inspected through MCP and later used by
the flow projection.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T054` completion through the event-sourced CLI after verifying it.

### T055 — Verify wizards and post-wizard editing

**Implementation**:

1. Exercise each wizard and atomic Cancel with keyboard controls
2. Reopen, change properties without rerunning construction and inspect generated
   definitions
3. Test multiple forms on a page and composite key links

**Observable proof**:

No source-table naming assumptions or hidden JSON patches are needed to finish the
workflow.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T055` completion through the event-sourced CLI after verifying it.

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

Wizard-only objects or untyped event strings would make normal editing inconsistent and
hide behavior from the map/MCP.

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
