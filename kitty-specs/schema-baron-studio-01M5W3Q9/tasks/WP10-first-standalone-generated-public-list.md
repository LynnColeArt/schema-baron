---
work_package_id: WP10
title: First standalone generated public list
dependencies:
- WP05
- WP06
- WP08
- WP09
requirement_refs:
- C-001
- C-004
- C-007
- FR-011
- FR-012
- FR-025
- FR-027
- NFR-006
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T046
- T047
- T048
- T049
- T050
phase: Generated application
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: packages/generator/src/ir/
create_intent:
- packages/generator/src/ir/index.ts
- packages/generator/src/compiler/index.ts
- packages/generator/src/templates/base/index.ts
- packages/generator/src/templates/grid/index.ts
- packages/generator/src/initial-output/index.ts
- packages/generator/tests/public-list/behavior.test.ts
- packages/core/src/generation/index.ts
- apps/studio/src/generation/index.tsx
- tests/e2e/first-output/workflow.spec.ts
execution_mode: code_change
owned_files:
- packages/generator/src/ir/**
- packages/generator/src/compiler/**
- packages/generator/src/templates/base/**
- packages/generator/src/templates/grid/**
- packages/generator/src/initial-output/**
- packages/generator/tests/public-list/**
- packages/core/src/generation/**
- apps/studio/src/generation/**
- tests/e2e/first-output/**
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

# WP10 — First standalone generated public list

## Objective and success criteria

Complete the first real vertical loop: blank project to connected schema to Grid to
independently runnable Next.js output, with MCP parity.

**Independent demonstration**:

Author an arbitrary simple table/Grid through UI, review output and run the public list
from a clean generated directory without Studio imports.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-011, FR-012, FR-025, FR-027, NFR-006, C-001, C-004, C-007.

**Dependencies**: WP05, WP06, WP08, WP09.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP10 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/generator/src/ir/**`
- `packages/generator/src/compiler/**`
- `packages/generator/src/templates/base/**`
- `packages/generator/src/templates/grid/**`
- `packages/generator/src/initial-output/**`
- `packages/generator/tests/public-list/**`
- `packages/core/src/generation/**`
- `apps/studio/src/generation/**`
- `tests/e2e/first-output/**`

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

### T046 — Compile validated project into typed generation IR

**Implementation**:

1. Represent routes, sources, controls, queries and effective policies explicitly
2. Reject broken bindings and unsupported generation features with object diagnostics
3. Keep IR/compiler free of Next UI and fixture table names

**Observable proof**:

Two differently named simple schemas compile without generator edits; invalid project
references block output.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T046` completion through the event-sourced CLI after verifying it.

### T047 — Emit an ordinary Next.js application skeleton

**Implementation**:

1. Generate App Router routes/layout/components and server-only persistence modules
2. Include strict types, runtime validation seams and independent package/build/run
   configuration
3. Reference stable external data location and never seed/reset it during generation

**Observable proof**:

Generated source compiles outside npm workspace and browser bundles contain no database
modules.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T047` completion through the event-sourced CLI after verifying it.

### T048 — Generate public Grid rendering and reads

**Implementation**:

1. Emit allowlisted field selection and bound filter/sort/page inputs
2. Use prepared SQLite reads and field-aware formatting/empty state
3. Preserve keys and declared route mappings rather than infer them from names

**Observable proof**:

The page displays actual connected records and handles empty lists without a Studio
runtime server.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T048` completion through the event-sourced CLI after verifying it.

### T049 — Add initial generation preview and safe first write

**Implementation**:

1. Expose generation.preview/apply with source revision and deterministic owned content
2. Refuse nonempty conflicting output until ownership/promotion feature is available
3. Show file creation diff in Studio and identical structured MCP result

**Observable proof**:

First generation is safe on an empty approved output root; unsupported regeneration is
diagnosed honestly until WP20.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T049` completion through the event-sourced CLI after verifying it.

### T050 — Verify the first authoring-to-output loop

**Implementation**:

1. Use real schema authoring and Grid definition through visible UI
2. Build/run the generated app in an isolated directory with no workspace module
   resolution
3. Compare database reads, route definitions and UI/MCP project state

**Observable proof**:

This is the first demonstrable application milestone; no hidden model seed supplies the
authored page.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T050` completion through the event-sourced CLI after verifying it.

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

Generating a model interpreter tied to Studio or hardcoding a fixture route would repeat
the old demo-specific design.

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
