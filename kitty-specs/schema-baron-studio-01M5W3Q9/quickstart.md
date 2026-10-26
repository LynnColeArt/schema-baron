# Planned acceptance walkthrough

This is the target walkthrough, not a claim that the app exists yet. Build/run commands will be added when bootstrap creates the workspace. Use a fresh project root; never the archived demo DB or its users.

## Equipment checkout through Studio

1. Launch the documented local service and open Studio. Create **Equipment Desk**, choose an empty database location and inspect the compact Explorer/Toolbox/document/Properties/Messages arrangement.
2. In the schema builder create **assets** (id, label, daily_rate decimal), **borrowers** (id, name, email unique), **loans** (id, borrower_id, asset_id, starts_on, status) and **loan_lines** (id, loan_id, description, quantity, unit_price decimal). Configure foreign keys and restrict deletion where dependent records exist. Preview SQL/impact, apply, inspect history.
3. Use focused wizards to build public assets/borrowers lists with Search and linked Record forms. Add loan and line lists filtered by parent key. Select each object in Explorer and inspect Format/Data/Events. Test Design/HTML/Code/Preview/Live Page meanings.
4. Configure simple login and provision a test user through visible controls. Global read default public; protect one page and create/update/delete actions. Put Login/Logout/current identity in a list header.
5. Generate, review file ownership and explicitly build/start the app. Add borrowers/assets/loans/lines through its forms. Invalid values retain inputs; Cancel returns unchanged; save confirms. Logged-out reads work; direct writes fail. Login resumes a selected filtered record.
6. Build a reusable borrower-to-loan-line aggregate query. Include borrowers with zero loans, define precise decimal totals and a minimum-total parameter. Bind a Grid/report and link each borrower to loans, each loan to lines. Compare displayed totals to an independently calculated expected result, including fractional price × quantity.
7. Inspect those paths and login/return parameters in the application flow map, then the endpoint view. Clicking a node/edge selects the underlying property. Keep the schema diagram separate.
8. Add/edit/delete one disposable line and verify totals/filter/return context. Attempt to delete a loan with related lines: friendly error, unchanged records. Confirm a named deletion and explicit cascade impact where configured.
9. Add an authored validator/action in the documented extension file. Add a nullable schema field, then a required field with explicit backfill; review/apply. Attempt/cancel a destructive migration and test stale-plan rejection. Verify unrelated rows and constraints.
10. Regenerate twice, reopen Studio and restart the app. Verify all surviving records, query/report settings, links, login rules, migrations and custom source. Export to an independent directory and run without Studio/workspace imports.

## Second unrelated project

Create **Publication Catalog** from blank using authors, publications, categories and publication_categories with a composite primary key. Use different routes/field names and different relationship directions; keep a project-specific login store. Repeat list/search/Record, child navigation, a filtered aggregate report, flow inspection, migration and two regenerations. Switch between projects without restart. Do not copy model files or seed schemas through hidden scripts; runtime data may be entered through generated forms. Programmatic fixture setup is allowed in automated lower-level tests, not a replacement for these authoring journeys.

## MCP and exceptions

From the first functional slice use MCP to inspect, create/change, preview and apply the same implemented operations. Replaying equivalent UI/agent operations must yield equivalent normalized state. Reject a stale revision and unsafe expression; show diagnostics in Studio without losing another draft. Destructive apply acknowledges the exact reviewed impact. Exercise direct runtime anonymous/CSRF/forged-key requests and safe return-target validation.

Inject failures during save, schema rebuild, database-commit finalization and output promotion, then restart. Compare unaffected row/file checksums, migration IDs and extension bytes. Record which outcome committed and demonstrate recovery rather than merely a toast.

## Evidence

Use contracts/acceptance-matrix.md. Store authored notes and redacted evidence under the mission evidence directory; keep real credentials/databases private. Record exact Node/browser/package versions, reference machine CPU/RAM/OS, timing samples and screenshot dimensions. No performance or fidelity claim is accepted without measurements/review. The local manual pack is linked from docs/references/README.md.
