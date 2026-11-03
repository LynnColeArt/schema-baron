# Post-consolidation mission and PR #1 release review

Reviewer: independent Codex agent `pr1_release_review`, resolver-loaded **Reviewer Renata**. Date: 2026-11-02 America/Chicago (2026-11-03 UTC). This reviewer authored no application, test, runner, prior acceptance proof or package approval. This report is a local independent release assessment, not a GitHub human approval or deployment certification.

**Verdict: PASS WITH NOTES for the bounded source milestone. PR #1 remains current and should carry the consolidated result, subject to the coordinator's final-head checks.** No newly demonstrated critical/high defect blocks it. The original PR is the foundation of the current application, not an obsolete competing implementation.

## Provenance and scope

- GitHub base: `main` at `ffa4eacc59044ec5ca21447d7882b2c97c97fa37`.
- Original PR #1 head: `fe22d9b06be0967b1dec89c352d2979787330f34` on `feat/schema-baron-studio`. Both this head and the GitHub base are ancestors of the reviewed integration.
- Hardening metadata baseline: `d5266fbe7d6db827be3985599d8e79a0b61dba49`; original spec deliberately identifies fe22d9b as its product milestone baseline. These are different workflow/product anchors, not contradictory test identities.
- Qualified application/test/runner source: `ca1a03910d7ab72f874d0e22829068d3f09e30a2`.
- Canonical mission consolidation: `666ae0a`, followed by done/status bookkeeping and retrospective capture `4dc76be`.
- Actual integration HEAD inspected: `8c94677521696fb9c8dcee648a81d0d6fb8a22a9` on `feat/studio-verification-hardening`. This report's later documentation commit is a separate identity; no prior execution is relabeled as having run on it.
- `git diff --exit-code ca1a03910d7ab72f874d0e22829068d3f09e30a2 HEAD -- apps packages tests scripts fixtures package.json package-lock.json` returned **0**. No application, acceptance runner, test, fixture or root lock/package change was introduced by consolidation.

Read AGENTS, the full mission-review skill, resolved Renata, loaded action `review` governance (charter missing, as the spec anticipates), and confirmed canonical status **9/9 done**. Read hardening spec/plan/tasks/contracts, all package review-cycle files, event history, actual retrospective, production delta from fe22d9b, and the following integration seams: generated auth/returns/record handlers, transactional record service, source ownership/extensions/promotion, draft recovery, isolated journey helpers, independent row oracles, acceptance qualification, CI, installation and readiness documentation. The original 26-WP foundation has its independent post-merge FR matrix and security review in [mission-review.md](../mission-review.md); its scope/limitations and release evidence remain in [readiness.md](../../user-guide/readiness.md) and [release.md](../../development/release.md). That earlier review is evidence about its named source, not fresh all-current execution. The present delta review and later exact-source qualification bridge it to this integration.

## Gate Results

### Gate 1 — Application contracts

Applicable commands are `npm test`, `node --test scripts/acceptance/evidence.test.ts scripts/acceptance/report.test.ts`, and the real generated-runtime/HTTP/MCP suites. Existing exact-ca1 receipts record **513 unit/integration**, **28 Node foundation/report**, and **40 legacy browser checks**, exit 0. This reviewer did not repeat those suites or build while the coordinator owned primary-checkout verification.

Fresh read-only evaluation here imported the actual `scripts/acceptance/report.mjs` and evaluated `qualify(actual wp09-independent/report.json)`: **PASS, accepted true, reasons []**, exit 0. Independently recomputed all **39** hash-bearing report references and **20** source-artifact hashes: zero mismatches. Report SHA256 is `6baf1f35fcc3214593682c747110b695da860e67961c48eddfcf9ceffacdd0f7`. This verifies evidence linkage and qualification behavior; hashes alone do not prove UI behavior. Those observations are credited to their actual independent executors.

The literal skill command `SPEC_KITTY_ENABLE_SAAS_SYNC=1 <runner> tests/contract/ -v` is N/A: it tests the Python Spec Kitty host, whereas this mission changes a TypeScript app with its own contracts. No SaaS opt-in or host upgrade was performed.

### Gate 2 — Architecture

Applicable existing ca1 receipts: native verify/smoke, strict workspace/harness types, build, dependency verification, lint and audit, all exit 0. Source inspection confirms model/core/storage authority is shared by Studio and MCP; MCP forwards to the owner; generated output has its own server modules and external database configuration. The narrow hardening production edits remain in their existing concerns. No Workshop/Library-specific production branch was found. Fixture names belong in test descriptors/oracles, not generator behavior.

Literal Python `tests/architectural/` is N/A; auxiliary `_gate_coverage` remains **no_coverage / unverified**, not a pass. `@schema-baron/ui` remains an unused source-less scaffold explicitly reported NOT IMPLEMENTED. The existing dependency/type/build checks are the applicable app architecture gates; neither limitation is silently promoted to coverage.

### Gate 3 — Application E2E and cross-repository applicability

Existing current [independent review](review.md), [walkthrough](wp09-independent/walkthrough.json), and [final report](wp09-independent/report.json) record two complete fresh author cycles, then a distinct reviewer's four fresh browser checks: regeneration **2/2**, stopped-owner independent export **2/2**, zero retries. Full phase counts per author cycle are `2/2/1/1/5/1/2/2/15`. Inspection confirms ordinary schema/page/query/source edits go through visible Studio controls, observers use read-only SQLite, and independent export checks actually stop the original owner. Fault bridges remain explicitly application-independent lower-seam tests, not two fabricated interrupted UI journeys.

No new UI rerun is claimed here. Existing hosted success at exact ca1 is recorded by the prior independent reviewer for run `41515529660`; the **final PR-head CI has not yet run at this report's writing** and remains a separate coordinator check. `.github/workflows/checks.yml` obtains Chromium before browser-consuming verification, denies lifecycle scripts during acquisition, runs actual serialized journeys and retains sanitized reports. It does not deploy.

Spec Kitty host cross-repo SaaS FR-038–041/C-010 scenarios are N/A: this app mission claims no such behavior or requirements. This is applicability, not an exception to a failed test.

### Gate 4 — Issue and acceptance matrices

The spec's PR #1 reference is a provenance reference, not an unresolved issue claim; there is no issue-fix matrix requiring invented rows. Issue-matrix gate is N/A. The applicable canonical acceptance matrix has 29 criterion passes per independent WP09 and package review. Fresh evaluation of the actual hash-bound report confirms all **20 cases / 29 requirements passed**, without overriding pending dispositions. The actual 72-record private ledger was independently validated during WP09; this reviewer verified the public canonical summary and linked proof, not possession/replay of that private ledger.

## Requirement audit

ADEQUATE means the linked tests exercise live behavior within the declared bounds. It does not mean every possible schema, failure interleaving or platform is certified. Paths in the test column are under `tests/e2e/acceptance/` unless stated otherwise. The exact per-case observations, source revision and retained evidence are in the linked final report and ledger; the full earlier foundation FR matrix is in `docs/evidence/mission-review.md`.

| Requirement | WP owner | Production seam and behavioral test/evidence | Adequacy |
|---|---|---|---|
| FR-001 ledger | 01/08/09 | acceptance evidence/report; reverse lexical-order regression, canonical linked finalization tests | ADEQUATE |
| FR-002 fresh Workshop | 02 | wizard/schema/page commands; workshop journey, regeneration | ADEQUATE |
| FR-003 unrelated Library | 03 | schema/connection inspection; library journey and existing-DB Cancel variant | ADEQUATE |
| FR-004 schema lifecycle | 02/03/06 | reusable schema editor/migration; both journeys, recovery | ADEQUATE |
| FR-005 pages/map | 02/03/05 | workspace/page/form/control projections; UI journey persisted declarations | ADEQUATE |
| FR-006 relationship/context | 02/03/04/07 | typed navigation, ordered keys and generated lookup; both journeys/access | ADEQUATE |
| FR-007 transactional CRUD | 02/03/04 | record service immediate transaction; library uniqueness/restrict/composite and access assertions | ADEQUATE |
| FR-008 public/private | 02/04 | authorize before reads/writes, CSRF and validated returns; access plus generated-auth integration | ADEQUATE |
| FR-009 query correctness | 02/03/07 | compiler/report runtime; independent count/exact-money/zero-child/mutation oracles | ADEQUATE |
| FR-010 regeneration | 07 | ownership/promotion and preserved external data; regeneration twice per app/cycle | ADEQUATE |
| FR-011 customization | 07 | Code editor/declared authored validator hooks; byte and behavior checks | ADEQUATE |
| FR-012 independent output | 07 | export/private external DB and identity; stopped-owner independence | ADEQUATE |
| FR-013 drafts | 05 | scoped buffers/focus/retained session drafts; drafts five-case UI suite | ADEQUATE |
| FR-014 failed operations | 04/05/06/07 | revision/idempotency/path/identity/runtime and shared recovery; recovery/fault tests | ADEQUATE |
| FR-015 shared commands | 06 | actual MCP→owner shared dispatcher; bounded parity, not UI substitution | ADEQUATE |
| FR-016 clean repetition | 01/08/09 | exact census/retry/source checks; two frozen-code cycles and independent review | ADEQUATE |
| FR-017 repairs/verdict | 03/06/08/09 | retained red/green history, mandatory defect checks and canonical finalization | ADEQUATE |
| NFR-001 preservation | 02–08 | row/declaration/authored hash comparisons, cancellation/rejection/recovery | ADEQUATE |
| NFR-002 boundary/privacy | 04/06–09 | access/path probes, exact ephemeral-secret exclusions and heuristic scan | ADEQUATE within bounded probes |
| NFR-003 determinism | 01/08/09 | actual one-attempt census rejects missing/extra/retried tests | ADEQUATE |
| NFR-004 responsiveness | 05/08 | four 30-sample performance sets, unchanged 2000/5000ms thresholds | ADEQUATE at recorded fixture/machine |
| NFR-005 stability | 05/08 | 30 received revisions plus view/reload focus/caret/ownership assertions | ADEQUATE |
| NFR-006 completeness | 01/08/09 | exact all-20/all-29 qualification; no open mandatory/high defect | ADEQUATE |
| C-001 platform | 03/07–09 | pinned Linux/SQLite/TS target; unchanged package/lock bytes | ADEQUATE |
| C-002 preserve baseline | all | private fresh roots and owned processes; original study comparisons in prior proof | ADEQUATE within observed runs |
| C-003 honest UI | 02–09 | visible authoring, read-only observers, explicitly separate parity/fault modes | ADEQUATE |
| C-004 scope | all | generic small repairs; unsupported targets/widgets/hosting remain explicit | ADEQUATE |
| C-005 safe evidence/tooling | 01/04/06–09 | ignore-scripts, private stores/raw traces excluded, retained failed histories | ADEQUATE within inspections/scans |
| C-006 source identity | 01/08/09 | ca1 source freeze, separate proof/document identities, exact hash equality | ADEQUATE |

## Review history and drift

WP01's first review found a **high** false-green ledger: arbitrary lexical IDs could hide a later failure. Shipped `evidence.mjs` persists exclusive append-order reservations, checks duplicate/ambiguous sequence metadata, and uses that order; the explicit reverse-order regression would fail with the old implementation. WP05's first review found obsolete decimal buffers could reject a valid type change. Shipped `applicableSchemaBuffers`, its live editor callers, state tests and the real five-case drafts browser suite constrain that regression while retaining other active drafts.

The two `force:true` events are **backward rejection rewinds** from in_review to planned for these fixes, not forced approvals. Subsequent independent cycle-2 approvals exist. No ReviewerSelfApproval event or arbiter-forced acceptance was identified. Short approval cycle files are supplemented by detailed event reasons and retained independent review/proof; they are not by themselves runtime evidence. Every WP is done. No new locked-decision violation, mandatory requirement omission or application-specific special casing was found.

Performance proof reports worst p95 feedback 17.90ms, p95 Save 182.37ms and maximum Save 241.05ms across 120 samples. This is a bounded local measurement, not a large-project scalability promise. Nonempty authored source preservation is separately demonstrated by regeneration; the timing fixture's zero authored modules is not used to claim that behavior.

## Security and failure analysis

- Generated server action calls `guardAction` before parsing/executing mutations. Direct record POST independently checks origin/CSRF and authorizes the declared page/action before `execute`; neither a hidden action value nor unauthenticated JSON bypasses that boundary. New AccessError handling changes only safe feedback, retains framework redirects, and never executes after a rejected guard. Its emitted-code test explicitly proves the no-write assertion detects a suppressed guard; real HTTP acceptance is separate.
- Returns are limited to declared internal routes and declared typed context, reject external/protocol-relative/backslash/fragment/duplicate parameters, and do not allow submitted table/path selection. Record CRUD uses the ordered full key tuple, bound values and a transaction; Cancel returns before writes/hooks. Failed destination resolution inside the transaction rolls back the write.
- Ownership scanning refuses links/special files/modified generated source and preserves only compatible declared authored paths. Extensions are explicit `authored/name.ts`, not arbitrary path imports. Promotion retains the previous tree, validates journal/tree identity, uses no shell interpolation and refuses ambiguous recovery. Replaceable source is separated from external business/identity stores. These are bounded Linux/GNU/procfs contracts.
- Public evidence retains no raw private DB/config/identity/trace; exact secret exclusion and credential heuristic receipts are present. This reviewer read the sanitized artifacts and source; no exhaustive malware audit or general penetration-test claim is made. No dependency upgrade/install was performed in this review.

Silent/default behavior inspected: draft-focus storage errors intentionally fall back to text recovery without caret metadata; this does not mark a save successful. Unknown record load errors intentionally produce a generic visible failure, while only the deliberate LookupLimitError crosses that boundary with a specific message. Unknown auth/network errors become visible failure envelopes; no new empty-success path was identified. Trusted authored synchronous hooks can throw and abort a transaction; they are code authored by the local app author, not sandboxed untrusted plugins.

## Nonblocking notes and release limits

1. **Known MCP gap — medium, documented.** Trigger: request the advertised schema flow projection. Observed result is `INVALID_INPUT`; application/endpoint projections work. [MCP evidence](../mcp-workflow/README.md) and README explicitly expose this failure. The mission only requires bounded MCP parity, not every projection; it is not counted as a passed schema feature. Follow-up should implement the projection or stop advertising it until supported.
2. **Authoring discovery / maintainability — low, documented.** A new MCP author still needs local trusted bootstrap and actual source-contract examples; broad discovery is not a complete tutorial. Large existing workspace/editor modules increase change review cost. Neither is evidence of a failed mandatory journey. Keep future hardening local and separately scoped.
3. Supported milestone is Linux x64/glibc, pinned Node24.22.1/npm11.19.1, SQLite and TypeScript/Next.js. Single-field lookup choices are capped at 200 with an explicit 201st-row error. Composite lookup widgets, arbitrary controls, other platforms, cloud deployment and polished production readiness are not claimed.
4. Publication still needs the coordinator to fast-forward the PR branch to the reviewed integration plus this report, inspect **actual final-head** hosted checks, and perform the authorized merge. Existing ca1 success and byte equality justify reuse of behavioral proof; they do not fabricate a hosted run on a future commit.

## Final Verdict

**PASS WITH NOTES.** Source consolidation preserves the qualified application bytes. The actual evidence recomputes all mandatory cases/requirements as passed, the earlier independent browser qualification is source-linked, the two substantive review rejections were resolved, and this pass found no new critical/high/security blocker. PR #1 should be updated and merged under the user's conditional authorization rather than closed as obsolete, once its actual final-head checks succeed. This verdict does not claim those future checks, GitHub human approval, release packaging or deployment have already happened.

## Retrospective Reminder

Verified the runtime-authored record from capture commit `4dc76be` at [kitty-specs/studio-verification-hardening-01M6AQ6R/retrospective.yaml](../../../kitty-specs/studio-verification-hardening-01M6AQ6R/retrospective.yaml). Installed host3.2.7 stores it there, rather than the skill's generic `.kittify/missions/<id>/retrospective.yaml` example; it is not missing. It records WP01/WP05 rejection/rewind rework, analysis findings, no gaps and no staged proposals. Useful learning: ledger ordering and logical-type buffer lifetime need behavioral negative cases, and a forced backwards rewind must not be mistaken for approval bypass.

Ran `spec-kitty retrospect summary` (exit0): two completed missions, zero malformed/terminus-no-retro records; its separate four-state aggregation reports one missing record and should not be interpreted as this verified file being absent. Ran `spec-kitty agent retrospect synthesize --mission studio-verification-hardening-01M6AQ6R` dry-run (exit0): planned0/applied0/conflicts0/rejected0/events_emitted0. No proposals, charter, host upgrade, authentication or hosted sync was applied. The post-merge sequence remains mission review → verify retrospective → surface findings; repeat synthesis only when there are actual proposals to inspect.
