---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T03:59:58Z'
reviewer_agent: codex/reviewer-renata
wp_id: WP06
---

---
status: active
owner: reviewer-renata
updated: 2026-10-26
---

# WP06 independent review: changes requested

Reviewed source: `b355f99898b4c8e9a047edb4eef30f9da0da0173`, dependency-aware WP06 change (`git show b355f99`), in lane-f. Reviewer: separate Codex reviewer using resolver-loaded `reviewer-renata`; no self-review or product corrections. Full generated review prompt read. Missing charter and Python/JUnit coverage authority are advisory, not reasons for this verdict. Spec Kitty remains 3.2.7; no hosted sync opt-in.

## P1: reserve asynchronous idempotency keys before running effectful handlers

`packages/core/src/project/index.ts:46–57` checks only already-completed operations, then starts the handler. `packages/core/src/connections/index.ts:65–69` exclusively creates a real file before its first await. Rechecking the completed key after await protects model commits, but cannot undo an already-created external file.

Public reproduction: `node docs/reviews/wp06-idempotency-repro.mjs` under pinned Node 24.22.1. This script calls the exported `ProjectCore`, without patching handlers, storage, timers, or production code. It cleans its own temporary directory. Its assertions establish reproduction of the defect, not desired product correctness. Exact output is retained in `wp06-idempotency-results.jsonl` alongside this report.

Observed on a fresh revision-1 project:

1. `matching.sqlite`, `a.sqlite`, and `b.sqlite` do not exist; no matching operation exists.
2. Launch two `executeAsync` calls with an identical request ID and payload (`connection.inspect`, `createEmpty:true`, `projects:matching.sqlite`) before awaiting either. Both return `OUTPUT_CONFLICT`; the newly created file exists. The durable operation is `failed`, and an identical later retry returns the same failure. Project revision remains 1. The duplicate attempt recorded the failure while the first attempt was inspecting its successfully created file.
3. Launch two calls with the same request ID but different unused paths (`a.sqlite`, `b.sqlite`). One returns success, the other `IDEMPOTENCY_CONFLICT`; **both files exist**. Which path wins depends on worker completion order. The rejected payload already performed a filesystem mutation. Project revision remains 1 and only the winner has a committed operation record.

This violates the shared commands contract section 4 (same key/payload returns the observed prior result; different payload conflicts), and FR-029's no-partial-persistence boundary. UI/HTTP and MCP both dispatch through this async authority, so transport parity does not prevent the defect.

Required repair: reserve `(projectId, requestId)` and its canonical payload identity before any effectful async handler starts. Matching requests must share one execution and one final outcome. A conflicting payload must reject before starting the handler or creating a file. Preserve synchronous execution compatibility, post-await revision validation, shutdown behavior, and deterministic persisted retry semantics. Add regression checks using the actual `connection.inspect(createEmpty:true)` path, asserting response, operation record, revision, and file existence for matching/conflicting overlaps; include overlap with synchronous authority where applicable. The existing synthetic `flow.inspect` overlap test meaningfully tests core commit arbitration but does not cover external creation effects.

## P3: remove unused exported identifier helper

`packages/sqlite/src/introspection/index.ts:10` exports `quoteIdentifier`, but targeted repository call-site search finds no production or test caller. Introspection correctly binds PRAGMA values and never uses the helper. Remove the unused export, rather than adding an artificial caller. This is the explicit generated-review dead-code checklist failure.

## Verification actually performed

- `npm test -- packages/sqlite/tests/introspection`: **9 passed in 2 files**. Includes real WAL/SQL metadata preservation, worker transactions, read-only write denial, backup, bounded read timeout/write cancellation with integrity and no late rows, missing/corrupt/permissions/locking/path failures, stale schema, relocation, HTTP/MCP parity, revision overlap, and owner close tests. No broader build/142-test run was repeated after a confirmed blocker; implementer evidence documents those separately.
- `node docs/reviews/wp06-idempotency-repro.mjs`: exit 0 means both defects reproduced. Also exercises actual worker shutdown: close during a real inspect returns `RECOVERY_REQUIRED`; reopening sees revision 1, no connections, and no recorded late operation. This shutdown case passed.
- Read the actual adapter, worker, introspection, registry/core finalization, connection mapping, model additive metadata changes, HTTP integration and connection UI, with targeted caller searches. `git diff --check` passed.
- Visually inspected the existing 1280×800 and 1024×600 PNGs in `/tmp/wp06-e2e-pinned/connections-workflow-UI-au-d084b-serving-invalid-page-drafts/`. Locator, unsupported-object warning, Cancel, Inspect and Bind remain visible. These are repository Playwright screenshots; no authenticated manual CUA journey, 200% native zoom, or fresh browser run is claimed by this reviewer.

## Eight-item anti-pattern checklist

| Item | Verdict | Evidence |
| --- | --- | --- |
| 1. Dead code | FAIL | Unused public `quoteIdentifier`; other new modules have live production registration/import paths. Adapter primitives are explicitly required by T026. |
| 2. Synthetic-fixture tests | PASS | Native/connection FR assertions call actual workers, HTTP, MCP, and core. Synthetic async handler is a focused core-arbitration case, not fake SQLite proof. |
| 3. Silent empty return | PASS | New boundary failures become structured diagnostics; empty schema is an actual valid empty DB; nullable physical metadata is retained intentionally. |
| 4. FR coverage | PASS | FR-006 real introspection/bind/relocation/create; FR-029 stale/invalid/revision cases; NFR-004 bound values and protected owner dispatch; C-007 generic schema-driven implementation and varied quoted fixtures. Coverage exists but omitted the failing effectful retry boundary above. |
| 5. Frozen surface | N/A | No frozen WP06 file was identified in spec/plan/contracts. Review scoped to the source commit, not all inherited dependency changes. |
| 6. Locked decision | FAIL | The idempotency contract is violated before handler completion; conflicting requests mutate files despite rejection. |
| 7. Shared-file ownership | PASS | EVIDENCE.md records coordinated minimal registry/core awaited execution, HTTP await/shutdown, workspace mounting, additive model metadata, package exports/manifest/lock and registry evidence rationales. These are necessary integration edits; their idempotency defect is assessed above. |
| 8. Production fragility | PASS | New throws represent explicit invalid/unavailable/native-worker boundaries and are translated through structured error paths; no bare transient request-handler throw was found outside that handling. |

No later schema authoring, migration, query, or generation feature is accepted by this review. Native filesystem TOCTOU concerns and full accessibility acceptance are not newly proven here. WP06 is rejected for the concrete reproduced defect; passing existing tests does not override it.
