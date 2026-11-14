---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T08:44:55Z'
reviewer_agent: reviewer-renata
wp_id: WP19
---

# WP19 independent review — reviewer-renata

Reviewed source commit: 963ed0cab56af08bd7dec2224488a7e417f8ee50.
Actual approved dependency baseline: WP11 ab00032 (inherited work excluded).
Verdict: request changes.

## Blocking finding

**[P2] Serialize supported literal braces as entities** — `packages/core/src/page-document/index.ts:13,25-32`.

The documented grammar explicitly supports literal braces through numeric entities, but serializeDocument uses escape(), which leaves braces raw. Actual production-code reproduction:

1. parseDocument('<p>&#123;literal&#125;</p>', emptyPage, []) succeeds.
2. serializeDocument of that result emits '<p>{literal}</p>'.
3. parseDocument of that serialized document rejects it as dynamic template/JSX syntax.

Hex entities have the same failure. This is also reachable entirely through Studio authoring: New project → Add page → Design Insert paragraph → replace its text with `Literal {brace}` → Save → HTML. Source is `<p>Literal {brace}</p>` and aria-invalid is true with the dynamic-braces diagnostic. Reload preserves that invalid canonical source. Thus valid static content authored in Design does not remain supported/editable across modes; HTML entities only postpone failure until structural serialization. FR-003/FR-005/FR-023 and T091/T092 require a coherent supported document and semantic roundtrip.

Encode `{` and `}` into numeric entities when serializing text (retaining the raw-brace dynamic syntax rejection). Add production codec roundtrip tests for decimal/hex encoded braces and a Design edit → HTML → apply/save/reopen regression. Ensure both parsed entities and directly entered Design text roundtrip without invalid diagnostics.

Evidence: `/tmp/wp19-review-brace-reproduction.json`, `/tmp/wp19-review-brace-reproduction.png`. No product source was edited by this review. The actual UI proof used a disposable real owner and ordinary visible authoring operations, with no hidden project/model writes.

## Eight-item checklist

1. **Dead code — PASS.** Targeted production call-site rg verified DocumentModes is registered by workspace/index.tsx; parser/serializer/move/preview are called by DocumentModes; state helpers/schema feed workspace save/state/session recovery. Public types are consumed by those paths. Capability callbacks are intentionally gated WP20/WP21 interfaces, not claimed available behavior.
2. **Synthetic-fixture test — PASS.** Codec tests call the production codec; state tests invoke shared edit/recovery/save reconciliation; browser tests author through the real UI and verify real owner persistence/MCP revision conflicts. Removing implementation would fail those assertions.
3. **Silent empty return — PASS.** Guard no-ops cover unsupported UI actions/stale deleted pages, parser failure is explicit diagnostic+exact retained source, missing projection controls rely on validated model invariants. No new swallowed exception with empty success return. Recovery damage is diagnosed and original storage protected.
4. **FR coverage — FAIL.** Existing tests exercise the listed C-002/FR-003/FR-005/FR-023/FR-024/NFR-005/NFR-008 behaviors within this WP scope, but the supported literal-text roundtrip acceptance fails the independent production/UI case above and lacks a regression assertion. Final WP20/WP21 integration is correctly skipped and is not a rejection reason.
5. **Frozen surface — PASS.** No frozen/untouchable product surface was found in relevant spec/plan/contracts; actual product diff is owned document-modes/page-document/tests plus necessary shared integration. Coordination/status metadata in the generic ancestry diff is not product implementation attributed to WP19.
6. **Locked decision — PASS.** No new eval, authored server-hook execution, arbitrary path fetching, second persistence channel, fixture schema special case, generated-source write, or owner bypass found. Preview has restrictive sandbox/CSP; unsupported syntax retains source. The roundtrip finding is an acceptance defect, not a violation of a locked execution/ownership decision.
7. **Shared-file ownership — PASS.** EVIDENCE.md records root coordination and rationale: workspace registration; shared Editor/View/session recovery and pending-source Save/dirty/close/construction guards; browser-safe core export. These are necessary integration with the approved WP10/WP11 interfaces. This feedback retains that coordination rationale for the transition record.
8. **Production fragility — PASS.** New throws are intentional fail-loud parser rejection converted to diagnostics or explicit pending-source Save refusal. No new transient-race throw escapes a request/worker path.

## Verification observed by reviewer

- Node 24.22.1, direct executable invocations; no npm scripts, hosted sync opt-in/auth, upgrades, or product edits.
- `node node_modules/vitest/vitest.mjs run packages/core/tests/page-document apps/studio/src/document-modes apps/studio/src/workspace`: 4 files / 33 tests passed.
- `node node_modules/@playwright/test/cli.js test tests/e2e/document-modes/workflow.spec.ts --workers=1 --output=/tmp/wp19-review-browser`: 2 passed, 1 explicit WP20/WP21 integration skip, 8.8 seconds. Includes normal UI authoring, real persistence, invalid raw recovery, revision conflict, sandbox isolation, native zoom.
- Heldout direct production-code checks: encoded literal braces fail semantic roundtrip; escaped angle-bracket text roundtrips; self-closing static elements, NUL entities and orphan controls reject explicitly. Existing tests cover duplicate/missing/foreign/reparented references, inherited-property entities, raw size/depth limits.
- Inspected committed actual native200 viewport screenshot and 1920 Design screenshot. Native metrics 640x400 inner, DPR2, CSS zoom1, viewportScale1 also independently asserted by browser rerun. Committed axe report records zero violations; axe was not rerun (no axe script set in reviewer run).
- Existing Python coverage/JUnit advisory is not a product pass and was not substituted for this behavioral review.

Canonical verdict must be captured by move-task and read back using event_sourced_review_result; this file alone is non-authoritative.
