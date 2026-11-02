# WP05 draft and render verification

Audience: the independent WP05 reviewer and WP08 replay owner. This is owner
draft proof only. These fresh Studio-only Workshop/Library fixtures have one
small table and their wizard-created editable pages/forms/controls; this does
not claim a generated visitor journey or the final performance verdict.

Production repair commit: `5870c0c0f435a282c39072fd109a3bdf4a8c1b0c`.
Final test source: `659f224fc89b6bea8a08746f8bd4bdebf5bb909b`.
The documentation/proof commit is separate. Final replay completion is recorded
in the adjacent observation JSON and retained JUnit.

## Recovery inventory and procedure

| Editor | Actual draft boundary | Verified recovery | Rejected/conflicted status |
| --- | --- | --- | --- |
| Page | `workspace/state.ts` per-object value/base/revision, `workspace/session.ts` project-keyed editor/view recovery | Explorer document switch; project switch; same-tab reload restores selected object/tab and dirty text | Empty title reports canonical entity-schema field diagnostics; no owner write; same-field competing UI Save disables Save until explicit resolution |
| Control | Same workspace store; `forms/scalars.ts` separately retains invalid numeric text without replacing the committed number | Schema view and back; project switch while its query is open; same-tab reload retains caption, Width `-`, selection, active control and dirty state | Width error retains both caption and numeric buffer; project model remains unchanged |
| Schema | `schema-editor/index.tsx` project-keyed `studio.schema` recovery and in-memory view state; table drafts/base/conflicts, default and decimal text buffers | Toolbar Schema toggle; project switch/back; reload then reopen Schema; table/column identity, unsaved table name and scale `-` remain | Save schema identifies incomplete numeric/default input and preserves draft; no migration or model write |
| Query | `query-designer/index.tsx` project-keyed `studio.query` recovery; each query has value/base/history, selected section, diagnostics and selection | Queries toggle; project switch/back; reload then reopen Queries; query name and integer parameter default `-` remain | Save query retains diagnostics and scalar text without creating a persisted query |

Focus metadata contains only field labels and selection offsets, scoped by project
and object/section. Workspace and Schema use `workspace/draft-focus.ts`; Query
retains its existing per-query view store. Restoring focus does not overwrite the
stored selection. No model-revision dependency triggers autofocus. Closing the
browser tab is outside sessionStorage recovery; the tested reload path keeps the
same tab. Specialized editors are reopened through their toolbar after reload.

Every editor receives a real unrelated same-project UI Save before switch/reload.
The active tab must visibly acknowledge that exact service revision before its
text/focus/selection assertions. Read-only owner snapshots verify that only the
other page and revision changed. Page additionally receives thirty individually
observed UI revisions while a dirty title and range `[4,11]` remain active.

## Defects and retained failures

All failures preceded their repairs. The private run logs and screenshots remain
under their distinct run directories; public artifacts contain no raw identity,
owner keys, project paths, databases or traces.

| Defect | Reproduction and actual result | Narrow repair and regression |
| --- | --- | --- |
| DRAFT-01, high, FR-013 | Baseline `5f10082`: type an unsaved page title, keyboard-select a range and reload; text survives but active control does not. The later document-switch case exposed the second click stealing restored focus. | Project/object-scoped selection recovery, also activated when the document opens. The page test checks both switch and reload, exact range, focus and enabled dirty Save. |
| DRAFT-02, high, FR-013/014 | Baseline Schema Decimal scale: clear then type `-`; rendered value becomes `0`. | Keep unfinished scale/precision text in the existing schema buffer store; reject Save with retained-text status. The schema case checks unrelated receipt, invalid Save, switches, reload, text, range and unchanged committed schema. Root approved the narrow `schema-editor/index.tsx` ownership exception. |
| DRAFT-03, high, FR-013 | Expanded query recovery: select `[0,1]` in parameter `-`, switch projects, reload; restored selection becomes `[1,1]`. | Suppress Query's focus capture during its own restoration, preserving the original range. Root approved the narrow `query-designer/index.tsx` exception. |
| DRAFT-04, medium, FR-014 | Empty page title Save retained the draft and model but only said “Command does not match the operation schema.” | Workspace checks the canonical `entitySchemas` before submission and presents the exact field and validation message. Server validation remains authoritative. |

Earlier harness failures are retained too: the first schema selector omitted its
type suffix; the first programmatic selection did not emit normal keyboard
selection events; one run reused an already configured owner while expecting
first-run settings; and a project button matcher omitted its accessible-name
space. Tests now use real keyboard selections, fresh owner per case, exact
selectors and zero automatic retries. Intermediate thirty-sample captures are
explicitly labeled as intermediate, not final-source proof.

A separately labeled fault replaced `reconcile`'s current drafts with `{}`.
Four of six focused state tests failed; the other two passed. The original source
was restored with a matching checksum before rebuilding. This was a deliberate
test-sensitivity experiment, never a UI authoring shortcut or a persisted edit.

## Isolation, interaction and timing oracle

The 30-event case edits a different page through real Studio controls and Save in
a second tab. Each new title must render in the drafting tab before checking its
draft, exact range, focus and single property input. It then checks three more
received revisions with intentional keyboard focus on an Explorer row, toolbar
button and another property. None may steal that focus.

A legitimate competing same-field UI Save produces an explicit conflict. Save
stays disabled until “Keep my draft”; a subsequent invalid Save changes neither
project. A valid resolved Save changes only its intended page. The other project
retains its unsaved title and exact range after switching back. Read-only complete
project comparisons and before/after business database byte hashes reject any
unintended persisted, business, schema, form or control changes.

Thirty raw feedback/Save/receipt samples include machine, Node/browser and load
context. Feedback is measured from visible typing to the matching rendered tree
title; Save includes the real response and Saved status; receipt is separately
measured until the other tab renders the revision. The unchanged thresholds are
p95 feedback ≤2000ms and every measured Save ≤5000ms. WP08 owns the final NFR
verdict and remeasurement under its declared load.

## Validation and reproduction

Use the pinned Node 24.22.1/npm 11.19.1 PATH and lane-local `npm ci --ignore-scripts`,
then `npm run native:verify` and `npm run build`, awaiting each before Playwright.
Local workspace package links resolve into this lane. No parent node_modules,
live Studio, generated runtime, seeded project or private repair is used.

Run `npx playwright test tests/e2e/acceptance/drafts.spec.ts --workers=1 --retries=0`.
The test supplies fresh owner config/roots, unused ports and browser contexts;
private provenance records PID/birth identity/port and test hash. Only owned child
processes are stopped and awaited. Traces stay off. Keep failures in a new output
directory on every explicit rerun.

Local typecheck, full build, diff lint and credential scan passed; the focused
workspace/schema/query suites passed 44 tests in six files. The empty placeholder
`@schema-baron/ui` package reports NOT IMPLEMENTED for build/typecheck; it is not
counted as an implemented UI package. Charter resolution reported no charter;
that absence is recorded, not represented as a passed charter check. The canonical
head gate and independent review remain separate from these local results.
