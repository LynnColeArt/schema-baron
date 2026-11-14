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

## Relationship picker and project output follow-up (2026-10-31)

New Record construction (including linked Record forms in guided setup) infers a
normal lookup control for an unambiguous, single-column foreign key when its
referenced table has a descriptive text column. It prefers name/title/label/
display_name, then another non-key text column. It stores the referenced key and
displays the text label. Generated columns, composite tuples, ambiguous overlapping
relationships, and targets without a text label keep their existing controls.
The normal Data properties can change the inferred lookup. The existing runtime
lookup limit of 200 options remains in effect.

Generate initializes its destination from the project's outputConfig instead of
choosing a shared output root. Local project creation prepares the generated
parent directory so reviewed initial promotion can use generated/app directly.
Custom destination editing and the reviewed regeneration boundary remain intact.

Workshop Planner was updated through normal Studio control properties, saved at
revision 7, and regenerated into its own generated/app directory without editing
the destination. The original workshop and session survived. In the rebuilt app,
Add sessions still required login and returned to the requested form after login.
Selecting Introduction to Woodworking by name saved Joinery practice as session 2
with workshop_id 1; reopening session 2 retained the named selection. The app is
managed by Studio on loopback port 3100. Its type check, two generated tests, and
managed production build passed.

Verification: the focused construction/workspace/setup suite passed 18 tests;
three wizard browser scenarios passed, including automatic default destination,
preview and actual source creation with no manual directory preparation. Full
Studio build, workspace type checking, lint, and credential scan passed. Detailed
local logs and the live dropdown screenshot are under .local/lookup-* and
.local/workshop-name-picker.jpg (not committed).
The complete regression suite passed 496 tests across 76 files (224.90 seconds).

## Named lists and related-list navigation (2026-10-31)

Table Grid/Search output now consumes a control's ordinary lookup declaration
when rendering cells. It reads labels in one prepared, bounded-key query per
lookup for the current page and retains original field values for filters,
ordering, row identity and navigation. Missing labels fall back to the stored
value. This is shared generator behavior, with no Workshop-specific templates.
Search and sort semantics remain bound to their declared source fields.

New table Record forms initialize non-key, non-generated fields from exact-match
Search/Grid filters and declared parent-key context for the same source table.
Only new records are initialized this way: existing records retain stored values,
contains/range predicates are not defaults, and incompatible or conflicting parent
values are rejected. The retained typed context continues through Add, login,
Save and Cancel. Dropdown selection remains editable.

Workshop Planner revision 8 was changed through a canonical project.batch:
its session-list Workshop control uses the existing workshop lookup; the workshop
name is a navigation link mapping its ID to the session-list workshop equality
filter. The old unfiltered Go to sessions control was removed. It was regenerated
into its configured folder and rebuilt. Original rows survived.

Observed in the app on port 3100: following Introduction to Woodworking opens
its filtered sessions, whose rows display workshop names. Add sessions preselects
the workshop without typing its ID. Saving Measuring and layout created session 3
with workshop_id 1 and returned to the same filtered list with confirmation.
After logout the lists remained public; Add required login and preserved the
filter/preselection after login. Cancel returned to the filtered list without
creating another row.

The independent generator runtime regression exercises unrelated quoted/composite
SQLite tables: lookup labels with unchanged numeric keys, exact parent filtering,
new-record preselection, existing-record values not overridden by context, and
invalid parent rejection. It also installs with lifecycle scripts disabled,
type-checks, tests and builds the generated application. This regression passed.
The Studio production build, workspace type check and lint passed; Workshop
Planner's type check, two generated tests and managed production build passed.
Local logs/screenshots: .local/session-links-*, .local/workshop-filtered-sessions.jpg
and .local/workshop-session-preselected.jpg (not committed).
The full regression suite passed 496 tests across 76 files (302.31 seconds).
