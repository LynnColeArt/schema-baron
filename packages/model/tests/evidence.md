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
