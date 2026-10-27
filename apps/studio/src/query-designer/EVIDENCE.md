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
