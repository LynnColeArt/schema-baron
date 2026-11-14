import Database from "better-sqlite3";
import { ProjectCore } from "@schema-baron/core";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const [root, point] = process.argv.slice(2);
const restorePoint = point.startsWith("restore-");
const options = {
  ownerId: "owner",
  metadataRoot: join(root, "metadata"),
  approvedRoots: { projects: join(root, "projects") },
  migrationFault: (p) => {
    if (active && p === point.replace(/^restore-/, "")) process.exit(87);
  },
  fault: (p) => {
    if (point === "metadata-save" && p === "metadata" && active)
      process.exit(88);
  },
  migrationWorkerFault: [
    "before-backup",
    "after-backup",
    "during-rebuild",
    "before-db-commit",
    "after-db-commit",
  ].includes(point)
    ? point
    : undefined,
};
let active = false;
const core = new ProjectCore(options);
const path = join(root, "projects", "app.sqlite");
const db = new Database(path);
db.exec(
  "CREATE TABLE parent(id INTEGER PRIMARY KEY,title TEXT NOT NULL);CREATE INDEX title_lookup ON parent(title);CREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent(id));INSERT INTO parent VALUES(1,'original');INSERT INTO child VALUES(9,1)",
);
db.close();
const run = (operation, input, revision, requestId = crypto.randomUUID()) =>
  core.executeAsync("owner", {
    projectId: "p",
    operation,
    input,
    expectedRevision: revision,
    requestId,
  });
const demand = (outcome) => {
  if (!outcome.ok) throw Error(JSON.stringify(outcome));
  return outcome.result;
};
demand(
  await run(
    "project.create",
    {
      name: "Crash proof",
      approvedRoot: "projects",
      target: "next-typescript-sqlite",
    },
    0,
  ),
);
const inspected = demand(
  await run(
    "connection.inspect",
    { approvedPath: "projects:app.sqlite", mode: "read-only" },
    1,
  ),
);
demand(
  await run(
    "connection.bind",
    {
      connectionId: inspected.connection.id,
      fingerprint: inspected.connection.fingerprint,
    },
    1,
  ),
);
const project = core.snapshot("owner", "p");
const schema = structuredClone(project.schema);
schema.revision++;
schema.tables.find((t) => t.physicalName === "parent").columns[1].physicalName =
  "caption";
demand(
  await run(
    "project.batch",
    {
      operations: [
        { kind: "put", entity: "schema", id: schema.id, value: schema },
      ],
    },
    2,
  ),
);
const plan = demand(
  await run(
    "schema.preview",
    { desiredSchemaRevision: schema.revision, backfills: [] },
    3,
  ),
);
const command = {
  projectId: "p",
  operation: "schema.apply",
  input: {
    planId: plan.id,
    hash: plan.hash,
    acknowledgedImpactIds: plan.requiredAcknowledgementIds,
  },
  expectedRevision: 3,
  requestId: "crash-apply",
};
writeFileSync(join(root, "command.json"), JSON.stringify(command));
active = !restorePoint;
let outcome = await core.executeAsync("owner", command);
if (restorePoint) {
  const applied = demand(outcome);
  const live = new Database(path);
  live.exec("INSERT INTO parent VALUES(2,'later')");
  live.close();
  const p = core.snapshot("owner", "p");
  const plan = demand(
    await run(
      "schema.restorePreview",
      { connectionId: p.connections[0].id, backupRef: applied.backupRef },
      4,
    ),
  );
  const restore = {
    projectId: "p",
    operation: "schema.restoreApply",
    expectedRevision: 4,
    requestId: "restore-crash-apply",
    input: {
      planId: plan.id,
      hash: plan.hash,
      acknowledgedImpactIds: plan.requiredAcknowledgementIds,
    },
  };
  writeFileSync(join(root, "command.json"), JSON.stringify(restore));
  active = true;
  if (point === "restore-after-db-commit")
    options.migrationWorkerFault = "after-db-commit";
  outcome = await core.executeAsync("owner", restore);
}
writeFileSync(join(root, "outcome.json"), JSON.stringify(outcome));
await core.close();
