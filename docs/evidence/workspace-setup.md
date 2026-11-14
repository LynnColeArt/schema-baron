# Keyless local startup and workspace preferences

Verified 2026-10-27 on Node 24.22.1 / npm 11.19.1.

Studio now starts without a hand-provisioned configuration or browser key. First-run
Workspace settings defaults to `~/projects/schema-baron`; setup remains pending
across reloads until a writable location is saved. Later changes affect future
projects. Each new project gets `<projects folder>/<project name>`, with generated
output under its own `generated/app`. Existing directories are refused, and existing
projects keep their original immutable root IDs and locations.

Local browser session bootstrap requires the exact loopback Host/Origin, same-origin
fetch metadata and an explicit custom header. Sessions remain HttpOnly/SameSite and
writes require CSRF proof. Direct API/MCP clients still use the private capability;
normal Studio startup generates it locally. Older browser contract fixtures opt into
`SCHEMA_BARON_BROWSER_MODE=capability` to retain their explicit-exchange coverage.

Checks:

- Full automated suite: 488 tests / 75 files passed. After final preference durability
  and UI refinements, the relevant storage, MCP, client and workspace suite passed
  again: 35 tests / 5 files.
- Production browser suite: 5 scenarios passed, covering keyless startup without an
  owner configuration, unfinished setup after reload, folder validation, separate
  named project folders, changing the preferred base, restarting the actual process,
  retaining both projects, and the existing draft/recovery workflows.
- Typecheck, production build, diff lint and credential-pattern scan passed.
- CUA inspection of the persistent local Studio confirmed automatic connection and
  the first-run settings screen prefilled with `/home/lynn/projects/schema-baron`.
  The user's workspace remains blank and setup has been left for the walkthrough.

Full-suite generated capture files were kept outside the committed historical
mission evidence. Original mission acceptance/review records remain unchanged.
