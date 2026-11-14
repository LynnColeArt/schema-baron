---
status: repaired-ready-for-independent-review
audience: WP10 reviewer and downstream generator implementers
mission: schema-baron-studio-01M5W3Q9
work_package: WP10
review_cycle: 1
observed: 2026-10-27
---

# Cycle 1 — private routes and nullable exact decimals

Canonical review: `tasks/WP10-first-standalone-generated-public-list/review-cycle-1.md`, source `5872850c10d2c0dc60e2ee6c943929c08044f8a4`, rejection event `01M5Y1XDANF11BR4S5DF6BM0MV`. Feedback input remains `/tmp/wp10-independent-review-feedback.md`; its SHA256 and the three unchanged original reproducer hashes are retained in `evidence/cycle1/original-sha256.txt` and were verified again after repair.

## Bounded corrections

- The compiler rejects any leading-underscore route segment with a page-linked `UNSUPPORTED_SCHEMA_OBJECT` diagnostic before emitting output. It preserves supported literal routes; no route is silently renamed. Top-level/nested private segments and `_next` are covered. Existing group, slot, interception and dynamic segment rejection remains intact. Supported middle-underscore routes and ordinary `layout`/`route` directory names remain accepted; an actual generated nested public route returns 200.
- The generated SQLite `decimal_compare` function returns SQL NULL when either operand is NULL. SQL equality/range predicates therefore exclude NULL rows without converting them to zero, REAL or an empty decimal. Non-null values still use Decimal's exact comparison.
- The generated formatter's `FieldType` now includes the canonical optional precision/rounding metadata. The desired strict-build regression exposed this directly related type gap before reaching the HTTP checks; the change adds metadata typing without changing formatting behavior.

No ownership, idempotency, drift, migration, path, promotion, dependency or lifecycle policy was changed. No new routing or decimal-text sorting capability was added.

## Red to green

The original scripts are copied byte-for-byte beside their hashes; original `/tmp` files and prior generated review outputs were not overwritten.

| Case | Red observation | Green observation |
| --- | --- | --- |
| Original `wp10-review-routes.mjs` | Compiled `/_inventory`, emitted a private folder, actual Next HTTP404 | Same original script now throws the expected page diagnostic before output. `wp10-cycle1-route-rejection.mjs` imports it unchanged and asserts the supported pre-generation rejection alternative. |
| Original `wp10-review-nullable-page.mjs` | Initial page displayed the large amount/NULL placeholder; filtering returned a list alert and lost the amount | Same script: initial 200 with large amount and NULL display; filtered 200 with the exact amount, no alert, no NULL row; missing DB still produces the safe alert. |
| Original `wp10-review-reads.mjs` | Scaled/quoted/order controls passed; nullable text-decimal filter returned rows empty plus an error | Quoted identifiers, scaled order/filter and exact large currency display still pass; nullable text-decimal filter returns the exact matching row with no error. |
| Desired regressions | Route test failed for missing diagnostic; the production-app test exposed the decimal metadata strict-type error | Focused suite 16/16. Generated app passes independent types/tests/production build and actual HTTP assertions. |

The original read script hardcodes its earlier emitted repository path. Its green run uses the retained `wp10-cycle1-candidate-imports.mjs` loader solely to redirect its two absolute repository/formatter imports to the newly emitted candidate. It does not patch functions, SQL, parameters or expected values, and leaves the earlier emitted app immutable. The primary green proof is the independently built HTTP app, not this path adapter. Commands:

```text
node /tmp/wp10-review-routes.mjs
node /tmp/wp10-review-nullable-page.mjs
node --conditions=react-server /tmp/wp10-review-reads.mjs
node /tmp/wp10-cycle1-route-rejection.mjs
node --conditions=react-server --import /tmp/wp10-cycle1-candidate-imports.mjs /tmp/wp10-review-reads.mjs
```

All raw `/tmp` evidence SHA256 values are recorded in `raw-artifact-sha256.json`; committed log views remove trailing blank lines only. Red logs and green logs are both retained.

## Required verification

All commands used Node24.22.1/npm11.19.1 via `PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH`.

- `npm run verify`: exit0, 30 test files / 251 tests; native smoke/artifact verification, workspace/harness types, diff lint, Studio/package production builds, credential heuristic and exact registry metadata checks pass. See `workspace-verify.log`.
- `npx vitest run packages/generator/tests/public-list`: exit0, 16/16. This retains all fourteen original boundary tests, adds route convention rejection/positive controls, and exercises a real generated production app. See `focused-green.log`.
- The new `runtime.test.ts` creates an explicit disposable regression fixture (separate from the UI authoring milestone), then emits/installs/typechecks/tests/production-builds/starts the app. Actual HTTP responses prove nullable decimal eq/gte/lte, zero exclusion of NULL, negative/ordinary/large exact values, supported scaled sorting, NULL display, nested literal routing and missing-file behavior. External DB bytes remain unchanged. Retained app: `/tmp/wp10-cycle1-runtime-7akkmq/application`; observations in `http-observations.json`.
- `npx playwright test tests/e2e/first-output/workflow.spec.ts`: exit0, 1/1. The unchanged complete two-app visible authoring/migration/Grid/save/generation/UI-MCP parity/independent install/types/tests/build/runtime proof passed again. Studio is stopped before both apps read actual data. Fresh root `/tmp/wp10-browser-SvoRwN`. The original full eleven-journey evidence remains retained; this repair cycle reran the relevant first-output journey rather than claiming a new full-browser-suite run.
- `node scripts/workspace/verify.mjs generated` independently passed for `/tmp/wp10-browser-SvoRwN/output/instruments`, `/tmp/wp10-browser-SvoRwN/output/publications` and `/tmp/wp10-cycle1-runtime-7akkmq/application`. Each was copied into another clean root, independently installed offline with lifecycle scripts denied, strictly typechecked, tested and production-built using the sanitized toolchain/ancestor-bin checks. See the three `isolated-*.log` files.
- Strict new test-source check: exit0 with no output:
  `node node_modules/typescript/bin/tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2023 --module NodeNext --moduleResolution NodeNext --noEmit --skipLibCheck packages/generator/tests/public-list/behavior.test.ts packages/generator/tests/public-list/runtime.test.ts tests/e2e/first-output/workflow.spec.ts`.

The generated app's own disposable SQLite tests also carry nullable eq/gte/lte, large exact values, NULL display and supported sort assertions. Exact decimal TEXT sorting remains explicitly unavailable; the repaired comparisons do not introduce an approximate sort. No coverage authority, new performance claim, hosted sync consent, Spec Kitty upgrade or unreviewed WP16 merge is claimed.
