---
work_package_id: WP19
title: Design and HTML editing with working document modes
dependencies:
- WP11
- WP10
requirement_refs:
- C-002
- FR-003
- FR-005
- FR-023
- FR-024
- NFR-005
- NFR-008
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: 43be7563583e176096250b2bf42aa14002c52319
created_at: '2026-10-27T08:07:45.800222+00:00'
subtasks:
- T091
- T092
- T093
- T094
- T095
phase: Modes and regeneration
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: apps/studio/src/document-modes/
create_intent:
- apps/studio/src/document-modes/index.tsx
- packages/core/src/page-document/index.ts
- packages/core/tests/page-document/behavior.test.ts
- tests/e2e/document-modes/workflow.spec.ts
execution_mode: code_change
owned_files:
- apps/studio/src/document-modes/**
- packages/core/src/page-document/**
- packages/core/tests/page-document/**
- tests/e2e/document-modes/**
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

# WP19 — Design and HTML editing with working document modes

## Objective and success criteria

Make Design/HTML/Code/Preview/Live Page coherent views of the selected page with
explicit supported edit boundaries.

**Independent demonstration**:

Edit supported HTML and a form control, switch to Design/Preview and back, retain
selection/drafts and explain unsupported markup without destructive rewriting.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-003, FR-005, FR-023, FR-024, NFR-005, NFR-008, C-002.

**Dependencies**: WP11, WP10.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP19 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `apps/studio/src/document-modes/**`
- `packages/core/src/page-document/**`
- `packages/core/tests/page-document/**`
- `tests/e2e/document-modes/**`

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

### T091 — Implement the structured page document edit surface

**Implementation**:

1. Represent static supported markup and typed form/control nodes in one document
2. Define parser/serializer ownership and safe opaque-fragment preservation
3. Reject unsupported dynamic constructs without deleting their source

**Observable proof**:

Supported edits roundtrip semantically and unsupported content is preserved/read-only or
rejected explicitly.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T091` completion through the event-sourced CLI after verifying it.

### T092 — Connect Design and HTML views

**Implementation**:

1. Edit layout/content and object placement through the shared draft/command flow
2. Map source locations to stable selected objects where supported
3. Preserve formatting and focus without recompiling the entire workspace on each
   keystroke

**Observable proof**:

A visible HTML change affects Design and a moved form retains identity and bindings.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T092` completion through the event-sourced CLI after verifying it.

### T093 — Implement draft Preview isolation

**Implementation**:

1. Render the current draft in a constrained frame/origin with restricted scripts
2. Distinguish draft versus last-generated content and invalid draft diagnostics
3. Never execute authored server hooks inside Studio preview

**Observable proof**:

Preview cannot gain filesystem/owner access from markup and invalid drafts remain
editable.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T093` completion through the event-sourced CLI after verifying it.

### T094 — Wire Code and Live Page mode contracts

**Implementation**:

1. Show generated code as owned/read-only and extension surfaces via the WP20 source
   editor
2. Navigate Live Page through the WP21 managed runtime route resolver
3. Use capability-aware actionable states until those dependencies are present

**Observable proof**:

No blank fake mode is reported complete; later integration activates real source/runtime
views without changing ownership promises.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T094` completion through the event-sourced CLI after verifying it.

### T095 — Verify mode continuity and visual density

**Implementation**:

1. Test draft input, focus, selection and invalid-edit recovery across all available
   modes
2. Add final full-mode integration cases gated by WP20/21 in acceptance
3. Compare compact document tabs/properties to manual references

**Observable proof**:

HTML is an editing mode on the same page, not a second inconsistent application
definition.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T095` completion through the event-sourced CLI after verifying it.

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

Pretending arbitrary HTML/TSX can roundtrip through visual forms would lose authored
content or create unsafe execution paths.

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
