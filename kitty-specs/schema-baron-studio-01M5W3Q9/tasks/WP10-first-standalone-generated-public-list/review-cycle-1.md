---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T06:49:07Z'
reviewer_agent: codex
wp_id: WP10
---

# WP10 independent review — changes requested

Reviewer: codex / reviewer-renata. Reviewed product source: 5872850c10d2c0dc60e2ee6c943929c08044f8a4. Dependency base: afb711eeb1d52d3aba7c21d7631331af3a3a6935 (approved WP08/WP09). HEAD d550a6c contains only later coordination/status changes beyond that product source. No product fixes were made.

## P2 — Preserve underscore-prefixed route mappings or reject them before generation

`packages/generator/src/compiler/index.ts:16` accepts static route `/_inventory`, and `packages/generator/src/templates/base/index.ts` emits it as `app/_inventory/page.tsx`. Next treats this folder as private, so the declared route is absent. I changed only the route on a real retained authored project, invoked production compileProject/emitApplication, and ran that generated application: HTTP GET /_inventory returned 404 and “This page could not be found.” Compilation produced no object-linked diagnostic. Reproducer: /tmp/wp10-review-routes.mjs; generated output: /tmp/wp10-review-route-gjbAEQ. This also affects any nested underscore-prefixed segment.

Fix by mapping supported literal underscore routes to valid Next filesystem segments, or reject these routes with a page-linked unsupported-route diagnostic before preview/apply. Add a generated HTTP assertion (or pre-generation rejection assertion) for both top-level and nested private segments. Dynamic/group segments already fail current static validation; supporting those is not requested. T048 requires preserving declared mappings, and T046 requires honest unsupported diagnostics.

## P2 — Nullable exact-decimal text must not break every filtered row

`packages/generator/src/templates/base/repository.template:116` registers decimal_compare with `new Decimal(String(left))`. For a supported nullable text-encoded decimal, SQLite invokes it with NULL; Decimal('null') throws and the broad readGrid catch returns an error instead of the matching non-null rows. With values '1000000000000000000.25', '9.75', NULL and a gte 10.00 filter, production generated readGrid returns rows:[] plus an error. A real emitted public page initially returned HTTP 200 with the large amount and NULL placeholder; submitting its declared filter returned HTTP 200 with role=alert and lost the matching amount. Reproducer: /tmp/wp10-review-nullable-page.mjs; generated output: /tmp/wp10-review-nullable-dWXfti. Module-level corroboration: /tmp/wp10-review-reads.mjs.

Give decimal comparison SQL NULL semantics (exclude/propagate NULL safely) without converting it to a numeric zero, and add generated runtime tests for nullable text-decimal eq/gte/lte against ordinary and large exact values. This is within T048/FR-012, not deferred report/auth work.

## Independent verification and limits

- `npx vitest run packages/generator/tests/public-list/behavior.test.ts`: PASS, 14/14, 8.97s. Actual production core/SQLite/filesystem paths cover stale/hash/expiry/ack, competing directories, symlinks, parent identity, row preservation/schema drift, idempotency, owner closure, uncertain recovery and preview bound.
- `npx playwright test tests/e2e/first-output/workflow.spec.ts`: PASS, 1/1, 43.5s. Fresh visible schema/migration/Grid/control creation, UI/MCP snapshot/apply parity, two distinct applications installed/typechecked/tested/production-built outside the workspace, real data after Studio stops, client-bundle exclusions, invalid sort and empty state. Retained fresh root: /tmp/wp10-browser-bn2O50.
- `node scripts/workspace/verify.mjs generated /tmp/wp10-browser-bn2O50/output/instruments`: PASS; repeated for publications: PASS. Both helpers copied into a clean root, refused inherited workspace/.bin resolution, independently installed with lifecycle scripts denied, typechecked, tested and production-built.
- Actual generated read code: quoted/unusual table identifiers, large scaled-decimal formatting ($1000000000000000.25), numeric scaled filtering and ordering, NULL display passed. The nullable text-decimal filter failed as above. Missing database produced the safe public alert; no file was created by its read.
- Inspected all six actual authoring/review/standalone screenshots. Retained original evidence reports the full 249-test workspace and 11-journey browser suite; this independent review reran the focused 14 tests, complete two-app journey and both strict isolation helpers, not the entire workspace suite.
- `git diff --check <dependency-base>..<source>` reports only three extra EOF blank lines in retained evidence .log files; no source whitespace failure. This is incidental and is not a rejection reason.
- Python no_coverage advisory is unavailable; no coverage or full-mission acceptance claim. Linux/GNU mv/procfs prerequisite is approved for this slice; cross-platform promotion and WP20 regeneration are not required here. No hosted sync opt-in, charter gate, dependency upgrade, or unrelated process termination.

## Mandatory eight-item checklist

1. Dead code: PASS. Production ProjectCore registers generation; handlers invoke compiler/emitter/output writer; emitted routes invoke Grid components and server repository/formatter. IR is consumed by compiler/templates. Template-copy/build/export integration is live.
2. Synthetic fixtures: PASS within evidence scope. Boundary tests call actual core operations and SQLite/filesystem code. Browser test visibly authors models/schema through UI and uses explicit test rows only afterward; no hidden construction seed. The additional reviewer cases run production generated code.
3. Silent empty return: PASS with explicit error paths. Compiler's empty form collection accompanies blocking diagnostics; verifyFiles false denotes refusal. Runtime read failure returns an error rendered as role=alert, not an unexplained empty list. That safe error presentation does not excuse the NULL bug above.
4. FR coverage: CHANGES REQUESTED. Binding/general-schema and initial preview/write/independent output evidence exist for C-001/C-004/C-007, FR-011/025/027 and this slice of NFR-006. FR-012 route mapping and nullable decimal filtering fail the independent cases. Deferred records/auth/reports/extensions are diagnosed rather than claimed complete.
5. Frozen surface: PASS. No frozen implementation surface is named for this WP; preserved old experiments and unrelated doctrine were not changed in its product diff. Coordination/task metadata differences are runtime-produced, outside product review.
6. Locked decisions: PASS except behavioral fidelity defects described above. Output is ordinary strict Next/TS/SQLite with server-only reads; no Studio runtime imports, client database modules, data seeding/reset/copy or unsafe overwrite. Existing directories are refused and promotion is no-clobber/no-copy on documented host capability.
7. Shared-file ownership: PASS per explicit root authorization and EVIDENCE coordination rationale: core/generator manifests/exports/build, ProjectCore registration/diagnostics, plan afterContent/locator/identity, Studio modal/toolbar and narrow stored-field selector. WP16's separate repair was not merged. No automatic scope failure imposed for these necessary edits.
8. Production fragility: PASS for explicit fail-closed preservation boundaries; filesystem/worker/core errors refuse output and uncertainty preserves recoverable state. The generated decimal comparator's unhandled valid NULL input is the actionable runtime fragility in finding 2. No new unsupported cross-platform promise is required.

Verdict: reject / return WP10 to planned. Re-review the two concrete cases after repair; preserve the working independent two-app and boundary evidence.
