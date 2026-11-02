---
work_package_id: WP07
title: Source regeneration and independent output
dependencies:
- WP06
requirement_refs:
- C-001
- C-003
- C-005
- FR-006
- FR-009
- FR-010
- FR-011
- FR-012
- FR-014
- FR-017
- NFR-001
- NFR-002
planning_base_branch: feat/studio-verification-hardening
merge_target_branch: feat/studio-verification-hardening
branch_strategy: Single-branch mission on feat/studio-verification-hardening; use runtime lanes.json allocation, never create per-WP branches manually.
subtasks:
- T031
- T032
- T033
- T034
- T035
phase: Acceptance and hardening
history:
- at: '2026-11-02T12:41:25Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: tests/e2e/acceptance/
create_intent:
- tests/e2e/acceptance/regeneration.spec.ts
- tests/e2e/acceptance/independence.spec.ts
execution_mode: code_change
owned_files:
- tests/e2e/acceptance/regeneration.spec.ts
- tests/e2e/acceptance/independence.spec.ts
- apps/studio/src/source-editor/**
- apps/studio/src/generation/**
- apps/studio/src/runtime-ui/**
- packages/generator/src/compiler/**
- packages/generator/src/ownership/**
- packages/generator/src/templates/grid/**
- packages/generator/src/templates/record/**
- packages/generator/tests/record/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Use `/ad-hoc-profile-load` (canonical `spk-doctrine-profile-load`) to load the
frontmatter profile before parsing this prompt and follow its scope.

- **Profile**: `implementer-ivan`
- **Role**: `implementer`
- **Agent/tool**: `codex`

# WP07 — Source regeneration and independent output

## Objective and independent success condition

Prove Studio-supported customization survives two regenerations and exported apps run independently with private data and identity external to replaceable source.

**Priority**: P1; all mapped mandatory behaviors block the mission finish line.
**Cases**: AC-011, AC-012, AC-013, AC-016.
**Requirements**: FR-006, FR-009, FR-010, FR-011, FR-012, FR-014, FR-017, NFR-001, NFR-002, C-001, C-003, C-005.
**Dependencies**: WP06.

## Required context

- [Specification](../spec.md) defines immutable acceptance intent and finish line.
- [Plan](../plan.md) identifies the existing architecture and targeted repair policy.
- [Fixture data model](../data-model.md) is the independent expected-result source.
- [Acceptance checklist](../checklists/acceptance.md) is not precompleted evidence.
- [Run contract](../contracts/acceptance-run.md) separates UI/fault/parity/review modes.
- [Evidence schema](../contracts/evidence.schema.json) defines observation shape.
- [Quickstart](../quickstart.md) must remain honest about implemented commands.
- Baseline milestone SHA: `fe22d9b06be0967b1dec89c352d2979787330f34`.

## Branch strategy

- Planning/base branch: `feat/studio-verification-hardening`.
- Mission integration/merge target: `feat/studio-verification-hardening`.
- Topology: single_branch; consult generated `lanes.json` and runtime workspace resolution.
- Do not invent a per-WP worktree or branch; use the returned execution location.
- Run required cross-artifact analysis before claiming implementation.
- Start: `spec-kitty agent action implement WP07 --agent codex --mission studio-verification-hardening-01M6AQ6R`.
- Event-sourced status is authoritative; do not add status checkboxes to task references.
- GitHub PR base is separate from Spec Kitty's mission target; no merge is requested.

## Ownership and shared repairs

Primary paths:

- `tests/e2e/acceptance/regeneration.spec.ts`
- `tests/e2e/acceptance/independence.spec.ts`
- `apps/studio/src/source-editor/**`
- `apps/studio/src/generation/**`
- `apps/studio/src/runtime-ui/**`
- `packages/generator/src/compiler/**`
- `packages/generator/src/ownership/**`
- `packages/generator/src/templates/grid/**`
- `packages/generator/src/templates/record/**`
- `packages/generator/tests/record/**`

Keep new tests/scripts in these paths; reuse predecessor contracts and public helpers.
The no-overlap ownership map keeps packages reviewable even in a single execution lane.
Unknown defects cannot be preassigned to every possible source file.
If a reproduced failure needs another package's source, coordinate with that owner,
record the narrow edit and one-line rationale in the defect record, and sequence it.
Do not bypass a missing UI control to keep a test green.
Do not rewrite model/storage/generation architecture for hypothetical future requirements.

## Execution and evidence rules

- This is verification work: tests and real browser walkthroughs are explicitly requested.
- Start with a red observation for a newly discovered gap, not a speculative fix.
- Fix shared product semantics; never branch on Workshop/Library table names.
- Ordinary project/schema/query/access/navigation/source authoring uses Studio controls.
- No project.batch, seeded project JSON or terminal source/DB patch may rescue a UI pass.
- Read-only observers may inspect durable outcomes and calculate independent expected values.
- Fault/parity cases have separate mode and fixture identity; do not mix their proof with UI journeys.
- Keep raw DBs, identity, capabilities, passwords and unredacted traces out of Git.
- Keep prior failed observations when a repair/retest succeeds.
- All mandatory outcomes must pass; skipped/blocked/unverified are not success.
- Use the pinned tools and denied lifecycle scripts; no upgrades are authorized.
- Preserve the user's live Workshop Planner and other study projects.
- Await each dependency acquisition/build/start/stop/regeneration before its consumer.
- Stop only recorded owned child processes; do not broadly kill ports or Node processes.
- No automatic merge, deployment or modification of milestone PR #1.

## Subtasks

### T031 — Reproduce Code-mode output selection

**Purpose and method**:

Cold-open generated source for a project whose outputConfig differs from output:app. Verify visible destination and real file tree. Record whether the candidate hardcoded default is actually a failure; repair a confirmed mismatch using shared project settings.

**Independent pass condition**:

Code mode and Generate reference the same intended project output; opening another project cannot read or edit the previous output by accident.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T031` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T032 — Declare and edit an authored extension through UI

**Purpose and method**:

Use the supported ownership/custom-source path to create/edit one harmless observable extension in each app. Save through Studio, record declared module bytes/hash and rendered behavior. If no usable UI exists, record a blocker and expose the existing canonical capability generically.

**Independent pass condition**:

No terminal source patch rescues acceptance; the visible extension is owned as authored and active in the actual generated app.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T032` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T033 — Regenerate twice with preservation and conflicts

**Purpose and method**:

Snapshot business rows, private identity invariants, model/access/report/navigation declarations and authored hashes. Stop the owned runtime, review/regenerate/build/run in order twice. Use an isolated conflict copy for modified generated-owned content and review rejection/resolution.

**Independent pass condition**:

Both promotions preserve intended state byte-for-byte/row-for-row; source conflicts block safe promotion until explicitly resolved. Named links, filters and Add defaults remain usable.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T033` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T034 — Export and independently use each application

**Purpose and method**:

Verify default exports omit private DB/identity/capability; explicitly test supported data snapshot option. Install with scripts denied, await completion, typecheck/test/build, then run with documented external isolated DB/identity while its Studio owner is stopped.

**Independent pass condition**:

A real independent visitor can browse/login/mutate with the same supported context. Probe owner unavailability and app readiness independently; no embedded author capability or user-study DB.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T034` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T035 — Document independent setup and rerun repairs

**Purpose and method**:

Record exact supported commands/config and sanitized export inventory, link any red/green source/generator fixes and rerun relevant runtime suites. Keep portability limits visible; no dependency upgrade or copied mock runtime.

**Independent pass condition**:

A fresh reviewer can follow the procedure with ordinary tools and explicit private config; data/authored hashes and no-Studio proof are linked to the exact revision.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T035` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

## Validation and failure policy

- Focused tests must inspect observable behavior or persisted state, not mirror code.
- Assertions await semantic readiness and retain the first failure; no retry masking.
- Snapshot exact ordered key tuples and decimal strings, not binary float money.
- Run broader appropriate checks after the focused proof; full final checks belong to WP08.
- Redirect parity/recovery/migration evidence environment variables to private run-specific paths.
- Review public artifacts for credentials and unrelated study data before staging.
- Missing infrastructure is BLOCKED/UNVERIFIED, not a product pass or skipped success.
- A product patch invalidates earlier final-code clean replay; WP08 must restart both cycles.

## Definition of done

- Every included subtask has its declared proof and event-sourced completion record.
- Mapped cases have truthful observations, or an explicit blocker prevents approval.
- Any mandatory blocker is fixed generically and the original scenario is retested.
- New code includes meaningful regression coverage and no fixture-specific production branch.
- Data/authored/draft/project isolation checks show no unintended mutations.
- Files remain within owned scope or the coordinated exception is recorded.
- No private data, capabilities, identity or raw credential traces are committed.
- The work is ready for a reviewer other than its author; do not self-approve.

## Reviewer guidance and risks

Reject code-only proof when the mapped behavior requires real Studio authoring.
Check source revision, app identity and evidence mode before accepting a claimed case.
Inspect independent expected values and deliberately rejected operations.
Check that a failed assertion cannot be made green by seeding hidden project settings.
Verify new helper abstractions still operate ordinary controls and preserve actual errors.
Do not approve a mandatory failure as a cosmetic or infrastructure deferral.
A package's green result is scoped to its evidence; it is not the final mission verdict.
Only WP09 can record final independent readiness after two complete clean cycles.
