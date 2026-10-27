import { expect, test } from "vitest";
import type { ReviewedPlan } from "@schema-baron/model";
import { fixture } from "./fixture.js";

test("reviewed rebuild preserves rows/index/FK and one committed retry outcome; restore reviews later data", async () => {
  const f = await fixture();
  try {
    const id = crypto.randomUUID();
    const [a, b] = await Promise.all([
      f.run("schema.apply", f.apply, 3, id),
      f.run("schema.apply", f.apply, 3, id),
    ]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({
      ok: true,
      revision: 4,
      result: { committed: true, recoveryRequired: false },
    });
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, caption: "original" },
    ]);
    expect(f.db.prepare("SELECT * FROM child").all()).toEqual([
      { id: 9, parent_id: 1 },
    ]);
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
    expect(
      f.db
        .prepare(
          "SELECT name FROM sqlite_schema WHERE type='index' AND name='title_lookup'",
        )
        .get(),
    ).toBeTruthy();
    expect(await f.run("schema.apply", f.apply, 3, id)).toEqual(a);
    const p = f.core.snapshot("owner", "p");
    expect(p.connections[0]!.inspectedSchema).toEqual(p.schema);
    const history = await f.run(
      "schema.history",
      { connectionId: p.connections[0]!.id },
      4,
    );
    expect(history).toMatchObject({
      ok: true,
      result: [{ outcome: "committed", planId: f.plan.id }],
    });
    f.db.prepare("INSERT INTO parent VALUES(?,?)").run(2, "later data");
    if (!a.ok) throw Error();
    const backupRef = (a.result as { backupRef: string }).backupRef;
    const restore = await f.run(
      "schema.restorePreview",
      { connectionId: p.connections[0]!.id, backupRef },
      4,
    );
    expect(restore).toMatchObject({
      ok: true,
      result: {
        kind: "restore",
        impact: [{ kind: "data-loss", requiresAcknowledgement: true }],
      },
    });
    if (!restore.ok) throw Error(JSON.stringify(restore));
    const r = restore.result as ReviewedPlan;
    expect(
      await f.run(
        "schema.restoreApply",
        { planId: r.id, hash: r.hash, acknowledgedImpactIds: [] },
        4,
      ),
    ).toMatchObject({ ok: false, error: { code: "IMPACT_NOT_ACKNOWLEDGED" } });
    expect(
      await f.run(
        "schema.restoreApply",
        {
          planId: r.id,
          hash: r.hash,
          acknowledgedImpactIds: r.requiredAcknowledgementIds,
        },
        4,
      ),
    ).toMatchObject({ ok: true, revision: 5, result: { committed: true } });
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, title: "original" },
    ]);
    await f.restart();
    expect(f.core.snapshot("owner", "p").revision).toBe(5);
  } finally {
    await f.close();
  }
});
test("external row change, wrong hash and missing acknowledgements refuse effects", async () => {
  const f = await fixture();
  try {
    expect(
      await f.run("schema.apply", { ...f.apply, hash: "0".repeat(64) }, 3),
    ).toMatchObject({ ok: false, error: { code: "PLAN_HASH_MISMATCH" } });
    f.db.prepare("UPDATE parent SET title=?").run("external");
    expect(await f.run("schema.apply", f.apply, 3)).toMatchObject({
      ok: false,
      error: { code: "DATABASE_CHANGED" },
    });
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, title: "external" },
    ]);
  } finally {
    await f.close();
  }
});
test("reviewed backfill executes only after exact acknowledgement and preserves dependent rows", async () => {
  const f = await fixture();
  try {
    const schema = f.core.snapshot("owner", "p").schema,
      table = schema.tables.find((t) => t.physicalName === "parent")!,
      column = table.columns.find((c) => c.physicalName === "caption")!;
    const preview = await f.run(
      "schema.preview",
      {
        desiredSchemaRevision: schema.revision,
        backfills: [
          {
            tableId: table.id,
            columnId: column.id,
            expression: {
              kind: "function",
              function: "upper",
              args: [{ kind: "field", alias: "self", fieldId: column.id }],
            },
          },
        ],
      },
      3,
    );
    if (!preview.ok) throw Error(JSON.stringify(preview));
    const plan = preview.result as ReviewedPlan;
    expect(plan.requiredAcknowledgementIds.length).toBeGreaterThan(0);
    expect(
      await f.run(
        "schema.apply",
        { planId: plan.id, hash: plan.hash, acknowledgedImpactIds: [] },
        3,
      ),
    ).toMatchObject({ error: { code: "IMPACT_NOT_ACKNOWLEDGED" } });
    expect(f.db.prepare("SELECT title FROM parent").all()).toEqual([
      { title: "original" },
    ]);
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
    ).toMatchObject({ ok: true, result: { committed: true } });
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, caption: "ORIGINAL" },
    ]);
    expect(f.db.prepare("SELECT * FROM child").all()).toEqual([
      { id: 9, parent_id: 1 },
    ]);
  } finally {
    await f.close();
  }
});

test("postcommit reconciliation error and matching retry honestly report committed/recovery-pending", async () => {
  const f = await fixture();
  try {
    (f.options as import("@schema-baron/core").CoreOptions).migrationFault = (
      point,
    ) => {
      if (point === "before-reconcile")
        throw Error("Injected metadata boundary failure");
    };
    const outcome = await f.run("schema.apply", f.apply, 3, "pending-apply");
    expect(outcome).toMatchObject({
      ok: true,
      revision: 3,
      result: { committed: true, recoveryRequired: true },
    });
    expect(f.db.prepare("SELECT * FROM parent").all()).toEqual([
      { id: 1, caption: "original" },
    ]);
    expect(await f.run("schema.apply", f.apply, 3, "pending-apply")).toEqual(
      outcome,
    );
    expect(
      await f.run(
        "schema.apply",
        { ...f.apply, hash: "0".repeat(64) },
        3,
        "pending-apply",
      ),
    ).toMatchObject({ error: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(
      await f.run(
        "schema.preview",
        {
          desiredSchemaRevision: f.core.snapshot("owner", "p").schema.revision,
          backfills: [],
        },
        3,
      ),
    ).toMatchObject({ error: { code: "RECOVERY_REQUIRED" } });
    delete (f.options as import("@schema-baron/core").CoreOptions)
      .migrationFault;
    await f.restart();
    expect(
      await f.run("schema.apply", f.apply, 3, "pending-apply"),
    ).toMatchObject({
      ok: true,
      revision: 4,
      result: { committed: true, recoveryRequired: false },
    });
  } finally {
    await f.close();
  }
});
