---
work_package_id: WP05
title: Compact Studio shell and project editing state
dependencies:
- WP04
requirement_refs:
- C-002
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-024
- NFR-001
- NFR-005
- NFR-008
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: 35c91e9c54f33567df516b220332d96865c350cd
created_at: '2026-10-27T02:41:02.567593+00:00'
subtasks:
- T021
- T022
- T023
- T024
- T025
phase: Workspace and schema
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: apps/studio/src/workspace/
create_intent:
- apps/studio/app/page.tsx
- apps/studio/app/layout.tsx
- apps/studio/app/globals.css
- apps/studio/src/workspace/index.tsx
- apps/studio/src/project-ui/index.tsx
- packages/ui/src/index.ts
- packages/ui/tests/index.ts
- tests/e2e/workspace/workflow.spec.ts
execution_mode: code_change
owned_files:
- apps/studio/app/page.tsx
- apps/studio/app/layout.tsx
- apps/studio/app/globals.css
- apps/studio/src/workspace/**
- apps/studio/src/project-ui/**
- packages/ui/src/**
- packages/ui/tests/**
- tests/e2e/workspace/**
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

# WP05 — Compact Studio shell and project editing state

## Objective and success criteria

Deliver a real compact workspace with contextual object selection, blank-project setup
and draft continuity.

**Independent demonstration**:

Create a blank project, add two pages and forms, edit contextual properties, switch
objects, undo/redo and reopen without losing drafts or identities.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-024, NFR-001, NFR-005, NFR-008, C-002.

**Dependencies**: WP04.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP05 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `apps/studio/app/page.tsx`
- `apps/studio/app/layout.tsx`
- `apps/studio/app/globals.css`
- `apps/studio/src/workspace/**`
- `apps/studio/src/project-ui/**`
- `packages/ui/src/**`
- `packages/ui/tests/**`
- `tests/e2e/workspace/**`

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

### T021 — Build early-Studio workspace chrome

**Implementation**:

1. Implement compact menus/toolbars and docked Explorer, document, Toolbox, Properties
   and Messages
2. Use manual-index workspace page references and responsive density tokens
3. Support resizing, scrolling, keyboard focus and labeled controls

**Observable proof**:

Screenshots show all regions and no always-present Application Builder on page
documents.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T021` completion through the event-sourced CLI after verifying it.

### T022 — Implement selection and contextual properties

**Implementation**:

1. Use stable page/form/control IDs across Explorer and document selection
2. Display Format/Data/Events only for relevant selected properties
3. Link messages to offending objects and preserve selection when values update

**Observable proof**:

Selecting in either surface selects one object and edits persist through the owner API.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T022` completion through the event-sourced CLI after verifying it.

### T023 — Implement blank-project lifecycle UI

**Implementation**:

1. Offer create/open/switch/save and connection setup entry points
2. Use bounded dialogs with atomic Cancel and visible loading/error states
3. Keep project settings separate from page properties and do not preseed a business
   schema

**Observable proof**:

A canceled wizard leaves no partial project objects; reopen uses stable persisted IDs.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T023` completion through the event-sourced CLI after verifying it.

### T024 — Implement drafts, undo/redo and revision reconciliation

**Implementation**:

1. Keep per-object dirty state and base revisions outside committed snapshots
2. Preserve focus/selection/input through rerenders and nonconflicting MCP events
3. Surface conflicting revisions without dropping drafts; undo/redo only model edits

**Observable proof**:

Two drafts survive switching and an unrelated agent edit; a conflicting edit requires
explicit resolution.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T024` completion through the event-sourced CLI after verifying it.

### T025 — Verify workspace and first agent-visible changes

**Implementation**:

1. Run keyboard-driven create/edit/reopen and dirty-navigation scenarios
2. Compare UI edits to MCP inspect output and exercise actionable diagnostics
3. Capture initial visual baseline and editing latency samples

**Observable proof**:

This slice is usable against real storage; timings are measured and remaining budgets
are not claimed achieved without evidence.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T025` completion through the event-sourced CLI after verifying it.

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

A polished shell with disconnected fake properties does not satisfy this slice; every
committed edit must use the shared command service.

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
