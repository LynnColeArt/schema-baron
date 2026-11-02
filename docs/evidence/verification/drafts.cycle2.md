# WP05 cycle 2: decimal buffer lifecycle

Audience: the independent WP05 reviewer and WP08 replay owner. This record
supersedes the cycle-1 source result for R1; all earlier proof files remain
unchanged historical evidence.

Review event: `01M6EDQK7XD31BS1MW7PRSQ1K0`.
Rejected source: `f86b3cab6c2609e096c446f68acd362195fb1793`.
Production repair: `5164a11d45e9a386739a6f1ddaa433a3974f01d7`.
Exact five-case browser source: `f6ecb1d89bd6b2c2e0eb31947c65f492e3a581a4`.
Documentation/proof commits are separate.

## R1 reproduction and repair

The new UI regression reproduced the review failure before the repair: enter `-`
in Decimal scale, change Logical type to integer, and Save schema. Decimal scale
disappeared, but Save rejected the obsolete hidden buffer. The owner kept decimal
type. The fresh UI red run had one failed test and no retries; its raw private
JUnit, screenshot and log are retained. `drafts.cycle2.failures.json` records the
sanitized source comparison and development-check failures.

`applicableSchemaBuffers` in `schema-editor/state.ts` now scopes text to actual
fields in the desired schema. Default-literal buffers require a live column;
scale/precision additionally require decimal type. It considers every table and
column, regardless of selection. The production dirty count, Save guard and
explicit table-mutation path call this helper.

An explicit logical-type change or column/table removal retires text belonging to
the fields it removes. Switching views, projects or reloading does not perform
that retirement. Undo/redo restores model history; it does not resurrect unfinished
type-specific text intentionally discarded by the semantic edit. Returning to the
old decimal model therefore shows its model numbers (tested as scale 2, precision
18), while another still-active decimal column's text remains intact.

The exception remains narrow: `schema-editor/index.tsx`, `state.ts` and
`state.test.ts`, plus the owned draft acceptance test. There is no model change,
fixture-name branch, dependency change or general editor redesign.

## Fresh observed proof

- Two state regressions check live/type-specific applicability, removed-column
  orphans, another decimal column and deliberate undo semantics. All 46 focused
  workspace/schema/query tests in six files pass.
- The new real-UI lifecycle case first saves the exact repaired decimal-to-integer
  transition, then exercises scale and precision retirement, undo and redo. With
  a second decimal column holding `-`, it changes the first column's type again.
  Save must still reject that other active buffer even when its column is not
  selected. View switch and reload retain it. Correcting its type then saves only
  the intended schema definitions. Other project settings and business database
  bytes remain unchanged.
- The original four cases were replayed on the same committed source: Page,
  Schema, Query and Control recovery; one real acknowledged background revision
  per editor; thirty actual second-tab UI Saves with title receipt before exact
  text/range/focus assertions; three intentional keyboard-focus negatives;
  explicit competing revision; rejected Save; project and business preservation.
- Final browser JUnit: five tests, zero failures/errors/skips/retries, 74.87 seconds.
  An earlier five-case pass at production commit `5164a11` is retained separately;
  the final test-only commit strengthens simultaneous other-column preservation.
- Thirty fresh raw timing samples record the same reference machine and shared-host
  load. Feedback p95 is 10.47ms, Save p95 78.40ms, maximum Save 87.83ms. Unchanged
  thresholds are 2000ms feedback and 5000ms Save. No timing distribution was
  fabricated or inferred from polls.

Typecheck, full build, diff lint and credential scanning passed. One stale local
identifier was caught by typecheck/build and corrected before any green browser
consumer started; those failed check logs remain retained. No build ran while an
owned UI consumer was alive. Scoped pinned axe 4.11.0 checks again found zero
violations in Properties, Schema Properties and Query regions (16/17/14 passing
groups). Bundle bytes are an observation only; no byte budget is declared.

This remains mixed Studio-owner proof: Workshop supplies Page/30-event timing;
isolated Library supplies Schema/Query/Control recovery and the new lifecycle
case. It does not claim an editor-by-application cross product, separate timing
distributions for each full app, or final acceptance. Both full application
journeys, aggregate coverage and the final load-controlled NFR verdict remain
WP08 work. The canonical head gate and independent re-review are recorded
separately; the implementer does not approve its own work.
