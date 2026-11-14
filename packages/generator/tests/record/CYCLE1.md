# WP12 review cycle 1 — typed navigation repair

Audience: independent reviewer. Feedback event: `01M5Y8SBMAKP05ZSVQEHA8S3XC`; reviewed implementation: `2207735`. Both reported P1s are addressed without changing the model or adding a fixture-specific branch.

## Failed before

The new `navigation.test.ts` authors ordinary linked Grid/Record forms through `form.construct` and contextual action destinations through `project.batch`, emits a new external app, and independently installs it with scripts disabled. Before production edits, both emitted-module probes failed:

1. Cancel returned a declared `:key:organization-field=west` destination, but its list returned the safe list-read error instead of the two west records.
2. Mixed populated caption and blank numeric Search loaded the list, but Cancel returned `Enter a value.` and no destination.

Retained red run: `evidence/cycle1/failed-before.log`. The fixture uses a different quoted table and field names from the held-out review. No JSON patch constructs its forms/actions.

## Contract correction and shared-file rationale

- `ContextIR` now distinguishes optional Search inputs and key values. Navigation drops only empty optional Search inputs. Present key values still use typed validation; required complete Record key validation remains unchanged.
- Grid/Search self-field key declarations now emit both typed context entries and prepared parent predicates using the same parameter-name function as destination compilation. A key parameter is optional on the ordinary unfiltered list; when present it is validated and bound, never ignored. Complete composite values each bind their own column.
- The shared list repository uses the existing scalar parser, keeping key/filter scalar validation consistent with navigation and Record inputs. SQL identifiers remain compiled/quoted and values remain prepared bindings. Exact-decimal parent equality uses the existing decimal comparison helper.
- Grid GET forms retain their own declared parent keys while replacing editable Search/sort values. Paging also retains those keys.
- Invalid link construction returns an explicit error rendered by the Grid; it no longer produces `#`. Invalid page context renders an alert and no table; it no longer silently drops context.

These five production files are the minimal shared seam needed to make the accepted mapping contract agree end to end: IR, navigation compiler/runtime, Grid emission and list repository. No schema-model, Studio, authentication, initial-output promotion or dependency change is included.

## Passed after

- Targeted regression: one Vitest case with three independently executed generated Node subtests, strict external typecheck/test/production build, actual production HTTP and a headless browser journey; passed in 19.57 seconds.
- A single declared parent-key return shows only west rows and excludes east. An ordered composite return for west/2 shows only `West second`; actual production HTTP retains that exact result.
- A normal browser GET submits populated caption plus untouched blank integer Search. Its hidden parent key survives. Edit/New links work; Cancel/Save/Create/Delete return to the correctly filtered list. Optional blank Search is absent from resulting navigation context.
- Empty numeric parent/Record keys fail validation. Invalid context from another declared form produces a visible alert with no table. Injection-like parent text matches no rows. Independent final SQL confirms only west/1 changed, west/2 and east/1 stayed unchanged, and the disposable created row was deleted.
- Full `npm run verify`: 35 files / 270 tests passed, including native checks, workspace strict types/lint/build, credential heuristic and installed-lock metadata verification.
- Original real Studio wizard → independently installed production CRUD/Search browser journey: passed in 37.8 seconds.
- Explicit strict test-source typecheck (including the new navigation test) and final diff whitespace check passed.

Logs, exact returned HTTP and the final filtered-list screenshot are under `evidence/cycle1/`. Ephemeral roots are recorded in `observations.json`; no owner key is retained. Original screenshot artifacts were restored after the rerun because this repair changes navigation behavior rather than Studio appearance.

Authentication, query-backed output and regeneration remain at their existing future-package boundaries. The known unavailable Python no_coverage advisory remains unverified, not a pass. No hosted-sync opt-in or self-review was performed.
