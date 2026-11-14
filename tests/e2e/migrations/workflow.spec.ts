import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import type { Project, ReviewedPlan } from "@schema-baron/model";
test.use({ trace: "off", viewport: { width: 1280, height: 800 } });
test("Studio history reviews later-data restore, Cancel preserves it, explicit apply restores and retains both backups", async ({
  page,
}, info) => {
  const root = mkdtempSync(join(tmpdir(), "wp09-browser-"));
  const capability = randomBytes(32).toString("base64url");
  const config = join(root, "owner.json");
  mkdirSync(join(root, "definitions"));
  const path = join(root, "definitions", "external.sqlite");
  const db = new Database(path);
  db.pragma("journal_mode=WAL");
  db.exec(
    "CREATE TABLE assets(id INTEGER PRIMARY KEY,title TEXT NOT NULL);CREATE INDEX title_lookup ON assets(title);INSERT INTO assets VALUES(1,'original')",
  );
  writeFileSync(
    config,
    JSON.stringify({
      ownerId: "migration-ui-test",
      capability,
      metadataRoot: join(root, "metadata"),
      approvedRoots: { projects: join(root, "definitions") },
    }),
    { mode: 0o600 },
  );
  const child = spawn(process.execPath, [resolve("apps/studio/dist/main.js")], {
    env: { ...process.env, PORT: "0", SCHEMA_BARON_BROWSER_MODE: 'capability', SCHEMA_BARON_OWNER_CONFIG: config },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exit = once(child, "exit");
  try {
    const url = await new Promise<string>((resolve, reject) => {
      let logs = "";
      const timeout = setTimeout(
        () => reject(Error("Owner readiness timeout")),
        20000,
      );
      child.stderr!.on("data", (chunk) => {
        logs += String(chunk);
        const match = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]!);
        }
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        reject(Error("Owner exited before readiness"));
      });
    });
    await page.goto(url);
    await page.getByLabel("Studio service owner key").fill(capability);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page
      .getByRole("button", { name: "New project…", exact: true })
      .click();
    await page
      .getByLabel("Project name", { exact: true })
      .fill("Migration recovery workspace");
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page
      .getByRole("button", { name: "Connections…", exact: true })
      .click();
    await page.getByLabel("Relative SQLite file").fill("external.sqlite");
    await page.getByRole("button", { name: "Inspect SQLite file" }).click();
    await page.getByRole("button", { name: "Bind inspected database" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const headers = {
      authorization: "Bearer " + capability,
      "content-type": "application/json",
    };
    const listed = await (
      await fetch(url + "/api/v1/projects?approvedRoot=projects", { headers })
    ).json();
    const id = listed.result[0].id as string;
    const snapshot = async () => {
      const result = await (
        await fetch(`${url}/api/v1/projects/${id}`, { headers })
      ).json();
      expect(result.ok).toBe(true);
      return result.result as Project;
    };
    const run = async (operation: string, input: unknown, revision: number) => {
      const response = await fetch(`${url}/api/v1/projects/${id}/commands`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          operation,
          input,
          expectedRevision: revision,
        }),
      });
      const result = await response.json();
      expect(result.ok, JSON.stringify(result)).toBe(true);
      return result.result;
    };
    // This lane consumes the approved package/transport interface; WP08's schema editor is reviewed separately.
    const p = await snapshot();
    const schema = structuredClone(p.schema);
    schema.revision++;
    schema.tables[0]!.columns[1]!.physicalName = "caption";
    expect(
      await run(
        "project.batch",
        {
          operations: [
            { kind: "put", entity: "schema", id: schema.id, value: schema },
          ],
        },
        p.revision,
      ),
    ).toBeTruthy();
    const plan = (await run(
      "schema.preview",
      { desiredSchemaRevision: schema.revision, backfills: [] },
      p.revision + 1,
    )) as Extract<ReviewedPlan, { kind: "migration" }>;
    await run(
      "schema.apply",
      {
        planId: plan.id,
        hash: plan.hash,
        acknowledgedImpactIds: plan.requiredAcknowledgementIds,
      },
      p.revision + 1,
    );
    db.prepare("INSERT INTO assets VALUES(?,?)").run(2, "later data");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Migration history…" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Migration history…" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Schema migration · committed",
    );
    await page.getByRole("button", { name: "Review restore…" }).click();
    await expect(
      page.getByRole("region", { name: "Restore review" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(
      "later data since this backup",
    );
    await expect(
      page.getByRole("button", { name: "Apply reviewed restore" }),
    ).toBeDisabled();
    await page.screenshot({
      path: info.outputPath("restore-review-1280x800.png"),
    });
    await page.setViewportSize({ width: 1024, height: 600 });
    const bounds = await page
      .getByRole("button", { name: "Cancel", exact: true })
      .boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(600);
    await page.screenshot({
      path: info.outputPath("restore-review-1024x600.png"),
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(db.prepare("SELECT * FROM assets").all()).toEqual([
      { id: 1, caption: "original" },
      { id: 2, caption: "later data" },
    ]);
    await page.getByRole("button", { name: "Migration history…" }).click();
    await page.getByRole("button", { name: "Review restore…" }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Apply reviewed restore" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Restore committed. A new safety backup",
    );
    await expect(page.getByRole("dialog")).toContainText("Restore · committed");
    await expect(
      page.getByRole("button", { name: "Review restore…" }),
    ).toHaveCount(2);
    expect(db.prepare("SELECT * FROM assets").all()).toEqual([
      { id: 1, title: "original" },
    ]);
    expect(db.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    await page.screenshot({ path: info.outputPath("restore-committed.png") });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await snapshot()).revision).toBe(p.revision + 3);
  } finally {
    db.close();
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exit;
    clearTimeout(timeout);
    rmSync(root, { recursive: true, force: true });
  }
});
