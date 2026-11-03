# Shared command and transport contract v1

HTTP and MCP are adapters to the same registered operations. MCP tools use these names with dots encoded as underscores; resources expose project snapshots, diagnostics and job status. Both authenticate an owner capability and enforce approved project/path scope. MCP stdio never opens the project database independently.

## Envelope and outcome

A command carries `requestId`, `projectId`, `operation`, `expectedRevision` and `input`. Mutations require a current revision; requestId is an opaque unique idempotency key. Input has an operation-specific runtime schema, not an unvalidated dictionary. Unknown properties/operations fail. Output is either `{ok:true, revision, result, diagnostics, jobId?}` or `{ok:false, revision, error:{code,message,objectId?,field?,retryable}, diagnostics}`. HTTP statuses map to the same error codes MCP returns as structured tool results: 400 invalid input, 401/403 owner access, 404 unknown object, 409 revision/fingerprint/conflict, 422 semantic failure, 423 project lease, 500 recoverable internal failure. Never include secrets or raw bound values in diagnostics.

Long work returns 202 + jobId. Jobs expose pending/running/succeeded/failed/canceled, progress phase, final outcome and diagnostic locations. Cancel is best-effort before a commit point; after commit it reports committed rather than pretending rollback. Events have monotonically increasing sequence/revision; clients with a gap refetch snapshots.

## Operation registry

| Operation | Input / preconditions | Result / atomic effect |
|---|---|---|
| project.create | name, approved root, target; optional empty database location | project ID and revision 1; no example schema or default credentials |
| project.inspect/open/list | project locator or ID, optional projection | snapshot, capabilities and revision; newer unsupported format read-only/refused |
| project.batch | typed entity put/remove commands and expected revision | validated all-or-nothing model transaction; one revision; removal identifies dependencies |
| project.export | destination, includeData false by default | portable definition/output references; secrets excluded |
| connection.inspect | approved SQLite path, mode read-only | capability/schema/opaque-object snapshot and fingerprint |
| connection.bind | inspected connection ID/fingerprint | model binding; never automatic DDL |
| schema.preview | desired schema revision, backfill rules | immutable migration plan with SQL, impact, backup policy, fingerprint and hash |
| schema.apply | plan ID/hash, acknowledged impact IDs | leased/rechecked/journaled backup and migration; durable actual outcome |
| schema.history/restorePreview | connection, backup reference where applicable | migration history or reviewed restore plan; restore requires schema.apply-equivalent acknowledgement |
| query.preview | saved query ID or validated draft AST, typed parameters, row limit <=200 | result shape/sample/SQL, diagnostics; read-only bounded execution |
| form.construct | page ID, form kind, source, selected fields/keys/actions/links/style | materialize typed forms/controls/actions in one model transaction |
| extension.read/write | approved extension path, content and expected file hash; write limited to authored ownership | source view/edit with conflict checks; generated files remain read-only |
| identity.provision | configured identity source, username and transient password input through protected owner operation | secure hash stored server-side, no password in model/history/logs |
| project.validate | optional object subset | object-linked binding/policy/route/expression diagnostics; no mutation |
| flow.inspect | application/schema/endpoint projection and optional selected ID | derived graph with source IDs and diagnostics |
| generation.preview | target, output root, project revision | ownership diff, conflicts, source/generator hashes and immutable plan |
| generation.apply | plan ID/hash, acknowledged conflicts resolved | staged recoverable source promotion only; no data migration/reset |
| runtime.start/stop/status | generated revision and explicit build/run intent | managed child process job/logs/port or stopped state; no silent dependency installation |
| job.inspect/cancel | job ID | observed state/outcome; cancellation cannot erase committed state |

`project.batch` entity operations have explicit entity kind/id and entity-specific schema; there is no unrestricted filesystem/SQL/code execution patch endpoint. Core checks cross-entity invariants against the whole candidate model. Wizard output uses the same batch path. Layout/view preferences use their own revision namespace and cannot conflict with semantic model edits.

## Reviewed plan protocol

1. Preview validates inputs and records source project revision, DB schema/data fingerprint where relevant, content hash, expiry and impact IDs.
2. UI displays impact; MCP returns identical structured information. Destructive apply requires acknowledgement of the exact impact IDs/hash, not a generic permanent approval.
3. Apply authenticates, acquires lease, verifies freshness under transaction and creates backup/journal before mutation.
4. Repeated requestId/payload returns its observed prior result. Same ID/different payload returns IDEMPOTENCY_CONFLICT. Reusing an already committed plan never repeats DDL.
5. Failure reports whether rollback succeeded, commit happened, or recovery is pending. Recovery runs before another apply.

## Standard diagnostic codes

INVALID_INPUT, UNSUPPORTED_FORMAT, UNSUPPORTED_SCHEMA_OBJECT, BROKEN_REFERENCE, TYPE_MISMATCH, INVALID_QUERY_GRAIN, UNSAFE_EXPRESSION, REVISION_CONFLICT, DATABASE_CHANGED, PLAN_EXPIRED, PLAN_HASH_MISMATCH, IMPACT_NOT_ACKNOWLEDGED, OUTPUT_CONFLICT, PATH_OUTSIDE_ROOT, AUTH_REQUIRED, ACCESS_DENIED, VALIDATION_FAILED, RELATED_RECORDS_EXIST, PROJECT_BUSY, IDEMPOTENCY_CONFLICT, RECOVERY_REQUIRED.

## Generated-application contract

Studio author capability is distinct from generated-app visitor identity. Generated routes follow the page model; server form handlers receive typed key tuples, validated fields and CSRF proof. Public list/search GETs are read-only; protected writes check effective policy and run in a transaction. Never authorize from a client-provided table or SQL string. Save/Cancel/Delete destinations come from declared internal route mappings. Successful writes redirect with a one-time confirmation and validated filter context; invalid input returns field/summary errors with safe entered values. Failed referential deletes return RELATED_RECORDS_EXIST without losing page context. Login rotates session and validates return targets; logout revokes session server-side. Auth is not a shared global session across different generated projects.
