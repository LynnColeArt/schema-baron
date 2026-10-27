---
status: active
owner: studio-server
updated: 2026-10-26
---

# Local owner service and MCP

Use the pinned Node 24.22.1/npm 11.19.1 toolchain from `.nvmrc`. Install with
`npm ci --ignore-scripts`; `npm run native:verify` verifies the packaged SQLite
prebuild without enabling lifecycle scripts. `npm run build` builds dependencies
before consumers, including the API-only Next application and stdio MCP executable.
No Studio workspace UI is implemented by WP04; `/` returns Next's normal 404.

Create a private JSON file outside the repository, chmod 600, containing:

```json
{
  "ownerId": "local-owner",
  "capability": "REPLACE_WITH_A_RANDOM_32_BYTE_BASE64URL_VALUE",
  "metadataRoot": "/absolute/private/metadata",
  "approvedRoots": { "projects": "/absolute/definitions" }
}
```

Generate the capability locally using Node `crypto.randomBytes(32).toString('base64url')`.
Never place it in URLs, `NEXT_PUBLIC_` variables, committed config or client bundles.
Approved roots are server configuration; API requests identify root IDs, never add
new roots. Metadata and definitions must be separate directories, with symlink,
traversal, native SQLite companion and existing-file alias protections from storage.
Configuration files are trusted local process input; protect their ownership and permissions.

Start the actual Next owner bootstrap:

```sh
SCHEMA_BARON_OWNER_CONFIG=/absolute/private/owner.json PORT=4317 npm start --workspace @schema-baron/studio
```

The bootstrap binds IPv4 `127.0.0.1` only, opens exactly one `ProjectCore`, recovers
before serving commands and closes the writer on SIGINT/SIGTERM. Use `PORT=0` for a
free port; stderr prints the chosen loopback URL. The capability is never printed.
Do not run `next start` directly: that bypasses owner configuration and routes return
503. No automatic dependency install, generated script execution, SQL or arbitrary
filesystem endpoint exists.

## HTTP v1

Authenticate requests with `Authorization: Bearer <capability>`. Every request must
have the exact configured listening Host; any Origin must equal that loopback origin.
Cross-site/same-site fetch metadata is rejected. The Next bridge uses the trusted
listening origin for its internal Request URL because Next normalizes it to localhost;
it retains original Host and Origin headers for independent validation.

- `GET /api/v1/capabilities`: implemented operation names, generated strict JSON
  schemas and approved root IDs. Later capabilities are absent until registered.
- `POST /api/v1/projects`: strict `{requestId,name,approvedRoot,target}` convenience
  create; its request ID becomes its stable project ID, so retries select the same
  project. This convenience form rejects slash/backslash and dot-segment IDs. Target is `next-typescript-sqlite`.
- `GET /api/v1/projects?approvedRoot=projects`: registered project summaries.
- `GET /api/v1/projects/{id}`: committed snapshot.
- `POST /api/v1/projects/{id}/commands`: canonical `{requestId,operation,
  expectedRevision,input}` envelope; optional `projectId` must equal the route ID.
  Use `project.create` here to supply a separate explicit project ID. Input and result
  schemas come from the model registry. Unknown fields and unimplemented operations fail.
- `GET /api/v1/projects/{id}/diagnostics`: current model validation result.
- `GET /api/v1/jobs/{jobId}?projectId={id}`: observed owner job state.
- `DELETE /api/v1/jobs/{jobId}?projectId={id}&requestId={key}&expectedRevision={rev}`:
  same command path as `job.cancel`. Both job operations are also registered commands.
- `GET /api/v1/projects/{id}/events?afterSequence=0&limit=100`: finite SSE replay,
  ordered `id`, revision/job/diagnostic frames, then `replay-complete`. Reconnect using
  the last sequence; pagination is bounded to 1–1000. A `refetch` frame with
  `refetchRequired:true` means discard tentative replay and GET its snapshot URL
  before resuming. A cursor beyond the owner's sequence also requires refetch.

Each JSON response uses `{ok,revision,result,diagnostics}` or
`{ok:false,revision,error:{code,message,retryable},diagnostics}`. Status mapping is
400 schema/unknown capability, 401 authentication, 403 owner/origin/path, 404 unknown
object, 409 freshness/idempotency/fingerprint, 422 semantic validation, 423 lease,
500 recovery. Payloads over 1 MiB receive 413 (`INVALID_INPUT`); JSON content type is
required. Unknown/repeated query keys fail. All responses disable caching; errors
use safe messages, with no request values, SQL, configuration paths or credentials.
The service emits no per-command logs. No long-running worker is advertised yet;
202 applies only to a real future asynchronous outcome carrying a job ID.

## Browser session exchange

WP05 must provide an owner-connect dialog. On initial load, call
`GET /api/v1/session` with `credentials: "same-origin"`. A valid session returns
`result.csrfToken`; 401 shows the connect dialog. Read the capability only from the
owner pasting their private configuration value into a password field (no autocomplete).
Keep it only in transient dialog memory and clear both input and variable immediately
after the exchange, including failures. Never render it into HTML/server props, ship
it in a bundle, or save it in local/session storage, logs, URLs or browser history.
The server configuration remains outside the served tree.

The UI exchanges the capability via `POST /api/v1/session`, same-origin
Origin, bearer header, JSON `{}`. The browser supplies Origin/fetch metadata;
client code must not try to set these forbidden headers. For example:

```ts
const response = await fetch("/api/v1/session", {
  method: "POST", credentials: "same-origin",
  headers: { "content-type": "application/json", authorization: `Bearer ${capability}` },
  body: "{}"
});
// Clear the password field and capability variable, then read result.csrfToken.
```

The response sets an HttpOnly/SameSite=Strict
cookie scoped to `/api/v1` and returns `result.csrfToken`. Remove the capability
from browser memory after exchange. Keep only CSRF proof in memory; after a reload,
the same-origin `GET /session` restores it from the HttpOnly cookie session.
Session writes require `x-csrf-token` and exact Origin; GET fetches may instead use browser `Sec-Fetch-Site: same-origin`. Reads
without either proof fail. Sessions expire in one hour (configurable for tests) and
`DELETE /api/v1/session` with CSRF proof revokes them. Loopback HTTP is the explicit
local development transport, so the cookie has no Secure flag. Generated-app user
identity is separate and this owner cookie must never authorize generated visitors.

## MCP stdio

Create a separate private JSON connection file:

```json
{ "ownerUrl": "http://127.0.0.1:4317", "capability": "THE_SAME_OWNER_CAPABILITY" }
```

Configure the MCP client to spawn Node with absolute `apps/mcp/dist/main.js` as
its argument and `SCHEMA_BARON_MCP_CONFIG` pointing to that file. Alternatively use
`SCHEMA_BARON_MCP_CONFIG=/absolute/private/mcp.json npm start --workspace @schema-baron/mcp`.
Use the direct Node executable for clients that require protocol-only stdout;
npm itself prints script banners. The executable uses the real MCP SDK stdio
transport; diagnostics go only to stderr. MCP accepts exact IPv4 loopback URLs,
refuses redirects, forwards bearer auth with a timeout and imports neither core
nor storage. It cannot acquire its own SQLite writer.

Tools encode dots as underscores (`project_batch`, `project_inspect`, `job_cancel`)
and accept the canonical envelope minus `operation`, which is fixed by the tool.
Tool lists and schemas are discovered from the owner's implemented registry.
Structured tool content is the same owner outcome, with `isError` set on failure.
Unknown capabilities produce `INVALID_INPUT`, never fake successes. Resources list
current project snapshots/diagnostics; URI templates are
`schema-baron://projects/{projectId}/snapshot`, `/diagnostics`, and `/jobs/{jobId}`.
Resource text contains the same structured owner outcome, including access failures.

## Feature and worker integration

`OwnerService.register(operation, handler)` supplies a typed operation-specific
command/result and optional candidate effect. Core retains strict input/result
validation, owner authorization, revision checks, candidate invariants, idempotency
and journaling. Handlers are trusted server modules, never user-supplied code.
There is no registration for arbitrary operation names or raw SQL/filesystem patches.
`schema.apply` and `generation.apply` must use `registerReviewedApply`, whose
`withLease(command, work)` runs `work(observedFingerprints)` exactly once under the
feature's external lease/transaction. The service verifies immutable plan hash,
kind, revision, expiry, fingerprints and exact acknowledgements before `apply`.
Features must keep the external lease through the effect; they must not mutate
outside that callback. Database/output commit journals remain their responsibility.

Register a live worker canceler with
`registerJobCanceler(projectId, jobId, handler)`; its key preserves the two ID scopes. It must synchronously acknowledge the observed actual state.
A missing controller leaves running work running; pending work can cancel without a
worker. A committed/failed/canceled terminal state is returned unchanged. If a worker
commits while cancellation is acknowledged, return `committed:true` and its actual
terminal status, never a fictional rollback. Job state and command completion/event
are one SQLite transaction. The model job port exposes status, progress, commit flag, diagnostics and an optional
strict outcome envelope. A real supplied final outcome survives storage and both
transports; running/no-worker jobs omit it. Worker provisioning belongs to its feature
slice. Job effects cannot accompany a project candidate: their operation record,
state and event live in a single durable metadata SQLite transaction, with no separate
JSON recovery intent to replay or lose.

Minimal shared-file edits for WP04: app manifests/build configs declare executable
entry points and existing workspace dependencies; Next `.js`→TypeScript resolution
supports NodeNext imports; app typechecks skip broken upstream declaration internals
while checking all authored code; the root build follows declared workspace edges.
The core command effect adds a typed job and storage completes it atomically with
its operation record, avoiding a second persistence path. Dependency lock changes
add only Studio workspace edges; exact third-party artifacts/scripts policy is unchanged.

## WP04 observed verification

Tests use temporary roots, dynamic ports, real SQLite, real HTTP requests and real
SDK stdio subprocesses. `packages/core/tests/transport/behavior.test.ts` covers strict
schemas, stale/duplicate IDs, semantic atomicity, trusted Host/Origin, session CSRF,
payload/path boundaries, job cancellation race/rollback and leased plan freshness.
`apps/mcp/tests/parity.test.ts` replays one corpus through both transports and checks
identical outcomes and persisted state, honest discovery, resources and forged auth.
`packages/core/tests/transport/bootstrap.test.ts` starts built Next + built stdio MCP
and creates/inspects through the actual Next route. These are API proofs; no UI
acceptance, generated application or unimplemented worker proof is claimed here.

Observed on Node 24.22.1, npm 11.19.1, Linux x64: clean-output `npm run build`
passed; `npm run verify` passed all implemented workspace typechecks/builds,
native SQLite 3.53.4 insert/transaction/online-backup smoke, diff lint, credential
scan, 120 tests in 10 files, and exact dependency evidence validation (182 installed,
76 platform optional absent, 258 locked registry artifacts). `npm audit --json`
reported zero vulnerabilities. Dedicated test-source strict TypeScript checks also
passed. Missing generator/sqlite/UI packages remain explicitly NOT IMPLEMENTED.
