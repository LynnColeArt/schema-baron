import { createId } from "@schema-baron/model";
import { expect, test } from "vitest";
import { startOwner } from "../../../../apps/studio/src/server/index.js";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  MigrationHistory,
  Project,
  ReviewedPlan,
} from "@schema-baron/model";
import { MigrationWorker, observed } from "../../src/migrations/index.js";
import { fixture } from "./fixture.js";

test("constraint failure after actual rebuild rolls back every SQL step and preserves the validated backup", async () => {
  const f = await fixture();
  try {
    const before = observed(f.path);
    const worker = new MigrationWorker();
    const id = crypto.randomUUID();
    const backup = join(f.root, "validator.sqlite");
    const plan = {
      ...f.plan,
      steps: [
        ...f.plan.steps,
        {
          id: f.plan.id,
          sql: "INSERT INTO child VALUES(10,999)",
          objectIds: [],
          transactional: true,
        },
      ],
    };
    await expect(
      worker.run(
        {
          path: f.path,
          backupPath: backup,
          id,
          authority: crypto.randomUUID(),
          plan,
        },
        () => {},
        () => {},
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(observed(f.path)).toEqual(before);
    expect(observed(backup).schemaFingerprint).toBe(before.schemaFingerprint);
    expect(observed(backup).dataFingerprint).toBe(before.dataFingerprint);
  } finally {
    await f.close();
  }
});
test("public cancellation validates owner/revision/idempotency before stopping the isolated child; concurrent mutations are leased", async () => {
  const root = mkdtempSync(join(tmpdir(), "baron-cancel-"));
  const cap = "migration-cancel-" + "x".repeat(40);
  const owner = await startOwner({
    ownerId: "owner",
    capability: cap,
    metadataRoot: join(root, "metadata"),
    approvedRoots: { projects: join(root, "projects") },
  });
  const db = new Database(join(root, "projects", "app.sqlite"));
  db.exec(
    "CREATE TABLE records(id INTEGER PRIMARY KEY,title TEXT);WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<50000) INSERT INTO records SELECT x,'kept' FROM n",
  );
  const http = async (
    operation: string,
    input: unknown,
    expectedRevision: number,
    requestId: string = crypto.randomUUID(),
    credential = cap,
  ) => {
    const response = await fetch(owner.url + "/api/v1/projects/p/commands", {
      method: "POST",
      headers: {
        authorization: "Bearer " + credential,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "p",
        operation,
        input,
        expectedRevision,
        requestId,
      }),
    });
    return { status: response.status, outcome: await response.json() };
  };
  try {
    expect(
      (
        await http(
          "project.create",
          {
            name: "Cancellation",
            approvedRoot: "projects",
            target: "next-typescript-sqlite",
          },
          0,
        )
      ).outcome.ok,
    ).toBe(true);
    const inspected = (
      await http(
        "connection.inspect",
        { approvedPath: "projects:app.sqlite", mode: "read-only" },
        1,
      )
    ).outcome.result;
    expect(
      (
        await http(
          "connection.bind",
          {
            connectionId: inspected.connection.id,
            fingerprint: inspected.connection.fingerprint,
          },
          1,
        )
      ).outcome.ok,
    ).toBe(true);
    const p = (await http("project.inspect", {}, 2)).outcome.result as Project;
    const schema = structuredClone(p.schema);
    schema.revision++;
    schema.tables[0]!.columns[1]!.physicalName = "caption";
    schema.tables[0]!.indexes.push({
      id: createId(() => "lookup"),
      physicalName: "lookup",
      columnIds: [schema.tables[0]!.columns[1]!.id],
      unique: false,
    });
    expect(
      (
        await http(
          "project.batch",
          {
            operations: [
              { kind: "put", entity: "schema", id: schema.id, value: schema },
            ],
          },
          2,
        )
      ).outcome.ok,
    ).toBe(true);
    const plan = (
      await http(
        "schema.preview",
        { desiredSchemaRevision: schema.revision, backfills: [] },
        3,
      )
    ).outcome.result as Extract<ReviewedPlan, { kind: "migration" }>;
    const input = {
      planId: plan.id,
      hash: plan.hash,
      acknowledgedImpactIds: plan.requiredAcknowledgementIds,
    };
    const applying = http("schema.apply", input, 3, "apply");
    let history: MigrationHistory[] = [];
    for (let i = 0; i < 100 && !history.length; i++) {
      history = (
        await http("schema.history", { connectionId: p.connections[0]!.id }, 3)
      ).outcome.result;
    }
    const jobId = history[0]!.id;
    expect(
      (await http("job.cancel", { jobId }, 3, "unauth", "forged")).status,
    ).toBe(401);
    expect((await http("job.cancel", { jobId }, 2)).outcome).toMatchObject({
      error: { code: "REVISION_CONFLICT" },
    });
    expect(
      (
        await http(
          "project.batch",
          {
            operations: [
              { kind: "put", entity: "schema", id: schema.id, value: schema },
            ],
          },
          3,
        )
      ).outcome,
    ).toMatchObject({ error: { code: "PROJECT_BUSY" } });
    expect(
      (
        await http(
          "schema.apply",
          { ...input, hash: "0".repeat(64) },
          3,
          "apply",
        )
      ).outcome,
    ).toMatchObject({ error: { code: "IDEMPOTENCY_CONFLICT" } });
    const canceled = await http("job.cancel", { jobId }, 3, "cancel");
    expect(canceled.outcome).toMatchObject({
      ok: true,
      result: { status: "canceled", committed: false },
    });
    expect(await http("job.cancel", { jobId }, 3, "cancel")).toEqual(canceled);
    expect((await applying).outcome).toMatchObject({
      ok: false,
      error: { code: "CANCELED" },
    });
    expect(
      db.prepare("SELECT count(*) AS n FROM records WHERE title=?").get("kept"),
    ).toEqual({ n: 50000 });
    expect(
      db.prepare("SELECT name FROM sqlite_schema WHERE name='lookup'").get(),
    ).toBeUndefined();
    expect(
      (await http("schema.apply", input, 3, "apply")).outcome,
    ).toMatchObject({ ok: false, error: { code: "CANCELED" } });
  } finally {
    db.close();
    await owner.close();
    rmSync(root, { recursive: true, force: true });
  }
});
