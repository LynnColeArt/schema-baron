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


## Review cycle 2 — storage boundary repair

Acknowledged both P1 findings from canonical review-cycle-1 and the exact probes
retained by reviewer commits 03cc7d8 and 11edfc3. The original root-only lease did
not exclude parent/child roots reaching the same file; validating only the metadata
directory allowed SQLite to follow a linked child. Both claims in the original
T011 evidence were incomplete for those topologies.

Before production edits, the new public-package boundary suite failed nine of ten
initial cases. The reviewer's metadata-stage scheduling hook ran a second batch
without throwing or changing files: both parent-first and child-first topologies
acknowledged two different revision-2 outcomes, reproducing the lost-update defect.
Pre-existing SQLite child/companion symlinks also lacked the required path refusal.

The repaired invariant keys an exclusive native SQLite lease to each resolved
JSON path using a stable sidecar in that file's directory. Acquire occurs before
reading/importing the definition, before save freshness checks, and before recovery
or export replacement. It remains held until store close, so atomic JSON rename
cannot replace the lease itself. Root IDs, ancestor/descendant root boundaries and
independent metadata-store configurations do not change this identity. Ordinary
external file freshness checks remain in force while the actual-file lease is held.
Hard-linked JSON definitions are refused rather than splitting physical aliases
through atomic replacement.

The path invariant validates every native SQLite leaf and its -journal, -wal and
-shm companions before native opens, including metadata, store/root leases and
actual-definition leases. Symbolic or hard-linked aliases are refused with
PATH_OUTSIDE_ROOT. The outside sentinel database's independent before/after bytes,
original tables and row values remain unchanged in the public-API tests.

After repair, all 20 boundary regressions pass. The exact metadata-stage scheduling
oracle now observes the second open rejected with PROJECT_BUSY and the scheduled
second write unsuccessful. Independent JSON/SQLite reads show the first revision-2
edit and its successful operation, with no registered project or successful
operation in the refused store. After the first store closes, the second opens the
current revision 2, commits revision 3, and preserves both acknowledged edits.
Both root directions and normalized locators under different root aliases are tested.

Final observed verification: deleted all local model/storage/core dist trees and
rebuilt model -> storage -> core successfully; `npm run verify` passed native SQLite
3.53.4 insert/transaction/backup, typecheck/build/lint, credentials and exact dependency
evidence, and 110 tests in seven files (36 WP03 tests, including all four real
process-crash/restart recovery boundaries). Strict TypeScript checking of all four
WP03 test files passed. Offline npm audit again reported zero findings. No package
versions, dependencies, model contracts, transport code or hosted-sync settings
changed. Spec Kitty remains 3.2.7. Final diff lint passed before commit.
