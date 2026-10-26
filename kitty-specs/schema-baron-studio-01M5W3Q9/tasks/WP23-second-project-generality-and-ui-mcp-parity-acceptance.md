---
work_package_id: WP23
title: Second project generality and UI-MCP parity acceptance
dependencies:
- WP22
requirement_refs:
- C-003
- C-007
- FR-001
- FR-028
- FR-029
- FR-030
- NFR-007
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T111
- T112
- T113
- T114
- T115
phase: Acceptance and readiness
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: fixtures/publication/
create_intent:
- fixtures/publication/project.json
- tests/e2e/publication/workflow.spec.ts
- tests/contracts/parity/behavior.test.ts
- docs/evidence/generality/report.md
execution_mode: code_change
owned_files:
- fixtures/publication/**
- tests/e2e/publication/**
- tests/contracts/parity/**
- docs/evidence/generality/**
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

# WP23 — Second project generality and UI-MCP parity acceptance

## Objective and success criteria

Build an unrelated publication catalog with composite keys and prove matching UI/agent
semantics across both projects.

**Independent demonstration**:

Author Publication Catalog from blank, switch between both projects, and replay
equivalent UI/MCP changes with stale/invalid cases and isolated users/data.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-001, FR-028, FR-029, FR-030, NFR-007, C-003, C-007.

**Dependencies**: WP22.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP23 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `fixtures/publication/**`
- `tests/e2e/publication/**`
- `tests/contracts/parity/**`
- `docs/evidence/generality/**`

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

### T111 — Author the unrelated schema through Studio

**Implementation**:

1. Create authors/publications/categories/publication_categories with composite key
2. Use distinct routes/field names and explicit relationships/constraints
3. Do not copy a saved model or preseed its schema outside the product

**Observable proof**:

The authoring trace proves all schema objects were created visibly and no generator code
changed for this domain.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T111` completion through the event-sourced CLI after verifying it.

### T112 — Repeat application capabilities and persistence

**Implementation**:

1. Build list/search/Record/login/child navigation and aggregate report through normal
   editors
2. Exercise CRUD, validation, protected action returns and blocked related deletion
3. Perform reviewed schema change and two regenerations with authored extension

**Observable proof**:

The same feature set works with composite keys and different relationships; no special
table-name logic is introduced.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T112` completion through the event-sourced CLI after verifying it.

### T113 — Replay the complete shared operation corpus

**Implementation**:

1. Cover project/schema/query/page/form/control/extension/generation/diagnostic
   families through MCP and HTTP UI transport
2. Compare normalized snapshots, revisions and diagnostics
3. Include stale revision, invalid expressions, conflicting request IDs and plan
   acknowledgements

**Observable proof**:

Every implemented command family has parity evidence rather than only inspect/read
tools.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T113` completion through the event-sourced CLI after verifying it.

### T114 — Verify cross-project and concurrent draft isolation

**Implementation**:

1. Switch projects without service restart and inspect separate data/auth/output
2. Apply agent changes with an unrelated UI draft and a conflicting draft
3. Verify event-gap refetch and reconnect do not lose user edits

**Observable proof**:

No user/session/record leaks between projects; conflicts reject partial writes and
preserve dirty input.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T114` completion through the event-sourced CLI after verifying it.

### T115 — Publish generality evidence and defect triage

**Implementation**:

1. Retain both-domain results and scan engine source for fixture identifiers
2. Record exact tested capabilities/limitations and root-cause any schema-specific
   failures
3. Link defects to owning implementation packages and rerun only affected acceptance
   cases

**Observable proof**:

All generality claims have independent traces and there are no hidden setup exceptions
to the authoring rule.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T115` completion through the event-sourced CLI after verifying it.

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

A second fixture driven by the first app names or hidden engine edits would not
demonstrate a general builder.

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
