---
work_package_id: WP21
title: Managed runtime jobs, Live Page and portable export
dependencies:
- WP04
- WP20
requirement_refs:
- FR-001
- FR-023
- FR-027
- FR-029
- NFR-004
- NFR-010
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: 173ba10b6c7176f45fc1fc597b05d869bad0a8c0
created_at: '2026-10-27T11:12:48.301761+00:00'
subtasks:
- T101
- T102
- T103
- T104
- T105
phase: Modes and regeneration
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/core/src/runtime/
create_intent:
- packages/core/src/runtime/index.ts
- packages/core/src/export/index.ts
- packages/core/tests/runtime/behavior.test.ts
- packages/core/tests/export/behavior.test.ts
- apps/studio/src/runtime-ui/index.tsx
- tests/e2e/runtime-export/workflow.spec.ts
execution_mode: code_change
owned_files:
- packages/core/src/runtime/**
- packages/core/src/export/**
- packages/core/tests/runtime/**
- packages/core/tests/export/**
- apps/studio/src/runtime-ui/**
- tests/e2e/runtime-export/**
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

# WP21 — Managed runtime jobs, Live Page and portable export

## Objective and success criteria

Build/run/stop generated applications explicitly, navigate the selected Live Page and
export portable output without Studio dependencies or secrets.

**Independent demonstration**:

Start a generated app, open the selected route, stop it cleanly and export to a clean
directory that builds/runs after Studio is shut down.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-001, FR-023, FR-027, FR-029, NFR-004, NFR-010.

**Dependencies**: WP04, WP20.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP21 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/core/src/runtime/**`
- `packages/core/src/export/**`
- `packages/core/tests/runtime/**`
- `packages/core/tests/export/**`
- `apps/studio/src/runtime-ui/**`
- `tests/e2e/runtime-export/**`

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

### T101 — Implement explicit build/start process jobs

**Implementation**:

1. Display executable/arguments, approved working directory and requested intent
2. Manage process groups, cancellation, exit codes and bounded redacted logs
3. Do not install dependencies or execute project scripts merely on project open

**Observable proof**:

Failed build yields an actionable failed job; no orphan child continues after
cancellation/stop.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T101` completion through the event-sourced CLI after verifying it.

### T102 — Implement runtime status and route resolution

**Implementation**:

1. Track output revision, port and ready/failed/stopped state
2. Resolve the selected page route plus typed key/filter parameters
3. Coordinate promotion stop/restart through the existing lifecycle seam

**Observable proof**:

Live Page targets the corresponding generated app/page, not the Studio route or a stale
port.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T102` completion through the event-sourced CLI after verifying it.

### T103 — Build runtime controls and diagnostics UI

**Implementation**:

1. Show build/start/stop status and object-linked errors near document modes
2. Distinguish current draft, generated revision and running revision
3. Offer clear retry behavior after port collision or build failure

**Observable proof**:

The user can understand stale Live Page output and intentionally rebuild without losing
current drafts.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T103` completion through the event-sourced CLI after verifying it.

### T104 — Implement portable definition/output export

**Implementation**:

1. Rewrite locators to documented portable configuration and secret placeholders
2. Exclude credentials and DB data by default, with explicit reviewed include-data
   option
3. Copy authored code/manifest and include independent build/run/test documentation

**Observable proof**:

Export has no absolute Studio-only dependency and cannot overwrite an unapproved
destination.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T104` completion through the event-sourced CLI after verifying it.

### T105 — Verify processes, exports and offline authoring

**Implementation**:

1. Exercise start/stop/cancel, failed scripts, port conflict and symlink/path rejection
2. Run exported apps from separate directories with Studio service stopped
3. Test offline core after dependency installation and scan exports for secrets

**Observable proof**:

No credentials or stale processes leak; output continues to serve its own data without
Studio.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T105` completion through the event-sourced CLI after verifying it.

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

Opening a model must not automatically run install scripts or authored code; process
cleanup and data locations must be explicit.

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
