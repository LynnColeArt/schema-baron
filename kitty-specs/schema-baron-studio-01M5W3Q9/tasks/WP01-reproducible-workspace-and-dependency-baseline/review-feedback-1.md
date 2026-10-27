# WP01 independent review — changes requested

Reviewer: codex / reviewer-renata. Implementation reviewed: 7a6d51c6293a2bfbb20f54aee23954de398e63b9, at lane HEAD 8bcacde. Base/diff: `git diff kitty/mission-schema-baron-studio-01M5W3Q9..kitty/mission-schema-baron-studio-01M5W3Q9-lane-a`. Scope: WP01 only. No product fixes made.

## Blocking finding

**R1 [P1] Remove workspace executable resolution from generated-app checks.** `scripts/workspace/verify.mjs:79–80` copies `process.env` for isolated npm children and clears only `NODE_PATH`. The documented caller `npm run check:generated -- /external/output` itself prepends the workspace and ancestor `node_modules/.bin` directories to PATH. Both isolated installation and script execution retain those entries. Therefore a generated app with missing declared build/test dependencies can pass using Studio workspace tooling, violating T003 and the independent-output verification contract. Fresh temporary source staging alone does not establish isolation.

Observed reproduction on pinned Node 24.22.1/npm 11.19.1: create an external temporary package with no dependencies, a v3 root-only lockfile, and all three required scripts (`typecheck`, `test`, `build`) set to `tsc --version`; invoke `npm run check:generated -- <temporary-package>`. All three print `Version 7.0.2` and the harness exits 0. `command -v tsc` in the plain pinned shell finds no executable. A child PATH diagnostic contains this lane's `node_modules/.bin` and ancestor workspace bin directories after the isolated package bins. This is a harness probe only; it is not generated-product evidence.

Required repair: create a controlled execution environment for isolated npm children that cannot resolve workspace/ancestor package executables, while retaining explicitly selected Node/npm and necessary OS tools. Clear inherited npm execution context where it can reintroduce workspace resolution. Add a regression through the actual public `npm run check:generated` entry point: an output missing its own tool must fail even when the workspace provides that tool; a standalone output declaring and installing its own tool must succeed offline from the reviewed cache. Keep cleanup/failure propagation and denied install lifecycles intact. Update the bootstrap isolation claims to match observed behavior, then repeat relevant checks.

## Independent verification

- Clean `npm ci --ignore-scripts --offline`: exit 0, 190 packages added; warm cache, Linux x64/glibc.
- `SCHEMA_BARON_LINT_BASE=kitty/mission-schema-baron-studio-01M5W3Q9 npm run verify`: exit 0; native hash gate, actual SQLite 3.53.4 insert/transaction/online backup, strict bootstrap/config checking, diff lint, credential heuristic, nine harness tests, installed metadata comparison (182 present / 76 platform-optionals absent / 258 artifacts).
- All product workspaces correctly report NOT IMPLEMENTED; no product/browser/generated-app success is credited. Harness scripts have actual root npm/CI callers; no hidden application stub was added.
- Dependency challenge dispositions are recorded against the pinned artifact set. Freshness acceptance, zero lifecycle exceptions, bounded vendor/IoC checks and inaccessible complete Sonatype lists are explicit. Independently opened the StepSecurity and Microsoft source pages; this review does not claim exhaustive incident coverage, host forensics, or a new complete supply-chain audit.
- No hosted CI, other-platform native execution, cold-cache offline install, browser journey or generated product functionality was executed.

## Mandatory anti-pattern checklist

1. Dead code — PASS: verification/dependency/native modules are invoked by root npm commands and/or `verify all`; Vitest/Playwright/Next configuration has real CLI/typecheck consumers. Future exports are explicitly unavailable until owning WPs add source, as WP01 requires.
2. Synthetic-fixture test — PASS: harness tests execute actual CLI behavior; temporary empty-package fixtures are explicitly harness probes, not FR/product evidence.
3. Silent empty return — PASS: traversal exclusion/regular-file filters intentionally return empty arrays; no swallowed runtime failures found.
4. FR coverage — N/A: no FR identifiers in WP01 requirement_refs. Scoped C/NFR foundation proof was exercised; full product NFR acceptance remains unimplemented. T003 isolation fails as R1 records.
5. Frozen surface — PASS: changed paths stay in WP01's declared ownership; archived experiments/reference payloads/contracts remain untouched.
6. Locked decision — PASS: no newly introduced forbidden product target, automatic lifecycle exception, credential fixture, alternate persistence path or schema-specific product logic found. Independent-output acceptance fails under R1.
7. Shared-file ownership — N/A: generated topology assigns WP01 alone to lane-a; no shared product-source modification identified in this review diff.
8. Production fragility — PASS: bootstrap throws are explicit fail-loud diagnostics for invalid runtime, missing tools, unsafe output or failed subprocesses; no request/worker transient-race handler introduced.

Verdict: REJECT. T003 remains unmet despite the passing current suite. Re-review the repaired harness before advancing dependent WP02; the orchestrator has been notified.
