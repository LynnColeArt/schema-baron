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
