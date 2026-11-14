---
work_package_id: WP22
title: Equipment Desk end-to-end authoring acceptance
dependencies:
- WP09
- WP14
- WP17
- WP18
- WP20
- WP21
requirement_refs:
- C-007
- FR-001
- FR-003
- FR-004
- FR-006
- FR-007
- FR-008
- FR-009
- FR-010
- FR-011
- FR-012
- FR-013
- FR-014
- FR-015
- FR-016
- FR-017
- FR-018
- FR-019
- FR-020
- FR-021
- FR-023
- FR-024
- FR-025
- FR-026
- FR-027
- FR-030
- NFR-006
- NFR-009
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T106
- T107
- T108
- T109
- T110
phase: Acceptance and readiness
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: fixtures/equipment/
create_intent:
- fixtures/equipment/project.json
- tests/e2e/equipment/workflow.spec.ts
- docs/evidence/equipment/report.md
execution_mode: code_change
owned_files:
- fixtures/equipment/**
- tests/e2e/equipment/**
- docs/evidence/equipment/**
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the
frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `implementer-ivan`
- **Role**: `implementer`
- **Agent/tool**: `codex`

# WP22 — Equipment Desk end-to-end authoring acceptance

## Objective and success criteria

Prove the first complete application is authored through the product rather than
assembled by hidden setup scripts.

**Independent demonstration**:

Complete the quickstart Equipment Desk journey through Studio, then operate its
generated app and verify preserved data/settings after two regenerations.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-001, FR-003, FR-004, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-023, FR-024, FR-025, FR-026, FR-027, FR-030, NFR-006, NFR-009, C-007.

**Dependencies**: WP09, WP14, WP17, WP18, WP20, WP21.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP22 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `fixtures/equipment/**`
- `tests/e2e/equipment/**`
- `docs/evidence/equipment/**`

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

### T106 — Author schema and interfaces through real UI

**Implementation**:

1. Create blank project and assets/borrowers/loans/loan_lines through schema editor
2. Review/apply constraints and create public/search/Record/child pages using wizards
3. Record visible authoring actions; no direct project JSON or schema seeding for this
   journey

**Observable proof**:

The retained trace starts from blank storage and creates all model objects through
supported controls.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T106` completion through the event-sourced CLI after verifying it.

### T107 — Exercise auth and Record happy/exception paths

**Implementation**:

1. Provision a user visibly, configure public reads/protected writes and header
   identity
2. Add/edit/cancel/delete disposable records and attempt restricted parent deletion
3. Verify login/logout plus selected child/filter resumption with independent data
   assertions

**Observable proof**:

Both UI behavior and direct protected requests agree; blocked deletion preserves parent
and children.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T107` completion through the event-sourced CLI after verifying it.

### T108 — Author report and inspect application map

**Implementation**:

1. Build aggregate query with exact decimal totals and minimum-total parameter
2. Link report to filtered child lists and inspect login/return parameters in flow map
3. Add/edit/delete a line and compare report to separate expected arithmetic

**Observable proof**:

Report filters update correctly and graph selection leads to the actual configured
action/binding.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T108` completion through the event-sourced CLI after verifying it.

### T109 — Evolve and regenerate the application

**Implementation**:

1. Add authored validator/action and review rename/backfill migration
2. Cancel a destructive change and reject a stale plan
3. Regenerate twice, reopen project, export and run outside Studio

**Observable proof**:

Records, migrations, query/report settings, links, policies and authored source survive
byte/value checks.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T109` completion through the event-sourced CLI after verifying it.

### T110 — Retain honest walkthrough evidence

**Implementation**:

1. Capture redacted screenshots/traces, independent SQL/decimal assertions and
   environment
2. Map results to AT-01 through AT-11 and mark unexecuted paths honestly
3. Report functional defects to owning packages with concrete reproduction rather than
   bypass them

**Observable proof**:

Evidence contains no passwords/manual derivatives and does not claim all NFRs pass from
one happy-path recording.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T110` completion through the event-sourced CLI after verifying it.

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

Lower-level fixture setup is useful but cannot substitute for the visible blank-project
schema/page/query/auth workflow.

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
