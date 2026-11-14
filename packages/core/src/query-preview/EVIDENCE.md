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

## Review cycle 1 — semantic join grain repair

Read the full renewed execution prompt, re-resolved Node Norris, and read canonical
`review-cycle-1.md` plus `/tmp/wp15-review-feedback-renata.md`. Canonical rejection event
`01M5XTEP5GD7RC1ZSJRA5FX94D` identifies the single P1: a physical decimal TEXT primary
key can contain numerically equivalent strings. `sb_compare` equates them, so two
purported many-to-one joins returned `40.00` for one `10.00` parent.

Before changing production code, the unchanged reviewer probes reproduced the old
result through the package interface, saved/draft HTTP, and a fresh MCP execution.
Outputs: `/tmp/wp15-cycle2-before-probe.jsonl` and
`/tmp/wp15-cycle2-before-public.jsonl`. Seven desired new regression tests failed with
successful wrong totals (including negative/signed-zero decimal keys, a single join,
SQLite affinity and collation). Two positive preaggregation/encoding cases passed.

The static complete-key proof is now provisional. The compiler emits counterexample
checks for every inferred nonexpanding join, and for the left side of claimed
one-to-one/one-to-many joins. Checks reuse exactly the same source subqueries, named
bindings, operand order and full ON expression as execution. They examine every
relevant row before the preview LIMIT; counting stops after a second match. The existing
SQLite worker transaction encloses physical inspection, budget checks, semantic checks
and result execution, preserving one read snapshot. Semantic-check work shares worker
timeout/cancellation and the physical source-row budget. Containing WHERE filters do not
weaken declared cardinality; source-subquery WHERE/HAVING and parameters remain intact.
A counterexample returns actionable `INVALID_QUERY_GRAIN`, with no result rows or
application-data mutations. No DISTINCT monetary workaround or decimal semantic change
was introduced.

The root authorized two minimal shared transport corrections: allow the existing
`INVALID_QUERY_GRAIN` code through worker error classification, and supply its static
safe recovery message in SQLiteError. No registration, lifecycle, model, dependency,
WP07, or ownership-glob changes were made in this repair.

The new 13-case real-SQLite suite passes: positive/negative/signed-zero collisions,
single-join inflation, native affinity/collation collisions, composite collision beyond
the first sampled group, left one-to-one uniqueness, operand-order-sensitive valid
collation, canonical TEXT/scaled INTEGER/composite valid joins, normalized grouped child
queries that retain two equal parent amounts (`20.00`), proof timeout/cancellation, and
public saved/draft HTTP plus fresh/replayed MCP rejection with unchanged database bytes.

Unchanged reviewer probes now return `INVALID_QUERY_GRAIN` through every tested route,
with HTTP/MCP parity and unchanged DB bytes; outputs are
`/tmp/wp15-cycle2-after-probe.txt` and `/tmp/wp15-cycle2-after-public.jsonl`.
`sha256sum --check /tmp/wp15-cycle2-probe-checksums.txt` confirms both original probe
scripts remained unchanged. The original reviewer expectation is retained, not edited
into a pass assertion. Re-running the independent arithmetic probe produced matching
aggregate/average/min/max/composition/empty results and all 36 decimal.js oracle cases
(`/tmp/wp15-cycle2-arithmetic.jsonl`).

Cycle 1 repair final verification, using pinned Node 24.22.1 / npm 11.19.1:

- `npm run verify` — exit 0: SQLite 3.53.4 native smoke, strict workspace types,
  diff-scoped lint, all production builds including Next, credential heuristic scan,
  21 suites / 181 tests passed, unchanged 258-artifact dependency verification.
- `node scripts/workspace/verify.mjs module packages/sqlite/tests/query` — exit 0.
- `node scripts/workspace/verify.mjs module packages/sqlite/src/query` — exit 0.
- `node scripts/workspace/verify.mjs module packages/sqlite/tests/decimal` — exit 0.
- `npm audit --ignore-scripts --json` — exit 0, zero vulnerabilities; transient output
  `/tmp/wp15-cycle2-audit.json`. No dependency or lock/evidence changes in the repair.

Existing future generator/ui implementation notices remain explicit; no generated runtime
or UI numeric acceptance is claimed. The known Python coverage-authority advisory is not
product verification. The repair adds only query proof/runtime checks, behavior tests,
API explanation, this evidence, and the two approved shared diagnostic transport lines.

## Review cycle 2 — pairwise left-alias identity repair

Read the renewed full execution prompt, re-resolved Node Norris, and read canonical
`review-cycle-2.md` plus `/tmp/wp15-cycle2-review-feedback-renata.md`. Rejection event
`01M5XVAK5SBM2JPNZPQ52Z3VNB` identifies one P2 regression: the reverse-side uniqueness
check counted repeated prefix appearances of the same declared leftAlias entity after
an earlier valid expansion, rejecting p→detail one-to-many followed by p→lookup
one-to-one (and the analogous later one-to-many case).

The unchanged package/public valid-chain probes reproduced `INVALID_QUERY_GRAIN` before
the repair (`/tmp/wp15-cycle3-before-chain.jsonl`,
`/tmp/wp15-cycle3-before-public.jsonl`). Test-first desired behavior produced eight
failures for valid chains/grouped/composite/nullable cases, while two real semantic
collision controls already passed. No existing reviewer scripts or expectations changed.

The compiler now retains the specific complete key tuple establishing left uniqueness.
Reverse checks group matching prefix appearances by that declared alias's raw key tuple,
with explicit BINARY collation, before counting source entities. They do not group by
normalized decimal identity, the whole prefix, or an unrelated nullable unique key.
Grouped query sources use their declared grain tuple; a global aggregate has one entity.
Every nullable identity component must be a required direct ON equality, so NULL tuples
cannot match; an expression such as coalesce(NULL,0) without a direct complete key proof
is rejected rather than guessed. Tuple components remain separate SQL expressions.

Full source subqueries, actual ON operand order/normalization/collation, bindings,
pre-LIMIT checks, and the same read transaction/cost/deadline/cancellation remain intact.
No result SQL, aggregate semantics, worker registration/lifecycle, dependencies, shared
files or WP07 code changed. In particular, no monetary SUM DISTINCT workaround exists.

Eleven new real-SQLite cases now pass: earlier expansion followed by one-to-one or
one-to-many, full composite identity, grouped/global source identity, nullable unique
matching/nonproof behavior, real decimal, composite-second-component and collated distinct-entity collisions after
prior appearances, and saved/draft HTTP plus fresh/replayed MCP parity for both valid
chain shapes. Results equal independent raw SQL; app database bytes remain unchanged.
All thirteen prior semantic grain regressions also pass.

The unchanged valid-chain reviewer probes now return detail IDs 101/102 through package,
saved/draft HTTP and fresh/replayed MCP. Outputs:
`/tmp/wp15-cycle3-after-chain.jsonl`, `/tmp/wp15-cycle3-after-public.jsonl`.
`sha256sum --check /tmp/wp15-cycle3-probe-checksums.txt` passed for those scripts, the
snapshot script, and the original wrong-money package/public scripts. The latter still
return `INVALID_QUERY_GRAIN` (`/tmp/wp15-cycle3-original-probe.txt`,
`/tmp/wp15-cycle3-original-public.jsonl`). Independent arithmetic composition/empty
behavior and all 36 decimal.js oracle comparisons still pass
(`/tmp/wp15-cycle3-arithmetic.jsonl`).

The unchanged concurrent WAL snapshot probe also passed: its external write committed
before the approximately 1948 ms preview returned the original `10.00` sample with
truncated:true; the next preview rejected the new collision (`INVALID_QUERY_GRAIN`).
Output `/tmp/wp15-cycle3-snapshot.jsonl`. No timing budget was relaxed.

Cycle 2 repair final verification (pinned Node 24.22.1 / npm 11.19.1):

- `npm run verify` — exit 0: native SQLite 3.53.4 smoke, strict workspace typechecks,
  diff lint, all production builds including Next, credential heuristic scan,
  22 suites / 192 tests passed, unchanged 258-artifact dependency verification.
- `node scripts/workspace/verify.mjs module packages/sqlite/tests/query` — exit 0,
  including the final complete-composite-identity collision control.
- `node scripts/workspace/verify.mjs module packages/sqlite/src/query` — exit 0.
- `node scripts/workspace/verify.mjs module packages/sqlite/tests/decimal` — exit 0.
- `npm audit --ignore-scripts --json` — exit 0, zero vulnerabilities; output
  `/tmp/wp15-cycle3-audit.json`. No dependency/lock/evidence refresh was needed.

The existing future generator/ui notices remain explicit. No later UI/report/generated
runtime acceptance or Python coverage-authority pass is claimed. The repair touches
only the owned compiler, chain tests, README and this chronological evidence.
