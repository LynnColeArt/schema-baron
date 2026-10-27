---
status: active
owner: connections
updated: 2026-10-26
---

# WP06 connection implementation and observed evidence

Audience: independent WP06 reviewer and later SQLite feature implementers.
Scope: T026–T030 only. No schema wizard, migration, query designer or generator.

## Implemented boundaries

`connection.inspect` defaults to an existing file, read-only, using an approved
`rootId:relativePath` locator. Missing files fail `NOT_FOUND`; no replacement is
created. Explicit `createEmpty:true` exclusively creates a zero-byte empty SQLite
file in an existing approved directory; this is visible in the UI before Inspect.
An existing destination fails `OUTPUT_CONFLICT`. Cancel after creating an empty
file leaves that explicitly created file; binding is a separate operation.

Inspection reads sqlite_schema and table_xinfo/foreign_key_list/index_list/index_xinfo
inside a SQLite read transaction. All PRAGMA arguments are bound. It preserves exact
SQL, declared types, defaults, hidden/generated flags, ordered primary/FK tuples,
index ordering/collation/partial/expression details, encoding and SQLite version.
It never executes imported SQL. Nonstandard logical types remain unconfirmed;
nonrepresentable constraints/objects are read-only opaque SQL with their original
physical metadata. INTEGER PRIMARY KEY implicit non-null semantics are recognized;
nullable SQLite keys are retained physically rather than invented as authorable keys.
Foreign-key forms the logical model cannot represent remain opaque.

A physical schema fingerprint covers original SQL and PRAGMA details (allocator
root pages are retained but excluded from hashing). It is a schema fingerprint,
not a data-change detector or migration plan. A unique five-minute inspection ID
identifies one exact preview; reconnecting preserves the separately bound connection
ID and physical-name-matched schema IDs. The cache holds at most 100 previews and
is process-local. After restart/expiry, inspect again with a fresh request ID.
Binding rechecks approved scope, file identity and fingerprint, then commits only
through the existing model validation/revision/journal authority. It performs no DDL.
This slice has one active schema connection per project, matching the single project
schema; reconnect selects that identity explicitly. Unsupported objects are not
silently removed or rewritten.

SQLite is isolated in a Node child worker with private IPC, native prepared
statements, atomic transactions, foreign_keys=ON, trusted_schema=OFF, read-only
query_only policy and a 150ms busy timeout. Requests default to five seconds and
are capped at 30 seconds. Abort/timeout sends OS termination and waits for observed
exit before rejecting. Idle close requests graceful native close, with a 200ms
hard-kill fallback; owner close kills pending work and rejects late finalization.
Raw write cancellation does not claim a fictional rollback after a possible commit;
its diagnostic instructs inspecting actual state before retrying writes. The tested
mid-transaction cancel rolls back. Native online backup uses SQLite's backup API,
with an exclusive unused destination, never a naive WAL file copy.

A warmed-thread experiment showed worker_threads.terminate could wait for native
SQLite to finish (~2.5 seconds for a ten-million-row recursive read). It was replaced
before completion. The final child-process sample on this host observed:

- Native long read timeout plus confirmed process exit: **55.8ms** (50ms budget).
- Native long write cancellation plus confirmed exit: **55.1ms** (abort at 50ms).
- Integrity check: `ok`; only original row `{id:1}` remained after the canceled
  transaction. Tests also wait and check that no late rows appear.

## Necessary shared-file integration rationale

- SQLite manifest/export/build config: make the newly implemented package available
  to production Node consumers and emit its worker entrypoint.
- Core manifest and lockfile: declare the internal core→SQLite workspace edge;
  no new third-party artifact or version. The official registry collector refreshed
  all 258 locked artifact records after the lock hash changed; scripts stay denied.
- Model commands: add optional explicit `createEmpty:true` and optional existing
  `connectionId` to inspect, preserving the original required path/read-only input.
- Model connection: add optional strict physical metadata so lossless imported SQL,
  declarations and unsupported expressions survive persistence/export.
- Registry/core: add awaited handlers and `executeAsync`; preserve synchronous
  `execute` consumers. After each await, the existing synchronous authority checks
  idempotency and current project revision again before effect finalization. Matching
  concurrent keys replay; conflicting keys reject; intervening writes invalidate.
- Owner HTTP dispatch awaits that same core path; existing MCP discovery/forwarding
  automatically exposes it. Owner shutdown waits for worker disposal.
- Workspace registration mounts the connection UI, reconciles refreshed snapshots
  through the existing editor draft path, and retains unrelated invalid drafts.

## Commands and actual outcomes

Pinned Node 24.22.1/npm 11.19.1, Linux x64. Install was
`npm ci --ignore-scripts --offline`; packaged native verification passed. The first
new test attempt could not run before dependencies were installed. Native boundary
and exclusive-backup tests were then developed red→green. Initial Playwright runs
caught two test locator errors (singular Connections and unscoped Next alert); both
were corrected, without weakening product assertions.

```sh
npm run native:verify
npm test -- packages/sqlite/tests/introspection
node scripts/workspace/verify.mjs module packages/sqlite/tests/introspection
node node_modules/typescript/bin/tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --target ES2023 --module NodeNext --moduleResolution NodeNext --noEmit --skipLibCheck tests/e2e/connections/workflow.spec.ts
npm run build
npm run test:e2e -- tests/e2e/connections/workflow.spec.ts tests/e2e/workspace/workflow.spec.ts --output=/tmp/wp06-e2e-pinned
node scripts/workspace/dependencies.mjs collect
npm run verify
npm audit --json
npm run lint
git diff --check
```

The native/connection suite covers real WAL, quoted names including a double quote,
composite keys/FKs, nullability, partial indexes, opaque defaults/types, trigger/view
SQL, unchanged schema/rows, online backup, missing/corrupt/permission/lock/path/alias
failures, exclusive empty creation, stale fingerprints, relocation, synchronous/
asynchronous overlap, matching/conflicting idempotency keys, actual connection
inspection/binding across revisions, shutdown, bounded cancellation and rollback.
Both actual HTTP and SDK stdio MCP see the same successful/rejected outcomes.

The full browser run passes **all five workflows**: UI-created projects and drafts,
real inspection/bind/reconnect/new-empty, MCP fingerprint parity, plus the four WP05
workspace regressions covering invalid drafts/history/recovery/focus. No project JSON
is edited to author the browser scenario. Direct SQL only creates the independent
external database the user is connecting; it is not an authoring shortcut.
Pinned action controls and selected locator stay visible at 1280×800 and 1024×600;
original metadata/SQL remain disclosed within a bounded scroll body.

Retained screenshots, inspected by implementer and root:

- `/tmp/wp06-e2e-pinned/connections-workflow-UI-au-d084b-serving-invalid-page-drafts/existing-schema-preview.png`
- Same directory: `bounded-preview-1024x600.png`, `missing-reconnect-diagnostic.png`,
  `new-empty-preview.png`.

Final `npm run verify` passes **142 tests in 15 files**, all implemented workspace
typechecks/builds, native smoke, credential/diff checks and exact dependency metadata
validation (182 installed, 76 platform-optional absent, 258 registry artifacts).
Generator/shared UI packages remain explicitly not implemented, outside WP06.

Full verification logs: `/tmp/wp06-verify-complete.log`. Audit output:
`/tmp/wp06-audit.json` (zero vulnerabilities). The first verify stopped after passing
its tests/build/typechecks because the internal-edge lock change made registry
evidence stale; the canonical collector refreshed it before the passing verification.

The isolated owner is at `http://127.0.0.1:36971`, exec session 11598, private config
`/tmp/wp06-studio-handoff/owner.json` (no key retained here). CUA can load its live
connect dialog; visible-tab mode is unsupported inside a subagent. Authenticated
end-to-end actions and screenshots above are repository Playwright proofs. No full
manual authenticated CUA journey, native 200% zoom or later-feature acceptance is
claimed. No unrelated existing service was stopped. Independent review is required;
there is no self-approval. The known missing Python/JUnit gate authority and advisory
no_coverage warning are not claimed as passing product tests.

## Cycle 1 repair: reserve asynchronous idempotency before external effects

Independent review event `01M5XR7NYN2KTZC7BDJ16RKM3D` rejected source `b355f99`:
matching concurrent createEmpty calls could both return OUTPUT_CONFLICT after one
created the file, and conflicting same-key paths both created files before one was
rejected. The prior post-await check protected model commits but was too late to
protect external effects. The synthetic commit-arbitration test missed that boundary.
The unused public quoteIdentifier helper was also identified and has been removed;
introspection continues binding PRAGMA values without an artificial replacement call.

The shared ProjectCore now reserves the canonical parsed-command hash under the
(projectId, requestId) pair before invoking any async handler code, including its
synchronous prefix. Matching async requests share one execution and final outcome;
conflicting payloads reject before entering the handler. A matching synchronous
call while the async request is pending returns retryable PROJECT_BUSY without
writing an operation record; a conflicting synchronous payload also cannot execute
or poison the pending slot. Completed persisted outcomes retain existing replay
behavior through both entry points. Caller input is parsed/copied before deferral,
so later mutation of the caller's object cannot change the reserved effect or hash.
Revision and owner-close guards run before handler entry and again after the await.

The reservation is per owning core, protected by the existing exclusive metadata
writer and approved-root leases: tests refuse a second core both against the same
metadata store and against a separate metadata store targeting the same approved
root. Completed outcomes replay after close/reopen. A close before handler entry
runs no effect and records no operation. Close during a real worker cancels and
joins that worker, then returns RECOVERY_REQUIRED without a late operation/model
commit. An explicitly created empty file may remain when its authorized initial
request is interrupted; no conflicting request creates another file. A retry after
reopen reports the actual existing-file conflict rather than inventing completion.

Test-first evidence: `/tmp/wp06-repair-red.log` records five failures in the six
initial regressions against the rejected build, including the exact matching and
conflicting file-creation defects, mixed sync/async poisoning, generic duplicate
handler execution, and shutdown-before-execution. Desired assertions were retained
and expanded; `/tmp/wp06-repair-green.log` records the focused passing run before
final transport coverage was added.

The new public regressions assert outcomes, actual file existence, unchanged project
revision, operation record status/replay, event counts, and reopening behavior. Both
exact createEmpty overlap cases run before handler entry and during the worker await.
Additional cases cover failure replay after repairing the external directory,
generic canceled-handler sharing, caller-input mutation, stale revision before any
file creation, both shutdown timings, and simultaneous HTTP/MCP replay/conflict.
Existing post-await revision, native timeout/cancel/rollback and UI draft tests remain.

The original independent reproduction was left unchanged. Running
`node docs/reviews/wp06-idempotency-repro.mjs` against the repair exits 1 at its
intentional old-defect assertion: both matching results now succeed at revision 1,
the one file exists, the operation is committed with eventSequence 1, and retry
returns that same success. Exact output: `/tmp/wp06-repair-oldrepro.log`. That exit
is not represented as a passing test; the new desired-behavior tests cover both
matching and conflicting cases through completion.

Final observed commands/outcomes on the pinned runtime:

- `npm run verify`: **154 tests in 16 files pass**, all implemented builds/typechecks,
  native smoke, credentials, lint and 258 exact dependency artifacts pass.
  Log: `/tmp/wp06-repair-verify.log`.
- Dedicated strict test-source check for `packages/sqlite/tests/introspection` and
  strict TypeScript compilation of the browser workflow both pass.
- All **five browser workflows pass in 12.0 seconds**, including the actual
  connections journey and all four WP05 invalid-draft/history/focus regressions.
  Output: `/tmp/wp06-repair-e2e`, with the same connection screenshot names under
  `connections-workflow-UI-au-d084b-serving-invalid-page-drafts/`.
- `npm audit --json`: zero vulnerabilities, `/tmp/wp06-repair-audit.json`.
  `npm run lint` and `git diff --check` pass. No dependencies changed in this repair.

The isolated owner was restarted from the repaired production build at the same
`http://127.0.0.1:36971`, exec session **77872**, with the same private owner config.
No unrelated server was stopped. No new manual CUA or later-feature claim is made.
This is a repair handoff for independent review, not self-approval.
