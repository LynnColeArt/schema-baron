---
affected_files: []
cycle_number: 2
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T04:53:59Z'
reviewer_agent: reviewer-renata
wp_id: WP15
---

# WP15 independent review cycle 2 — changes requested

Reviewer: codex / reviewer-renata. Source repair: 9f0b1d75a6f8fa8b943f265139be063a6012cbbe. Original package source: 7d85f26d41cbfd68877a7831218616433790973e; dependency baseline remains approved WP06 repair 45fb008. Work limited to lane-o; no WP07 work inspected or changed.

## P2 — Left uniqueness checks count repeated prefix rows as different left entities

Affected code: packages/sqlite/src/query/index.ts:108, using prefix assembled at lines 101–109.

The new leftUnique check for one-to-one/one-to-many counts the entire previous join prefix. An earlier legitimate one-to-many join repeats a left source entity. Those repeated intermediate rows are then incorrectly counted as distinct left entities when checking a later pairwise join, rejecting a valid query with INVALID_QUERY_GRAIN.

This is distinct from the documented conservative rule that a containing WHERE does not weaken a cardinality declaration. This reproduction has no WHERE, aggregation, decimal normalization, collation ambiguity, nullable key or forged index. The canonical Join explicitly names leftAlias p and rightAlias l. The parent-to-lookup relation is one-to-one even though the query's existing parent/detail prefix has two rows for that same parent.

Exact physical setup:

```sql
CREATE TABLE parent(id INTEGER PRIMARY KEY);
CREATE TABLE detail(id INTEGER PRIMARY KEY,pid INTEGER NOT NULL);
CREATE TABLE lookup(id INTEGER PRIMARY KEY);
INSERT INTO parent VALUES(1);
INSERT INTO detail VALUES(101,1),(102,1);
INSERT INTO lookup VALUES(1);
```

Canonical query:
- sources p = parent, d = detail, l = lookup; integer columns, nonnullable, actual primary keys;
- first join: leftAlias p, rightAlias d, inner, one-to-many, ON p.id = d.pid;
- second join: leftAlias p, rightAlias l, inner, one-to-one, ON p.id = l.id;
- project d.id as outid, ORDER BY d.id ASC, grain {strategy:'rows',keys:[]}; no parameters/groupBy/WHERE/HAVING.

Canonical compileQuery accepts the AST, and public project.batch accepts/persists this saved query. Independent raw SQLite SQL:

```sql
SELECT d.id AS outid
FROM parent AS p JOIN detail AS d ON p.id=d.pid
JOIN lookup AS l ON p.id=l.id ORDER BY d.id;
```

returns [{outid:101},{outid:102}]. Both cardinality claims are true. The compiler's last counterexample check instead effectively executes:

```sql
SELECT 1 FROM lookup AS l
WHERE (SELECT count(*) FROM (
  SELECT 1 FROM parent AS p
  INNER JOIN detail AS d ON p.id=d.pid
  WHERE p.id=l.id LIMIT 2
)) > 1 LIMIT 1;
```

It counts two prefix rows representing parent 1 twice and incorrectly reports a violation. Saved HTTP, draft HTTP, fresh MCP query_preview and request replay all return INVALID_QUERY_GRAIN. Database bytes stay unchanged. The public model batch succeeds at revision 3, so this is a production execution regression rather than unsupported/invalid AST input.

Runnable independent evidence, outside kitty-specs:
- /tmp/wp15-cycle2-valid-chain.mjs and /tmp/wp15-cycle2-valid-chain.jsonl (package path, independent raw SQL oracle, emitted checks).
- /tmp/wp15-cycle2-valid-chain-public.mjs and /tmp/wp15-cycle2-valid-chain-public.jsonl (public creation/binding/batch, saved and draft HTTP, fresh/replayed MCP, unchanged database bytes).
Run either script from the review lane with PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH node <script>.

Repair acceptance: distinguish genuinely different left source entities from repeated appearances of the same left entity caused by earlier valid expansions when proving the declared leftAlias/rightAlias cardinality. Retain the full actual ON semantics and the cycle-1 guards against decimal normalization, affinity, collation, composite-key collisions and real reverse-side multiplicity. Do not weaken the guard to make the original wrong-total case pass, and do not require relabeling a genuine one-to-one parent/lookup relation as many-to-one merely to bypass the erroneous count. Add regression evidence for this valid chain, plus the analogous later one-to-many case, and continue rejecting genuinely distinct left entities that collide under logical equality. No specific algorithm is mandated.

This blocks FR-018/T071/T075 support for valid aliased joins and rows-grain query execution. The diagnostic's suggested child preaggregation is unnecessary for this valid row query.

## Original finding disposition and independent checks

The cycle-1 wrong-money finding IS FIXED in the tested repair. The unchanged original reviewer scripts now return INVALID_QUERY_GRAIN rather than ok:true/40.00 through the documented package path, saved/draft HTTP and fresh MCP. Original script checksum checks pass; no expectation was edited to manufacture a pass. Outputs: /tmp/wp15-cycle2-original-probe.log and /tmp/wp15-cycle2-original-public.jsonl.

Checks independently run with Node 24.22.1:
- npm test -- packages/sqlite/tests/query packages/sqlite/tests/decimal packages/core/tests: exit 0, 9 suites / 45 tests. This includes all 13 new grain cases, proof timeout/cancel, positive canonical/scaled/composite keys, operand-order-sensitive collation, grouped child sources retaining equal amounts (20.00), public parity, existing live worker cancellation and actual built production Next SIGTERM/reopen behavior.
- npm run typecheck: exit 0. Existing generator/ui not-implemented notices remain explicit.
- Original /tmp/wp15-independent-arithmetic.mjs: compiled SQLite aggregate expression composition, sum/avg/min/max, fractional/negative/null data, empty coalesce and 36 separate decimal.js oracle comparisons still pass. Output /tmp/wp15-cycle2-original-arithmetic.jsonl.
- New /tmp/wp15-cycle2-snapshot.mjs: real concurrent WAL writer inserted an equivalent decimal child key while the 300-parent preview was active. It completed after ~1548 ms with the original valid 10.00 sample and truncated:true, although the write had committed before return; the next preview rejected the new collision with INVALID_QUERY_GRAIN. This independently supports proof/result snapshot consistency. Output /tmp/wp15-cycle2-snapshot.jsonl. An initial 1000-parent version reached the normal 5-second TIMEOUT; it was reduced to 300 to observe a successful snapshot without relaxing the deadline. That timeout was not a product failure or claimed snapshot proof.
- Read the entire renewed prompt and repair diff plus updated README/EVIDENCE. The repair leaves registration/lifecycle/model/dependencies unchanged. Actual shared worker classification/static error-message changes are minimal, authorized and documented. New grainChecks has live compiler→worker execution callers.
- Product package/apps/fixtures/lock/evidence files are unchanged from source 9f0b1d7 after review. Reviewer changed no product code. Full verify/build/audit were read from implementer evidence, not independently rerun wholesale; relevant strict types, real production test, proof tests and independent probes were rerun. No later UI/report/generated-runtime acceptance is claimed. Python no_coverage advisory is not passing evidence or a blocker.

## Eight-item anti-pattern checklist

1. Dead code — PASS. grainChecks is generated by compileQuery and consumed in the live worker executeQueryPreview path. Existing query/decimal/core modules retain live callers and legitimate portable API exports.
2. Synthetic-fixture tests — PASS. Tests execute production compiler, SQLite workers, public command adapters and actual built Next; independent probes use public package/transport interfaces and real DBs.
3. Silent empty return — PASS. A check's absent result means no multiplicity counterexample; the result is used explicitly. Empty samples/null aggregates retain documented semantics; failures are explicit.
4. FR coverage — PASS for WP-scoped assertions (C-007, FR-018, FR-020, NFR-004, NFR-009); the new independent valid-chain regression demonstrates a missing edge despite the green suite. Overall correctness remains rejected.
5. Frozen surface — N/A. No applicable frozen-file prohibition; no dependency/lock/registry changes in the repair.
6. Locked decision — PASS. Original silent fanout prohibition is now enforced across tested comparison variants. The separate valid-query regression is the P2 above, not the documented conservative pre-WHERE proof scope.
7. Shared-file ownership — PASS. The two shared SQLite worker classification/error-message changes were root-authorized and documented in EVIDENCE.md; no other registration/lifecycle/model/ownership changes in the repair.
8. Production fragility — FAIL. The newly added fail-loud multiplicity check fires on legitimate repeated appearances of one left entity after an earlier expansion, rejecting valid production queries. The fail-closed rationale is sound, but its predicate is incorrect for declared pairwise source cardinality. See P2.

Verdict: rejected with one narrow new regression. Preserve the successful original semantic-collision repair.
