---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T10:55:50Z'
reviewer_agent: reviewer-renata
wp_id: WP20
---

# WP20 independent review — changes requested

Reviewer: reviewer-renata. Source: 99822a0. Correct combined integration baseline: 414e1c4c245070b48b305185945a6cc9759aece4. Reviewed lane HEAD d59e1d2; post-source differences are status artifacts only. Inherited dependency work and status are excluded.

## P2 — Diagnose unsupported action-hook bindings instead of silently dropping them

`packages/generator/src/compiler/index.ts:37` and `:53-55` propagate `extensionHookRef` for Login and Grid/Search/Record actions but only check the contract kind in the latter branch. The emitted hook invocation is solely in `server/record-service.ts` for Record writes. Grid navigation emission drops the hook reference entirely; Record cancel returns before hooks, and Login also has no hook consumer.

Independent observed repro: `/tmp/wp20-review-heldout.mjs` constructs a valid ordinary Grid with a declared action v1 module and `navigate` action bound to it, then calls the production `compileProject` and `emitApplication`. Compilation succeeds and IR retains `extensionHookRef`; emitted `app/library/page.tsx`, `components/grid-0.tsx`, and `server/grid-0.ts` have neither the hook ID nor an invocation. Thus an owner can bind a handwritten action and receive successful generation while its declared behavior never executes. The Properties selector also offers action hooks without an operation restriction.

Fix: keep the implemented Record write scope if desired, but reject every unsupported form/operation binding with an actionable diagnostic tied to the action object before preview/apply emits output. Cover Grid navigation, Search, Login/logout and Record cancel/navigation bindings, or implement any intentionally supported behavior through the actual guarded runtime. Cancel must continue avoiding hooks and writes. Add production compile/emission regression cases proving unsupported declarations diagnose, alongside existing supported Record hook execution tests.

## Verification

`PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH VITEST_MAX_WORKERS=2 npx vitest run packages/generator/tests/regeneration packages/generator/tests/public-list/behavior.test.ts`: 35 tests, 4 files passed in 12.85s. These invoke real public commands, SQLite, generator and native recovery child processes. The existing tests do not cover the held-out unsupported-binding case. Full recorded 386-test verify and browser/standalone evidence were inspected; not claimed as independently rerun. Real WP21 manager stopping remains explicitly unverified, as documented. No product edits.

## Required eight checks

1. Dead code — PASS. Targeted production callers connect ownership/promotion through core generation, extension emitter through base templates, extension commands through ProjectCore, and SourceEditor through workspace.
2. Synthetic fixture — PASS. Preservation tests execute production generators/public commands, real SQLite and child-process recovery. Browser evidence drives actual Code declarations and production output.
3. Silent empty returns — PASS. Examined false/undefined verification and no-journal returns are explicit absence/fail-closed outcomes; cleanup catches are cleanup-only. No unexplained silent success found except finding above.
4. FR coverage — FAIL. FR-024/C-004 authored action bindings outside Record writes can be silently dropped; no negative regression covers them. Other listed preservation/output refs have meaningful assertions and retained standalone evidence.
5. Frozen surface — PASS. No explicit frozen source contract was modified; necessary shared integration is authorized and documented.
6. Locked decision — FAIL. The requirement to diagnose unavailable capabilities rather than falsely succeed is violated by accepted unused hook bindings.
7. Shared-file ownership — PASS. EVIDENCE.md records model/core/generator/bootstrap/Studio integration rationale; root explicitly authorized these narrow changes. Dependency/status changes excluded.
8. Production fragility — PASS. Intentional throws fail closed for source/authority/path/stale/transaction failures and are converted at command boundaries; the hook-binding issue is captured above.

Recovery, exact declared source preservation, no-overwrite conflicts, independent monotonic revisions and current lifecycle port boundary otherwise passed focused review. No approval is issued until this behavior gap is corrected.
