# Verification inventory — WP01

This is the acceptance foundation, not a product acceptance result. All 20 cases
remain **Not run**. Existing suites and historical milestone captures establish
where to look; they do not prove the final verification revision.

## Provenance and isolation

- Historical milestone source: `fe22d9b06be0967b1dec89c352d2979787330f34`.
- Source inspected while assembling inventory: `8533a0df0d649c34d42416c2f0c32588d20eb8cc`.
- Synthetic data-only inputs: `fixtures/acceptance/workshop.json` and `library.json`.
  They contain integer business keys, ordered composite tuples and exact decimal
  strings, not Studio object IDs, prepared project models or authoring repair SQL.
- `node scripts/acceptance/inventory.mjs` emits the current exact source SHA,
  descriptor hashes, 20 pending cases and all 29 pending requirement references.
- No live Studio, retained Workshop project, database, identity or runtime was
  changed by WP01. Harness tests create only disposable synthetic temporary files.
- No dependency install/addition/upgrade was needed. Node's existing built-in test
  runner executes the acceptance foundation; current repository TypeScript types
  are used read-only from the parent checkout for semantic checking.

## Case-to-suite inventory

All references below were checked to exist. Suite presence is not a pass.
The fresh UI-authored Workshop/Library journeys and final-revision replay are missing
proof for every row, with more specific gaps noted below.

| Case | Existing tests to inspect | Missing fresh proof |
|---|---|---|
| AC-001 | `tests/e2e/workspace/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-002 | `tests/e2e/project-wizard/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-003 | `tests/e2e/project-wizard/workflow.spec.ts`, `tests/e2e/schema-editor/workflow.spec.ts`, `tests/e2e/connections/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-004 | `tests/e2e/forms/workflow.spec.ts`, `tests/e2e/flow-map/workflow.spec.ts`, `tests/e2e/document-modes/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-005 | `tests/e2e/generated-records/workflow.spec.ts`, `tests/e2e/forms/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-006 | `tests/e2e/generated-records/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-007 | `tests/e2e/security-workflow/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-008 | `tests/e2e/reports/workflow.spec.ts`, `tests/e2e/query-designer/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-009 | `tests/e2e/reports/workflow.spec.ts`, `tests/e2e/query-designer/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-010 | `tests/e2e/migrations/workflow.spec.ts`, `tests/e2e/schema-editor/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-011 | `tests/e2e/document-modes/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-012 | `tests/e2e/regeneration/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-013 | `tests/e2e/runtime-export/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-014 | `tests/e2e/document-modes/workflow.spec.ts`, `tests/e2e/forms/workflow.spec.ts`, `tests/e2e/query-designer/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-015 | `tests/e2e/connections/workflow.spec.ts`, `tests/e2e/runtime-export/workflow.spec.ts`, `tests/integration/recovery-matrix/behavior.test.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-016 | `tests/e2e/migrations/workflow.spec.ts`, `tests/e2e/regeneration/workflow.spec.ts`, `tests/integration/recovery-matrix/behavior.test.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-017 | `packages/core/tests/transport/behavior.test.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-018 | `tests/e2e/usability/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-019 | `tests/e2e/generated-records/workflow.spec.ts`, `tests/e2e/schema-editor/workflow.spec.ts` | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |
| AC-020 | No complete current suite for this whole-case outcome | Fresh final-revision execution on both UI-authored fixtures is missing; existing suite/source presence is historical context only. |

## Specific execution leads

- Related lookup/navigation/filter controls exist in `apps/studio/src/forms/index.tsx`
  (including ordered destination-key mappings). WP02 must use them through actual
  controls; their existence does not replace that proof. Earlier private model
  patches cannot be adopted as this mission's UI evidence.
- `apps/studio/src/source-editor/index.tsx` initializes `output:app`, while Generate
  follows project output configuration. This is a **candidate** mismatch for WP07
  cold UI reproduction, not a verified defect or repair claim.
- The existing Playwright CI configuration enables a retry. Fresh acceptance must
  explicitly run with zero retries and retain failures before any explicit rerun.
- Composite association CRUD, NULL/zero-child aggregates, read-only inspect/Cancel,
  draft ownership and independent exported use need fresh fixture-specific proof.
- The original Spec Kitty WP01 baseline says `test_runner: pytest` and reports
  `<gate-coverage-junit>: no JUnit XML artifact produced by scoped run`. That is a
  gate-tooling mismatch, **not an observed application test failure**. Preserve it.
  Parent-approved tooling commit `1b53454` is cherry-picked into this lane as
  `8533a0d`; its supported command runs real Vitest JUnit. Source-mismatched
  baseline/head comparison remains unverified even when the real head suite passes.

## Fixture oracle checks

The CLI independently groups raw synthetic rows and uses BigInt integer cents.
Workshop initial counts are 3/0 and minimum1 selects workshop1. Library author
counts are 2/1/0; separate copy totals are 19.75/10.00/0.00, minimum15 selects book1.
The controlled book2 copy changes its total to16.25,20.00, then10.00 on deletion.
The ordered association key is `(book_id, author_id)`. Descriptor arithmetic is
harness proof only; the product's actual query/results must still match it.
Variants describe NULL cost, duplicate display names with separate keys, quoted
identifiers, restrict deletion, unique/composite duplication and 200/201 lookups.
No generator production path branches on these fixture names.

## Implemented evidence commands and integration

Run from the lane/repository root with pinned Node24.22.1:

```sh
node --test scripts/acceptance/evidence.test.ts
node scripts/acceptance/inventory.mjs
node scripts/acceptance/inventory.mjs validate-observation /private/observation.json /artifact/checkout
node scripts/acceptance/inventory.mjs check-ledger /private/ledger /artifact/checkout <40-character-code-sha>
```

`inventory.mjs` imports `evidence.mjs` in its real CLI path. `createRun`,
`appendDefect`, `appendObservation` and `readObservations` are exported for WP08's
runner. Writes use exclusive creation in a caller-selected private `.local` or
external store. Immutable run/observation IDs and explicit failed-target/defect links
retain previous failed attempts when a retest passes. A duplicate write fails.

Observation shape is checked against the pinned mission JSON schema; unsupported
schema keywords fail closed. Validation additionally checks known case/requirement
coverage, evidence mode, individual application, run/code identity, safe public
artifact paths, actual bytes and SHA-256. Passing `both` cannot replace two
application observations; parity/fault evidence cannot satisfy a UI case. Public
artifact paths are limited to `docs/evidence/verification/`; private filenames,
DB/trace formats, traversal and escaped symlinks are rejected. A conservative text
credential check rejects obvious tokens/keys; it does **not** replace full credential
checks and manual artifact sanitization, especially images.

The ledger CLI exits nonzero for any missing mandatory disposition or any case
that is failed/blocked/skipped/unverified/not_run. This is a necessary preliminary
check, **not the final verdict**. Even a fully populated synthetic ledger returns
`accepted: false`; WP08 must still prove two clean cycles, per-app preservation,
defect closure and measured NFRs, and WP09 must independently review the result.
The foundation summary is not allowed to fabricate those later conditions.

## WP01 validation results

The initial test-first run failed because the evidence module did not yet exist.
The first implemented run caught missing conditional minItems enforcement; the
schema walker was corrected before handoff. Final focused command:

- `node --test scripts/acceptance/evidence.test.ts`: **14 passed, 0 failed**.
- The live inventory CLI produced 20 Not run cases, 29 requirements and exact
  descriptor hashes. Its arithmetic checks passed as descriptor-only proof.
- Live `check-ledger` CLI tests rejected missing dispositions and fully dispositioned
  ledgers containing each of failed/skipped/blocked/unverified, all with exit1.
- Focused negatives reject wrong hashes, missing files, unknown refs, wrong app/mode,
  stale revision, aggregate both-app passes, traversal, escaped symlinks and obvious
  textual credentials; immutable history keeps failure plus linked retest.
- Strict TypeScript semantic check uses existing parent-checkout compiler/type roots;
  no dependency was installed. Diff-scoped repository lint and credentials are run
  before review handoff; actual commands/results are recorded in the handoff.
- Current full head suite runs once in the synchronous Spec Kitty pre-review gate;
  its actual JUnit outcome is reported separately from the incompatible baseline.

The repository's default Vitest include does not cover `scripts/acceptance/`.
The explicit Node-native command above is mandatory for this foundation; WP08's
runner must call it alongside the current repository suite. No acceptance case or
requirement is marked passed by these synthetic harness checks.
