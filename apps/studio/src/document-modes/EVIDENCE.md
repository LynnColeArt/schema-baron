# WP19 implementation and review evidence

Audience: independent WP19 reviewer and WP20/WP21 integrators. This records observed behavior, supported boundaries and exact verification commands; it does not claim final full-mode integration.

## Canonical document and ownership

`packages/core/src/page-document/index.ts` owns the constrained parser, serializer, source positions, structural form move and static preview projection. It uses the existing `Page.document` text/element/form nodes and existing `Form.controlIds` order. No new application definition, model schema, marker surgery, source execution or generator metadata was introduced.

Static elements: div, p, span, h1, h2, header, footer, section, with no attributes. Typed placement syntax: `<sb-form id="stable-id">` containing only direct self-closing `<sb-control id="stable-id" />` references and whitespace. Form references may be placed within supported static elements. Every existing form and control must be present exactly once under its current owner. Reordering changes page document placement and/or form control order in one ordinary editor history step; labels, bindings, action/event refs, IDs and all other metadata stay in the original model objects. Normal Toolbox construction/insertion remains authoritative for add/delete; dirty source diagnoses new/deleted references instead of guessing or dropping them. WP12 confirmed its generator consumes canonical form.controlIds order.

Unsupported tags/attributes/control wrappers, comments, dynamic templates/JSX braces, scripts, URLs and malformed entities are rejected as a whole while retaining exact raw source. Literal braces can use numeric entities. The entity map checks own keys: `&constructor;`, `&toString;`, `&__proto__;` and other unknown entities are rejection controls, never inherited JavaScript property names. No DOM parser is used, so inert parsing cannot initiate browser resource requests. Parser limits are 250,000 source characters, 10,000 tokens and 64 nesting levels. Larger invalid raw source remains recoverable up to the separate 1,000,000-character editor input limit; oversized new editor input is explicitly rejected while the existing source remains.

Shared edits, coordinated with root: workspace registers the actual mode surface; Editor/View/session add bounded raw document buffers and mode/focus/caret/scroll recovery in the existing envelope; Save/close/dirty handling and construction subtree filtering include pending HTML; core exports a browser-safe pure codec subpath instead of importing server/storage modules into a browser bundle. Toolbox's scroll region and the retained mode status region have explicit keyboard focus targets. No generator, owner HTTP handler, file access operation or lifecycle state bypass was added.

## Observable behavior

- UI starts blank; two Login forms are constructed visibly through the ordinary wizard. Supported HTML adds a heading and section, reverses form/control placement, then Apply HTML stages the canonical model. Design reflects it; moving a form preserves its identity and the complete original controls/metadata. A normal Properties label edit persists through Save.
- Apply HTML stages model edits. Save performs the existing revision-checked owner command. Pending valid or invalid raw HTML blocks Save with a visible recovery action. It is never silently dropped or implicitly treated as committed markup.
- Exact authored formatting survives modes and unrelated property changes while document semantics stay unchanged. Structural Design edits serialize the changed model. The source remains a native textarea with its own text undo; the toolbar provides separate shared model undo. Source focus/caret survive mode switches; raw source, view mode, caret and scroll live in session recovery and survive reload and project return.
- Existing model document/control-order conflicts and a changed raw-source baseline both produce the explicit comparison panel. Keep HTML placement resolves only document/controlIds conflicts. Use current model HTML chooses the current service placement when that placement conflicted. Unrelated title/metadata conflicts remain governed by the existing shared conflict UI. The observed remote title survives an explicit local layout choice and subsequent owner Save.
- Valid pending source is rendered as **Current draft preview / unsaved HTML**. Invalid source is retained and Preview labels **Invalid HTML / last valid model draft fallback**. This is static draft appearance, with no live application data. The iframe has empty sandbox permissions, an opaque origin, no referrer, CSP default/script/connect/image/frame/object none, form-action none, base-uri none and only inline static styles. Authored hooks are not read or evaluated. Browser tests observe failed parent-document access and failed fetch to the owner API.
- Code honestly reports generated-source read-only ownership and the unavailable WP20 approved source interface; authored extensions are reserved for its editor. Live Page honestly reports the absent WP21 managed route resolver and offers current-draft Preview. Exported ModeCapabilities accepts approved generated content, extension navigation and managed route-opening callbacks; no arbitrary file/path fetch or fake running application is supplied.

## Verification and retained artifacts

Runtime: pinned Node 24.22.1, npm 11.19.1. Dependencies installed from lockfile with `npm ci --offline --ignore-scripts --audit=false --fund=false`; no dependency or lockfile changes and no lifecycle scripts. Native SQLite smoke passed actual insert, transaction and online backup on SQLite 3.53.4.

Commands executed:

```sh
npm run build
npm test
npm run typecheck
npm run lint
npm run check:credentials
npm run native:smoke
node node_modules/typescript/bin/tsc --strict --types node --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2023 --module NodeNext --moduleResolution NodeNext --noEmit --skipLibCheck tests/e2e/document-modes/workflow.spec.ts packages/core/tests/page-document/behavior.test.ts
npx vitest run packages/core/tests/page-document apps/studio/src/document-modes apps/studio/src/workspace
STUDIO_AXE_SCRIPT=/tmp/wp05-accessibility/node_modules/axe-core/axe.min.js npx playwright test tests/e2e/document-modes/workflow.spec.ts tests/e2e/workspace/workflow.spec.ts tests/e2e/forms/workflow.spec.ts --workers=1 --output=/tmp/wp19-final-browser-proof
```

The full workspace unit/integration run passed 34 files / 277 tests before the final own-key and raw-limit controls; the final focused rerun passed 4 files /33 tests covering those corrections. The final combined browser regression run passed7 available tests in43.1s across workspace/forms/document modes, with1 explicitly skipped WP20/21 integration case. Axe4.11.0 reported zero violations in the mode and inherited workspace audits. Studio's production Next build and strict workspace/new-test-source typechecks pass. Credential heuristic reports no matching exposed credentials (a heuristic, not a guarantee). No generated application/template behavior changed, so no new generated-app claims are made here. The UI-only `@schema-baron/ui` package remains reported NOT IMPLEMENTED by the inherited workspace check; no claim is made that it acquired source here.

Browser tests exercise real owner persistence and MCP revision events, rather than patching a prebuilt model to finish authoring. The WP20/WP21 final integration case is explicitly skipped with its actual dependencies named. Initial verification caught and corrected whitespace-only sibling movement, shared-placement conflicts masked by local drafts, tab focus stolen by textarea focus restoration and Toolbox keyboard scrollability. Root independently caught the inherited-property entity lookup, now covered by rejection controls.

Retained evidence under `tests/e2e/document-modes/evidence/`: HTML at1280x800, Design at1920x1080, ready current-unsaved Preview at1280x800, native200 full/viewport screenshots, exact native zoom metrics and axe audit. Native zoom uses Chromium's isolated profile `partition.default_zoom_level.x=log(2)/log(1.2)` with physical1280x800: inner640x400, DPR2, CSS zoom1, visual viewport scale1. Explorer/Inspector can be collapsed by their real menu controls; normal pane and outer-workspace scrolling remain available. These are actual browser zoom images, not CSS zoom simulations. WP16's separately approved overflow fix is not duplicated or merged here and should remain at final integration.

Actual pixels of the local manual PDF pp134–137 and indexed private reference pack were inspected. Document tabs remain above the editor, the compact mode strip is below it, Messages underneath, and Properties stay contextual. Modern differences: supported explicit stable reference grammar instead of fragile historical markers; owned/read-only Code labeling instead of color-only ownership; sandboxed static Preview; bounded editable static text surfaces. No private PDF/reference images are redistributed.

Full Studio emitted JavaScript was measured at21 files, 1,354,765 uncompressed bytes /415,369 gzip before final keyboard-region/error-message adjustments; no WP19 bundle threshold is specified, so this is an observation rather than a budget pass. Full NFR-001 scale/performance acceptance remains WP25 work.

Disposable live review instance was authored entirely through UI at `http://127.0.0.1:41483`; private config `/tmp/baron-wp19-live-LjL9yt/owner.json`. No owner key is recorded in source, screenshots or this evidence. Subagent CUA visible tabs are unavailable; root inspected the actual screenshots and live review context. The server is test-only and may be stopped after review.

## Review cycle 1 correction — literal static braces

Independent review event `01M5Y8HEV4SJXDH1TW0NGJP9TH` identified that parsed decimal/hex brace entities and directly authored Design text serialized into raw braces, which the raw HTML grammar deliberately rejects as dynamic syntax. The three new codec controls first reproduced the failure against production code, then passed after the serializer text branch encoded `{`/`}` as `&#123;`/`&#125;`. Attribute/reference escaping, parser dynamic-source rejection, preview isolation and model ownership are unchanged. Literal text that resembles an entity is still escaped once and roundtrips without unintended decoding.

Visible browser regression starts with a blank project, inserts a Design paragraph, types `Literal {brace}`, saves and verifies valid canonical HTML. It applies decimal/hex encoded text, saves, makes a structural Design edit to force canonical serialization, verifies the actual owner-persisted decoded document, reloads, switches projects and reopens, and previews the literal text. It finally enters a genuine raw `{serverHook()}` expression, observes invalid retained source and disabled Apply. No hidden model writes were used. Retained `literal-braces-html-reopened.png` shows valid encoded source after reopen.

Direct Node24 verification (no npm/lifecycle scripts): production core/Studio TypeScript builds and Next production build passed; whole Vitest run passed34 files /284 tests; focused WP19/shared-state run passed36 tests; browser document-modes run passed3 available tests with1 explicit WP20/WP21 integration skip, including native200/origin/CSP continuity; final literal persistence case rerun passed after adding the actual owner-read assertion. Workspace and strict new-test-source typechecks and diff-scoped lint passed. Actual results contain no test failure; the CLI baseline's one pre-existing-test report and unavailable Python coverage advisory are not counted as passes. The existing placeholder UI package is still reported NOT IMPLEMENTED.
