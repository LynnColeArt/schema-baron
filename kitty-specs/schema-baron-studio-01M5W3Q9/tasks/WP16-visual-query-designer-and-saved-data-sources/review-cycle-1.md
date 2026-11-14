---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T06:30:07Z'
reviewer_agent: codex/reviewer-renata
wp_id: WP16
---

# WP16 independent review — changes requested

Reviewer: codex / reviewer-renata. Product source: 1f090eb1ee58804c36ec8609ebe4c893dd1ad0bc. Reviewed against approved WP08 a87c76f and WP15 c5cedfff integration baseline, including merges 14c3b10d/35d80d5; inherited product code is not attributed to WP16.

## P1 — Recover supported unfinished query drafts instead of dropping them

Location: apps/studio/src/query-designer/state.ts:122-130; UI constructors in expression.tsx:463-468 and fields.tsx:44-48.

Reproduction through visible UI in a fresh disposable project:
1. Queries → New query; name it Recover unfinished work. Fields → Add projection → Projection 1 kind function. Remove argument twice, leaving args=[].
2. New query; name it Preaggregation draft. Fields → Aggregate grain preaggregated, leaving sourceAliases=[].
3. New query; name it Unrelated recoverable draft. Create another project and Open / Switch back, explicitly awaiting the project title. Then reload.

Observed independently on final production build: both unfinished drafts disappear on project switch and remain absent after reload; the unrelated draft remains. In a simpler direct-reload case the entire function draft also disappears. The UI reports invalid recovery entries and preserves raw text separately, which is useful salvage but offers no normal recovery path for supported intermediate UI edits. recoverDraft relaxes source/projection minima but still applies saved-query min(1) requirements to function arguments and preaggregated aliases. These are not malformed external trees: ordinary controls construct both shapes. Violates T077 unsaved-draft preservation and the shared editor-continuity contract (spec FR005, line131; edge invariant line118).

Required correction: define recovery validation for all structurally supported intermediate editor states, independent from saved-query semantic completeness. Preserve original buffers, query IDs, sibling drafts and histories. Keep strict save/preview validation and quarantine genuinely malformed trees. Add public UI regression coverage for both empty arrays across query/page/schema/project switches and reload; after returning, continue editing and save successfully, while an invalid candidate never reaches persistence.

## P2 — Provide model undo/redo for structural query edits

Location: apps/studio/src/workspace/index.tsx:358 excludes queryActive from the shared shortcut handler; query-designer/index.tsx:202-222 updates values without a history path, and its only key handler handles Save.

Reproduction: in the function expression above, remove the last argument, move focus outside a text input and press Ctrl+Z. Observed argument count remains0; no query Undo/Redo control is offered. The page statusbar still advertises Ctrl+Z Undo. Native text-input undo is not equivalent to restoring a removed expression/projection/join/parameter. The shared spec edge invariant at line119 says undo/redo concerns model edits, and FR005 at line131 requires model undo/redo through editor modes. This is a shared workspace contract applicable to the new model editor even though WP16 requirement_refs list only C002/FR018/FR019/NFR005.

Required correction: provide a query model undo/redo path that restores structural edits with stable identities, preserves history through editor switches and unrelated remote rebases, and presents explicit conflict behavior for colliding remote changes. Do not intercept native text undo incorrectly or undo committed database writes. Demonstrate deletion → undo → redo through actual UI with focus outside inputs and retained history across switches.

## Independent verification and evidence

- npm test: 256 tests /28 suites passed, 15.65s.
- npm run typecheck: passed (generator/ui packages explicitly report NOT IMPLEMENTED; no generated-runtime claim).
- npx playwright test tests/e2e/query-designer/workflow.spec.ts: all3 supplied scenarios passed independently, including visible joined exact totals, typed defaults/presets, dependencies, MCP parity, actual worker cancellation/timeouts/cost and native Chromium200% pointer/keyboard behavior.
- Reviewer heldout: /tmp/wp16-reviewer-heldout.spec.ts (copy into tests/e2e/query-designer/reviewer-heldout.spec.ts to rerun with the repository Playwright config; remove afterward). Result: undoRestored0, switchedFunction0, switchedPreagg0, switchedValid1, reloadedFunction0, reloadedPreagg0, reloadedValid1. All expected restored counts are1.
- Independent pixels: /tmp/wp16-review-before-reload.png, /tmp/wp16-review-after-reload.png, /tmp/wp16-review-after-switch-reload.png. Test diagnostics retained in /tmp/wp16-reviewer-test-results.
- Inspected committed native-200-schema-footer.png and native-200-query.png. The minimally scoped native-zoom correction is justified: scrollport keeps Backfill hit targets and keyboard Connect/query controls reachable; the supplied actual native200 browser test passes. Existing page/schema draft switching and connection flow pass in the supplied scenarios. CSS simulation is separately labeled. No cross-browser or axe pass is claimed.
- All new query modules have production import/call sites (workspace→designer/binding; designer→sources/fields/expression/scalar/state; sources/fields→expression/state). SQL is compiled read-only; service preview/batch/cancel are the live authority. Model preset correction remains literal-only with typed/reference/null/duplicate public validation. No compiler numeric/grain change or hidden alternate SQL path found.
- Shared-file coordination: root authorized workspace registration, literal Form.queryParameters model contract, globals/schema scroll fixes; EVIDENCE.md records rationale and coordination with WP10. No unreviewed WP10 source was merged. WP17 reports/runtime remain downstream.
- CUA visible IAB is unavailable to a subagent; used repository automated browser harness and inspected real screenshots. No hosted sync opt-in, upgrade, old server termination or product fixes. Missing charter and unavailable Python coverage advisory were not treated as product failures.

## Eight-item anti-pattern checklist

1. Dead code: PASS — targeted production import/call-site searches find every new module and public helper used.
2. Synthetic fixture tests: PASS — supplied browser authoring visibly constructs the query; SQLite oracle and HTTP/MCP inspect/preview hit production paths. Preset unit tests call production validateProject/public batch behavior.
3. Silent empty return: PASS — scoped returns are documented absent-selection, absent-binding, run/save guards or malformed-recovery guards with UI notice/raw backup. The incorrect recovery acceptance boundary is the explicit P1 above, not an unreported swallowed exception.
4. FR coverage: PASS — actual assertions exercise FR018 sources/joins/expressions/parameters/results, the WP16 slice of FR019 saved stable queries/consumers, NFR005 keyboard/native200, and C002 product layout. Passing existing coverage does not invalidate the new heldout failures.
5. Frozen surface: N/A — no frozen source files identified in spec/plan/contracts; no doctrine or unrelated lifecycle edit in product commit.
6. Locked decision: PASS — no unrestricted SQL, second persistence, implicit DB undo, fixture-name engine path or downstream report-generation success found.
7. Shared-file ownership: PASS — above root authorization/EVIDENCE integration rationale explicitly covers workspace/model/styles overlap and WP10 coordination.
8. Production fragility: PASS — new throws are explicit save conflict/input/whole-project validation diagnostics caught at the UI boundary; recovery/storage catches retain data or report failure.

Verdict: REJECTED. P1 recovery and P2 shared model undo/redo need correction before approval. No other WP status changed.
