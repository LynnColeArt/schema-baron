---
affected_files: []
cycle_number: 1
mission_slug: studio-verification-hardening-01M6AQ6R
reproduction_command:
reviewed_at: '2026-11-02T13:02:46Z'
reviewer_agent: user
wp_id: WP01
---

# WP01 independent review — changes requested

Reviewer: `/root/verification_foundation_review`, separate from implementation agent
`/root/verification_foundation`. Resolved profile: `reviewer-renata`; charter absent,
so charter-specific checks are unavailable, not passed.

Reviewed implementation `4d30a35` and coordinated tooling cherry-pick `8533a0d`
(root original `1b53454`) against mission branch `d32810c`.

## R1 — High: lexical IDs let an older pass hide a later failure

Locations: `scripts/acceptance/evidence.mjs:115-126`.

`readObservations()` sorts run IDs and observation filenames lexically, and
`summarizeLedger()` takes the last matching value. Observation IDs are arbitrary
valid identifiers, not sequence numbers. The recorded timestamp is discarded.
As a result, a legitimate newer failure can be summarized as passed. This violates
WP01's fail-closed ledger and FR-001/FR-017, even though `accepted` remains false.
The downstream `requirePassed` check trusts this incorrect case disposition.

Independent synthetic red reproduction (no product acceptance claim):

1. Register run `review-run` at one revision for Workshop/UI mode.
2. Append a valid AC-002 passed observation named `z-earlier-pass`.
3. Append a later valid AC-002 failed observation named `a-later-failure`.
4. Read the observations and summarize the case.

Observed JSON:

```json
{
  "expected_status": "failed",
  "actual_status": "passed",
  "read_order": [
    {"id":"a-later-failure","status":"failed","recorded_at":"2026-11-02T13:01:25.432Z"},
    {"id":"z-earlier-pass","status":"passed","recorded_at":"2026-11-02T13:01:25.426Z"}
  ],
  "regression_reproduced": true
}
```

Full local reproducer/output are retained in lane-a at
`.local/wp01-review/reproduce-order.mjs` and `order-red.json`.

Required repair: define and enforce deterministic append/chronological or explicit
supersession ordering independent of arbitrary run/observation names. Handle ties or
ambiguous ordering safely rather than silently choosing a lexically convenient pass.
Retain every failed record. Add regression coverage for reverse-ordered identifiers
within one run and across runs, earlier-pass/later-failure, and failed-then-linked-pass
retest history. A current failed case must remain failed and cause the live ledger CLI
to exit nonzero even when an older passing observation sorts after it.

## R2 — Verification blocked: provision the lane before broad proof

The broad head artifact `/tmp/spec-kitty-declared-cmd-u313qtzu/output.xml` reports
496 tests, **32 failures**, 0 errors. This is not a green suite. The original captured
pytest/JUnit baseline is a separate invalid comparison and remains preserved; its
source mismatch cannot excuse the real head failures.

Reported failures include missing lane `packages/generator/dist/index.js`, missing
`apps/studio/dist/main.js`, MCP connection closure, and missing lane TypeScript paths.
The lane currently borrows ancestor dependency resolution; this does not establish
that lane-local runtime/build tests are runnable, and would test incorrect workspace
modules after later product changes.

Required follow-up: acquire the pinned lane-local dependency tree with lifecycle
scripts denied, verify the reviewed SQLite native binary, build the lane workspaces
through the documented procedure, and run the actual broad suite after that setup.
Check that @schema-baron workspace links resolve this lane. Preserve the first failed
artifact and distinguish remaining product failures from infrastructure failures.
Do not suppress tests, skip the gate, fabricate a replacement baseline, or claim a
source-mismatched regression comparison passed. Re-run the 14 focused tests plus R1's
regressions. Broad final mission acceptance remains WP08, but the actual attempted
head failures need an honest resolved or explicitly blocked disposition before WP01
approval.

## Independent commands and result

- Pinned Node24.22.1 `node --test scripts/acceptance/evidence.test.ts`: 14 passed,
  0 failed; reproduces implementer's focused result.
- Public API chronology reproducer: expected failed, actual passed; red reproduced.
- Read actual JUnit XML: 496 tests / 32 failures / 0 errors.
- Read complete changed scripts, fixture descriptors/catalog and inventory; no live
  Studio/user study, identity store or generated application was changed by review.
- No broad rerun until lane setup; no source fix performed by reviewer.

## Anti-pattern checklist

1. Dead code: PASS for the live CLI validator/reader/summary modules. Producer APIs
   are exported library seams for WP08, not a claim of integrated app acceptance.
2. Synthetic-fixture test: PASS within WP01 harness scope: assertions call actual
   validator/store/CLI code. They explicitly do not establish application FR success.
3. Silent empty return: PASS; an absent observation store yields the intended pending
   ledger, while invalid evidence fails loudly.
4. FR coverage: FAIL — R1 contradicts truthful disposition/history behavior; later
   full-journey/final-verdict proof remains deliberately assigned to downstream WPs.
5. Frozen surface: PASS; no original user-study files are changed.
6. Locked decision: FAIL — R1 permits a failed outcome to count as a passed case.
7. Shared-file ownership: PASS; gate config/wrapper are a documented coordinated
   tooling exception, root commit1b53454 / lane8533a0d.
8. Production fragility: PASS for intentional fail-loud validator/CLI guards; R2 is
   infrastructure proof still requiring resolution, not an exception-swallowing fix.

Verdict: **REJECT / changes requested**. Repair R1 and complete honest lane-local
verification; retain red evidence and the previous broad run. No acceptance case is
marked passed by this review. WP02 remains unstarted until canonical approval.
