# Acceptance Checklist: Studio Verification and Hardening

This is an execution ledger, separate from spec quality. Every item starts **Not run**. All are mandatory except a specifically identified nonblocking infrastructure observation. Historical milestone results do not tick these boxes. Each observation must record run ID, commit, app, expected/actual outcome, evidence and defect/retest link.

| Case | App | Requirement coverage | Expected result / pass condition | Status |
|---|---|---|---|---|
| AC-001 | Both | FR-001, FR-016; C-002,C-005,C-006 | Fresh isolated workspace; exact source/toolchain/fixture hashes and evidence paths recorded; existing user studies unchanged. | Not run |
| AC-002 | Workshop | FR-002,FR-004; C-003 | New project under a missing path; wizard creates SQLite tables/keys, previews real pages/access/flow and completes; Cancel creates no project/database. | Not run |
| AC-003 | Library | FR-003,FR-004 | Schema editor creates authors, books, book_authors composite key, copies and loans with unique/FK rules; existing SQLite inspect/review/Cancel is read-only. | Not run |
| AC-004 | Both | FR-005 | Page/Form/Control edits work in supported views; flow/settings icons open the right project; completed flow matches proposed behavior. | Not run |
| AC-005 | Both | FR-006 | Named relations preserve distinct keys, parent links show only matching children, empty children are supported, Add preselects parent, Save/Cancel retain context. | Not run |
| AC-006 | Both | FR-007 | Valid insert/update, invalid/missing input, duplicate unique/composite key, Cancel, named Delete confirmation and restricted Delete have correct messages and atomic row outcomes. | Not run |
| AC-007 | Both | FR-008; NFR-002 | Lists public; protected page/direct CRUD rejected anonymously; no partial global lockdown; login/logout/return context and invalid external targets checked. | Not run |
| AC-008 | Workshop | FR-009 | Session count by workshop, zero-session row and minimum-count threshold match independent expected results after row changes. | Not run |
| AC-009 | Library | FR-009 | Author/book counts and separate book/copy exact-value totals do not inflate with multi-author fan-out; zero-child/NULL/threshold cases match expected results. | Not run |
| AC-010 | Both | FR-004,FR-014; NFR-001 | Non-destructive schema change reviewed/applied; destructive preview rejected/canceled safely; existing rows and unrelated project unchanged. | Not run |
| AC-011 | Both | FR-011 | Generated source inspection and one declared authored extension can be configured using supported Studio UI; extension behavior is observable. | Not run |
| AC-012 | Both | FR-010; NFR-001 | Two regenerations preserve business rows, identities, model settings, names/links/Add context/reports and declared authored bytes; modified owned source causes a reviewed conflict. | Not run |
| AC-013 | Both | FR-012 | Export without private data by default; explicit supported data snapshot verified; independent install/type/test/build/run with Studio stopped, private identity/config external. | Not run |
| AC-014 | Both | FR-013; NFR-005 | Schema/query/page/control drafts, including invalid partial numeric input, survive documented switch/reload paths and 30 unrelated notifications with no unintended caret/text/ownership loss. | Not run |
| AC-015 | Both | FR-014 | Duplicate command request, stale model revision, changed database identity, invalid path/context and occupied port are clear, atomic and recoverable; retry only as an explicit fresh/replayed request. | Not run |
| AC-016 | Both | FR-014; NFR-001 | Controlled interruption of migration/regeneration leaves a verifiable committed state or documented recovery; no false success or business/authored overwrite. | Not run |
| AC-017 | Both | FR-015; NFR-002 | Bounded MCP/direct-command parity validates revisions, idempotency, authorization and shared state; this separate smoke never repairs or replaces UI journey evidence. | Not run |
| AC-018 | Both | NFR-004,NFR-005 | Recorded reference machine and bounded dataset: 30 UI samples meet p95 2-second feedback / 5-second Save; observed draft stability has zero unintended changes. | Not run |
| AC-019 | Both | FR-006,FR-007,FR-017 | Duplicate names, quoted identifiers, ordered composite identity and supported/exceeded lookup boundary behave truthfully; each discovered defect has reproduction, severity and regression retest. | Not run |
| AC-020 | Both | FR-001,FR-016,FR-017; NFR-003,NFR-006; C-001..C-006 | Two consecutive clean full journeys at final revision; required automated/local/hosted checks distinguished; reviewer approves requirement matrix and finite verdict with no mandatory failure or high/critical defect. | Not run |

## Run policy

A live study may be inspected read-only as a baseline, but acceptance creates new isolated projects. Supplied raw SQLite fixtures are identified and hashed before connection; supplied Studio model JSON is forbidden for the cold-start journeys. Authoring through MCP or project.batch is tested separately in AC-017. Allowed terminal preparation is documented start/install/build/test/run and external configuration acquisition, never private model/data repair. Retries do not erase the failed observation. Preserve exact decimal values and ordered key tuples in the expected-result oracle.

## Severity and closure

Critical/high includes data or authored-code loss, unauthorized writes, wrong-project writes, incorrect persisted/query values, and any defect blocking a mandatory author/visitor/recovery journey. All must be repaired and rerun. Medium/low means a nonblocking issue with an explicit workaround or cosmetic effect; it can be deferred only while every mandatory outcome still passes. No waiver converts failed/unverified to passed.
