# Schema Baron

Schema Baron is a local application builder for SQLite-backed TypeScript/Next.js applications. Use a compact Studio to design a database, compose pages, configure login, build queries and reports, inspect application flow, and generate an application that runs independently of Studio.

The working model is **Project → Page → Form → Control**. Grid, Record, Search and Login builders create ordinary editable objects. The schema editor and application map remain available after the new-project wizard finishes.

**Current milestone:** Studio verification and hardening is accepted, with all 20 acceptance cases and 29 requirements passed. Workshop Planner and the unrelated Library Catalog were authored and exercised through Studio; Volunteer Scheduler exercised the MCP workflow. This is a source milestone, not a packaged or hosted release. See [verification evidence](docs/evidence/verification/wp09-independent/report.json) and the [MCP walkthrough](docs/evidence/mcp-workflow/README.md) for exact revisions, observed results and limits.

## What you can do now

- Create a project with a new SQLite database or connect an existing one.
- Create tables, columns, primary/foreign/unique keys, relationships and indexes; review migrations and backups before applying changes.
- Generate public lists and protected record forms with validation, named Delete confirmation, Save/Cancel destinations and related-record navigation.
- Configure simple visitor login, account provisioning, global/page/action access rules, and return to a selected record or parent after login.
- Build joined/grouped queries, exact-decimal totals, zero-child results and parameterized reports.
- Work in Design, HTML, Code, Preview and Live Page; inspect application and endpoint flow.
- Declare and edit supported authored extensions, regenerate while preserving data and authored code, and export independently runnable output.
- Use MCP to author the same underlying project through the local owner service.

The exercised platform is **Linux x64 with glibc**. There is one SQLite connection per project and one output target: **TypeScript + Next.js on Node.js**. Other operating systems and targets are not verified. Python and Spec Kitty are not required to install or use Studio. No hosted account, AI-provider API key or browser access key is required.

## Installation for humans and AI agents

Run the commands below in Bash. Stop on a failed command and resolve its diagnostic before continuing. Do not replace a failed prerequisite with an unverified workaround.

### 1. Select the current source

The verified implementation is currently on the feature branch below; it has not been merged into `main`. Clone source separately from the default application-project folder. The commands refuse an existing destination rather than resetting an existing checkout.

```bash
set -euo pipefail
mkdir -p "$HOME/src"
git clone --branch kitty/mission-studio-verification-hardening-01M6AQ6R-lane-h \
  https://github.com/LynnColeArt/schema-baron.git "$HOME/src/schema-baron-studio"
cd "$HOME/src/schema-baron-studio"
git status --short
git rev-parse HEAD
```

Record the commit when reporting an installation. A branch head can advance; use a specific reviewed commit when exact reproduction is required. Do not copy `node_modules`, `.next`, databases or private configuration from someone else's installation.

### 2. Activate the exact toolchain

Required versions are recorded in `.nvmrc`, `package.json` and the lockfile:

| Tool | Required version |
|---|---|
| Node.js | `24.22.1` |
| npm | `11.19.1` |
| Git | Available on `PATH` |

Choose one installation method. For an existing NVM installation, activate it and run:

```bash
set -euo pipefail
# Source your existing NVM initialization first if this shell does not define nvm.
nvm install 24.22.1
nvm use 24.22.1
npm install --global npm@11.19.1 --ignore-scripts
hash -r
node --version
npm --version
node -e 'if (process.versions.node !== "24.22.1") process.exit(1)'
test "$(npm --version)" = "11.19.1"
```

Expected output is `v24.22.1` and `11.19.1`. Ensure the selected Node **and its npm** stay on `PATH` in every later shell and service process. A version-manager banner is insufficient; check the executables actually invoked. If using another installer, the official Node Linux x64 archive URL and recorded SHA-256 are in [runtime evidence](scripts/workspace/evidence/runtime.json). Verify the archive before extraction. The recorded verification checked the official TLS checksum, not a GPG release signature.

Without NVM, Linux x64/glibc agents can install the recorded official archive into a new user-owned directory. This requires `curl`, `tar` with xz support, and `sha256sum`; it does not require sudo. The checksum below is the one committed in runtime evidence.

```bash
set -euo pipefail
SCHEMA_BARON_TOOLCHAINS="$HOME/.local/share/schema-baron-toolchains"
SCHEMA_BARON_DOWNLOAD="$(mktemp -d)"
mkdir -p "$SCHEMA_BARON_TOOLCHAINS"
test ! -e "$SCHEMA_BARON_TOOLCHAINS/node-v24.22.1-linux-x64"
curl --fail --location --output "$SCHEMA_BARON_DOWNLOAD/node.tar.xz" \
  https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-x64.tar.xz
printf '%s  %s\n' \
  '6c172a9ab6718f7b801fb5a7bd486af2ee5e32758086a04b84fcce2aa77095e6' \
  "$SCHEMA_BARON_DOWNLOAD/node.tar.xz" | sha256sum --check
tar -xJf "$SCHEMA_BARON_DOWNLOAD/node.tar.xz" -C "$SCHEMA_BARON_TOOLCHAINS"
export PATH="$SCHEMA_BARON_TOOLCHAINS/node-v24.22.1-linux-x64/bin:$PATH"
npm install --global npm@11.19.1 --ignore-scripts
hash -r
node -e 'if (process.versions.node !== "24.22.1") process.exit(1)'
test "$(npm --version)" = "11.19.1"
```

Persist that `PATH` selection in your service launcher or reactivate it in each new shell. An existing toolchain directory is not overwritten; reuse it only after checking its versions, or choose a new directory. The temporary download can be removed after successful verification/extraction.

Do not use `latest`, update the lockfile, run `npm audit fix`, or change package versions as part of installation. If the pinned runtime cannot be acquired, report that prerequisite as blocked.

### 3. Install and build Studio

From the repository root, with the pinned toolchain active:

```bash
set -euo pipefail
npm ci --ignore-scripts
npm run native:verify
npm run typecheck
npm run build
```

Success means each command exits zero, native verification checks the packaged SQLite prebuild, and the Studio/MCP build outputs exist:

```bash
test -f apps/studio/dist/main.js
test -f apps/studio/.next/BUILD_ID
test -f apps/mcp/dist/main.js
```

The repository deliberately denies dependency lifecycle scripts. If SQLite verification fails, retain the diagnostic; do not enable all install scripts or substitute an unreviewed native build. Unsupported platforms fail explicitly. Initial package acquisition requires network. Offline installation requires an already populated compatible npm cache.

Build before starting consumers. **Do not rebuild a checkout while its Studio is running**: the process consumes that checkout's build output. Stop the exact owned service first, or use a separate checkout with its own dependencies and build artifacts.

### 4. Start Studio and confirm readiness

Keep this process running in its terminal:

```bash
PORT=4317 npm start --workspace @schema-baron/studio
```

Wait for `Schema Baron owner ready at http://127.0.0.1:4317`, then open that URL. From another terminal, a basic HTTP check is:

```bash
curl --fail --silent --output /dev/null http://127.0.0.1:4317/
```

A successful HTTP check confirms the page is served; finish the browser workflow below to check usability. Start through the Studio bootstrap, not `next start` directly: the bootstrap owns configuration, storage, recovery and command handling. If the port is occupied, select another port and use the reported URL. Never kill an unrelated process to free a port. Ctrl+C in the owning terminal shuts Studio down.

Normal startup creates private state under `~/.local/share/schema-baron-studio`. Browser access connects automatically without exposing the private MCP capability. On first run, save **Workspace settings → Projects folder**. The default is:

```text
~/projects/schema-baron/<project name>/
```

A custom projects folder may be a path that does not exist yet; Studio creates it when needed. Changing this preference affects future projects and does not move existing ones. Keep source code, project definitions, business databases, private identity stores and replaceable generated output in their intended separate locations. Do not delete the private state folder as a troubleshooting shortcut.

## Build your first application

A small parent/child application is a useful first walkthrough:

1. Choose **New Project**, name it **Workshop Planner**, and review its folder. Choose a new SQLite database; for an existing database, inspect its tables and keys before continuing. Inspection does not create a new schema in that existing file.
2. In the reusable schema editor, create `workshops` with integer primary key `id` and required text `name`. Create `sessions` with integer primary key `id`, required text `title`, and required integer `workshop_id` referencing `workshops.id`. Choose restricted deletion to prevent removing a workshop with sessions.
3. Choose list and record pages for both tables. Keep lists public. Enable simple login and protect the record pages/write actions while leaving the global default public.
4. Review navigation, proposed pages, schema changes and the rendered flow chart. Use Back to revise the proposal. **Complete** saves the project; it does not replace the separate generation review/apply step. Cancel before Complete creates no project folder or database.
5. Reopen **Schema**, **Login and access**, or the application map whenever needed. The flow-chart and settings icons beside project names return to those views. Provision a test visitor through Login and access; generation does not invent an account.
6. Inspect the generated Grid/Record objects and relationship lookup. Configure labels and parent-filter links so workshops lead to their sessions, the list shows workshop names, and Add preselects the selected workshop. Use stable keys for navigation; display names are labels, not identifiers. The [author guide](docs/user-guide/index.md) explains these bindings.
7. Choose **Generate**, review the proposed output and conflicts, then Apply. Generate uses the project's saved output location, normally `generated/app` under its project folder. Existing projects can have a different saved destination; inspect the displayed path rather than guessing it.
8. Install the generated application's dependencies explicitly in its actual output directory:

   ```bash
   # Substitute the exact output directory shown by Studio.
   cd "/absolute/project-folder/generated/app"
   npm ci --ignore-scripts
   ```

9. In Studio, choose **Build generated output**, wait for success, then Start with an available loopback port. Open the reported visitor URL or Live Page. Studio and the generated application are separate processes and use separate visitor sessions.
10. Browse the public lists, log in, create a workshop and a related session, and check Save/Cancel and validation. Sign out and confirm public reads still work while protected writes require login. Follow a workshop's sessions link and verify Add retains that parent.
11. Change a caption or report setting in Studio, stop the generated runtime, review/apply generation again, reopen the **active output path**, reinstall dependencies there, build and start. Confirm saved rows, relationships, access rules and authored extensions survive.

Do not retain a shell working directory inside an old output tree across regeneration: promotion can move that directory into a backup while the same path now names the new active tree. Start a fresh shell or `cd` to the absolute active path again before installation or builds.

### Queries, source and the flow map

Use **Query Designer** to choose aliased sources, joins, parameters, grouping, expressions and ordering. Preview the query, save it, then bind a report to it. For customer/order-style totals, specify zero-child behavior, use exact decimal types, put aggregate thresholds in HAVING, and compare the report with an independent expected calculation. Multiple child joins can multiply rows; inspect fanout diagnostics before trusting a sum.

The application map shows actual pages, forms, actions, access gates and parameter mappings. The wizard's flow preview and the later map derive from project objects. Edit those objects rather than maintaining a separate diagram.

| Mode | Use it for |
|---|---|
| Design | Compose and select page/form/control objects. |
| HTML | Edit supported static content and stable object references. |
| Code | Inspect generated modules; edit only declared authored extensions. |
| Preview | Inspect the current draft, including unsaved content. |
| Live Page | Use the explicitly generated, built and running visitor application. |

Generated files belong to the generator. Put custom behavior in supported declared validator/action/service/event modules, which have typed contracts and preservation checks. Owned-source conflicts stop promotion for review. Preview and Live Page can differ until you save and regenerate. See [recovery and extensions](docs/user-guide/recovery-and-extensions.md).

## Connect an AI agent through MCP

MCP is optional. It forwards commands to the **same running local owner** used by Studio; it is not a second database writer. The browser needs no key. An MCP client needs a private local connection file; the owner capability is generated locally and is not an AI-provider API key.

For an existing owner, follow [owner-service and MCP configuration](docs/development/operations.md). For a fresh, separate agent workspace with known approved root IDs, the following setup avoids changing your ordinary Studio state. Run it with the pinned Node from the built repository:

```bash
set -euo pipefail
export SCHEMA_BARON_AGENT_HOME="$HOME/.local/share/schema-baron-agent"
node --input-type=module <<'NODE'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
const base = resolve(process.env.SCHEMA_BARON_AGENT_HOME);
mkdirSync(base, { recursive: true, mode: 0o700 });
const ownerFile = join(base, 'owner.json');
const mcpFile = join(base, 'mcp.json');
if (existsSync(ownerFile) || existsSync(mcpFile)) {
  throw new Error('Configuration already exists; reuse or inspect it privately, do not overwrite it.');
}
const approvedRoots = Object.fromEntries(['projects', 'data', 'output'].map(id => [id, join(base, id)]));
for (const directory of [join(base, 'metadata'), ...Object.values(approvedRoots)]) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
}
const capability = randomBytes(32).toString('base64url');
writeFileSync(ownerFile, JSON.stringify({
  ownerId: 'schema-baron-agent', capability,
  metadataRoot: join(base, 'metadata'), approvedRoots
}, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
writeFileSync(mcpFile, JSON.stringify({
  ownerUrl: 'http://127.0.0.1:4318', capability
}, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log('Private owner and MCP configuration created; capability not printed.');
NODE
SCHEMA_BARON_OWNER_CONFIG="$SCHEMA_BARON_AGENT_HOME/owner.json" \
  PORT=4318 npm start --workspace @schema-baron/studio
```

This separate owner uses port 4318 and roots `projects`, `data`, and `output`. Keep it running. If choosing another port, update the private connection file's `ownerUrl` to match before connecting. The normal browser wizard remains available on this owner's URL too; its workspace preferences are separate from the ordinary owner.

In your MCP client's server configuration, replace these placeholders with absolute paths. Obtain the actual Node path with `node -p process.execPath`; obtain the checkout path with `pwd`.

```json
{
  "mcpServers": {
    "schema-baron": {
      "command": "/absolute/path/to/node-v24.22.1/bin/node",
      "args": ["/absolute/path/to/schema-baron-studio/apps/mcp/dist/main.js"],
      "env": {
        "SCHEMA_BARON_MCP_CONFIG": "/absolute/private/schema-baron-agent/mcp.json"
      }
    }
  }
}
```

Use direct Node for MCP clients: `npm start` writes banners that can interfere with protocol-only stdout. Keep both configuration files private; never paste their capability into chat, a URL, committed source, or a `NEXT_PUBLIC_` variable. Client configuration syntax may differ; the executable, arguments and environment above are the required process contract.

### Agent authoring procedure

1. Discover tools, input schemas and resource templates. The tested registry advertised 31 tools; 25 were exercised in the full workflow. Do not infer that an advertised option works without checking its outcome.
2. Create a project with an approved root ID and explicit output configuration. Inspect/create and bind its SQLite connection **before** constructing the desired schema, because binding imports the physical schema.
3. Author schema and project entities through supported commands; preview migration/generation plans and apply their exact current hash and required acknowledgements. Allocate fresh consistent UUIDs instead of replaying example IDs or historical plans.
4. Construct pages/forms, relationship display labels, navigation, query parameters and access policies. Record forms with Delete need display fields for named confirmation; model validation alone does not guarantee generation validation will pass.
5. Configure identity and provision a synthetic visitor privately. Managed provisioning references the configured identity `storeRef`, not the returned visitor user ID.
6. Validate, inspect flow, preview/apply generation, and read `manifest.outputTreeRevision`. This is the generated runtime revision, **not** the project revision.
7. Install generated dependencies explicitly in a terminal. Use MCP runtime build/run/status/stop and job/resource reads to observe actual completion. A started job or request timeout is not evidence of success or rollback.
8. Enter business data through the generated visitor interface. The registry currently has no general business CRUD or raw-SQL tool. Check login return context, parent defaults, validation, reports and row preservation across regeneration.

Tools use underscores in place of operation dots, such as `project_batch`. Arguments are `{requestId, projectId, expectedRevision, input}`; `operation` comes from the tool name. Consume returned revisions. Use fresh request IDs for fresh reads; exact replay returns the cached original outcome even after the project advances. On a stale revision, re-read and reconcile before issuing a new write. On a failed apply, inspect its committed/recovery state before retrying.

Resources contain owner outcome envelopes, not bare project objects. For complete observed entity shapes and sequencing, see the [actual MCP design inputs](docs/evidence/mcp-workflow/observed-design-inputs.json), [workflow report](docs/evidence/mcp-workflow/README.md), and [operation contracts](packages/model/src/commands.ts). The successful workflow used these source contracts; tool discovery alone is not yet a complete authoring tutorial. Root/workspace setup is trusted local bootstrap, not an MCP wizard.

## Run a generated app without Studio

Read the generated `README.md`, `AUTH.md` and, for portable exports, `PORTABLE.md`. In its app directory, with the pinned runtime:

```bash
set -euo pipefail
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
APPLICATION_DATABASE_PATH=/absolute/private/application.sqlite \
  npm start -- --hostname 127.0.0.1 --port 4320
```

The database must already exist and match the generated schema. Keep its path and adjacent managed identity store persistent and outside replaceable output. Default export excludes business data and visitor accounts/sessions/secrets. Including business data is explicit and still does not create accounts. A separate deployment needs explicit visitor provisioning; see [portable output and provisioning](docs/user-guide/portable-output.md). Generated dependencies have their own lockfile and no unpublished workspace packages.

## Verification and troubleshooting

Installing Studio does not require the entire acceptance suite. To run developer checks, first install Chromium, because some unit/integration tests launch a real browser:

```bash
set -euo pipefail
npx --no-install playwright install chromium
# Linux browser system libraries must also be present.
# If needed, review and explicitly authorize: npx --no-install playwright install-deps chromium
npm run verify
node --test scripts/acceptance/evidence.test.ts scripts/acceptance/report.test.ts
```

`npm run verify` checks the implemented workspace; the unused source-less `@schema-baron/ui` scaffold reports NOT IMPLEMENTED rather than fabricated success. The Studio itself lives in `apps/studio`. The explicit Node command above covers the acceptance ledger/report tests outside Vitest discovery.

For the full two-application hardening procedure, follow [Studio verification](docs/user-guide/verification.md): `node scripts/acceptance/run.mjs all` from a committed, separate checkout. It acquires prerequisites, runs legacy checks and two fresh application cycles, and retains private captures separately from sanitized evidence. It is a substantial product verification run, not a quick installation probe. An author's candidate result still requires independent acceptance review. For the older disconnected clean-install procedure and its Linux namespace/system-tool prerequisites, see [release verification](docs/development/release.md).

| Symptom | Check |
|---|---|
| Engine mismatch or unexpected npm | Re-activate the pinned runtime; verify both actual versions in the current process environment. |
| SQLite native verification fails | Check Linux x64/glibc compatibility and recorded binary diagnostics; keep lifecycle scripts denied. |
| Startup fails or routes return 503 | Build first and start through the owner bootstrap; inspect private configuration and the actual startup diagnostic. |
| Port is already used | Pick another port; do not stop unrelated processes. |
| First-run settings keep appearing | Save a valid projects-folder preference for the owner instance you started. |
| Database moved or changed externally | Reconnect/reinspect deliberately and review a fresh plan; do not replace a missing file with an empty database. |
| Generate refuses a model | Follow the specific binding, display-field, policy or ownership diagnostic; review again after the fix. |
| Generated build cannot resolve packages | Install in the current active output tree, after promotion, with `npm ci --ignore-scripts`. |
| Report or Live Page looks stale | Distinguish draft/preview from saved/generated/runtime state; rebuild and restart the current output. |
| MCP cannot connect | Start the owner first; check absolute Node/script/config paths and the matching loopback URL privately. |
| Browser tests cannot launch Chromium | Install the pinned Playwright browser and required Linux libraries before verification. |

Stop only services and children owned by your run, using their recorded process handles. Keep configurations, identity stores, database backups, raw traces and credentials out of Git and public logs. Do not reset an existing user's workspace or run a full verification suite against their live study.

## Current limits

- Linux x64/glibc is exercised; macOS and Windows are unverified. There is no packaged desktop installer yet.
- One SQLite connection, static application routes, one TypeScript/Next.js target, constrained HTML, and synchronous Record extension points.
- Composite keys are supported, but automatic composite relationship lookup widgets are not.
- Custom form/control CSS classes and widths, form-level format rules, protected query Search/navigation and exact-decimal Table Sort are not supported implicit rendering promises; diagnostics identify unsupported combinations.
- MCP application/endpoint flow inspections work. The advertised **schema** projection currently returns `INVALID_INPUT`; it is a known failure, not a passed feature.
- MCP root/setup discovery and authoring guidance need improvement. Local bootstrap and source-contract examples remain necessary for the demonstrated workflow.
- Mapped-identity include-data export is refused. Default exports omit private identity; standalone account administration currently uses the documented operator adapter rather than a polished management CLI.
- Generation preserves declared authored modules, not arbitrary edits to generator-owned files. It is not a general round-trip source editor.

## Further reading

- [Author guide](docs/user-guide/index.md): schema, forms, access, queries and the five modes.
- [Recovery and extensions](docs/user-guide/recovery-and-extensions.md): migrations, reviewed restore and source ownership.
- [Portable output](docs/user-guide/portable-output.md): independent install/run and visitor provisioning.
- [Owner and MCP operations](docs/development/operations.md): private configuration, HTTP and stdio contracts.
- [Verification run history](docs/evidence/verification/runs.md) and [independent final proof](docs/evidence/verification/wp09-independent/report.json).
- [Full MCP workflow evidence](docs/evidence/mcp-workflow/README.md): calls, preservation checks, first failures and coverage limits.
- [Manual reading pack](docs/references/README.md): build private reference material locally. The original manual PDF and derivatives are not distributed.

The earlier experiment remains archived and does not supply current product behavior or demo credentials. Spec Kitty files describe the development process; they are not installation dependencies.
