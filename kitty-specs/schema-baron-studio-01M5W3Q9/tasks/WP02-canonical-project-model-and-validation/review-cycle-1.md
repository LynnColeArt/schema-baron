---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T01:26:51Z'
reviewer_agent: reviewer-renata
wp_id: WP02
---

# WP02 independent review — changes requested

Reviewer: codex / reviewer-renata. Source: a88b517e2b1357690f2af9c9e99631256efb8a1f.
Audience: WP02 implementer and mission orchestrator.

Reviewed the complete generated prompt 9d8ac74522ef456b8d7132be9a2b154f, model contracts/spec/plan/data-model/OpenAPI, generated base diff `git diff kitty/mission-schema-baron-studio-01M5W3Q9..HEAD`, and source-commit diff to exclude inherited WP01 bootstrap changes. No product fixes or WP planning edits were made.

## Blocking findings

1. **[P1] Invalid policy input escapes the diagnostic boundary.** `packages/model/src/validation.ts:220–221` calls `effectiveAccess` after discovering an invalid global policy at line 211, without checking its scope. Start with fixtures/model/project.json; set `policies[0].scope = 'page'` and `policies[0].ownerId = pages[0].id`. `validateProject` throws `Error: Invalid global policy`, rather than returning `{ok:false, diagnostics:[...]}`. This violates T008's stable object-linked diagnostics and FR-029's invalid-operation boundary. Guard invalid policy state before calculating effective access (or make the internal calculation diagnostic-safe), and add a regression test through validateProject. Invalid input must return diagnostics without leaking a generic exception.

2. **[P2] Aggregate ORDER BY bypasses declared-grain validation.** `packages/model/src/validation.ts:149–151` validates ORDER BY expression types but discards their aggregate flags. Add `orderBy: [{expression:{kind:'aggregate',function:'count'},direction:'asc'}]` to the fixture's otherwise unchanged row-grain query. validateProject returns ok:true with no diagnostics. SQLite rejects the corresponding `SELECT id FROM parent ORDER BY count(*)` with `misuse of aggregate: count()`. T007 requires valid grouping/result grain and the independent demonstration must reject ambiguous grain; FR-018 includes sorting and aggregates. Include ORDER BY aggregate use in grain/grouping analysis, or explicitly reject this unsupported context. Add negative coverage for an aggregate appearing only inside an ORDER BY expression, including a nested arithmetic/function expression.

3. **[P2] Join predicates resolve aliases not yet joined.** `packages/model/src/validation.ts:139–144` constructs a context containing all aliases and uses it for every ON predicate. Add child1 and child2 sources and sequential LEFT joins from root; have the first join predicate reference child2. All IDs/types resolve and validateProject returns ok:true, but SQLite rejects the corresponding join with `ON clause references tables to its right`. This violates T007's supported join contracts and T008's source-reference validation: existence is insufficient when the alias is outside the current join scope. Validate each ON expression using only already connected aliases plus the current right alias (and the appropriate nullability), then add forward-alias and valid sequential-join tests. No query compiler implementation is requested here.

## Executable public-interface reproductions

Run after `npm run build --workspace @schema-baron/model` under the pinned Node 24.22.1:

```js
import { readFileSync } from 'node:fs';
import { validateProject } from '@schema-baron/model';
const fresh = () => JSON.parse(readFileSync('fixtures/model/project.json', 'utf8'));
const p = fresh();
p.policies[0].scope = 'page'; p.policies[0].ownerId = p.pages[0].id;
try { console.log(validateProject(p)); } catch (e) { console.log(e.message); }
// Actual: Invalid global policy (throws).
const a = fresh();
a.queries[0].orderBy = [{ expression: { kind: 'aggregate', function: 'count' }, direction: 'asc' }];
console.log(validateProject(a).ok); // Actual: true; required: false.
const j = fresh(), q = j.queries[0];
q.sources.push(...['child1', 'child2'].map(alias => ({ alias, source: { kind: 'table', id: j.schema.tables[1].id } })));
q.joins = ['child1', 'child2'].map(alias => ({ leftAlias: 'root', rightAlias: alias, kind: 'left', cardinality: 'one-to-many', on: { kind: 'binary', operator: '=', left: { kind: 'field', alias: 'root', fieldId: j.schema.tables[0].columns[1].id }, right: { kind: 'field', alias: 'child2', fieldId: j.schema.tables[1].columns[1].id } } }));
console.log(validateProject(j).ok); // Actual: true; required: false.
```

Real SQLite in-memory reproduction used installed better-sqlite3 with `CREATE TABLE parent(id INTEGER); CREATE TABLE child(id INTEGER);`. Preparing the aggregate SQL above fails. Preparing `SELECT root.id FROM parent root LEFT JOIN child child1 ON root.id = child2.id LEFT JOIN child child2 ON root.id = child2.id` also fails. No filesystem database was modified.

## Required anti-pattern checklist

| Check | Verdict | Evidence |
| --- | --- | --- |
| Dead code | FAIL | Targeted `rg` across apps/packages excluding tests/dist finds no production imports of @schema-baron/model. Internal modules have index reexports and internal schema users, but public functions such as createId and validatePlanApplication have no live production caller. The documented package interface is usable, independently verified below, yet later-WP callers do not exist. This is the generated prompt's literal live-caller criterion; do not manufacture a dummy consumer to satisfy it. Orchestrator must resolve the foundation-package gate applicability explicitly. |
| Synthetic fixtures | PASS | Existing tests invoke validateProject/parseProject/serializeProject, commandSchema and plan checks; negative fixtures mutate actual inputs and call production validators. |
| Silent empty return | PASS | Expression undefined returns follow an emitted diagnostic or propagate one; sourceFields empty arrays follow broken-reference diagnostics. Success empty diagnostic lists are documented. |
| FR coverage | FAIL | Positive/negative model assertions cover C-003/C-007 and FR-001/003/007/008/011/016/018/020/029 at this WP's model layer, but the demonstrated FR-016/029 invalid policy and FR-018 grain/join gaps are untested. Later UI/transport/runtime acceptance is not claimed. |
| Frozen surface | PASS | Source commit changes only owned fixtures/model and packages/model paths, plus explicitly permitted model manifest/build config. No old repository, demo, doctrine, or frozen reference changes in WP02 source. |
| Locked decision | PASS | No eval/raw SQL expression node, fixture-domain constants, React/transport/SQLite imports, secret persistence, or independent persistence path. Unsupported opaque SQLite SQL remains read-only metadata. |
| Shared-file ownership | PASS | Model manifest export/build script and model-only tsconfig.build.json are minimal necessary integration; rationale and parent coordination recorded in tests/evidence.md. No versions/lockfile changes. |
| Production fragility | FAIL | parseProject's ModelValidationError and effectiveAccess's validated-input contract are documented fail-loud choices, but validateProject calls the latter on invalid input and unexpectedly throws (finding 1). |

## Verified checks and limits

- Node 24.22.1 / npm 11.19.1: `npm test` passed 60 tests, including 49 model cases; `npm run typecheck` passed implemented scope; `npm run build` passed and emitted model ESM/declarations. Other product packages explicitly report NOT IMPLEMENTED.
- Actual native `import('@schema-baron/model')` succeeds, validates both unrelated fixtures and exposes callable commandSchema.safeParse. Model-only integration edits are appropriate and usable by future callers.
- Reviewed negative fixtures and tests for ordered PK/FK arity/type/uniqueness, missing Record keys, unsafe nodes/functions, grouping/fanout/query cycles, stored/derived exclusivity, derived read-only and dependency declarations, policies, strict unknown fields, exact decimal/date checks, expiry/hash/fingerprint/acknowledgements, identity references and input nonmutation.
- Composite destination mapping completeness and generated-column cycles were exploratory observations only, not additional blocking findings: destination filters can intentionally be partial, and opaque unsupported imported objects require distinct treatment. No unsupported-runtime feature was silently claimed.
- No HTTP/MCP service, persistence/migration, generated app, UI or performance acceptance exists in this WP. No dependency install, upgrade, hosted sync opt-in, or later-WP status change was performed.
