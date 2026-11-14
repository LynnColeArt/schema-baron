# Nullable backfill assignment correction

The visible Equipment journey successfully applied a rename plus nullable/required additions. Changing nullable `notes` from text to integer and entering an explicit literal `0` backfill then returned HTTP 422 TYPE_MISMATCH: “Result type/nullability must match expression including outer joins.” The captured Studio screen and visible text show the selected nullable integer column and `assets.notes = 0`. No migration dialog opened and business rows remained unchanged.

The owner schema-preview handler had copied destination nullability into a temporary query projection. A non-null literal infers `nullable:false`, so ordinary query metadata validation rejected its assignment to a nullable column. This was a temporary validation-model error, independent of SQLite conversion.

The coordinating agent authorized a narrow correction: validate the temporary result as non-null first, and retry nullable inference only when the destination permits NULL. Ordinary query result metadata equality, required-target NULL rejection, reviewed impact, backups, fingerprints, revisions and apply remain unchanged. No physical change occurs during preview.

The generic real owner/core regression in `packages/sqlite/tests/schema-plans/nullable-backfill.test.ts` independently exercises nullable integer `0` and NULL conversions: preview leaves original rows/type intact, exact reviewed apply produces the expected value/type and marker hash. A required destination rejects NULL before any physical mutation. All three cases pass. The generic fixture is separate from the visible Equipment setup and is never used to author that application.

`outcomes-before.json`, `studio-before.png`, `visible-before.txt` and `generic-before.log` retain the original failure. `generic-after.log` records the three corrected boundary cases. The complete fresh visible replay and destructive-preview Cancel proof are reported in the parent Equipment evidence after execution.
