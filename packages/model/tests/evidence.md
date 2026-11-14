# WP02 verification evidence

Audience: independent WP02 reviewer and downstream package implementers.
Client date: 2026-10-26, America/Chicago.

Implementation covers T006–T010 through the exported model package. The two
independent project fixtures cover reserved/quoted identifiers, composite keys,
nullable foreign keys, exact decimals, unique constraints, indexes, page document
composition, controls/actions, queries and explicit policies. Eight persisted
negative fixtures plus focused mutations reject invalid keys/references/routes,
unsafe expressions, duplicate output identities, query grouping/fanout, unsupported
formats and stored/derived conflicts. The corpus checks no input mutation.

Verification run using Node 24.22.1 and npm 11.19.1:

- `npm ci --ignore-scripts --offline`: passed; exact lockfile, no scripts enabled.
- `npm test`: passed, 60 tests (49 model cases and 11 bootstrap cases).
- `npm run typecheck`: passed for model and existing harness; other product packages
  explicitly report NOT IMPLEMENTED at this phase.
- `npm run build`: passed; model emits declarations/ESM; other product packages
  explicitly report NOT IMPLEMENTED.
- Native Node `import('@schema-baron/model')` after build: passed, both fixture
  definitions validate and the command schema is callable.
- Test source also checked directly with TypeScript strict/noUncheckedIndexedAccess/
  exactOptionalPropertyTypes and explicit `--types node`: passed. The generic
  `verify.mjs module` command omits Node types and cannot typecheck node:fs tests;
  the explicit invocation supplies that required configuration.
- `npm run lint`, `npm run check:credentials`, `npm run check:dependencies`: passed.
- Source import review: no React, Next, filesystem, SQLite, fixture-domain names or
  acceptance-specific constants in model behavior; only Zod and relative imports.

Necessary integration edit: the model bootstrap manifest lacked a build script and
exported unbuilt TypeScript; conditional source types / emitted JavaScript exports
plus a model-only build config make workspace build and native package import work.
No dependency versions or lockfile changed. Parent orchestrator was informed.

Limits: these are model/contract checks. No persistence, real query execution,
HTTP/MCP parity, SQLite migration, generated app, UI or performance acceptance is
claimed; those belong to later WPs. No native module rebuild was needed. No hosted
sync opt-in or Spec Kitty upgrade was performed. Canonical status showed WP02
in_progress with implementer-ivan and no returned review feedback in this first pass.

## Review cycle 1 repairs — 2026-10-26 America/Chicago

Acknowledged the three blocking findings in `review-feedback-1.md` and canonical
`review-cycle-1.md`; the refreshed implementation prompt was read in full. The
parent's staging clarification and corrected committed reviewer evidence make
live downstream-consumer checking N/A for this library boundary. WP03/WP04 retain
that integration ownership; no dummy consumers or later-package code was added.

Added `review-regressions.test.ts` before changing production behavior. Its first
run had six failures out of 14 cases: two scoped-global-policy exceptions, three
row-grain ORDER BY aggregates (direct, nested arithmetic, nested function), and a
future-alias JOIN ON predicate. Eight valid/other-invalid counterparts already
passed. After the fixes all 14 pass, with unchanged-input assertions retained.

- Invalid global policy scope/owner/inheritance returns object-linked diagnostics;
  effective access is derived only after the global policy is valid.
- ORDER BY aggregate flags participate in the same grain/grouping analysis as
  projections. Explicit grouped counterparts remain valid.
- Each ON predicate resolves only earlier aliases and the current right alias;
  previous outer-join nullability is retained. Valid sequential joins pass.

Observed verification after repair:

- `npm test`: 74 passed, including 63 model tests across the existing and new suites.
- `npm run typecheck` and `npm run build`: passed implemented scope, with other
  product packages still explicitly NOT IMPLEMENTED.
- Both test files strict-typechecked with explicit Node types: passed.
- Native `@schema-baron/model` ESM import after build: all three reviewer reproductions
  return the required diagnostics and all three valid counterparts pass.
- Diff-scoped lint, whitespace check, credential scan and exact-lock dependency
  metadata checks: passed. No dependency or installation changes.

These remain model-boundary checks; no SQLite compiler, storage, UI, HTTP/MCP or
later-WP integration acceptance is claimed. No planning/task file was manually
edited, no add-history/force waiver was used, and no CLI upgrade or hosted sync
change was performed.
