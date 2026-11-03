---
title: WP07 regeneration and portable application verification
audience: Independent mission reviewer
lifecycle: evidence
status: validated-awaiting-independent-review
---

# Procedure and scope

This record covers T031–T035. It is not the final mission verdict or the two complete clean cycles required by WP08/WP09. Final qualified revision and observations are recorded below only after execution.

The approved narrow ownership exception adds the pure `tests/e2e/acceptance/portability.ts` helper so the two owned specs can share read-only observers and ordinary UI operations without importing a spec that registers tests. This evidence file uses the established `docs/evidence/verification` exception. The initial Node Norris claim was corrected through canonical WP07 re-entry and resolver-loaded Implementer Ivan before the React repair.

The only product repair initializes Code output from project settings and keys its state by project ID and output configuration. Ordinary project revisions do not remount the editor. The regression reads real generated source, switches between two UI-created projects with distinct outputs, checks the second editor has no previous buffer or authored Save, and reads both distinct files.

## Fresh run

Use the pinned Linux toolchain and reviewed lockfile/cache. Keep existing user Studio/Workshop processes untouched. Do not rebuild this checkout while its Studio consumers are running.

```sh
export PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH
npm ci --ignore-scripts
npm run native:verify
npm run build
verification_run=$(mktemp -d /tmp/schema-baron-portability.XXXXXX)
export SCHEMA_BARON_PORTABILITY_HANDOFF="$verification_run"
PLAYWRIGHT_JUNIT_OUTPUT_FILE="$verification_run/regeneration.xml" npm exec playwright test tests/e2e/acceptance/regeneration.spec.ts -- --workers=1 --reporter=line,junit --output="$verification_run/regeneration"
PLAYWRIGHT_JUNIT_OUTPUT_FILE="$verification_run/independence.xml" npm exec playwright test tests/e2e/acceptance/independence.spec.ts -- --workers=1 --reporter=line,junit --output="$verification_run/independence"
```

WP08 integration note: a generic discovery invocation over every Playwright spec will also discover the independent consumer spec without its required handoff. Keep that missing-handoff failure strict. The final/CI runner must wire these two explicit sequential phases and avoid duplicate generic discovery; this WP does not modify the CI workflow.

Run the commands sequentially. File ordering in one Playwright invocation is not a phase dependency. Both phases use zero retries. A missing, consumed, wrong-application, wrong-fixture, wrong-journey or wrong-revision handoff fails. The handoff directory is private and outside the checkout; it contains temporary credentials and must never be committed. A failed independent phase requires a deliberate fresh authoring run, preserving the earlier failure.

Each regeneration test awaits the entire original Workshop or Library journey, including the remainder after its populated callback. The callback declares a validator and edits/saves its typed v1 module through Code. It rejects one temporary name using its actual field ID, verifies no rows changed, then performs and restores a valid edit. It snapshots every model declaration, ordered business tuples, account/project/password-hash invariants privately, and authored bytes. Two stop → preview/apply → offline install with scripts denied → typecheck/test → UI build/run cycles compare all invariants and exercise validator, parent defaults and independent report oracles. Build/readiness and process identities are recorded separately.

The source-conflict case has a separate generated output. A plain filesystem copy of a manifest is deliberately not trusted by the product. The test first generates that separate output through Studio to establish its own authority, deliberately edits one generated-owned file there, observes disabled promotion, preserves the conflicting bytes outside output, restores reviewed bytes and requests a fresh preview. It then explicitly regenerates, reinstalls and rebuilds the normal output before resuming the original journey. These additional preparation/restoration promotions are recorded separately from the two required preservation cycles.

## Portable and private configuration

After the complete original journey, the author stops its runtime and generates the current saved declarations before exporting. The destination is explicitly chosen through the visible Export destination field under the project's approved root. The checkbox defaults to excluding private business data. The default export inventory is inspected before deployment; a second export explicitly enables the business snapshot. Both preserve the authored module. The snapshot tables and rows are compared with the declared business schema plus the documented `__schema_baron_migrations` ledger when present, and no managed identity or user accounts are exported.

The independent test uses the **default, data-free export**. Its scripts are the generated `npm ci --ignore-scripts --offline`, `npm run typecheck`, `npm run test`, and `npm run build`; it starts the actual installed Next executable on an owned loopback port. `APPLICATION_DATABASE_PATH` is supplied privately and points to the original isolated external business database. Its adjacent managed identity store is retained separately, with the same project ID. The identity path is `<database>.auth-<first 32 SHA256(project ID) hex characters>.sqlite`. This explicit private pair is deployment preparation, not source/model/data authoring. Export does not contain users or passwords, and an arbitrary copied identity file is not a substitute for this compatible pair.

The Studio owner is awaited to termination before the handoff is published. Independence checks the recorded process is absent, probes owner unavailability before and after visitor use, checks real Next readiness and rendered public data, signs in through a fresh visitor context, exercises the authored rejection and normal edits, and performs filtered child Add/Edit/Delete with exact tuple assertions and retained parent context. Literal report oracles retain decimal strings. Stable account/project/password-hash invariants are checked privately; session-dependent whole-file hashes are not treated as identity invariants.

## Retained development observations

- Product red: the cold wizard Workshop Code destination was `output:app`; its expected configured destination was the project's `generated/app`. The real browser assertion failed before the generic repair.
- Harness correction 1: an early generation assertion inspected checkboxes before preview completed. The helper now awaits the actual response and rendered plan before acknowledging impacts.
- Harness correction 2: a copied output manifest remained blocked after restoring a modified owned file because per-path canonical authority was absent. The fault setup now uses ordinary Generate for its separate output; no authority is copied or forged.
- Harness correction 3: an overbroad export inventory assertion mistook the valid business route `app/sessions/` for a private session store. The check now inventories actual database files/tables, known private values, identity filenames and private configuration instead of banning the business word.

- Harness correction 4: the explicit Workshop snapshot contains its legitimate `__schema_baron_migrations` business-database ledger after the original journey migration. The strict table oracle now allows that documented ledger when present in the original DB and independently rejects managed identity tables.

- Harness correction 5: the first frozen attempt passed both Workshop export inventories, then tried Code in a new witness project without first opening a page document. The switch check now opens each page explicitly through its Explorer tree item. That attempt is retained and is not counted as a clean pair.

Private original failures and captures remain in their distinct local run directories. Public proof contains only sanitized observations and hashes; raw databases, identity stores, secrets, capabilities and browser traces are excluded.

## Qualified results

Frozen implementation/test revision: `60ad8437789f1b0654871fe7a3bdfdea9c31bebb`. The production repair was introduced by `53bc410b50a6932860a78f391184c29c2a43ca1b`; the later commit only opens page documents explicitly in the browser check.

- Regeneration phase: actual process exit 0; JUnit has 2 test cases, 0 failures/errors, 0 skips; 4.4 minutes.
- Independence phase: actual process exit 0; JUnit has 2 test cases, 0 failures/errors, 0 skips; 40.3 seconds.
- Both full original journeys finished before publication of the private handoffs. Both owners and both independent runtimes were awaited to termination.
- Both applications passed two required preservation cycles, active authored behavior, separate owned-source conflict resolution, both export inventories, exact explicit snapshot rows, cross-project source reads, and independent visitor use.
- Relevant source/runtime suite: 5 files / 11 tests passed. Workspace build/typecheck, strict TypeScript checking of all three new test/helper files, native verification, diff lint, credential scan and locked dependency verification passed. Initial pinned install audit reported zero vulnerabilities. No dependency versions changed.

[Sanitized result inventory](wp07-qualified-results.json) records browser census, exported filenames, authored/business/model hashes and positive boundary observations. The six adjacent per-application AC-011/012/013 observations and original red were validated by the canonical `scripts/acceptance/evidence.mjs` validator. They are registered as seven ordered observations in the private run ledger, including the original failed observation and linked successful retest, and link this result inventory by SHA256. [The initial red](wp07-code-output-red.json) remains separate. Private raw captures and handoffs are excluded from Git.

The canonical `move-task --to for_review` gate is run after this proof commit with its installed 300-second budget unchanged. Its actual JUnit report, rather than a cached ScopeSource total, determines review admission. Independent approval is still required. Hosted success is not claimed; WP08 owns the CI ordering and explicit phase wiring follow-through. This is one WP07 qualification pair, not the final mission's two complete clean cycles.
