# Canonical model interface

For command, storage, compiler and UI implementers. Import from
`@schema-baron/model` after `npm run build --workspace @schema-baron/model`.
The package is pure: its only external import is Zod.

Use `parseProject(unknown)` or `validateProject(unknown)` for committed snapshots.
`projectSchema` provides strict structural validation for draft tooling; it does
not replace whole-project validation. Failures contain stable diagnostic codes,
object IDs and fields/paths; they do not echo raw input values. Parsing clones
rather than mutates caller input. Format 1 is the first supported format;
unsupported versions are refused without a speculative upgrade.

IDs come from `createId()` (or caller UUID injection) and are opaque. Physical
names and routes are separate. Serialization sorts object properties but retains
array order, especially key tuples. Field expressions in table constraints use
alias `self`; form/control/action mappings use alias `root`; query aliases are
explicit. Dates use ISO calendar dates, datetimes UTC, blobs base64; exact decimals
use strings plus explicit scale, precision, encoding and rounding. Scaled-integer
precision is limited to 18 digits; later arithmetic must enforce these declared
bounds. Derived controls and query outputs are read-only.

Query result fields are projections with stable IDs and checked type/nullability.
Declared grouping keys are exactly the projected GROUP BY expressions. Outer joins
propagate nullability. Grouped query sources permit explicit preaggregation; joins
after preaggregation must preserve one row per declared grain. Multiple child
fanouts, cyclic query references, nested aggregates and aggregate WHERE clauses
are rejected. There is no executable SQL or JavaScript expression node. Imported
opaque SQLite objects retain their SQL as read-only schema metadata.

Forms may optionally declare `queryParameters: [{ parameterId, value }]` for fixed
literal presets or `{ parameterId, runtime: { name } }` for public runtime inputs
on a saved query source (including its query dependencies). Choose exactly one
source per parameter; names are unique within the form. Literal values
use the parameter's declared logical type/nullability. Absent mappings leave the
query default or required-input check in force; explicit null is distinct from
absence. IDs survive query/parameter renames. Duplicates, removed IDs, incompatible
values and presets on a table source are rejected. Runtime inputs read only declared URL parameters; control/row-result expressions
cannot supply their own pre-query inputs.
Form key mappings and appearance remain separate from presets and editor layout.

`commandSchema` discriminates every registered operation and validates its input.
`operationInputSchemas` and `operationResultSchemas` let adapters/registries bind
strict matching boundaries. `EntityBatchOperation` preserves entity-specific
compile-time unions. A batch must validate the entire candidate snapshot before
commit; this package performs no persistence/revision increments. Provisioning
password input is transient: never persist it in the project or operation record.
The operation record deliberately carries hashes and outcome metadata only.

`effectiveAccess` expects a validated project and reports the effective access
and source policy. Pages may override the global default. Action policies can
tighten their containing page; explicit weakening is a validation error.

`reviewedPlanSchema` requires source revision/model hash, external fingerprints,
expiry and exact disclosed acknowledgement IDs. `validatePlanApplication` is a
pure freshness/acknowledgement check. Services must call it under a real lease /
transaction and verify stored immutable plan hashes. This package does not claim
to implement database backups, SQL execution, generation or transport auth.

Generated query-backed Grids expose runtime inputs as `FORM:parameter:NAME` with
a `:mode` of `default`, `value`, or `null`. Absence uses the query default; explicit
blank text and null remain distinct. Required inputs need a mapping before report
generation. Read-only derived report expressions declare their saved query as a
source dependency; child aggregates belong to that query graph.
