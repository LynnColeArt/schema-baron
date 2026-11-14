# Workshop Planner: fresh Studio UI verification

This is **WP02 Workshop-scope proof**, not the final mission verdict or its two
clean complete cycles. The application was authored from a new private workspace
through visible Studio controls. Library, direct-handler authorization, recovery,
regeneration/customization/export and measured final replay remain later packages.

Validated code: `8e1546e101dfb3cd6160999f189fff3c41f0d515`.
The [summary](workshop.json) records fixture/test hashes, tool versions, exact rows
and scoped outcomes. This documentation commit is separate from the tested code.

## Observed journey

1. First-run Workspace settings chose a new private project parent. A canceled wizard
   created no project or database. The successful wizard used another missing folder
   with spaces, created workshops/sessions and their integer primary/foreign keys,
   enabled simple login/protected writes, and reviewed five pages/five forms plus
   Mermaid before Complete.
2. Project-list settings/flow shortcuts reopened Workshop Planner. The real
   Page → Form → Control objects remained editable. Properties configured workshop
   names, an equality filter and a row action to sessions. Events selected the
   intended navigation by its visible effect and retained its stable action ID.
3. Query sections authored a grouped left join/count, declared its grouping keys,
   counted the nullable child ID, added a minimum parameter and HAVING, then bound a
   Grid report to the public runtime filter. No prepared project model or command
   patch supplied these definitions.
4. Generate selected the project's own output folder automatically. Scripts-denied
   dependency installation and the UI build/start controls produced a real independent
   generated visitor app on an owned unused port. The public list stayed usable;
   protected Add showed the friendly login prompt and returned to the requested page.
5. Generated forms saved two workshops and three sessions. Named workshop links
   selected the correct children; Add preselected the parent. Login after logout,
   Save and Cancel preserved Garden Design's selected context. Missing title and
   duplicate primary-key attempts showed clear errors and changed no rows.
6. The report showed counts 3/0. Its visible minimum input and Apply parameters
   returned only the first workshop at 1 and no rows at 4. Adding a Garden session
   changed its count to 1 and included it; editing/deleting it returned the count to 0.
   Named restricted deletion of the first workshop showed the related-record error
   and preserved both workshops and all three original sessions.
7. With the owned runtime stopped, Schema reviewed/applied nullable duration_minutes.
   Existing values were preserved and the new values were NULL. A destructive column
   removal was reviewed then canceled: the database remained unchanged. Cancel
   intentionally retained the desired schema declaration; visible Schema controls
   restored the nullable declaration and explicitly reviewed/acknowledged its rebuild.
   Final rows were identical to those after the nullable addition. Reload retained
   the project, schema and data.

## Small UI hardening

The Events picker previously showed multiple bare `navigate` options, making a
filtered relationship action hard to distinguish from an existing menu action.
Choices now show operation, destination page/route and ordered key/filter field
expressions. Stable IDs remain option values. Two focused tests cover the labels,
ordered mappings, success destinations and missing references. The browser journey
first failed expecting a uniquely described choice and now selects it by visible label.

## Reproduce

From this checkout use the pinned Node/npm, acquire dependencies with scripts denied,
verify the native artifact and build Studio as described in
[Supported setup](../../development/release.md). Install the pinned Playwright browser
explicitly if needed. Then run:

```sh
npx --no-install vitest run apps/studio/src/forms/action-labels.test.ts
npx --no-install playwright test tests/e2e/acceptance/workshop.spec.ts --workers=1 --retries=0 --output=.local/workshop-review
```

The browser test owns a fresh private configuration/root, loopback owner and generated
runtime; it never reuses the retained user study or ports. UI authoring is mandatory.
Only explicit install/build/start preparation and read-only project/SQLite observers
operate outside browser controls. Tracing is off. Private roots, owner configuration,
identity, raw data stores and failed-run logs remain outside public evidence.

## Verification and limits

- Focused formatter tests: **2 passed**.
- Final-source Workshop browser journey: **1 passed**, zero retries, 34.7 seconds
  for the test (35.6 seconds total). This is not an NFR performance measurement.
- Full workspace typecheck, scoped browser-source TypeScript check, five-file diff
  lint and credential heuristic passed before review. The unused source-less UI
  scaffold remains explicitly NOT IMPLEMENTED.
- The synchronous broad regression gate and independent WP review are reported by
  their canonical workflow records; this report does not predeclare those outcomes.
- Global mission checklist statuses are not changed by this scoped report. In
  particular this does not prove direct anonymous mutation handlers or the Library.

Earlier attempts are retained privately rather than erased. They exposed harness
issues: saving an already-correct default, missing the declared query grain keys,
expecting a nonexistent success URL parameter, selecting the wrong same-operation
menu action, ambiguous alert selectors and checking asynchronous acknowledgment
controls before the review dialog existed. The genuine Events-choice usability gap
has separate red/green proof. None of these attempts counts as a final clean cycle.

The four synthetic screenshots were visually inspected. The wizard's private location
is masked; no credential, identity store or private absolute root is published.
The additional `workshop.*` documentation/artifact paths are a recorded narrow WP02
ownership exception approved by the orchestrator; they do not overlap another package.
