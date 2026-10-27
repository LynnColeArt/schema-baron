import { hash } from "@schema-baron/storage";
import { test, expect } from "vitest";
import Database from "better-sqlite3";
import { join } from "node:path";
import { fixture } from "./fixture.js";
import type { ReviewedPlan } from "@schema-baron/model";
import { planHash } from "@schema-baron/core";

test("restore rejects either a changed destination or a changed backup after review without destroying later data", async () => {
  for (const changed of ["destination", "backup"]) {
    const f = await fixture();
    try {
      const a = await f.run("schema.apply", f.apply, 3);
      if (!a.ok) throw Error(JSON.stringify(a));
      const ref = (a.result as { backupRef: string }).backupRef,
        p = f.core.snapshot("owner", "p");
      f.db.exec("INSERT INTO parent VALUES(2,'later')");
      const r = await f.run(
        "schema.restorePreview",
        { connectionId: p.connections[0]!.id, backupRef: ref },
        4,
      );
      if (!r.ok) throw Error(JSON.stringify(r));
      const plan = r.result as ReviewedPlan;
      if (changed === "destination")
        f.db.exec("UPDATE parent SET caption='latest' WHERE id=2");
      else {
        const backup = new Database(
          join(
            f.root,
            "projects",
            ".schema-baron-backups",
            hash("p"),
            ref + ".sqlite",
          ),
        );
        try {
          backup.exec("UPDATE parent SET title='tampered'");
        } finally {
          backup.close();
        }
      }
      const before = f.db.prepare("SELECT * FROM parent ORDER BY id").all();
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
      ).toMatchObject({ ok: false, error: { code: "DATABASE_CHANGED" } });
      expect(f.db.prepare("SELECT * FROM parent ORDER BY id").all()).toEqual(
        before,
      );
      expect(f.core.snapshot("owner", "p").revision).toBe(4);
    } finally {
      await f.close();
    }
  }
});
test("expired or stale-source reviewed plans cannot create a migration journal or backup", async () => {
  const f = await fixture();
  try {
    const content = {
      ...f.plan,
      id: crypto.randomUUID(),
      createdAt: "2020-01-01T00:00:00Z",
      expiresAt: "2020-01-02T00:00:00Z",
    };
    const plan = f.core.plans.record("owner", "p", {
      ...content,
      hash: planHash(content),
    });
    expect(
      await f.run(
        "schema.apply",
        {
          planId: plan.id,
          hash: plan.hash,
          acknowledgedImpactIds: plan.requiredAcknowledgementIds,
        },
        3,
      ),
    ).toMatchObject({ error: { code: "PLAN_EXPIRED" } });
    const schema = f.core.snapshot("owner", "p").schema;
    expect(
      await f.run(
        "project.batch",
        {
          operations: [
            { kind: "put", entity: "schema", id: schema.id, value: schema },
          ],
        },
        3,
      ),
    ).toMatchObject({ ok: true, revision: 4 });
    expect(await f.run("schema.apply", f.apply, 4)).toMatchObject({
      error: { code: "REVISION_CONFLICT" },
    });
    expect(
      await f.run(
        "schema.history",
        { connectionId: f.core.snapshot("owner", "p").connections[0]!.id },
        4,
      ),
    ).toMatchObject({ result: [] });
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, title: "original" },
    ]);
  } finally {
    await f.close();
  }
});
test("restore holds both destination and attached backup against external writes through commit", async () => {
  const f = await fixture();
  try {
    const a = await f.run("schema.apply", f.apply, 3);
    if (!a.ok) throw Error(JSON.stringify(a));
    const ref = (a.result as { backupRef: string }).backupRef,
      p = f.core.snapshot("owner", "p");
    f.db.exec("INSERT INTO parent VALUES(2,'later')");
    const r = await f.run(
      "schema.restorePreview",
      { connectionId: p.connections[0]!.id, backupRef: ref },
      4,
    );
    if (!r.ok) throw Error(JSON.stringify(r));
    const plan = r.result as ReviewedPlan;
    let checked = false;
    (f.options as import("@schema-baron/core").CoreOptions).migrationFault = (
      point,
    ) => {
      if (point !== "before-ddl") return;
      checked = true;
      for (const [path, sql] of [
        [f.path, "UPDATE parent SET caption='racing'"],
        [
          join(
            f.root,
            "projects",
            ".schema-baron-backups",
            hash("p"),
            ref + ".sqlite",
          ),
          "UPDATE parent SET title='racing'",
        ],
      ]) {
        const writer = new Database(path!, { timeout: 0 });
        try {
          expect(() => writer.exec(sql!)).toThrow(/locked/);
        } finally {
          writer.close();
        }
      }
    };
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
    ).toMatchObject({ ok: true, revision: 5, result: { committed: true } });
    expect(checked).toBe(true);
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, title: "original" },
    ]);
  } finally {
    await f.close();
  }
});
