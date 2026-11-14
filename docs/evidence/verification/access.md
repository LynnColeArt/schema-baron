# Access-boundary verification (WP04)

This is scoped proof for the independent WP04 reviewer. It does not accept the
mission or replace WP06 recovery work and WP08's two complete clean cycles.
Validated application/test code: `92e9246cb4d2e4f3667d9c15c8357800537f0c96`.
The evidence commit is separate from that tested code.

The final fresh run passed one combined browser test in 86.288384 seconds, with
zero failures, errors, skips or retries. Both private run-provenance records name
that exact revision. Node was v24.22.1 and Chromium was 156.0.8078.4. Sanitized
[actual results](access.results.json), [retained failures](access.red.json) and
[scoped observations](access.json) preserve the distinction between captured
results and assertions checked by the exact hashed passing test.

## Observable coverage

- Both applications were authored through the existing normal Studio wizard,
  Schema, Properties, Queries, Access and generated visitor forms. No project
  model seed, direct-command definition write, SQL business repair or generated
  source patch supplied a missing UI setting. Read-only observers compared exact
  business rows; synthetic expected money remained decimal strings.
- Every public list/report remained anonymously readable. Every Record's actual
  generated handler was discovered from its emitted config, including Library's
  ordered composite association. Each table's insert/update/delete ran through
  both explicit JSON and captured current-build React server-action protocols.
  Valid CSRF plus exact Origin reached authorization; anonymous and invalid-origin
  cases left exact all-table rows unchanged. Authorized controls actually changed
  rows with valid, deletable temporary values, then restored the original fixture.
- The initial matrix and the complete matrix after valid edits, rejected typed
  context, logout/relogin, expiry and cross-project session changes passed.
  Across these two phases there were 252 direct matrix requests, plus public and
  protected-page reads. The retained matrices record 39 Workshop and 97 Library
  observations per phase, including positive controls.
- Normal Properties/Events authored Library book → filtered copies navigation.
  Each app's empty-parent list led to Add with its typed parent preselected before
  other fields were filled. Login retained that target. Cancel retained its exact
  filtered URL. UI Save added exactly one independently expected row, returned to
  the same filter and a visible confirmed Delete restored all original rows.
- Selected existing records retained their integer key and values through
  Save/Cancel, cross-tab logout and later login. The old tab rejected Save with
  explicit reload/sign-in guidance. Retained revoked tokens failed actual JSON
  writes even when their original valid CSRF nonce was replayed.
- Separately labeled expiry fault phases created temporary rows through authorized
  real handlers, then changed only the owned project's current session expiry.
  Captured RSC and JSON insert/update/delete requests with retained valid cookies
  all required sign-in and preserved exact fault-phase rows. Relogin returned to
  the original selected record; authorized cleanup restored the literal fixture.
- One browser held both real applications. Login A did not authenticate B; login B
  preserved A; A's token under B's cookie name failed with valid B CSRF and no row
  changes; logout A left B signed in. Ports were not treated as cookie isolation.
- Real login HTTP requests rejected external, protocol-relative, backslash,
  undeclared-route/parameter, duplicate-key and malformed typed return targets.
  Malformed key/filter update requests preserved every row. Both original journey
  remainders also passed their validation, uniqueness, restrict-delete, exact
  report and preservation assertions.

## Reproduced shared repairs

ACCESS-001: on production base `5f10082ed4d3496f2415db3e924e332c66b1b750`, the
first real anonymous captured server-action insert returned RSC200 with “The
submitted record parameters are invalid.” Authorization held, but its catch
classified the access error as invalid input. The emitted-action regression
reproduced 401 and 403 message loss. The narrow Record template now preserves safe
AccessError messages after rethrowing framework redirects; unknown exceptions
remain generic and never reveal private details.

ACCESS-002: the actual stale Record after another tab logged out showed only
“CSRF validation failed.” CSRF-first rejection was correct. The Record UI now
says “Reload this page and sign in again before trying this action.” The
presentation-only mapping changes neither guard order nor API authorization.
Its lower-seam expectation failed before the mapping and passed afterward; the
final browser run checks the exact actionable guidance.

The five emitted-action tests also execute the real emitted action under an
injected no-op guard as a separate lower-seam negative control. The same
unauthorized no-write invariant detects its write spy count of one; the protected
control writes zero. No live application guard or tracked production guard was
weakened. This checks assertion sensitivity; actual HTTP/CSRF/session enforcement
is proved separately by the real application matrix. Earlier compiler-API and
missing-context test-harness failures remain privately retained, as do the
incorrect initial assumption that Record pages already contained list headers.

## Ownership, checks and limits

The orchestrator approved pure callable helper extraction of the existing
Workshop/Library journey bodies, preserving wrapper tests and assertions. Their
populated/live callbacks hold both owned runtimes for the session checks and
resume the original remainders; cleanup stops only owned children. It also
approved Library's ordinary filtered-copy navigation and the exact Record catch
exception in the later WP07-owned template. The rationale is the reproduced
shared diagnostic boundary; no fixture-specific production branch was added.

Lane-local npm ci used denied lifecycle scripts; native verification passed and
all workspace links/artifacts stayed local. Strict TypeScript checks, focused
regressions, workspace typecheck, dependency verification, diff-scoped lint,
credential scan and npm audit passed; audit reported zero vulnerabilities.
`@schema-baron/ui` has no TypeScript source and the existing workspace checker
reports its typecheck as NOT IMPLEMENTED. The canonical pre-review gate at evidence head `3a30922379cafa95cf0734ef14e3690beca15fcb`
passed: actual retained JUnit independently contained 79 suites and 510 testcases,
with zero failures, errors or skips. Its wall time was 214.915 seconds. Dependency
and native stages passed; no force or skip was used. The recorded transition
event is `01M6ED0FMNC7ZC8CWVB8F1HDFZ`. This later evidence-only update changes
no application/test code and does not require another test-for-prose cycle.
A workflow transition or zero API counts never substitute for that actual report.

All eight observations passed canonical schema, requirement, artifact-hash and
privacy validation. AC-005/006/007 pass for each app within this proof. AC-015 is
explicitly unverified in aggregate: its access/typed-context/session subcases
passed here, while stale commands, changed DB identity, invalid paths/ports and
recovery remain WP06/WP08 work. Regeneration, final two cycles, hosted success,
independent mission acceptance, merge and deployment are not claimed.
