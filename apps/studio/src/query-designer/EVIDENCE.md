# WP16 — Visual query designer and saved data sources

Audience: independent WP16 reviewer and downstream form/report implementers.
Observed 2026-10-27 in isolated lane-p, based on approved WP08/WP15 interfaces and
recorded dependency merges `14c3b10d`, `35d80d5`. No WP09 executor or unapproved lane
was merged. Runtime remains Spec Kitty 3.2.7; no dependency/install-script changes.

## Scope and shared integrations

- `workspace/index.tsx`: register the focused document, named-query Explorer/menu
  entries and real Form Data Source actions. Page/schema/query documents remain
  mounted independently; Ctrl+S belongs to the active document. Add an explicit
  source selector label and a focusable schema scrollport for native zoom.
- `model/schemas.ts`, `validation.ts`, `README.md`: optional
  `Form.queryParameters: [{parameterId,value}]` is a typed per-form literal preset
  available before execution. A missing mapping leaves defaults/required checks
  in force; null is explicit. IDs, types/nullability and duplicates are validated
  by the canonical whole-project batch path. These are not request/control mappings;
  no query-result-root expression is evaluated before its own query. Record key
  mappings and appearance are separate and preserved. Root coordinated this exact
  contract with WP10; there is no second persistence or SQL path.
- `app/globals.css`, `schema-editor/styles.css`: root-authorized native-zoom repair.
  A reproduced failing test found the schema canvas intercepted Backfill input
  clicks. Studio now fits the viewport; the explicit focusable schema viewport
  scrolls both axes; commands/note/backfill do not shrink; the canvas center clips
  and scrolls its contents instead of covering the footer. The 400px editor minimum
  lives inside that scrollport; ordinary 1280px density is preserved.

The query designer consumes StudioClient's public `project.batch`, `query.preview`
and `job.cancel`. SQL remains a compiled, read-only view. Layout positions and
recovery drafts are session data, never query semantics. Canonical serialization
avoids false dirty state after save. Incomplete scalar buffers remain editable;
strict structural/whole-project checks govern save. Invalid recovery entries have
an original-data backup rather than replacing the saved model.

## Observed authoring evidence

`tests/e2e/query-designer/workflow.spec.ts` uses its own server, private owner config,
MCP bridge and disposable SQLite files. It authors every query expression through
visible UI controls; it never inserts a prebuilt query AST or executable SQL editor.
An externally created SQLite source is explicitly inspected/bound through UI;
its TEXT money column is explicitly declared exact decimal through the schema UI.

| Subtask | Observed outcome |
|---|---|
| T076 | Add member/entry sources, aliases, left outer join and ordered composite tenant/id equality using the list expression editor; keyboard position inputs alter only view data. Source movement leaves public saved semantics identical. |
| T077 | Project member name plus SUM(amount), explicit grouped grain/key, GROUP BY, HAVING and ORDER BY. Removing a required group yields object-linked INVALID_QUERY_GRAIN and refuses save. Reload recovers the invalid draft; correction saves stable projection IDs. |
| T078 | Decimal minimum has an explicit default and preview values. Minimum 0.00 returns 0.30/12.34/0.00; 1.00 returns Bert only; 100.00 returns empty. SQL has bound placeholders. Real worker cancellation, 1ms timeout, cost=1 refusal, row-limit=1 truncation, missing required value and null validation all execute through HTTP; final database bytes match original. Preview headers/results visibly become out of date on changed inputs/revision. |
| T079 | Save/rename/reopen retains query and result IDs. Form Data Source opens that exact query with a persisted literal preset (1.00). Unrelated MCP form/format changes retain dirty query typing; colliding names show explicit choice. Delayed real save acknowledgement retains newer text, focus and caret. Removing a control-bound output refuses the candidate and preserves committed fields. Public HTTP/MCP parity rejects duplicate, wrong-type, missing, null and wrong-source presets without partial persistence; stale writes return 409. Page/schema drafts survive query switches; Ctrl+S does not commit the inactive page draft. |
| T080 | Independent SQLite integer-cents oracle calculates Ada=30, Bert=1234, Cy=0; displayed exact decimals and MCP query_preview match. MCP project_inspect equals HTTP snapshots. Empty, invalid grouping, recovery, conflicts, save/reopen, cancellation and bounded failure cases all passed. |

Screenshots are retained in `tests/e2e/query-designer/evidence/`: source canvas,
compiled SQL/result grid, reopened form source, dependency refusal, cost diagnostic,
bounded preview, and zoom evidence. These are synthetic product data, not manual
screenshots or private credentials.

## Verification

Environment: Linux 7.0.0-38-generic x86_64; AMD Ryzen 5 5600X (6 cores/12 threads),
62 GiB RAM; Node 24.22.1/npm 11.19.1; Google Chrome for Testing 156.0.8078.4.

- `npm test`: **256 tests / 28 suites passed**, 16.76s. Includes 15 new draft,
  alias, scalar/recovery/canonical-equality and parameter-contract cases.
- `npm run build`: passed, including Next production output and public source /
  compiled worker modules. Existing unimplemented generator/ui packages are reported
  as such; no generated-application success is claimed.
- `npm run typecheck`: passed; new browser test independently passed strict tsc with
  noUncheckedIndexedAccess/exactOptionalPropertyTypes.
- `npx playwright test tests/e2e/query-designer/workflow.spec.ts`: **3 passed**, 16.2s.
- Native zoom was first reproduced red before CSS edits: Backfill input center was
  covered by React Flow. Actual isolated Chromium profile default zoom 200% then
  passed at outer1280×800, inner640×400, DPR2, CSS zoom1. Test asserts keyboard
  horizontal scroll, actual pointer hit/click on Backfill, keyboard Connect, parameter
  inputs, Ctrl+S, Run and real results. Native screenshots use device-scale pixels.
- `zoom-200.png` separately uses `document.documentElement.style.zoom='2'` at
  1280×800; this is explicitly a CSS-layout simulation, not native zoom proof.
- Route application chunk: 152,420 bytes / 42,569 gzip bytes. No mission bundle-size
  budget was specified; this is a measurement, not a budget-pass claim.
- Diff-scoped lint and final source whitespace checks recorded at handoff.

## Limits and handoff

Axe is not installed in the pinned dependency graph; no automatic axe report is
claimed. Native keyboard/pointer/label/focus tests and actual pixel review ran.
No NFR performance percentile or cross-browser claim is made by this focused slice.

Report UI, generated runtime query consumption and dynamic request/control parameter
mapping belong to downstream work. There is no fake generation implementation here:
the current candidate is visibly blocked on incompatible output/dependencies, and
canonical persistence refuses the invalid model. Existing saved query stays valid.

Retained final-build review service: `http://127.0.0.1:42305`, private configuration
`/tmp/wp16-browser-w90Jyq/owner.json`. Only WP16's own process was restarted after
native-zoom fixes; the earlier WP08 server and drafts were never touched. The retained
fixture contains the saved composite joined query, exact totals and bound form preset.
The private key is never included in source, screenshots, logs or this evidence.

## Review cycle 1 repair (cycle 2 handoff)

Source under review: `1f090eb`. Canonical review reference:
`01M5Y0TM3JREQNX11R7HWKYG6H`, `WP16-visual-query-designer-and-saved-data-sources/review-cycle-1.md`.
Both findings were reproduced before editing production code.

- P1: `recovery.ts` now validates a bounded recursive **editing shape**, independent
  of committed-query minima/semantic checks. Empty function argument lists,
  preaggregation alias lists, sources/projections, blank identifiers/names and
  intermediate decimal bounds remain normal editable drafts, including inside
  undo/redo snapshots. Unknown/malformed expression trees are still quarantined;
  a bad history entry does not discard the valid current draft or other entries.
  Original malformed data is retained separately with a visible recovery notice.
- P2: visible Undo query / Redo query and active-document Ctrl+Z, Ctrl+Shift+Z and
  Ctrl+Y operate on at most 100 semantic snapshots per direction. Native text-input
  undo is not intercepted. Navigation, focus, positions and result changes do not
  create model history. Current/past/future are three-way rebased together, including
  explicit conflict diagnostics for colliding historical edits. Choosing a conflict
  resolution starts a new history boundary, explained in the UI.
- Query section, diagnostic and input focus/caret metadata are recovered separately
  from model history. Save checkpoints preserve newer typing and history. Undo after
  Save only stages a different definition; it never changes SQLite or the committed
  project without an explicit subsequent Save.
- Convention confirmed with root: New query opens an unsaved document; no Delete or
  Remove query command is offered. Opening it is navigation. Undo can reach its blank
  definition, which remains recoverable/editable; Redo restores the saved definition.
  An incomplete blank or function draft cannot cross the strict atomic Save boundary.

The original reviewer probe was copied unchanged temporarily for execution, then
removed from the working tree. Original and temporary-copy SHA256 both remained:
`29702382727ef7bb15f5bc73ec1cd22434e7f2e85685fe9fc52d801c368fffe9`.
Original feedback SHA256:
`200278b46eb27f067a4ab15375bcc5b7728fbdccbe2685226efd1b872af41f35`.

| Unchanged probe measurement | Before repair | After repair |
|---|---:|---:|
| undoRestored | 0 | 1 |
| switchedFunction | 0 | 1 |
| switchedPreagg | 0 | 1 |
| switchedValid | 1 | 1 |
| reloadedFunction | 0 | 1 |
| reloadedPreagg | 0 | 1 |
| reloadedValid | 1 | 1 |

Observed verification on the repaired source:

- `npm test`: **264 tests / 29 suites passed**, 17.33s, including eight new focused
  history/recovery cases. Wrong current/history shapes, valid siblings, history
  bounds, unrelated remote rebases, historical collisions and save checkpoints
  are covered without changing canonical server validation.
- `npm run build` and `npm run typecheck`: passed. New/changed browser sources also
  passed independent strict tsc with noUncheckedIndexedAccess/exactOptionalPropertyTypes.
- Original three actual browser scenarios, new recovery/history scenario and the
  unchanged reviewer probe: **5 passed**, 22.0s. The existing actual native200 test
  still passed with the new Undo/Redo affordances. No shared native-zoom or literal
  preset contract edits were needed in this repair.
- The stronger native-text check additionally passed in isolation (7.1s total):
  browser text undo restored the text without creating a structural redo branch.
- The new full scenario authors invalid current/past/future through UI; retains
  three sibling drafts through page/schema/project switches and reload; resumes
  editing and saves original query/result IDs; recovers the blank undo state and
  redoes to the saved definition; rejects an invalid public batch with HTTP400 and
  unchanged project; preserves remote fields when undo restores a projection/source;
  and proves final SQLite bytes are unchanged.
- `recovered-query-history.png` and `continued-recovered-query.png` retain actual
  recovery/continuation pixels in the existing evidence directory. Source inspection
  confirms recovery is called from the live designer; strict Save still calls the
  canonical query schema and whole-project validator before public batch persistence.

The earlier axe/cross-browser/performance limits still apply. This is an independent
review handoff, not self-approval. No unreviewed WP10 source, compiler/worker change,
hosted sync opt-in, runtime upgrade or manual status mutation was introduced.

Cycle2 route application chunk: 157,874 bytes / 44,241 gzip bytes (measurement only; no declared bundle budget). Final diff-scoped lint checked eight source/test/evidence paths and passed; no whitespace errors.
