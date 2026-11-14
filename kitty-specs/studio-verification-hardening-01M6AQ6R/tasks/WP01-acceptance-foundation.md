---
work_package_id: WP01
title: Acceptance inventory and evidence foundation
dependencies: []
requirement_refs:
- C-001
- C-002
- C-003
- C-005
- C-006
- FR-001
- FR-016
- FR-017
- NFR-002
- NFR-003
- NFR-006
planning_base_branch: feat/studio-verification-hardening
merge_target_branch: feat/studio-verification-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/studio-verification-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/studio-verification-hardening unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-studio-verification-hardening-01M6AQ6R
base_commit: d32810c90cd76835fbc92cc255cc23aecc59d3fc
created_at: '2026-11-02T12:49:31.821818+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
phase: Foundation
history:
- at: '2026-11-02T12:41:25Z'
  actor: codex
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: scripts/acceptance/
create_intent:
- scripts/acceptance/evidence.mjs
- scripts/acceptance/evidence.test.ts
- scripts/acceptance/inventory.mjs
- fixtures/acceptance/cases.json
- fixtures/acceptance/workshop.json
- fixtures/acceptance/library.json
- docs/evidence/verification/inventory.md
execution_mode: code_change
owned_files:
- scripts/acceptance/evidence.mjs
- scripts/acceptance/evidence.test.ts
- scripts/acceptance/inventory.mjs
- fixtures/acceptance/cases.json
- fixtures/acceptance/workshop.json
- fixtures/acceptance/library.json
- docs/evidence/verification/inventory.md
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

# WP01 — Acceptance inventory and evidence foundation

## Objective and independent success condition

Make every planned case and missing proof visible before authoring new projects; create a fail-closed evidence seam with no product acceptance claims.

**Priority**: P1; all mapped mandatory behaviors block the mission finish line.
**Cases**: AC-001, AC-020.
**Requirements**: FR-001, FR-016, FR-017, NFR-002, NFR-003, NFR-006, C-001, C-002, C-003, C-005, C-006.
**Dependencies**: None.

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
- Start: `spec-kitty agent action implement WP01 --agent codex --mission studio-verification-hardening-01M6AQ6R`.
- Event-sourced status is authoritative; do not add status checkboxes to task references.
- GitHub PR base is separate from Spec Kitty's mission target; no merge is requested.

## Ownership and shared repairs

Primary paths:

- `scripts/acceptance/evidence.mjs`
- `scripts/acceptance/evidence.test.ts`
- `scripts/acceptance/inventory.mjs`
- `fixtures/acceptance/cases.json`
- `fixtures/acceptance/workshop.json`
- `fixtures/acceptance/library.json`
- `docs/evidence/verification/inventory.md`

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

### T001 — Inventory current tests and proof gaps

**Purpose and method**:

Catalogue the 20 checklist cases against current wizard/forms/query/report/security/recovery/source/export tests. Record exact source SHA and historical evidence as historical only. Describe missing UI proof and candidate source-editor output mismatch without declaring a reproduced defect.

**Independent pass condition**:

A reviewer can locate an existing test or an explicit missing-proof entry for every case; no previous test count becomes a new pass.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T001` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T002 — Describe synthetic inputs and independent oracles

**Purpose and method**:

Create data-only Workshop and Library descriptors from data-model.md, with integer keys, ordered association tuples and exact decimal strings. Enumerate lifecycle expected sets, null and zero-child variants; do not include a Studio project model or SQL used to rescue authoring.

**Independent pass condition**:

Known Workshop counts are 3/0; Library author counts 2/1/0 and copy totals 19.75/10.00/0.00. Add/edit/delete expectations are independently checked.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T002` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T003 — Validate observation provenance and evidence

**Purpose and method**:

Implement observation validation against the adjacent contract using existing tools. Check known cases/requirements, application/mode/status, 40-character revision, safe relative artifact paths, real SHA-256 contents and status-dependent evidence. Treat missing evidence, traversal, unknown IDs and missing dispositions as errors.

**Independent pass condition**:

Deliberately false-green observations fail validation; a well-formed synthetic validation sample is explicitly marked harness proof, never product proof.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T003` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T004 — Retain runs and defects without erasing failures

**Purpose and method**:

Define append-only run/observation identities and defect/retest linkage in the evidence module. Keep private roots/config/DBs/traces outside Git. Emit a pending ledger and distinguish blocked/skipped/unverified from passed; never overwrite a prior failed attempt.

**Independent pass condition**:

A failed attempt and linked later retest both remain readable. A pending ledger cannot satisfy a final pass; secret-bearing paths are excluded.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T004` complete only after its observable proof exists using the event log.

**Review question**:

Could a missing/incorrect implementation still satisfy these assertions? If so,
strengthen the oracle or boundary observation rather than adding implementation snapshots.

### T005 — Prove the foundation rejects invalid claims

**Purpose and method**:

Add focused tests for wrong hashes, missing files, false pass, unsafe paths, unknown requirement, missing mandatory disposition and retry history retention. Document actual test commands and foundation limitations in the inventory.

**Independent pass condition**:

Focused foundation tests pass, intentional corruptions are rejected, and all AC outcomes still read Not run until real browser evidence exists.

**Execution record**:

1. Identify exact case(s), source revision and isolated fixture before executing.
2. Capture the expected result and actual visible/durable outcome separately.
3. For a failure, retain reproduction and severity before any generic repair.
4. Run focused assertions at the changed boundary plus the visible exposing scenario.
5. Link sanitized artifacts and any defect/retest; do not erase earlier evidence.
6. Mark `T005` complete only after its observable proof exists using the event log.

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
