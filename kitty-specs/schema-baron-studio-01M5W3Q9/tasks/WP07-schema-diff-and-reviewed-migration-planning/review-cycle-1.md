---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T04:40:06Z'
reviewer_agent: codex/reviewer-renata
wp_id: WP07
---

# WP07 independent review — changes requested

Reviewed product source `570a5b8` against dependency-aware WP06 repair base `45fb008`. Current lane HEAD `82f1008` adds coordination/status merge commits; product source diff after `570a5b8` is empty. Reviewer: codex / reviewer-renata.

## P1 — preserve physical primary-key/rowid semantics or block the rebuild

`packages/sqlite/src/schema-plans/index.ts:111` treats every single logical integer primary key as an SQLite rowid alias, and `createTable` emits all logical integer columns as `INTEGER`. Actual inspected SQLite `INT NOT NULL PRIMARY KEY` and `INTEGER PRIMARY KEY DESC NOT NULL` are ordinary independent primary keys, not rowid aliases. They are currently accepted as rebuildable by `projectSchema` in `packages/core/src/connections/index.ts`.

Public reproduction (no internal planner or storage access): create an isolated project; seed an external database with `CREATE TABLE t(k INT NOT NULL PRIMARY KEY,v TEXT); INSERT INTO t(rowid,k,v) VALUES(50,7,'kept');`; use `connection.inspect`, `connection.bind`, and `project.batch` to add only one nullable text column; then call `schema.preview`. Preview succeeds and records a plan whose sole impact is `Add column added`, with no required acknowledgement. Execute its exact steps on a second independently seeded SQLite database. `SELECT rowid AS __review_rowid__,* FROM t` changes from `{__review_rowid__:50,k:7,v:'kept'}` to `{__review_rowid__:7,k:7,v:'kept',added:null}`. The same failure occurs for the DESC spelling. Source data remains unchanged by preview.

The emitted `INTEGER ... PRIMARY KEY(k)` also changes future behavior: `k` becomes an alias of rowid, although that was not a candidate change. This is silent loss of unaffected physical row identity/semantics, violating T032/T035, FR-010 and NFR-003. A later apply executor cannot repair incorrect reviewed SQL.

Required correction: distinguish actual physical rowid-alias semantics when deciding support and rebuilding. Preserve the original key and rowid semantics, or fail closed with actionable unsupported diagnostics before recording a successful plan. Merely adding a generic acknowledgement does not satisfy the unaffected-data preservation requirement. Add public API regressions for both physical spellings, executing approved SQL on a separate database and asserting explicit rowid aliases as well as subsequent key behavior; also retain a true `INTEGER PRIMARY KEY` positive case.

Repro and full observed plans: `/tmp/wp07-independent-review/probe.mjs`, `/tmp/wp07-independent-review/results.jsonl`.
Command: `PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH node /tmp/wp07-independent-review/probe.mjs`.

## Verification and scope

- `npm test -- packages/sqlite/tests/schema-plans`: PASS, 2 files / 23 cases, including actual HTTP/MCP and separate-database SQL execution tests.
- `npm run typecheck`: PASS for implemented workspaces; generator/UI explicitly report NOT IMPLEMENTED at this stage.
- Strict standalone TypeScript check of both new test files: PASS.
- `git diff --check`: PASS.
- Independent public API probes: 2 failing preservation cases and 1 successful native rename control. Only disposable temporary DBs used; no source migration DDL executed.
- Production call-site checks confirm worker -> planSchema, ProjectCore -> registerSchemaPreview, and both connection/preview registrations -> storage.hasInspectedConnection. No second persistence path was introduced.
- Necessary shared edits (model baseline/recovery fields, durable existing-operation inspection provenance, worker/export/registry wiring, local manifest/lock evidence) have a concrete rationale in fixtures/schema-plans/evidence.md and parent-coordinated WP15 integration. They are not rejected for scope alone.
- No actual schema.apply/restore or WP08 UI is claimed or required in this review. The broad implementer verify/build/native/audit results are recorded in its evidence; independently rerun checks are those listed above.

## Required eight-item review checklist

1. Dead code: PASS — new modules have live production callers; command is on the shared registry.
2. Synthetic-fixture tests: PASS — committed FR tests invoke actual production commands and real SQLite; positive effect tests execute planned SQL separately.
3. Silent empty return: PASS — planner returns empty steps only for an empty diff or structured diagnostics; lifecycle/failure paths return explicit errors.
4. FR coverage: PASS — stable ID/constraints/FKs, shared preview persistence/freshness, data checks, preservation and no hardcoded acceptance identifiers have behavioral assertions. Passing coverage does not negate the independently reproduced defect.
5. Frozen surface: N/A — no task-marked frozen source file; shared edits are documented below.
6. Locked decision: FAIL — successful rebuild silently changes unaffected physical row identities/key semantics, contrary to preservation and fail-closed support boundaries.
7. Shared-file ownership: PASS — documented minimal rationale and WP15 coordination; future consolidation must union additive worker/registry/lifecycle changes.
8. Production fragility: PASS — new explicit throws report validation, stale state, unsupported semantics, access or shutdown failures; no unexplained transient-race crash found.

Verdict: rejected; return WP07 to planned for the narrow preservation correction and repeat independent review. No product fix or other-WP state mutation performed by this reviewer.
