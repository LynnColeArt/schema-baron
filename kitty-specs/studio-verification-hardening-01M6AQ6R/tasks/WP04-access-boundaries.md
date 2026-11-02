---
work_package_id: WP04
title: Public browsing and protected write boundaries
dependencies:
- WP03
requirement_refs:
- C-002
- C-003
- C-005
- FR-006
- FR-007
- FR-008
- FR-014
- NFR-001
- NFR-002
planning_base_branch: feat/studio-verification-hardening
merge_target_branch: feat/studio-verification-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/studio-verification-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/studio-verification-hardening unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-studio-verification-hardening-01M6AQ6R
base_commit: d32810c90cd76835fbc92cc255cc23aecc59d3fc
created_at: '2026-11-02T14:32:24.076566+00:00'
subtasks:
- T016
- T017
- T018
- T019
- T020
phase: Acceptance and hardening
history:
- at: '2026-11-02T12:41:25Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: tests/e2e/acceptance/
create_intent:
- tests/e2e/acceptance/access.spec.ts
execution_mode: code_change
owned_files:
- tests/e2e/acceptance/access.spec.ts
- apps/studio/src/security-editor/**
- packages/generator/src/templates/auth/**
- tests/integration/generated-auth/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Use `/ad-hoc-profile-load` (canonical `spk-doctrine-profile-load`) to load the
frontmatter profile before parsing this prompt and follow its scope.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `codex`

# WP04 — Public browsing and protected write boundaries

## Objective and independent success condition

Verify visitors can browse both applications publicly while protected pages and direct handlers consistently reject unauthorized mutations and retain safe return context.

**Priority**: P1; all mapped mandatory behaviors block the mission finish line.
**Cases**: AC-005, AC-006, AC-007, AC-015.
**Requirements**: FR-006, FR-007, FR-008, FR-014, NFR-001, NFR-002, C-002, C-003, C-005.
**Dependencies**: WP03.

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
- Start: `spec-kitty agent action implement WP04 --agent codex --mission studio-verification-hardening-01M6AQ6R`.
- Event-sourced status is authoritative; do not add status checkboxes to task references.
- GitHub PR base is separate from Spec Kitty's mission target; no merge is requested.

## Ownership and shared repairs

Primary paths:

- `tests/e2e/acceptance/access.spec.ts`
- `apps/studio/src/security-editor/**`
- `packages/generator/src/templates/auth/**`
- `tests/integration/generated-auth/**`

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

### T016 — Establish the public/protected matrix

**Purpose and method**:

Configure simple visitor login through supported UI and create a synthetic local test user without recording the password. Enumerate public lists/reports and protected Add/Edit/Delete pages/handlers for both apps, including composite association records.

**Independent pass condition**:

Signed-out browsing remains usable; per-page/action policy does not silently require login for the entire app.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T016` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T017 — Test login logout and selected-parent returns

**Purpose and method**:

Request a selected record from a filtered child list, authenticate, Save/Cancel and log out from the list header. Exercise expired session and cross-tab session changes; assert both visitor identity display and preserved typed parent/record identity.

**Independent pass condition**:

Login returns to the intended selected object. Logout leaves lists public and reblocks writes; subsequent login cannot replace an existing record with Add defaults.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T017` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T018 — Attack direct writes and return targets

**Purpose and method**:

Use separate anonymous/expired contexts to issue actual insert/update/delete handler requests, malformed key/filter values, invalid origin and external/malformed return targets. Compare row snapshots and redirects; direct request tests never author or repair a UI fixture.

**Independent pass condition**:

Unauthorized writes change zero rows; unsafe returns are rejected or safely constrained per the existing contract and never navigate externally.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T018` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T019 — Repair reproduced authorization inconsistencies

**Purpose and method**:

Record exact failing request/response and revision before editing shared policy/auth paths. Add the narrow regression and browser case, retaining safe error messages without secrets. Coordinate non-auth template changes with their owner instead of overlapping owned globs.

**Independent pass condition**:

A generic patch fixes both fixtures at their relevant boundaries; a deliberately weakened authorization check is detected by the regression.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T019` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T020 — Retest access after state changes

**Purpose and method**:

Run the matrix after valid/invalid edits, regeneration handoff and stale sessions. Produce sanitized cases with expected/actual status and preserved data hashes, leaving final clean-cycle proof to WP08.

**Independent pass condition**:

All matrix outcomes are explicit; a green browser landing page alone does not count as protected-handler proof.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T020` complete only after its observable proof exists using the event log.

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
