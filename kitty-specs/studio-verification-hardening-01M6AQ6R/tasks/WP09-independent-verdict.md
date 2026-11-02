---
work_package_id: WP09
title: Independent acceptance review and finite closeout
dependencies:
- WP08
requirement_refs:
- C-001
- C-002
- C-003
- C-004
- C-005
- C-006
- FR-001
- FR-016
- FR-017
- NFR-003
- NFR-006
planning_base_branch: feat/studio-verification-hardening
merge_target_branch: feat/studio-verification-hardening
branch_strategy: Single-branch mission on feat/studio-verification-hardening; use runtime lanes.json allocation, never create per-WP branches manually.
subtasks:
- T041
- T042
- T043
- T044
- T045
phase: Final verification
history:
- at: '2026-11-02T12:41:25Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: reviewer-renata
authoritative_surface: docs/evidence/verification/
create_intent:
- docs/evidence/verification/review.md
- docs/evidence/verification/verdict.md
execution_mode: planning_artifact
owned_files:
- docs/evidence/verification/review.md
- docs/evidence/verification/verdict.md
role: reviewer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Use `/ad-hoc-profile-load` (canonical `spk-doctrine-profile-load`) to load the
frontmatter profile before parsing this prompt and follow its scope.

- **Profile**: `reviewer-renata`
- **Role**: `reviewer`
- **Agent/tool**: `codex`

# WP09 — Independent acceptance review and finite closeout

## Objective and independent success condition

Have a reviewer other than the implementation author reproduce the supported procedure, judge all evidence and record a finite PASS/FAIL/BLOCKED verdict without merging or deploying.

**Priority**: P1; all mapped mandatory behaviors block the mission finish line.
**Cases**: AC-020.
**Requirements**: FR-001, FR-016, FR-017, NFR-003, NFR-006, C-001, C-002, C-003, C-004, C-005, C-006.
**Dependencies**: WP08.

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
- Start: `spec-kitty agent action implement WP09 --agent codex --mission studio-verification-hardening-01M6AQ6R`.
- Event-sourced status is authoritative; do not add status checkboxes to task references.
- GitHub PR base is separate from Spec Kitty's mission target; no merge is requested.

## Ownership and shared repairs

Primary paths:

- `docs/evidence/verification/review.md`
- `docs/evidence/verification/verdict.md`

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

### T041 — Establish independent reviewer and provenance

**Purpose and method**:

Record author and reviewer identities, implementation SHA and documentation SHA separately. Refuse self-approval or pretending that switching the current author profile creates independence. Read final case/requirement matrix and both clean manifests.

**Independent pass condition**:

Reviewer identity differs from the implementation author and the exact code under review matches every final run; unavailable independence remains blocked.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T041` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T042 — Reproduce both app journeys from published instructions

**Purpose and method**:

Follow the documented procedure in fresh private locations and observe both independent visitor apps with Studio unavailable. Sample important authoring paths, source preservation, auth/returns, report oracle and regeneration; demand full rerun for any disputed mandatory behavior.

**Independent pass condition**:

Instructions suffice without hidden project/data/source repairs. Reviewer evidence identifies actual observations, limits and any reproduced failure.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T042` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T043 — Audit full requirement and defect coverage

**Purpose and method**:

Check all20AC,17FR,6NFR,6C against linked final evidence and red/green defects. Verify exact decimal/composite/zero-child expected results, run freshness, private artifact exclusions and separate hosted status.

**Independent pass condition**:

No mandatory failure is waived as cosmetic and no stale/historical count substitutes for proof. Every disposition is reviewable.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T043` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T044 — Issue an actionable independent verdict

**Purpose and method**:

Write PASS only when all finish conditions hold. Otherwise issue FAIL or BLOCKED/UNVERIFIED with exact missing behavior/evidence and route repair to its existing owner; preserve rejection and later re-review history.

**Independent pass condition**:

Medium/low deferrals have explicit rationale/backlog refs and do not excuse unmet mandatory outcomes; no critical/high defect remains for PASS.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T044` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T045 — Close out without expanding scope

**Purpose and method**:

Record supported platform/limits, reproducible walkthrough and concise release readiness. Use normal Spec Kitty gates only after approved work, keep later PR/merge decision separate and record out-of-scope requests in a future backlog.

**Independent pass condition**:

User receives the exact state and next action, no automatic merge/deploy and no endless feature additions. A rejected verdict remains visible until independently re-reviewed.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T045` complete only after its observable proof exists using the event log.

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
