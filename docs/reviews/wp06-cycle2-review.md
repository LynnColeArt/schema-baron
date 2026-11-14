---
status: active
owner: reviewer-renata
updated: 2026-10-26
---

# WP06 cycle 2 independent review: approved

Source: initial WP06 `b355f99898b4c8e9a047edb4eef30f9da0da0173` plus repair `45fb008490dbea2c919bcb0c70ab29baf88fe9e2`, reviewed in lane-f using the actual WP06 changes rather than inherited WP01–05 changes. Full cycle-2 generated prompt read; reviewer profile and verdict-capture guidance retained from the independent cycle-1 review. No product corrections were made by this reviewer. This report supersedes the verdict in the historical `wp06-review.md`, whose original reproduction remains intentionally unchanged.

## Resolution of the two findings

**P1 resolved:** ProjectCore now parses/captures the canonical payload and reserves the project/request key before deferring any handler code. Matching asynchronous requests share the reserved outcome. Conflicting synchronous/asynchronous payloads cannot enter the effectful handler. A matching synchronous call while pending returns retryable PROJECT_BUSY before acceptance/recording, then replays the committed result after completion. The new pre-entry revision check handles intervening synchronous changes; the existing post-await revision and owner-close checks still protect finalization. Reservations are released in finally. Existing exclusive writer/root leases provide the single-owner boundary; completed records provide restart replay.

Independently ran the unchanged historical reproduction: Node exits 1 at its intentional old-defect assertion because matching results are now both successful, one file exists, the operation is committed, and the retry succeeds. This is expected disappearance of the old defect, not a passing desired-behavior test. Exact output retained in `wp06-cycle2-original-repro.log`.

Independently authored and ran `node docs/reviews/wp06-cycle2-probe.mjs` (exit 0). This uses the exported production core and actual worker/file creation without patched handlers. For both before-handler and worker-active timing it asserts the original matching requests succeed equally, persist/replay one operation, leave the revision unchanged, and add no event; conflicting paths return IDEMPOTENCY_CONFLICT and leave the rejected file absent. It also verifies matching synchronous pending calls return retryable busy without a record, conflicting synchronous calls create no file, unauthorized access is denied, identical request IDs are independent across two actual projects, and close/reopen returns the same durable outcome and operation record. Exact successful summaries retained in `wp06-cycle2-probe-results.jsonl`.

**P3 resolved:** the unused exported quoteIdentifier helper was removed. Targeted source call-site searches confirm live production callers for connection setup/registration, SQLiteWorker, inspectDatabase and executeAsync; no unused helper replacement was introduced.

## Verification performed by this reviewer

- `npm test -- packages/sqlite/tests/introspection`: **21 tests passed in 3 files**. This includes real native read/write cancel/timeout, transaction rollback/integrity/no late rows, backup, exact physical metadata/WAL preservation, stale bind and revision overlap, relocation, path/permission/corruption/lock diagnostics, actual HTTP/MCP parity, matching/conflicting real file creation, input mutation, writer lease, failure replay and close timing.
- `npm run verify`: exit 0; **154 tests passed in 16 files**, implemented package typechecks/production builds, native smoke, credential/diff checks and dependency metadata verification. Output `/tmp/wp06-cycle2-review-verify.log` retained on the review host. Generator and shared UI remain explicitly not implemented and outside WP06.
- `node docs/reviews/wp06-cycle2-probe.mjs`: exit 0, desired public-interface assertions above.
- `git diff --check`: passed. Read the complete repair diff and updated connection evidence; inspected the real production authority, not just tests.

The initial independent review already inspected both 1280×800/1024×600 connection screenshots and exercised actual native cancellation/shutdown and metadata/relocation/transport behavior. The repair changes core reservation and removes one unused helper; it changes no UI. The implementer reran five browser workflows, but this reviewer did not repeat that browser run or claim an authenticated manual CUA journey or 200% native zoom. No later migration/generation capability is approved. Known missing Python/JUnit authority and no-coverage advisory remain limitations of the external gate, not claimed passing product checks. Spec Kitty remains 3.2.7; no hosted sync opt-in or charter gate was introduced.

## Eight-item anti-pattern checklist

| Item | Verdict | Evidence |
| --- | --- | --- |
| 1. Dead code | PASS | Unused helper removed; production caller searches confirm the new module paths are connected. Required adapter primitives belong to T026. |
| 2. Synthetic-fixture tests | PASS | SQLite/connection proof invokes real production native workers, files, commands and transports. Focused generic handler tests constrain core arbitration rather than substituting for SQLite proof. |
| 3. Silent empty return | PASS | Failure paths produce structured errors. Empty schema/nullable metadata are intentional observed SQLite states; pre-entry busy/conflict returns are not persisted as completed operations. |
| 4. FR coverage | PASS | Real FR-006 creation/introspection/bind/relocation, FR-029 stale/invalid/retry cases, NFR-004 bound SQL and owner authorization, C-007 varied generic physical schemas and no acceptance constants. |
| 5. Frozen surface | N/A | No frozen file identified for this WP; repair touches core authority, existing evidence/tests, and removal of an unused SQLite helper. |
| 6. Locked decision | PASS | Original idempotency violation is closed before external handler effects. Revision, identity, fingerprint, read-only and explicit exclusive-create boundaries remain intact. |
| 7. Shared-file ownership | PASS | Coordinated registry/core/HTTP/workspace/model/export/manifest rationale retained in EVIDENCE.md; this repair is the narrow correction required by the independent core-boundary finding. |
| 8. Production fragility | PASS | PROJECT_BUSY and IDEMPOTENCY_CONFLICT are explicit structured boundary outcomes before operation acceptance. No new unhandled transient throw path introduced. |

No actionable defect remains from the reviewed scope. Approval is limited to WP06 and its necessary recorded integration changes.
