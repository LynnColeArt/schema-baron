# Tasks: Studio Verification and Hardening

**Status**: Task breakdown authored; no acceptance execution is claimed.
**Branch**: `feat/studio-verification-hardening`.
**Scope**: 9 focused packages, 45 subtasks, all 20 mandatory cases and 29 requirements.
**Tracking**: Txxx rows are references. Completion is event-sourced through Spec Kitty;
these rows and the Subtask Index are not checklists.

## Sequencing and review

WP01 → WP02 → WP03; WP04 and WP05 consume WP03; WP06 consumes both;
WP07 → WP08 → WP09 complete the chain. The mission uses single_branch topology;
computed lanes, not this diagram in prose, determine execution workspace allocation.
WP04/WP05 concern boundaries permit later concurrency if explicitly orchestrated,
but no parallel agents or shared fixture writes are required by this task plan.
Each package requires an independent reviewer; WP09 is assigned a reviewer profile
and cannot be executed/approved as the implementation author's own acceptance verdict.

The first useful slice is WP01's inventory and fail-closed ledger. It is not a usable
app milestone by itself. The finish line remains all mandatory cases, both apps twice
from fresh roots, two regenerations per app per cycle, no blockers and independent approval.
No automatic merge, deploy, upgrade or change to the user's retained studies.

## Subtask Index

| ID | Task | Package | Parallel |
|---|---|---|---|
| T001 | Inventory current tests and proof gaps | WP01 | Sequential |
| T002 | Describe synthetic inputs and independent oracles | WP01 | Sequential |
| T003 | Validate observation provenance and evidence | WP01 | Sequential |
| T004 | Retain runs and defects without erasing failures | WP01 | Sequential |
| T005 | Prove the foundation rejects invalid claims | WP01 | Sequential |
| T006 | Own an isolated Studio/browser fixture | WP02 | Sequential |
| T007 | Author the two-table wizard and inspect proposed pages | WP02 | Sequential |
| T008 | Configure related browsing and protected records visibly | WP02 | Sequential |
| T009 | Exercise record lifecycle and context | WP02 | Sequential |
| T010 | Build the count report and revisit schema | WP02 | Sequential |
| T011 | Author Library keys and scalar types through Schema | WP03 | Sequential |
| T012 | Exercise association identity and record failures | WP03 | Sequential |
| T013 | Build independently checked aggregate reports | WP03 | Sequential |
| T014 | Verify report mutations and connection inspection | WP03 | Sequential |
| T015 | Challenge names identifiers and lookup bounds | WP03 | Sequential |
| T016 | Establish the public/protected matrix | WP04 | Sequential |
| T017 | Test login logout and selected-parent returns | WP04 | Sequential |
| T018 | Attack direct writes and return targets | WP04 | Sequential |
| T019 | Repair reproduced authorization inconsistencies | WP04 | Sequential |
| T020 | Retest access after state changes | WP04 | Sequential |
| T021 | Inventory draft persistence boundaries | WP05 | Sequential |
| T022 | Preserve incomplete values and selection | WP05 | Sequential |
| T023 | Exercise unrelated updates thirty times | WP05 | Sequential |
| T024 | Verify conflict and project isolation | WP05 | Sequential |
| T025 | Repair observed render regressions and measure | WP05 | Sequential |
| T026 | Reject stale duplicate and invalid contexts | WP06 | Sequential |
| T027 | Exercise connection and runtime start failures | WP06 | Sequential |
| T028 | Interrupt reviewed migration and regeneration | WP06 | Sequential |
| T029 | Check bounded MCP and canonical-command parity | WP06 | Sequential |
| T030 | Repair and replay failed-operation defects | WP06 | Sequential |
| T031 | Reproduce Code-mode output selection | WP07 | Sequential |
| T032 | Declare and edit an authored extension through UI | WP07 | Sequential |
| T033 | Regenerate twice with preservation and conflicts | WP07 | Sequential |
| T034 | Export and independently use each application | WP07 | Sequential |
| T035 | Document independent setup and rerun repairs | WP07 | Sequential |
| T036 | Compose the explicit acceptance runner | WP08 | Sequential |
| T037 | Run final automated checks on exact code | WP08 | Sequential |
| T038 | Execute two complete clean cycles | WP08 | Sequential |
| T039 | Evaluate measured usability and preservation | WP08 | Sequential |
| T040 | Assemble complete dispositions and handoff | WP08 | Sequential |
| T041 | Establish independent reviewer and provenance | WP09 | Sequential |
| T042 | Reproduce both app journeys from published instructions | WP09 | Sequential |
| T043 | Audit full requirement and defect coverage | WP09 | Sequential |
| T044 | Issue an actionable independent verdict | WP09 | Sequential |
| T045 | Close out without expanding scope | WP09 | Sequential |

## WP01 — Acceptance inventory and evidence foundation

**Goal**: Make every planned case and missing proof visible before authoring new projects; create a fail-closed evidence seam with no product acceptance claims.
**Priority**: P1. **Dependencies**: None.
**Prompt**: [tasks/WP01-acceptance-foundation.md](tasks/WP01-acceptance-foundation.md).
**Independent test**: AC-001, AC-020; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-001, FR-016, FR-017, NFR-002, NFR-003, NFR-006, C-001, C-002, C-003, C-005, C-006.

T001 Inventory current tests and proof gaps (WP01)

T002 Describe synthetic inputs and independent oracles (WP01)

T003 Validate observation provenance and evidence (WP01)

T004 Retain runs and defects without erasing failures (WP01)

T005 Prove the foundation rejects invalid claims (WP01)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 288 lines; 5 subtasks.

## WP02 — Workshop Planner cold authoring journey

**Goal**: Build and use a fresh Workshop Planner entirely through ordinary Studio controls, exposing missing authoring paths before claiming the retained milestone can be reproduced.
**Priority**: P1. **Dependencies**: WP01.
**Prompt**: [tasks/WP02-workshop-ui-journey.md](tasks/WP02-workshop-ui-journey.md).
**Independent test**: AC-002, AC-004, AC-005, AC-006, AC-007, AC-008, AC-010, AC-019; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, NFR-001, C-002, C-003, C-004.

T006 Own an isolated Studio/browser fixture (WP02)

T007 Author the two-table wizard and inspect proposed pages (WP02)

T008 Configure related browsing and protected records visibly (WP02)

T009 Exercise record lifecycle and context (WP02)

T010 Build the count report and revisit schema (WP02)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 278 lines; 5 subtasks.

## WP03 — Library Catalog schema and query generality

**Goal**: Prove schema independence with a UI-authored many-to-many Library, exact report values and ordered composite record identity.
**Priority**: P1. **Dependencies**: WP02.
**Prompt**: [tasks/WP03-library-generality.md](tasks/WP03-library-generality.md).
**Independent test**: AC-003, AC-004, AC-005, AC-006, AC-009, AC-010, AC-019; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-003, FR-004, FR-005, FR-006, FR-007, FR-009, FR-017, NFR-001, C-001, C-003, C-004.

T011 Author Library keys and scalar types through Schema (WP03)

T012 Exercise association identity and record failures (WP03)

T013 Build independently checked aggregate reports (WP03)

T014 Verify report mutations and connection inspection (WP03)

T015 Challenge names identifiers and lookup bounds (WP03)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 282 lines; 5 subtasks.

## WP04 — Public browsing and protected write boundaries

**Goal**: Verify visitors can browse both applications publicly while protected pages and direct handlers consistently reject unauthorized mutations and retain safe return context.
**Priority**: P1. **Dependencies**: WP03.
**Prompt**: [tasks/WP04-access-boundaries.md](tasks/WP04-access-boundaries.md).
**Independent test**: AC-005, AC-006, AC-007, AC-015; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-006, FR-007, FR-008, FR-014, NFR-001, NFR-002, C-002, C-003, C-005.

T016 Establish the public/protected matrix (WP04)

T017 Test login logout and selected-parent returns (WP04)

T018 Attack direct writes and return targets (WP04)

T019 Repair reproduced authorization inconsistencies (WP04)

T020 Retest access after state changes (WP04)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 275 lines; 5 subtasks.

## WP05 — Draft render and project isolation stability

**Goal**: Demonstrate draft ownership, text and selection remain stable across supported views, unrelated notifications and recovery without masking rendering races.
**Priority**: P1. **Dependencies**: WP03.
**Prompt**: [tasks/WP05-draft-render-stability.md](tasks/WP05-draft-render-stability.md).
**Independent test**: AC-004, AC-014, AC-018; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-005, FR-013, FR-014, NFR-001, NFR-004, NFR-005, C-002, C-004.

T021 Inventory draft persistence boundaries (WP05)

T022 Preserve incomplete values and selection (WP05)

T023 Exercise unrelated updates thirty times (WP05)

T024 Verify conflict and project isolation (WP05)

T025 Repair observed render regressions and measure (WP05)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 272 lines; 5 subtasks.

## WP06 — Atomic failure recovery and shared-command parity

**Goal**: Exercise rejected and interrupted operations against owned copies, prove atomic outcomes and distinguish shared-command smoke from normal UI authoring.
**Priority**: P1. **Dependencies**: WP04, WP05.
**Prompt**: [tasks/WP06-recovery-and-parity.md](tasks/WP06-recovery-and-parity.md).
**Independent test**: AC-010, AC-015, AC-016, AC-017; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-004, FR-014, FR-015, FR-017, NFR-001, NFR-002, C-002, C-004, C-005.

T026 Reject stale duplicate and invalid contexts (WP06)

T027 Exercise connection and runtime start failures (WP06)

T028 Interrupt reviewed migration and regeneration (WP06)

T029 Check bounded MCP and canonical-command parity (WP06)

T030 Repair and replay failed-operation defects (WP06)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 283 lines; 5 subtasks.

## WP07 — Source regeneration and independent output

**Goal**: Prove Studio-supported customization survives two regenerations and exported apps run independently with private data and identity external to replaceable source.
**Priority**: P1. **Dependencies**: WP06.
**Prompt**: [tasks/WP07-regeneration-and-independence.md](tasks/WP07-regeneration-and-independence.md).
**Independent test**: AC-011, AC-012, AC-013, AC-016; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-006, FR-009, FR-010, FR-011, FR-012, FR-014, FR-017, NFR-001, NFR-002, C-001, C-003, C-005.

T031 Reproduce Code-mode output selection (WP07)

T032 Declare and edit an authored extension through UI (WP07)

T033 Regenerate twice with preservation and conflicts (WP07)

T034 Export and independently use each application (WP07)

T035 Document independent setup and rerun repairs (WP07)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 291 lines; 5 subtasks.

## WP08 — Final clean replay and evidence verdict assembly

**Goal**: Run two consecutive full fresh cycles on final implementation code and assemble a truthful complete requirement matrix for independent judgment.
**Priority**: P1. **Dependencies**: WP07.
**Prompt**: [tasks/WP08-clean-replay.md](tasks/WP08-clean-replay.md).
**Independent test**: AC-001, AC-018, AC-020; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-001, FR-016, FR-017, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-006, C-001, C-002, C-003, C-004, C-005, C-006.

T036 Compose the explicit acceptance runner (WP08)

T037 Run final automated checks on exact code (WP08)

T038 Execute two complete clean cycles (WP08)

T039 Evaluate measured usability and preservation (WP08)

T040 Assemble complete dispositions and handoff (WP08)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 290 lines; 5 subtasks.

## WP09 — Independent acceptance review and finite closeout

**Goal**: Have a reviewer other than the implementation author reproduce the supported procedure, judge all evidence and record a finite PASS/FAIL/BLOCKED verdict without merging or deploying.
**Priority**: P1. **Dependencies**: WP08.
**Prompt**: [tasks/WP09-independent-verdict.md](tasks/WP09-independent-verdict.md).
**Independent test**: AC-020; use the prompt's exact expected/durable outcomes.
**Requirements**: FR-001, FR-016, FR-017, NFR-003, NFR-006, C-001, C-002, C-003, C-004, C-005, C-006.

T041 Establish independent reviewer and provenance (WP09)

T042 Reproduce both app journeys from published instructions (WP09)

T043 Audit full requirement and defect coverage (WP09)

T044 Issue an actionable independent verdict (WP09)

T045 Close out without expanding scope (WP09)

**Implementation sketch**: Execute the five subtasks in order; preserve red evidence,
make generic repairs only for observed gaps and replay their exact scenarios.
**Parallel opportunities**: No concurrent mutation of shared fixtures or product seams.
**Risks**: Hidden fixture repair, stale proof, false-green status and unrelated-project writes.
**Prompt size**: 274 lines; 5 subtasks.

## Acceptance ownership

| Cases | Primary package(s) |
|---|---|
| AC-001 | WP01, WP08 |
| AC-002 | WP02 |
| AC-003 | WP03 |
| AC-004 | WP02, WP03, WP05 |
| AC-005, AC-006 | WP02, WP03, WP04 |
| AC-007 | WP04 (WP02 setup) |
| AC-008 | WP02 (query seam coordinated with WP03) |
| AC-009 | WP03 |
| AC-010 | WP02, WP03, WP06 |
| AC-011, AC-012, AC-013 | WP07 |
| AC-014 | WP05 |
| AC-015 | WP04, WP06 |
| AC-016 | WP06, WP07 |
| AC-017 | WP06 |
| AC-018 | WP05 instrumentation, WP08 final evaluation |
| AC-019 | WP02, WP03 |
| AC-020 | WP08 candidate report, WP09 independent verdict |

All primary package observations are replayed on final code by WP08 and audited by WP09.
Requirement frontmatter mappings are coverage assignments, never evidence of satisfaction.

## Change and rejection policy

Record each reproduced blocker with case/requirement, revision, severity, independent
expected outcome, repair and retest. A narrow coordinated source edit outside primary
ownership is permitted only with rationale; never overlap the authored owned_files map.
If repair materially changes scope, return to spec/plan; do not invent a new target or
waive mandatory behavior. Failed/blocked/skipped/unverified cases cannot yield PASS.
Any code change after a clean cycle requires a new pair of final-code clean cycles.
Keep code SHA separate from documentation SHA so final prose does not trigger endless replay.

## Handoff

Finalize ownership/dependencies/requirements, run required cross-artifact analysis, then
advance through the canonical runtime with this explicit mission handle. Review each
package independently; the final author must not impersonate the independent reviewer.
