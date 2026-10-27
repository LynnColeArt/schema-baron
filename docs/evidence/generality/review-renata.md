# WP23 independent review — changes requested

Reviewer: reviewer-renata. Source baseline: approved WP22 e46290c; reviewed WP23 commits 4f0fe29, 7da1819, 0a9f770 and metadata. No implementation changes by reviewer.

## R1 [P2] Keep the acceptance owner event loop responsive during offline installation

Location: tests/contracts/parity/behavior.test.ts:69 (startOwner is in the same Vitest worker, line 18).

The new corpus calls spawnSync for npm ci immediately before the runtime.start request. This freezes its own real HTTP owner. An independent two-worker run of the corpus, fidelity and generated-auth suites failed after 70.305 seconds with raw `TypeError: fetch failed`, caused by `Error: read ECONNRESET` (errno -104). Eight other tests passed. This reproduces the documented earlier concurrent failure; it is not counted as a passing run. Exact original failing operation is unknown because the corpus deletes scratch roots and only records matrices after success.

A controlled reproduction uses real startOwner and three authenticated capabilities fetches, each consumed and followed by a 20 ms asynchronous yield, to warm the pool. After a 7.2-second asynchronous idle, the next fetch returns 200. After a 7.2-second same-process spawnSync child pause, it throws `TypeError: fetch failed` / `Error: read ECONNRESET`. A single unwarmed request before the pause did not reproduce; socket warmup matters. This establishes the harness blocking/idle-socket boundary; it does not establish a production runtime defect or prove the exact operation in the uninstrumented failure.

Replace the synchronous offline install with an awaited asynchronous child process, or run the owner outside the blocked process. Preserve the exact `npm ci --ignore-scripts --offline` policy and its exit/stdout/stderr assertions. Retain operation/transport/install-phase context on failure before deleting scratch roots. Do not hide this with blanket retries, Connection:close everywhere, or a product timeout increase. Re-run the bounded concurrent corpus/auth suites and serial corpus, retaining each outcome separately.

Independent observations: serial corpus passed 54.19 s; instrumented corpus/auth two-worker follow-up passed 53.27 s. These later passes do not erase the failed run. Fidelity 7 tests and generated-auth 1 test passed; 19 existing constructor/report/Record tests passed; 3 heldout cases passed (derived report link values, empty submit Search caption/duplicate refusal, fresh-only Record defaults).

## Required anti-pattern checklist

1. Dead code — PASS. No new production public module; local formatter is invoked by shared Grid/report emission; compiler and constructor changes have live production callers.
2. Synthetic-fixture test — PASS. Corpus invokes real owner HTTP and actual SDK MCP stdio; visible workflow authors with product controls; SQLite/source checks are independent.
3. Silent empty return — PASS. Narrow production diff introduces diagnostics, no unexplained empty-return/catch path.
4. FR coverage — PASS. Lifecycle/isolation, complete operation inventory, stale/invalid diagnostics and unrelated schema assertions exercise C-003/C-007/FR-001/028/029/030/NFR-007. R1 separately blocks reliable harness execution.
5. Frozen surface — PASS. No frozen source changed; fixture is retained output. Original Equipment source/business data remain preserved.
6. Locked decision — PASS. No fixture-specific engine constants, second persistence path, change-event runtime, or install script execution added.
7. Shared-file ownership — PASS. Report/provenance record the coordinator-authorized generic caption/native-event/link correction and narrowly affected regression selectors.
8. Production fragility — PASS. New unsupported bindings fail before generation with control-linked recovery diagnostics; no new transient production raise.

The Python tests.architectural module is unavailable in the Spec Kitty interpreter: UNVERIFIED, not passed. Hosted login warnings were not opted into or repaired. Reviewer did not use self-review fallback or modify task frontmatter/events.



## Fresh independent visible journey

The original unchanged Publication browser test passed with `--workers=1 --retries=0 --output=/tmp/wp23-renata-publication`: 1 passed (2.7 minutes). Fresh retained root: /tmp/publication-visible-0YjrlG; full browser artifacts: /tmp/wp23-renata-publication. This independently repeats visible blank authoring, composite-key CRUD and validation, authenticated returns/Cancel, exact report oracle, migration/two regeneration cycles/authored source preservation, original Equipment switching and isolated identities, MCP draft conflict/event-gap/reconnect behavior, and export. The original /tmp/publication-visible-6MrH23 and /tmp/equipment-visible-IKFKUY remain retained. Original study-location pointer restored after saving the reviewer pointer separately.

Read-only original study inspection: r80 exactly equals fixture; integrity_check=ok, zero FK violations; original membership tuple (1,1) Primary shelf retained; two non-authority migration records; authored source equals retained expected bytes in both live and portable output. Both original owner.json files are mode0600.

Review-only tests were removed after copying to /tmp/wp23-renata-reviewer-*.test.ts. The first heldout attempt had a reviewer-only file lookup mistake (component index assumption); corrected semantic file lookup passed all 3. No implementation source was changed. Corpus reruns rewrite evidence by design; reviewer results were copied to /tmp and original committed parity artifacts restored exactly.
