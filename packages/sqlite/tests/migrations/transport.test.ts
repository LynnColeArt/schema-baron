import { expect, test } from "vitest";
import Database from "better-sqlite3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startOwner } from "../../../../apps/studio/src/server/index.js";
import type {
  MigrationHistory,
  Project,
  ReviewedPlan,
} from "@schema-baron/model";

test("HTTP and real stdio MCP share apply/history/restore authority and immutable retry outcomes", async () => {
  const root = mkdtempSync(join(tmpdir(), "baron-migration-parity-"));
  const cap = "migration-parity-" + "x".repeat(40);
  const owner = await startOwner({
    ownerId: "owner",
    capability: cap,
    metadataRoot: join(root, "metadata"),
    approvedRoots: { projects: join(root, "projects") },
  });
  const db = new Database(join(root, "projects", "external.sqlite"));
  db.pragma("journal_mode=WAL");
  db.exec(
    "CREATE TABLE item(id INTEGER PRIMARY KEY,title TEXT);INSERT INTO item VALUES(1,'original')",
  );
  const config = join(root, "mcp.json");
  writeFileSync(
    config,
    JSON.stringify({ ownerUrl: owner.url, capability: cap }),
    { mode: 0o600 },
  );
  const client = new Client({ name: "migration-parity", version: "1" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve("apps/mcp/dist/main.js")],
        env: { SCHEMA_BARON_MCP_CONFIG: config },
        stderr: "pipe",
      }),
    );
    const cmd = (
      operation: string,
      input: unknown,
      revision: number,
      requestId: string = crypto.randomUUID(),
    ) => ({
      operation,
      input,
      projectId: "p",
      expectedRevision: revision,
      requestId,
    });
    const http = async (command: ReturnType<typeof cmd>) => {
      const response = await fetch(owner.url + "/api/v1/projects/p/commands", {
        method: "POST",
        headers: {
          authorization: "Bearer " + cap,
          "content-type": "application/json",
        },
        body: JSON.stringify(command),
      });
      return await response.json();
    };
    const agent = async (command: ReturnType<typeof cmd>) => {
      const { operation, ...args } = command;
      return (
        await client.callTool({
          name: operation.replaceAll(".", "_"),
          arguments: args,
        })
      ).structuredContent;
    };
    expect(
      await http(
        cmd(
          "project.create",
          {
            name: "Public migration proof",
            approvedRoot: "projects",
            target: "next-typescript-sqlite",
          },
          0,
        ),
      ),
    ).toMatchObject({ ok: true });
    const inspected = (
      await http(
        cmd(
          "connection.inspect",
          { approvedPath: "projects:external.sqlite", mode: "read-only" },
          1,
        ),
      )
    ).result;
    expect(
      await agent(
        cmd(
          "connection.bind",
          {
            connectionId: inspected.connection.id,
            fingerprint: inspected.connection.fingerprint,
          },
          1,
        ),
      ),
    ).toMatchObject({ ok: true, revision: 2 });
    const p = (await http(cmd("project.inspect", {}, 2))).result as Project;
    p.schema.revision++;
    p.schema.tables[0]!.columns[1]!.physicalName = "caption";
    expect(
      await agent(
        cmd(
          "project.batch",
          {
            operations: [
              {
                kind: "put",
                entity: "schema",
                id: p.schema.id,
                value: p.schema,
              },
            ],
          },
          2,
        ),
      ),
    ).toMatchObject({ ok: true, revision: 3 });
    const plan = (
      await http(
        cmd(
          "schema.preview",
          { desiredSchemaRevision: p.schema.revision, backfills: [] },
          3,
        ),
      )
    ).result as Extract<ReviewedPlan, { kind: "migration" }>;
    const apply = cmd(
      "schema.apply",
      {
        planId: plan.id,
        hash: plan.hash,
        acknowledgedImpactIds: plan.requiredAcknowledgementIds,
      },
      3,
    );
    const [browser, mcp] = await Promise.all([http(apply), agent(apply)]);
    expect(browser).toEqual(mcp);
    expect(browser).toMatchObject({
      ok: true,
      revision: 4,
      result: { committed: true, recoveryRequired: false },
    });
    expect(db.prepare("SELECT * FROM item").all()).toEqual([
      { id: 1, caption: "original" },
    ]);
    expect(await agent(apply)).toEqual(browser);
    const historyCommand = cmd(
      "schema.history",
      { connectionId: p.connections[0]!.id },
      4,
    );
    const history = await http(historyCommand);
    expect(await agent(historyCommand)).toEqual(history);
    expect(history).toMatchObject({
      ok: true,
      result: [{ outcome: "committed", backupValidated: true }],
    });
    const rows = history.result as MigrationHistory[];
    expect(
      await agent(cmd("job.cancel", { jobId: rows[0]!.id }, 4)),
    ).toMatchObject({
      ok: true,
      result: { status: "succeeded", committed: true },
    });
    db.prepare("INSERT INTO item VALUES(?,?)").run(2, "later");
    const restoreCommand = cmd(
      "schema.restorePreview",
      {
        connectionId: p.connections[0]!.id,
        backupRef: browser.result.backupRef,
      },
      4,
    );
    const restore = await http(restoreCommand);
    expect(await agent(restoreCommand)).toEqual(restore);
    const r = restore.result as Extract<ReviewedPlan, { kind: "restore" }>;
    expect(r.impact[0]!.description).toContain("later data");
    expect(r.impact[0]!.affectedCount).toBe(2);
    const wrong = cmd(
      "schema.apply",
      {
        planId: r.id,
        hash: r.hash,
        acknowledgedImpactIds: r.requiredAcknowledgementIds,
      },
      4,
    );
    expect(await http(wrong)).toMatchObject({
      error: { code: "PLAN_HASH_MISMATCH" },
    });
    expect(await agent(wrong)).toEqual(await http(wrong));
    const restoreApply = cmd(
      "schema.restoreApply",
      {
        planId: r.id,
        hash: r.hash,
        acknowledgedImpactIds: r.requiredAcknowledgementIds,
      },
      4,
    );
    const restored = await agent(restoreApply);
    expect(restored).toMatchObject({
      ok: true,
      revision: 5,
      result: { committed: true, recoveryRequired: false },
    });
    expect(await http(restoreApply)).toEqual(restored);
    expect(db.prepare("SELECT * FROM item").all()).toEqual([
      { id: 1, title: "original" },
    ]);
    const next = (await http(cmd("project.inspect", {}, 5))).result as Project;
    expect(next.schema).toEqual(next.connections[0]!.inspectedSchema);
    expect(
      await agent(
        cmd(
          "schema.preview",
          { desiredSchemaRevision: next.schema.revision, backfills: [] },
          5,
        ),
      ),
    ).toMatchObject({ ok: true, result: { steps: [] } });
    const denied = await fetch(owner.url + "/api/v1/projects/p/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(restoreApply),
    });
    expect(denied.status).toBe(401);
  } finally {
    await client.close();
    await owner.close();
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
