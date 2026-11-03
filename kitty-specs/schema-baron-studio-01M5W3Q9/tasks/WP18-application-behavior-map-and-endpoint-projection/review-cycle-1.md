---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T11:02:35Z'
reviewer_agent: reviewer-renata
wp_id: WP18
---

# WP18 independent review — Reviewer Renata

Verdict: changes requested, one P2 finding.

Scope: WP18 product changes 30c2bb0 and bf1750c (log whitespace) against approved combined WP14/WP17 integration eda423303f5add551ac0cdc37a3c3ec811fc31cc. Current lane HEAD 97e11a6 includes subsequent mission metadata merges. Inherited WP14/WP17 sources/integration tests excluded from new-product attribution. No product edits made.

## Finding P2 — Mark invalid draft mappings on their flow edge

Location: packages/core/src/flow/index.ts:35–41; apps/studio/src/flow-map/index.tsx:34,46.

projectBehavior retains validateProject diagnostics but compileDestination checks destination target placement and supported expression shape, not source expression resolution/type compatibility. Consequently, a shape-valid draft mapping with an absent source field, absent parameter, or text literal sent to an integer Record key produces an ordinary open:destination edge labelled `destination → /edit · 1 key`. Its typed mapping is presented as normal integer flow. compileProject refuses the same mapping with BROKEN_REFERENCE or TYPE_MISMATCH. BehaviorEdge carries no validity/diagnostic association, the SVG style/label does not flag it, and selected-edge details do not show its existing diagnostic. The separate map-wide diagnostic button is correctly source-linked; that does not identify the displayed edge as invalid when inspecting the edge itself.

Reproduce using behaviorFixture(): replace actions[0].destination.keyMapping[0].expression with {kind:'field',alias:'root',fieldId:'gone'}, or {kind:'parameter',parameterId:'gone'}, or {kind:'literal',type:{kind:'text'},value:'not-an-integer'}. Call projectBehavior and compileProject. Exact observed results retained in /tmp/wp18-independent-heldouts.json.

This affects ordinary unfinished edits (for example choosing a differently typed source in canonical Action Properties, or removing a referenced source field). FR-021 requires typed parameter movement derived from actual behavior, and T086/T090 require semantic edges corresponding to real routes/actions; T087 requires invalid parameter diagnostics. Diagnostics exist, but the ordinary edge and mapping presentation claim valid flow that the canonical compiler rejects.

Repair: preserve useful draft geometry and selection, but visibly mark invalid mappings/edges with their source-linked diagnostic and expose that state in edge details/keyboard inspection, or suppress only the invalid semantic mapping edge. Do not collapse the entire partial graph or reject all draft edits. Add heldout assertions covering missing source fields/parameters and incompatible mapping types, including edge/detail treatment and recovery after repair.

## Independently rerun

- Node 24.22.1. Focused Vitest: 31 tests / 5 files pass, 7.08s (flow, map state recovery, transport, connection concurrency, idempotency).
- Current source workspace production build passes, including generator and Studio. Existing empty @schema-baron/ui reported NOT IMPLEMENTED by harness.
- Current build Playwright workflow: 2/2 pass, 35.6s. Real blank-project authoring, canonical mapping Save/restore, actual generated handler files and standalone login-return/filter/Record Cancel no-write/SQLite Save/revoked401; 100 canonical nodes, 20 Properties edits, selection/draft retention, view-only recomputation isolation, keyboard and native 200% zoom.
- Independent additional heldout Search form handler ordering with reversed forms array matches emitted files. Record Cancel destination-before-cancel and Login Cancel success-before-destination each match selected map edge.
- Independent invalid mapping cases above fail edge validity correspondence.
- git diff --check eda4233..HEAD passes. Production call-site searches confirm live callers for all new modules. Inspected pointer-edge-properties.png: readable nodes and actual Action Properties; no visual blocker.

## Inspected evidence and limits

Inspected core flow EVIDENCE.md, runtime-correspondence and scale/native metrics plus tracked screenshots. Earlier 357-test full suite, strict sources, lint/dependencies/credential scans and axe results are implementation evidence inspected, not newly rerun claims. Current browser rerun omitted optional AXE_SOURCE, so no new axe claim. Python gate unavailable/unverified. WP19–21 integration and later full mission acceptance remain pending.

## Eight anti-pattern checks

1. Dead code: PASS. Core projectBehavior called by registered ProjectCore command and FlowMap; generator behavior metadata consumed by real emitter/template modules; map/state called by workspace/map.
2. Synthetic-fixture tests: PASS. New tests invoke production projection/compiler/emission/view functions; browser authoring uses real owner commands, Properties and emitted application/SQLite. Async fixtures isolate dispatch timing while preserving canonical result validation and other operations.
3. Silent empty return: PASS. Projection catches add source-linked diagnostics. Map storage fallback is bounded recovery with a visible write-failure alert; retainMapView returns explicit success/failure. No unexplained empty failure path introduced.
4. FR coverage: PASS for presence of behavior assertions for C-003/FR-021/FR-022/NFR-002/NFR-005; heldout defect above still blocks correctness approval.
5. Frozen surface: N/A. No explicit frozen file identified in WP/spec/plan/contracts; no unrelated doctrine or archival source changes in product delta.
6. Locked decision: PASS. Browser-safe shared canonical projection and model/command boundary preserved, no independent semantic graph persistence, no label semantics, schema remains separate. Finding is a correspondence defect, not an invented alternate persistence path.
7. Shared-file ownership: PASS. Root-authorized narrow integration edits to workspace/forms (reuse canonical Action Properties), generator metadata/emitter and package exports, core command registration, typed model result, and replacement of obsolete dummy flow.inspect transport/concurrency fixtures are recorded here and in core flow EVIDENCE.md. No WP20 code attributed/included.
8. Production fragility: PASS. Existing registry guards fail loudly for impossible dispatch states, schema projection produces actionable INVALID_INPUT, projection catches destination/access failures with diagnostics, browser storage recovery bounded. No transient-race bare raise introduced.

Dependency notice: WP22/WP25 must consume the eventual corrected WP18 revision; neither is claimed complete by this review.
