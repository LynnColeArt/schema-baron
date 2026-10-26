---
work_package_id: WP26
title: Clean-install documentation and mission readiness
dependencies:
- WP24
- WP25
requirement_refs:
- C-001
- C-004
- C-005
- C-006
- C-008
- FR-027
- FR-030
- NFR-006
- NFR-010
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T126
- T127
- T128
- T129
phase: Acceptance and readiness
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: scripts/release/
create_intent:
- docs/user-guide/index.md
- docs/development/release.md
- scripts/release/verify.mjs
- tests/integration/clean-install/behavior.test.ts
execution_mode: code_change
owned_files:
- README.md
- docs/user-guide/**
- docs/development/release.md
- scripts/release/**
- tests/integration/clean-install/**
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

# WP26 — Clean-install documentation and mission readiness

## Objective and success criteria

Leave a documented runnable product and independently buildable output with complete
requirement/evidence reconciliation, without premature merge or publication.

**Independent demonstration**:

Follow only published prerequisites/instructions from a clean checkout, build/run Studio
and both exports, then reconcile every requirement against real evidence.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-027, FR-030, NFR-006, NFR-010, C-001, C-004, C-005, C-006, C-008.

**Dependencies**: WP24, WP25.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP26 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `README.md`
- `docs/user-guide/**`
- `docs/development/release.md`
- `scripts/release/**`
- `tests/integration/clean-install/**`

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

### T126 — Write the author and extension guides

**Implementation**:

1. Document project/schema/page/form/control/query/flow workflows and supported
   boundaries
2. Explain login inheritance, safe migration/restore, output conflicts and extension
   ownership
3. Link the local manual-pack builder without redistributing its PDF or derivatives

**Observable proof**:

A reader can understand what each document mode edits and recover from a failed apply
using product controls.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T126` completion through the event-sourced CLI after verifying it.

### T127 — Verify clean checkout and exported runtime procedures

**Implementation**:

1. Run supported pinned setup using the documented native/script policies
2. Build/start Studio and exported apps with no unpublished service or workspace import
3. Verify offline core after install and secret-free portable configuration

**Observable proof**:

A clean environment follows the guide successfully; dependency scans/build/test results
refer to exact versions.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T127` completion through the event-sourced CLI after verifying it.

### T128 — Reconcile requirements and release limitations

**Implementation**:

1. Collect FR/NFR/C evidence from package reports and acceptance matrix
2. Confirm all mandatory scope is implemented or report explicit incomplete
   requirements
3. Document tested support boundaries, recovery procedures and genuine residual risks

**Observable proof**:

No missing case is labeled complete because its package was merged; final coverage uses
observed results.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T128` completion through the event-sourced CLI after verifying it.

### T129 — Prepare review handoff without publication

**Implementation**:

1. Run relevant final typecheck/build/behavior/clean-install checks and summarize
   evidence
2. Preserve prior archive and keep work on the mission feature-branch contract
3. Prepare user-visible release notes and PR-ready summary; do not merge/publish
   without the execution workflow and user scope

**Observable proof**:

The result is concrete and reviewable, with no default credentials, hidden runtime
dependency or unsolicited deployment.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T129` completion through the event-sourced CLI after verifying it.

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

A README that assumes a developer working tree, hidden service or private fixture is not
a clean-install experience.

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
