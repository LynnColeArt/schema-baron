---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T09:53:48Z'
reviewer_agent: reviewer-renata
wp_id: WP17
---

# WP17 independent review — changes requested

Reviewer: reviewer-renata. Product source 14375ba against approved WP12+WP16 combined baseline c3856ab3021770bb038cd05ddf761c12d420b043. Coordination-only commits excluded. No product edits.

## P1 — Report deadline does not terminate native SQLite execution

Location: packages/generator/src/templates/report/runtime.template:32-36 and worker.template:8.

The report executes synchronous better-sqlite3 inside a worker thread. The five-second timer calls Worker.terminate() without awaiting it, then rejects the request. Worker termination cannot interrupt the native SQLite call, so expensive public report requests continue consuming a CPU and holding their read transaction after the apparent timeout. Repeated public requests can accumulate active executions.

Independent compiler-accepted reproduction (not injected arbitrary SQL): a 90,000-row table with required composite primary key, used twice under aliases a/b; an inner many-to-many join with boolean literal true; one integer COUNT(*) projection; no parameters, GROUP BY or ORDER BY expressions; grain {strategy:'grouped', keys:[]}. Canonical parseProject/compileQuery accepts the AST. The deduplicated physical source count is 90,000, below the 100,000 budget. The resulting aggregate evaluates 8.1 billion joined rows.

Reproduction: PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH node /tmp/wp17-deadline-observe.mjs (calls /tmp/wp17-deadline-production.mjs). Uses the actual emitted runtime and worker from a fresh generated app; the test harness replaces only server-only/connection imports for direct execution. The response was a report error at 5011 ms, but the isolated process remained alive and accumulated another 182 user CPU ticks from 6.5 to 8.5 seconds. Reviewer then SIGKILLed only that disposable process. A separate run remained at 100% CPU at 12 seconds and required timeout16s (exit 124).

Evidence: /tmp/wp17-deadline-observation.json; /tmp/wp17-deadline-ul5b2n/compiled.json and result.json; earlier /tmp/wp17-deadline-y2l7EX/compiled.json and result.json. Scripts retain the exact accepted AST and database setup. These tests read disposable data only.

Required correction: execute generated report SQLite work through a genuinely interruptible boundary, such as the approved preview's isolated child-process approach. Keep query semantics, read-only connection, same transaction/schema/grain checks and exact decoder. On deadline/error/disconnect/shutdown, kill and await actual execution exit before reporting terminal cleanup. Add a compiler-accepted expensive-query regression that proves no live execution/continued CPU after deadline, rather than merely asserting the early error response. Verify standalone production output after the change.

## Independent verification and scope

- Seven focused report contract tests pass.
- Workspace strict typecheck exits zero (existing @schema-baron/ui NOT IMPLEMENTED label remains).
- Fresh E2E passes in 43.8s: real MCP authoring, visible Studio properties, reviewed migration, independent offline ci --ignore-scripts/typecheck/test/production build, Studio stopped during generated runtime, composite parent-child links, independent integer oracle 0.3000 → 0.6000 → 0.8500 → 0.6000, HAVING/zero-child, forged derived submission rejection with unchanged DB, invalid inputs and persisted reopen. Artifact /tmp/wp17-report-wWAATK.
- Independent heldouts cover blank text, false, blob roundtrip/invalid base64, safe integer boundary, exponent numeric input, infinity/date/decimal refusal, default/null/value modes, duplicate/unknown/missing/page errors and grain refusal. Results /tmp/wp17-review-kuDICd/results.json. Its deadline case verified response timing only; subsequent process-liveness investigation found this P1.
- check:dependencies passes 182 installed metadata/76 optional absent/258 artifacts. Independently compared lock package entries: only generator workspace map differs; original registry records and observedAt unchanged. Narrow shared integration edits and lock evidence rebinding were authorized and documented in EVIDENCE.md.
- Actual production callers: compiler → compileQueries/compileDerived; base → reportFiles/queryRuntimeFiles/queryScalarFile; emitted report → readReport → worker → executeQueryPreview; workspace/query binding and forms → ReportBindings/DerivedBinding; model validation/navigation/compiler → queryInputs.
- Public report → protected Record login/resumption remains pending WP14 integration (WP13 separately approved); two regeneration cycles remain pending WP20. Neither is counted as passed. Python no_coverage gate unavailable, not a passing test.

## Required eight-check assessment

1. Dead code: PASS. New public modules have production callers listed above.
2. Synthetic-fixture test: PASS. Focused compiler/emitter tests invoke production functions; E2E authors through public operations and executes emitted output with independent SQL arithmetic oracle.
3. Silent empty return: PASS. Conditional editor null returns hide inapplicable properties; no-derived return is explicit optional compilation; runtime empty rows always carry visible error and worker failure is posted explicitly.
4. FR coverage: PASS for this package slice. C-007 generic alternate names/composite keys; FR-014 links/context; FR-019 author/reopen/filter/formatting; FR-020 exact derived output and refresh; NFR-006 standalone type/test/build; NFR-009 exact oracle. Deferred auth/regeneration integrations remain explicit, not waived.
5. Frozen surface: PASS. No frozen asset altered; narrow shared model/runtime/compiler/UI registrations and workspace dependency edge expressly authorized.
6. Locked decision: FAIL. Bounded execution/deadline guarantee is not met: native work survives the five-second apparent timeout. No second query semantics or acceptance identifiers found.
7. Shared-file ownership: PASS. Model, SQLite bound-slot metadata, compiler/IR/base/navigation/UI registration and lock rebind are narrowly coordinated; rationale in package EVIDENCE.md and this review.
8. Production fragility: FAIL. Public report timeout leaves uninterruptible native worker execution/transaction active. Other new throws fail loudly for invalid parameters, unsupported declarations, missing builds and runtime contract drift and are caught at the generation/request boundary.
