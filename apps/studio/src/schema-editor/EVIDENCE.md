# WP08 visual schema editor — observed evidence

Implemented in the assigned lane against approved WP07 baseline. Profile resolved through
`spec-kitty agent profile show frontend-freddy`; action-scoped charter context returned
`mode: missing`. No charter or hosted-sync activation was invented. Runtime status was
`WP08 in_progress`, with no returned review-feedback reference, before initial handoff.

## Integration rationale

The small `workspace/index.tsx` edit imports/mounts the schema editor, exposes the Schema
command, routes Ctrl+S to the active schema editor, and hides the page-only toolbar while
Schema is active. Both document surfaces stay mounted during page/schema switches;
per-project schema session recovery and in-memory retention survive project switches.
The Connect SQLite command invokes the existing connection UI. This integration was
coordinated with the root and WP09 owner; no service/model/storage implementation or
unreviewed WP09 source was copied.

Logical types and supported decimal physical encoding use the canonical model. Physical
SQLite storage and exact imported declarations are displayed; arbitrary SQL type overrides
are not supported by the approved model. Imported declarations/directions/collations are
preserved by WP07 or blocked by its real diagnostics. No hidden JSON/DDL workaround exists.

## Commands and outcomes

Using Node 24.22.1/npm 11.19.1, lifecycle scripts denied:

- `npm ci --ignore-scripts`: passed, zero audit vulnerabilities; no dependency change.
- `npm run verify`: passed production build, workspace strict typechecks, diff syntax/JSON/
  whitespace checks, credential heuristic, 202 tests in 20 files, lock/install metadata.
- `npm run native:smoke`: real SQLite 3.53.4 insert, transaction and online backup passed.
- Strict dedicated test-source TypeScript command: `npx tsc --noEmit --strict
  --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2023 --module NodeNext
  --moduleResolution NodeNext --skipLibCheck tests/e2e/schema-editor/workflow.spec.ts`: passed.
- Full real browser regression command: `npx playwright test
  tests/e2e/schema-editor/workflow.spec.ts tests/e2e/workspace/workflow.spec.ts
  tests/e2e/connections/workflow.spec.ts --workers=1`: 9/9 passed in 37.3 seconds.
- Final checkpoint build and full `npm test`: passed, 203/203 tests in 20 files; final diff lint and strict source typecheck passed.
- Schema state unit tests additionally exercise semantic equality despite normalized key
  order, field conflict/nonconflict rebases, and editing during an async save (including
  a later unrelated service change). Final state suite: 6/6 passed.

Browser logs/screenshots/scale metrics are retained under
`tests/e2e/schema-editor/evidence/`. No capability or private config is committed.

## Observable subtask proof

**T036.** The real UI creates a blank project and a genuinely empty SQLite file through
Connections. From that UI it authors parent/child tables with six columns, ordered primary
keys, typed default, unique constraint, check and index. Invalid numeric defaults and empty
names stay editable with localized errors. Save uses the existing shared project.batch;
MCP project_inspect matches the canonical HTTP snapshot, including stable IDs and ordered
FK tuples. There is no setup SQL or prebuilt model for this authoring proof.

**T037.** Pointer dragging between actual React Flow column handles opens the mapping
proposal with the selected IDs. Cancel creates no relationship. The keyboard-accessible
relationship command creates explicit ordered composite pairs with delete/update actions.
The saved FK is visible in Properties and canonical MCP state. Dragging a table records
session view positions, while the canonical semantic schema remains byte-equivalent after
normalization. Session recovery restores positions independently of database meaning.

**T038.** Search and the native-button table list expose every table/column without graph
interaction. An imported opaque view appears under read-only imported objects; a desired
rename receives the real UNSUPPORTED_SCHEMA_OBJECT preview refusal and leaves SQLite SQL
unchanged. Incomplete names, invalid default buffers, unfinished relationship pairs,
selection and undo history remain separate from strict saved validation and survive view/
project switches and reload. Partial corrupted recovery salvages valid entries, warns and
leaves original raw recovery data untouched. MCP same-field edits retain local values and
show explicit Keep draft/Use service resolution. Ctrl+S saves schema while preserving
focused property input; existing page/workspace regression cases remain green.

**T039.** Actual schema.preview supplies reviewed SQL, source revision, exact plan/hash,
schema/data fingerprints, impact IDs, affected row counts, backfill and backup policy.
A changed MCP revision makes an open review visibly stale and disables apply. An actual
populated SQLite fixture requires an explicit backfill; the visible Backfill rules panel
supplies a typed reviewed rule. A subsequent destructive DROP TABLE proposal discloses its
exact unchecked acknowledgements and two affected rows. Cancel leaves both original rows
and sqlite_schema intact. At 640×400 the dialog scrolls its body while action buttons stay
inside the viewport. Preview creates no backup/DDL; the UI accurately says the executor
allocates the exact backup path during apply.

**T040.** Screenshots at 1280×800, 1920×1080 and reduced 640×400 viewport are actual product
pixels. The 50-table/500-column navigation fixture is created through the shared MCP batch
only for scale testing, explicitly separate from blank UI authoring. Twenty scripted edits
and reselections retain all 20 drafts and every asserted selection, with zero canonical
model changes. The measured complete edit/reselection sequence was 7,360.6 ms; individual
edit actions (including automation/settling overhead) ranged 211.9–267.9 ms, nearest-rank
p95 264.9 ms. These are observed local samples, not an isolated rendering benchmark or
claim about the separate 10,000-row query budget.

## Visual review and remaining integration

Root independently inspected the actual historical-reference guidance and current live
pixels. The schema workspace retains compact Explorer/center/Toolbox/Properties/Messages;
page-only toolbar and schema dirty counts no longer compete. An unbound editor explicitly
explains desired/saved definitions versus physical SQLite and offers Connect SQLite.
Reflow uses horizontal workspace scrolling rather than shrinking interface text. The
640×400 screenshot tests the CSS viewport corresponding to 200% at 1280×800; native browser
zoom itself was not automated. React Flow's standard attribution remains visible.

This lane's approved baseline does not advertise schema.apply, so Apply is disabled with
an actionable capability explanation. The conditional shared apply path sends the exact
reviewed plan/hash/acknowledgement IDs and reports committed/recovery outcomes, but actual
executor apply/restore integration is NOT claimed tested here; WP09 owns that separate,
independently reviewed implementation. No application DB DDL executor was added by WP08.

Chromium was exercised; no cross-browser or automated axe audit is claimed. Labels, native
dialog focus containment, tab keyboard behavior, visible focus and input focus preservation
were exercised through the real browser. No arbitrary SQL/check parser or generated
application feature is claimed. Production static assets measured 1,338,551 bytes before
compression before the final checkpoint-only change; no explicit bundle threshold was supplied.
