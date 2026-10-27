---
title: Reproduce the workspace bootstrap
status: active
audience: Contributors implementing later Schema Baron work packages
updated: 2026-10-26
---

This baseline verifies dependencies and the development harness. Studio, MCP, model,
storage, generator and UI source are not implemented in WP01. Workspace exports declare
future `src/index.ts` entry points; importing them cannot work until their owning package
adds source. No scaffold is presented as a working application.

## Prerequisites and first run

Use the exact runtime from `.nvmrc`: **Node 24.22.1**, **npm 11.19.1**. With an existing
NVM installation, run these commands from the checkout root:

```sh
nvm install
nvm use
node --version
npm --version
npm ci --ignore-scripts
npm run native:verify
npm run verify
```

If npm differs, install `npm@11.19.1` with lifecycle scripts denied before installing
workspace dependencies. `engine-strict` rejects mismatches. The official Node release
archive checksum matched the downloaded Linux x64 archive; exact checksum and source
are in `scripts/workspace/evidence/runtime.json`. Release GPG verification was not run.
An NVM banner initially displayed the previous npm version; direct invocation and the
engine check established the actual 11.19.1 pin.

[Node's schedule](https://github.com/nodejs/Release/blob/main/schedule.json) places
Node 24 in maintenance LTS from October 20, 2026 through April 2028. It is the agreed
supported line, not Active LTS. [24.22.1 is a security release](https://nodejs.org/en/blog/release/v24.22.1)
including the Brotli fix. The official index dates its artifact October 20; release notes
date publication October 21. Installed older 24.x patches and host Node 26.8.1 were not
used for verification.

Linux x64/glibc is the observed platform. The locked better-sqlite3 13.0.3 archive ships
N-API prebuilds. **No lifecycle exception or native source build is approved.** `.npmrc`
denies scripts for the entire dependency graph. `native:verify` checks the selected
prebuild and loader/configuration SHA256 hashes, then performs actual SQLite insert,
transaction and online-backup checks. No prebuild downloader runs. Unsupported platforms
fail with instructions to review a targeted source build; do not enable all scripts.
A future source build would need reviewed node-gyp, matching Node headers, Python,
make and a C++20 compiler (or the appropriate platform toolchain). Those prerequisites
and a build allowance have not been verified here.

Browser installation is explicit and separate:

```sh
npx --no-install playwright install chromium
npm run test:e2e
```

Linux browser system libraries may require `playwright install --with-deps chromium`.
No browser journey or installed browser is claimed by this bootstrap. Until real e2e
specs exist, the direct e2e command fails for missing tests; CI reports NOT IMPLEMENTED.
Later tests must start their real server through Playwright's `webServer` configuration
or an explicitly managed server, with `STUDIO_BASE_URL` identifying it.

## Workspace check contracts

There is one root lockfile. Add package-specific dependencies through root npm workspace
commands with exact versions and scripts denied; then repeat artifact/advisory/incident
review. Do not add nested lockfiles to the workspace.

`npm run typecheck` discovers real TypeScript source in each workspace and invokes its
strict tsconfig. It also checks actual bootstrap test/configuration files. A missing
workspace source produces NOT IMPLEMENTED, not a completed product check. Pure model/core
packages have no React/Next dependency; SQLite stays server-side, with Next's native
external-package configuration established for its future server adapter. Future imports
must preserve these boundaries; WP01 does not claim a bundle-boundary acceptance test.

`npm run build` requires a build script once a workspace has source, so a new application
cannot silently skip its production build. Until then it reports NOT IMPLEMENTED. Add
real `build` scripts in the owning package. Vitest discovers package/app unit tests and
contract/integration tests plus the bootstrap tests. Empty test runs fail. Playwright
uses `tests/e2e` and has no empty-suite success option.

`npm run lint` performs diff-scoped JavaScript syntax, JSON parsing and Git whitespace
checks; strict TypeScript checking is separate. Set `SCHEMA_BARON_LINT_BASE` to a verified
base revision for a committed review diff. Its local default is HEAD (working changes).
Git discovery errors fail. CI fetches history and uses the PR base or HEAD's parent.
This is syntax/whitespace lint, not a claim of a full style ruleset.

`npm run check:credentials` scans tracked/unignored files and existing Studio client
bundles for private-key/token patterns without printing matched values. It is heuristic;
future credential-specific behavior tests and export scans remain required. Public
reports must contain no local project data, passwords, capabilities or manual content.

The portable runner allocates and removes only its own temporary directory, propagating
child exit status:

```sh
node scripts/workspace/verify.mjs clean-output node /absolute/path/to/check.mjs
```

The child writes to `SCHEMA_BARON_TEST_OUTPUT`. For an actual independently generated
app, use `npm run check:generated -- /absolute/path/to/output`. This refuses workspace
paths/dependencies, copies source to fresh OS temporary storage, rejects symlinks and
nonregistry lock entries, omits installed/build output, and performs offline `npm ci`,
`typecheck`, `test`, `build` there. It cleans its temporary copy even on failure.
A temporary empty package is used only to prove this harness propagates failure; it is
not generated-app behavior evidence. There is no generated application yet.

## Dependency evidence and decisions

All evidence below is in `scripts/workspace/evidence/`:

| Artifact | Observed result / limit |
|---|---|
| `registry.json` | Exact version, integrity, official tarball, publication/first-publication/modified times, repository, maintainer names, lifecycle and provenance metadata for all 258 lock entries. |
| `audit.json` | `npm audit --json`: zero reported advisories across the installed dependency set. Not malware detection. |
| `signatures.json` | `npm audit signatures --json`: exit 0, empty invalid/missing lists. Registry records contain signatures for 258 entries and provenance references for 102; availability alone is not source-code assurance. |
| `native.json` | Shipped binaries and reviewed loader/build configuration hashes; Linux x64 executed, other platforms unexecuted. |
| `freshness.json` | Explicit acceptance of recent exact patches, including same-day magic-string and postcss. Registry signatures/advisory/incident checks and denied lifecycle reduce risk; no minimum-age bypass or safety guarantee is implied. |
| `incidents.json` | Independent vendor-list comparison and bounded hash/marker/persistence scan, including unavailable complete-list coverage. |

Collect updated metadata only after an intentional lockfile change with
`node scripts/workspace/dependencies.mjs collect` (online). Then review it and refresh
audit, signatures, native and incident/freshness decisions. Normal
`npm run check:dependencies` is offline: it rejects stale lock hashes and compares
installed names/versions against all lock entries. Platform-optionals may be absent;
required dependencies may not. Lockfile SRI is enforced by npm installation; the offline
metadata check is not a full installed-file integrity scanner.

The [StepSecurity Miasma incident table](https://www.stepsecurity.io/blog/binding-gyp-npm-supply-chain-attack-spreads-like-worm)
was fetched and parsed: 57 affected names / 286 exact pairs, zero overlaps against
258 locked artifacts. The independent scan found no matches for the retained Microsoft
ChainDrop hashes/markers and no listed persistence paths, across 16,683 files including
installed dependencies. Indicators were retained after that scan. Complete Sonatype
Guide incident lists were restricted/unavailable. This is a bounded known-incident
check, not exhaustive malware detection or host forensics.
[Import-time attacks](https://www.sonatype.com/blog/flooding-dropper-hits-npm-with-850-malicious-packages)
remain a residual risk even with lifecycle scripts denied. Reviewers accepted that
bounded uncertainty for this pinned bootstrap; no known unresolved compromise was found.

## Independent challenge and observed verification

The installed adversarial-squad skill was applied with three CLI-resolved, read-only
profiles in available-slot batches. This challenge does not replace independent WP review.

| Lens | Finding / disposition |
|---|---|
| Debugger Debbie | Git lint discovery ignored a missing mission base. Changed to checked discovery with configurable base, full CI history and a regression that requires missing-base failure. |
| Architect Alphonso | Generated-path prefix could admit an in-workspace `..name`; external paths could inherit dependencies. Changed to parent-segment checking and fresh temporary staging, symlink/local-lock rejection; regression added. |
| Reviewer Renata | Fresh release timestamps alone were not risk acceptance; incident posture was absent; native-build wording was stale. Added explicit freshness decision and bounded vendor/IoC evidence; corrected policy to zero lifecycle exceptions. |

Observed on the pinned Linux runtime, client date October 26 (UTC captures roll into
October 27): scripts-denied `npm install`, then a clean `npm ci --ignore-scripts --offline`
both succeeded; native SQLite 3.53.4 insert/transaction/backup succeeded; strict harness
and config checking succeeded; nine harness tests passed, including intentional invalid
TypeScript, child exit 17, standalone test exit 19, missing output, workspace dependency,
misleading in-root path, credential-pattern and unavailable-lint-base failures.
`npm run verify` runs the native hash/smoke, strict typecheck, diff lint, builds where
implemented, credential scan, tests and installed dependency comparison.

The host-runtime negative check (`node scripts/workspace/verify.mjs typecheck` on
26.8.1) exited 1 with the required 24.22.1 diagnostic. The installed comparison
observed **182 present / 76 platform-optional absent**. Product
builds, browser journeys, generated application functionality and full product offline
acceptance are unexecuted because their implementations belong to later WPs. CI is
configured here but no hosted CI execution is claimed.

After installation, verification tools and SQLite work offline; an observed offline
clean reinstall used a warm npm cache. A cold install, registry/advisory/signature refresh,
Node acquisition and browser/system-library installation need network access. This is
not an offline package mirror.

Use private owner-controlled directories outside source and replaceable output for
projects, databases, journals, backups and secrets; keep output separately selectable.
`.local` is ignored for private reading/reference artifacts. Do not copy archived demo
credentials, data or the copyrighted manual into source, fixtures or public evidence.
No unpublished service or manual PDF is required to reproduce this harness.
