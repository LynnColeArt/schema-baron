---
work_package_id: WP01
title: Reproducible workspace and dependency baseline
dependencies: []
requirement_refs:
- C-001
- C-005
- C-006
- NFR-006
- NFR-010
planning_base_branch: feat/schema-baron-studio
merge_target_branch: feat/schema-baron-studio
branch_strategy: Planning artifacts for this mission were generated on feat/schema-baron-studio. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/schema-baron-studio unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
phase: Foundation
history:
- at: '2026-10-26T13:35:53Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: scripts/workspace/
create_intent:
- package.json
- package-lock.json
- .npmrc
- .nvmrc
- tsconfig.base.json
- vitest.config.ts
- playwright.config.ts
- .github/workflows/checks.yml
- scripts/workspace/verify.mjs
- docs/development/bootstrap.md
- apps/studio/package.json
- apps/studio/tsconfig.json
- apps/studio/next.config.ts
- apps/mcp/package.json
- apps/mcp/tsconfig.json
- packages/model/package.json
- packages/model/tsconfig.json
- packages/core/package.json
- packages/core/tsconfig.json
- packages/storage/package.json
- packages/storage/tsconfig.json
- packages/sqlite/package.json
- packages/sqlite/tsconfig.json
- packages/generator/package.json
- packages/generator/tsconfig.json
- packages/ui/package.json
- packages/ui/tsconfig.json
execution_mode: code_change
owned_files:
- package.json
- package-lock.json
- .npmrc
- .nvmrc
- tsconfig.base.json
- vitest.config.ts
- playwright.config.ts
- .github/workflows/checks.yml
- scripts/workspace/**
- docs/development/bootstrap.md
- apps/studio/package.json
- apps/studio/tsconfig.json
- apps/studio/next.config.ts
- apps/mcp/package.json
- apps/mcp/tsconfig.json
- packages/model/package.json
- packages/model/tsconfig.json
- packages/core/package.json
- packages/core/tsconfig.json
- packages/storage/package.json
- packages/storage/tsconfig.json
- packages/sqlite/package.json
- packages/sqlite/tsconfig.json
- packages/generator/package.json
- packages/generator/tsconfig.json
- packages/ui/package.json
- packages/ui/tsconfig.json
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

# WP01 — Reproducible workspace and dependency baseline

## Objective and success criteria

A clean checkout has a pinned, compatible TypeScript/Node workspace and repeatable
verification tools, without creating application features or importing old demo secrets.

**Independent demonstration**:

On the declared Node 24 patch, install the reviewed lockfile with scripts denied by
default, compile a temporary minimal module and run the test harness offline after
dependency installation.

## Context and contracts

- Read [the specification](../spec.md), [plan](../plan.md) and [data model](../data-model.md).
- Use [shared commands](../contracts/commands.md) and [OpenAPI](../contracts/openapi.json).
- [Acceptance matrix](../contracts/acceptance-matrix.md) defines evidence, not completed tests.
- [Research](../research.md) distinguishes observed dependency versions from verified installs.
- The early Studio visual pack is indexed in `docs/references/manual-index.json`.
- Referenced repository paths resolve from the lane checkout root; never from the old repo.

**Requirement refs**: NFR-006, NFR-010, C-001, C-005, C-006.

**Dependencies**: None.
Consume their approved interfaces and real behavior, not copied private implementations.

## Branch strategy

- Planning/base branch: `feat/schema-baron-studio`.
- Mission consolidation/merge target: `feat/schema-baron-studio`.
- Later user-facing PR target: `main`.
- Execution worktrees belong to computed lanes in `lanes.json`; do not create a WP branch manually.
- Run the mandatory analysis readiness gate before any implementation claim.
- Start via `spec-kitty agent action implement WP01 --agent codex --mission schema-baron-studio-01M5W3Q9`.
- Use the workspace/branch returned by the runtime; do not assume the planning checkout is execution.

## Ownership and integration

- `package.json`
- `package-lock.json`
- `.npmrc`
- `.nvmrc`
- `tsconfig.base.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `.github/workflows/checks.yml`
- `scripts/workspace/**`
- `docs/development/bootstrap.md`
- `apps/studio/package.json`
- `apps/studio/tsconfig.json`
- `apps/studio/next.config.ts`
- `apps/mcp/package.json`
- `apps/mcp/tsconfig.json`
- `packages/model/package.json`
- `packages/model/tsconfig.json`
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/storage/package.json`
- `packages/storage/tsconfig.json`
- `packages/sqlite/package.json`
- `packages/sqlite/tsconfig.json`
- `packages/generator/package.json`
- `packages/generator/tsconfig.json`
- `packages/ui/package.json`
- `packages/ui/tsconfig.json`

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

### T001 — Pin and verify the dependency set

**Implementation**:

1. Read research.md registry observations and verify exact supported patches against
   official registries
2. Record publish times, repository/provenance, advisory and incident checks for direct
   and transitive dependencies
3. Run the deferred adversarial dependency challenge under its skill and disposition
   all findings before readiness; allow only explicitly reviewed native build steps

**Observable proof**:

A committed report records exact versions, integrity and lifecycle decisions; no blanket
ignore-safety flag or unverified latest install.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T001` completion through the event-sourced CLI after verifying it.

### T002 — Create the workspace manifests and build contracts

**Implementation**:

1. Create npm workspaces for the two apps and planned packages with explicit exports
2. Pin Node and package-manager behavior, strict TypeScript, server/client boundaries
   and script policy
3. Keep root scripts able to discover implemented workspaces without requiring future
   code stubs

**Observable proof**:

Clean install and typecheck operate on real implemented modules; missing future features
are not reported as implemented.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T002` completion through the event-sourced CLI after verifying it.

### T003 — Provide the verification and CI harness

**Implementation**:

1. Configure Vitest, Playwright and a portable clean-output test runner
2. Add CI entry points for typecheck, tests, production builds when apps exist and
   credential scans
3. Ensure generated-app checks run outside workspace resolution and report missing
   implementation honestly

**Observable proof**:

A deliberately failing temporary fixture makes the harness fail; no empty-test success
is used as product evidence.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T003` completion through the event-sourced CLI after verifying it.

### T004 — Document local prerequisites and isolation

**Implementation**:

1. Describe runtime setup, native SQLite prerequisites, script allowlist, browser
   installation and offline limits
2. Separate private local project/data/output paths and public evidence
3. Record how package-specific scripts plug into root checks without multiple lockfiles

**Observable proof**:

A new contributor can reproduce the harness without unpublished services, the manual PDF
or archived credentials.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T004` completion through the event-sourced CLI after verifying it.

### T005 — Verify bootstrap and supply-chain readiness

**Implementation**:

1. Exercise install and native SQLite smoke checks on the pinned runtime
2. Compare installed metadata to the lockfile and record dependency challenge outcomes
3. Retain redacted commands and results in docs/development/bootstrap.md

**Observable proof**:

The report distinguishes successful checks from deferred checks; unresolved supply-chain
findings block bootstrap readiness, not silently disappear.

**Completion record**:
- Retain the command or visible action, actual outcome and relevant redacted artifact.
- Include invalid/stale/failure behavior where this subtask changes a boundary.
- Record `T005` completion through the event-sourced CLI after verifying it.

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

Planning version observations are not a validated install set; native lifecycle scripts
and fresh releases need actual evidence, not an audit claim copied from research.

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

## Activity Log

- 2026-10-27T01:00:37Z – codex – Acknowledged review-cycle-1 R1 [P1]: public npm check:generated inherits workspace and ancestor executable PATH, allowing undeclared tsc. Repairing isolated npm execution environment and adding actual public-entry missing-tool and independently-installed-tool regressions. No product behavior acceptance claimed.
- 2026-10-27T01:04:25Z – codex – Addressed review-cycle-1 R1 in c084f4e: absolute selected Node/npm CLI; temporary toolchain plus OS PATH; allowlisted environment; isolated npm configs/prefix; ancestor-bin refusal. Public npm regression observed red before repair, now undeclared tsc fails and independently installed pinned TS compiles offline. Full verify passes 11 tests, strict config/harness typecheck, scoped diff lint, native smoke, credentials and dependency match. Wider historical lint base hits absent runtime-managed status snapshots; scoped repair lint passes. No product claims or dependency changes.
