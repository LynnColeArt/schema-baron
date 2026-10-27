---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T11:50:53Z'
reviewer_agent: reviewer-renata
wp_id: WP21
---

# WP21 independent review: changes requested

Reviewer: reviewer-renata. Source: 2214b326605df49c81e1c28c85e9af2651149233 (lane HEAD 914973297a6d421edc90b75e10fc1fd396f8e0a6 adds coordination/status only). Comparison: approved WP20 source 99822a0 + 0cf327a, excluding inherited source/status changes. Shared model/core/storage/generator/UI integration is explicitly authorized and its rationale is recorded in packages/core/tests/runtime/EVIDENCE.md.

## P1: Reserve project runtime ownership across asynchronous port probing

packages/core/src/runtime/index.ts:125-134 checks managed.has only before awaiting portAvailable, then unconditionally replaces managed at line204. Two distinct runtime.start requests concurrently pass this check. The production executeAsync path reserves request IDs, not project process ownership. Both commands return successful starting jobs. core.close stops only the last map entry; the first owned group survives. In an independent real-process repro, both requests succeeded with owned PIDs570142 and570148, and PID570142 was still live after awaited core.close. Killing that review-owned orphan then exposed its close callback writing to the already closed metadata database (uncaught database connection is not open).

Reserve a per-project launch state before the first await and hold it through launch/failure, or otherwise serialize/recheck ownership atomically before spawning. Promotion, stop, cancel and core.close must account for pending launches as well as all spawned groups. Add a real concurrent distinct-request test that verifies one accepted launch, clean busy rejection or serialization for the other, no lost jobs, no post-close callbacks using closed storage, and no live owned descendants after stop/close/promotion. Cleanup in the repro killed only its two recorded owned groups.

## P1: Revalidate current project authority before publishing an asynchronous export

packages/core/src/export/index.ts:139-153 revalidates output fingerprint and destination parent after asynchronous SQLite work, but never rechecks the current canonical project revision/hash against the initially captured project. A normal project.batch during includeData export changes the model while the backup awaits. The export publishes the stale definition/source directory, then ProjectCore.executePrepared rejects the command for REVISION_CONFLICT. Independent repro observed exportStatus=rejected, published=true, currentRevision=5. This violates the stale-operation/no-partial-effect contract and leaves an allegedly failed export at an occupied destination.

Immediately before any publication, re-read canonical project authority and require the exact reviewed revision/hash, as well as the existing source/data/parent checks. A failed stale export must remove staging and leave destination absent. Add the real SQLite concurrent-mutation regression and verify durable retry outcome and destination contents/absence.

## Independent verification

- Production runtime/export tests: 9 tests in3files passed54.57s, using actual generated Record-only output, managed production builds, lifecycle/promotion, port collision, native SQLite descendant cancellation, path/symlink refusal, data snapshots, independent offline install/typecheck/test/build/start after core.close.
- Browser UI/MCP journey:1test passed44.9s (45.6s total). UI authoring/generate/build/start/typed selected Record route/draft isolation/stop/reviewed includeData export; owner shutdown and independent portable app proof passed.
- Heldouts: /tmp/wp21-review-heldout.test.ts with /tmp/wp21-review-heldout.config.mjs; both concurrency assertions fail as above. Test1 additionally exposed the post-close job callback error. No product edits made. Test processes were restricted to recorded review-owned PIDs/groups.
- Live caller inspection: RuntimeManager and registerExport are registered by ProjectCore; RuntimeControls renders in workspace/document modes; outputAuthority is used by runtime/export; routeParameters is used by runtime.route. No disconnected new public module found.
- Bare Record correction: narrow explicit readonly ContextField[] typing preserves validation; actual no-Grid/no-Search authoring/build and independent exported typecheck/build/start passed.
- Linux/proc scope, trusted local authored code assumption, pending WP14/WP18 integration and unavailable Python architecture gate remain accurately disclosed. No claim of those later acceptance cases passing.

## Eight required checks

1. Dead code: PASS. Production callers above.
2. Synthetic-fixture test: PASS. Behavioral proof reaches production authoring/compiler/runtime/export; fake local entry tests deliberately isolate process failure boundaries and supplement real Next builds.
3. Silent empty return: PASS. Process liveness races and signal ESRCH are deliberately tolerated and bounded; readiness catches retry until deadline; cancel undefined means job is not owned here for adapter fallback.
4. FR coverage: FAIL. Nominal FR-001/023/027/029 and NFR-004/010 are exercised, but required no-orphan cleanup and stale/no-partial-effects behavior fail independent concurrent cases.
5. Frozen surface: N/A. No frozen path identified; no unrelated source reviewed.
6. Locked decision: FAIL. Concurrent start violates owned-child cleanup; stale export publishes despite revision rejection.
7. Shared-file ownership: PASS. Parent authorization and EVIDENCE.md document the necessary shared integration and narrow Record correction.
8. Production fragility: FAIL. Lost child persists after awaited core.close; its eventual close callback raises against closed storage. Other new explicit rejections give actionable fail-loud diagnostics.

Verdict: rejected. Fix both races and rerun heldouts plus appropriate lifecycle/export/browser proof. WP22/WP24/WP25 must consume the corrected approved source; no downstream status changed here.
