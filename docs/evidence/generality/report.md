# Publication Catalog and transport generality

Audience: independent reviewer and the operator studying Schema Baron as a general builder.

Status: the fresh Publication journey, complete operation corpus, full Equipment regression, independent portable runtime and isolated output verification passed. The bounded full suite passed 464 tests in 70 files. WP23 is prepared for independent review, never self-approved.

## Authoring and independent oracles

The test source is `tests/e2e/publication/workflow.spec.ts`. The initial input is an empty Studio project and an inspected empty SQLite file. All domain structure is authored visibly: authors, publications, categories and publication_categories; the last table has the ordered primary key `(publication_id, category_id)`. The fixture JSON is a retained result, never setup. All business data comes through generated New record/Save controls, including ordinary foreign-key lookup selects.

Two memberships share publication_id=1. Editing/deleting the second tuple preserves the first. The runtime exercises validation and an executable authored validator, Cancel, named deletion, related-record deletion refusal, protected pages, login Cancel/resume and complete key return. A public Search form submits its factory-default declared Search action through the native GET form. Bound links show values and navigate author/report → publications → membership children.

The query is an author-to-publication outer join grouped by author, with exact decimal royalty sum and a runtime HAVING minimum. A separate read-only SQLite handle reads royalty text and computes the expected totals using BigInt cents: Octavia 1.35, Silent 0.00. The minimum filters Silent from the report without altering data. No generator SQL helper computes the oracle.

A reviewed nullable editor_note migration preserves every original row, followed by two real promotions with authored Code edits. The test compares rows, canonical migration records, settings and exact source bytes through both cycles/reopen, then checks post-cycle tuple CRUD. Draft-isolation edits are resolved through the UI and an additional final output refresh restores the normal catalog title/routes; that refresh is recorded separately from the two required regeneration cycles.

## Generic defects and bounded corrections

Before shared edits, the coordinator received the smallest visible/compile repros. The approved generic source correction and targeted regression changes are committed as `4f0fe29`; its scope warnings were advisory and correspond exactly to the shared files explicitly authorized by the coordinator, not an expanded ownership declaration. The ordinary Record emitter ignored authored captions; an unsupported change event compiled without a diagnostic; bound table links used their caption rather than the row value. The approved correction carries explicit captions through ActionIR/React string expressions, shares bound-value formatting across Grid/report, and validates target-consumed event combinations. See `output-fidelity-before.json`, `output-fidelity-after.json`, `output-fidelity-repro.mjs` and the focused tests.

Only new Record construction defaults changed: insert/update Save, delete Delete, cancel Cancel. Existing labels are never inferred or rewritten. Login Cancel remains click-only navigation (factory button or authored link); submit is rejected. Native Record and Login login/logout buttons consume click/submit. Table Grid/Search accepts click navigation links and one compatible button click/submit Search binding. The Search caption is placed on the existing native GET submit; existing action policy guards remain enforced. Ambiguous/incompatible bindings diagnose against the source control. No AJAX/change runtime was added.

The report-specific source string replacement was removed because the shared Grid emitter now formats link values correctly. Equipment's two affected browser selectors now expect the actual Open status value. The generated-auth integration test binds a protected Search submit button, checks its emitted placement/caption, and retains anonymous-redirect/authenticated-success assertions. These small shared integration edits implement the explicitly approved generic corrections and their regression checks.

## Complete transport corpus

`tests/contracts/parity/behavior.test.ts` uses two independent scratch owners, distinct from the visible Publication study. Every operation advertised by the owner is executed cold by both a real SDK MCP stdio client forwarding to authenticated owner HTTP and the HTTP command transport with the actual Studio session cookie, origin and CSRF protocol. Matching opposite-transport replay is extra evidence.

The inventory currently has 31 operations. Coverage includes project lifecycle/batch/export/diagnostics; connection; schema apply and restore; queries; form construction; page/form/control/policy/extension mutations; identity configure/provision; source read and extension read/write; generation; application/endpoint flow; runtime context/route/build/run/stop/status; and actual job inspection/cancel-after-completion. The test compares independently normalized final snapshots and unique outcome/revision/diagnostic signatures, and verifies actual SQLite, source, generated HTTP and export effects. `parity-matrix.json` is the exact executed matrix. Unsupported schema projection on flow.inspect is not claimed.

Negative cases cover stale expectedRevision, invalid AST, atomic duplicate-route rejection with no partial page, duplicate conflicting request ID, exact matching replay, stale authored-file hash, required plan acknowledgement and a runtime route before start. The corpus generates a real build job, inspects its observed outcome and verifies cancel cannot change its completed status. It does not claim arbitrary fault-injection or every negative input for every operation.

## Project, identity and draft isolation

A single owner process uses the retained Equipment metadata/configuration plus explicit additional approved roots for Publication definition/data/output. It switches projects without restart; no saved model/source is copied or database seeded. Equipment business rows remain unchanged. The same ephemeral username has different credentials in each project-specific identity store. Publication cookies cannot open Equipment's protected page, Publication credentials fail Equipment login, and both distinct visitor cookie names coexist on the same host. Both runtime groups are stopped and their HTTP ports become unreachable.

Real MCP edits run while an unrelated local title draft and an incomplete title buffer exist. Switching, HTTP event-gap injection, connection refusal/reconnect and reload preserve those buffers; Undo/Redo restore incomplete history. A conflicting MCP title change disables Save without partially writing either local draft. Keep my draft and visible correction resolve the conflict. The event-gap/refusal are explicit transport failure injections; subsequent snapshots and MCP writes use the real owner. No API patch resolves the draft.

## Source scan and evidence safety

`engine-fixture-scan.json` scans engine source/templates, excluding fixtures, tests and documentation. The two lexical matches are generic accessibility labels for UI categories, with zero schema-specific branches/constants. Generic model properties id/title/caption/email are explicitly excluded from the identifier heuristic; source review is still required.

The retained Equipment regression history redacts the private authority marker values; the live test compared unredacted markers only in memory. Browser tracing is off. Operation logs omit payloads; passwords and owner/MCP credentials remain private/ephemeral. The final exact credential scan checks retained evidence, both static client builds and the project model. The private completed study is retained outside worktrees; no real credentials or private databases are committed.

## Verification and boundaries

Observed final-source results:

| Check | Result / evidence |
|---|---|
| Fresh visible Publication / original Equipment switch / drafts | Passed 2.4 minutes (2.5 total); `browser.log`, `run/operations.json`, `run/isolation.json`. |
| Real MCP and HTTP Studio-session corpus | Passed 48.64 seconds; 31 operations; `parity.log`, `parity-matrix.md`, `parity-matrix.json`, `parity-snapshots.json`. |
| Fresh Equipment entire journey | Passed 1.9 minutes; `equipment-regression.log` and its retained artifacts. |
| Target fidelity contract | Seven cases passed; `fidelity-contract.log`. Broader focused form/record checks passed 18 cases before the added empty-caption case. |
| Complete workspace suite | `npm test -- --maxWorkers=2`: 464 passed / 70 files / 183.31 seconds; `final-workspace-tests.log`. No retries. |
| Workspace / strict acceptance TypeScript | Passed; `typecheck.log`, `strict-acceptance.log` (no diagnostics). |
| Production build | Passed; `final-build.log`; final generator target build in `generator-build.log`. |
| Portable install / strict types / generated tests / build / runtime | Passed with Studio unreachable, clean environment and independent SQL oracle; `portable-proof.json`, `portable-*.log`, `portable-report.png`. Generated output tests: 2 passed. |
| Strong isolated output verifier | `node scripts/workspace/verify.mjs generated /tmp/publication-visible-6MrH23/outputs/portable/app`: passed offline install, strict types, generated tests and production build in a fresh isolated root/toolchain; `isolated-output.log`. |
| Native / dependency policy | Pinned SQLite 3.53.4 insert, transaction and online backup passed; installed metadata matches lock (182 installed, 76 platform-optional absent, 258 artifacts); `native.log`, `dependencies.log`. |
| Evidence safety / source scan / lint | Exact scan: 101 evidence/static files, both visitor passwords and owner key absent; `run/credential-scan.json`. Workspace heuristic scan and lint passed; `credentials.log`, `lint.log`, `engine-fixture-scan.json`. |

The earlier concurrent broad run had one ECONNRESET in the operation corpus while all other 461 cases passed. It is retained in `concurrent-workspace-tests.log`; this is not a claimed passing run. A bounded sequential corpus and the final two-worker complete suite both passed. The earlier Equipment selector failure is retained in `equipment-bound-link-selector-before.log`; the two selectors were changed to the newly correct displayed Open value and the full journey passed. Ordinary harness fixes also synchronized source reads/record completion, selected an existing document before Code, canonicalized URL parameter order, distinguished CSRF cookies from sessions, and excluded the private authority marker from migration-history counts. No product behavior was weakened to pass those checks.

## Retained study and replay

The completed private Publication root is `/tmp/publication-visible-6MrH23`. Its owner configuration is `owner.json` (0600), definition/database are in `definitions/` (`catalog.sqlite`), current generated source is `outputs/app/`, and the standalone export is `outputs/portable/` (`app/` plus `data/application.sqlite`). The configuration references the retained original Equipment metadata root `/tmp/equipment-visible-IKFKUY/metadata` and adds separate approved Publication roots. Preserve both study roots if reopening Studio. Owner, both managed runtime groups and the independent exported server are stopped.

Equipment business rows were compared byte-for-value before/after; visible provisioning added ephemeral test identities to its separate identity store. Existing identities, business data and authored Equipment source were preserved. The fresh Equipment regression study is separately retained at `/tmp/equipment-visible-BKZ19T`; it is additional current-generator evidence, never a replacement for the original isolation study.

`fixtures/publication/project.json` is a copy of the final UI-authored snapshot result (revision 80), not an input. `run/final-rows.json`, `run/migration-history.json` and `run/expected-authored.json` retain independent persistence/source observations. Initial generation and required regeneration cycles 1/2 have separate reviews; review 3 is the final refresh after UI draft resolution. Screenshots were visually inspected at 1280×800; this is functional evidence rather than historical-fidelity acceptance.

Re-run the browser with Node 24.22.1 via `npx playwright test tests/e2e/publication/workflow.spec.ts`; it authors a new isolated catalog visibly and retains its own private configuration. The transport corpus is `npx vitest run tests/contracts/parity/behavior.test.ts`. Independent export replay is `node tests/e2e/publication/portable.mjs` using the study-location file written by the browser test. Only explicit offline dependency installs/builds are used; opening/switching a project never installs dependencies. Historical five-mode/fidelity/scale work remains outside WP23; no visual-fidelity or full security/fault-recovery claim is made by this acceptance package.
