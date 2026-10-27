# WP12 — generated Search and Record lifecycle

Audience: independent WP12 reviewers and WP13/WP14 implementers. Public configured actions are covered. Authenticated pages/actions fail compilation here; no fake session is emitted.

## Implementation and shared integration rationale

- Compiler/IR/base emitter register table-bound Search/Record forms and ordinary declared actions. Search uses the prepared, field-aware Grid repository. Selected/declared sorts are allowlisted; ordered keys break paging ties. Invalid sort/filter/page values fail safely.
- Generated validation, repository, service, per-form actions/configs and navigation are separate local modules. Rendering reads only. Writes validate typed keys/fields and run SQLite BEGIN IMMEDIATE transactions with foreign keys enabled.
- Optional Form.displayFieldIds is source-validated and explicitly selected in ordinary Studio Data properties. Delete generation diagnoses an absent name declaration instead of guessing name/id. Older definitions remain readable.
- Linked-Record construction declares write-success destinations and a separate explicit New action. These remain ordinary editable actions. Template asset copying includes Record/navigation files. No dependency changed.
- Initial-output staging, canonical apply intent, exact preview/hash, inode/schema observation, descriptor/no-clobber promotion and no-data-copy paths remain intact.
- Exact decimal scale/precision/rounding metadata remains. Nullable values stay SQL NULL. Missing integer keys are automatic only when current physical SQLite declaration/index metadata proves a rowid alias. INT PK, inline INTEGER PK DESC and composite keys are not assumed aliases.
- Navigation paths/mapping names come from declarations. Mutation parameters reject undeclared source/return overrides. Cancel never writes; it may read the selected row for a declared return mapping. A project-namespaced informational cookie supplies the consumed one-time save notice; it is not an authentication cookie.

## Observed evidence

| Case | Method and outcome |
|---|---|
| T056 | Actual emitted loadGrid and production Search against quoted tables: contains/equality, bounded paging, allowed sorting, empty/injection-like filters, malformed direction/page and hidden-field sort rejection. |
| T057 | External generated modules create and update exactly the selected composite row. Invalid input/key, duplicate values and invalid FK write no unintended data. Large decimal stays exact text; nullable lookup stores NULL. Real browser retains invalid values and localized errors. |
| T058 | Declared title names confirmation. Missing confirmation writes nothing. RESTRICT returns friendly RELATED_RECORDS_EXIST and preserves counts. CASCADE describes direct impacts and deletes real child rows transactionally. |
| T059 | Declared success/cancel/delete mappings retain typed parent-filter values. Actual Grid links preserve search/sort/direction. Cancel leaves persisted title unchanged. Save notice disappears on reload. External return/source overrides fail. |
| T060 | Two apps independently install with scripts disabled, typecheck, test and production-build outside the workspace. Browser app runs after Studio stops; independent SQL verifies final rows. Runtime app covers quoted/composite keys, duplicates, nullable lookups, exact decimals, booleans/defaults and physical key exceptions. |
| Direct requests | A captured valid generated server-action replay with an untrusted Origin fails (HTTP >=400). Independent final rows remain unchanged. Next's real server-action Origin protection is exercised. |
| Manual CUA | Inspected actual generated catalog/Record in background IAB; entered a draft title and canceled, observing the original title. Visible subagent IAB is unsupported. |
| Client bundles | Production static JS contains no better-sqlite3, APPLICATION_DATABASE_PATH, node:sqlite or external DB path. |

Runtime forms/actions use normal form.construct and contextual project.batch operations. The browser uses the focused wizard, Data properties and visible generation preview/apply. Its existing external SQLite schema and seeded rows are explicit test inputs; no JSON patch creates Grid, Record, Search or actions.

## Reproduction and artifacts

Use Node 24.22.1 / npm 11.19.1:

- npm run verify — native checks, types, lint, build, credential heuristic, full Vitest suite, installed lockfile metadata.
- npx vitest run packages/generator/tests/record — fail-closed compiler cases and installed external SQLite app.
- npx playwright test tests/e2e/generated-records/workflow.spec.ts --workers=1 — actual authoring and production browser flow.
- Explicit strict tsc --noEmit with noUncheckedIndexedAccess and exactOptionalPropertyTypes covers both new generator test sources and the browser source; see strict-test-sources.log (empty output on success).
- npm audit --json --ignore-scripts — zero reported vulnerabilities.

Final retained results: workspace verify passed 34 test files / 269 tests; focused Record suite passed 6 tests; actual browser journey passed in 35.1 seconds; strict new test-source check exited 0; npm audit reported 0 vulnerabilities.

Logs: evidence/. Screenshots: tests/e2e/generated-records/evidence/. Disposable roots and a review URL: evidence/local-review.json. No owner capability is included; private owner config remains outside Git.

## Limits and corrected findings

Table-bound output only. Saved queries, authenticated routes/actions, hooks/extensions and existing-output regeneration remain diagnosed until their assigned packages. Form keys bind their own stored fields; action mappings supply incoming literal/source key/filter values. Non-self form key expressions are diagnosed. Lookups cap at 200 options and report an actionable load error above that bound. Exact decimal text sorting remains explicitly unsupported. Cascade messaging gives direct referencing counts and states that their cascading descendants are included; SQLite enforces the actual graph.

Browser runs caught a navigation excess-property type error, unstable accessible labels after inline errors, and an in-memory save notice that did not span Next route/action bundles. These were corrected before retained green runs. The baseline empty UI package remains reported NOT IMPLEMENTED. The unavailable Python no_coverage advisory is not a pass/bypass. No WP13/WP14 authentication acceptance or later regeneration/extension preservation is claimed.
