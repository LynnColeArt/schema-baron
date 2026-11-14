# WP23 R1 — responsive offline installation and failure evidence

Audience: independent reviewer and the mission coordinator.

Canonical feedback: reviewer-renata, cycle 1, changes_requested, event `01M5YZTDPPM0FQNQ3Q1ZDR1XZ5`; source/evidence `ac64f16` and durable readback `5b7baa8`. R1 was the sole P2 finding. The earlier reset and reviewer blocking reproduction remain retained; the old uninstrumented reset's exact operation remains unknown.

## Correction

The owner and corpus share a Vitest process. `spawnSync` prevented that owner's event loop from processing HTTP timers and idle socket closure while npm installed output dependencies. The corpus now awaits a tracked asynchronous child using the same Node executable, output cwd, `npm ci --ignore-scripts --offline`, 120000 ms child timeout, and exit/stdout/stderr assertions. Child timeout cleanup targets only its tracked process group. No product source, HTTP timeout, MCP timeout, connection header, operation assertion or retry policy changed.

During each real install, independent authenticated capabilities reads sample the live owner. They fail immediately on a bad response; they are responsiveness samples, not retries of a failed command. The original command-envelope failures, exact cross-transport replay, cold-write effect assertions, normalized comparison and all 31 advertised operations remain intact.

The corpus journals before bootstrap, install and each primary/replay operation. Atomically replaced, flushed JSON retains transport, operation, request ID, expected revision, elapsed time, observed status/error code, child duration/exit/stdout/stderr, and nested failure name/message/frames/cause/code/errno/syscall. It writes failure evidence before cleanup and records resource closure afterward. A later cleanup failure cannot overwrite the first failure; the regression checks that retention. Known credentials are redacted; command inputs and raw outcomes are not journaled. Assertion messages are summarized to avoid copying payloads. `SCHEMA_BARON_PARITY_EVIDENCE` isolates each replay's artifacts, including completed per-transport matrices and overall comparisons.

The controlled failure serialization test retains `responsiveness/controlled-failure-evidence.json`: its `failed` status is intentional synthetic error evidence, not a failed corpus run. It proves child exit/output and later HTTP operation context survive, with the sentinel redacted and nested ECONNRESET code preserved.

## Regression and observed results

The warmed-owner test uses three fully consumed authenticated reads with 20 ms yields, matching the review reproduction. It checks HTTP 200 after a 7.2-second asynchronous idle, during a tracked 7.2-second asynchronous child using the same child helper as npm, and after the resulting idle socket expiry. It asserts the child has not completed during the owner probe. Reintroducing a synchronous child would complete that child before the probe and fail this assertion. The final test path never deliberately blocks the owner; the reviewer’s retained before-fix reproduction supplies the blocking/reset observation.

| Check | Observed result | Evidence |
|---|---|---|
| Original three-file/two-worker reproduction | 3 files / 9 tests passed, 51.95 s; no retries | `concurrent.log`, `concurrent/` |
| Independent serial corpus | All 31 operations, both cold transports, passed 47.56 s | `serial.log`, `serial/` |
| Warmed owner and failure serialization | 2 tests passed, 15.33 s | `responsiveness.log`, `responsiveness/` |
| Concurrent real offline installs | MCP 4034 ms, 13 in-child HTTP 200 samples; HTTP 3664 ms, 12 samples | `installation-responsiveness-summary.json` |
| Serial real offline installs | MCP 3732 ms, HTTP 3567 ms; 12 HTTP 200 samples each | Same summary, per-phase journals |
| Strict TypeScript for changed harness sources | Exit 0, no diagnostics | `strict.log` |
| Retained Publication audit | r80 equals fixture, original rows and two migration records match, integrity ok, no FK violations, live/portable authored bytes exact, owner.json mode0600 | `retained-study-audit.json` |

All scratch MCP clients, owners and asynchronous children completed/closed. Both replay journals retain successful cleanup records. No post-fix failure was observed in these bounded runs. The earlier failed runs remain failures, not waived or relabeled by later successes.

Production and visible-authoring code are unchanged. Reviewer independently reran the fresh Publication journey (2.7 minutes) before this repair; its evidence is `../review-renata-publication.log`. Prior live/portable output checks and the historical full 464-test suite remain retained in the main report. Per coordinator scope, browser journeys and the entire suite were not repeated solely for this harness edit; the final combined suite remains due at consolidation/WP26. No architectural Python gate pass is claimed: its unavailable `tests.architectural` module remains unverified.
