---
work_package_id: WP08
title: Visual schema table and relationship editor
dependencies:
- WP05
- WP07
requirement_refs:
- C-002
- FR-007
- FR-008
- FR-009
- NFR-002
- NFR-005
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: 8df4a11dc8ff424cce87fa311cf718ed028c8d0c
created_at: '2026-10-27T05:07:07.879373+00:00'
subtasks:
- T036
- T037
- T038
- T039
- T040
phase: Workspace and schema
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: apps/studio/src/schema-editor/
create_intent:
- apps/studio/src/schema-editor/index.tsx
- tests/e2e/schema-editor/workflow.spec.ts
execution_mode: code_change
owned_files:
- apps/studio/src/schema-editor/**
- tests/e2e/schema-editor/**
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

# WP08 — Visual schema table and relationship editor

## Objective and success criteria

Create an entirely new schema through modern table editing and a selectable relationship
canvas, then review its migration proposal.

**Independent demonstration**:

From blank SQLite, author tables with constraints and a composite relationship, review
SQL/impact, cancel a destructive edit, and reopen the same schema layout.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-007, FR-008, FR-009, NFR-002, NFR-005, C-002.

**Dependencies**: WP05, WP07.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP08 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `apps/studio/src/schema-editor/**`
- `tests/e2e/schema-editor/**`

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

### T036 — Implement table and column editing

**Implementation**:

1. Edit names, logical/physical types, nullability, defaults and keys
2. Expose unique/check constraints and indexes through focused panels
3. Use draft validation and stable IDs rather than mutating the connected DB on each
   keystroke

**Observable proof**:

Invalid drafts remain editable with field errors; committing a valid schema uses shared
project operations.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T036` completion through the event-sourced CLI after verifying it.

### T037 — Implement relationship canvas

**Implementation**:

1. Render tables/columns from canonical schema with React Flow
2. Drag to propose FK mappings and explicitly choose ordered composite pairs and
   actions
3. Persist only view positions separately from semantic schema

**Observable proof**:

Moving a table changes no DB meaning; creating an FK is reflected in the table editor
and model.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T037` completion through the event-sourced CLI after verifying it.

### T038 — Build keyboard and unsupported-object alternatives

**Implementation**:

1. Provide searchable table/list views and keyboard relationship creation
2. Clearly mark imported read-only constructs and explain blocked edits
3. Maintain focus and dirty state when selection or graph layout changes

**Observable proof**:

Core schema authoring works without pointer drag and unsupported SQL cannot be silently
overwritten.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T038` completion through the event-sourced CLI after verifying it.

### T039 — Present migration review and acknowledgement

**Implementation**:

1. Show SQL, impact rows/dependencies, backfill needs and backup location from
   schema.preview
2. Keep exact impact IDs/hash tied to the displayed proposal
3. Cancel without persisting an apply request; display stale-plan diagnostics

**Observable proof**:

No destructive effect occurs on opening or editing review; a changed draft requires a
fresh preview.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T039` completion through the event-sourced CLI after verifying it.

### T040 — Verify visible schema construction

**Implementation**:

1. Drive real blank-project table/constraint/FK creation entirely through UI
2. Inspect resulting canonical schema through MCP and retain screenshots
3. Exercise 50-table navigation fixture and preserve selection through repeated edits

**Observable proof**:

No hidden setup SQL completes the walkthrough; layout remains separate and invalid input
is clearly localized.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T040` completion through the event-sourced CLI after verifying it.

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

Canvas layout cannot become a second schema definition, and connecting lines must map
ordered composite columns explicitly.

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
