---
work_package_id: WP13
title: Generated identity store, sessions and access enforcement
dependencies:
- WP12
requirement_refs:
- C-004
- C-007
- FR-015
- FR-016
- FR-017
- NFR-004
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T061
- T062
- T063
- T064
- T065
phase: Generated application
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: packages/generator/src/templates/auth/
create_intent:
- packages/generator/src/templates/auth/index.ts
- packages/generator/tests/auth/behavior.test.ts
- packages/core/src/identity/index.ts
- packages/core/tests/identity/behavior.test.ts
- tests/integration/generated-auth/behavior.test.ts
execution_mode: code_change
owned_files:
- packages/generator/src/templates/auth/**
- packages/generator/tests/auth/**
- packages/core/src/identity/**
- packages/core/tests/identity/**
- tests/integration/generated-auth/**
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

# WP13 — Generated identity store, sessions and access enforcement

## Objective and success criteria

Provide secure simple local login and server enforcement of explicit global/page/action
policies, independent of Studio owner credentials.

**Independent demonstration**:

Provision a user, sign in/out, make direct protected requests and confirm public list
reads remain available while anonymous writes fail.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-015, FR-016, FR-017, NFR-004, C-004, C-007.

**Dependencies**: WP12.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP13 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/generator/src/templates/auth/**`
- `packages/generator/tests/auth/**`
- `packages/core/src/identity/**`
- `packages/core/tests/identity/**`
- `tests/integration/generated-auth/**`

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

### T061 — Implement identity source and provisioning service

**Implementation**:

1. Support managed auth storage and explicit compatible mapped identity sources
2. Provision versioned salted scrypt hashes through an owner-protected transient-input
   operation
3. Keep passwords out of project JSON, idempotency payload logs and generated clients

**Observable proof**:

A provisioning test verifies salt/hash behavior and redacted logs without relying on a
default demo user.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T061` completion through the event-sourced CLI after verifying it.

### T062 — Generate opaque session lifecycle

**Implementation**:

1. Create random session tokens with hashed server storage, expiry and rotation at
   login
2. Revoke on logout and apply HttpOnly/SameSite cookies with explicit local/HTTPS
   behavior
3. Add consistent failed-login errors and bounded rate limits

**Observable proof**:

Old rotated/revoked tokens cannot access protected resources; failed login does not
reveal account existence.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T062` completion through the event-sourced CLI after verifying it.

### T063 — Enforce effective read and action policies

**Implementation**:

1. Compile global/page inheritance and action tightening into server checks
2. Validate direct requests before database operations and isolate project identity
   stores
3. Keep rendering visibility as a convenience only

**Observable proof**:

Anonymous direct writes and protected reads fail even if a UI control is manually
exposed.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T063` completion through the event-sourced CLI after verifying it.

### T064 — Validate CSRF and login return targets

**Implementation**:

1. Check origin/CSRF for state-changing runtime requests
2. Restrict return targets to declared internal routes and typed allowed parameters
3. Preserve legitimate selected-record context across authentication

**Observable proof**:

Forged cross-origin writes and external redirect targets fail; valid return context
still works.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T064` completion through the event-sourced CLI after verifying it.

### T065 — Verify auth boundaries independently

**Implementation**:

1. Send direct HTTP cases for anonymous writes, expiry/revocation, CSRF and forged keys
2. Scan exports/logs/browser bundles for secrets
3. Run generated production build and ensure Studio author capability cannot become
   visitor identity

**Observable proof**:

Security results are executable evidence; hashing alone is not reported as complete
authentication.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T065` completion through the event-sourced CLI after verifying it.

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

Default passwords, plaintext legacy identity mapping, client-only enforcement and unsafe
return URLs are unacceptable shortcuts.

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
