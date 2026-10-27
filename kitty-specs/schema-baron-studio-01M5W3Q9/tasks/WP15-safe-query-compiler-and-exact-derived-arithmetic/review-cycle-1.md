---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T04:38:45Z'
reviewer_agent: reviewer-renata
wp_id: WP15
---

# WP15 independent review — changes requested

Reviewer: codex / reviewer-renata. Source: 7d85f26d41cbfd68877a7831218616433790973e.
Review lane: schema-baron-studio-01M5W3Q9-lane-o. Dependency baseline: approved WP06 repair 45fb008 (not all upstream work).

## P1 — Physical decimal TEXT uniqueness does not prove uniqueness under the compiled join

Affected code: packages/sqlite/src/query/index.ts:40,46–60,66–72 and packages/sqlite/src/query/execute.ts:18–26.

The compiler treats a complete declared physical PK/unique tuple as a proof that a join cannot expand. The worker verifies that the physical index exists. Decimal equality instead uses sb_compare(sb_decimal(left),sb_decimal(right)), which normalizes distinct physical text values to the same numeric value. Thus a genuine physical unique index does not establish uniqueness under the actual predicate. This is a plausible wrong-money result, not just a rejected unsupported edge case.

Reproduction uses three ordinary tables and no forged indexes:

```sql
CREATE TABLE parent(id TEXT NOT NULL PRIMARY KEY,amount TEXT NOT NULL);
CREATE TABLE childa(id TEXT NOT NULL PRIMARY KEY);
CREATE TABLE childb(id TEXT NOT NULL PRIMARY KEY);
INSERT INTO parent VALUES('1','10.00');
INSERT INTO childa VALUES('1'),('1.0');
INSERT INTO childb VALUES('1'),('1.00');
```

Declare each ID and amount as decimal {precision:6,scale:2,rounding:'half-even',encoding:'text'}. Both forms are accepted decimal inputs. Query parent AS p with two LEFT JOINs, each cardinality many-to-one, on p.id = child.id, GROUP BY p.id, selecting p.id and SUM(p.amount), grain grouped with the projected parent ID as its key. The generated joins are sb_compare(sb_decimal(p.id,...),sb_decimal(child.id,...),...) = 0. The compiler marks both right sides unique, and the worker accepts all three real primary keys. Both children contribute two matches: the correct one-parent total 10.00 becomes 40.00. No diagnostics are returned.

Observed independently through:
- documented compileQuery + SQLiteWorker.queryPreview;
- public connection.inspect/bind and project.batch followed by saved HTTP query.preview;
- independently executed draft HTTP query.preview;
- fresh MCP query_preview (new request ID), plus matching request replay parity.
All preview commands returned ok:true, revision 3, rows [{outkey:'1.00',outtotal:'40.00'}], diagnostics []. Database file bytes were unchanged. The independent expected result is [{outkey:'1.00',outtotal:'10.00'}] if the declared nonexpanding grain can be honored; otherwise reject the unproven cardinality before executing/returning a plausible total. Physical PKs alone cannot justify this query.

Runnable retained repro/evidence (all outside kitty-specs; no product edits):
- /tmp/wp15-independent-probe.mjs
- /tmp/wp15-independent-public.mjs
- /tmp/wp15-independent-public.jsonl
Run with PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH node /tmp/wp15-independent-public.mjs from the review lane. This uses isolated temporary DBs, roots, port 0, and removes only its own temporary data. Capability material is neither printed nor retained in the output.

Repair acceptance: establish a sound grain/uniqueness proof under the actual compiled comparison and normalization semantics, including every composite-key component, or fail closed with an actionable unsupported/grain diagnostic. Do not mask inflation with SUM(DISTINCT amount): equal amounts from legitimate distinct parent/child rows must still contribute independently. Add regression behavior through the real preview command and preserve valid grouped child-query/preaggregation, decimal filtering/order, and cancellation. The same invariant should account for physical/logical comparison differences generally rather than assuming index existence is a semantic proof.

Requirements: spec US5.2 explicitly prohibits silent multiplication; T072 requires fanout prevention and T073/T075 require numeric correctness; NFR-009 and FR-018/FR-020 are violated by successful wrong totals.

## Independent checks and limits

- npm test -- packages/sqlite/tests/query packages/sqlite/tests/decimal: 4 suites, 14 tests passed. Includes actual built production Next SIGTERM while preview is pending, terminal canceled job after reopen, unchanged revision/data, HTTP/MCP stale and unauthorized cancellation, and a running expensive worker cancellation.
- npm test -- packages/core/tests: 4 suites, 18 tests passed. Existing command reservation/idempotency/transport behavior remained green.
- npm run typecheck: exit 0. The existing unimplemented generator/ui packages are explicitly reported by the verifier; no later integration is claimed.
- /tmp/wp15-independent-arithmetic.mjs: separately imported decimal.js (precision 100) oracle matched real compiled SQLite sum(price*quantity), avg/min/max, sum-plus-literal composition, fractional/negative/null data, empty-source coalesce, and 36 arithmetic/rounding comparisons. Output /tmp/wp15-independent-arithmetic.jsonl.
- Independently canceling an already completed public preview returned succeeded, committed:false; the original successful replay stayed stable.
- Targeted production caller searches confirmed core registration, shared command dispatch, child worker query-preview dispatch, and portable exact helper callers. Production main.ts, OwnerService, startOwner, ProjectCore.close and SQLiteWorker.close were reviewed; actual production shutdown test passed.
- Existing full-build/full-verify/audit evidence was read; this review reran relevant strict types/tests and actual production shutdown, not the whole verify command or a fresh audit.
- Source package/apps/fixture/lock/evidence files are unchanged relative to reviewed source 7d85f26. Later lane commits contain coordination metadata only. No later query UI, report UI, generated runtime numeric result or WP07 work is claimed. Known Python no_coverage advisory is not counted as either passing evidence or blocker.

## Eight-item anti-pattern checklist

1. Dead code — PASS. New modules have actual preview/worker/core callers. Portable decimal codec/encoder/calculation exports are legitimate reusable package API; later generator integration is explicitly deferred and not claimed complete.
2. Synthetic-fixture tests — PASS. Focused tests execute real compiler, SQLite child workers, command services, HTTP/MCP and built Next. Oracle test independently computes expected values rather than only SQL snapshots.
3. Silent empty return — PASS. Empty rows and null aggregates are legitimate SQLite outcomes; undefined cancellation means no active preview controller, with normal job handling continuing. Invalid grammar/types/data fail with diagnostics.
4. FR coverage — PASS for the WP-scoped behavior assertions (C-007, FR-018, FR-020, NFR-004, NFR-009), with the independently exposed regression demonstrating inadequate fanout edge coverage. Overall correctness remains FAIL; test count is not proof.
5. Frozen surface — N/A. No applicable frozen-file prohibition was identified; narrow shared integration was explicitly authorized. The external 258 registry records/observedAt remain unchanged; the local model workspace dependency and whole-lock hash are documented.
6. Locked decision — FAIL. Successful preview silently multiplies aggregates, contradicting US5.2 and the plan/data-model requirement to detect fanout before execution. See P1 above.
7. Shared-file ownership — PASS. The core/model/sqlite export/worker/job and actual owner shutdown integrations are narrowly justified in packages/core/src/query-preview/EVIDENCE.md and explicitly coordinated/authorized by the root. No WP07 edits were made by review.
8. Production fragility — PASS. New failures are explicit invalid input/unsupported grain/data/overflow/cost/time/cancel checks. Worker errors are normalized, shutdown awaits process exit and terminal observations, and production shutdown behavior was exercised. No new unchecked transient-race throw was identified.

Verdict: rejected. One actionable correctness blocker; no product changes by reviewer.
