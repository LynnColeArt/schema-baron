# WP14 — Studio login and protected-page workflow

Audience: independent reviewer and downstream integration implementers.

The focused **Login and access…** dialog configures managed or explicitly mapped
identity through `identity.configure`, provisions transient credentials through
`identity.provision`, and saves ordinary policy/form/control entities through
`project.batch`. These are the existing shared HTTP/MCP operations. The dialog
requires saved workspace drafts first; it uses the supplied current revision and
never bypasses a stale/invalid response. Passwords live only in an uncontrolled
password input and the transient request, and are cleared before awaiting either
successful or failed provisioning. No password enters workspace drafts, recovery,
undo/redo, project serialization, or default credentials.

Global access has an explicit default. Page access independently inherits or
explicitly overrides it (including a public Login page). Actions inherit or require
sign-in; the UI never offers an action override that weakens a protected page.
Each editor shows effective access and the global/page/action policy it came from.
The canonical model validator and generated server guards remain authoritative.

Header placement creates an ordinary unbound, read-only identity control in the
selected form. Only that form's page gets a header. A username credential may also
have control kind `identity`; its explicit `credentialRole` excludes it from header
placement. Multiple header identity controls on one page are diagnosed before
output. Missing configured identity/public Login form/action is also diagnosed.
Captions and Login/Logout button labels retain ordinary Properties editing; the
browser walkthrough edits both labels there before generation.

The generated header reads the actual username from the shared server identity
store, using request cookies and durable session lookup; no browser identity cache,
owner token, alternate session implementation, or client-side authorization is
introduced. Anonymous headers do not open/create an identity store. Sign out submits
the actual declared logout action and returns to a declared public page. Invalid or
expired sessions render signed out on the next request.

Login uses explicit username/password roles and authored labels. Failed login keeps
username/return context, clears password, and reports a generic failure. Protected
page guards preserve declared typed selected keys and public list/filter context.
Login Cancel compiles its authored ordinary destination, validates that it is public,
and carries only declared typed context from the validated return target. Missing
Cancel configuration falls back to a declared public page. External/undeclared return
URLs still fail through the existing strict server validator. Direct Record requests
continue through approved authorization/CSRF/service boundaries.

## Necessary shared integration (coordinated with mission orchestrator)

- Workspace modal/menu registers the otherwise disconnected security editor.
- Login wizard adds Logout to the existing login/Cancel defaults. The approved
  generator previously rejected the wizard's ordinary Cancel action; compiler/emitter
  now support safe declared public Cancel destinations instead of discarding it.
- Compiler/IR/base/auth emission carries explicit page header placement and actual
  credential/action captions; removes header controls from business data columns;
  diagnoses ambiguous/missing configuration before generating.
- The existing shared identity store adds a username lookup for an authenticated
  session. Server-only helpers reuse strict return validation and session handlers;
  no second persistence/authentication path was added.

## Executed evidence

`tests/e2e/security-workflow/workflow.spec.ts` begins with a genuinely blank Studio
project and independently supplied SQLite data, then connects/binds visibly. Product
wizards create the public Grid and linked Record and a separate Login form. Normal
Properties author Record delete-name fields and Login/Logout labels. Visible security
controls configure/provision, place explicit per-page headers, protect the Record and
all writes, and verify persistence after reload. Visible generation previews/applies
real source output. An independent output root with empty NODE_PATH installs the
pinned lockfile offline with lifecycle scripts ignored, typechecks, runs emitted
tests, builds production and runs Next production.

The production browser retains a typed list filter through selected-record navigation,
public Cancel, failed login, successful login, and save. It displays the actual username,
logs out to a usable public list, and checks all three direct write actions reject the
revoked visitor cookie. An independent SQL query verifies the saved row. Random test
credentials are only in memory; screenshots occur after password clearing.

The mapped test rejects overlapping mapped fields without persisting identity, then
maps a distinct text PK/unique account/versioned hash table through visible controls.
It provisions once, rejects duplicate provisioning, checks password clearing, and
uses an independent SQL oracle to verify one salted versioned hash remains.

Native 200% zoom uses isolated Chromium Preferences
`partition.default_zoom_level.x = log(2)/log(1.2)`, physical viewport 1280×800.
Observed inner viewport is 640×400, DPR 2, CSS zoom 1. Keyboard Tab/Enter configures
identity and provisions an actual visitor, clears the password, and Escape restores
focus to the invoking control. This is native browser page zoom, not CSS zoom or
viewport resizing. Screenshots were visually inspected by implementer/orchestrator.

Focused policy/compiler tests cover effective source, action weakening rejection,
explicit credential/header distinction, duplicate headers and protected Login Cancel
rejection. The full inherited auth integration test still exercises standalone direct
HTTP enforcement, stale/invalid owner operations, SDK MCP provisioning parity, unsafe
return targets, credential redaction and session lifecycle (18 HTTP case groups). A real production POST of the newly
declared Login Cancel action is explicitly rejected with 403; only declared login
and logout operations can enter the session handler.

Final command results and screenshots are retained under
`tests/e2e/security-workflow/evidence/`. No dependency/version was added or upgraded.
Every install used `--ignore-scripts --offline`; no lifecycle script was enabled.
Python/JUnit coverage and deployed TLS/ingress were unavailable/unexecuted, and are
not claimed. WP17 query-report/login integration and later regeneration remain
explicit downstream integration work; no unapproved WP17 product was merged here.

Final observed results: workspace 40 files / 279 tests passed; full workspace
production build, final Studio rebuild and final generator rebuild passed; workspace
and strict browser-test source typechecks passed; scoped syntax/JSON/whitespace lint
passed; credential heuristic scanned 487 files. Final scoped Playwright run: three
checks passed in 45.9 seconds. The generated standalone install/typecheck/test/build
passed within the visible walkthrough. Existing workspace `@schema-baron/ui` remains
an explicitly reported empty package, not a claimed UI build result.

The final Studio production static chunk inventory is 19 JavaScript files totaling
1,346,823 bytes (all chunks, not compressed/route-specific); no bundle budget was
declared, so no budget pass is claimed. No approved axe scanner is installed; actual
label/focus/keyboard/native-zoom and screenshot checks ran, but an automated axe
scan was not executed.
