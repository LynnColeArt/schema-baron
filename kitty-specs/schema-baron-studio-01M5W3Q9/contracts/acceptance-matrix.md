# Requirement-to-evidence matrix

Status of every case below: **Planned — not executed**. Test IDs are acceptance cases, not work packages. Tests must exercise real authoring/runtime effects, not merely mirror implementation helpers.

| Case | Requirements | Required independent evidence |
|---|---|---|
| AT-01 Project and workspace | FR-001, FR-002, FR-003, FR-005 | Blank create/save/reopen/switch/export, multi-form page, contextual selection, invalid draft/focus, undo/redo, newer-format refusal; screenshots and persisted identities. |
| AT-02 Wizard workflow | FR-004, FR-011, FR-024 | Project/Grid/Record/Search/Login/linked wizard completion and cancellation; inspect ordinary editable output, bindings, lookups, appearance and events. |
| AT-03 Schema authoring | FR-006, FR-007, FR-008 | Fresh SQLite and external import; quoted identifiers, composite PK/FK, null/default/check/unique/index; canvas and table editing, introspected physical assertions. |
| AT-04 Migration recovery | FR-009, FR-010 | Reviewed rename/backfill/rebuild, cancellation/staleness/external modification, unsupported dependency refusal, backup restore review, failure/restart after DB commit; row/object checksums and migration journal. |
| AT-05 CRUD and returns | FR-012, FR-013, FR-014 | Real app search/sort/page/empty state, add/edit/delete/Cancel, named confirmation, field/summary validation, composite keys, parent filters, blocked related deletion; independent SQL assertions. |
| AT-06 Login/access | FR-015, FR-016, FR-017 | Visible setup/user provisioning, public default/protected page/action, header identity, logout, direct anonymous/CSRF/forged-key writes, invalid return targets and successful internal resumption. |
| AT-07 Query/report | FR-018, FR-019, FR-020 | Outer joins, WHERE/HAVING, parameters, grouping, zero children, fanout prevention, precision, sorting, bounds/timeouts; report links/filters before/after writes and regeneration; independent arithmetic oracle. |
| AT-08 Flow views | FR-021, FR-022 | Application/schema/endpoint views separate; select node/edge to edit parameters/policy/return rule; dangling-link diagnostic; graph updates from model edits. |
| AT-09 Modes and output | FR-023, FR-025, FR-026, FR-027 | Design/HTML consistency, Code ownership and custom hook, draft preview/live route, output diff/conflict, two regenerations, interrupted promotion recovery, standalone clean production build/run, unchanged authored bytes/data. |
| AT-10 UI/MCP parity | FR-028, FR-029 | Equivalent operation traces and diagnostic codes; invalid/stale requests, request idempotency, lease contention, agent change reflected with dirty UI draft retained; no second writer. |
| AT-11 Complete independent projects | FR-030 | Equipment Desk plus Publication Catalog authored through visible product workflows, no hidden schema/model edits; separate data/users/output, second schema includes composite key. Retain walkthrough recordings/notes and app/database assertions. |

## Quality and constraints

| Requirement | Measurement or review |
|---|---|
| NFR-001 | Recorded machine and 50/200/1,000 fixture; 30 selection/property operations, p95 <200 ms; service-ready reopen <3 s. |
| NFR-002 | 50-table/500-column and 100-node graph; 20 draft-preserving edits; 10,000-row indexed paging p95 <1 s with sample count stated. |
| NFR-003 | AT-04/09 failure/restart matrix and before/after row/file checksums; no unplanned differences. |
| NFR-004 | Direct protected route tests; compiler binding assertions; credential scans of logs/export/client output; hash/salt verification, session expiry/revocation. |
| NFR-005 | Keyboard walkthrough for all primary authoring tasks; focus/label review and screenshots at 200% zoom/1280×800. |
| NFR-006 | Both output apps strict typecheck, production build and runtime tests outside workspace; module-boundary review and two-cycle extension byte comparison. |
| NFR-007 | AT-10 complete parity corpus; compare normalized state/codes and persisted revisions. |
| NFR-008 | 1280×800/1920×1080 annotated screenshots against indexed PDF pages, all workspace regions/modes/property tabs and no persistent wizard. |
| NFR-009 | Exact decimal oracle for fractions, zero children, totals and filters; run both designer preview and generated app. |
| NFR-010 | Clean-checkout documented setup and output builds, no unpublished services, offline authoring after install. |
| C-001, C-004 | Lock/runtime/output architecture checks: one target, explicit server/client boundaries, no Studio runtime import or data writes in rendering. |
| C-002, C-006 | Manual provenance and visual deviations; PDF/derivatives ignored, authored index/converter versioned. |
| C-003, C-007 | Shared operation/projection contract tests and source review for fixture-specific identifiers outside tests. |
| C-005, C-008 | Preserved archive reference; no demo secrets in repo; feat/schema-baron-studio consolidation and later main PR. |

## Evidence record shape

For each run record case ID, source revision, environment, setup performed through UI/MCP, expected outcome, observed result, redacted artifact paths and pass/fail with limitations. A screenshot alone does not prove data integrity or authorization. Test-only disposable data deletion must be distinguished from retained reference data. Evidence must not include passwords/tokens or the copyrighted manual pack in public Git.
