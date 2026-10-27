---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T13:40:28Z'
reviewer_agent: reviewer-renata
wp_id: WP22
---

# WP22 independent review — reviewer-renata

Decision: REQUEST CHANGES. One reproducible bounded integration finding blocks approval. This is the Equipment Desk portion; it does not certify WP23/25 or complete FR-030/NFR-006 for both applications.

Reviewed in /home/lynn/projects/schema-baron/.worktrees/schema-baron-studio-01M5W3Q9-lane-v. Canonical review invocation 392458b8902a471e8721aba11bfa134c. Resolved reviewer-renata through the profile CLI; review governance reports no charter. No auth/sync/upgrade or product changes performed.

## Source and scope

WP22 source 7b172b9, shared corrections 62feaa7 and f1b4d7b, actual combined product base a605e34c82f77653a3d53ca8d81fdb7c2f66c4a9. Current HEAD e0aaf4d includes coordination lifecycle merges, not additional WP22 product changes. Excluded wholesale re-review of inherited approved features. Inspected all bounded manual resolutions using git show --remerge-diff a605e34 against parents 2c38467b6d1c35d606de3b838b3fcdabfba0e341 and b5edf58433d85eec85c589a6aaaf5d1905acaeba. Approved source ancestry matches /tmp/wp22-integration-sources.json. Both FlowMap/Action Properties and DocumentModes/SourceEditor/RuntimeControls are live; Record write-only hook guards and unsupported-binding removal remain; flow and page-document exports, flow.inspect, extension/runtime/export registrations, strict flow/runtime result schemas, Login Cancel/labels/header plus extension IR and emitter wiring all retained. Merge adaptations are canonical fixture IDs, current document capability assertions and whitespace normalization, not removed behavior assertions.

## Independent executed checks

- npm ci --ignore-scripts --offline: PASS; Node 24.22.1. Full production build and full workspace typecheck: PASS.
- Full Vitest: 455 tests / 68 files PASS (172.72s), including model/query/schema-plan/migration, supported/unsupported hooks, runtime ownership/concurrency and export races. Log /tmp/wp22-review-tests.log.
- Fresh complete Equipment visible journey: 1 PASS (2.2m); /tmp/wp22-review-browser.log and /tmp/wp22-review-browser/. It created fresh /tmp/equipment-visible-VkjFye. Owner config private 0600; owned runtime groups stopped by harness.
- Isolated copied portable output: offline install, strict typecheck, generated tests, production build PASS; /tmp/wp22-review-standalone.log. Original visible journey separately ran portable report after Studio shutdown.
- Independent arithmetic heldouts: 146 assertions PASS, all four operators, both operand orders, text/scaled-integer physical encodings, all three rounding configurations, strict comparison and ordinary query nullability boundaries. /tmp/wp22-review-heldouts.log.
- Independent real-core migration heldouts: 8 PASS; required non-NULL assignment, nullable/required nullable-field expressions, wrong-type refusal, mixed decimal DDL refusal; failed previews retain physical TEXT/rows and create no marker. /tmp/wp22-review-backfill-heldouts.log. Existing real-core NULL/0/apply tests also passed in full suite.
- Separate readonly SQLite/BigInt oracle PASS: Ada 3.10, Zero 0.00; FK restrict and integrity; portable business rows and complete migration markers equal original; authored validator/action bytes match original and portable; emitted runtime decimal UDF exactly handles signed int64 boundaries. /tmp/wp22-review-independent-oracle.log.
- Native SQLite smoke, dependency lock verification, credential heuristic: PASS. Exact fresh journey credential scan: 117 retained/client files, both visitor password and owner capability absent.
- git diff --check PASS. Bounded syntax/JSON/whitespace check 74 changed paths PASS excluding two absent coordination artifacts; /tmp/wp22-review-bounded-lint.log. Default lint PASS but covers only untracked local state. SCHEMA_BARON_LINT_BASE=a605e34 lint cannot read absent lane kitty-specs status.json; this is a coordination-artifact discovery limitation, not claimed as a passing full scoped lint. No files copied into lane to hide it.

## Behavioral assessment

Read the complete 1372-line acceptance entrypoint and oracle; no fixture model, project.batch, direct schema SQL, MCP object writes, page.evaluate mutation, or hidden API authoring enters the Equipment journey. Owner bootstrap config is the only setup write. GET snapshots and SQLite connections are readonly. Direct mutation requests are only unauthorized/revoked generated writes and stale migration apply after UI creation. All user/business rows use generated New record/Save/Delete controls. The committed fixture exactly equals retained final-project.json and serves as output evidence, not test input. Raw traces are explicitly disabled before password fills; operation collection excludes request payload/session/CSRF/capability values. No manual pack derivatives or credentials introduced in reviewed artifacts.

Fresh visible path exercised schema/FKs/unique, Grid/linked Record/Search/Login, protected writes/public reads/provisioning/header, grouped loan totals then unique per-loan query joined for borrower aggregation, exact HAVING/zero children, report/child links, selectable actual Save/Cancel/mapping properties, Code validator and action declaration/edit/execution, retained invalid input and no-write cancellation, CRUD refresh 2.80→3.10→3.20→3.10, restricted deletion preservation, Login Cancel/resume/filter/key retention, logout/public header and anonymous/revoked 401. Evolution reviewed rename/backfill apply, destructive nullable type preview Cancel, UI restoration and second-visible-editor stale refusal. Two actual post-write/source-edit promotions preserved rows, markers, policies, queries, forms, actions, authored bytes and subsequent asset CRUD/reopen settings.

62feaa7 remains generic: shared browser-safe arithmeticResultType has live model/compiler/designer consumers; decimal format is preserved; comparisons/FK/sameType stay strict; no real↔integer/decimal widening. Safe BigInt UDFs, NULL behavior, rounding and overflow run through real SQLite and portable runtime. Existing schema-plan hasDecimal fail-loud guard remains; independent mixed binary decimal DDL refusal passed.

f1b4d7b changes only temporary assignment validation: try exact nonnullable output then nullable fallback only for nullable target. Ordinary query result nullability remains exact. Required NULL is refused before mutation; independent required successful assignment and nullable-field negative/positive controls passed. No schema-specific constants or fallback data reset introduced.

## Required eight checks

1. Dead code: PASS. arithmeticResultType production callers verified in model validation, SQLite compiler and Studio expression inference. No other new public production modules.
2. Synthetic-fixture test: PASS. Actual production owner/UI/generated SQLite paths produce assertions; fixture copied after authoring. Generic regression fixtures are explicitly separated from authoring proof.
3. Silent empty return: PASS. New production helper undefined means incompatible arithmetic and is rejected by canonical validation; backfill fallback returns validation result, never empty success. Test shutdown catch intentionally ignores already-exited owned process only.
4. FR coverage: FAIL on the bounded flow-map integration rerun described below; other behavior assertions PASS within WP22 Equipment scope. Concrete assertions cover all listed behavior categories, C-007, exact decimal NFR-009 and Equipment output part of NFR-006/FR-030. Report explicitly leaves two-project/parity and full modes/NFR corpora pending WP23/25, rather than asserting mission-wide completion.
5. Frozen surface: PASS. No frozen contract/reference/manual edits in scoped WP22 product/evidence changes.
6. Locked decisions: PASS. Visible authoring, exact decimals, one persistence/operation authority, script-free pinned offline install, protected server writes, standalone output and preserved bytes/data respected.
7. Shared-file ownership: PASS. Two explicitly authorized narrow shared corrections have recorded failure reproductions/rationale in numeric-boundary.md and backfill-nullability-repro/rationale.md; bounded dependency integration rationale in /tmp/wp22-integration-result.txt. Coordination noted again in canonical verdict reason.
8. Production fragility: PASS. No new bare production raise/throw path; invalid arithmetic and backfill fail through existing diagnostic boundaries. Existing strict decimal overflow/division/type refusals remain intentional fail-loud behavior.

Evidence versus claims: all checks above were rerun independently except original pre-fix screenshots/failures, which were inspected with diffs and retained failure logs. The broader inherited browser evidence was inspected; only bounded flow/document browser coverage is additionally rerun here. No full AT10, Publication Catalog, comprehensive five-mode/fidelity/scale/fault/security matrix claim.


## Blocking finding — P2: restore visible map node selection after saved mapping edits

Affected surface: apps/studio/src/workspace/index.tsx:1134 merged FlowMap placement / apps/studio/src/flow-map/index.tsx focused projection/viewport state. Exact responsible line is not established; do not blindly patch the test. This is a bounded integration failure rather than a request to re-review all inherited work.

Reproduce from current lane with clean install/build already passing:

`npx playwright test tests/e2e/flow-map/workflow.spec.ts -g 'behavior map edits canonical' --workers=1 --output=/tmp/wp22-review-flow-retry`

The existing production-path test visibly creates pages/forms/login, selects the canonical navigation edge, edits its key mapping in Properties, enables Focused neighbors and Fit visible, saves, restores the original key mapping, saves, and presses Fit visible again. At tests/e2e/flow-map/workflow.spec.ts:187, `.react-flow__node` containing `Edit entry` resolves, but remains not visible for the entire 15-second click timeout. The actual destination page cannot be selected by pointer, so the remainder of map→runtime handler correspondence is never reached. This repeated in both the 7-case bounded run and a fresh isolated single-case rerun; no traces with credentials were retained.

Fix or establish/fix the underlying viewport/projection/measurement continuity through ordinary model saves in the integrated workspace. Retain a meaningful visible pointer-selection assertion; do not bypass with force click or hidden state mutation. Rerun this case plus affected map/document integration and the fresh Equipment path. Source flow files themselves are unchanged from approved18; the workspace integration changed and no claim is made that the numeric/nullability corrections caused this. Nevertheless the current integrated review target fails the required retained map behavior, while provided baseline claims this case passed.

Independent bounded integration run: 5 passed, 1 historical full-mode skip, 1 failed (38.7s). Isolated repeat: 1 failed at the same line. Logs /tmp/wp22-review-merge-browser.log and /tmp/wp22-review-flow-retry.log; safe error contexts and pre-failure screenshots under matching /tmp output roots.
