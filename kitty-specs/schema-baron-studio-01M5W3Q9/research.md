# Research and engineering decisions

**Date**: 2026-10-26. Planning research only; no package installation, security scan or implementation spike completed.

## Decisions and alternatives

1. **Local browser Studio + Node service.** Reuse Next.js for the Studio shell and generated target, but keep model/core independent of it. A desktop wrapper adds packaging/security surface without proving the authoring workflow; defer it. Npm workspaces are sufficient before adding a build orchestrator.
2. **Supported Node 24 LTS line, not whatever host Node provides.** The host reports 26.8.1. The [official release schedule](https://github.com/nodejs/Release) distinguishes maintained release lines and lifecycle phases. Pin a supported Node 24 patch and validate dependencies on it at bootstrap. Recheck active-versus-maintenance status then; do not describe an older line as Active LTS merely from stale cached search snippets. [Next installation documentation](https://nextjs.org/docs/app/getting-started/installation) establishes the server/runtime baseline and App Router setup; registry engines are checked separately.
3. **SQLite adapter with better-sqlite3, isolated workers.** It supplies explicit transactions and backup APIs; [maintainer API documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md). Native install/build risk is accepted provisionally, subject to bootstrap ABI/platform verification. Built-in node:sqlite avoids a third-party native package but its runtime-specific stability/features were not verified sufficiently to select it. An ORM would not remove the need for schema introspection, generic query AST and rebuild planning; use a small explicit adapter first.
4. **Plan/apply migrations with recovery.** [SQLite ALTER TABLE documentation](https://www.sqlite.org/lang_altertable.html) describes limits and a generalized rebuild procedure. Introspect actual SQLite capabilities, preserve unknown constructs, and block unsafe dependency changes. Backups plus journal reconciliation address the database/filesystem atomicity gap; do not claim a cross-resource transaction.
5. **Shared typed AST/commands, not raw code strings.** Zod validates runtime boundaries. Structured query/constraint expressions eliminate eval and isolate SQL compilation. Exact decimal values remain strings/scaled integers, with decimal.js computations/SQL helpers. Alternatives of raw interpolated SQL, JavaScript expressions and floating money are rejected because they violate safety/generality invariants.
6. **React Flow as a projection component.** The [official guide](https://reactflow.dev/learn) covers controlled graph editing and custom nodes/edges. Store semantic relations in the canonical model; only positions in view state. A custom SVG engine would increase interaction/accessibility work; retain list/table alternatives for keyboard use.
7. **Local stdio MCP forwarding to one writer.** The [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [stdio server documentation](https://ts.sdk.modelcontextprotocol.io/server) support local spawned integrations. Use the observed stable v1 SDK line initially, not an unpinned v2 prerelease. Apply [MCP security guidance](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices) to local access, credential handling and process boundaries. No public MCP HTTP endpoint or OAuth service is needed for this local-owner scope.
8. **Explicit auth store and opaque sessions.** Use Node crypto scrypt with parameter versioning and per-user salt, random session tokens stored hashed, CSRF/origin checks, expiry and invalidation. [Node crypto reference](https://nodejs.org/api/crypto.html) documents cryptographic primitives; this is an implementation decision, not a claim that one primitive alone makes an authentication system secure. Use server policy checks for every read/write. Mapped legacy identity tables cannot import plaintext passwords as an acceptable final configuration.
9. **Template-generated ordinary code.** A compiler IR generates route/component/service/repository modules, rather than a Studio-dependent interpreter. Source ownership is file-level with extension modules. No arbitrary edits to generated source are promised roundtrip. This is clearer to review and recover than string-region surgery in shared files.

## Registry observations

Queried `https://registry.npmjs.org/<encoded-package>/latest` on 2026-10-26. Repository metadata matched the expected maintainer organizations; this checks identity signals, not package integrity or absence of vulnerabilities. Candidates are not an installed compatibility set.

| Package | Observed latest | Planned use |
|---|---|---|
| next | 16.4.3 | Studio and generated App Router |
| react | 19.3.1 | UI; align react-dom exact version at bootstrap |
| typescript | 7.0.2 | strict compilation; verify Next/tool compatibility |
| zod | 4.6.7 | shared boundary schemas |
| @modelcontextprotocol/sdk | 1.32.2 | stable local MCP adapter |
| @xyflow/react | 12.12.0 | schema and behavior projections |
| better-sqlite3 | 13.0.3 | SQLite adapter; observed engine >=22 |
| decimal.js | 10.6.0 | exact decimal arithmetic |
| vitest | 5.0.5 | tests; observed engine supports Node 24 |
| @playwright/test | 1.64.1 | browser acceptance |

If the newest TypeScript or test major is incompatible, select the newest supported patched compatible release, record why, and keep the spec unchanged. Bootstrap must pin exact runtime/package versions, lockfile integrities and provenance. Do not install all latest packages blindly from this table.

## Supply-chain posture and challenge record

Reference doctrine: `directive:051-supply-chain-install-safety` and `tactic:supply-chain-install-safety`. Some environments may expose these only as built-in documentation, not an activated charter. The plan still includes the required checks.

- Registry authenticity: official npm registry over TLS and expected source repositories observed. Recheck owner, provenance, dist integrity, release freshness and advisories on exact locked artifacts before install.
- Lifecycle scripts: deny install scripts by default. Explicitly review/allow only essential native better-sqlite3 build/prebuild steps with pinned artifacts; no broad enable-all. Browser binaries are a separate documented Playwright installation.
- Node: choose a supported LTS patch and test native ABI/build behavior, not merely package engines. Recheck Active LTS awareness and release status at bootstrap.
- No audit, provenance verification or lifecycle-script review has been completed. The lockfile does not exist yet.

A separate adversarial-squad challenge pass is **deferred_with_rationale** until the dependency lockfile and concrete native-install procedure exist. This avoids pretending a package-name-only review validates exact artifacts. That pass must occur during bootstrap before declaring the runtime ready. No agents were dispatched during this planning turn.

| Contested risk | Disposition | Follow-through |
|---|---|---|
| Native SQLite lifecycle code and ABI drift | accepted provisionally | Verify pinned artifact/provenance; targeted build-script allowance; real backup/rebuild tests on supported Node. |
| Latest TypeScript/test majors may be incompatible | changed | Versions are candidates; exact compatible patched set is a bootstrap deliverable. |
| Localhost mistaken for authentication | changed | Capability-token/owner-authenticated loopback service, origin checks, scoped paths; stdio bridge has no independent writer. |
| Generated credentials or authored code leaking into client | accepted as mandatory test concern | Bundle/export scans and direct auth tests; fail bootstrap/integration readiness if absent. |
| Full independent dependency challenge | deferred_with_rationale | Run against exact lockfile; record accepted/changed/deferred findings before bootstrap completion. |

## Evidence limitations

No Quackcess source was located or ported during planning. It remains an optional query-designer reference; inspect provenance/license and compatibility before copying code. No current old-app behavior is assumed solely from conversation history. Performance targets and visual fidelity are acceptance budgets awaiting measurements/review, not achieved results.
