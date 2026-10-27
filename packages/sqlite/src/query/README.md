# Structured query compiler

`compileQuery(project, savedOrDraftQuery, parameterValuesByStableId, rowLimit)` validates
an AST against the canonical model and returns a parameterized SELECT, inferred declared
result fields, physical key claims, and a 1–200 row cap. Unknown nodes, identifiers,
functions, parameter IDs and incompatible values fail before SQL is sent to SQLite.
Every literal and parameter value uses a generated named binding; quoted physical names,
source aliases and stable output IDs are never treated as SQL fragments.

Sources may be tables or saved queries. Child query parameters use their globally unique
stable IDs in the same input map; defaults apply independently in each source scope.
Child queries are compiled without a preview limit. Only the final SELECT receives the
bound row-limit-plus-one used to determine `truncated`.

`grouped` grain requires grouped nonaggregate expressions. Multiple expanding child
relations must first become grouped saved query sources and join on the entire declared
grain tuple. Cardinality declarations do not establish uniqueness: the compiler proves
complete equality-key coverage and the worker checks both the physical
SQLite indexes and actual join multiplicity inside the same read snapshot. Decimal
normalization, native affinity, and collation can equate physically distinct key values;
a physical index alone is not a semantic uniqueness proof. Each inferred nonexpanding
join uses its exact compiled source subqueries, bindings, operand order and ON condition
to look for a second matching source entity before result execution. Reverse checks
for one-to-one/one-to-many group prior join appearances by the declared left alias's
complete proven raw key tuple with BINARY collation, preserving physically different
decimal/collated keys while counting repetitions of the same entity once. Grouped
source queries use their grain tuple; a global aggregate is one entity. A nullable
unique tuple is used only when every component is a required direct equality in ON,
so matching tuples cannot contain NULL. Without that proof, compilation fails closed.
These full-relation checks are
independent of the 200-row sample and share its worker scan budget/deadline/cancellation.
Checks conservatively cover the join relation before the containing query's WHERE;
source-subquery filters and parameters are preserved. A collision returns
`INVALID_QUERY_GRAIN`; grouping a child query by the logical key can establish safe
preaggregation without discarding equal monetary amounts. Outer-join nullable fields
must declare nullable results; aggregate `zeroChildren: 'zero'` and explicit `coalesce`
provide the chosen zero behavior. `COUNT(*)` counts joined rows, including an unmatched
outer row; use `COUNT(childKey)` to count matching children.

Supported grammar is the canonical Expression union: fields, typed literals/parameters,
arithmetic, comparison, conjunction/disjunction, coalesce/lower/upper/length/abs/date/year,
and count/sum/min/max/avg. Decimal arithmetic, comparisons, ordering and aggregates use
exact helpers. SQLite's one-argument DISTINCT aggregate restriction means DISTINCT
exact sum/avg/min/max require a grouped child query; they produce a diagnostic rather
than silently changing semantics.

## Preview caller

The actual caller is `packages/core/src/query-preview`: both HTTP `query.preview` and
MCP `query_preview` dispatch to the same asynchronous registry handler. It uses a fresh
read-only SQLite child process, `query_only`, `trusted_schema=OFF`, a schema fingerprint
check and a single read transaction. Results validate the actual SQLite values against
the declared shape, refusing unsafe integer transport values or malformed decimals.

Inputs accept either `queryId` or `draft`, `parameters`, and `rowLimit`; optional
`timeoutMs` can lower the 5,000 ms deadline and `maxScannedRows` can lower the 100,000
source-row scan budget. Source counts use bounded subqueries and conservatively include
all physical source rows, even when a predicate is selective. Expensive joins/sorts are
also interrupted by the child-process deadline; this is not a full SQLite cost model.

The preview job ID equals the command request ID. `job.inspect`/`job.cancel` (or their
HTTP job endpoints) observe/cancel it. Cancellation passes the ordinary authorization,
revision and idempotency checks before aborting and waits for actual process exit. Owner
shutdown also aborts workers, records a terminal observation, then releases the writer.
Project definitions and the application database are never mutated by preview.

## Decimal reuse

`decimal/index.ts` contains portable, deterministic BigInt codecs and SQL registration,
with no Studio runtime import. `decimalCodec` decodes a physical value to a canonical
fixed-scale string; `decimalEncode` encodes a logical decimal string into text or BigInt
SQLite storage. Use a text format when validating a logical parameter, and the declared
physical encoding when decoding stored data. Text supports precision through 38 digits;
scaled INTEGER supports 18. Inputs reject excess scale; arithmetic rounds at every
operation using the declared half-up, half-even or toward-zero (`down`) policy.
Overflow, noncanonical input, binary-float monetary inputs and division by zero fail.
The generator can emit these helpers beside compiled SQL and grain checks, evaluating
checks and results in one read transaction; generated-runtime integration
and the query designer belong to later packages and are not claimed here.
