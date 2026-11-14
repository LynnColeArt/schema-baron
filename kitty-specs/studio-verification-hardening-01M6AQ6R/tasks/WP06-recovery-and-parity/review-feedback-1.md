# WP06 independent review — approved

Reviewer: `verification_recovery_review` (Codex, resolved `reviewer-renata`).
Reviewed source: `865bcc3559410426cffdefb96f02fbae91ca91a5`.
Reviewed evidence: `efbb544febe5d87b86a353299d3e44b7b8a33987`.

No blocking findings. Reviewed only the WP06 delta after dependency merge `a70e99e`; no production patch or inherited-WP reapproval. The narrow `docs/evidence/verification/recovery*` ownership exception was explicitly authorized by the coordinating agent. Source, fixture and all seven observations' artifact hashes match their recorded provenance. Inspected the actual retained XML and destructive-review screenshot, not only summary counts.

## Independently executed verification

Every Node/npm command used `PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH`; independently confirmed Node `v24.22.1`, npm `11.19.1`. Recovery/parity/migration capture variables were redirected to distinct private `/tmp/wp06-review-renata-*` paths. No source rebuild or upgrade was performed.

1. `npm test -- tests/integration/recovery-matrix/behavior.test.ts tests/integration/recovery-matrix/challenges.test.ts packages/core/tests/runtime/behavior.test.ts --reporter=junit --outputFile=/tmp/wp06-review-renata-focused.xml`: **16 passed**, zero failures/errors/skips. This includes all ten restart/recovery scenarios, five request/cancellation/security challenges, and the real runtime behavior test.
2. `PLAYWRIGHT_JUNIT_OUTPUT_FILE=/tmp/wp06-review-renata-browser.xml npm run test:e2e -- tests/e2e/acceptance/recovery.spec.ts tests/e2e/acceptance/parity.spec.ts --workers=1 --retries=0 --reporter=junit --output=/tmp/wp06-review-renata-browser-output`: **3 passed**, zero failures/errors/skips/retries, reported wall time 52 seconds. The Library journey actually authored via ordinary Studio/generated controls, migrated, canceled, restored, reloaded and continued. Both bounded real stdio MCP fixtures passed.
3. `npm test -- packages/core/tests/runtime/processes.test.ts apps/mcp/tests/parity.test.ts --reporter=junit --outputFile=/tmp/wp06-review-renata-boundaries.xml`: **8 passed**, zero failures/errors/skips. Includes occupied-port and probe/readiness race regressions.
4. Independent ephemeral Node/SDK heldout probes used a fresh disposable owner: MCP-first create and fresh mutation, distinct direct mutation, then separate request IDs for stale, semantic/partial-batch and path rejection on each surface. Both surfaces returned the expected typed errors and preserved exact project bytes/model at revision 3 with only the two intended pages. Changed reuse of the MCP mutation ID returned `IDEMPOTENCY_CONFLICT`. This challenges the possible cached-replay blind spot in the regular sequential parity corpus. Initial probe import used a nonexistent build path and failed before fixture creation; rerun used the package's actual public export and passed. No product failure or source repair was involved.
5. `git diff a70e99e..HEAD --check` passed. No product/source edits were made by the reviewer.

Private independent JUnit SHA256:

- focused: `07d513ce1b77f88b3dfe065837b5fc7c3d22272575d0f3d2b5a6be2e5875adf6`
- browser: `498ea072a3b4896010a338340c5433636ed3b1aaf5aa24d520317c8f656eed90`
- runtime/MCP boundaries: `741d7833c0136f094c2c1e54f4268c6b351e9970a3291784c6e6e81405f4c81b`

The submitted final XML independently parses as 3 browser tests and 23 focused tests, zero failures/errors/skips, with hashes matching provenance. The synchronous pre-review gate log records no new failures; its actual `/tmp/spec-kitty-declared-cmd-al__yiut/output.xml` contains **513 testcases / 79 suites**, zero failures/errors/skips, SHA256 `ba6b754e3ed4244610aeb73466f76ccb4b6a22b822ca2bf0f177d114bfcc2128`. XML aggregate time is not wall time. No redundant full gate was run for this test/evidence-only review.

## Requirement and subtask disposition

- T026 / AC-015 / FR-014: explicit replay, changed payload reuse, stale revision, invalid parent/default/path, nonexistent/stale generated context and replaced reviewed identity assert typed rejection and preservation; explicit fresh inspect/bind recovers. Runtime boundaries and Library occupied-port sentinel prevent false success. Passed.
- T027 / AC-015 / FR-014: isolated identity substitution, invalid output path, occupied owned sentinel and explicit normal-control retry are exercised. No user service/port is targeted. Passed.
- T028 / AC-016 / FR-014 / NFR-001: hard save/migration-worker/promotion exits cover precommit, committed/reconcile and promotion boundaries; rows, physical constraints, verified backup, authored bytes, full model, metadata reconciliation and second recovery are asserted. External postcommit change stays explicit recovery-pending and blocks mutation. Passed.
- T029 / AC-017 / FR-015 / NFR-002: bounded real MCP/direct validation, revision, idempotency, authorization and resource/shared state; independent fresh-ID challenge also passed. Passed.
- T030 / FR-017 / C-004 / C-005: original harness failures and their corrections are retained; no product defect was invented and no production repair was required. Focused replay passed. Passed for this package; mission final verdict remains later work.
- Library addition to AC-010 / FR-004 / NFR-001: nullable column migration compares exact ordered tuples plus new NULL values; destructive Cancel preserves physical state; declaration restoration uses ordinary controls; unrelated wizard-authored project model and DB bytes remain unchanged. Passed. Earlier Workshop proof belongs to its already reviewed package, not a new WP06 Workshop journey claim.
- C-002/C-005: disposable owned fixtures and child handles preserve user studies; public proof excludes raw configuration, capability, DB and credential traces. Passed.

Scope remains explicit: AC-016 fault observations for both consuming applications share one app-independent disposable parent/child WAL boundary fixture. They are **not** two schema-specific interrupted Workshop/Library UI journeys. Evidence text accurately discloses this. This shared-core proof is accepted for WP06's failure-mode contract; the final two-app clean cycles and final readiness matrix must preserve that distinction. AC-017 does not stand in for the separately queued full MCP workflow or cold UI authoring. WP06 approval is not final mission approval.

## Required anti-pattern checklist

1. Dead code: N/A — no new public production function/module. New private durable observer is called by the recovery assertions.
2. Synthetic fixtures: PASS — tests invoke real Studio, real SDK MCP, canonical core, actual subprocess exits and actual SQLite; literals are independent expectations, not asserted substitutes for execution.
3. Silent empty return: PASS — no new swallowed error/empty-success path.
4. FR coverage: PASS — mappings and observable assertions above cover package scope; final readiness remains expressly outside this verdict.
5. Frozen surface: PASS — delta contains only owned tests and the authorized recovery evidence exception, no frozen production/milestone surface.
6. Locked decisions: PASS — normal UI authoring remains visible controls; fault/parity fixtures and modes are separate; no hidden model rescue, broad kill or live study mutation.
7. Shared-file ownership: PASS — recovery matrix additions are explicitly owned; recovery evidence exception recorded above; inherited files excluded from this review.
8. Production fragility: N/A — no production code changed or new production raise introduced.

Verdict: **APPROVED**; no waiver, no self-review fallback, no remaining WP06 blocker.
