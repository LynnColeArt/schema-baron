# WP02 cycle-2 independent review — approved

Audience: WP02 implementer, orchestrator, and downstream WP03/WP04 implementers.
Reviewer: codex / reviewer-renata. Repair reviewed: 50db3ff0884769f542f92cc38ae4a910f6102c1d.
Fresh generated review prompt 4afc9643b90d43e2853f111c6ca8318f was read in full. Existing profile and verdict-capture instructions retained from cycle 1.

## Findings resolved

- T008 / FR-016 / FR-029: whole-project validation now derives effective access only with a valid global scope, owner and explicit access. The original page/action-policy substitutions return object-linked VALIDATION_FAILED diagnostics without throwing; valid authenticated inheritance passes. Other existing invalid owner/inheritance coverage passes.
- T007 / FR-018: ORDER BY expression aggregate flags now participate in declared grain and grouping checks. Direct count, arithmetic-wrapped count, and function-wrapped count fail at row grain; each corresponding explicitly grouped query passes.
- T007/T008 / FR-018: ON predicates see previously connected aliases and the current right alias, with previous outer-join nullability retained. The original future-alias predicate returns BROKEN_REFERENCE at joins.on; valid sequential joins pass. No compiler/runtime features were added.

The patch changes only validation context handling plus targeted regression tests and evidence. It preserves expression diagnostics, source order, existing grouping checks and immutable parsing. No remaining blocking finding was identified in this review.

## Independent observed verification

Using PATH=/home/lynn/.nvm/versions/node/v24.22.1/bin:$PATH, Node 24.22.1 / npm 11.19.1:

- npm test: 74 passed in three files, including 63 model tests. Read all 14 new regression cases: tests invoke production validators, including invalid and valid counterparts and unchanged-input assertions.
- npm run typecheck and npm run build: passed implemented model/bootstrap scope. Other product packages explicitly remain NOT IMPLEMENTED.
- Fresh native ESM import from @schema-baron/model after build: 14 independent public API checks passed. Both unrelated fixtures validate; original invalid page/action-global-policy substitutions return diagnostics; authenticated global inheritance passes; direct/nested aggregate sorts fail at row grain and pass with declared grouping; valid sequential joins pass and forward alias fails; commandSchema.safeParse is callable and accepts a valid command.
- git diff --check 50db3ff^ 50db3ff: passed.
- Reviewed generated baseline git diff kitty/mission-schema-baron-studio-01M5W3Q9..HEAD --stat and isolated repair/source commits, keeping inherited WP01 bootstrap out of fresh WP02 model scope. Previous cycle's wider contract, negative fixture, key tuple, unsafe expression, fanout/query cycle, read-only binding, strict format/secret and reviewed-plan inspection remains applicable; untouched behavior was rerun in the full suite.

## Required anti-pattern checklist

| Check | Verdict | Evidence |
| --- | --- | --- |
| Dead code | N/A | WP02's explicitly staged library boundary provides the required usable native exported API, verified above. Production command callers belong to WP03, followed by transport callers in WP04; these remain NOT IMPLEMENTED. Internal schema modules have actual production imports/reexports. No dummy downstream consumer was added. This retains the orchestrator's explicit cycle-1 applicability clarification. |
| Synthetic fixtures | PASS | Both original and regression tests call actual exported production validators/schemas and assert observable acceptance/diagnostics. Deleting the implementation would not preserve those assertions. |
| Silent empty return | PASS | No new silent-empty path. Existing undefined expression shapes follow emitted diagnostics or propagate existing failures; empty diagnostics represent documented success. |
| FR coverage | PASS | Model-level tests cover C-003/C-007 and FR-001/003/007/008/011/016/018/020/029; new tests close the three policy/query gaps. This is model-layer evidence, not later UI, transport or generated-runtime acceptance. |
| Frozen surface | PASS | Repair touches only model validation/tests/evidence. Original model source changes and justified package integration do not touch frozen old repository/demo/reference surfaces. |
| Locked decision | PASS | Repair adds no raw SQL/eval escape, UI/filesystem/transport dependency, hardcoded domain constant, persisted secret, or second persistence path. |
| Shared-file ownership | PASS | Original model manifest/build-config integration remains minimal, documented and coordinated in evidence.md. Repair has no shared bootstrap edit or dependency/lockfile change. |
| Production fragility | PASS | validateProject no longer calls the fail-loud effectiveAccess helper on invalid global policy. parseProject and effectiveAccess retain documented validated-boundary failure contracts; repair adds no new throws. |

## Limits and follow-through

Approval is for this pure model package and its documented package interface. WP03/WP04 must integrate real production command/transport callers; no persistence, HTTP/MCP parity, SQLite migration/query compiler, generated application, UI or performance acceptance is claimed here. This review did not reinstall dependencies or independently replay the implementer's pre-fix red run; it inspected the regression tests and verified the fixed run/public interface. No CLI upgrade, sync opt-in, product fix, task-planning edit, add-history, or force waiver was performed.
