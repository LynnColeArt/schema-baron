---
work_package_id: WP25
title: Workspace fidelity, keyboard access and measured scale
dependencies:
- WP18
- WP19
- WP21
- WP23
requirement_refs:
- C-002
- C-006
- FR-002
- FR-005
- FR-022
- NFR-001
- NFR-002
- NFR-005
- NFR-008
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T121
- T122
- T123
- T124
- T125
phase: Acceptance and readiness
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: tests/e2e/usability/
create_intent:
- tests/e2e/usability/workflow.spec.ts
- tests/performance/behavior.test.ts
- fixtures/scale/project.json
- docs/evidence/usability/report.md
execution_mode: code_change
owned_files:
- tests/e2e/usability/**
- tests/performance/**
- fixtures/scale/**
- docs/evidence/usability/**
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

# WP25 — Workspace fidelity, keyboard access and measured scale

## Objective and success criteria

Measure editing/query budgets and verify the early-Studio density and complete
keyboard/zoom workflows with retained evidence.

**Independent demonstration**:

Run the declared 50-page/200-form/1,000-control, 50-table and 100-node fixtures,
complete keyboard journeys and review screenshots at required sizes.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-002, FR-005, FR-022, NFR-001, NFR-002, NFR-005, NFR-008, C-002, C-006.

**Dependencies**: WP18, WP19, WP21, WP23.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP25 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `tests/e2e/usability/**`
- `tests/performance/**`
- `fixtures/scale/**`
- `docs/evidence/usability/**`

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

### T121 — Create reproducible scale and timing fixtures

**Implementation**:

1. Build test-only 50-page/200-form/1,000-control and 50-table/500-column models
2. Add 100-node map and 10,000-row indexed list fixtures
3. Record CPU/RAM/OS/browser/runtime, warm-up and sample collection procedure

**Observable proof**:

Fixtures are performance tests, not hidden acceptance app setup; timing reports contain
raw distributions and sample counts.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T121` completion through the event-sourced CLI after verifying it.

### T122 — Measure response and data-read budgets

**Implementation**:

1. Measure at least 30 selection/property operations and service-ready reopen
2. Measure indexed paging p95 and graph editing continuity
3. Check NFR-001/002 thresholds without replacing real render/DB work with mocks

**Observable proof**:

Report actual p95 and reopen/query results; unmet budgets remain failures with traces,
not rounded-away averages.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T122` completion through the event-sourced CLI after verifying it.

### T123 — Complete keyboard and zoom walkthroughs

**Implementation**:

1. Exercise project/schema/wizard/query/policy/map/mode/generation workflows without
   pointer dependence
2. Verify visible focus, labels, dialogs and 200% zoom at 1280×800
3. Assert 20 repeated edits preserve drafts/selection and navigation

**Observable proof**:

Keyboard alternatives reach the same semantic operations and do not omit advanced schema
relationships.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T123` completion through the event-sourced CLI after verifying it.

### T124 — Review historical workspace fidelity

**Implementation**:

1. Capture 1280×800 and 1920×1080 screenshots with five docked regions and modes
2. Compare against indexed manual pages and annotate intentional modernization
3. Verify no persistent project wizard occupies normal page editing

**Observable proof**:

Evidence distinguishes user-facing simplicity from a later noisy builder catalog;
private manual derivatives are not committed.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T124` completion through the event-sourced CLI after verifying it.

### T125 — Triage and verify usability regressions

**Implementation**:

1. Report exact state/action/measurement for focus, rendering, contrast or performance
   defects
2. Coordinate narrowly justified fixes with owning UI/package surfaces
3. Repeat affected checks and publish pass/fail with remaining limitations

**Observable proof**:

Do not declare quality budgets achieved until measured/reviewed evidence is retained.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T125` completion through the event-sourced CLI after verifying it.

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

Screenshot resemblance alone can hide unusable focus behavior, expensive graph rerenders
and loss of drafts under scale.

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
