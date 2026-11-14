# Fixture and Evidence Model

All rows are synthetic. IDs below are business example values; Studio object IDs must be obtained from the UI-created model and must not be hardcoded into generator logic. Final fixture descriptors include source/expected-data hashes. No acceptance project definition is preseeded.

## Workshop Planner

- workshops: integer primary key id, required text name.
- sessions: integer primary key id, required workshop_id referencing workshops with restrict deletion, required text title.
- Initial Workshop 1 Introduction to Woodworking has sessions 1 Safety and basic tools, 2 Joinery practice, 3 Measuring and layout. Workshop 2 Garden Design starts with no sessions.
- Expected session-count report: (Workshop 1, 3), (Workshop 2, 0). Minimum count 1 returns Workshop 1 only. A new session from Workshop 2's filtered list preselects 2; after save the report includes Workshop 2 with count 1. Edit/delete/reload/Cancel must preserve the appropriate context and expected rows.
- A reviewed later nullable duration_minutes column tests schema evolution without rewriting existing row values. Its addition is authored through Schema and migration review, not SQL patching.

## Library Catalog

| Table | Key / uniqueness | Fields and relationships |
|---|---|---|
| authors | id primary key | name required; duplicate names allowed so labels cannot replace identity |
| books | id primary key; catalog_code unique | title required; publication_date nullable |
| book_authors | ordered primary key (book_id, author_id) | each component references its parent with restrict deletion |
| copies | id primary key; barcode unique | book_id required FK; replacement_cost exact decimal with scale 2; optional note |
| loans | id primary key | copy_id required FK; checked_out date required; returned_at nullable date |

All id fields and their references are integers; A1/B1/C1/L1 below mean integer id 1 in the corresponding table, not literal string IDs. Catalog codes, barcodes and names are text. replacement_cost is a nullable exact decimal with precision 12 / scale 2; dates use the supported date type.

Rows: authors A1 Mara Vale, A2 Jules Wren, A3 Unassigned Author. Books B1 The Glass Orchard, B2 North Sea, B3 Uncatalogued Stories. Book-author rows (B1,A1), (B1,A2), (B2,A1). Copies C1 of B1 cost 12.50, C2 of B1 cost 7.25, C3 of B2 cost 10.00; all barcodes distinct. Loans reference C1 and C2, with one returned_at NULL and one populated date. Use checked_out dates 2026-01-10 and 2026-01-11; the second loan has returned_at 2026-01-18. A separate nullable-cost case adds and removes a NULL-cost copy without changing its book total. Duplicate-name variants add distinct keys and their own explicit oracle rather than silently changing the base expectations.

Expected author distinct-book counts: A1=2, A2=1, A3=0. Expected book copy-value report: B1=19.75, B2=10.00, B3=0.00. The copy-value report must not join authorship at a multiplying grain. A minimum total 15 includes B1 alone. Adding C4 of B2 at 6.25 changes B2 to 16.25 and includes it; edit C4 to 10.00 changes B2 to 20.00; deleting that unloaned C4 returns B2 to 10.00. The two original loans and original copies remain unchanged. A duplicate association/unique code fails atomically; deleting a loaned copy or associated book under restrict rules fails without child changes.

The optional existing-database scenario uses a stable snapshot of the UI-created Library database with schema/data hashes, not a prepared Studio project. Connecting, inspecting and canceling must preserve it. Opening a second project never mutates either app's drafts, output or rows.

## Acceptance records

- Run: run_id, fixture/app, code revision, environment, timestamps, explicit allowed setup, private root/process identities, mode (UI journey / parity / fault), attempt and evidence paths.
- Observation: stable case_id, requirement IDs, expected result, actual result, status, artifact hashes and any defect/retest link.
- Defect: stable ID, reproduction, severity, affected case/requirements, observed revision, owning concern, regression test, repair revision, retest or deferral rationale.
- Verdict: validated code revision, complete AC/FR/NFR/C disposition matrix, both clean-cycle IDs, independent reviewer identity, unresolved nonblocking issues, platform limits and separate hosted-check status.

Snapshots and expected values do not contain visitor passwords, author capability, identity hashes/tokens or actual user-study data. Business decimal comparisons use exact canonical values; never convert expected money through binary floating point. Compare authored files byte-for-byte and public/private configuration by declared boundaries, not by publishing private bytes.
