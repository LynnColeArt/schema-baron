---
status: active
owner: frontend-freddy
updated: 2026-10-26
---

# WP05 workspace implementation and observed evidence

This package implements the first Studio workspace against the existing owner service.
It does not claim full application acceptance, schema authoring, generated rendering,
application authentication, page wizards, or the later document modes. No sample
business schema, default credentials, or acceptance-specific constants enter the UI.

## Implemented boundary

- `app/page.tsx`, `layout.tsx`, and `globals.css` mount a compact local workspace.
  Explorer is left; document tabs above the central structure editor, document modes
  below it, and Messages underneath; Toolbox sits above contextual Properties on the
  right. Property rows retain selected type/name and a help footer. No persistent
  Application Builder occupies page documents.
- `project-ui/api.ts` consumes real session, capabilities, project create/list/inspect,
  project batch, diagnostics and finite SSE event replay endpoints. Snapshots are
  authoritative; event gaps discard tentative diagnostics and trigger snapshot refetch.
  A later revision supersedes rejected-candidate diagnostics in a replay batch.
- Owner access is explicitly labeled **Studio service connection**. The reusable key
  is read only from an uncontrolled password input at exchange time, immediately
  cleared on success/failure, and never put in state, URLs, bundle configuration,
  browser storage, or model history. Only CSRF proof lives in memory. HttpOnly owner
  sessions resume through GET session. Generated-app login is separately described.
- `state.ts` keeps per-object drafts, bases and conflict paths outside committed
  snapshots. Three-way field reconciliation preserves unrelated service changes;
  same-field edits and remote deletion require an explicit comparison and choice.
  Stable opaque IDs connect Explorer, document selection, Properties and diagnostics.
- Navigation and focus do not enter model history. Undo/redo stages model edits;
  saving is one undoable batch checkpoint. Undoing saved additions stages removals,
  and persistence still requires Save. Native input undo remains separate from the
  model keyboard shortcut. Successful and rejected keyboard saves preserve input
  focus/caret while a request guard prevents duplicate commits.
- Drafts and navigation are recovered in the same browser tab through sessionStorage;
  no owner key or CSRF token enters that store. Switching projects retains each
  project's drafts. Closing dirty documents offers Save, keep draft, discard that
  document's drafts, or Cancel. Browser unload has a dirty-state warning.
- New project/page/form dialogs mutate nothing on Cancel. Page/form/control drafts
  commit through one real `project.batch`. Grid/Record/Search require existing valid
  table/query sources. A blank project can author Login form **structure**, explicitly
  not configured authentication. Connection/schema editors and wizards expose honest
  unavailable states. Project settings are separate read-only inspection because
  the current entity batch contract has no project-settings mutation operation.

No shared package manifest, lockfile, server handler or bootstrap registration needed
modification: Studio already has React/Next/model dependencies and a built owner
entry point. UI controls remain near the workspace until a second consumer exists.
The pinned production dependency graph and denied lifecycle script policy are unchanged.

## T021 visual reference and keyboard proof

Read-only inspection covered actual local PDF pixels on pages 20–21 and 27–30,
using `pdftoppm` and `view_image`, plus the authored manual index and local reference
notes. No source PDF, extracted text, screenshots, or image derivatives are committed.
Observed arrangement and ordering guide the shell. Modern deviations are flat neutral
chrome, modern fonts, vector/text primitives, readable controls, keyboard splitters,
and resizable/scrollable panes rather than screenshot-sized fixed content. Initial
Explorer/right widths are 240/340 CSS pixels; the document absorbs additional width.

Production screenshots were inspected at 1280×800 and 1920×1080. Both show all five
regions without overlap or clipping. Explorer supports arrows, expansion, Enter to
open, and ContextMenu/Shift+F10 to inspect properties. Property/toolbox tabs support
arrow/Home/End navigation; document tabs support arrows. Splitters support pointer
and keyboard adjustments. Explorer/Inspector can be collapsed from command chrome.

A separate 640×400 viewport check exercises dock scrolling/collapse. **It is not
claimed as native 200% zoom evidence.** IAB Ctrl+plus did not change native zoom and
its exposed browser capabilities provide viewport, not zoom. Native 200% browser
zoom remains a reviewer/manual follow-up; no full NFR-005 verdict is claimed.

## T022–T024 observed behavior

`tests/e2e/workspace/workflow.spec.ts` launches a real built Next owner on a dynamic
loopback port with private configuration, real metadata SQLite and project files,
and a real SDK stdio MCP client forwarding to that same owner. It:

1. Rejects an incorrect key and observes the password input cleared; connects with
   the private test key; cancels project/page dialogs and proves no partial objects.
2. Creates a schema-free blank project, two pages, two Login structural forms and
   a labeled control through visible UI commands, contextual properties, model
   undo/redo and Save. MCP `project_inspect` equals the actual saved UI snapshot.
3. Undoes/redoes a saved batch without implicit persistence; exercises dirty close
   Cancel/keep draft, Enter reopen, stable IDs and session/draft restoration on reload.
4. Retains two drafts across project switches and an unrelated MCP route edit;
   verifies focused input and caret survive the revision. A same-title MCP change
   preserves the draft and disables Save until explicit Keep my draft resolution.
5. Submits a duplicate route, receives an object-linked diagnostic, verifies the
   stored revision did not advance, follows the diagnostic to the correct object,
   corrects it and saves. Keyboard Save preserves focus on success and rejection.
6. Exercises keyboard pane resizing and reduced viewport collapse. The private test
   key is absent from rendered HTML, localStorage and sessionStorage.

Four state tests cover unrelated field rebases, two drafts/history, explicit
same-field/deletion conflict resolution, preservation of remote fields through undo,
and saved-batch inverse additions/removals. Two focused client-port tests cover SSE
sequence gaps and obsolete diagnostic replay. Browser/persistence/MCP tests use the
real owner; these port tests isolate only event parsing.

## T025 commands and limits

All commands run from the lane checkout with Node 24.22.1/npm 11.19.1:

```sh
export PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH
npm ci --ignore-scripts --offline
npm run native:verify
npm run verify
npm run build --workspace @schema-baron/studio
npm test
npm run typecheck
node node_modules/typescript/bin/tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2023 --module NodeNext --moduleResolution NodeNext --noEmit --skipLibCheck --types node tests/e2e/workspace/workflow.spec.ts
STUDIO_AXE_SCRIPT=/tmp/wp05-accessibility/node_modules/axe-core/axe.min.js npm run test:e2e -- tests/e2e/workspace/workflow.spec.ts --output=/tmp/wp05-e2e-final
npm run lint
git diff --check
```

The clean verification archived old build outputs under `/tmp/wp05-build-output-xgl215yf`
before rebuilding. `npm run verify` passed typechecks, full workspace builds, native
SQLite 3.53.4 insert/transaction/backup checks, diff lint, credential scan, 124 tests
in 11 files, and exact dependency validation (182 installed, 76 platform optional
absent, 258 locked registry artifacts). After the narrow focus/replay corrections,
final scoped typecheck/build/unit/browser checks are recorded in the handoff below.
Unimplemented generator/sqlite/shared-UI workspaces remain explicitly reported by
bootstrap checks; no generated-app acceptance is claimed.

The accessibility audit uses exact `axe-core@4.11.0` as an isolated temporary test
tool installed with `--ignore-scripts --save-exact` under `/tmp/wp05-accessibility`.
Its temporary lock records registry integrity; it is not a production dependency.
Set `STUDIO_AXE_SCRIPT` to that exact script to repeat the audit; without it the
browser workflows still run but do not claim an axe run. The observed WCAG2 A/AA
and WCAG2.1 AA audit returned zero violations after tab semantics and text contrast
corrections. Temporary formatting used exact Prettier 3.6.2, outside the repository,
also with lifecycle scripts denied. Product manifests/lock/scripts are untouched.

Reference machine: Linux 7.0.0-38-generic x86_64, AMD Ryzen 5 5600X (6 cores/12
threads), approximately 64 GiB RAM. Browser: Chrome for Testing 156.0.8078.4 with
Playwright 1.64.1. Timings are 30 input-to-observed-value automation samples in a
two-page/two-form workspace, including automation overhead. They do not establish
NFR-001 at 50 pages/200 forms/1,000 controls or the later generated-app budgets.
The production workspace chunk observed before final focus refinements was 53,022
bytes uncompressed/16,160 gzip; no bundle-budget threshold was claimed. A private
random test owner key was explicitly checked absent from all 21 static output files.

## Local review handoff

- Built owner URL: `http://127.0.0.1:35719`.
- Private owner configuration: `/tmp/wp05-studio-handoff/owner.json` (mode 600;
  key value intentionally omitted). It names isolated metadata and definition roots.
- CUA IAB browser 2/tab 1 is an authenticated background handoff; subagent tabs may
  not appear in the parent browser inventory. No unrelated localhost app was stopped.
- Final Playwright evidence root: `/tmp/wp05-e2e-final/`.
- 1280×800: `workspace-workflow-real-bl-4a145-redo-dirty-close-and-reopen/workspace-baseline.png`.
- 1920×1080: the same directory's `workspace-1920.png`.
- Reduced viewport: `workspace-workflow-two-dra-eb76d-sizing-and-reduced-viewport/workspace-reduced-640x400.png`.
- Accessibility: first workflow's `axe-wcag21aa.json` (empty violations array).
- Timing distribution: second workflow's `latency.json`.
- Live CUA screenshot: `/tmp/wp05-studio-handoff/workspace-cua-final.png`.

Screenshots are implementation evidence, not redistributed manual derivatives.
Remaining source/schema/wizard/rendering/auth integrations belong to their assigned
packages; this package does not bypass them with hidden fixture authoring.

### Final observed run

After the save-focus and replay-diagnostic corrections, production Studio build
passed; `npm test` passed 126 tests in 12 files (4.98 s); workspace typechecks and
strict test-source TypeScript checks passed. Final E2E passed both workflows
(12.5 s), including success/rejection save focus/caret and the zero-violation axe
check. Diff lint passed. The final 30 latency samples measured median **33.58 ms**,
p95 **86.64 ms**; the complete raw distribution is in the local `latency.json`.
These small-workspace measurements include automation overhead and do not claim
full-scale editing/reopen budgets. All T021–T025 implementation evidence is ready
for independent review; native 200% zoom remains explicitly unexecuted.

## Review cycle 1 repair — incomplete draft recovery (P1)

The independent rejection at source `523c17b` identified a real preservation defect:
`restore` used committed entity schemas for every current/past/future draft, then
returned an empty editor/view if one temporary empty title failed validation. The
normal retain effect subsequently replaced the recovery source. Correcting the
current title did not help while an empty value remained in undo history.

The repair is limited to recovery, its workspace integration and regression tests:

- Recovery validates its bounded envelope, stable identity and supported editable
  shapes. Page title/route can be empty and paging can be temporarily out of range.
  Shared model schemas, owner command validation and committed snapshots are unchanged.
- Well-formed incomplete current/past/future values and navigation restore intact.
  Malformed entries are recovered independently so unrelated drafts remain. Unsafe
  partial undo history is explicitly reset with a recovery warning, rather than
  exposing a partially missing snapshot as a destructive undo target. Independent
  valid navigation fields survive a damaged field.
- Messages visibly reports `DRAFT_RECOVERY` with an explanation and next action.
  The raw malformed source is preserved before automatic replacement. There is at
  most one backup slot per project, bounded to 2,000,000 characters; an existing
  distinct backup is never overwritten. Oversized sources, a protected prior backup,
  or failed backup writes block replacement of the live source. Retain applies the
  same size bound. Project switching stops with a visible error if current drafts
  cannot be retained safely. Backups are tab-local model recovery data; auth proof
  and owner keys do not enter them.

Observed red/green verification:

1. Six test-first recovery cases failed against the original module. Seven final
   focused tests pass: incomplete mixed drafts and navigation; corrected current
   values with invalid past/future history; incomplete route/numeric values;
   malformed-entry isolation; malformed navigation; failed backup protection; and
   bounded/protected backup behavior.
2. Before rebuilding, the added real-owner browser regression failed against the
   old production output at the exact project-switch point: the Title input was
   missing because the workspace had reset. Command:
   `npm run test:e2e -- tests/e2e/workspace/workflow.spec.ts -g "incomplete and corrected" --output=/tmp/wp05-red-recovery`.
3. After rebuilding, the reviewer workflow passes through visible UI authoring of
   Orchard, Welcome Login form, Guest name text control and unsaved Meadow. Empty
   Title survives project switches and same-tab reload, as do stable IDs, selection,
   both drafts and undo/redo. Invalid Save rejects atomically and owner inspection
   remains exactly equal to the saved baseline. Corrected Title with invalid history
   also survives switching, reload and future-stack redo; final Save preserves the
   original form/control identities and commits both pages.
4. A separate real-browser storage fault injection adds one malformed recovery entry
   and navigation field to a UI-authored disposable project. Reload retains the
   unrelated valid draft, shows recovery/history warnings, preserves the original
   raw recovery record, and successfully saves only the valid authored model.

Final commands (pinned Node/npm and the same denied lifecycle-script policy):

```sh
npm test -- apps/studio/src/workspace/session.test.ts
npm run verify
node node_modules/typescript/bin/tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2023 --module NodeNext --moduleResolution NodeNext --noEmit --skipLibCheck --types node tests/e2e/workspace/workflow.spec.ts
STUDIO_AXE_SCRIPT=/tmp/wp05-accessibility/node_modules/axe-core/axe.min.js npm run test:e2e -- tests/e2e/workspace/workflow.spec.ts --output=/tmp/wp05-repair-e2e
npm run lint
git diff --check
```

Clean-output verification archived earlier generated outputs under
`/tmp/wp05-cycle1-build-output-c6jen9jt`, then passed all builds/typechecks, native
SQLite smoke, credential/diff checks, **133 tests in 13 files**, and exact dependency
validation. Final browser run passed **all four workflows in 13.1 seconds**; the
existing WCAG2/2.1 AA axe audit again reports `[]`. Strict browser-test TypeScript
and final diff lint pass. No production dependency or lockfile changed.

Repair screenshots inspected at 1280×800:

- `/tmp/wp05-repair-e2e/workspace-workflow-incompl-ec0c4-undo-without-weakening-Save/invalid-drafts-recovered.png`
- Same directory: `corrected-drafts-saved.png`.
- `/tmp/wp05-repair-e2e/workspace-workflow-damaged-0fc72-ports-safe-partial-recovery/partial-recovery-warning.png`

The rebuilt owner remains at `http://127.0.0.1:35719` using the same private
`/tmp/wp05-studio-handoff/owner.json`. A fresh live CUA attempt found browser 2
unavailable and an empty app/browser inventory; no fresh live-CUA pass is claimed.
The real repository Playwright workflows and screenshot inspection above completed.
Native 200% zoom and full-scale budgets remain unclaimed as before.

The actual recorded baseline failure was inspected: pytest's
`<gate-coverage-junit>` lacked a JUnit artifact. It is the known unavailable Python
gate authority, not a product test failure and not an excuse for this defect.
Independent review is requested again after this repair; no self-approval is recorded.
