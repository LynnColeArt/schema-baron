# WP18 application behavior map verification

Audience: WP18 reviewer and Studio integration owners. Implementation is on lane-r;
product dependencies are the approved WP14/WP17 integration at `eda4233` plus the
normal mission metadata merge `ebea6e7`. No WP19/WP20 product code is included.

## Canonical projection and integration

`projectBehavior(Project)` is a pure, browser-safe projection. It reads pages,
placed forms, declared actions, authored control captions and typed mappings from
the canonical project, including ordinary workspace drafts. It never saves a
semantic graph. Node IDs are source IDs; semantic edges carry the source ID and
slot. Source-linked diagnostics survive missing draft destinations and invalid
mapping targets; unusable destinations do not produce invented links.

The generator's existing `compileDestination`, `contextFields`, `keyParameter`
and model `effectiveAccess` provide real destination, parameter and policy
semantics. The new pure `emissionOrder`, `handlerPath`, `pageFile`, `authPath` and
`csrfPath` metadata is consumed by both emission and projection. The current
runtime's distinctions are preserved: protected page reads redirect to public
Login with typed return context; anonymous action handler requests are denied;
Record Cancel chooses `destination ?? cancel`, Login Cancel chooses
`success ?? destination` (or the actual public fallback), writes choose
`success ?? destination`, and logout chooses the runtime public fallback.

Necessary shared edits, coordinated with the root owner:

- Generator/core package subpath exports expose only browser-safe helpers and flow.
  The generator root's Node/SQLite modules never enter the browser import path.
- Generator template registration uses the shared path/order metadata so endpoint
  numbering follows actual emission, including per-page Grid-before-Record order.
- Model `flow.inspect` result schema now strictly validates labels, typed mapping
  and context information, endpoint definitions and diagnostics. ProjectCore
  registers this existing command on the normal owner/revision boundary; HTTP and
  MCP remain adapters to the same command.
- Workspace registers the map and memoizes visible model state by canonical
  snapshot/drafts, preventing view-only recomputation. Selecting an action uses
  the existing canonical Action Properties editor through one optional
  `selectedActionId`; ordinary form Properties remain available otherwise.
- Four old transport/concurrency tests used unimplemented `flow.inspect` as a fake
  reserved hook. Transport now tests the real command; focused async fixtures
  spy the dispatch port and restore spies after every test, retaining canonical
  result validation and every revision/idempotency/close assertion. Duplicate
  registration remains forbidden. No future operation was borrowed as a stub.

Map positions, viewport, filters and selected graph ID use bounded per-project
session view storage under `studio.flow.view.*`, separate from model drafts and
project persistence. Drag/pan/zoom do not call a semantic mutation. Search, kind,
policy, navigation/auth/outcome filters, focused neighborhoods, buttons for pan
and zoom, keyboard-selectable node/edge lists and endpoint inventory operate on
this one projection. Authored control labels are display captions only.

## Observed verification

Commands used Node 24.22.1 through the pinned PATH. No dependencies were added;
all output installs used `npm ci --ignore-scripts --offline`.

- `npm test`: 357 passing tests, 53 files, 113.31 seconds. This run includes the
  corrected transport/concurrency fixtures and new flow/view-state tests.
- Subsequent focused run: 31 passing tests, five files (flow, view recovery,
  transport, connection concurrency and idempotency). Final display refinements
  were also checked by the real browser scenarios below.
- Workspace production build/typecheck, strict test/e2e source typecheck,
  diff-scoped lint, pinned dependency verification and credential-pattern scan
  passed. `@schema-baron/ui` is the repository's existing empty package and is
  reported as not implemented by the workspace harness.
- Browser scenarios: real blank project, SQLite inspection/binding, ordinary
  Grid/linked Record/Login wizards, visible identity provisioning and policy
  editing. A selected real navigation edge changes a typed key mapping through
  existing Action Properties, is saved and observed in the owner snapshot, then
  is restored through the same editor. The graph immediately follows both edits.
- Pointer page selection opens Route Properties; an exposed SVG edge hit target
  opens its Action Properties. Dragging the action node records view positions
  while an independently fetched canonical snapshot remains byte-equivalent.
- The same `flow.inspect` projection through MCP and HTTP returns identical
  definitions. Stale inspection is rejected by the existing revision boundary.
- Every projected route/handler filename exists in the emitted application.
  Output passes its own strict typecheck, tests and production build outside the
  workspace. Real visitor HTTP/browser navigation checks list -> keyed protected
  Record -> Login, Login Cancel retaining filters, successful Login returning
  selected key/filter, Record Cancel with no write, Save with SQLite oracle and
  retained filters, and revoked direct write handlers returning 401.
- Scale fixture is 10 canonical pages, 30 forms and 60 actions (100 nodes), authored
  by public commands after real SQLite binding. Twenty successive Title edits on
  one selected page retain its source selection and latest draft each time; Save
  persists the twentieth value. This is not a claim of 20 simultaneously dirty
  objects. Search/filter/focus/pan/zoom cause zero semantic graph recomputations
  and no project snapshot change. Reload restores graph source selection.
- Native browser zoom uses isolated Chromium Preferences
  `partition.default_zoom_level.x = log(2)/log(1.2)`, physical 1280x800. Observed
  inner viewport is 640x400, DPR 2, CSS zoom 1; document scroll/client widths are
  both 640. Keyboard search, filter and source selection reach the same Properties.
- Map-scoped axe-core 4.11.0 runs at normal/native zoom have no serious or critical
  violations. The optional test audit loads an explicitly supplied local
  `AXE_SOURCE`; it does not install or add a package dependency.

Exact final browser timing, per-edit measurements, source IDs, screenshots,
authorization observations and logs are under
`tests/e2e/flow-map/evidence/`. Edit measurements include browser automation and
render/assertion time; the full sample is retained rather than claiming a
broader NFR-001 workstation benchmark. The 100-node requirement's selection and
view-only recomputation observations are explicit in its JSON record.

## Reviewer limitations / later integration

No claim is made for WP19 document modes, WP20 authored extension regeneration,
WP21 managed runtime lifecycle, the later two-application acceptance journey,
or the separate 50-page/200-form/1,000-control NFR-001 fixture. Their product code
is not in this branch. The flow command intentionally refuses the separate
schema projection; schema relationships remain in the existing Schema editor.
Draft diagnostics and direct runtime refusal are not a promise that every
partially invalid draft can be generated. Projection results are derived views,
not a generation readiness verdict. Layout persistence is scoped to the browser
session, like the workspace's existing draft recovery.

Captured command logs normalize terminal carriage returns, tabs and trailing
whitespace only; diagnostic content and outcomes are retained.
