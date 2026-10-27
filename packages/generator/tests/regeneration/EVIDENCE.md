---
status: observed
work_package: WP20
mission: schema-baron-studio-01M5W3Q9
observed_date: 2026-10-27
---

# Regeneration ownership and recovery

Baseline: approved combined integration `414e1c4c245070b48b305185945a6cc9759aece4`.
Environment: Linux x86_64, Node 24.22.1, npm 11.19.1, SQLite 3.53.4, pinned Next 16.4.3 and Playwright Chromium. No dependencies or lifecycle-script opt-ins were added.

## Observed commands and boundaries

- `VITEST_MAX_WORKERS=2 npm run verify`: workspace native SQLite smoke, strict typechecks, scoped syntax/JSON/diff lint, production builds, credential heuristic scan, tests and installed/lock dependency verification. Initial source `99822a0` output is retained beside this file: all 386 tests in 54 files passed, along with type/build/native/lint/credentials/dependency checks. The 35 focused generation checks passed separately after the output revision correction. An earlier default-worker run passed 383 cases but hit the existing migration namespace 30-second timeout and a query preview that truthfully succeeded before cancellation. No product timing change was made; that verification used two workers, matching the approved integration baseline. Review-cycle verification after the compiler correction is recorded below; the original 386-test/browser/Next production proof was not rerun for that narrow correction.
- `npx vitest run packages/generator/tests/regeneration/commands.test.ts`: eight public-command scenarios passed. They cover two source changes/regenerations, exact custom bytes, independent SQLite oracle, stale source/hash writes, owner/path rejection, unknown/modified/link preservation, exact deletion acknowledgements, incompatible/removed interfaces, row-only external edits, in-output DB rebinding refusal, original durable retry after interrupted promotion and a later model edit, and nonempty real migration history preservation.
- `npx playwright test tests/e2e/regeneration/workflow.spec.ts`: visible project creation, connection inspection, linked Grid/Record and Search wizard, Code declaration/editing of validator/action/service/event modules, Data Properties action binding, two visible form edits and two generation preview/apply cycles. MCP `extension.read` returned the same exact edited bytes. A real dependency install and production build preceded regeneration; no shell cleanup repaired the output.
- Generated `npm run typecheck` passed before the first Next build. The pinned Next bootstrap sources `next-env.d.ts` and `tsconfig.json` were byte-identical before/after that build. Emission includes Next's known stable bootstrap configuration up front; build-info lives explicitly inside `.next/cache`. Arbitrary edits to either owned file still conflict.
- `node scripts/workspace/verify.mjs generated OUTPUT`: isolated independently installed output passed strict typecheck, tests and production build without workspace resolution. The browser then stopped Studio, independently installed/built/started the retained app, observed all four handwritten hook failures, verified unchanged rows after each failure, and completed save/Cancel/create/delete/search plus direct CSRF rejection. The event failure occurs after SQL writes inside the transaction and rolls them back.
- Nine native Node processes exit at stage-complete, before/after journal creation, before/after old-tree rename, before/after new-tree rename, and before/after journal removal. Restart recovery yields complete old or complete new source. Real external SQLite bytes and independently queried rows remain unchanged at every boundary; old source remains in the backup. Changed backup content refuses recovery and stays untouched.
- `npm audit --offline --ignore-scripts --audit-level=high` reported zero vulnerabilities. This is an offline observation, not a claim of freshly fetched advisories.

`tests/e2e/regeneration/evidence.json` records the retained standalone root, separate Python SQLite final oracle and identical SHA-256 hashes for all four handwritten modules across active output and both recovery backups. Screenshots show actual loaded read-only source and the independent application. Private owner/MCP configuration stays in disposable `/tmp` roots and is excluded from the commit.

## Ownership and conflict policy

The deterministic manifest records model hash, exact generator artifact hash, owned file hashes and authored interface declarations; plan/request/journal identity stays outside owned source. Core metadata independently records manifest authority and a monotonic outputTreeRevision distinct from model revision. Each successful plan advances that counter once; Code-only regeneration advances it, while identical/recovered retries retain the original counter. No counter enters deterministic owned source. A copied lookalike tree or edited manifest cannot acquire authority through preview.

Every entry is classified. Unknown files, links, special entries, empty unknown directories, missing/modified owned source and incompatible/removed authored declarations block apply. Preserve/move custom work outside replaceable output and restore reviewed source, then take a fresh preview. Acknowledgement never overrides conflicts. Deleted routes require exact reviewed deletion acknowledgement; the complete previous tree is retained.

Only manifest-declared `node_modules` and `.next` namespaces are rebuildable runtime artifacts. Preview discloses removal from active output and requires acknowledgement. They remain in the recoverable old tree; they are never followed or copied into the stage. Install/build remains an explicit owner action. Unknown root secrets/data are conflicts. The bound database and adjacent identity store must be outside active output and generated staging/backup namespaces, including after rebind and before interrupted-promotion recovery. The added regression first reproduced a rebound `.next/data.sqlite` being moved out of its stable locator; running the existing locator check before recovery prevents that move. The failing-before output is retained for review. Row-only changes remain legitimate live data; schema/file identity/locator changes invalidate apply.

## Authored interface v1

Only unique declared `authored/name.ts` paths are writable, using `extension.write` with the current expected hash. `source.read` exposes reviewed owned source and has no write counterpart. Code mode uses these owner commands; failed saves retain the source buffer.

Each module exports `contractVersion = 1 as const` and one typed synchronous function: validator `validate`, action `execute`, service `beforeWrite`, event `afterWrite`. Validators return declared field errors. Action hooks bind through `extensionHookRef`; validator/service/event declarations apply to Record writes. Built-in parameter/key/field validation precedes hooks. Existing HTTP/server-action authorization and CSRF guards still run before reads or hook entry. Cancel returns before hooks and writes.

Validators execute before writes; services and the bound action execute immediately before persistence; events execute after persistence inside the same SQLite transaction. A throw or incompatible async return prevents confirmation and rolls back SQL. V1 hooks must avoid external side effects because SQLite cannot roll those back. Built-in typed returns and declared destinations remain authoritative.

## Promotion and lifecycle

Linux, GNU mv 9.4+ and procfs remain the supported boundary, reusing WP10 exclusive staging authority. Complete source is staged on the same filesystem; file/directory handles reject links; journal/tree hashes permit exact recovery. Old trees remain as `.schema-baron-backup-*` siblings for owner recovery. Pre-journal failures may leave a complete unreferenced staging sibling; active source remains intact. Recovery never deletes an unexplained tree. Core requires a durable canonical intent and exact reviewed plan before recovering a journal; it reconciles original committed outcomes before later previews, including retry after a later model edit.

`CoreOptions.runtimeLifecycle` accepts exported `RuntimeLifecyclePort.stopForPromotion({projectId, outputPath})`, returning `stopped` or `unmanaged`. Core awaits the provider, then rechecks source, project and database authority before promotion. A refusal leaves active output intact. Before WP21 there is no managed runtime; the absent provider represents that state.

**Future WP21 checkpoint remains unexecuted:** wire the real process manager to this port; run a managed generated child, regenerate, and prove its process group exited before old-tree rename; prove a failed stop blocks promotion; prove build/start/cancel status and Live Page select the new revision. Focused port tests are not evidence of that future integration.

## Necessary shared integration rationale

- Model schemas add service/event kinds and typed read-only `source.read`; adapters discover the same registry schemas automatically.
- Core generation/project registration connect ownership, extension editing, canonical operation recovery and lifecycle to actual commands.
- Generator exports/IR/compiler/base emitter and Record service emit and execute hooks while retaining auth, typed validation, cancellation and document rendering.
- Workspace/document-mode integration supplies Code editing; generation UI renders conflicts/operations and exact acknowledgements; action Properties offers executable action-kind hooks.
- The older WP10 nonempty-output refusal expectation now asserts unchanged-source preview. Its schema/file drift, row-only edit, initial authority and retry tests remain active.

## Review cycle 1 — unsupported action-hook binding correction

Review event `01M5YG156VAC008BWDS9WCAADZ` requested an Action-linked unsupported-capability diagnostic when a hook has no emitted runtime consumer. The held-out Grid navigation binding was accepted by the original compiler and silently omitted by navigation output.

The compiler now checks every declared `extensionHookRef` before form-specific emission. Only Record insert/update/delete/extension paths accept action v1 bindings. Unsupported Grid, Search, Login/logout and Record read/navigation/Cancel bindings fail with `UNSUPPORTED_SCHEMA_OBJECT`, the Action ID, `field: extensionHookRef`, and explicit removal/rebinding guidance. The existing kind check is centralized in that pass, including Login actions. Cancel retains its early no-hook/no-write return. The Properties selector offers new action hooks only for supported operations; a preexisting unsupported binding remains visibly labeled and can be intentionally changed to None rather than silently cleared.

Observed verification after correction:

- Production generator build and all workspace typechecks passed.
- `VITEST_MAX_WORKERS=2 npx vitest run packages/generator/tests/regeneration packages/generator/tests/public-list/behavior.test.ts packages/generator/tests/record/behavior.test.ts`: 70 tests in 6 files passed. This includes the prior 35 preservation/recovery checks, 5 Record checks, 29 unsupported form/operation binding cases using the production package's compile/emission pipeline, and an independently installed emitted-output execution test.
- The output test uses ordinary Grid+Record output, installs with `npm ci --ignore-scripts --offline`, and passes generated strict typecheck before running the real emitted Record service in a native Node child. It executes insert/update/delete/extension paths, proves each applicable validator/service/action/event invocation and order, injects each hook failure and checks independent SQLite rows remain unchanged with no success location/confirmation, then proves successful persistence and Cancel's complete absence of hooks/writes.
- Diff/JSON/whitespace lint passed. No runtime templates, authorization, cancellation, promotion/ownership authority, dependencies or installed-script policy changed. No new hook runtime was introduced.

These shared edits are limited to authoritative compiler validation and the existing Properties hook selector; they directly address the reviewed mismatch. The prior full/browser/production-build evidence remains historical evidence for `99822a0`, not a claim of a fresh full/browser rerun. Actual WP21 managed-process stopping remains pending as documented above. A separate bare Record-only/no-Grid output was confirmed through public create/inspect/bind/batch/form.construct/generation commands: generated `server/record-action-0.ts(18,45)` fails with TS2339, `parameter` does not exist on `never`. The smallest public repro is retained at `/tmp/wp20-bare-record-repro.mjs`, observed result at `/tmp/wp20-bare-record-observed.json`, and exact generated source/typecheck output at `/tmp/wp20-bare-record-SCVNCM/output/app` and `/tmp/wp20-bare-record-SCVNCM/typecheck.txt`. Root carries this real supported-output gap into WP21 runtime/build integration or generality acceptance; it requires a fix/regression before whole-app completion and is not waived by this narrow hook correction.
