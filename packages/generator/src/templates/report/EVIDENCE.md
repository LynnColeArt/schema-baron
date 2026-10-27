# WP17 verification and integration record

Implemented on approved WP12/WP16 dependency baseline c3856ab (lane-q).
The dependency merge and its existing wizard/CRUD proof are not report evidence.
No authentication or regeneration implementation was copied into this package.

## Actual authoring and standalone proof

`npx playwright test tests/e2e/reports/workflow.spec.ts` passed on 2026-10-27
(final run 26.4 seconds). It authors a fresh project through public MCP operations:
inspect/bind an external composite-key parent/child schema, declare exact decimal,
review/apply its migration, save a left-joined grouped query with a typed HAVING
minimum, construct ordinary Grid/Record entities, and declare links/actions.
Disposable source rows are seeded only after the reviewed migration; no prebuilt
application/model file substitutes for authoring.

The browser opens that project in Studio, edits its runtime parameter name in Data
properties, and authors a read-only query-derived expression with an explicit saved
query dependency. Normal Save and MCP inspection agree. Generation uses public
preview/apply commands. The independent app installs offline with scripts disabled,
strictly typechecks, runs tests, builds for production, and runs with Studio stopped,
no workspace links, and empty NODE_PATH.

Observed production browser behavior:

- Preview/runtime agree on 0.3000, 12.3400 and zero-child 0.0000.
- Composite parent keys reach the child list and selected Record.
- Edit/add/delete immediately produce 0.6000, 0.8500, 0.6000 on redirect.
- Independent SQL integer-ten-thousandths sums formatted with BigInt string arithmetic
  agree after every mutation; the oracle does not call generated arithmetic.
- Minimum 0.5000 includes the changed parent; 0.7000 excludes it. The minimum survives
  child navigation and record returns.
- Forged derived report input is rejected without changing the source amount.
- Invalid decimal, unknown/duplicate inputs, invalid explicit null and page values
  show errors. Omitted values use query defaults.
- Restart/inspection reopens identical queries/forms/controls/actions, including
  bindings, formatting, dependencies and links.

Private disposable evidence: `/tmp/wp17-report-x77mFQ/demonstration.json`,
`authoring.png`, `report.png`, and independent install/typecheck/test/build logs.
Generated source: `/tmp/wp17-report-x77mFQ/output/app`. No capability/credential is
included in this committed record.

## Coordinated shared edits and rationale

- Model schema/validation/queryInputs/export: retain legacy literals, add exclusive
  typed runtime inputs with unique names, resolve dependency-query parameters.
- SQLite compileQuery: optionally record input-to-bound-slot metadata while preserving
  prepared SQL, exact scalar semantics, and grain checks.
- Generator manifest/lock/IR/compiler/base: register the working report emitter and
  portable query modules with real typed source/result metadata and SQLite dependency.
- Navigation compiler/runtime: retain only declared typed report context, share the
  report scalar decoder, and omit irrelevant value text in default/null mode.
- Studio properties/workspace/query binding registration: expose ordinary canonical
  report properties and reuse the existing expression editor; keep the old literal
  binding import compatible. Query editor guidance now points to Grid reports.

The executor and exact decimal functions are emitted from the actual built SQLite
preview runtime, with no Studio package imports/source paths. Reads use query-only
connections and one snapshot covering schema/key/grain checks and result decoding,
a 100,000-row source budget, and a five-second child-process deadline that waits for actual exit. Fresh
workers plus force-dynamic routes avoid stale child totals. Grid page size is bounded
at 200 and offset is a validated prepared value.

## Checks and limits

Passed: full workspace 338 tests/45 files (`npm test -- --maxWorkers=2`), strict
workspace typecheck, production build, diff-scoped lint, native SQLite transaction/
backup check, and offline audit (zero known vulnerabilities in available metadata).
All seven report contract tests passed, including emitted scalar decoding and
object-linked query compiler diagnostics. An initial unconstrained parallel suite
hit the existing cancellation responsiveness deadline under simultaneous builds;
the complete two-worker rerun passed without changing its test/deadline.

Query-backed Grids use saved-query WHERE/HAVING inputs and orderBy. Table form
search/sort and incoming report keyMapping settings fail generation with actionable
diagnostics; report row identity comes from query grain. Derived controls use row
expressions over the saved query; child aggregation belongs to that query graph,
not an invented cross-table Record binding. Order expressions must be projected
when deriving a report so the outer query can preserve that order explicitly.

Public report reads/links work signed out. Query-source authenticated navigation/
Search actions are explicitly refused until a proven keyed-query read guard exists;
report emission omits the table-only navigation endpoint. A public report link to
a protected Record must retain the destination guard during auth integration.
WP13/WP14 login resumption integration remains pending, not passed by this proof.

Two reviewed regeneration cycles remain pending WP20. No final auth integration,
regeneration, performance budget, deployment, or mission acceptance is claimed.

The registry evidence lock hash was rebound after programmatically comparing every
external package/link entry to c3856ab3021770bb038cd05ddf761c12d420b043 and asserting
that the only differing package entry was the generator workspace dependency map.
Only its existing @schema-baron/sqlite workspace edge was added. Original observedAt
and registry artifact records were preserved; no new download/registry verification
is claimed. Offline dependency verification then passed: 182 installed metadata
records, 76 platform-optional absent, 258 registry artifacts.

## Review cycle 1 — native deadline correction

Review event 01M5YCFJF2HF6D6J3W53D0J2TQ correctly found that Worker.terminate()
could return an error before synchronous native SQLite stopped. The original
implementation therefore did not meet its claimed execution bound. Its public
lifecycle/precision proof did not establish native execution cleanup.

Report work now uses one isolated Node child with advanced IPC, the identical
query executor/decimal helpers, query-only mode and same read snapshot. On timeout,
AbortSignal, IPC/process failure or host shutdown the actual child is SIGKILLed;
readReport does not settle until its close event. Normal results are published only
after SQLite rollback/close, and also await process close. Existing four-argument
readReport callers and all query/decoder/binding/context semantics are preserved.

The new accepted-query regression compiles a real 90,000-row self-join COUNT
(8.1 billion candidate pairs, below the existing physical-source budget). Against
14375ba it failed because native execution kept the runner alive after the error;
the test watchdog cleaned up its disposable process. With isolated execution it
requires a five-second error, prompt runner exit, the observed native child PID
already absent, and no forced watchdog cleanup. Additional cases cover successful
reads, cancellation, missing database, crashed child, host SIGTERM and disconnect.
The direct Node harness adapts only framework server-only marker imports; compiler,
emitted query runtime, executor, native data and process lifecycle are real.

Failed-before log: /tmp/wp17-deadline-confirmed-red.txt. Final repair checks and
production output evidence are recorded in the review handoff. Auth14 integration
and two WP20 regeneration cycles remain pending; this correction does not pass them.

Repair verification: all 9 report tests in 2 files passed (6.92 s), workspace strict
typecheck and generator build passed, and diff lint passed. The final accepted
expensive query timed out at 5014 ms, its observed native child PID was already
absent, the runner exited 0, living executions were empty, and watchdog cleanup
was false: /tmp/wp17-deadline-repair.json. The standalone public-authoring/production
walkthrough passed in 25.6 s with the actual child runtime, including offline
install, strict output typecheck/tests/build, exact CRUD/minimum/filter-return
oracles and persisted reopen. Its evidence is /tmp/wp17-report-nAFQMX. The first
strict-output rerun caught Next's augmented ProcessEnv requiring NODE_ENV; the
isolated clean environment now explicitly declares production, and the rerun passed.
