---
work_package_id: WP02
title: Workshop Planner cold authoring journey
dependencies:
- WP01
requirement_refs:
- C-002
- C-003
- C-004
- FR-002
- FR-004
- FR-005
- FR-006
- FR-007
- FR-008
- FR-009
- NFR-001
planning_base_branch: feat/studio-verification-hardening
merge_target_branch: feat/studio-verification-hardening
branch_strategy: Single-branch mission on feat/studio-verification-hardening; use runtime lanes.json allocation, never create per-WP branches manually.
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: Acceptance and hardening
history:
- at: '2026-11-02T12:41:25Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: tests/e2e/acceptance/
create_intent:
- tests/e2e/acceptance/workshop.spec.ts
- tests/e2e/acceptance/helpers.ts
execution_mode: code_change
owned_files:
- tests/e2e/acceptance/workshop.spec.ts
- tests/e2e/acceptance/helpers.ts
- apps/studio/src/project-wizard/**
- apps/studio/src/forms/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Use `/ad-hoc-profile-load` (canonical `spk-doctrine-profile-load`) to load the
frontmatter profile before parsing this prompt and follow its scope.

- **Profile**: `frontend-freddy`
- **Role**: `implementer`
- **Agent/tool**: `codex`

# WP02 — Workshop Planner cold authoring journey

## Objective and independent success condition

Build and use a fresh Workshop Planner entirely through ordinary Studio controls, exposing missing authoring paths before claiming the retained milestone can be reproduced.

**Priority**: P1; all mapped mandatory behaviors block the mission finish line.
**Cases**: AC-002, AC-004, AC-005, AC-006, AC-007, AC-008, AC-010, AC-019.
**Requirements**: FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, NFR-001, C-002, C-003, C-004.
**Dependencies**: WP01.

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
- Start: `spec-kitty agent action implement WP02 --agent codex --mission studio-verification-hardening-01M6AQ6R`.
- Event-sourced status is authoritative; do not add status checkboxes to task references.
- GitHub PR base is separate from Spec Kitty's mission target; no merge is requested.

## Ownership and shared repairs

Primary paths:

- `tests/e2e/acceptance/workshop.spec.ts`
- `tests/e2e/acceptance/helpers.ts`
- `apps/studio/src/project-wizard/**`
- `apps/studio/src/forms/**`

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

### T006 — Own an isolated Studio/browser fixture

**Purpose and method**:

Reuse the real owner-start/readiness pattern from project-wizard tests. Supply an explicit private owner config, fresh project parent, unused loopback ports and no tracing of login. Record process ownership, stop only owned children and preserve failures for inspection.

**Independent pass condition**:

The retained Workshop project and its runtime are untouched. A fresh project parent is absent before the browser starts; the fixture reports its own readiness.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T006` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T007 — Author the two-table wizard and inspect proposed pages

**Purpose and method**:

Cancel a first attempt and verify no project/database was created. Create workshops and sessions with required integer keys/FK and required labels under a missing folder with spaces. Review Page/Form/Control proposals, login and Mermaid before Complete; reopen Schema, flow and settings.

**Independent pass condition**:

Real persisted schema matches the UI draft. Completed editable objects and flow correspond to the preview; shortcuts select the intended project.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T007` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T008 — Configure related browsing and protected records visibly

**Purpose and method**:

Use normal Properties to choose workshop-name labels, row links and the sessions equality filter. Keep lists public and Record/write actions protected. If any required setting lacks a UI control, record the failure and implement the smallest generic forms/wizard exposure through canonical commands.

**Independent pass condition**:

No project.batch/API patch supplies missing model settings. Public sessions display names, workshop links scope children and Add preselects the actual selected key.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T008` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T009 — Exercise record lifecycle and context

**Purpose and method**:

Create the two workshops and three known sessions through generated forms. Add from empty Garden Design children, edit, Cancel and delete that temporary session. Check missing title, related workshop deletion and named confirmation; compare business snapshots independently.

**Independent pass condition**:

Save/Cancel/login retain the filtered parent and persisted values. Rejected actions produce clear messages and no partial rows; initial three sessions remain.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T009` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T010 — Build the count report and revisit schema

**Purpose and method**:

Configure a session-count report with zero-child rows and minimum-count threshold through query/report controls, coordinating their owner in WP03 if needed. Add nullable duration_minutes through reviewed Schema migration and cancel destructive preview; record expected rows and reopen behavior.

**Independent pass condition**:

Counts 3/0 and threshold1 match the independent oracle and change after a valid child insert. The nullable addition preserves existing values; canceled destruction changes nothing.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T010` complete only after its observable proof exists using the event log.

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
