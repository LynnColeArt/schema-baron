# WP13 implementation and review evidence

Audience: independent WP13 reviewer and downstream WP14/WP17 implementers.

WP13 implements T061–T065 through the existing validated owner command path and
independent generated application. This is not WP14's Studio identity configuration
panel/walkthrough, nor the later report/login integration demonstration.

## Commands and interfaces

- `identity.configure`: strict managed `{kind:"managed",storeRef}` or explicit
  mapped identity schema; uses expectedRevision and advances one model revision.
  Both owner HTTP and MCP stdio discover it through the existing registry.
- `identity.provision`: existing strict transient input
  `{identitySourceRef,username,password}`; only the configured source is accepted.
  Uses the inspected connection provenance, approved path, actual SQLite schema
  fingerprint and file identity, plus a current revision/source check immediately
  before the asynchronous hash result can write. No default account is generated.
- `credentialRole: "username" | "password"` is the explicit control meaning.
  Construction writes it; arbitrary appearance labels/control ordering do not affect
  login semantics. Bound/read-only/non-Login credential controls fail validation.
- Generated `server/auth.ts` enforces declared page and action IDs. Record HTTP and
  server-action entry points invoke the same access checks before their existing
  SQLite services. Page guards run before Grid/Record reads. Explicit compiled
  Search parameter names select the declared Search action checks; omitting an
  action marker cannot bypass them. Protected navigation uses a guarded per-grid
  GET handler and rereads the typed selected source keys only after authorization.
- Return targets permit declared routes and typed declared key/search/sort/page/mode
  parameters, reject external/undeclared/duplicate inputs, and retain selected keys.
  No supplied route/source/table name is treated as authority.

The common `IdentityStore` implementation is emitted verbatim as server-only source;
core provisioning and independent output do not maintain separate hashing/session
implementations. The generator build copies that exact TypeScript source as an
emission template. Its explicit better-sqlite3 dependency reuses the already approved
pinned 13.0.3 artifact; no package/version was added or upgraded. Lifecycle scripts
remained disabled for every install.

## Identity/session storage and retry behavior

Managed identity/session storage is an external sibling of the bound application DB:
`databasePath + '.auth-' + sha256(projectId).slice(0,32) + '.sqlite'`, mode 0600.
It refuses symlink/hardlink aliases (including SQLite sidecars and dangling links),
unrelated pre-existing files, and unsupported identity store versions. Provisioning
never creates a missing application database. Mapped credentials require distinct
required text fields, a single-column ID PK, a unique username and a versioned hash;
other required columns must have defaults. Plaintext legacy hashes cannot log in.
Sessions remain project-scoped in the separate managed store.

Passwords use scrypt version 1, N=32768,r=8,p=1, random 128-bit salt and 64-byte key
with 64 MiB KDF memory limit. Login is capped at eight attempts/minute/project with
the same missing-account/wrong-password response. This policy is documented in the
emitted AUTH.md; production hardware tuning was not claimed.

Session tokens are random 256-bit values; only SHA-256 token and CSRF hashes enter
server storage. Sessions expire after eight hours, rotate on login and revoke on
logout. Cookies are HttpOnly/SameSite=Lax; HTTPS uses Secure and plain HTTP is allowed
only for explicit loopback hostnames. State changes require matching Origin and a
CSRF nonce; protected logout also verifies its stored session CSRF hash. Local HTTP
was exercised; a deployed TLS/ingress environment was not exercised.

Provisioning idempotency uses a per-owner-process random secret HMAC, never a durable
cheap password verifier. Same-process matching/in-flight requests share their outcome;
changed input conflicts. On restart the old key is unavailable, so any reused request
ID explicitly returns IDEMPOTENCY_CONFLICT with consumed/restart guidance and never
reprovisions. A failure between identity DB commit and owner metadata recording can
leave an uncertain outcome: inspect the identity source and choose a new request ID;
username uniqueness prevents accidental overwrite. Cross-resource exactly-once
matching after restart is deliberately not claimed.

## Integration rationale (coordinated with orchestrator)

Primary ownership alone could not connect secure behavior to the existing product.
Narrow shared edits were approved for these concrete gaps:

1. Model schemas/commands/validation: typed credential meaning and an actual authoring
   operation for the previously unwriteable Project.identity field.
2. Core form construction/project registration: persist explicit semantics and share
   owner authorization, command validation, revision/idempotency/outcome handling.
3. Compiler/IR/base/record/grid/navigation emission: replace public-only capability
   rejection with compiled policies, connect actual Login forms and guard actual
   generated HTTP/page/server-action paths before database work.
4. Existing generated scalar type accepts the model's decimal rounding metadata so
   typed return configuration passes strict compilation for decimal Search context.
5. Existing public-list/Record tests expect the new actionable missing-identity
   diagnostic instead of a capability that this WP now implements.

WP17 was informed of optional GridIR.pageId, ActionIR.access, RouteIR.logins and
public/authenticated policy, GenerationIR.contexts/auth, and the guarded navigation
handler. Query-backed protected navigation remains unsupported by the WP13 compiler;
WP17 owns rejecting that case and filtering physical-table navigation handlers from
its report emitter until a keyed-query reread contract exists. Reports must retain
the page guard before their reads.

## Executable proof and retained evidence

`tests/integration/generated-auth/behavior.test.ts` starts from project.create,
introspects/binds an independent database, constructs normal Grid/Record/Login forms,
and authors policies through owner commands. It uses actual HTTP and an SDK MCP stdio
client to configure/provision, checks owner denial, replay/conflict/stale/restart
semantics and redacted metadata, then uses actual generation.preview/apply. The output
is outside workspace resolution with NODE_PATH empty, a pinned independent lockfile,
and ignored lifecycle scripts. It installs offline, typechecks, runs generated tests,
builds production, starts Next production and sends direct HTTP requests.

Observed cases include public list/read, protected reads and writes (also with the
application DB temporarily absent, proving no DB open before denial), protected
Search direct GET and navigation GET, forged action/key/origin/CSRF, owner capability
rejection as visitor identity, generic login errors, typed selected-key return,
external/undeclared/duplicate target rejection, authenticated update checked with an
independent SQL oracle, token rotation/expiry/logout revocation/rate limiting, and
source/browser bundle secret scans. Account credentials are random in memory; no
credential-bearing private MCP config or identity database is committed as evidence.

`packages/core/tests/identity/behavior.test.ts` additionally exercises explicit mapped
physical fields using real SQLite, hashed sessions/project isolation, salted hashes,
incompatible legacy hashes, changed database refusal and unrelated/aliased store
preservation. Generator auth tests exercise arbitrary labels/reordered controls,
global/page inheritance and missing/duplicate credential-role rejection. Generated
`tests/identity.test.mjs` independently verifies the emitted store's lifecycle.

Final verification logs are in `evidence/`. Workspace Python/JUnit coverage machinery
was unavailable in this operating surface and remains unverified; these are executed
Node/Vitest/generated-production results, not a claim about that separate gate.

Final observed results: workspace 38 files / 275 tests passed; full workspace build
and final generator rebuild passed; workspace typecheck and strict test-source
compilation passed; diff-scoped lint passed; credential heuristic checked 447 files;
npm audit reported zero findings. The final generated standalone install/typecheck/
test (including emitted identity lifecycle)/production build passed. All 18 direct
HTTP case groups in direct-http-observations.json passed. These results describe the
checked local Node 24.22.1/npm 11.19.1 environment, not unmeasured deployment behavior.
