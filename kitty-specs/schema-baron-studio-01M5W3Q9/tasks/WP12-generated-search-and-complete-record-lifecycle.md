---
work_package_id: WP12
title: Generated search and complete Record lifecycle
dependencies:
- WP11
requirement_refs:
- C-004
- C-007
- FR-012
- FR-013
- FR-014
- NFR-004
- NFR-006
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T056
- T057
- T058
- T059
- T060
phase: Generated application
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/generator/src/templates/record/
create_intent:
- packages/generator/src/templates/record/index.ts
- packages/generator/src/templates/search/index.ts
- packages/generator/src/templates/navigation/index.ts
- packages/generator/tests/record/behavior.test.ts
- tests/e2e/generated-records/workflow.spec.ts
execution_mode: code_change
owned_files:
- packages/generator/src/templates/record/**
- packages/generator/src/templates/search/**
- packages/generator/src/templates/navigation/**
- packages/generator/tests/record/**
- tests/e2e/generated-records/**
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

# WP12 — Generated search and complete Record lifecycle

## Objective and success criteria

Generate server-validated CRUD/search with clear errors, confirmations and correct
parent-filtered Save/Cancel/Delete return paths.

**Independent demonstration**:

Add, edit, cancel and delete a disposable record; attempt a restricted parent deletion;
verify retained invalid input and correct filtered returns.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-012, FR-013, FR-014, NFR-004, NFR-006, C-004, C-007.

**Dependencies**: WP11.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP12 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/generator/src/templates/record/**`
- `packages/generator/src/templates/search/**`
- `packages/generator/src/templates/navigation/**`
- `packages/generator/tests/record/**`
- `tests/e2e/generated-records/**`

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

### T056 — Generate validated list/search handling

**Implementation**:

1. Compile field-aware search predicates, allowed sorting and bounded pagination
2. Map typed URL parameters without arbitrary client-provided table/column names
3. Preserve sort/search/filter context in record links

**Observable proof**:

Malformed sort/filter/page values cannot inject SQL and empty results stay usable.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T056` completion through the event-sourced CLI after verifying it.

### T057 — Generate transactional create/update services

**Implementation**:

1. Validate input and key tuples on the server before persistence
2. Separate repository, validation and service modules from page rendering
3. Return field/summary errors with safe entered values and one-time save confirmation

**Observable proof**:

Invalid writes change no data; a valid edit changes exactly the selected record,
including composite-key cases.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T057` completion through the event-sourced CLI after verifying it.

### T058 — Generate named delete confirmation and errors

**Implementation**:

1. Resolve the displayed record name from declared fields
2. Confirm delete and enforce actual FK restrict/cascade rules
3. Translate constraint failures to friendly RELATED_RECORDS_EXIST without leaking SQL

**Observable proof**:

Blocked deletion leaves parent and children unchanged; cascade impact is explicit before
confirmation.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T058` completion through the event-sourced CLI after verifying it.

### T059 — Implement safe navigation and return context

**Implementation**:

1. Generate Save/Cancel/Delete destinations from typed declared mappings
2. Retain allowed parent keys and filters and reject external return targets
3. Do not accept a client payload as an authority for a destination or record source

**Observable proof**:

Each action returns to the correct filtered list; Cancel has zero persistence effect.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T059` completion through the event-sourced CLI after verifying it.

### T060 — Verify generated behavior against SQLite

**Implementation**:

1. Use independently asserted row counts/values for create/update/delete and failed
   writes
2. Test field errors, duplicates, nullable lookups, forged keys and quoted/composite
   schemas
3. Run strict typecheck and production build outside Studio

**Observable proof**:

Runtime behavior and modules satisfy the contract rather than merely snapshotting
generated strings.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T060` completion through the event-sourced CLI after verifying it.

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

UI-only validation or raw referential SQL errors must not leak through; a multi-field
write/delete must be atomic.

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
