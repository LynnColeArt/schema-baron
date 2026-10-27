import { expect, test } from "vitest";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@schema-baron/storage";
import type { ReviewedPlan } from "@schema-baron/model";
import { fixture } from "./fixture.js";

const foreignDDL =
  'CREATE TABLE "__schema_baron_migrations" (id TEXT PRIMARY KEY NOT NULL, plan_hash TEXT NOT NULL, committed_at TEXT NOT NULL, schema_hash TEXT NOT NULL)';
const sourceSQL =
  "CREATE TABLE parent(id INTEGER PRIMARY KEY,title TEXT NOT NULL); WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000) INSERT INTO parent SELECT x,printf('%0500d',x) FROM n";
function business(db: Database.Database) {
  const digest = createHash("sha256");
  for (const row of db
    .prepare("SELECT rowid AS identity,* FROM parent ORDER BY id")
    .iterate())
    digest.update(JSON.stringify(row));
  return {
    columns: db.pragma("table_xinfo(parent)"),
    rows: db
      .prepare(
        "SELECT count(*) AS n,min(id) AS first,max(id) AS last FROM parent",
      )
      .get(),
    rowHash: digest.digest("hex"),
    objects: db
      .prepare(
        "SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE '%schema_baron_migrations%' AND tbl_name != '__schema_baron_migrations' ORDER BY name",
      )
      .all(),
  };
}
function backupFiles(directory: string) {
  return existsSync(directory)
    ? readdirSync(directory).filter((name) => name.endsWith(".sqlite"))
    : [];
}
async function replaceDuringBackup(
  f: Awaited<ReturnType<typeof fixture>>,
  before: Set<string>,
  sentinel: boolean,
) {
  const directory = join(
    f.root,
    "projects",
    ".schema-baron-backups",
    hash("p"),
  );
  const writer = new Database(f.path, { timeout: 0 });
  let installed = false;
  try {
    for (let attempt = 0; attempt < 10000; attempt++) {
      if (backupFiles(directory).some((name) => !before.has(name))) {
        try {
          writer.exec("BEGIN IMMEDIATE");
          if (sentinel) writer.exec("DROP TABLE __schema_baron_migrations");
          writer.exec(foreignDDL);
          if (sentinel)
            writer
              .prepare("INSERT INTO __schema_baron_migrations VALUES(?,?,?,?)")
              .run(
                "foreign-evidence",
                "foreign-owner",
                "2000-01-01T00:00:00Z",
                "retain-me",
              );
          writer.exec("COMMIT");
          installed = true;
          break;
        } catch (error) {
          if (writer.inTransaction) writer.exec("ROLLBACK");
          if (!String(error).includes("locked")) throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  } finally {
    writer.close();
  }
  expect(
    installed,
    "external connection must change the namespace while a new online backup is visible",
  ).toBe(true);
}

test.each(["migration", "restore"] as const)(
  "external matching-DDL namespace during %s backup refuses all reviewed SQL and preserves foreign evidence",
  async (kind) => {
    const f = await fixture(sourceSQL);
    try {
      let operation = "schema.apply",
        input = f.apply,
        revision = 3;
      if (kind === "restore") {
        const applied = await f.run(operation, input, revision);
        if (!applied.ok) throw Error(JSON.stringify(applied));
        const backupRef = (applied.result as { backupRef: string }).backupRef;
        revision = 4;
        f.db.exec("INSERT INTO parent VALUES(100001,'later data')");
        const p = f.core.snapshot("owner", "p");
        const preview = await f.run(
          "schema.restorePreview",
          { connectionId: p.connections[0]!.id, backupRef },
          revision,
        );
        if (!preview.ok) throw Error(JSON.stringify(preview));
        const plan = preview.result as ReviewedPlan;
        operation = "schema.restoreApply";
        input = {
          planId: plan.id,
          hash: plan.hash,
          acknowledgedImpactIds: plan.requiredAcknowledgementIds,
        };
      }
      const before = business(f.db),
        directory = join(
          f.root,
          "projects",
          ".schema-baron-backups",
          hash("p"),
        ),
        files = new Set(backupFiles(directory)),
        requestId = "foreign-namespace-" + kind;
      const applying = f.run(operation, input, revision, requestId);
      await replaceDuringBackup(f, files, kind === "restore");
      const foreignRows = f.db
        .prepare("SELECT * FROM __schema_baron_migrations")
        .all();
      const outcome = await applying;
      expect(outcome).toMatchObject({
        ok: false,
        revision,
        error: { code: "UNSUPPORTED_SCHEMA_OBJECT" },
      });
      expect(business(f.db)).toEqual(before);
      expect(
        f.db
          .prepare(
            "SELECT sql FROM sqlite_schema WHERE name='__schema_baron_migrations'",
          )
          .get(),
      ).toEqual({ sql: foreignDDL });
      expect(
        f.db.prepare("SELECT * FROM __schema_baron_migrations").all(),
      ).toEqual(foreignRows);
      expect(foreignRows).toHaveLength(kind === "restore" ? 1 : 0);
      expect(await f.run(operation, input, revision, requestId)).toEqual(
        outcome,
      );
      expect(
        await f.run(
          operation,
          { ...input, hash: "0".repeat(64) },
          revision,
          requestId,
        ),
      ).toMatchObject({ error: { code: "IDEMPOTENCY_CONFLICT" } });
      const p = f.core.snapshot("owner", "p");
      expect(p.revision).toBe(revision);
      expect(
        await f.run(
          "schema.history",
          { connectionId: p.connections[0]!.id },
          revision,
        ),
      ).toMatchObject({
        ok: true,
        result: expect.arrayContaining([
          expect.objectContaining({
            planId: input.planId,
            outcome: "rolled-back",
            backupValidated: true,
          }),
        ]),
      });
      await f.restart();
      expect(f.core.snapshot("owner", "p").revision).toBe(revision);
      expect(await f.run(operation, input, revision, requestId)).toEqual(
        outcome,
      );
      expect(business(f.db)).toEqual(before);
      expect(
        f.db.prepare("SELECT * FROM __schema_baron_migrations").all(),
      ).toEqual(foreignRows);
      expect(
        await f.run(
          "schema.preview",
          { desiredSchemaRevision: p.schema.revision, backfills: [] },
          revision,
        ),
      ).toMatchObject({ ok: true });
    } finally {
      await f.close();
    }
  },
);

test("owner-proven marker namespace remains valid across migration and restore transactions", async () => {
  const f = await fixture();
  try {
    const applied = await f.run("schema.apply", f.apply, 3);
    if (!applied.ok) throw Error(JSON.stringify(applied));
    const markers = f.db
      .prepare("SELECT * FROM __schema_baron_migrations ORDER BY id")
      .all();
    expect(markers).toHaveLength(2);
    const p = f.core.snapshot("owner", "p");
    const preview = await f.run(
      "schema.restorePreview",
      {
        connectionId: p.connections[0]!.id,
        backupRef: (applied.result as { backupRef: string }).backupRef,
      },
      4,
    );
    if (!preview.ok) throw Error(JSON.stringify(preview));
    const plan = preview.result as ReviewedPlan;
    expect(
      await f.run(
        "schema.restoreApply",
        {
          planId: plan.id,
          hash: plan.hash,
          acknowledgedImpactIds: plan.requiredAcknowledgementIds,
        },
        4,
      ),
    ).toMatchObject({
      ok: true,
      revision: 5,
      result: { committed: true, recoveryRequired: false },
    });
    const after = f.db
      .prepare("SELECT * FROM __schema_baron_migrations ORDER BY id")
      .all();
    expect(after).toHaveLength(3);
    expect(after).toEqual(expect.arrayContaining(markers));
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, title: "original" },
    ]);
  } finally {
    await f.close();
  }
});

test("an uncertain commit response still probes the durable marker instead of claiming rollback", async () => {
  const f = await fixture();
  try {
    (
      f.options as import("@schema-baron/core").CoreOptions
    ).migrationWorkerFault = "commit-error";
    expect(
      await f.run("schema.apply", f.apply, 3, "ambiguous-commit"),
    ).toMatchObject({
      ok: true,
      revision: 3,
      result: { committed: true, recoveryRequired: true },
    });
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, caption: "original" },
    ]);
    delete (f.options as import("@schema-baron/core").CoreOptions)
      .migrationWorkerFault;
    await f.restart();
    expect(
      await f.run("schema.apply", f.apply, 3, "ambiguous-commit"),
    ).toMatchObject({
      ok: true,
      revision: 4,
      result: { committed: true, recoveryRequired: false },
    });
    expect(
      f.db
        .prepare(
          "SELECT count(*) AS n FROM __schema_baron_migrations WHERE id!='@authority'",
        )
        .get(),
    ).toEqual({ n: 1 });
  } finally {
    await f.close();
  }
});
