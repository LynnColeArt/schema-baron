# WP25 usability and measured scale

## Scope and reproducibility

This package measures actual Studio browser rendering and owner/SQLite work. The scale builders under `fixtures/scale/` are test workloads only. The primary keyboard application starts from a blank project and blank SQLite database and authors its schema/forms/query/policy through the visible product.

Use Node 24.22.1 on PATH, `npm ci --ignore-scripts --offline`, `npm run native:smoke`, `npm run build`, then `npx playwright test tests/e2e/usability --workers=1`. Never opt in to lifecycle scripts. Axe source is explicit in each audit JSON; the run used `/tmp/wp05-accessibility/node_modules/axe-core/axe.min.js` (axe-core 4.11.0). Supply `AXE_SOURCE` to reproduce with an existing reviewed local copy. No dependency was added.

## Measurements

Authoritative run: `/tmp/wp25-authoritative`, two tests passed in 20 seconds. Root and WP24 confirmed all heavy builds and fault batches had ended before this run. The machine is shared, so recorded load averages are retained alongside CPU/RAM/OS/runtime/browser. Each distribution retains all 30 unrounded samples after five warm-up operations; p95 uses nearest rank (29th sorted observation). Full project cardinality is 50 pages, 200 forms, 1,000 controls: 1,250 actual Explorer tree items and four actual forms in the selected page sheet.

| Measurement | Observed ms | Budget |
| --- | ---: | ---: |
| Browser property event to rendered draft/tab p95 | 39.70000001788139 | <200 |
| Browser keyboard selection to rendered properties p95 | 80.7000000178814 | <200 |
| Full automation property roundtrip p95 | 165.20893400000023 | separately disclosed |
| Full automation selection roundtrip p95 | 165.1524389999995 | separately disclosed |
| Service-ready reopen | 200.12576400000034 | <3000 |
| Staged Save command/observed completion | 231.958165 | no separate budget |
| Indexed 10,000-row, 100-row keyset page HTTP p95 | 124.02411000000029 | <1000 |

Browser measurements start with the real captured input/keydown event and finish after the expected property/active-tab state and next animation frame. Automation measurements include locator/focus/keyboard/assertion round trips. Reopen includes page navigation and observed restored draft. Save includes the actual staged owner commit; it is never represented as a sub-200ms edit. The query test uses a real bound SQLite database and the owner query worker with changing keyset parameters, asserts the first returned key and all 100 rows, and records `SEARCH records USING INTEGER PRIMARY KEY (rowid>?)` from the equivalent indexed query plan. It does not time a mocked database or in-memory substitute.

A preliminary test during this agent's concurrent build recorded a failed automation selection p95 of 267.16998500000045 ms. Its raw JSON is retained as preliminary, not an authoritative pass. The authoritative run was repeated after functional fixes and a coordinated quiet window; no failed sample was removed from either distribution.

## Diagram regression and continuity

The red scale test selected the first of 50 tables (500 columns), edited Table name, then failed because that node disappeared from the visible diagram. Investigation showed `visibleTables` moves edited overlays to the end of its array, while default positions previously used the current array index. The table jumped from row zero to row twelve, outside the viewport. Retaining measured dimensions alone did not repair this reproduction.

The coordinated shared fix caches default positions by stable table ID for the mounted project and honors existing explicit drag-stop positions first. Actual measured dimensions also survive controlled node reprojection using the already-tested flow-map measurement helper; this is continuity hardening, not a separately proven cause of the original offscreen jump. Semantic table data and migration behavior are unchanged. The green test performs 20 diagram-selected edits, asserts nonzero real node bounds and selection, drags the node, saves, and zooms. It repeats 20 edits in native 200% Chromium, retaining the selected node through Save. Actual axe on the native schema surface found zero WCAG 2 A/AA and 2.1 AA violations. The separate actual 100-node map performs 20 property edits and pan/zoom/fit without draft or selection loss.

## Historical fidelity review

References are the authored `docs/references/manual-index.json`, source checksum `e03791633bcd06e6a76cef2bddb6c2c4432cac99c7d20b4eea04b8370489be30`. Actual local pixels inspected: PDF pages 21, 29 and 134. The supplied PDF and all its derivatives remain private/ignored; this report and new product screenshots contain no manual pixels.

Page 21 shows Explorer left, document center, Toolbox above contextual Properties right, and Messages under the document/mode strip. Page 29 confirms Forms/Controls/HTML toolbox categories and Format/Data/Events properties with selected-object context. Page 134 distinguishes Design, HTML, Code, Preview and executing Live Page. Screenshot annotations and current-mode evidence follow the same five-region structure.

Intentional modernization: readable 13–14px type and labeled buttons replace tiny bitmap glyphs; neutral restrained chrome and thin borders replace beveled blue title bars; explicit generated/authored ownership and sandboxed current-draft Preview replace ambiguous source coloring. Form wizards are temporary modal commands. Normal page editing has no persistent project wizard. Native browser zoom uses profile `partition.default_zoom_level.x = log(2)/log(1.2)`, and asserts 1280×800 physical viewport produces 640×400 CSS viewport, DPR 2, CSS zoom 1 and visualViewport scale 1; reduced viewport alone does not qualify.

## Verification and limitations

Results for the final keyboard/five-mode walkthrough, screenshot annotations, and final verification commands are appended after their observed runs. Missing Spec Kitty charter context is reported as missing, and the Python architectural gate remains unavailable/no_coverage/unverified; neither is manufactured into a pass. Existing unrelated Equipment/Publication data and oldschemabaron were untouched. Each test creates isolated approved temporary project/output roots and terminates its own owner and runtime processes.

The initial five-mode keyboard run edited an authored annotation and demonstrated compile/preservation only. Its evidence is explicitly named `preliminary-annotation-only-*`. The final journey strengthens that proof: it constructs a Record and insert/cancel declarations through the normal wizard, edits a typed validator function body through Code using the keyboard, regenerates, builds, and invokes the validator from the actual generated Live Page. A blocked tenant retains inputs and leaves zero rows; corrected input writes the expected tenant/code tuple and follows the authored success route. It repeats the entire authoring/runtime journey in native 200% Chromium. The current-draft heading differs from the generated heading after runtime reload, proving Preview/output separation.

The inherited skipped five-mode placeholder was removed with root coordination. One authoritative executable journey now lives in `tests/e2e/usability/workflow.spec.ts` and its owned helper; the old document-modes suite links to that test rather than keeping a skip or metadata-only substitute.

Verification observed: production workspace build passed; `npm run typecheck` passed (the intentionally empty UI workspace reports NOT IMPLEMENTED); all 466 Vitest tests in 71 files passed; all 10 inherited schema-editor/document-modes/flow-map browser tests passed. The percentile helper's independent Node test passed and the owned tests/fixtures pass strict TypeScript using `tests/performance/tsconfig.json`. Baseline diff lint uses the actual WP25 preimplementation commit `9b9a0d1`; comparison to lane-w also contains later shared mission-state files absent from this lane and is not the owned-change lint baseline.

WP26 follow-up: active acceptance tests still reference this host's Node/npm toolchain, and the default axe path is an external local audit asset. This run establishes measured functionality on the recorded reference machine; it does not establish a portable clean-checkout test installation. WP26 owns a portable toolchain resolver, an explicit pinned axe prerequisite, and independent clean-environment proof. Preserve the historical raw results when making that follow-up.

Final retained keyboard run: **2/2 passed in 55.4 seconds**, normal 27.1 seconds and native 26.4 seconds. Both raw journey files retain the actual edited validator source, empty rejected-write rows, accepted `{tenant:"accepted",code:"one"}` row, and `/keyboard` return route. Both executed axe reports have zero violations. Normal screenshots capture all five modes and contextual Format/Data/Events at both required sizes; Events is shown for a selected control, consistent with the product's contextual tabs. Native keyboard and schema screenshots retain actual browser 200% metrics.

See [1280 annotated workspace](screenshots/annotated-workspace-1280.svg) and [1920 annotated workspace](screenshots/annotated-workspace-1920.svg). The vector callouts frame only newly captured product screenshots; they contain no redistributed manual pixels. Numbered callouts identify the five docks and explain intentional modernization against inspected manual pages 21/29/134. All modes and property tabs also have unaltered PNGs in the same folder.

The final scale continuation passed all three scale tests, including native schema drag, background pan, Save and Diagram/Table-list reprojection. Its combined exploration log also records an earlier keyboard option-read race that was corrected by waiting for actual selectable options; that test failure was not a product failure. Final delivery keyboard source uses explicit observed completion barriers for asynchronous query/source/runtime operations, never sleeps as a substitute for readiness.

Final source/evidence checks: baseline diff lint passed; strict owned-test typecheck passed; credential-pattern scan passed (heuristic). Production JavaScript/gzip byte sizes are retained in `measurements/production-bundle.json`; there is no defined repository bundle-size threshold, so this is a measurement without a fabricated budget verdict. All owned test processes exited; no owner/browser/runtime from this lane remains running. Full-suite generated parity scratch artifacts were restored/removed rather than included in WP25.
