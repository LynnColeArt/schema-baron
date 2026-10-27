# WP03 observed verification

Verified in lane-c with Node 24.22.1 / npm 11.19.1, scripts denied, installed
Spec Kitty unchanged at 3.2.7. This record covers the callable package API;
HTTP, MCP, UI, migration apply and generation apply remain later work packages.

- T011: real SQLite competing leases reject both a second connection to the
  metadata store and a second metadata store targeting the same definition root.
  Traversal/symlink export attempts preserve an independently read outside file.
  Definition and metadata roots reject overlap, including dot-prefixed paths.
- T012: public core commands create and batch-edit real files. Duplicate routes
  fail whole-model validation without changing any entity/file/revision. Failure
  diagnostics have their own sequenced event. Stale writes return
  REVISION_CONFLICT; same request/payload returns the stored result, and changed
  payload returns IDEMPOTENCY_CONFLICT. Persisted operation records include actor,
  base/new revision, observed outcome and event sequence.
- T013: four native subprocesses import the built public core package and exit
  with code 73 after intent, metadata commit, JSON replacement and before cleanup.
  Independent SQLite reads observe the expected interrupted state. Startup rolls
  forward to coherent revision 2, with exactly two total revision events and one
  stored edit operation. A second restart performs no additional recovery.
  Conflicting external edits are preserved and block recovery/mutations.
- T014: project-scoped replay survives restart and supports bounded cursors and
  explicit refetch on an invalid cursor. Job lookup persists independently by
  project. Plan records reject replacement, content tampering (including direct
  persisted-content alteration), wrong source revision/model hash, expiration,
  external fingerprint mismatch and missing exact acknowledgements.
- T015: create/list/open/switch/export/reopen run through the core. Moved roots
  reconnect through stable root IDs. An external readable definition can be
  registered through an approved locator. Newer format files remain untouched.
  Independent metadata-table scans and exported definitions contain no transient
  credential marker. Long opaque IDs remain valid within filesystem limits.

Observed commands and results:

- `npm ci --ignore-scripts --offline`: installed exact lock artifacts; no scripts.
- Removed local model/storage/core dist trees, then built model -> storage -> core:
  all succeeded. No build output was copied from another lane.
- `npm run verify`: native SQLite 3.53.4 insert/transaction/backup passed;
  typecheck, production package builds, diff lint, credential scan and dependency
  evidence check passed; 90 tests passed across six files (16 WP03 tests).
- Strict standalone TypeScript check of all three WP03 test files: passed.
- `npm audit --offline --json`: zero reported vulnerabilities. This uses the
  available local audit data and makes no broader supply-chain guarantee.
- `git diff --check`: passed.

Shared-file rationale: core/storage manifests, build configs and root export make
owned modules executable through package exports. The lock only adds workspace
edges to existing exact dependencies. The registry collector refreshed its timestamp
and lock hash after those edges changed; all 258 artifact records are unchanged.
Unimplemented later packages are explicitly reported as NOT IMPLEMENTED by verify;
no later transport or generated-application acceptance claim is made here.
