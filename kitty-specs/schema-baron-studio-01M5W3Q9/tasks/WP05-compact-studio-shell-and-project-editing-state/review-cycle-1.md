---
affected_files: []
cycle_number: 1
mission_slug: schema-baron-studio-01M5W3Q9
reproduction_command:
reviewed_at: '2026-10-27T03:17:39Z'
reviewer_agent: codex/reviewer-renata
wp_id: WP05
---

# WP05 independent review — changes requested

Reviewer: codex / reviewer-renata. Mission: schema-baron-studio-01M5W3Q9.
Reviewed source: 523c17b120770b793afb1ac6fdb58c90f7b97d43.
Dependency-aware implementation base: 490fa0dc09a648601b22b1885d4082584c19e31c (includes WP04 dependency merge 3df74397563d1d9c4dfd51bc047bd61c4e360794); the generic mission branch diff includes upstream work and is not the WP05 source boundary.

## P1 — restoring one temporarily invalid draft silently deletes all project drafts and history

Location: apps/studio/src/workspace/session.ts:28,37–43,59–60, called by apps/studio/src/workspace/index.tsx openProject; retain subsequently overwrites recovery state with the empty result.

Public UI reproduction against the real built owner at http://127.0.0.1:35719, using only reviewer-created disposable projects:

1. Create `Renata review disposable`; create Orchard at /orchard, a Welcome Login structural form and Guest name text control; Save. Observe r2 and stable visible IDs.
2. Add a second unsaved page, Meadow draft at /meadow, and edit its title to Meadow draft retained.
3. Select Orchard and clear its contextual Title. This is a normal intermediate invalid edit; observe r2 / 2 dirty objects and both draft tabs/tree objects.
4. Create `Renata switch disposable`, then Open / Switch back to Renata review disposable. The dialog explicitly promises that switching retains each project's unsaved drafts.
5. Actual: r2 / 0 dirty objects, Orchard reverts to its saved title, Meadow disappears, no document open, Save and Undo disabled. No recovery warning or discard consent. No Save was requested and committed revision is unchanged.

Independently reproduced a second variant: clear Orchard Title, then correct it to `Orchard corrected valid`, add valid new page `Meadow valid`, switch away/back. The current draft values are valid at switch time but still disappear, because an invalid intermediate title remains in the undo history checked by restore.

Expected: drafts may be semantically/commit-invalid while editing. Preserve the invalid input, unrelated valid drafts, stable identities, selected/open document context and usable model undo/redo across project switches and reload. Failed saves must keep the same recoverable input. Committed snapshots must continue to obey the existing server/model validation; do not weaken that boundary.

Root cause: recovery applies committed pageSchema/formSchema/controlSchema to every draft value and every past/future snapshot. pageSchema requires nonempty title/route. A normal intermediate invalid edit throws, and the outer catch returns initialEditor/initialView for the entire project, without a diagnostic. Later retain replaces the stored drafts with that empty state.

Narrow repair: separate validation of the bounded recovery envelope/identity/shape from semantic validation of committed entities. Represent and restore supported intermediate invalid values and history. Preserve recoverable unrelated entries and surface actionable recovery errors rather than silently resetting the whole project. Add focused regression cases for mixed valid+invalid drafts, corrected values with invalid history, project switch and same-tab reload, and undo/redo continuity. Reproduce through visible UI with real storage plus focused recovery tests; invalid Save must still reject atomically without changing the owner revision.

Evidence (local, no owner keys/manual derivatives):
- /tmp/wp05-renata-review/invalid-before-switch.png — empty Orchard title plus valid Meadow draft, r2/two dirty objects.
- /tmp/wp05-renata-review/invalid-after-switch.png — settled visible result, r2/zero dirty objects, no Meadow, disabled Undo.
- /tmp/wp05-renata-review/corrected-before-switch.png and corrected-after-switch.png — corrected-current-value variant.
- /tmp/wp05-review-e2e/ — independently rerun normal browser/MCP/SQLite workflow artifacts.

## Other observed verification and scope

Commands run in the lane with Node 24.22.1 on PATH:
- npm test — PASS, 126 tests in 12 files.
- npm run typecheck — PASS for implemented workspaces; generator/sqlite/shared UI explicitly report NOT IMPLEMENTED.
- STUDIO_AXE_SCRIPT=/tmp/wp05-accessibility/node_modules/axe-core/axe.min.js npm run test:e2e -- tests/e2e/workspace/workflow.spec.ts --output=/tmp/wp05-review-e2e — PASS, both real owner + MCP workflows, 12.1 s; axe violations [].
- git diff --check — PASS.

The browser workflows exercise actual blank project creation/cancel, two pages/forms/control, contextual edits, shared MCP inspect equality, saved-batch undo/redo, valid-draft reload, project switch, unrelated MCP route changes, explicit same-field conflicts, linked duplicate-route diagnostics and atomic rejected save, caret/focus on save success/rejection, and keyboard splitter resize. These tests pass but do not cover this invalid-draft recovery failure. Live CUA also independently created a saved page/form/text control and inspected the actual 1280x720 product pixels. Inspected 1920x1080 and 640x400 output pixels; the reduced viewport clips docks into an accessible scroll area, with collapse entry points in command chrome. Native 200% browser zoom remains unexecuted, not a pass claim. Small-workspace rerun latency: 30 samples, median 17.99 ms/p95 30.87 ms including automation overhead; full NFR-001 scale/reopen budget remains unproven and belongs to broader acceptance. No fabricated schema, generator, auth, event-authoring, or later-mode completion requirement is introduced by this rejection. Read-only project settings and honest unavailable integration states are consistent with this foundation slice.

## Required anti-pattern checklist

1. Dead code — PASS. Production app/page mounts Workspace; Workspace imports/calls StudioClient, state, session and chrome. New public runtime paths have live callers. No reusable shared UI package implementation was added; unimplemented bootstrap library is not a dead new implementation.
2. Synthetic fixture tests — PASS. State tests invoke production transitions; E2E authoring hits real built owner, real metadata SQLite/files and SDK stdio MCP. Port tests intentionally isolate event decoding. No product feature is proven merely by a literal fixture.
3. Silent empty return — FAIL. restore's catch returns empty editor/view for ordinary invalid draft/history, reproducing silent data loss above. Other guards are bounded no-project/no-selection/no-event cases; retain exposes storage failure as false and its caller reports it.
4. FR coverage — FAIL. Existing tests assert this WP's scoped lifecycle/composition/context/continuity/appearance behaviors, but FR-005 invalid draft continuity and T024 preservation demonstrably fail; recovery tests cover only valid drafts. Broader FR-004/024 implementations belong to later packages and are not falsely counted complete.
5. Frozen surface — PASS. WP05 source commit only adds the declared app/workspace/project-ui/E2E surface and evidence; no old experiment, reference pack, frozen contract, production manifest or lockfile changed.
6. Locked decision — FAIL. Silent discard contradicts the WP's preserve-drafts invariant and spec FR-005 / US3 invalid-draft preservation. Shared writer, owner scope and honest unavailable-capability constraints otherwise hold in reviewed paths.
7. Shared-file ownership — PASS. Product commit is within declared ownership. No shared bootstrap registration/manifest changes required; inherited dependency changes and runtime-generated coordination metadata are not WP05 product changes. EVIDENCE.md records integration boundary.
8. Production fragility — PASS for intentional fail-loud paths. operations throws to stop unresolved conflicts; network errors become actionable OwnerError; recovery validation throws are caught and their harmful silent fallback is the finding above rather than an uncaught transient exception.

Decision: reject WP05 for the single P1 preservation defect above. No product fixes made by reviewer. Return to the original implementer; after repair rerun focused recovery and normal owner/MCP browser tests, then request independent review again. WP06/WP08/WP10 depend on this foundation and should consume the repaired reviewed source. The baseline gate's no_coverage advisory is not a test pass and not this rejection reason. Installed Spec Kitty remains 3.2.7; no hosted sync opt-in.
