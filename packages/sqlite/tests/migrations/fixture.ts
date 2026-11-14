import { expect } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectCore } from "@schema-baron/core";
import type { ReviewedPlan, Schema } from "@schema-baron/model";

export async function fixture(sql?: string, change?: (schema: Schema) => void) {
  const root = mkdtempSync(join(tmpdir(), "baron-migration-"));
  const options = {
    ownerId: "owner",
    metadataRoot: join(root, "metadata"),
    approvedRoots: { projects: join(root, "projects") },
  };
  let core = new ProjectCore(options);
  const path = join(root, "projects", "app.sqlite");
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(
    sql ??
      "CREATE TABLE parent(id INTEGER PRIMARY KEY, title TEXT NOT NULL); CREATE INDEX title_lookup ON parent(title); CREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent(id)); INSERT INTO parent VALUES(1,'original'); INSERT INTO child VALUES(9,1)",
  );
  const command = (
    operation: string,
    input: unknown,
    revision: number,
    requestId: string = crypto.randomUUID(),
  ) => ({
    projectId: "p",
    operation,
    input,
    expectedRevision: revision,
    requestId,
  });
  const run = (
    operation: string,
    input: unknown,
    revision: number,
    requestId?: string,
  ) =>
    core.executeAsync("owner", command(operation, input, revision, requestId));
  const created = await run(
    "project.create",
    {
      name: "Authored migration",
      approvedRoot: "projects",
      target: "next-typescript-sqlite",
    },
    0,
  );
  expect(created.ok).toBe(true);
  const inspected = await run(
    "connection.inspect",
    { approvedPath: "projects:app.sqlite", mode: "read-only" },
    1,
  );
  if (!inspected.ok) throw Error(JSON.stringify(inspected));
  const connection = (
    inspected.result as { connection: { id: string; fingerprint: string } }
  ).connection;
  expect(
    await run(
      "connection.bind",
      { connectionId: connection.id, fingerprint: connection.fingerprint },
      1,
    ),
  ).toMatchObject({ ok: true, revision: 2 });
  const project = core.snapshot("owner", "p");
  const schema = structuredClone(project.schema);
  schema.revision++;
  if (change) change(schema);
  else
    schema.tables
      .find((t) => t.physicalName === "parent")!
      .columns.find((c) => c.physicalName === "title")!.physicalName =
      "caption";
  expect(
    await run(
      "project.batch",
      {
        operations: [
          { kind: "put", entity: "schema", id: schema.id, value: schema },
        ],
      },
      2,
    ),
  ).toMatchObject({ ok: true, revision: 3 });
  const preview = await run(
    "schema.preview",
    { desiredSchemaRevision: schema.revision, backfills: [] },
    3,
  );
  if (!preview.ok) throw Error(JSON.stringify(preview));
  const plan = preview.result as Extract<ReviewedPlan, { kind: "migration" }>;
  const apply = {
    planId: plan.id,
    hash: plan.hash,
    acknowledgedImpactIds: plan.requiredAcknowledgementIds,
  };
  return {
    root,
    options,
    path,
    db,
    plan,
    apply,
    run,
    command,
    get core() {
      return core;
    },
    async restart() {
      await core.close();
      core = new ProjectCore(options);
    },
    async close() {
      db.close();
      await core.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
