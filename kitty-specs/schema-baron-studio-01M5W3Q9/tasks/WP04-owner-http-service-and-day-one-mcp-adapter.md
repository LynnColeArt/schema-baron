---
work_package_id: WP04
title: Owner HTTP service and day-one MCP adapter
dependencies:
- WP03
requirement_refs:
- C-003
- FR-001
- FR-028
- FR-029
- NFR-004
- NFR-007
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T016
- T017
- T018
- T019
- T020
phase: Foundation
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: apps/studio/src/server/
create_intent:
- apps/studio/src/server/index.tsx
- apps/studio/app/api/index.ts
- apps/mcp/src/index.ts
- apps/mcp/tests/index.ts
- packages/core/tests/transport/behavior.test.ts
- docs/development/operations.md
execution_mode: code_change
owned_files:
- apps/studio/src/server/**
- apps/studio/app/api/**
- apps/mcp/src/**
- apps/mcp/tests/**
- packages/core/tests/transport/**
- docs/development/operations.md
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

# WP04 — Owner HTTP service and day-one MCP adapter

## Objective and success criteria

Expose the same implemented commands to the browser and local MCP with one project
writer and matching outcomes.

**Independent demonstration**:

Create/inspect/change a project via UI transport and MCP, compare normalized state and
diagnostics, and reject a stale mutation in both.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: FR-001, FR-028, FR-029, NFR-004, NFR-007, C-003.

**Dependencies**: WP03.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP04 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `apps/studio/src/server/**`
- `apps/studio/app/api/**`
- `apps/mcp/src/**`
- `apps/mcp/tests/**`
- `packages/core/tests/transport/**`
- `docs/development/operations.md`

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

### T016 — Implement the versioned owner HTTP adapter

**Implementation**:

1. Implement OpenAPI envelope/status mappings and strict operation-specific dispatch
2. Bind loopback only and authenticate an owner capability with same-origin browser
   session exchange
3. Apply origin checks, path scopes, secret redaction and payload limits

**Observable proof**:

Unauthorized cross-origin or unscoped requests cannot read project state or mutate
files.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T016` completion through the event-sourced CLI after verifying it.

### T017 — Implement local MCP forwarding

**Implementation**:

1. Expose implemented operations with names matching commands.md and schemas generated
   from the registry
2. Forward through authenticated loopback and never instantiate project storage in the
   MCP process
3. Separate diagnostics from protocol stdout and return unknown-capability errors
   honestly

**Observable proof**:

A real MCP client observes the same revision and error codes as HTTP; no independent
SQLite writer is created.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T017` completion through the event-sourced CLI after verifying it.

### T018 — Add job and sequenced-event endpoints

**Implementation**:

1. Expose job inspect/cancel and project event replay from core ports
2. Map running/failed/committed/canceled outcomes accurately
3. Make client event-gap recovery explicit instead of silently applying stale events

**Observable proof**:

Cancel after a commit reports the committed result; disconnected clients can refetch a
correct snapshot.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T018` completion through the event-sourced CLI after verifying it.

### T019 — Provide extensible feature registration

**Implementation**:

1. Define a typed service-composition seam for later schema/query/generator operations
2. Ensure feature registration cannot bypass core validation, owner policy or plan
   freshness
3. Document minimal serialized integration edits to shared registration files

**Observable proof**:

New features register their validators/handlers through the same service, without a
catch-all raw SQL/filesystem escape hatch.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T019` completion through the event-sourced CLI after verifying it.

### T020 — Verify transport parity and access boundaries

**Implementation**:

1. Replay one shared valid/invalid/stale command corpus through HTTP and MCP
2. Assert identical normalized state, revision and diagnostic codes
3. Test forged owner capability, malformed input, duplicate request ID and missing
   feature

**Observable proof**:

All parity cases pass; request failures produce zero partial writes and logs contain no
secrets.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T020` completion through the event-sourced CLI after verifying it.

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

Loopback is not authentication; the MCP process must forward to the owner service rather
than open another mutable project store.

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
