# Run an exported application independently

This procedure is for the deployment operator. It does not require a running Studio after export. It was exercised on Linux x64/glibc with Node 24.22.1 and npm 11.19.1. macOS/Windows operation is unverified; owner filesystem safety uses Linux `/proc` file-descriptor anchoring.

Definition JSON exports the authored model. Portable application export additionally writes generated source into a new unused approved destination. Select whether to include business data explicitly. By default the export excludes the business database, secrets, identities and sessions. Supply a compatible separately managed database. The explicit include-data option creates an online backup; it never copies live WAL files blindly. Mapped-identity databases are refused for include-data export because removing hashes could damage relational data. Do not bypass that refusal or distribute hashes.

Read the exported `PORTABLE.md`, app `README.md` and `AUTH.md`. From its `app` directory:

```sh
node --version # v24.22.1
npm --version  # 11.19.1
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
APPLICATION_DATABASE_PATH=/absolute/deployment/application.sqlite npm start -- --hostname 127.0.0.1 --port 4320
```

The database must already exist. Use the exact same absolute `APPLICATION_DATABASE_PATH` for provisioning and runtime. Keep it and its adjacent identity store private and persistent. Including business data does not include visitor accounts. A new deployment needs new users; old Studio visitor sessions do not transfer. Localhost HTTP is supported for local operation; deployment HTTPS/Host/Origin handling must preserve the generated server's checks.

## Provision managed visitors without Studio

There is no polished standalone account-management CLI. The published [operator adapter](../../scripts/release/provision-managed.mjs) invokes the existing generated `IdentityStore` API. Copy that script to a private operator-tools location outside replaceable output. It imports `server/identity-store.ts` and `server/auth-config.ts` from the exported app. Node 24's default TypeScript stripping and `--conditions=react-server` are required. No extra package, auth endpoint or lifecycle script is added.

After installing app dependencies, use a non-echoing prompt (Python 3 is used only for this operator input convenience, not by the generated application):

```sh
python3 -c 'import getpass,json; print(json.dumps({"username":getpass.getpass("Visitor username: "),"password":getpass.getpass("Visitor password: ")}))' |
  node --conditions=react-server /absolute/operator-tools/provision-managed.mjs /absolute/export/app /absolute/deployment/application.sqlite
```

Both prompts use the controlling terminal and write no credentials to command arguments/history. Do not enable shell tracing, record the pipe, or redirect its plaintext to a public log. Alternatively provide JSON `{ "username": "…", "password": "…" }` through stdin from a separately protected mode-0600 file, then securely manage that credential input. Never put credentials directly in shell command arguments.

The adapter requires enabled managed identity (`authConfig.mapping === null`), derives the same adjacent store with `managedIdentityPath(database, authConfig.projectId)`, calls `new IdentityStore(path, projectId)`, `await store.provision(username, password, randomUUID())`, and closes it in `finally`. The store uses mode 0600 and versioned salted scrypt hashes. Existing usernames and consumed request IDs are refused rather than overwritten. This adapter does not support mapped provisioning; a mapped source needs its compatible schema and a separately reviewed operator procedure. Do not export identity hashes to make it appear portable.

Start the app with that same database path, open a protected Record route, sign in, verify the expected public/private navigation, then sign out. Wrong credentials must fail, and logout must revoke the session. Back up the private adjacent store deliberately when moving a deployment; moving only the business database creates a different empty identity location. Never store the identity beside replaceable generated source.

## Independence and offline use

Generated dependencies are registry-pinned with their own lockfile and contain no `@schema-baron/*`, workspace/file/link imports or unpublished services. After acquiring Node/npm/packages/browser tooling, core local authoring, SQLite and visitor apps require only local processes. A cold install needs network. `npm ci --offline --ignore-scripts` requires a populated compatible npm cache; it does not create an offline mirror. Test tooling and axe are separate from visitor production prerequisites.
