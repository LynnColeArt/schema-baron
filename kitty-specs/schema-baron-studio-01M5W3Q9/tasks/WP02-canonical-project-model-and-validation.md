---
work_package_id: WP02
title: Canonical project model and validation
dependencies:
- WP01
requirement_refs:
- C-003
- C-007
- FR-001
- FR-003
- FR-007
- FR-008
- FR-011
- FR-016
- FR-018
- FR-020
- FR-029
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Foundation
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: packages/model/src/
create_intent:
- packages/model/src/index.ts
- packages/model/tests/index.ts
- fixtures/model/project.json
execution_mode: code_change
owned_files:
- packages/model/src/**
- packages/model/tests/**
- fixtures/model/**
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

# WP02 — Canonical project model and validation

## Objective and success criteria

Define runtime-validated versioned entities and invariants for all downstream features,
independent of React, filesystem and transports.

**Independent demonstration**:

Validate two unrelated project definitions, reject broken key tuples and ambiguous query
grain, and retain IDs through a physical-name change.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-001, FR-003, FR-007, FR-008, FR-011, FR-016, FR-018, FR-020, FR-029, C-003, C-007.

**Dependencies**: WP01.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP02 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `packages/model/src/**`
- `packages/model/tests/**`
- `fixtures/model/**`

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

### T006 — Define versioned entities and identity

**Implementation**:

1. Implement Project, Connection, Schema, Page, Form, Control, Action and Policy
   schemas
2. Add opaque stable IDs, physical names, target/version and revision metadata
3. Reject unknown fields and unsupported newer formats without mutating input

**Observable proof**:

Fixture renaming preserves references and unsupported versions produce
UNSUPPORTED_FORMAT.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T006` completion through the event-sourced CLI after verifying it.

### T007 — Define query and expression contracts

**Implementation**:

1. Represent aliases, joins, projections, typed parameters, grouping/HAVING and result
   shape
2. Include constrained arithmetic/functions, decimal scale/encoding and declared
   aggregate grain
3. Define read-only derived bindings and explicit source dependencies

**Observable proof**:

Invalid aggregate grouping, duplicate output IDs, unsafe expression nodes and
conflicting stored/derived definitions fail validation.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T007` completion through the event-sourced CLI after verifying it.

### T008 — Validate cross-entity relationships

**Implementation**:

1. Check every page/form/control/action/source/key reference and route uniqueness
2. Validate ordered composite PK/FK arity and type compatibility
3. Derive effective access with global/page inheritance and action tightening

**Observable proof**:

Broken references and incompatible controls return stable object-linked diagnostics;
action policy cannot weaken a protected page.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T008` completion through the event-sourced CLI after verifying it.

### T009 — Define command and reviewed-plan types

**Implementation**:

1. Add operation envelopes, diagnostic codes, typed results and entity-batch unions
2. Model migration/generation fingerprints, hashes, expiry and exact impact
   acknowledgements
3. Keep secrets as references; never include plaintext passwords in persisted schemas

**Observable proof**:

Malformed operations fail at runtime validation, not only compilation; preview and apply
payloads are distinguishable.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T009` completion through the event-sourced CLI after verifying it.

### T010 — Verify generality and boundary behavior

**Implementation**:

1. Create diverse fixture definitions with reserved identifiers, composite keys and
   nullable relationships
2. Assert normalization/serialization preserves meanings and IDs
3. Confirm model code has no imports from UI, SQLite or acceptance-specific schema
   constants

**Observable proof**:

Model tests include negative cases and both domains; fixture identifiers occur only in
fixtures/tests.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T010` completion through the event-sourced CLI after verifying it.

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

An underspecified model forces later schema-specific patches; separate stable IDs from
physical names and keep drafts distinct from valid committed snapshots.

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
