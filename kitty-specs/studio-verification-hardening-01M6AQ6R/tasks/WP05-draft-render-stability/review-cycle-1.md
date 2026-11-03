---
affected_files: []
cycle_number: 1
mission_slug: studio-verification-hardening-01M6AQ6R
reproduction_command:
reviewed_at: '2026-11-02T15:23:30Z'
reviewer_agent: verification_drafts_review
wp_id: WP05
---

# WP05 independent review — changes requested

Reviewer: verification_drafts_review, resolved reviewer-renata (codex). Reviewed final source/proof HEAD f86b3cab6c2609e096c446f68acd362195fb1793 against approved parent 5f10082ed4d3496f2415db3e924e332c66b1b750. Author verification_drafts is distinct.

## R1 — P2: obsolete decimal text buffer blocks a valid type change

Affected: apps/studio/src/schema-editor/index.tsx:303 and :469; new decimal scale/precision buffer creation at :738–744; logical-type change at :728–730.

Reproduced through a fresh private Studio UI with a new wizard-authored project and no seeded model/API writes:
1. Open Schema, select a decimal column, enter `-` in Decimal scale.
2. Change Logical type to integer. The decimal fields disappear, and the desired column now has valid integer type.
3. Click Save schema and await the operation result.

Actual: `Correct incomplete numeric or default values before saving. Your text is retained.` Owner snapshot still has the old decimal type. There are zero visible Decimal scale controls, so the status asks the author to correct an input that the selected type no longer exposes. The newly introduced `${column}:scale` buffer is treated as active solely because the column ID still exists, irrespective of its logical type. Precision has the same path.

Expected: an invalid buffer remains preserved during applicable draft recovery, but changing the logical type must not let an obsolete decimal-only buffer reject an otherwise valid Save. Reconcile or scope these buffers to applicable decimal fields, with deliberate semantics for switching away and back and for undo/redo; do not clear unrelated active draft text. Add focused/browser regression coverage of the type transition and re-run the exposing private UI case plus the four draft cases. This is an observed ordinary authoring/rejected-operation defect under T022/T025 and FR-013/FR-014; it is not deferred final-matrix work.

Private reviewer proof: /tmp/wp05-review-type-transition-final.log and /tmp/wp05-review-type-transition.png. Output: visibleDecimalFields=0; status as above; persistedType.kind=decimal. The reproduction uses its own temporary owner config/roots/port and stops only its own child process. No live studies were used.

## Verification retained

- Fresh exact-source draft browser replay: 4 tests, 0 failures/errors/skips/retries, 72.705 seconds. Private JUnit /tmp/wp05-review-renata-ui.xml, output /tmp/wp05-review-renata-ui/.
- Focused workspace state/session, schema state, query state/history/parameter contract: 44 tests in 6 files passed.
- Actual retained implementer JUnit independently parsed: UI 4/0/0/0 and canonical gate 505/0/0/0. SHA256 values match advertised hashes; no inference from an empty capture counter or lane transition.
- All advertised artifacts/evidence hashes in drafts.json and drafts.observations.json independently matched.
- Production hook has live Workspace/Schema imports; Query suppression guards its existing live restoration path. Recovery stores scoped by project/object, no credentials are added to focus metadata. The two narrow specialized-editor exceptions and drafts.* proof ownership are explicitly coordinated.
- Scope is honestly qualified as Workshop Page/30-event and Library Schema/Control/Query owner proof. Full journeys, Both-app aggregation, and final performance verdict remain WP08; this is not a reason for rejection.

## Required anti-pattern dispositions

1. Dead code: PASS — new hook has production callers.
2. Synthetic fixtures: PASS — UI cases author through real controls and observe real revisions; read-only snapshots/hash checks are independent oracles.
3. Silent empty returns: PASS — focus-storage failures intentionally preserve independent text recovery and malformed metadata is ignored.
4. FR coverage: FAIL pending R1 — tested recovery works, but newly introduced invalid-buffer state blocks a valid supported type change.
5. Frozen surface: PASS — no frozen/model architecture changes in WP05 diff.
6. Locked decision: PASS — isolated UI authoring, no hidden repair, no retry masking, no application-specific production branch.
7. Shared-file ownership: PASS — Schema/Query narrow exceptions and proof artifact coordination recorded.
8. Production fragility: PASS — new validation failure is handled through existing diagnostic reporting; no bare transient-race raise.

Verdict: reject WP05 to planned for R1. No source fixes, scope waivers, other-WP mutations, merge, or deployment performed by reviewer.
