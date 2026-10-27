---
status: implementation-ready-for-independent-review
audience: WP10 reviewer and downstream generator implementers
mission: schema-baron-studio-01M5W3Q9
work_package: WP10
observed: 2026-10-27
---

# First independent public-list output

T046–T050 are implemented. The source is a validated project compiled to explicit routes, table sources/keys, controls, search/sort/page settings and effective public policies. Emitted applications contain ordinary named App Router pages, Grid server components, per-Grid repository configuration, read-only SQLite persistence, field formatting, independent manifests/lock/config, tests and instructions. They contain no Studio or workspace imports.

## Observed verification

All commands ran in lane-j with `PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH` (Node 24.22.1 / npm 11.19.1).

| Command / observation | Actual outcome | Retained evidence |
| --- | --- | --- |
| `npm run verify` | Exit 0: native artifact/smoke validation; workspace/harness types; diff-scoped lint; workspace builds including Studio production; credential heuristic; 29 test files / 249 tests; exact registry/installed metadata verification | `evidence/workspace-verify.log` |
| `npx vitest run packages/generator/tests/public-list/behavior.test.ts` | Exit 0, 14 tests: arbitrary/quoted sources; broken references/unsupported routes/policies; real preview/apply and row preservation; stale/hash/ack/expiry/path checks; target races; staged cancellation and symlink protection; exact-tree ownership refusal; uncertain promotion recovery; SQLite schema/file drift, row-only changes, async idempotency and owner closure; bounded previews | `evidence/generator-boundaries.log` |
| `npx playwright test` | Exit 0, all 11 journeys, including the new first-output proof and the ten approved upstream journeys | `evidence/browser-journeys.log` |
| `node node_modules/typescript/bin/tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2023 --module NodeNext --moduleResolution NodeNext --noEmit --skipLibCheck packages/generator/tests/public-list/behavior.test.ts packages/core/tests/transport/behavior.test.ts tests/e2e/first-output/workflow.spec.ts` | Exit 0, no output | `evidence/strict-test-sources.log` |
| `node scripts/workspace/verify.mjs generated /tmp/wp10-browser-yUgdqS/output/instruments` | Exit 0: copied source into another clean root; sanitized toolchain/environment; ancestor `.bin` and workspace dependency refusal; independent offline `npm ci --ignore-scripts`, typecheck, real SQLite tests and production build | `evidence/isolated-instruments.log` |
| Same isolated command for `/tmp/wp10-browser-yUgdqS/output/publications` | Exit 0, same isolation and build checks | `evidence/isolated-publications.log` |

The final stage-directory hardening and preview size bound do not change emitted application bytes; the final all-in-one verification includes their preservation tests. Both output production builds were run after the multiline template changes. No coverage percentage, pytest authority, full-mission acceptance or unmeasured NFR budget is claimed.

## Visible authoring and output proof

`tests/e2e/first-output/workflow.spec.ts` visibly creates two independent projects through Studio. Each creates a blank connected SQLite file, authors its table/columns/key in the schema editor, reviews actual SQL, explicitly applies the real migration, creates a routed page and ordinary Grid form/control, chooses the stored field through Data Properties, saves, previews actual source files and clicks Create application.

Only after that authoring/migration does the test insert explicit sample rows into the authored table. These are disposable test data, not application construction: there is no hidden page/model JSON or fixture SQL creating the business tables. Project snapshots are read through HTTP and MCP and compared. MCP creates a real generation preview; the exact successful UI generation.apply request is replayed through MCP and its complete structured outcome must be identical.

The test then closes MCP, stops and awaits the Studio owner process, independently installs/types/tests/builds each output under `/tmp`, starts each generated Next server and observes its actual connected record. It checks browser bundles for database modules, the external DB path and DB configuration names. It separately removes the disposable sample row to observe the empty state. Generation/build operations preserve external DB bytes; deliberate fixture-row insertion/removal are distinguished from generation effects.

`evidence/demonstration.json` records the actual project IDs, routes, external files, revisions and stopped-owner observation. Six screenshots are retained under `tests/e2e/first-output/`: `instruments-review.png`, `instruments-created.png`, `instruments-standalone.png` and their `publications-*` counterparts. The preview has bounded scrolling, source creation disclosures, expandable content/technical details and pinned Cancel/actions. Emitted TS/TSX modules now use normal multiline code.

A separate CUA manual inspection opened the generated instruments application at a temporary loopback URL with Studio stopped, changed Direction to Descending, submitted Filter and sort and visibly observed its empty state and disabled paging. The background CUA tab and tracked test server were closed. Visible IAB tabs are unavailable to a subagent; background CUA worked. The original root visual server/tabs were not changed.

## Safety and supported boundary

Preview and apply share the canonical command/revision/idempotency service. SQLiteWorker inspection compares the applied schema fingerprint and source file identity; ordinary data-row changes remain legitimate live data. Source/model/hash/expiry/acknowledgements and the observed output parent/target are rechecked before promotion. The preview content is the reviewed and hashed content. Bounds are 2,000 files, 1 MB per file and 8 MB total; oversized output returns a project-linked diagnostic.

Initial output requires a **new directory below an approved existing root**. Existing directories, including empty ones, are refused with a useful instruction to choose a new child. No existing authored file or directory is replaced. This intentionally excludes WP20 regeneration/ownership/replacement. The complete source tree is staged on the same filesystem, fsynced, verified and promoted with GNU no-copy/no-clobber rename. Exit 0 alone is insufficient: staging must be consumed and the exact destination tree/content must match. A real competing target created after the final freshness check leaves its authored file untouched. Stage directory traversal uses `O_DIRECTORY | O_NOFOLLOW` descriptors and exclusive file creation; injected symlinks cannot redirect writes.

The supported initial promotion host is Linux with `/proc/<pid>/fd` directory access and `/usr/bin/mv` GNU coreutils 9.4 or newer (observed Linux 7.0.0-38-generic / GNU 9.4). Capability/version checks fail closed; no shell interpolation or copy fallback is used. Other hosts receive an unavailable-capability diagnostic rather than a false success. Cross-platform promotion remains future adapter work.

A durable canonical Job apply intent records the project/request/payload/plan identity before first promotion. Recovery accepts only that matching intent plus an exact owned marker/tree; a caller-created lookalike tree is refused. Matching async requests share one outcome, conflicting payloads cause no output writes, and an uncertain completed promotion is recovered without rewriting. A source-only marker containing the plan ID is declared nonsemantic recovery metadata; repeated previews may change it and plan metadata. Application source/configuration remains deterministic for the same inputs.

Unsupported saved queries, authenticated pages, Record/Search/Login forms, actions/links, derived controls and authored extension contracts are object-diagnosed. Public table Grids support prepared allowlisted reads, declared filters/sorts/paging, null/boolean/date/blob/exact-decimal display and empty states. Exact decimal text default sorting is diagnosed as unavailable. Full query/auth/Record generation, managed runtime, custom-code ownership and regeneration remain their assigned packages; none is faked here.

Generation never seeds, resets, migrates or copies linked application data. SQLite opens are read-only and require an existing file. Generated tests create only their own disposable SQLite fixture. Migration markers, backup/restore behavior and SQL generation are consumed from the approved modules.

## Necessary shared integration changes

- Generator/core manifests, exports, build configuration and template copying make the new package an actual built dependency; the lock and official registry evidence were refreshed through `scripts/workspace/dependencies.mjs collect`.
- Canonical generation plans add optional reviewed `outputLocator`, `connectionIdentity` and bounded `afterContent`, so UI and MCP review exactly the same destination/content without an unreviewed apply argument.
- ProjectCore registers the real generation operations and recognizes their object diagnostics; generation uses existing storage plans/jobs and SQLiteWorker, with no second persistence path.
- Workspace adds Generate and its compact dialog, plus the narrow existing-control stored-field selector required to author the first Grid visibly. Existing appearance/validation and stable IDs are preserved. WP16's Form Data block was coordinated separately and its unapproved source was not merged.
- The obsolete bootstrap test that injected a fake generation.apply was changed to assert the production operation cannot be replaced. Actual plan/hash/revision/expiry/ack/state boundaries are exercised through the real handler in WP10.

`dependency-evidence.json` records 85 generated artifacts reused at the workspace-reviewed exact integrity plus the additional official `server-only@0.0.1` metadata/integrity and 2022 publication date. Generated installs keep all lifecycle scripts denied; the reviewed better-sqlite3 native NAPI artifacts work without script exceptions. No Spec Kitty upgrade, hosted sync activation or missing-charter gate was introduced.

## Cycle 1 follow-up

Independent review found private-route mapping and nullable exact-decimal comparison defects. Both are repaired with red-to-green evidence, generated production HTTP checks and a strict decimal metadata type correction. See [CYCLE1.md](CYCLE1.md). The original evidence above is retained; the cycle1 workspace run passes 251 tests and its three strict isolated output checks pass.
