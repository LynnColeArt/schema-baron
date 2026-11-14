---
work_package_id: WP20
title: Regeneration ownership, authored extensions and recovery
dependencies:
- WP10
- WP12
- WP13
- WP17
- WP19
requirement_refs:
- C-004
- FR-023
- FR-024
- FR-025
- FR-026
- FR-027
- NFR-003
- NFR-006
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T096
- T097
- T098
- T099
- T100
phase: Modes and regeneration
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/generator/src/ownership/
create_intent:
- packages/generator/src/ownership/index.ts
- packages/generator/src/promotion/index.ts
- packages/generator/src/extensions/index.ts
- packages/generator/tests/regeneration/behavior.test.ts
- packages/core/src/extensions/index.ts
- apps/studio/src/source-editor/index.tsx
- tests/e2e/regeneration/workflow.spec.ts
execution_mode: code_change
owned_files:
- packages/generator/src/ownership/**
- packages/generator/src/promotion/**
- packages/generator/src/extensions/**
- packages/generator/tests/regeneration/**
- packages/core/src/extensions/**
- apps/studio/src/source-editor/**
- tests/e2e/regeneration/**
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

# WP20 — Regeneration ownership, authored extensions and recovery

## Objective and success criteria

Regenerate complete output without overwriting data/custom code, with visible conflicts
and recovery from interrupted promotion.

**Independent demonstration**:

Add a handwritten validator/action, change a form, preview/regenerate twice and preserve
extension bytes plus database contents; inject a promotion failure and recover.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-023, FR-024, FR-025, FR-026, FR-027, NFR-003, NFR-006, C-004.

**Dependencies**: WP10, WP12, WP13, WP17, WP19.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP20 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/generator/src/ownership/**`
- `packages/generator/src/promotion/**`
- `packages/generator/src/extensions/**`
- `packages/generator/tests/regeneration/**`
- `packages/core/src/extensions/**`
- `apps/studio/src/source-editor/**`
- `tests/e2e/regeneration/**`

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

### T096 — Implement deterministic ownership manifests

**Implementation**:

1. Record model/generator hashes and owned file content hashes
2. Classify authored extensions, unknown files, deleted routes and modified owned files
3. Produce created/changed/deleted/conflict previews tied to current source revision

**Observable proof**:

Unchanged inputs produce identical owned source; unknown or edited files are never
silently overwritten.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T096` completion through the event-sourced CLI after verifying it.

### T097 — Implement authored extension contracts and editing

**Implementation**:

1. Generate explicit validator/service/event extension modules and versioned signatures
2. Provide extension.read/write with approved paths and expected file hashes
3. Connect Code mode to owned read-only source and editable authored files

**Observable proof**:

A custom extension compiles and executes in generated output while its exact source
remains preserved.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T097` completion through the event-sourced CLI after verifying it.

### T098 — Implement staged complete output promotion

**Implementation**:

1. Stage on the same filesystem and copy/hash authored files without data/secrets
2. Stop managed preview before swap through the runtime lifecycle port
3. Journal old/new trees and recover interrupted rename/promotion before allowing
   another apply

**Observable proof**:

An interruption cannot leave a partial active source tree or delete unrelated
application data.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T098` completion through the event-sourced CLI after verifying it.

### T099 — Resolve ownership conflicts and upgrades visibly

**Implementation**:

1. Show source conflicts and extension-interface compatibility failures before apply
2. Require intentional resolution and fresh preview rather than blanket overwrite
3. Preserve migration history and stable external data/secret references across output
   changes

**Observable proof**:

Deleting a page removes only owned files after review; modified owned source remains
recoverable.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T099` completion through the event-sourced CLI after verifying it.

### T100 — Verify preservation and standalone output

**Implementation**:

1. Compare data counts/checksums and authored file bytes through two regeneration
   cycles
2. Build and run exports with no Studio package or workspace import
3. Inject failures around each promotion/journal boundary and test stale apply requests

**Observable proof**:

Generated apps remain runnable and preservation is proven independently, including a
functioning handwritten hook.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T100` completion through the event-sourced CLI after verifying it.

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

Generated source changes, authored extensions and live application data require
different ownership; never resolve a conflict by silently replacing files.

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
