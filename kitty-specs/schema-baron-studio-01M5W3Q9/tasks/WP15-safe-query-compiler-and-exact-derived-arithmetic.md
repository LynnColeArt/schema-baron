---
work_package_id: WP15
title: Safe query compiler and exact derived arithmetic
dependencies:
- WP06
- WP02
requirement_refs:
- C-007
- FR-018
- FR-020
- NFR-004
- NFR-009
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: e41cf08e6c332f3f1340699eb516e8c0637e7286
created_at: '2026-10-27T04:12:40.824966+00:00'
subtasks:
- T071
- T072
- T073
- T074
- T075
phase: Queries and flow
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/sqlite/src/query/
create_intent:
- packages/sqlite/src/query/index.ts
- packages/sqlite/src/decimal/index.ts
- packages/sqlite/tests/query/behavior.test.ts
- packages/sqlite/tests/decimal/behavior.test.ts
- packages/core/src/query-preview/index.ts
- fixtures/queries/project.json
execution_mode: code_change
owned_files:
- packages/sqlite/src/query/**
- packages/sqlite/src/decimal/**
- packages/sqlite/tests/query/**
- packages/sqlite/tests/decimal/**
- packages/core/src/query-preview/**
- fixtures/queries/**
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

# WP15 — Safe query compiler and exact derived arithmetic

## Objective and success criteria

Compile reusable structured queries with bound parameters, explicit aggregate grain and
exact decimal arithmetic.

**Independent demonstration**:

Compute totals for parents with zero, one and multiple children and a minimum-total
HAVING parameter; compare to an independent exact-decimal oracle.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-018, FR-020, NFR-004, NFR-009, C-007.

**Dependencies**: WP06, WP02.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP15 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/sqlite/src/query/**`
- `packages/sqlite/src/decimal/**`
- `packages/sqlite/tests/query/**`
- `packages/sqlite/tests/decimal/**`
- `packages/core/src/query-preview/**`
- `fixtures/queries/**`

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

### T071 — Compile typed queries and expressions

**Implementation**:

1. Resolve source/alias/field IDs and quote validated identifiers
2. Compile supported arithmetic/comparisons/functions and bound typed parameters
3. Separate WHERE/GROUP BY/HAVING/ORDER BY and reject unsafe or unknown expression
   nodes

**Observable proof**:

Injection-shaped values stay parameters; unknown identifiers/functions fail before
executing SQL.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T071` completion through the event-sourced CLI after verifying it.

### T072 — Enforce grouping and aggregate grain

**Implementation**:

1. Validate selected nonaggregates against grouping
2. Detect multiple child joins and require explicit grain or safe preaggregation
3. Propagate outer-join nullability and configurable coalesce-to-zero behavior

**Observable proof**:

A two-child fanout fixture cannot silently inflate totals; zero-child parents remain
where declared.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T072` completion through the event-sourced CLI after verifying it.

### T073 — Implement exact decimal codecs and SQL helpers

**Implementation**:

1. Use scaled integers/decimal strings with explicit precision/rounding
2. Register deterministic exact arithmetic/aggregate helpers for preview and generated
   runtime
3. Reject overflow and invalid decimal input instead of coercing to binary REAL

**Observable proof**:

Fractional price times quantity and accumulated totals match independent exact
arithmetic at the configured scale.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T073` completion through the event-sourced CLI after verifying it.

### T074 — Expose bounded read-only query preview

**Implementation**:

1. Register query.preview for saved/draft AST with validated parameter values
2. Use read-only worker connections, row cap 200 and cancellation/time limits
3. Return result shape, sample rows, SQL and actionable diagnostics without mutations

**Observable proof**:

Large/expensive or canceled queries cannot freeze the command service or modify data.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T074` completion through the event-sourced CLI after verifying it.

### T075 — Verify compiler and numeric semantics

**Implementation**:

1. Run real SQLite fixtures for inner/outer joins, aliases, WHERE/HAVING and composite
   keys
2. Compare results to separately written SQL/decimal expectations
3. Verify unsupported grammar and query cost diagnostics through both adapters

**Observable proof**:

Tests verify values and preservation, not only SQL text snapshots.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T075` completion through the event-sourced CLI after verifying it.

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

Outer-join omissions, aggregate fanout and floating-point accumulation can produce
plausible but wrong reports.

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
