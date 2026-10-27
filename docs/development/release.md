# Supported setup and release verification

Audience: Linux contributors and independent reviewers who need to run Studio and inspect both generated applications from tracked source. Supported observed environment: Linux x64/glibc, Node **24.22.1**, npm **11.19.1**, SQLite **3.53.4** in better-sqlite3 **13.0.3**, Next **16.4.3**, React **19.3.1**, TypeScript **7.0.2**. Exact transitive artifacts are in the root and output lockfiles and registry evidence. Node 24 is in maintenance LTS as recorded in `scripts/workspace/evidence/runtime.json`; there is no claim of Active LTS or other-platform verification.

## Install and start

Acquire Node using `.nvmrc` or the official Linux archive and verify its checksum against `scripts/workspace/evidence/runtime.json`. The original capture verified TLS checksum agreement, not release GPG signatures. Select that Node on PATH and install npm 11.19.1 with `--ignore-scripts` if necessary. Cold runtime/package/browser acquisition requires network.

```sh
node --version
npm --version
npm ci --ignore-scripts
npm run native:verify
npm run typecheck
npm run build
```

`.npmrc` denies lifecycle execution throughout the graph. The SQLite package ships the reviewed N-API prebuild; native:verify verifies its loader/binary hashes and executes real insert/transaction/online-backup checks. There is no approved node-gyp/download/source-build exception. Unsupported native platforms fail with a diagnostic; do not enable every script. See [bootstrap evidence and policy](bootstrap.md) for the original dependency review.

Create private existing approved definition/output directories and a separate metadata directory, then create a mode-0600 owner JSON outside the source tree using the [owner-service configuration](operations.md). Generate a random capability locally; never use a demo/default value. Build before starting the owner or MCP because they consume compiled workspace modules.

```sh
SCHEMA_BARON_OWNER_CONFIG=/absolute/private/owner.json PORT=4317 npm start --workspace @schema-baron/studio
```

Open the reported `http://127.0.0.1:4317` and use the masked owner-connect dialog. Browser session exchange clears the capability and retains an HttpOnly cookie with transient CSRF proof. Do not put the capability in a URL or public environment. Create/open a project and follow the [author guide](../user-guide/index.md). The optional stdio MCP executable forwards to this same owner; its private connection file and direct Node invocation are in operations.md. No hosted account or unpublished service is required.

Install browser tooling separately for acceptance:

```sh
npx --no-install playwright install chromium
```

Linux browser system libraries are prerequisites. Install them through your platform package manager or an explicitly reviewed Playwright `install-deps chromium`; npm lifecycle policy does not automatically grant system package installation. The release runner requires `git`, `tar`, `strace`, `unshare`, `/usr/sbin/ip`, `curl` and permission for user/network namespaces. Python 3 is optional for the protected visitor prompt. Axe **4.11.0** is a pinned root test-only devDependency resolved from the installed package; it is not a production output prerequisite. An explicit `AXE_SOURCE` override must name a reviewed compatible asset, never a hidden private default.

## Reproduce both applications

The strongest automated procedure is:

```sh
node scripts/release/verify.mjs /absolute/new/private-release-proof
```

The directory must not exist and must be outside the checkout. Run from a committed checkout: the runner archives **HEAD**, initializes a separate source Git repository for checks that need Git, acquires its own official checksummed Node and pinned npm, uses a new HOME/cache/toolchain/browser location, installs scripts-denied workspace dependencies, and builds Studio. It never copies an old model, database, node_modules or build directory.

Before disconnected tests, it explicitly installs dependencies from the generated target's published lock template into a disposable acquisition directory. This populates the new cache with output-only packages such as server-only 0.0.1. For the same explicit cache preparation outside the complete runner, run `node scripts/release/acquire-output.mjs`. That step is dependency acquisition, not a generated fixture or an output behavior claim. It then performs an offline workspace reinstall and the fresh Equipment → Publication browser procedures. The test source follows the visible published workflow from a blank project, including schema, forms, policies, query/report, authored Code, two regenerations, data checks, public/private visitor interactions and export. Publication reopens the **fresh** Equipment study through the same owner configuration and additional explicit roots to test project isolation.

These phases run in separate `unshare -Urn` namespaces with loopback enabled and no external route. A failed external registry probe and connect syscall traces record the actual network boundary. The runner refuses namespace failure; it does not describe ordinary online execution as blocked-network proof. Browser/package acquisition is deliberately outside this phase. All child setup/builds are awaited; no in-process HTTP owner is blocked by synchronous dependency installation.

For manual bounded runs after installation/build, choose run-specific absolute paths (the parent directory must exist):

```sh
export SCHEMA_BARON_EQUIPMENT_STUDY=/absolute/private/run/equipment.json
export SCHEMA_BARON_PUBLICATION_STUDY=/absolute/private/run/publication.json
npx --no-install playwright test tests/e2e/equipment --workers=1 --retries=0 --output=/absolute/private/run/equipment-evidence
npx --no-install playwright test tests/e2e/publication/workflow.spec.ts --workers=1 --retries=0 --output=/absolute/private/run/publication-evidence
```

The Equipment test stops its owner before Publication starts. Publication refuses a missing prerequisite instead of finding a developer's retained project. Each location JSON names the new private study root; it contains no capability. The private owner config and business/identity databases stay outside Git. Set `SCHEMA_BARON_PUBLICATION_EVIDENCE` to the actual Publication test's output subdirectory containing `expected-authored.json`, then run `node tests/e2e/publication/portable.mjs` after its owner has stopped. Evidence paths are explicit and must refer to this run, not archived reports.

The Equipment journey itself installs/types/tests/builds/runs its portable app with Studio unreachable. Publication's portable helper performs the equivalent independent checks. Use [portable output](../user-guide/portable-output.md) for manual install/run and protected stdin visitor provisioning. Default export excludes database/identity/secrets; include-data is an explicit online backup and is refused for mapped identity. No account is created by generation or export.

## Final checks and artifact discipline

```sh
npm test -- --maxWorkers=2
npm run typecheck
npm run build
npm run native:verify
npm run check:dependencies
npm run check:credentials
SCHEMA_BARON_LINT_BASE=YOUR_VERIFIED_PREIMPLEMENTATION_COMMIT npm run lint
npx --no-install playwright test tests/e2e/usability --workers=1 --retries=0
```

Strict acceptance-source checks use `node scripts/workspace/verify.mjs module tests/integration/clean-install` and `node node_modules/typescript/bin/tsc --project tests/performance/tsconfig.json`; check affected e2e/contracts with explicit Node/DOM types when outside those configs. `lint` is syntax/JSON/whitespace checking, not a complete style analyzer. Credential scans are heuristic; actual acceptance additionally compares ephemeral credentials against retained evidence/model/client bytes without logging them.

`@schema-baron/ui` is an unused source-less scaffold with no product consumers. Aggregate type/build checks honestly print NOT IMPLEMENTED for that package. The Studio UI is implemented under `apps/studio`; inventing imports to make the scaffold look complete would add no product functionality. The Python `tests.architectural._gate_coverage` module is unavailable: architectural coverage is **no_coverage / unverified**, not passed. No hosted CI run, hosted sign-in, charter generation, push, merge or deployment follows from these local checks.

Keep private live studies, identity stores, config, backup data, unredacted trace payloads and the manual PDF/derivatives outside public evidence. Preserve dated reports as historical observations; their literal old paths are not current prerequisites. Only stop process groups owned by this run. The earlier experiment and original Equipment/Publication studies must remain untouched.

## Observed readiness

See the [requirement reconciliation](../user-guide/readiness.md) and `scripts/release/evidence/` for source revisions, exact commands, failed attempts, final results and remaining boundaries. Planned acceptance tables do not become executed simply because their work packages were approved. Mission accept/consolidate, independent post-merge review, retrospective and a later draft PR remain the orchestrator's workflow; this package does not publish the application.
