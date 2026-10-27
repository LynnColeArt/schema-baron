# Project core API

`@schema-baron/core` exports `ProjectCore`. The host supplies the authenticated owner
ID, an application metadata directory and owner-approved definition roots. The core
checks that actor ID on every port. HTTP/session/capability verification belongs to
the later transport adapter; never use a request-provided actor as authenticated identity.

```ts
const core = new ProjectCore({
  ownerId: 'authenticated-owner',
  metadataRoot: '/owner/application-metadata',
  approvedRoots: { projects: '/owner/project-definitions' },
});
const outcome = core.execute('authenticated-owner', {
  requestId: crypto.randomUUID(), projectId: crypto.randomUUID(),
  operation: 'project.create', expectedRevision: 0,
  input: { name: 'My project', approvedRoot: 'projects', target: 'next-typescript-sqlite' },
});
core.close();
```

Create, inspect, open, list, batch, validate and secret-free definition export are
registered. Inputs/results use the model package's public schemas. Other operations
return `INVALID_INPUT` until their work packages register implementations. Registry
handlers may return one candidate project; the core requires unchanged identity,
exactly one revision increment and whole-model validation before persistence.

Open accepts an existing registered project ID or `rootId:relative/file.json` to
register an external definition. Export uses the same root-relative locator syntax;
`includeData:true` is refused until a data-export implementation exists. All paths
reject traversal and symbolic links. Root IDs, rather than absolute paths, persist
in metadata, so a host can reconnect a moved location by supplying its new approved
path on restart. Missing roots fail closed. Definitions contain portable model
references; database data, credentials, events, jobs and plans stay outside them.

Exclusive SQLite leases guard each metadata store, each approved definition root, and each resolved definition file for the entire store lifetime,
including recovery. Definition leases use stable sidecars beside the resolved JSON file, so parent/child roots and different root IDs or metadata stores share the same exclusion boundary. A definition lease is acquired before open/read/freshness checking and held across the journal, replacement and cleanup. The hidden lease files contain no project metadata or secrets. SQLite leaf and journal/WAL/SHM companion paths are validated before native opens; symbolic links and hard-linked database aliases are refused. Hard-linked JSON definitions are also refused because atomic replacement cannot preserve their alias identity. A process crash releases the operating-system lock. Every
mutation durably records an intent containing before/after identities and the
request outcome, commits metadata, then fsyncs and atomically replaces the readable
JSON file on the same filesystem. The file and SQLite are separate commit resources.
After interruption the writer stays blocked; restart reconciles the intent by
rolling forward exactly once before accepting commands. A conflicting external
edit prevents reconciliation and preserves the file for explicit repair. Do not
place approved roots in directories writable by untrusted users; root mappings are
trusted host configuration and should not change while the store is running.

Use `snapshot`, `events`, `job`, `recordJob`, `operation`, and `plans` for adapter
ports. Event replay is bounded (at most 1,000 per call), project-scoped and sequenced;
`refetchRequired` detects an invalid cursor. Jobs and immutable plan records survive
restart. `plans.validate` checks content hash, source revision/model hash, expiry,
observed fingerprints and exact acknowledgements while the store lease is held.
It does not perform a migration or generation apply. Transient passwords and raw
command inputs are never stored in operation records; only payload hashes and safe
outcomes are recorded. Model validation diagnostics preserve stable object IDs.

Verification uses real temporary files and SQLite. Recovery tests terminate a native
Node process after each durable journal boundary and compare metadata/file content
with independent SQLite reads before and after restart. Transports and generated
application behavior are outside this package's verification scope.

Integration rationale: core/storage manifests, build configs and core's root export
connect the owned modules to callable workspace packages. Dependencies reuse approved
model/storage interfaces and the existing exact better-sqlite3 version; lockfile
changes only add these workspace dependency edges.
