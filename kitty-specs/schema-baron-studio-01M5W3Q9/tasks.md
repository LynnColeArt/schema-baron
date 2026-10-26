# Work packages: Schema Baron Studio

**Mission**: `schema-baron-studio-01M5W3Q9`  
**Generated**: 2026-10-26T13:35:53Z  
**Planning/consolidation branch**: `feat/schema-baron-studio`; later PR into `main`.

This breakdown implements the confirmed full-app spec. Every WP is required. Priorities and milestones describe execution order, not reductions in scope. All subtasks are planned; markdown rows are references only. Status is solely event-sourced.

## Delivery milestones

- Foundation: WP01–WP04 provide a reproducible workspace, validated model, durable commands and UI/MCP parity.
- Authoring and data: WP05–WP09 deliver compact workspace, connections, schema editing and reviewed migrations.
- First usable output: WP10 produces a real public Grid; WP11–WP14 complete normal editing, CRUD and login.
- Reports and understanding: WP15–WP18 add query design, exact derived totals and application flow map.
- Complete ownership loop: WP19–WP21 finish document modes, custom code, regeneration, Live Page and export.
- Acceptance: WP22–WP26 prove two unrelated apps, recovery, quality budgets and clean-install readiness.

First user-visible checkpoint is WP05 for the shell; first application MVP is the dependency closure through WP10, not bootstrap alone. The public-list MVP is not whole-app acceptance. No implementation starts without the persisted analysis readiness report.

## Dependency and parallelism notes

Explicit dependencies below and in prompt frontmatter are authoritative. The finalizer computes lanes; do not assume one worktree per WP or invent lane branches. Primary ownership is disjoint. Shared bootstrap/registry integration edits must be minimal, recorded and serialized with their owner.

- Workspace/connection setup is ordered so the connection UI has a real shell before review.
- After WP06, query compilation can proceed while schema editing/migration features advance.
- After schema planning, the schema UI and migration executor have separate owned surfaces.
- Document-mode work can proceed alongside auth/query features once form construction exists.
- Recovery and usability acceptance packages can run independently after their full dependencies.
- Parallel opportunities describe safe scheduling only; no agents have been dispatched by task authoring.

## WP01 — Reproducible workspace and dependency baseline

**Priority**: P1  
**Dependencies**: None  
**Prompt**: [tasks/WP01-reproducible-workspace-and-dependency-baseline.md](tasks/WP01-reproducible-workspace-and-dependency-baseline.md)  
**Size**: 5 subtasks; 321 lines.  
**Requirement refs**: NFR-006, NFR-010, C-001, C-005, C-006.

A clean checkout has a pinned, compatible TypeScript/Node workspace and repeatable
verification tools, without creating application features or importing old demo secrets.

**Independent test**: On the declared Node 24 patch, install the reviewed lockfile with scripts denied by default, compile a temporary minimal module and run the test harness offline after dependency installation.

**Included subtasks** (reference rows, not checkboxes):

T001 Pin and verify the dependency set (WP01)
T002 Create the workspace manifests and build contracts (WP01)
T003 Provide the verification and CI harness (WP01)
T004 Document local prerequisites and isolation (WP01)
T005 Verify bootstrap and supply-chain readiness (WP01)

**Implementation sketch**: Pin and verify the dependency set → Create the workspace manifests and build contracts → Provide the verification and CI harness → Document local prerequisites and isolation → Verify bootstrap and supply-chain readiness.

**Risks**: Planning version observations are not a validated install set; native lifecycle scripts and fresh releases need actual evidence, not an audit claim copied from research.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP02 — Canonical project model and validation

**Priority**: P1  
**Dependencies**: WP01  
**Prompt**: [tasks/WP02-canonical-project-model-and-validation.md](tasks/WP02-canonical-project-model-and-validation.md)  
**Size**: 5 subtasks; 253 lines.  
**Requirement refs**: FR-001, FR-003, FR-007, FR-008, FR-011, FR-016, FR-018, FR-020, FR-029, C-003, C-007.

Define runtime-validated versioned entities and invariants for all downstream features,
independent of React, filesystem and transports.

**Independent test**: Validate two unrelated project definitions, reject broken key tuples and ambiguous query grain, and retain IDs through a physical-name change.

**Included subtasks** (reference rows, not checkboxes):

T006 Define versioned entities and identity (WP02)
T007 Define query and expression contracts (WP02)
T008 Validate cross-entity relationships (WP02)
T009 Define command and reviewed-plan types (WP02)
T010 Verify generality and boundary behavior (WP02)

**Implementation sketch**: Define versioned entities and identity → Define query and expression contracts → Validate cross-entity relationships → Define command and reviewed-plan types → Verify generality and boundary behavior.

**Risks**: An underspecified model forces later schema-specific patches; separate stable IDs from physical names and keep drafts distinct from valid committed snapshots.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP03 — Project storage and revision-checked command core

**Priority**: P1  
**Dependencies**: WP02  
**Prompt**: [tasks/WP03-project-storage-and-revision-checked-command-core.md](tasks/WP03-project-storage-and-revision-checked-command-core.md)  
**Size**: 5 subtasks; 260 lines.  
**Requirement refs**: FR-001, FR-005, FR-025, FR-029, NFR-003, NFR-007, C-003.

Persist readable project definitions safely, provide the shared command registry and
reject stale or partially valid writes.

**Independent test**: Create, batch-edit, save and reopen a project; retry a request; then inject a crash between metadata and file replacement and recover one coherent revision.

**Included subtasks** (reference rows, not checkboxes):

T011 Implement owner-scoped storage and locking (WP03)
T012 Implement revisioned command execution (WP03)
T013 Implement save journal and recovery (WP03)
T014 Publish revisions and immutable plan records (WP03)
T015 Verify lifecycle and exportable definitions (WP03)

**Implementation sketch**: Implement owner-scoped storage and locking → Implement revisioned command execution → Implement save journal and recovery → Publish revisions and immutable plan records → Verify lifecycle and exportable definitions.

**Risks**: JSON files and SQLite metadata cannot commit atomically together; journal actual outcomes and reconcile before accepting another writer.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP04 — Owner HTTP service and day-one MCP adapter

**Priority**: P1  
**Dependencies**: WP03  
**Prompt**: [tasks/WP04-owner-http-service-and-day-one-mcp-adapter.md](tasks/WP04-owner-http-service-and-day-one-mcp-adapter.md)  
**Size**: 5 subtasks; 257 lines.  
**Requirement refs**: FR-001, FR-028, FR-029, NFR-004, NFR-007, C-003.

Expose the same implemented commands to the browser and local MCP with one project
writer and matching outcomes.

**Independent test**: Create/inspect/change a project via UI transport and MCP, compare normalized state and diagnostics, and reject a stale mutation in both.

**Included subtasks** (reference rows, not checkboxes):

T016 Implement the versioned owner HTTP adapter (WP04)
T017 Implement local MCP forwarding (WP04)
T018 Add job and sequenced-event endpoints (WP04)
T019 Provide extensible feature registration (WP04)
T020 Verify transport parity and access boundaries (WP04)

**Implementation sketch**: Implement the versioned owner HTTP adapter → Implement local MCP forwarding → Add job and sequenced-event endpoints → Provide extensible feature registration → Verify transport parity and access boundaries.

**Risks**: Loopback is not authentication; the MCP process must forward to the owner service rather than open another mutable project store.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP05 — Compact Studio shell and project editing state

**Priority**: P1  
**Dependencies**: WP04  
**Prompt**: [tasks/WP05-compact-studio-shell-and-project-editing-state.md](tasks/WP05-compact-studio-shell-and-project-editing-state.md)  
**Size**: 5 subtasks; 261 lines.  
**Requirement refs**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-024, NFR-001, NFR-005, NFR-008, C-002.

Deliver a real compact workspace with contextual object selection, blank-project setup
and draft continuity.

**Independent test**: Create a blank project, add two pages and forms, edit contextual properties, switch objects, undo/redo and reopen without losing drafts or identities.

**Included subtasks** (reference rows, not checkboxes):

T021 Build early-Studio workspace chrome (WP05)
T022 Implement selection and contextual properties (WP05)
T023 Implement blank-project lifecycle UI (WP05)
T024 Implement drafts, undo/redo and revision reconciliation (WP05)
T025 Verify workspace and first agent-visible changes (WP05)

**Implementation sketch**: Build early-Studio workspace chrome → Implement selection and contextual properties → Implement blank-project lifecycle UI → Implement drafts, undo/redo and revision reconciliation → Verify workspace and first agent-visible changes.

**Risks**: A polished shell with disconnected fake properties does not satisfy this slice; every committed edit must use the shared command service.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP06 — SQLite connections and lossless introspection

**Priority**: P1  
**Dependencies**: WP04, WP05  
**Prompt**: [tasks/WP06-sqlite-connections-and-lossless-introspection.md](tasks/WP06-sqlite-connections-and-lossless-introspection.md)  
**Size**: 5 subtasks; 253 lines.  
**Requirement refs**: FR-006, FR-029, NFR-004, C-007.

Connect/create real SQLite databases through Studio and MCP with explicit capabilities
and lossless unsupported-object reporting.

**Independent test**: Connect an external DB containing quoted identifiers, composite keys, indexes and a trigger, then reconnect it after relocation without changing its data.

**Included subtasks** (reference rows, not checkboxes):

T026 Implement the SQLite worker adapter (WP06)
T027 Implement capability-aware introspection (WP06)
T028 Register connection inspect/bind operations (WP06)
T029 Build connection setup and inspection UI (WP06)
T030 Verify connection safety and parity (WP06)

**Implementation sketch**: Implement the SQLite worker adapter → Implement capability-aware introspection → Register connection inspect/bind operations → Build connection setup and inspection UI → Verify connection safety and parity.

**Risks**: Copying a live WAL file or normalizing unknown triggers/constraints away can corrupt imported applications; introspection must retain opaque source.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP07 — Schema diff and reviewed migration planning

**Priority**: P1  
**Dependencies**: WP06, WP02  
**Prompt**: [tasks/WP07-schema-diff-and-reviewed-migration-planning.md](tasks/WP07-schema-diff-and-reviewed-migration-planning.md)  
**Size**: 5 subtasks; 248 lines.  
**Requirement refs**: FR-007, FR-008, FR-009, FR-010, NFR-003, C-007.

Compile desired schema changes into immutable reviewed SQL/data-impact plans with
explicit SQLite support boundaries.

**Independent test**: Plan a rename plus required-field backfill against populated data, inspect exact impact, and reject unsupported trigger-dependent changes before apply.

**Included subtasks** (reference rows, not checkboxes):

T031 Define stable-ID schema diff semantics (WP07)
T032 Compile constrained SQLite DDL (WP07)
T033 Compute data impact and backfill requirements (WP07)
T034 Register immutable schema preview plans (WP07)
T035 Verify planning with independent schema assertions (WP07)

**Implementation sketch**: Define stable-ID schema diff semantics → Compile constrained SQLite DDL → Compute data impact and backfill requirements → Register immutable schema preview plans → Verify planning with independent schema assertions.

**Risks**: Name-based diffing can mistake renames for drop/create and silently lose data or dependent objects.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP08 — Visual schema table and relationship editor

**Priority**: P1  
**Dependencies**: WP05, WP07  
**Prompt**: [tasks/WP08-visual-schema-table-and-relationship-editor.md](tasks/WP08-visual-schema-table-and-relationship-editor.md)  
**Size**: 5 subtasks; 243 lines.  
**Requirement refs**: FR-007, FR-008, FR-009, NFR-002, NFR-005, C-002.

Create an entirely new schema through modern table editing and a selectable relationship
canvas, then review its migration proposal.

**Independent test**: From blank SQLite, author tables with constraints and a composite relationship, review SQL/impact, cancel a destructive edit, and reopen the same schema layout.

**Included subtasks** (reference rows, not checkboxes):

T036 Implement table and column editing (WP08)
T037 Implement relationship canvas (WP08)
T038 Build keyboard and unsupported-object alternatives (WP08)
T039 Present migration review and acknowledgement (WP08)
T040 Verify visible schema construction (WP08)

**Implementation sketch**: Implement table and column editing → Implement relationship canvas → Build keyboard and unsupported-object alternatives → Present migration review and acknowledgement → Verify visible schema construction.

**Risks**: Canvas layout cannot become a second schema definition, and connecting lines must map ordered composite columns explicitly.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP09 — Migration apply, backup and crash recovery

**Priority**: P1  
**Dependencies**: WP07, WP04  
**Prompt**: [tasks/WP09-migration-apply-backup-and-crash-recovery.md](tasks/WP09-migration-apply-backup-and-crash-recovery.md)  
**Size**: 5 subtasks; 248 lines.  
**Requirement refs**: FR-009, FR-010, FR-029, NFR-003, NFR-007.

Apply reviewed schema plans with real SQLite transactions/backups, durable outcome
markers and startup reconciliation.

**Independent test**: Apply a data-preserving rebuild, crash immediately after DB commit, restart and reconcile one committed migration with unchanged unrelated rows.

**Included subtasks** (reference rows, not checkboxes):

T041 Implement plan freshness and apply leases (WP09)
T042 Implement backups and rebuild execution (WP09)
T043 Journal actual commit state and reconcile (WP09)
T044 Expose history and reviewed restore (WP09)
T045 Verify failure matrix and preservation (WP09)

**Implementation sketch**: Implement plan freshness and apply leases → Implement backups and rebuild execution → Journal actual commit state and reconcile → Expose history and reviewed restore → Verify failure matrix and preservation.

**Risks**: Database commit can succeed before project/history finalization; a retry must not run DDL twice or restore over later data.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP10 — First standalone generated public list

**Priority**: P1  
**Dependencies**: WP05, WP06, WP08, WP09  
**Prompt**: [tasks/WP10-first-standalone-generated-public-list.md](tasks/WP10-first-standalone-generated-public-list.md)  
**Size**: 5 subtasks; 267 lines.  
**Requirement refs**: FR-011, FR-012, FR-025, FR-027, NFR-006, C-001, C-004, C-007.

Complete the first real vertical loop: blank project to connected schema to Grid to
independently runnable Next.js output, with MCP parity.

**Independent test**: Author an arbitrary simple table/Grid through UI, review output and run the public list from a clean generated directory without Studio imports.

**Included subtasks** (reference rows, not checkboxes):

T046 Compile validated project into typed generation IR (WP10)
T047 Emit an ordinary Next.js application skeleton (WP10)
T048 Generate public Grid rendering and reads (WP10)
T049 Add initial generation preview and safe first write (WP10)
T050 Verify the first authoring-to-output loop (WP10)

**Implementation sketch**: Compile validated project into typed generation IR → Emit an ordinary Next.js application skeleton → Generate public Grid rendering and reads → Add initial generation preview and safe first write → Verify the first authoring-to-output loop.

**Risks**: Generating a model interpreter tied to Studio or hardcoding a fixture route would repeat the old demo-specific design.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP11 — Form controls, focused wizards and binding properties

**Priority**: P1  
**Dependencies**: WP08, WP10  
**Prompt**: [tasks/WP11-form-controls-focused-wizards-and-binding-properties.md](tasks/WP11-form-controls-focused-wizards-and-binding-properties.md)  
**Size**: 5 subtasks; 247 lines.  
**Requirement refs**: FR-003, FR-004, FR-011, FR-024, NFR-005, C-002.

Create and then edit Grid, Record, Search and Login forms as ordinary page objects, with
field-aware controls and explicit links/actions.

**Independent test**: Construct a multi-form page, cancel another wizard, and change a field binding or Save/Cancel destination through contextual Properties.

**Included subtasks** (reference rows, not checkboxes):

T051 Implement atomic form construction commands (WP11)
T052 Build focused form wizards (WP11)
T053 Provide controls and contextual data bindings (WP11)
T054 Expose appearance and declared actions/events (WP11)
T055 Verify wizards and post-wizard editing (WP11)

**Implementation sketch**: Implement atomic form construction commands → Build focused form wizards → Provide controls and contextual data bindings → Expose appearance and declared actions/events → Verify wizards and post-wizard editing.

**Risks**: Wizard-only objects or untyped event strings would make normal editing inconsistent and hide behavior from the map/MCP.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP12 — Generated search and complete Record lifecycle

**Priority**: P1  
**Dependencies**: WP11  
**Prompt**: [tasks/WP12-generated-search-and-complete-record-lifecycle.md](tasks/WP12-generated-search-and-complete-record-lifecycle.md)  
**Size**: 5 subtasks; 249 lines.  
**Requirement refs**: FR-012, FR-013, FR-014, NFR-004, NFR-006, C-004, C-007.

Generate server-validated CRUD/search with clear errors, confirmations and correct
parent-filtered Save/Cancel/Delete return paths.

**Independent test**: Add, edit, cancel and delete a disposable record; attempt a restricted parent deletion; verify retained invalid input and correct filtered returns.

**Included subtasks** (reference rows, not checkboxes):

T056 Generate validated list/search handling (WP12)
T057 Generate transactional create/update services (WP12)
T058 Generate named delete confirmation and errors (WP12)
T059 Implement safe navigation and return context (WP12)
T060 Verify generated behavior against SQLite (WP12)

**Implementation sketch**: Generate validated list/search handling → Generate transactional create/update services → Generate named delete confirmation and errors → Implement safe navigation and return context → Verify generated behavior against SQLite.

**Risks**: UI-only validation or raw referential SQL errors must not leak through; a multi-field write/delete must be atomic.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP13 — Generated identity store, sessions and access enforcement

**Priority**: P1  
**Dependencies**: WP12  
**Prompt**: [tasks/WP13-generated-identity-store-sessions-and-access-enforcement.md](tasks/WP13-generated-identity-store-sessions-and-access-enforcement.md)  
**Size**: 5 subtasks; 253 lines.  
**Requirement refs**: FR-015, FR-016, FR-017, NFR-004, C-004, C-007.

Provide secure simple local login and server enforcement of explicit global/page/action
policies, independent of Studio owner credentials.

**Independent test**: Provision a user, sign in/out, make direct protected requests and confirm public list reads remain available while anonymous writes fail.

**Included subtasks** (reference rows, not checkboxes):

T061 Implement identity source and provisioning service (WP13)
T062 Generate opaque session lifecycle (WP13)
T063 Enforce effective read and action policies (WP13)
T064 Validate CSRF and login return targets (WP13)
T065 Verify auth boundaries independently (WP13)

**Implementation sketch**: Implement identity source and provisioning service → Generate opaque session lifecycle → Enforce effective read and action policies → Validate CSRF and login return targets → Verify auth boundaries independently.

**Risks**: Default passwords, plaintext legacy identity mapping, client-only enforcement and unsafe return URLs are unacceptable shortcuts.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP14 — Studio login configuration and protected-page workflow

**Priority**: P1  
**Dependencies**: WP11, WP13  
**Prompt**: [tasks/WP14-studio-login-configuration-and-protected-page-workflow.md](tasks/WP14-studio-login-configuration-and-protected-page-workflow.md)  
**Size**: 5 subtasks; 245 lines.  
**Requirement refs**: FR-004, FR-014, FR-015, FR-016, FR-017, NFR-005, C-002.

Configure simple login through usable project/page/action editors and generate friendly
Login/Logout/identity controls with correct return context.

**Independent test**: Keep a list public, protect one page and write actions, provision a test user, then log out and sign back in to the selected record.

**Included subtasks** (reference rows, not checkboxes):

T066 Build project identity setup and provisioning UI (WP14)
T067 Build global/page/action policy controls (WP14)
T068 Generate Login/Logout and identity page controls (WP14)
T069 Generate friendly prompts and return context (WP14)
T070 Verify public-read/protected-write walkthrough (WP14)

**Implementation sketch**: Build project identity setup and provisioning UI → Build global/page/action policy controls → Generate Login/Logout and identity page controls → Generate friendly prompts and return context → Verify public-read/protected-write walkthrough.

**Risks**: An empty auth array or a global-only login switch would repeat the original confusion; expose inherited and effective policy separately.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP15 — Safe query compiler and exact derived arithmetic

**Priority**: P2 (required)  
**Dependencies**: WP06, WP02  
**Prompt**: [tasks/WP15-safe-query-compiler-and-exact-derived-arithmetic.md](tasks/WP15-safe-query-compiler-and-exact-derived-arithmetic.md)  
**Size**: 5 subtasks; 252 lines.  
**Requirement refs**: FR-018, FR-020, NFR-004, NFR-009, C-007.

Compile reusable structured queries with bound parameters, explicit aggregate grain and
exact decimal arithmetic.

**Independent test**: Compute totals for parents with zero, one and multiple children and a minimum-total HAVING parameter; compare to an independent exact-decimal oracle.

**Included subtasks** (reference rows, not checkboxes):

T071 Compile typed queries and expressions (WP15)
T072 Enforce grouping and aggregate grain (WP15)
T073 Implement exact decimal codecs and SQL helpers (WP15)
T074 Expose bounded read-only query preview (WP15)
T075 Verify compiler and numeric semantics (WP15)

**Implementation sketch**: Compile typed queries and expressions → Enforce grouping and aggregate grain → Implement exact decimal codecs and SQL helpers → Expose bounded read-only query preview → Verify compiler and numeric semantics.

**Risks**: Outer-join omissions, aggregate fanout and floating-point accumulation can produce plausible but wrong reports.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP16 — Visual query designer and saved data sources

**Priority**: P2 (required)  
**Dependencies**: WP08, WP15  
**Prompt**: [tasks/WP16-visual-query-designer-and-saved-data-sources.md](tasks/WP16-visual-query-designer-and-saved-data-sources.md)  
**Size**: 5 subtasks; 237 lines.  
**Requirement refs**: FR-018, FR-019, NFR-005, C-002.

Provide the focused Data Source query window with visible joins, projections,
parameters, grouping and bounded results.

**Independent test**: Build and save a joined aggregate query in the designer, inspect SQL/results and reopen it through a form Data Source property.

**Included subtasks** (reference rows, not checkboxes):

T076 Build focused source/join canvas (WP16)
T077 Build field/expression/group/sort editors (WP16)
T078 Build typed parameter and review panels (WP16)
T079 Save and reuse named queries (WP16)
T080 Verify the complete query-authoring path (WP16)

**Implementation sketch**: Build focused source/join canvas → Build field/expression/group/sort editors → Build typed parameter and review panels → Save and reuse named queries → Verify the complete query-authoring path.

**Risks**: A second manually maintained SQL representation or unrestricted raw execution bypass would drift from the typed query model.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP17 — Query-backed reports and refreshed child-derived values

**Priority**: P2 (required)  
**Dependencies**: WP12, WP16  
**Prompt**: [tasks/WP17-query-backed-reports-and-refreshed-child-derived-values.md](tasks/WP17-query-backed-reports-and-refreshed-child-derived-values.md)  
**Size**: 5 subtasks; 249 lines.  
**Requirement refs**: FR-014, FR-019, FR-020, NFR-006, NFR-009, C-007.

Use saved queries to generate public filterable reports with child links, exact totals
and correct refresh after writes.

**Independent test**: Bind the aggregate query to a report, add/edit/delete a child amount and verify totals plus minimum-total filtering update before and after regeneration.

**Included subtasks** (reference rows, not checkboxes):

T081 Build report/query binding properties (WP17)
T082 Generate reusable query execution modules (WP17)
T083 Generate derived fields and dependency refresh (WP17)
T084 Generate report navigation and filter UX (WP17)
T085 Verify totals and persistence through regeneration (WP17)

**Implementation sketch**: Build report/query binding properties → Generate reusable query execution modules → Generate derived fields and dependency refresh → Generate report navigation and filter UX → Verify totals and persistence through regeneration.

**Risks**: Correct designer preview is insufficient if generated SQL differs or route caching keeps old totals after a save.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP18 — Application behavior map and endpoint projection

**Priority**: P2 (required)  
**Dependencies**: WP14, WP17  
**Prompt**: [tasks/WP18-application-behavior-map-and-endpoint-projection.md](tasks/WP18-application-behavior-map-and-endpoint-projection.md)  
**Size**: 5 subtasks; 244 lines.  
**Requirement refs**: FR-021, FR-022, NFR-002, NFR-005, C-003.

Derive a selectable flow chart of application behavior and parameter movement, separate
from schema relationships.

**Independent test**: Follow list to record to login to save/Cancel in the map, edit one edge mapping in Properties and observe the map update from canonical state.

**Included subtasks** (reference rows, not checkboxes):

T086 Derive application nodes and semantic edges (WP18)
T087 Implement endpoint and diagnostic projections (WP18)
T088 Render compact selectable behavior chart (WP18)
T089 Provide keyboard navigation and scalable layout (WP18)
T090 Verify map/runtime correspondence (WP18)

**Implementation sketch**: Derive application nodes and semantic edges → Implement endpoint and diagnostic projections → Render compact selectable behavior chart → Provide keyboard navigation and scalable layout → Verify map/runtime correspondence.

**Risks**: A route inventory alone misses the killer feature; edges must show auth gates, write outcomes, Cancel and return context.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP19 — Design and HTML editing with working document modes

**Priority**: P2 (required)  
**Dependencies**: WP11, WP10  
**Prompt**: [tasks/WP19-design-and-html-editing-with-working-document-modes.md](tasks/WP19-design-and-html-editing-with-working-document-modes.md)  
**Size**: 5 subtasks; 249 lines.  
**Requirement refs**: FR-003, FR-005, FR-023, FR-024, NFR-005, NFR-008, C-002.

Make Design/HTML/Code/Preview/Live Page coherent views of the selected page with
explicit supported edit boundaries.

**Independent test**: Edit supported HTML and a form control, switch to Design/Preview and back, retain selection/drafts and explain unsupported markup without destructive rewriting.

**Included subtasks** (reference rows, not checkboxes):

T091 Implement the structured page document edit surface (WP19)
T092 Connect Design and HTML views (WP19)
T093 Implement draft Preview isolation (WP19)
T094 Wire Code and Live Page mode contracts (WP19)
T095 Verify mode continuity and visual density (WP19)

**Implementation sketch**: Implement the structured page document edit surface → Connect Design and HTML views → Implement draft Preview isolation → Wire Code and Live Page mode contracts → Verify mode continuity and visual density.

**Risks**: Pretending arbitrary HTML/TSX can roundtrip through visual forms would lose authored content or create unsafe execution paths.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP20 — Regeneration ownership, authored extensions and recovery

**Priority**: P2 (required)  
**Dependencies**: WP10, WP12, WP13, WP17, WP19  
**Prompt**: [tasks/WP20-regeneration-ownership-authored-extensions-and-recovery.md](tasks/WP20-regeneration-ownership-authored-extensions-and-recovery.md)  
**Size**: 5 subtasks; 263 lines.  
**Requirement refs**: FR-023, FR-024, FR-025, FR-026, FR-027, NFR-003, NFR-006, C-004.

Regenerate complete output without overwriting data/custom code, with visible conflicts
and recovery from interrupted promotion.

**Independent test**: Add a handwritten validator/action, change a form, preview/regenerate twice and preserve extension bytes plus database contents; inject a promotion failure and recover.

**Included subtasks** (reference rows, not checkboxes):

T096 Implement deterministic ownership manifests (WP20)
T097 Implement authored extension contracts and editing (WP20)
T098 Implement staged complete output promotion (WP20)
T099 Resolve ownership conflicts and upgrades visibly (WP20)
T100 Verify preservation and standalone output (WP20)

**Implementation sketch**: Implement deterministic ownership manifests → Implement authored extension contracts and editing → Implement staged complete output promotion → Resolve ownership conflicts and upgrades visibly → Verify preservation and standalone output.

**Risks**: Generated source changes, authored extensions and live application data require different ownership; never resolve a conflict by silently replacing files.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP21 — Managed runtime jobs, Live Page and portable export

**Priority**: P2 (required)  
**Dependencies**: WP04, WP20  
**Prompt**: [tasks/WP21-managed-runtime-jobs-live-page-and-portable-export.md](tasks/WP21-managed-runtime-jobs-live-page-and-portable-export.md)  
**Size**: 5 subtasks; 253 lines.  
**Requirement refs**: FR-001, FR-023, FR-027, FR-029, NFR-004, NFR-010.

Build/run/stop generated applications explicitly, navigate the selected Live Page and
export portable output without Studio dependencies or secrets.

**Independent test**: Start a generated app, open the selected route, stop it cleanly and export to a clean directory that builds/runs after Studio is shut down.

**Included subtasks** (reference rows, not checkboxes):

T101 Implement explicit build/start process jobs (WP21)
T102 Implement runtime status and route resolution (WP21)
T103 Build runtime controls and diagnostics UI (WP21)
T104 Implement portable definition/output export (WP21)
T105 Verify processes, exports and offline authoring (WP21)

**Implementation sketch**: Implement explicit build/start process jobs → Implement runtime status and route resolution → Build runtime controls and diagnostics UI → Implement portable definition/output export → Verify processes, exports and offline authoring.

**Risks**: Opening a model must not automatically run install scripts or authored code; process cleanup and data locations must be explicit.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP22 — Equipment Desk end-to-end authoring acceptance

**Priority**: P2 (required)  
**Dependencies**: WP09, WP14, WP17, WP18, WP20, WP21  
**Prompt**: [tasks/WP22-equipment-desk-end-to-end-authoring-acceptance.md](tasks/WP22-equipment-desk-end-to-end-authoring-acceptance.md)  
**Size**: 5 subtasks; 274 lines.  
**Requirement refs**: FR-001, FR-003, FR-004, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-023, FR-024, FR-025, FR-026, FR-027, FR-030, NFR-006, NFR-009, C-007.

Prove the first complete application is authored through the product rather than
assembled by hidden setup scripts.

**Independent test**: Complete the quickstart Equipment Desk journey through Studio, then operate its generated app and verify preserved data/settings after two regenerations.

**Included subtasks** (reference rows, not checkboxes):

T106 Author schema and interfaces through real UI (WP22)
T107 Exercise auth and Record happy/exception paths (WP22)
T108 Author report and inspect application map (WP22)
T109 Evolve and regenerate the application (WP22)
T110 Retain honest walkthrough evidence (WP22)

**Implementation sketch**: Author schema and interfaces through real UI → Exercise auth and Record happy/exception paths → Author report and inspect application map → Evolve and regenerate the application → Retain honest walkthrough evidence.

**Risks**: Lower-level fixture setup is useful but cannot substitute for the visible blank-project schema/page/query/auth workflow.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP23 — Second project generality and UI-MCP parity acceptance

**Priority**: P2 (required)  
**Dependencies**: WP22  
**Prompt**: [tasks/WP23-second-project-generality-and-ui-mcp-parity-acceptance.md](tasks/WP23-second-project-generality-and-ui-mcp-parity-acceptance.md)  
**Size**: 5 subtasks; 251 lines.  
**Requirement refs**: FR-001, FR-028, FR-029, FR-030, NFR-007, C-003, C-007.

Build an unrelated publication catalog with composite keys and prove matching UI/agent
semantics across both projects.

**Independent test**: Author Publication Catalog from blank, switch between both projects, and replay equivalent UI/MCP changes with stale/invalid cases and isolated users/data.

**Included subtasks** (reference rows, not checkboxes):

T111 Author the unrelated schema through Studio (WP23)
T112 Repeat application capabilities and persistence (WP23)
T113 Replay the complete shared operation corpus (WP23)
T114 Verify cross-project and concurrent draft isolation (WP23)
T115 Publish generality evidence and defect triage (WP23)

**Implementation sketch**: Author the unrelated schema through Studio → Repeat application capabilities and persistence → Replay the complete shared operation corpus → Verify cross-project and concurrent draft isolation → Publish generality evidence and defect triage.

**Risks**: A second fixture driven by the first app names or hidden engine edits would not demonstrate a general builder.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP24 — Cross-boundary failure and recovery acceptance

**Priority**: P2 (required)  
**Dependencies**: WP09, WP20, WP21, WP23  
**Prompt**: [tasks/WP24-cross-boundary-failure-and-recovery-acceptance.md](tasks/WP24-cross-boundary-failure-and-recovery-acceptance.md)  
**Size**: 5 subtasks; 248 lines.  
**Requirement refs**: FR-010, FR-025, FR-026, FR-029, NFR-003, NFR-004.

Validate recovery across actual process crashes, external DB changes, output conflicts
and concurrent requests at subsystem boundaries.

**Independent test**: Crash isolated test processes at each durable boundary, restart and independently compare active model, data, output, extensions and recovery journal.

**Included subtasks** (reference rows, not checkboxes):

T116 Build a process-level fault harness (WP24)
T117 Verify project and migration reconciliation (WP24)
T118 Verify generation conflict and promotion recovery (WP24)
T119 Challenge cross-boundary security and cancellation (WP24)
T120 Retain recovery and preservation results (WP24)

**Implementation sketch**: Build a process-level fault harness → Verify project and migration reconciliation → Verify generation conflict and promotion recovery → Challenge cross-boundary security and cancellation → Retain recovery and preservation results.

**Risks**: Unit-level injected exceptions do not prove real restart behavior across database commit and filesystem promotion.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP25 — Workspace fidelity, keyboard access and measured scale

**Priority**: P2 (required)  
**Dependencies**: WP18, WP19, WP21, WP23  
**Prompt**: [tasks/WP25-workspace-fidelity-keyboard-access-and-measured-scale.md](tasks/WP25-workspace-fidelity-keyboard-access-and-measured-scale.md)  
**Size**: 5 subtasks; 252 lines.  
**Requirement refs**: FR-002, FR-005, FR-022, NFR-001, NFR-002, NFR-005, NFR-008, C-002, C-006.

Measure editing/query budgets and verify the early-Studio density and complete
keyboard/zoom workflows with retained evidence.

**Independent test**: Run the declared 50-page/200-form/1,000-control, 50-table and 100-node fixtures, complete keyboard journeys and review screenshots at required sizes.

**Included subtasks** (reference rows, not checkboxes):

T121 Create reproducible scale and timing fixtures (WP25)
T122 Measure response and data-read budgets (WP25)
T123 Complete keyboard and zoom walkthroughs (WP25)
T124 Review historical workspace fidelity (WP25)
T125 Triage and verify usability regressions (WP25)

**Implementation sketch**: Create reproducible scale and timing fixtures → Measure response and data-read budgets → Complete keyboard and zoom walkthroughs → Review historical workspace fidelity → Triage and verify usability regressions.

**Risks**: Screenshot resemblance alone can hide unusable focus behavior, expensive graph rerenders and loss of drafts under scale.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## WP26 — Clean-install documentation and mission readiness

**Priority**: P2 (required)  
**Dependencies**: WP24, WP25  
**Prompt**: [tasks/WP26-clean-install-documentation-and-mission-readiness.md](tasks/WP26-clean-install-documentation-and-mission-readiness.md)  
**Size**: 4 subtasks; 237 lines.  
**Requirement refs**: FR-027, FR-030, NFR-006, NFR-010, C-001, C-004, C-005, C-006, C-008.

Leave a documented runnable product and independently buildable output with complete
requirement/evidence reconciliation, without premature merge or publication.

**Independent test**: Follow only published prerequisites/instructions from a clean checkout, build/run Studio and both exports, then reconcile every requirement against real evidence.

**Included subtasks** (reference rows, not checkboxes):

T126 Write the author and extension guides (WP26)
T127 Verify clean checkout and exported runtime procedures (WP26)
T128 Reconcile requirements and release limitations (WP26)
T129 Prepare review handoff without publication (WP26)

**Implementation sketch**: Write the author and extension guides → Verify clean checkout and exported runtime procedures → Reconcile requirements and release limitations → Prepare review handoff without publication.

**Risks**: A README that assumes a developer working tree, hidden service or private fixture is not a clean-install experience.

**Parallelism**: The package may be scheduled only after its declared dependencies are approved. Its primary owned surfaces do not overlap other packages; do not parallelize edits to shared integration files without coordination.

## Subtask Index

| Subtask | Description | Work package | Parallel |
|---|---|---|---|
| T001 | Pin and verify the dependency set | WP01 | Within dependency/ownership boundary |
| T002 | Create the workspace manifests and build contracts | WP01 | Within dependency/ownership boundary |
| T003 | Provide the verification and CI harness | WP01 | Within dependency/ownership boundary |
| T004 | Document local prerequisites and isolation | WP01 | Within dependency/ownership boundary |
| T005 | Verify bootstrap and supply-chain readiness | WP01 | Within dependency/ownership boundary |
| T006 | Define versioned entities and identity | WP02 | Within dependency/ownership boundary |
| T007 | Define query and expression contracts | WP02 | Within dependency/ownership boundary |
| T008 | Validate cross-entity relationships | WP02 | Within dependency/ownership boundary |
| T009 | Define command and reviewed-plan types | WP02 | Within dependency/ownership boundary |
| T010 | Verify generality and boundary behavior | WP02 | Within dependency/ownership boundary |
| T011 | Implement owner-scoped storage and locking | WP03 | Within dependency/ownership boundary |
| T012 | Implement revisioned command execution | WP03 | Within dependency/ownership boundary |
| T013 | Implement save journal and recovery | WP03 | Within dependency/ownership boundary |
| T014 | Publish revisions and immutable plan records | WP03 | Within dependency/ownership boundary |
| T015 | Verify lifecycle and exportable definitions | WP03 | Within dependency/ownership boundary |
| T016 | Implement the versioned owner HTTP adapter | WP04 | Within dependency/ownership boundary |
| T017 | Implement local MCP forwarding | WP04 | Within dependency/ownership boundary |
| T018 | Add job and sequenced-event endpoints | WP04 | Within dependency/ownership boundary |
| T019 | Provide extensible feature registration | WP04 | Within dependency/ownership boundary |
| T020 | Verify transport parity and access boundaries | WP04 | Within dependency/ownership boundary |
| T021 | Build early-Studio workspace chrome | WP05 | Within dependency/ownership boundary |
| T022 | Implement selection and contextual properties | WP05 | Within dependency/ownership boundary |
| T023 | Implement blank-project lifecycle UI | WP05 | Within dependency/ownership boundary |
| T024 | Implement drafts, undo/redo and revision reconciliation | WP05 | Within dependency/ownership boundary |
| T025 | Verify workspace and first agent-visible changes | WP05 | Within dependency/ownership boundary |
| T026 | Implement the SQLite worker adapter | WP06 | Within dependency/ownership boundary |
| T027 | Implement capability-aware introspection | WP06 | Within dependency/ownership boundary |
| T028 | Register connection inspect/bind operations | WP06 | Within dependency/ownership boundary |
| T029 | Build connection setup and inspection UI | WP06 | Within dependency/ownership boundary |
| T030 | Verify connection safety and parity | WP06 | Within dependency/ownership boundary |
| T031 | Define stable-ID schema diff semantics | WP07 | Within dependency/ownership boundary |
| T032 | Compile constrained SQLite DDL | WP07 | Within dependency/ownership boundary |
| T033 | Compute data impact and backfill requirements | WP07 | Within dependency/ownership boundary |
| T034 | Register immutable schema preview plans | WP07 | Within dependency/ownership boundary |
| T035 | Verify planning with independent schema assertions | WP07 | Within dependency/ownership boundary |
| T036 | Implement table and column editing | WP08 | Within dependency/ownership boundary |
| T037 | Implement relationship canvas | WP08 | Within dependency/ownership boundary |
| T038 | Build keyboard and unsupported-object alternatives | WP08 | Within dependency/ownership boundary |
| T039 | Present migration review and acknowledgement | WP08 | Within dependency/ownership boundary |
| T040 | Verify visible schema construction | WP08 | Within dependency/ownership boundary |
| T041 | Implement plan freshness and apply leases | WP09 | Within dependency/ownership boundary |
| T042 | Implement backups and rebuild execution | WP09 | Within dependency/ownership boundary |
| T043 | Journal actual commit state and reconcile | WP09 | Within dependency/ownership boundary |
| T044 | Expose history and reviewed restore | WP09 | Within dependency/ownership boundary |
| T045 | Verify failure matrix and preservation | WP09 | Within dependency/ownership boundary |
| T046 | Compile validated project into typed generation IR | WP10 | Within dependency/ownership boundary |
| T047 | Emit an ordinary Next.js application skeleton | WP10 | Within dependency/ownership boundary |
| T048 | Generate public Grid rendering and reads | WP10 | Within dependency/ownership boundary |
| T049 | Add initial generation preview and safe first write | WP10 | Within dependency/ownership boundary |
| T050 | Verify the first authoring-to-output loop | WP10 | Within dependency/ownership boundary |
| T051 | Implement atomic form construction commands | WP11 | Within dependency/ownership boundary |
| T052 | Build focused form wizards | WP11 | Within dependency/ownership boundary |
| T053 | Provide controls and contextual data bindings | WP11 | Within dependency/ownership boundary |
| T054 | Expose appearance and declared actions/events | WP11 | Within dependency/ownership boundary |
| T055 | Verify wizards and post-wizard editing | WP11 | Within dependency/ownership boundary |
| T056 | Generate validated list/search handling | WP12 | Within dependency/ownership boundary |
| T057 | Generate transactional create/update services | WP12 | Within dependency/ownership boundary |
| T058 | Generate named delete confirmation and errors | WP12 | Within dependency/ownership boundary |
| T059 | Implement safe navigation and return context | WP12 | Within dependency/ownership boundary |
| T060 | Verify generated behavior against SQLite | WP12 | Within dependency/ownership boundary |
| T061 | Implement identity source and provisioning service | WP13 | Within dependency/ownership boundary |
| T062 | Generate opaque session lifecycle | WP13 | Within dependency/ownership boundary |
| T063 | Enforce effective read and action policies | WP13 | Within dependency/ownership boundary |
| T064 | Validate CSRF and login return targets | WP13 | Within dependency/ownership boundary |
| T065 | Verify auth boundaries independently | WP13 | Within dependency/ownership boundary |
| T066 | Build project identity setup and provisioning UI | WP14 | Within dependency/ownership boundary |
| T067 | Build global/page/action policy controls | WP14 | Within dependency/ownership boundary |
| T068 | Generate Login/Logout and identity page controls | WP14 | Within dependency/ownership boundary |
| T069 | Generate friendly prompts and return context | WP14 | Within dependency/ownership boundary |
| T070 | Verify public-read/protected-write walkthrough | WP14 | Within dependency/ownership boundary |
| T071 | Compile typed queries and expressions | WP15 | Within dependency/ownership boundary |
| T072 | Enforce grouping and aggregate grain | WP15 | Within dependency/ownership boundary |
| T073 | Implement exact decimal codecs and SQL helpers | WP15 | Within dependency/ownership boundary |
| T074 | Expose bounded read-only query preview | WP15 | Within dependency/ownership boundary |
| T075 | Verify compiler and numeric semantics | WP15 | Within dependency/ownership boundary |
| T076 | Build focused source/join canvas | WP16 | Within dependency/ownership boundary |
| T077 | Build field/expression/group/sort editors | WP16 | Within dependency/ownership boundary |
| T078 | Build typed parameter and review panels | WP16 | Within dependency/ownership boundary |
| T079 | Save and reuse named queries | WP16 | Within dependency/ownership boundary |
| T080 | Verify the complete query-authoring path | WP16 | Within dependency/ownership boundary |
| T081 | Build report/query binding properties | WP17 | Within dependency/ownership boundary |
| T082 | Generate reusable query execution modules | WP17 | Within dependency/ownership boundary |
| T083 | Generate derived fields and dependency refresh | WP17 | Within dependency/ownership boundary |
| T084 | Generate report navigation and filter UX | WP17 | Within dependency/ownership boundary |
| T085 | Verify totals and persistence through regeneration | WP17 | Within dependency/ownership boundary |
| T086 | Derive application nodes and semantic edges | WP18 | Within dependency/ownership boundary |
| T087 | Implement endpoint and diagnostic projections | WP18 | Within dependency/ownership boundary |
| T088 | Render compact selectable behavior chart | WP18 | Within dependency/ownership boundary |
| T089 | Provide keyboard navigation and scalable layout | WP18 | Within dependency/ownership boundary |
| T090 | Verify map/runtime correspondence | WP18 | Within dependency/ownership boundary |
| T091 | Implement the structured page document edit surface | WP19 | Within dependency/ownership boundary |
| T092 | Connect Design and HTML views | WP19 | Within dependency/ownership boundary |
| T093 | Implement draft Preview isolation | WP19 | Within dependency/ownership boundary |
| T094 | Wire Code and Live Page mode contracts | WP19 | Within dependency/ownership boundary |
| T095 | Verify mode continuity and visual density | WP19 | Within dependency/ownership boundary |
| T096 | Implement deterministic ownership manifests | WP20 | Within dependency/ownership boundary |
| T097 | Implement authored extension contracts and editing | WP20 | Within dependency/ownership boundary |
| T098 | Implement staged complete output promotion | WP20 | Within dependency/ownership boundary |
| T099 | Resolve ownership conflicts and upgrades visibly | WP20 | Within dependency/ownership boundary |
| T100 | Verify preservation and standalone output | WP20 | Within dependency/ownership boundary |
| T101 | Implement explicit build/start process jobs | WP21 | Within dependency/ownership boundary |
| T102 | Implement runtime status and route resolution | WP21 | Within dependency/ownership boundary |
| T103 | Build runtime controls and diagnostics UI | WP21 | Within dependency/ownership boundary |
| T104 | Implement portable definition/output export | WP21 | Within dependency/ownership boundary |
| T105 | Verify processes, exports and offline authoring | WP21 | Within dependency/ownership boundary |
| T106 | Author schema and interfaces through real UI | WP22 | Within dependency/ownership boundary |
| T107 | Exercise auth and Record happy/exception paths | WP22 | Within dependency/ownership boundary |
| T108 | Author report and inspect application map | WP22 | Within dependency/ownership boundary |
| T109 | Evolve and regenerate the application | WP22 | Within dependency/ownership boundary |
| T110 | Retain honest walkthrough evidence | WP22 | Within dependency/ownership boundary |
| T111 | Author the unrelated schema through Studio | WP23 | Within dependency/ownership boundary |
| T112 | Repeat application capabilities and persistence | WP23 | Within dependency/ownership boundary |
| T113 | Replay the complete shared operation corpus | WP23 | Within dependency/ownership boundary |
| T114 | Verify cross-project and concurrent draft isolation | WP23 | Within dependency/ownership boundary |
| T115 | Publish generality evidence and defect triage | WP23 | Within dependency/ownership boundary |
| T116 | Build a process-level fault harness | WP24 | Within dependency/ownership boundary |
| T117 | Verify project and migration reconciliation | WP24 | Within dependency/ownership boundary |
| T118 | Verify generation conflict and promotion recovery | WP24 | Within dependency/ownership boundary |
| T119 | Challenge cross-boundary security and cancellation | WP24 | Within dependency/ownership boundary |
| T120 | Retain recovery and preservation results | WP24 | Within dependency/ownership boundary |
| T121 | Create reproducible scale and timing fixtures | WP25 | Within dependency/ownership boundary |
| T122 | Measure response and data-read budgets | WP25 | Within dependency/ownership boundary |
| T123 | Complete keyboard and zoom walkthroughs | WP25 | Within dependency/ownership boundary |
| T124 | Review historical workspace fidelity | WP25 | Within dependency/ownership boundary |
| T125 | Triage and verify usability regressions | WP25 | Within dependency/ownership boundary |
| T126 | Write the author and extension guides | WP26 | Within dependency/ownership boundary |
| T127 | Verify clean checkout and exported runtime procedures | WP26 | Within dependency/ownership boundary |
| T128 | Reconcile requirements and release limitations | WP26 | Within dependency/ownership boundary |
| T129 | Prepare review handoff without publication | WP26 | Within dependency/ownership boundary |

## Readiness and execution

Run requirement mapping and finalize-tasks validation before committing this breakdown. The finalizer normalizes branch/dependency metadata and generates lanes.json. Then run `/spec-kitty.analyze` and resolve actionable consistency findings before any implementation claim.

Implementation uses the canonical runtime and independent review; this document does not authorize deployment or publication. Record tests and evidence while implementing each slice, not only in final acceptance packages. The acceptance packages close cross-subsystem evidence gaps rather than replace per-feature verification.
