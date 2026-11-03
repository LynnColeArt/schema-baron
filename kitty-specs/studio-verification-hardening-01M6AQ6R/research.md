# Research and Decisions — 2026-10-31

## Evidence inspected

- Baseline source `fe22d9b` and PR #1; current test inventory includes wizard/schema/forms/security/query/report/document/regeneration/runtime/export suites.
- `docs/development/release.md`, `docs/user-guide/readiness.md`, `docs/evidence/project-wizard.md`: separate actual historical runs, platform limits and hand-driven demonstrations from proof required here.
- `apps/studio/src/generation/index.tsx`, `source-editor/index.tsx`, `server/workspace.ts`: Generate follows project outputConfig and new projects create generated parent; Code-mode initial output still uses output:app (candidate gap, UI reproduction required).
- `packages/generator/src/compiler/index.ts`, grid and Record templates: generic lookup labels and same-table exact-filter defaults exist; malformed context and existing-record non-overwrite already have independent runtime coverage.
- `tests/e2e/equipment/`, `publication/`, `scripts/release/verify.mjs`, `acquire-output.mjs`, `toolchain.mjs`: existing clean-study and explicit tool acquisition approaches should be reused carefully; their captures do not prove this mission.

## D1 — Two fresh UI-authored applications

Decision: reproduce Workshop Planner in isolation and build Library Catalog with a composite book-author association. Keep the retained live study as a read-only historical reference.
Rationale: a changed table name alone is weak generality evidence; independent identities/cardinality/types/report grains expose hidden assumptions. UI journeys directly confront previous backstage model edits.
Alternatives: reusing only retained apps risks stale configuration; building another commerce/customer example repeats the same schema shape.

## D2 — Existing tools and generic repair seams

Decision: retain current pinned TypeScript/Node/Next/SQLite/Vitest/Playwright stack; add no dependency and do not resume the canceled Spec Kitty upgrade.
Rationale: the question is baseline correctness/usability, not a platform migration. Browser automation tests real controls; read-only independent oracles verify outcomes.
Alternatives: a replacement framework, a mock builder or direct-API-only acceptance would weaken the proof.
Supply-chain decision: no security-impacting dependency change is selected, so a dependency challenge squad is not required for this plan. Any later dependency change needs its own explicit review, registry/lifecycle evidence and scoped challenge disposition; it cannot be smuggled into hardening.

## D3 — Independent expected values

Decision: declare small synthetic relational datasets and hand-checkable expected sets/counts/exact decimals; compare read-only business snapshots and authored-byte hashes at each regeneration boundary.
Rationale: reusing generated SQL as the expected answer can reproduce the same mistake on both sides. Code patches, source edits outside allowed authored UI, or direct model/data repair invalidate UI acceptance.
Alternative: broad snapshot tests without semantic oracles would miss correct-looking wrong totals or parent selection.

## D4 — Honest evidence and closure

Decision: record failed/blocked/skipped/unverified separately, preserve every run, and require two clean complete cycles on final code plus review by a different author identity.
Rationale: a finite release decision needs all mandatory behavior to pass; reruns are useful only if they do not erase failures. Cosmetic deferrals cannot waive a broken journey.
Alternative: an accumulated test-count tally and endless happy-path sessions do not establish a stopping condition.

## Governance status

Project charter absent; no charter synthesis or hosted login was requested. Local mission creation, substantive spec commit and clean Decision Moment verification succeeded. Hosted journal/sync warnings are recorded as unavailable/skipped, not success. No unresolved research question prevents planning; candidate product failures are execution work, not missing intent.
