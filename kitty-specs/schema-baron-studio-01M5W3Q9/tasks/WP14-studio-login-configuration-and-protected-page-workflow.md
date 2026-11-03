---
work_package_id: WP14
title: Studio login configuration and protected-page workflow
dependencies:
- WP11
- WP13
requirement_refs:
- C-002
- FR-004
- FR-014
- FR-015
- FR-016
- FR-017
- NFR-005
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-schema-baron-studio-01M5W3Q9
base_commit: afb272a85ff5848a0c0fe22e1d0b210d8492ac3c
created_at: '2026-10-27T09:40:47.344832+00:00'
subtasks:
- T066
- T067
- T068
- T069
- T070
phase: Generated application
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: apps/studio/src/security-editor/
create_intent:
- apps/studio/src/security-editor/index.tsx
- packages/generator/src/templates/identity-controls/index.ts
- tests/e2e/security-workflow/workflow.spec.ts
execution_mode: code_change
owned_files:
- apps/studio/src/security-editor/**
- packages/generator/src/templates/identity-controls/**
- tests/e2e/security-workflow/**
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

# WP14 — Studio login configuration and protected-page workflow

## Objective and success criteria

Configure simple login through usable project/page/action editors and generate friendly
Login/Logout/identity controls with correct return context.

**Independent demonstration**:

Keep a list public, protect one page and write actions, provision a test user, then log
out and sign back in to the selected record.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-004, FR-014, FR-015, FR-016, FR-017, NFR-005, C-002.

**Dependencies**: WP11, WP13.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP14 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `apps/studio/src/security-editor/**`
- `packages/generator/src/templates/identity-controls/**`
- `tests/e2e/security-workflow/**`

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

### T066 — Build project identity setup and provisioning UI

**Implementation**:

1. Offer simple login and explain managed versus mapped identity source
2. Provide secure user provisioning through the dedicated transient-input service
3. Never display a raw authentication array or store passwords in draft history

**Observable proof**:

A user can set up a working identity source without editing schema/model files or
exposing a default password.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T066` completion through the event-sourced CLI after verifying it.

### T067 — Build global/page/action policy controls

**Implementation**:

1. Show global default, page inheritance/override and stricter action policy
2. Display effective access and where it came from
3. Validate policy changes through the shared model command path

**Observable proof**:

One page can be protected without requiring login for public lists; a protected page
cannot be weakened by its action.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T067` completion through the event-sourced CLI after verifying it.

### T068 — Generate Login/Logout and identity page controls

**Implementation**:

1. Place configurable controls in headers and Login forms
2. Connect them to real session handlers and clear signed-in state
3. Preserve ordinary post-wizard property editing and accessible labels

**Observable proof**:

Header state changes after login/logout without exposing owner tokens or relying on
stale cached identity.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T068` completion through the event-sourced CLI after verifying it.

### T069 — Generate friendly prompts and return context

**Implementation**:

1. Replace raw authentication failures on protected navigation with usable login
   prompts
2. Preserve typed record/filter context and safe public Cancel destinations
3. Surface invalid/expired credentials without dropping unrelated entered state

**Observable proof**:

The selected child record opens after successful login, while external return
destinations are refused.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T069` completion through the event-sourced CLI after verifying it.

### T070 — Verify public-read/protected-write walkthrough

**Implementation**:

1. Drive setup and provisioning through Studio then use the generated app signed out/in
2. Confirm Add/Edit/Delete direct handlers stay protected and list stays public
3. Reopen project and verify policy/control settings remain

**Observable proof**:

Retain screenshots and request evidence for inheritance, logout revocation and safe
resumption.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T070` completion through the event-sourced CLI after verifying it.

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

An empty auth array or a global-only login switch would repeat the original confusion;
expose inherited and effective policy separately.

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
