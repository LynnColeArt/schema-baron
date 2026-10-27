# WP15 implementation evidence

Node Norris profile resolved with `spec-kitty agent profile show node-norris` and
`spec-kitty charter context --action implement --json`. The charter is absent; the
confirmed mission explicitly skips a charter gate and hosted sync opt-in. No tooling
upgrade or dependency lifecycle script was executed.

The test-first decimal suite initially failed because the implementation module was
absent. Query compiler/worker suites were also introduced before implementation. Native
source execution exposed a non-erasable TypeScript constructor and relative `.js`
resolution; these were corrected and source child processes now load erasable `.ts`
fallbacks, while production workers use built JavaScript.

Scoped observable cases include real SQLite aliased inner/outer joins, composite keys,
quoted identifiers, WHERE versus HAVING, independently computed integer decimal totals,
two-child preaggregation, zero children, typed injection values, unknown grammar/IDs,
incomplete grain tuples, dishonest cardinality/physical unique keys, cycles, invalid and
overflowing physical decimals, scaled INTEGER values beyond JS safe precision, exact
38-digit arithmetic/comparison/order, signed tie rounding, zero division, row limits,
scan-budget rejection, deadline expiry, and an actively running expensive SELECT canceled
while the parent event loop remains responsive. Both transports exercise saved and draft
preview, shape/results, malformed input, cost/timeouts, stale/forged cancellation,
idempotency and cancellation. Application database bytes remain identical. Owner shutdown
and actual built Next SIGTERM tests reopen the writer and inspect terminal canceled jobs.

Shared-file rationale: sqlite exports and its local model dependency connect the compiler
to existing canonical validation; model diagnostic enums and optional bounded timeout/
scan inputs represent real preview outcomes; worker request/dispatch adds the isolated
read task without altering write transactions; ProjectCore registration/lifecycle connects
the actual command; OwnerService awaits confirmed cancellation; harness and production
server shutdown initiate abort before waiting for HTTP requests. These additive edits
were coordinated with WP07 and approved by the root orchestrator.

Dependency install used `npm ci --ignore-scripts --offline`. Adding sqlite's existing
workspace model dependency changed only the local lock entry. A programmatic comparison
of `git show HEAD:package-lock.json` and the current lock asserted equality of all 258
external non-link package entries (including resolved URL and integrity). The existing
258 registry records and observedAt were retained; only their whole-lock SHA-256 binding
was updated. No fresh registry lookup is claimed. `npm audit --ignore-scripts --json`
reported zero vulnerabilities.

Final commands/results are recorded below after the final verification run. UI designer,
report and generated-runtime integration are future work packages; no generated app
numeric result or UI acceptance is claimed.

Final verification (Node 24.22.1 / npm 11.19.1, explicit pinned PATH):

- `npm run verify` — exit 0: reviewed native artifact/smoke on SQLite 3.53.4,
  workspace strict typechecks, diff-scoped lint (25 files), all production builds including
  real Next 16.4.3, heuristic credential scan, 20 suites / 168 tests passed, and dependency
  metadata verification (182 installed / 76 platform-optionals absent / 258 artifacts).
  The existing not-yet-implemented generator and ui packages are reported explicitly by
  the workspace verifier; this package does not claim their later work.
- `node scripts/workspace/verify.mjs module packages/sqlite/tests/query` — exit 0.
- `node scripts/workspace/verify.mjs module packages/sqlite/tests/decimal` — exit 0.
- `node scripts/workspace/verify.mjs module packages/core/src/query-preview` — exit 0.
- `npm audit --ignore-scripts --json` — zero vulnerabilities; report retained temporarily
  at `/tmp/wp15-npm-audit.json` (not a fresh registry-provenance claim).
- `spec-kitty agent tasks list-tasks --mission schema-baron-studio-01M5W3Q9 --json`
  observed WP15 `in_progress`, with no returned review-feedback reference.

The final scope contains 14 focused query/decimal cases across four suites, included in
the 168-test workspace run. Production SIGTERM and public cancellation used actual child
processes and HTTP/MCP operations, not substituted handlers. No scripts were enabled;
lock SHA-256 is `0c63551491f8eb7d1d819e68d558d86139a3d4fa26e68a8a0166bdcbb41b226a`.
