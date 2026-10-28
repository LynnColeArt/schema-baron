# Guided project setup and reusable flow review

Verified 2026-10-27–28 with Node 24.22.1 and npm 11.19.1.

New Project defaults to a seven-step guided application setup, with an explicit
Blank project alternative. It supports a new SQLite file and an existing SQLite
file, project-specific locations, schema creation, table/page choices, optional
managed login and protected record writes, list navigation, and review before
Complete. It uses the actual shared Schema editor in proposal mode. No project
folder or business database is created by preview or Cancel.

The Mermaid overview derives pages, navigation, login/return paths, data sources
and foreign-key relationships from the proposed model. The same component is
available in the permanent application map alongside the detailed interactive
page/form/action view. Project rows and the current project's Explorer heading
have separate accessible flow-chart and settings icons.

Complete delegates to canonical core commands. New schemas use migration
preview/apply with no destructive acknowledgments; existing schema and rows are
preserved. Page construction uses the existing linked-form engine. Its existing
Add action receives a captioned control, avoiding duplicate Add destinations.
Generated navigation with no row mappings appears outside the table and works
for empty lists; field-bound links retain their row values and authored captions.

Verification:

- Full automated suite: **495 tests / 76 files passed**.
- Final targeted server, storage/workspace and output-fidelity checks: **21 passed**,
  including the regression assertion that each Record page has one Add destination.
- Browser regression set: **8 scenarios passed**, covering new schema/key authoring,
  Back, real Mermaid rendering, Complete, protected pages, schema/map reuse, project
  shortcuts, nested relationship dialog labels/Escape, existing composite keys and unchanged database bytes, Cancel, blank
  setup, workspace preferences/restart, and prior draft/conflict recovery.
- The final browser run also removed/restored a primary key through Back, reconciled
  the available Record choice, and authored a foreign-key draft in the reused editor.
  Test captures stay under `.local/`, outside historical mission evidence.
- Concurrent local tabs share current CSRF proof; cookies are scoped by owner origin
  name. Focused tests cover two origins sharing a cookie jar, unchanged command
  retries after stale proof, and bounded failure when a refreshed proof is rejected.
- Production build, typecheck, diff lint, credential-pattern scan, dependency
  metadata/integrity verification and native SQLite insert/transaction/backup checks
  passed. Mermaid 12.2.0 is exact-pinned; lifecycle scripts remain disabled.
- CUA confirmed the running Studio opens the new wizard using the user's existing
  workspace location. A separate tab preserves the original unsaved query.

Complete creates the database/project model and authored pages. Generate remains
an explicit reviewed operation for writing application source files. An interrupted
Complete can leave a saved project for recovery; setup does not delete existing
files or database rows to roll back an error. Review plans expire after 30 minutes
or server restart. Existing schema edits remain available afterwards through the
normal Schema editor and migration review.
