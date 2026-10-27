# Equipment Desk visible acceptance

Audience: independent mission reviewers and the owner studying the disposable local example.

Status: the complete fresh visible browser journey passed in 1.9 minutes on the recorded machine. Both real regeneration cycles and the independent exported application passed. Production corrections are committed separately as `62feaa7` and `f1b4d7b`; this report and acceptance artifacts accompany the final WP22 source commit. WP22 is handed to independent review, not self-approved.

## Authoring boundary

`tests/e2e/equipment/workflow.spec.ts` creates a fresh approved directory, writes only owner bootstrap configuration (0600), and creates Equipment Desk through the actual Studio controls. All four tables, columns, unique constraint, restrictive FKs, pages, Grid/linked Record/Search/Login forms, search settings, policies, identity headers, managed visitor, two queries, report, child navigation, extension declarations and source edits come from visible controls. No fixture model is an input, no DDL/data is seeded, no MCP object setup or direct project mutation stands in for authoring. Generated records come through the app's New record/Save controls.

Browser HTTP GET snapshots and SQLite `readonly:true` handles serve as independent oracles. The only direct mutation probes are rejected stale migration apply and unauthorized generated writes. Code textarea edits are explicitly authored modules. SQL expectations and BigInt arithmetic do not use the query compiler.

Trace policy: raw Playwright traces are off because their action metadata includes password fill values. `redacted-browser-operations.json` records only operation names/paths, HTTP status and timestamps; request payloads, owner keys, visitor passwords, session values and CSRF tokens are excluded at collection. Screenshots follow cleared provisioning fields. Private configuration, live DB, identity store and backups stay outside Git under `/tmp/equipment-visible-*`.

## Coverage boundaries

| Case | WP22 scope and honest limitation |
|---|---|
| AT-01 | Blank create/save/reopen and portable export exercised by the journey. Cross-project switching, format refusal and full draft/undo corpus belong to other packages. |
| AT-02 | Grid/linked Record/Search/Login visible construction and later ordinary Properties. Full cancellation and alternate lookup catalog are not claimed here. |
| AT-03 | Four authored tables, decimal encoding, integer keys, borrower email uniqueness and three restrictive FKs; physical SQLite assertions. External import/composite keys/quoted identifiers belong to the second project and earlier packages. |
| AT-04 | Reviewed rename, nullable/required additions with explicit backfill, canceled destructive type change, stale plan refusal and journal preservation. Fault-injection/restart/backup restore matrix is not claimed by this journey. |
| AT-05 | Real generated CRUD, named delete, cancel/no write, retained invalid input, parent filters and restricted deletion. Composite-key and scale/performance corpus is outside this fixture. |
| AT-06 | Visible managed-user provisioning, public global/Login policy, protected Record pages/actions, header, wrong login, Cancel/resume, logout, anonymous and revoked-session direct rejection. Broader CSRF/forged-key/external-return matrix remains earlier-package evidence. |
| AT-07 | Two visibly authored grouped queries, outer joins, HAVING minimum, zero borrower, exact integer×decimal totals, filtered child links and CRUD refresh; independent BigInt oracle. Timeout/large-data bounds are not claimed. |
| AT-08 | Actual report-mapping, Save and Cancel edges select source Properties. Endpoint/schema separation has earlier-package coverage; no graph performance claim. |
| AT-09 | Visible Code validator/action execution, byte checks across two actual post-write regeneration cycles, managed build/start/stop and standalone output. Full five-mode/HTML/draft interruption coverage belongs to WP25. |
| AT-10 | Not claimed: WP23 owns UI/MCP parity. |
| AT-11 | Equipment Desk portion only. Publication Catalog and combined two-project acceptance remain WP23. |

No full NFR, accessibility/fidelity, performance, failure-recovery or two-project completion claim follows from this one application. Equipment numeric/output preservation observations will be recorded with final results; NFR-006 and FR-030 mission completion require the second app too.

## Product finding

The visible integer quantity × exact decimal price query exposed a generic arithmetic type gap. It was reported before shared edits and corrected with coordinating authorization. See [numeric-boundary.md](numeric-boundary.md). Correct fanout rejection was retained: the author explicitly builds a per-loan grouped query and joins that unique result before borrower aggregation.

## Observed verification

- Final workspace Vitest: 455 tests, 68 files passed, including both production corrections.
- Focused model/query/decimal/designer/report: 135 tests, 14 files passed.
- Final workspace typecheck, lint, credential scan, pinned-dependency verification and native SQLite smoke passed. Full production build passed after the arithmetic correction; the later server-only nullable-backfill correction passed its core production build and strict source check.
- Strict affected SQLite source and Equipment harness checks passed.
- Original generated output: offline install, strict typecheck, generated tests and actual managed production build/run passed. Each of two promotions explicitly removed only disclosed rebuildable artifacts, followed by offline reinstall, managed production build/run and real post-evolution asset add/delete through the generated UI.
- Export: offline install, strict typecheck, generated tests and production build passed outside the workspace. Studio was stopped and unreachable before the exported server started; its report displayed Ada 3.10 and Zero 0.00.
- Independent isolated verifier: `node scripts/workspace/verify.mjs generated /tmp/equipment-visible-IKFKUY/outputs/portable/app` copied the output to a clean temporary root with an isolated toolchain, then passed offline install/typecheck/tests/production build. See `isolated-output.log`.
- Migration-focused regression run: 78 tests, 12 files passed. Nullable-backfill real preview/apply regression: all three cases passed.
- Exact credential scan checked 117 retained/client files against the in-memory visitor password and owner capability; neither appeared. Project model comparisons also excluded both values. Standard workspace credential scan passed. No raw traces were retained.

Retained console logs normalize carriage returns/trailing whitespace only; empty strict-check output is labeled with its observed command and exit status. The final uninterrupted browser result is retained in [browser.log](browser.log), [playwright-result.json](run/playwright-result.json) and the operation-only [browser log](run/redacted-browser-operations.json). Screenshots were visually inspected; their 1280×800 dimensions are recorded in [environment.json](run/environment.json). This is functional evidence, not historical visual-fidelity acceptance.

## Completed WP22 observations

| Subtask | Observed result | Checkable artifacts |
|---|---|---|
| T106 | Fresh empty SQLite inspected; four tables, unique email and three restrictive FKs authored visibly; reviewed DDL applied; Grid/linked Record/Search/Login plus later bound required control authored by supported wizards/Properties. | [schema review](run/schema-review.png), [visible forms](run/visible-forms.png), [UI-created model](../../../fixtures/equipment/project.json), operation log. |
| T107 | Public read; explicit public global/Login and protected Record/action policies; visible provisioning/header; wrong login, filtered selected-child login Cancel/resume; generated CRUD, retained invalid decimal, named deletion; restricted parent preserves children; logout removes header identity and anonymous/revoked-session direct writes return HTTP 401. | [security](run/security.png), browser source and operation log, [final rows](run/final-rows.json), [integrity](run/database-integrity.json). |
| T108 | Visible per-loan grouped subtotal → borrower outer-join aggregate/HAVING minimum; generated parameter form filters zero borrower; report→loan→line links carry declared parent filters; actual mapping/Save/Cancel edges select source Properties; runtime and designer totals match separate BigInt arithmetic. Totals after line edit/add/delete: 3.10 → 3.20 → 3.10, with Zero 0.00. | [runtime report](run/runtime-report.png), [designer preview](run/designer-exact-preview.png), [mapping](run/flow-properties.png), [Save/Cancel](run/flow-save-cancel-properties.png), `tests/e2e/equipment/oracle.ts`. |
| T109 | Actual Code validator and action execute; forbidden inputs leave rows unchanged. Rename label→caption, nullable notes and required condition with explicit ready backfill applied. Nullable destructive conversion reviewed and canceled; a second visible editor makes a plan stale and direct apply is rejected 409. Two actual source promotions preserve all rows, query/forms/actions/policies and exact authored bytes/migration markers; post-cycle CRUD still works. Reopened policy/query/link/Code controls are asserted. Export runs with Studio stopped. | [evolution SQL](run/schema-evolution-review.txt), [destructive cancellation](run/schema-destructive-cancel.png), [stale refusal](run/stale-refusal.json), [history](run/migration-history.json), [authored bytes](run/expected-authored.json), [reopened Code](run/reopened-authored-source.png), [independent export](run/independent-export.png), generation-review-0/1/2 and install/build logs. |
| T110 | AT-01–11 boundaries mapped above; environment, actual operation trace, screenshots, row/integrity/history/source comparisons, independent decimal oracle and credential scans retained. Private live data/config remains outside Git. | This report, [environment](run/environment.json), [credential scan](run/credential-scan.json), source tests and logs. |

Final surviving rows: Camera (caption, daily_rate 12.34, notes NULL, condition ready); Ada and Zero; one Open loan; Lens revised 3×0.20 and Stand 2×1.25. The separate exact expected total is 3.10. Disposable line and post-cycle assets were explicitly created/deleted through generated forms; retained reference rows were not reset. Physical integrity is `ok`, foreign_key_check is empty and the borrower unique index remains present.

The migration marker rows and both extension files were compared byte/value-for-byte/value after each promotion; generation never seeded or reset business data. The final fixture model is an output of the recorded UI journey, not a setup input.

## Retained local study

The final disposable live study root is `/tmp/equipment-visible-IKFKUY` (also recorded in `/tmp/wp22-equipment-study-location.json`). The project definition is under `definitions/`, live business data is `definitions/equipment.sqlite`, generated source is `outputs/app/`, and the standalone export is `outputs/portable/` (`app/` plus private business snapshot). Owner configuration remains `owner.json` with mode 0600; managed identity/session material stays private. These files are disposable acceptance data, unrelated to the user's old application. Do not publish owner config, identity/session stores or private backups.

The owner and both test-owned runtime groups are stopped. A future owner can reopen this project with its private configuration and provision a new visitor visibly; no plaintext visitor password is retained. The standalone public report can be studied without Studio after the documented install/build/run commands.

## Remaining mission scope

WP23 still owns Publication Catalog and UI/MCP parity. WP25 owns the comprehensive five-mode/fidelity/keyboard/scale corpus. Full AT-04/09 fault-injection recovery, broad security attack corpus and full NFR acceptance are not claimed by this Equipment happy/exception walkthrough. Both source defects were reported and corrected with narrow authorization; no acceptance constants or hidden authoring setup were added.


## Independent review correction

Review cycle 1 found a reproducible focused-map pointer regression after saved mapping edits. It is closed by retaining React Flow's controlled-node dimensions in project-local, non-persisted view state. Correct nodes and viewport had been present but all node wrappers were hidden after dimension metadata was lost. The original pointer case now passes in two fresh runs; full bounded flow/document coverage passes six cases with the historical checkpoint explicitly skipped, and the complete Equipment journey passes again. See [review-cycle-2/report.md](review-cycle-2/report.md) for failed-before geometry, visible-after geometry, generic cache tests and actual pointer/Properties/handler correspondence. The original saved study and reference data remain intact.
