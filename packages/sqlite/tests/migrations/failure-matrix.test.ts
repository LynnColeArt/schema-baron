import { expect, test } from "vitest";
import Database from "better-sqlite3";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ProjectCore } from "@schema-baron/core";
import type { Command, MigrationHistory } from "@schema-baron/model";
import { fixture } from "./fixture.js";

function retain(point: string, observed: unknown) {
  const directory = process.env.SCHEMA_BARON_MIGRATION_EVIDENCE;
  if (directory) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, point + ".json"),
      JSON.stringify(observed, null, 2) + "\n",
    );
  }
}

test.each([
  "before-backup",
  "after-backup",
  "during-rebuild",
  "before-db-commit",
  "after-db-commit",
  "before-reconcile",
  "metadata-save",
  "after-reconcile",
])(
  "real process exit at %s preserves exactly one coherent outcome",
  async (point) => {
    const root = mkdtempSync(join(tmpdir(), "baron-hard-exit-"));
    let core: ProjectCore | undefined;
    let db: Database.Database | undefined;
    try {
      const child = spawn(
        process.execPath,
        [
          resolve("packages/sqlite/tests/migrations/crash-owner.mjs"),
          root,
          point,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let stderr = "";
      child.stderr.on("data", (data) => {
        stderr += String(data);
      });
      const [code] = await once(child, "exit");
      expect([0, 87, 88], stderr).toContain(code);
      expect(stderr).toBe("");
      db = new Database(join(root, "projects", "app.sqlite"));
      const beforeCommit = [
        "before-backup",
        "after-backup",
        "during-rebuild",
        "before-db-commit",
      ].includes(point);
      expect(db.prepare("SELECT * FROM parent").all()).toEqual(
        beforeCommit
          ? [{ id: 1, title: "original" }]
          : [{ id: 1, caption: "original" }],
      );
      expect(db.prepare("SELECT * FROM child").all()).toEqual([
        { id: 9, parent_id: 1 },
      ]);
      expect(db.pragma("foreign_key_check")).toEqual([]);
      expect(db.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
      expect(
        db
          .prepare("SELECT sql FROM sqlite_schema WHERE name='title_lookup'")
          .get(),
      ).toEqual({
        sql: beforeCommit
          ? "CREATE INDEX title_lookup ON parent(title)"
          : 'CREATE INDEX "title_lookup" ON "parent" ("caption")',
      });
      core = new ProjectCore({
        ownerId: "owner",
        metadataRoot: join(root, "metadata"),
        approvedRoots: { projects: join(root, "projects") },
      });
      const p = core.snapshot("owner", "p");
      expect(p.revision).toBe(beforeCommit ? 3 : 4);
      const history = await core.executeAsync("owner", {
        requestId: "history",
        projectId: "p",
        expectedRevision: p.revision,
        operation: "schema.history",
        input: { connectionId: p.connections[0]!.id },
      });
      if (!history.ok) throw Error(JSON.stringify(history));
      const records = history.result as MigrationHistory[];
      expect(records).toHaveLength(1);
      expect(records[0]!.outcome).toBe(
        beforeCommit ? "rolled-back" : "committed",
      );
      expect(records[0]!.backupValidated).toBe(point !== "before-backup");
      retain(point, {
        point,
        ownerExitCode: code,
        revision: p.revision,
        rows: db.prepare("SELECT * FROM parent").all(),
        unrelatedRows: db.prepare("SELECT * FROM child").all(),
        index: db
          .prepare("SELECT sql FROM sqlite_schema WHERE name='title_lookup'")
          .get(),
        foreignKeyCheck: db.pragma("foreign_key_check"),
        integrityCheck: db.pragma("integrity_check"),
        history: records.map(({ kind, outcome, backupValidated }) => ({
          kind,
          outcome,
          backupValidated,
        })),
      });
      if (!beforeCommit) {
        const command = JSON.parse(
          readFileSync(join(root, "command.json"), "utf8"),
        ) as Command;
        expect(await core.executeAsync("owner", command)).toMatchObject({
          ok: true,
          revision: 4,
          result: { committed: true, recoveryRequired: false },
        });
        expect(
          db
            .prepare(
              "SELECT count(*) AS count FROM __schema_baron_migrations WHERE id != ?",
            )
            .get("@authority"),
        ).toEqual({ count: 1 });
      }
    } finally {
      db?.close();
      await core?.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
test("reserved marker namespace collision refuses even a schema-shaped forged table without overwriting it", async () => {
  const f = await fixture();
  try {
    f.db.exec(
      'CREATE TABLE "__schema_baron_migrations" (id TEXT PRIMARY KEY NOT NULL, plan_hash TEXT NOT NULL, committed_at TEXT NOT NULL, schema_hash TEXT NOT NULL)',
    );
    expect(await f.run("schema.apply", f.apply, 3)).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_SCHEMA_OBJECT" },
    });
    expect(
      f.db.prepare("SELECT * FROM __schema_baron_migrations").all(),
    ).toEqual([]);
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, title: "original" },
    ]);
  } finally {
    await f.close();
  }
});
test("external schema change after committed crash leaves recovery unresolved and blocks mutations without restoring", async () => {
  const root = mkdtempSync(join(tmpdir(), "baron-recovery-block-"));
  let core: ProjectCore | undefined;
  let db: Database.Database | undefined;
  try {
    const child = spawn(
      process.execPath,
      [
        resolve("packages/sqlite/tests/migrations/crash-owner.mjs"),
        root,
        "before-reconcile",
      ],
      { stdio: "ignore" },
    );
    expect((await once(child, "exit"))[0]).toBe(87);
    db = new Database(join(root, "projects", "app.sqlite"));
    db.exec(
      "CREATE TABLE later_evidence(id INTEGER PRIMARY KEY);INSERT INTO later_evidence VALUES(42)",
    );
    core = new ProjectCore({
      ownerId: "owner",
      metadataRoot: join(root, "metadata"),
      approvedRoots: { projects: join(root, "projects") },
    });
    const p = core.snapshot("owner", "p");
    expect(p.revision).toBe(3);
    expect(
      await core.executeAsync("owner", {
        requestId: "blocked",
        projectId: "p",
        operation: "project.batch",
        expectedRevision: 3,
        input: {
          operations: [
            { kind: "put", entity: "schema", id: p.schema.id, value: p.schema },
          ],
        },
      }),
    ).toMatchObject({ error: { code: "RECOVERY_REQUIRED" } });
    expect(
      await core.executeAsync("owner", {
        requestId: "history",
        projectId: "p",
        operation: "schema.history",
        expectedRevision: 3,
        input: { connectionId: p.connections[0]!.id },
      }),
    ).toMatchObject({ result: [{ outcome: "recovery-pending" }] });
    expect(db.prepare("SELECT * FROM later_evidence").all()).toEqual([
      { id: 42 },
    ]);
    expect(db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, caption: "original" },
    ]);
  } finally {
    db?.close();
    await core?.close();
    rmSync(root, { recursive: true, force: true });
  }
});
test.each(["restore-after-db-commit", "restore-before-reconcile"])(
  "restore interruption at %s reconciles one restore and keeps both backups",
  async (point) => {
    const root = mkdtempSync(join(tmpdir(), "baron-restore-crash-"));
    let core: ProjectCore | undefined;
    let db: Database.Database | undefined;
    try {
      const child = spawn(
        process.execPath,
        [
          resolve("packages/sqlite/tests/migrations/crash-owner.mjs"),
          root,
          point,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let stderr = "";
      child.stderr.on("data", (data) => {
        stderr += String(data);
      });
      expect([0, 87], stderr).toContain((await once(child, "exit"))[0]);
      db = new Database(join(root, "projects", "app.sqlite"));
      expect(db.prepare("SELECT * FROM parent").all()).toEqual([
        { id: 1, title: "original" },
      ]);
      core = new ProjectCore({
        ownerId: "owner",
        metadataRoot: join(root, "metadata"),
        approvedRoots: { projects: join(root, "projects") },
      });
      const p = core.snapshot("owner", "p");
      expect(p.revision).toBe(5);
      const history = await core.executeAsync("owner", {
        projectId: "p",
        requestId: "restore-history",
        expectedRevision: 5,
        operation: "schema.history",
        input: { connectionId: p.connections[0]!.id },
      });
      if (!history.ok) throw Error(JSON.stringify(history));
      expect(history.result).toMatchObject([
        { kind: "migration", outcome: "committed", backupValidated: true },
        { kind: "restore", outcome: "committed", backupValidated: true },
      ]);
      const retry = JSON.parse(
        readFileSync(join(root, "command.json"), "utf8"),
      ) as Command;
      expect(await core.executeAsync("owner", retry)).toMatchObject({
        ok: true,
        revision: 5,
        result: { committed: true, recoveryRequired: false },
      });
      expect(
        db
          .prepare(
            "SELECT count(*) AS n FROM __schema_baron_migrations WHERE id!='@authority'",
          )
          .get(),
      ).toEqual({ n: 2 });
    } finally {
      db?.close();
      await core?.close();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
