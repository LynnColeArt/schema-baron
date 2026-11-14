import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import { openSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const output = resolve(
  process.env.FORM_PROOF_OUTPUT ?? "/tmp/wp11-native-proof",
);
await fs.mkdir(output, { recursive: true });
const ownerDir = await fs.mkdtemp("/tmp/wp11-live-");
const config = {
  ownerId: "forms-native-proof",
  capability: randomBytes(32).toString("base64url"),
  metadataRoot: ownerDir + "/metadata",
  approvedRoots: { projects: ownerDir + "/definitions" },
};
const configPath = ownerDir + "/owner.json";
await fs.writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
const logPath = ownerDir + "/owner.log";
const fd = openSync(logPath, "a", 0o600);
const child = spawn(process.execPath, [resolve("apps/studio/dist/main.js")], {
  detached: true,
  env: { ...process.env, PORT: "0", SCHEMA_BARON_OWNER_CONFIG: configPath },
  stdio: ["ignore", fd, fd],
});
child.unref();
let url;
for (let attempt = 0; attempt < 100; attempt++) {
  const logs = await fs.readFile(logPath, "utf8");
  url = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
  if (url) break;
  await new Promise((r) => setTimeout(r, 100));
}
assert.ok(url, "Owner readiness");
await fs.writeFile(
  output + "/live.json",
  JSON.stringify({ url, configPath, ownerPid: child.pid }, null, 2),
);
async function owner(path, body) {
  const response = await fetch(url + "/api/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${config.capability}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.ok(result.ok, JSON.stringify(result));
  return result.result;
}
const metrics = [];
for (const factor of [1, 2]) {
  const profile = await fs.mkdtemp("/tmp/wp11-chromium-");
  await fs.mkdir(profile + "/Default");
  await fs.writeFile(
    profile + "/Default/Preferences",
    JSON.stringify({
      partition: {
        default_zoom_level: { x: Math.log(factor) / Math.log(1.2) },
      },
    }),
  );
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    channel: "chromium",
    viewport: { width: 1280, height: 800 },
    args: [
      "--window-size=1280,800",
      "--force-device-scale-factor=1",
      "--no-sandbox",
    ],
  });
  try {
    const page = context.pages()[0];
    await page.goto(url);
    await page.getByLabel("Studio service owner key").fill(config.capability);
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "New project…", exact: true })
      .click();
    await page
      .getByLabel("Project name", { exact: true })
      .fill("Native forms " + factor);
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "＋ Page", exact: true }).click();
    await page.getByLabel("Page title", { exact: true }).fill("Entries");
    await page.getByLabel("Internal route", { exact: true }).fill("/entries");
    await page.getByRole("button", { name: "Add page", exact: true }).click();
    const summary = (await owner("projects?approvedRoot=projects")).find(
      (p) => p.name === "Native forms " + factor,
    );
    if (process.env.STUDIO_AXE_SCRIPT)
      await page.addScriptTag({ path: process.env.STUDIO_AXE_SCRIPT });
    const audit = async (label, selector) => {
      if (!process.env.STUDIO_AXE_SCRIPT) return;
      const violations = await page.evaluate(
        async (selector) =>
          (
            await window.axe.run(
              selector ? document.querySelector(selector) : document,
              {
                runOnly: {
                  type: "tag",
                  values: ["wcag2a", "wcag2aa", "wcag21aa"],
                },
              },
            )
          ).violations,
        selector,
      );
      await fs.writeFile(
        output + `/axe-${label}-${factor}x.json`,
        JSON.stringify(violations, null, 2),
      );
      assert.deepEqual(violations, []);
    };
    const next = async () => {
      const button = page
        .getByRole("dialog")
        .getByRole("button", { name: "Next", exact: true });
      await button.focus();
      await button.press("Enter");
    };
    const finish = async () => {
      const button = page
        .getByRole("dialog")
        .getByRole("button", { name: "Finish", exact: true });
      await button.focus();
      await button.press("Enter");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    };
    // Unsaved page + Login objects commit together, with keyboard Finish.
    await page.getByRole("button", { name: "＋ Form", exact: true }).click();
    await page.getByLabel("Form label", { exact: true }).fill("Sign in");
    await page.getByLabel("Form kind", { exact: true }).selectOption("Login");
    for (let i = 0; i < 4; i++) await next();
    await finish();
    let snapshot = await owner("projects/" + summary.id);
    assert.equal(snapshot.revision, 2);
    assert.equal(snapshot.pages.length, 1);
    assert.equal(snapshot.forms.length, 1);
    const table = {
      id: randomUUID(),
      physicalName: "archive_entries",
      columns: [
        {
          id: randomUUID(),
          physicalName: "tenant",
          type: { kind: "integer" },
          nullable: false,
        },
        {
          id: randomUUID(),
          physicalName: "entry",
          type: { kind: "integer" },
          nullable: false,
        },
        {
          id: randomUUID(),
          physicalName: "caption",
          type: { kind: "text" },
          nullable: false,
        },
        {
          id: randomUUID(),
          physicalName: "enabled",
          type: { kind: "boolean" },
          nullable: false,
        },
        {
          id: randomUUID(),
          physicalName: "issued",
          type: { kind: "date", encoding: "iso-date" },
          nullable: true,
        },
      ],
      primaryKey: [],
      foreignKeys: [],
      uniqueConstraints: [],
      checks: [],
      indexes: [],
    };
    table.primaryKey = table.columns.slice(0, 2).map((c) => c.id);
    await owner("projects/" + summary.id + "/commands", {
      requestId: randomUUID(),
      operation: "project.batch",
      expectedRevision: snapshot.revision,
      input: {
        operations: [
          { kind: "put", entity: "table", id: table.id, value: table },
        ],
      },
    });
    await page
      .getByRole("status")
      .filter({ hasText: "Service revision" })
      .waitFor();
    for (const kind of ["Grid", "Record", "Search"]) {
      await page.getByRole("button", { name: "＋ Form", exact: true }).click();
      await page
        .getByLabel("Form label", { exact: true })
        .fill(kind + " entries");
      await page.getByLabel("Form kind", { exact: true }).selectOption(kind);
      await page
        .getByRole("dialog")
        .getByLabel("Data source", { exact: true })
        .selectOption("table:" + table.id);
      await next();
      const checks = page
        .getByRole("group", { name: "Fields, in selection order" })
        .getByRole("checkbox");
      for (let i = 0; i < table.columns.length; i++) {
        await checks.nth(i).focus();
        await checks.nth(i).press("Space");
      }
      await page
        .getByRole("button", { name: "Use complete primary key" })
        .focus();
      await page.keyboard.press("Enter");
      if (kind === "Record") {
        const cancel = page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel", exact: true });
        const box = await cancel.boundingBox();
        const height = await page.evaluate(() => innerHeight);
        assert.ok(
          box && box.y >= 0 && box.y + box.height <= height,
          "Pinned footer visible",
        );
        await audit("wizard", "dialog");
        await page.screenshot({
          path: output + `/wizard-${factor}x.png`,
          scale: "device",
        });
      }
      await next();
      await next();
      await next();
      await finish();
    }
    snapshot = await owner("projects/" + summary.id);
    assert.deepEqual(
      snapshot.forms.map((f) => f.kind),
      ["Login", "Grid", "Record", "Search"],
    );
    // Pointer Cancel and Escape both leave no model object and restore launcher focus.
    const revision = snapshot.revision;
    for (const cancelVia of ["pointer", "escape"]) {
      await page.getByRole("button", { name: "＋ Form", exact: true }).click();
      await page.getByLabel("Form label", { exact: true }).fill("Canceled");
      if (cancelVia === "pointer")
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
      else await page.keyboard.press("Escape");
      assert.equal((await owner("projects/" + summary.id)).revision, revision);
      assert.equal(
        await page
          .getByRole("button", { name: "＋ Form", exact: true })
          .evaluate((el) => el === document.activeElement),
        true,
      );
    }
    for (const label of ["Document modes and status", "Diagnostic messages"]) {
      const region = page.getByRole("region", { name: label, exact: true });
      await region.focus();
      assert.equal(
        await region.evaluate((el) => el === document.activeElement),
        true,
      );
      const extent = await region.evaluate((el) => ({
        x: el.scrollWidth > el.clientWidth,
        y: el.scrollHeight > el.clientHeight,
      }));
      if (extent.x) {
        await region.press("ArrowRight");
        await page.waitForFunction(
          (label) =>
            document.querySelector(`[aria-label="${label}"]`).scrollLeft > 0,
          label,
        );
      } else if (extent.y) {
        await region.press("ArrowDown");
        await page.waitForFunction(
          (label) =>
            document.querySelector(`[aria-label="${label}"]`).scrollTop > 0,
          label,
        );
      }
    }
    await audit("workspace");
    await page.screenshot({
      path: output + `/workspace-${factor}x.png`,
      scale: "device",
    });
    const metric = await page.evaluate(() => ({
      innerWidth,
      innerHeight,
      outerWidth,
      outerHeight,
      devicePixelRatio,
      cssZoom: getComputedStyle(document.documentElement).zoom,
      scrollWidth: document.documentElement.scrollWidth,
      visualScale: visualViewport.scale,
    }));
    assert.equal(metric.innerWidth, 1280 / factor);
    assert.equal(metric.innerHeight, 800 / factor);
    assert.equal(metric.cssZoom, "1");
    metrics.push({
      factor,
      metric,
      forms: snapshot.forms.length,
      revision: snapshot.revision,
      keyboard: "all four Finish; field Space; complete key Enter",
      cancel: "pointer + Escape; focus restored",
    });
  } finally {
    await context.close();
  }
}
await fs.writeFile(output + "/metrics.json", JSON.stringify(metrics, null, 2));
console.log(
  JSON.stringify(
    { url, configPath, ownerPid: child.pid, output, metrics },
    null,
    2,
  ),
);
