---
work_package_id: WP05
title: Draft render and project isolation stability
dependencies:
- WP03
requirement_refs:
- C-002
- C-004
- FR-005
- FR-013
- FR-014
- NFR-001
- NFR-004
- NFR-005
planning_base_branch: feat/studio-verification-hardening
merge_target_branch: feat/studio-verification-hardening
branch_strategy: Single-branch mission on feat/studio-verification-hardening; use runtime lanes.json allocation, never create per-WP branches manually.
subtasks:
- T021
- T022
- T023
- T024
- T025
phase: Acceptance and hardening
history:
- at: '2026-11-02T12:41:25Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: tests/e2e/acceptance/
create_intent:
- tests/e2e/acceptance/drafts.spec.ts
execution_mode: code_change
owned_files:
- tests/e2e/acceptance/drafts.spec.ts
- apps/studio/src/workspace/**
- apps/studio/src/document-modes/**
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

# WP05 — Draft render and project isolation stability

## Objective and independent success condition

Demonstrate draft ownership, text and selection remain stable across supported views, unrelated notifications and recovery without masking rendering races.

**Priority**: P1; all mapped mandatory behaviors block the mission finish line.
**Cases**: AC-004, AC-014, AC-018.
**Requirements**: FR-005, FR-013, FR-014, NFR-001, NFR-004, NFR-005, C-002, C-004.
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
- Start: `spec-kitty agent action implement WP05 --agent codex --mission studio-verification-hardening-01M6AQ6R`.
- Event-sourced status is authoritative; do not add status checkboxes to task references.
- GitHub PR base is separate from Spec Kitty's mission target; no merge is requested.

## Ownership and shared repairs

Primary paths:

- `tests/e2e/acceptance/drafts.spec.ts`
- `apps/studio/src/workspace/**`
- `apps/studio/src/document-modes/**`

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

### T021 — Inventory draft persistence boundaries

**Purpose and method**:

Identify actual schema/query/page/control draft stores and supported reload behavior before writing assertions. Use two fresh projects and object identities; define what is unsaved, dirty, invalid and conflicted in each editor.

**Independent pass condition**:

The test names real supported transitions and explicit conflict status; it does not assume every editor has identical recovery semantics.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T021` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T022 — Preserve incomplete values and selection

**Purpose and method**:

Enter invalid partial numeric input and unsaved text in each supported editor, switch supported views/documents, then follow the documented recovery reload path. Assert text, selection/caret, active control, dirty status and object/project owner.

**Independent pass condition**:

No normalized value silently overwrites unfinished input. A rejected save retains the author draft with actionable errors.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T022` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T023 — Exercise unrelated updates thirty times

**Purpose and method**:

Trigger 30 actual unrelated-notification/view-switch interactions while a draft is active. Observe rendered controls, caret/focus and notification ownership; use semantic readiness assertions rather than fixed sleeps or automated retries.

**Independent pass condition**:

Zero unintended replacements, resets, duplicate controls, lost edits or wrong-project saves; record the entire sample count and failures.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T023` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T024 — Verify conflict and project isolation

**Purpose and method**:

Make a legitimate competing revision in a separately labeled test path, then follow explicit conflict resolution. Switch projects and back; verify each draft and persisted object is unchanged until its own valid Save.

**Independent pass condition**:

Conflicts never silently win over the active draft; rejected/stale saves leave business and other-project state unchanged.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T024` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T025 — Repair observed render regressions and measure

**Purpose and method**:

Add narrow regression proof at the true state boundary for reproduced failures. Instrument 30 bounded feedback/Save samples for WP08, preserving observed slow cases and machine context; do not lower timing thresholds.

**Independent pass condition**:

Focused draft/renderer tests pass and expose a deliberate state-replacement fault. Timing data is real observations, not a fabricated NFR pass.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T025` complete only after its observable proof exists using the event log.

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
