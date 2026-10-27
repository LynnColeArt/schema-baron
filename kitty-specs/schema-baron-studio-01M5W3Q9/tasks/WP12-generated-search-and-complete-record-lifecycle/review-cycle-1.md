---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T08:49:14Z'
reviewer_agent: reviewer-renata
wp_id: WP12
---

# WP12 independent review — changes requested

Reviewer: reviewer-renata. Source: 2207735061faab76ec9063040c2e2541462bff47. True dependency: WP11 ab000324f7703e07e3a6d9a9416d4b0736485d87. Lane HEAD 21526f02b7f302c1370481674fa9160d93553f22 differs from source only in coordination/status artifacts. Review excludes inherited approved work.

## P1 — Declared key-based child return cannot be read

`packages/generator/src/templates/navigation/index.ts:21` compiles a destination filterMapping to `<form>:key:<field>` whenever that field occurs in the target Grid/Search keyMapping. This is an accepted authored model: select a normal self-field key in Data properties and declare a child filter mapping to it. However `templates/grid/index.ts:6` and navigation contextFields only include keys with parameter expressions; compiler/index.ts rejects those parameter expressions. Therefore the accepted normal self-field declaration never emits a parent predicate or allowed/context parameter.

Heldout generated app: runtime suite's publicly authored project, list keyMapping set to self-field tenant, tenant removed from ordinary search to prove this is a key-based child filter, existing declared Record Cancel source-tenant filter mapping retained. Model validation and compilation succeed; independent production build succeeds. Cancel of existing composite B/1 returns `/list?<form>:key:tenant=B`. Generated loadGrid returns an error and no rows. Actual standalone production HTTP GET of that exact return location returns HTTP 200 with `The list could not be read.` and no Other row. This also affects Save/Delete destinations using the same mapping.

Fix the smallest compiler/context/repository mismatch so accepted declared child mappings produce a bound predicate and survive navigation; verify a real key-based parent/child return, not only an ordinary search filter. Do not simply drop or ignore the key parameter (that would expose an unfiltered list). If a mapping cannot be implemented it must be diagnosed before generation, but this required parent-filter flow remains WP12 scope.

Reproduction: `/tmp/wp12-heldout.mjs`; retained valid authored model and generated app `/tmp/wp12-heldout-a9uaQP`; result `/tmp/wp12-heldout-result.json`; production response `/tmp/wp12-heldout-http.html`; build `/tmp/wp12-heldout-build.log`. Disposable server was http://127.0.0.1:36576.

## P1 — Empty typed search disables Record navigation

`templates/navigation/runtime.template:11` validates every search context value using Record field validation. An empty integer/date/boolean/decimal filter is valid absent search in `templates/base/repository.template` (it skips empty filters), and normal GET forms submit empty fields. Navigation instead throws `Enter a value.` for a non-null numeric field. Grid link() catches this and silently returns `#`; Record load/execute reject the same otherwise valid context. Thus leaving an optional numeric filter blank can make New/Edit links unusable or prevent Cancel/Save.

Heldout generated app `/tmp/wp12-blank-dp8ciW`: add ordinary seq equality search via declared model; loadGrid({<form>:filter:seq:''}) correctly returns existing B and C rows. Generated execute(Cancel, existing composite B/1, same blank context) returns summary `Enter a value.` with no location. Reproduce `/tmp/wp12-blank-filter.mjs`. Normalize absent/blank optional search values consistently without weakening required key validation, and test an actual GET with mixed populated/empty typed search fields through Record navigation.

## Independent verification

- `npx vitest run packages/generator/tests/record`: 6/6 passed; includes real external SQLite, composite/quoted keys, nullable lookup, exact decimals, rowid exceptions, FK RESTRICT/CASCADE, install/typecheck/test/production build.
- `npx playwright test tests/e2e/generated-records/workflow.spec.ts --workers=1`: actual wizard → independently installed production app CRUD/search journey passed, 32.8s (33.5s runner).
- `npm run build`: passed; existing UI package NOT IMPLEMENTED advisory remains.
- Additional heldout app production build passed; actual returned HTTP page demonstrates P1 above.
- `git diff ab00032..2207735 --check`: passed.
- No product edits. Test screenshots restored; generated test results retained under /tmp. No auth, hosted sync, upgrades or regeneration claimed.

## Eight anti-pattern checks

1. Dead code: PASS. Targeted production rg confirms compiler calls contextFields/compileDestination, base emitter calls recordFiles/searchFiles, generated pages/actions call load/execute; repository helpers called by service.
2. Synthetic-fixture test: PASS. Tests invoke public ProjectCore commands, actual compile/emission and independent SQLite modules; browser uses actual Studio wizard and standalone production app.
3. Silent empty return: FAIL. Generated link catches valid empty typed-filter navigation errors and returns `#`; Grid context catch drops all context. This hides the confirmed typed search failure. Other empty returns are intentional absence/no-op or error-bearing list/service results.
4. FR coverage: FAIL. Happy-path assertions cover FR-012/013/014, architecture/general-purpose and scoped security/output, but declared key-based child returns and mixed empty typed filter returns fail heldout checks. Authentication/regeneration remain explicitly future scope.
5. Frozen surface: PASS. No frozen artifact modification identified in the source/base code delta; no unrelated doctrine/archived changes.
6. Locked decision: PASS. No SQL interpolation from client identifiers, external destination authority, fixture names or second persistence path observed. Accepted mappings nevertheless fail behavior as above.
7. Shared-file ownership: PASS. Explicit parent authorization and EVIDENCE rationale cover narrow compiler/IR/base emitter, form-construction/model/UI displayFieldIds integration and copy registration. No ownership-glob workaround.
8. Production fragility: PASS. Fail-loud validations/unsupported capabilities have diagnostic purpose; repository constraint/race errors are caught by transactional service and friendly error handlers. No unhandled transient write error identified.

Required outcome: reject to planned for the two demonstrated navigation defects.
