import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Page as BrowserPage } from "@playwright/test";
import type { Project } from "@schema-baron/model";
test.use({ trace: "off", viewport: { width: 1280, height: 800 } });
let root: string,
  url: string,
  capability: string,
  child: ReturnType<typeof spawn>,
  mcp: Client;
let exit: Promise<unknown>;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "baron-forms-e2e-"));
  capability = randomBytes(32).toString("base64url");
  const config = join(root, "owner.json");
  writeFileSync(
    config,
    JSON.stringify({
      ownerId: "workspace-test",
      capability,
      metadataRoot: join(root, "metadata"),
      approvedRoots: { projects: join(root, "definitions") },
    }),
    { mode: 0o600 },
  );
  child = spawn(process.execPath, [resolve("apps/studio/dist/main.js")], {
    env: { ...process.env, PORT: "0", SCHEMA_BARON_BROWSER_MODE: 'capability', SCHEMA_BARON_OWNER_CONFIG: config },
    stdio: ["ignore", "pipe", "pipe"],
  });
  exit = once(child, "exit");
  url = await new Promise((resolve, reject) => {
    let logs = "";
    const timer = setTimeout(
      () => reject(new Error("Owner did not start")),
      20000,
    );
    child.stderr!.on("data", (chunk) => {
      logs += chunk.toString();
      const match = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]!);
      }
    });
    child.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Owner exited before readiness"));
    });
  });
  const configMcp = join(root, "mcp.json");
  writeFileSync(configMcp, JSON.stringify({ ownerUrl: url, capability }), {
    mode: 0o600,
  });
  mcp = new Client({ name: "forms-proof", version: "1" });
  await mcp.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve("apps/mcp/dist/main.js")],
      env: { SCHEMA_BARON_MCP_CONFIG: configMcp },
      stderr: "pipe",
    }),
  );
});
test.afterAll(async () => {
  await mcp?.close();
  child?.kill("SIGTERM");
  const timer = setTimeout(() => child?.kill("SIGKILL"), 5000);
  await exit;
  clearTimeout(timer);
  if (root) rmSync(root, { recursive: true, force: true });
});
async function owner(path: string) {
  const response = await fetch(url + "/api/v1/" + path, {
    headers: { authorization: `Bearer ${capability}` },
  });
  const outcome = await response.json();
  expect(outcome.ok).toBe(true);
  return outcome.result;
}
async function connect(page: BrowserPage) {
  await page.goto(url);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Studio service owner key").fill(capability);
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(dialog).toBeHidden();
}
async function create(page: BrowserPage, name: string) {
  await page.getByRole("button", { name: "New project…", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
async function addPage(page: BrowserPage, title: string, route: string) {
  await page.getByRole("button", { name: "＋ Page", exact: true }).click();
  await page.getByLabel("Page title", { exact: true }).fill(title);
  await page.getByLabel("Internal route", { exact: true }).fill(route);
  await page.getByRole("button", { name: "Add page", exact: true }).click();
}
async function command(
  project: Project,
  operation: string,
  input: unknown,
  requestId = crypto.randomUUID(),
) {
  const result = await mcp.callTool({
    name: operation.replaceAll(".", "_"),
    arguments: {
      requestId,
      projectId: project.id,
      expectedRevision: project.revision,
      input,
    },
  });
  return result.structuredContent as {
    ok: boolean;
    revision: number;
    result: { changedIds: string[] };
    diagnostics: { field: string }[];
  };
}
async function finishWizard(
  page: BrowserPage,
  kind: string,
  label: string,
  sourceId?: string,
  linked = false,
) {
  await page.getByRole("button", { name: "＋ Form", exact: true }).click();
  await page.getByLabel("Form label", { exact: true }).fill(label);
  await page.getByLabel("Form kind", { exact: true }).selectOption(kind);
  if (sourceId)
    await page
      .getByRole("dialog")
      .getByLabel("Data source", { exact: true })
      .selectOption("table:" + sourceId);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  if (kind !== "Login") {
    await page
      .getByRole("group", { name: "Fields, in selection order" })
      .getByRole("checkbox")
      .nth(0)
      .check();
    await page
      .getByRole("group", { name: "Fields, in selection order" })
      .getByRole("checkbox")
      .nth(1)
      .check();
    await page
      .getByRole("group", { name: "Fields, in selection order" })
      .getByRole("checkbox")
      .nth(2)
      .check();
    await page
      .getByRole("button", { name: "Use complete primary key" })
      .click();
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  if (linked)
    await page
      .getByLabel("Linked Record page", { exact: true })
      .selectOption({ label: "Ledger · /ledger" });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  if (kind === "Search")
    await page
      .getByRole("dialog")
      .getByLabel("Search title", { exact: true })
      .selectOption("contains");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
test.setTimeout(90_000);
test("each wizard, atomic Cancel/errors, MCP parity, composite links and contextual editing", async ({
  page,
}, info) => {
  await connect(page);
  await create(page, "Focused forms");
  await addPage(page, "Ledger", "/ledger");
  await page.getByRole("button", { name: "▣ Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  const summary = (await owner("projects?approvedRoot=projects"))[0];
  let snapshot: Project = await owner("projects/" + summary.id);
  const table = {
    id: "ledger-source",
    physicalName: "ledger_source",
    columns: [
      {
        id: "tenant-id",
        physicalName: "tenant",
        type: { kind: "integer" },
        nullable: false,
      },
      {
        id: "entry-id",
        physicalName: "entry",
        type: { kind: "integer" },
        nullable: false,
      },
      {
        id: "title-id",
        physicalName: "title",
        type: { kind: "text" },
        nullable: false,
      },
    ],
    primaryKey: ["tenant-id", "entry-id"],
    foreignKeys: [],
    uniqueConstraints: [],
    checks: [],
    indexes: [],
  };
  const result = await command(snapshot, "project.batch", {
    operations: [{ kind: "put", entity: "table", id: table.id, value: table }],
  });
  expect(result.ok).toBe(true);
  await expect(page.getByRole("status")).toContainText("Service revision");
  snapshot = await owner("projects/" + summary.id);
  let before = snapshot.revision;
  await page.getByRole("button", { name: "＋ Form", exact: true }).click();
  const wizardName = page.getByLabel("Form label", { exact: true });
  await wizardName.fill("Canceled draft");
  await wizardName.press("ArrowLeft");
  const wizardCaret = await wizardName.evaluate(
    (el) => (el as HTMLInputElement).selectionStart,
  );
  expect(
    (
      await command(snapshot, "project.batch", {
        operations: [
          {
            kind: "put",
            entity: "table",
            id: table.id,
            value: { ...table, physicalName: "ledger_revised" },
          },
        ],
      })
    ).ok,
  ).toBe(true);
  before++;
  await expect(page.getByRole("status")).toContainText(
    `Service revision ${before}`,
  );
  await expect(wizardName).toHaveValue("Canceled draft");
  await expect(wizardName).toBeFocused();
  expect(
    await wizardName.evaluate((el) => (el as HTMLInputElement).selectionStart),
  ).toBe(wizardCaret);
  await page.keyboard.press("Escape");
  expect((await owner("projects/" + summary.id)).revision).toBe(before);
  await expect(
    page.getByRole("button", { name: "＋ Form", exact: true }),
  ).toBeFocused();
  await finishWizard(page, "Grid", "Ledger Grid", table.id, true);
  await finishWizard(page, "Record", "Ledger Record", table.id);
  await finishWizard(page, "Search", "Ledger Search", table.id);
  await finishWizard(page, "Login", "Ledger Login");
  snapshot = await owner("projects/" + summary.id);
  expect(snapshot.forms.map((f) => f.kind)).toEqual([
    "Grid",
    "Record",
    "Record",
    "Search",
    "Login",
  ]);
  expect(snapshot.revision).toBe(before + 4);
  expect(
    snapshot.actions
      .find((a) => a.operation === "navigate")
      ?.destination?.keyMapping.map((k) => k.targetFieldId),
  ).toEqual(table.primaryKey);
  // Inspect through MCP's resource-equivalent operation and construct one ordinary form through the same command.
  const inspected = await mcp.callTool({
    name: "project_inspect",
    arguments: {
      requestId: crypto.randomUUID(),
      projectId: snapshot.id,
      expectedRevision: snapshot.revision,
      input: {},
    },
  });
  expect(inspected.isError).not.toBe(true);
  const input = {
    pageId: snapshot.pages[0]!.id,
    kind: "Grid",
    source: { kind: "table", id: table.id },
    fieldIds: ["title-id"],
    keyIds: table.primaryKey,
    actions: [],
    links: [],
    style: { label: "Agent Grid" },
  };
  const retryId = crypto.randomUUID();
  const constructed = await command(snapshot, "form.construct", input, retryId);
  expect(constructed.ok).toBe(true);
  expect(await command(snapshot, "form.construct", input, retryId)).toEqual(
    constructed,
  );
  expect(
    (
      await command(
        snapshot,
        "form.construct",
        { ...input, style: { label: "Conflicting" } },
        retryId,
      )
    ).ok,
  ).toBe(false);
  snapshot = await owner("projects/" + summary.id);
  expect(
    snapshot.forms.find((f) => f.appearance.label === "Agent Grid")?.controlIds,
  ).toHaveLength(1);
  const invalid = await command(snapshot, "form.construct", {
    ...input,
    kind: "Record",
    keyIds: ["entry-id"],
  });
  expect(invalid.ok).toBe(false);
  expect(invalid.diagnostics).toEqual(
    expect.arrayContaining([expect.objectContaining({ field: "keyIds" })]),
  );
  expect((await owner("projects/" + summary.id)).forms).toHaveLength(6);
  // Ordinary Properties, without rebuilding: destination and field type errors remain localized.
  await page
    .locator(".form-caption")
    .filter({ hasText: "Ledger Record" })
    .first()
    .click();
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  await page
    .getByLabel("update success page", { exact: true })
    .selectOption(snapshot.pages[0]!.id);
  const updateAction = page.getByRole("group", {
    name: "Action: update",
    exact: true,
  });
  await updateAction
    .getByRole("group", { name: "success", exact: true })
    .getByRole("button", { name: "Add filter mapping", exact: true })
    .click();
  await page
    .getByLabel("update success filterMapping source 1", { exact: true })
    .selectOption("entry-id");
  await page.getByRole("button", { name: "▣ Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  snapshot = await owner("projects/" + summary.id);
  expect(
    snapshot.actions.find(
      (a) =>
        a.formId ===
          snapshot.forms.find((f) => f.appearance.label === "Ledger Record")
            ?.id && a.operation === "update",
    )?.success?.filterMapping[0]?.expression,
  ).toEqual({ kind: "field", alias: "root", fieldId: "entry-id" });
  expect(
    snapshot.actions.find(
      (a) =>
        a.formId ===
          snapshot.forms.find((f) => f.appearance.label === "Ledger Record")
            ?.id && a.operation === "update",
    )?.success?.pageId,
  ).toBe(snapshot.pages[0]!.id);

  // Existing page-name and action drafts stay local through another construction.
  await page
    .getByLabel("update cancel page", { exact: true })
    .selectOption(snapshot.pages[0]!.id);
  await page
    .locator(`[role=treeitem][data-object-id="${snapshot.pages[0]!.id}"]`)
    .click();
  await page.getByRole("tab", { name: "Format", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Unfinished page name");
  let finishRelease!: () => void, finishArrived!: () => void;
  const finishGate = new Promise<void>((r) => (finishRelease = r)),
    finishSeen = new Promise<void>((r) => (finishArrived = r));
  await page.route("**/commands", async (route) => {
    if (route.request().postDataJSON()?.operation === "form.construct") {
      finishArrived();
      await finishGate;
    }
    await route.continue();
  });
  const completing = finishWizard(page, "Grid", "Keep drafts", table.id);
  await finishSeen;
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  finishRelease();
  await completing;
  await page.unroute("**/commands");
  snapshot = await owner("projects/" + summary.id);
  expect(snapshot.pages[0]!.title).toBe("Ledger");
  expect(
    snapshot.actions.find(
      (a) =>
        a.formId ===
          snapshot.forms.find((f) => f.appearance.label === "Ledger Record")
            ?.id && a.operation === "update",
    )?.cancel,
  ).toBeUndefined();
  await page
    .locator(`[role=treeitem][data-object-id="${snapshot.pages[0]!.id}"]`)
    .click();
  await page.getByRole("tab", { name: "Format", exact: true }).click();
  const title = page.getByLabel("Title", { exact: true });
  await expect(title).toHaveValue("Unfinished page name");
  // Real delayed HTTP Save: later input and caret remain live through acknowledgement.
  let release!: () => void, arrived!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    seen = new Promise<void>((r) => (arrived = r));
  await page.route("**/commands", async (route) => {
    if (route.request().postDataJSON()?.operation === "project.batch") {
      arrived();
      await gate;
    }
    await route.continue();
  });
  await title.fill("Submitted title");
  await title.press("Control+s");
  await seen;
  await title.press("End");
  await title.pressSequentially(" later");
  const caret = await title.evaluate(
    (el) => (el as HTMLInputElement).selectionStart,
  );
  release();
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(title).toHaveValue("Submitted title later");
  await expect(title).toBeFocused();
  expect(
    await title.evaluate((el) => (el as HTMLInputElement).selectionStart),
  ).toBe(caret);
  expect((await owner("projects/" + summary.id)).pages[0].title).toBe(
    "Submitted title",
  );
  await page.unroute("**/commands");
  snapshot = await owner("projects/" + summary.id);
  const currentPage = snapshot.pages[0]!;
  expect(
    (
      await command(snapshot, "project.batch", {
        operations: [
          {
            kind: "put",
            entity: "page",
            id: currentPage.id,
            value: { ...currentPage, route: "/renamed" },
          },
        ],
      })
    ).ok,
  ).toBe(true);
  await expect(page.getByRole("status")).toContainText("Service revision");
  await expect(title).toHaveValue("Submitted title later");
  await expect(title).toBeFocused();
  await title.press("End");
  await title.pressSequentially("!");
  await title.press("Control+z");
  await expect(title).toHaveValue("Submitted title later");
  // A mismatched control binding returns a localized diagnostic, with repair through Properties.
  const record = snapshot.forms.find(
    (f) => f.appearance.label === "Ledger Record",
  )!;
  const textControl = snapshot.controls.find(
    (c) =>
      c.formId === record.id &&
      c.binding?.kind === "stored" &&
      c.binding.fieldId === "title-id",
  )!;
  await page
    .locator(`[role=treeitem][data-object-id="${textControl.id}"]`)
    .click();
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  await page.getByLabel("Control type", { exact: true }).selectOption("number");
  await page.getByRole("button", { name: "▣ Save", exact: true }).click();
  await expect(page.locator(".message-table")).toContainText("TYPE_MISMATCH");
  await expect(page.getByLabel("Control type", { exact: true })).toHaveValue(
    "number",
  );
  await page.getByLabel("Control type", { exact: true }).selectOption("text");
  await page.getByLabel("Control type", { exact: true }).selectOption("select");
  await page
    .getByLabel("Lookup source", { exact: true })
    .selectOption("table:" + table.id);
  const lookupFields = page.getByRole("group", {
    name: "Lookup fields",
    exact: true,
  });
  await lookupFields
    .getByRole("checkbox", { name: "title · text", exact: true })
    .check();
  await lookupFields
    .getByRole("checkbox", { name: "tenant · integer", exact: true })
    .uncheck();
  await page
    .getByLabel("Lookup label field", { exact: true })
    .selectOption("title-id");
  await page.getByRole("button", { name: "▣ Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(
    (await owner("projects/" + summary.id)).controls.find(
      (c: { id: string }) => c.id === textControl.id,
    )?.lookup,
  ).toMatchObject({
    source: { kind: "table", id: table.id },
    valueFieldIds: ["title-id"],
    labelFieldId: "title-id",
  });

  // Actual scalar typing survives object/project switches and reload without NaN or null coercion.
  snapshot = await owner("projects/" + summary.id);
  const grid = snapshot.forms.find(
    (f) => f.appearance.label === "Ledger Grid",
  )!;
  const scalarRevision = snapshot.revision;
  const selectGrid = async () => {
    await page.locator(`[role=treeitem][data-object-id="${grid.id}"]`).click();
    await page.getByRole("tab", { name: "Format", exact: true }).click();
  };
  await selectGrid();
  const width = page.getByLabel("Width", { exact: true });
  await width.fill("");
  await width.pressSequentially("-");
  await expect(width).toHaveValue("-");
  await expect(width).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "▣ Save", exact: true }).click();
  await expect(page.locator(".message-table")).toContainText("Width");
  expect((await owner("projects/" + summary.id)).revision).toBe(scalarRevision);
  await page.locator(`[role=treeitem][data-object-id="${record.id}"]`).click();
  await selectGrid();
  await expect(width).toHaveValue("-");
  await create(page, "Scalar switch target");
  await page
    .getByRole("button", { name: "Open / Switch…", exact: true })
    .click();
  await page.getByRole("button", { name: /Focused forms/ }).click();
  await expect(width).toHaveValue("-");
  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(width).toHaveValue("-");
  for (const raw of ["1e", "0"]) {
    await width.fill("");
    await width.pressSequentially(raw);
    await page.getByRole("button", { name: "▣ Save", exact: true }).click();
    await expect(width).toHaveValue(raw);
    await expect(width).toHaveAttribute("aria-invalid", "true");
    expect((await owner("projects/" + summary.id)).revision).toBe(
      scalarRevision,
    );
  }
  await width.fill("120");
  await page.getByRole("button", { name: "▣ Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  expect(
    (await owner("projects/" + summary.id)).forms.find(
      (f: { id: string }) => f.id === grid.id,
    )?.appearance.width,
  ).toBe(120);
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  const pageSize = page.getByLabel("Page size", { exact: true });
  for (const raw of ["", "0"]) {
    await pageSize.fill(raw);
    await page.getByRole("button", { name: "▣ Save", exact: true }).click();
    await expect(pageSize).toHaveValue(raw);
    await expect(pageSize).toHaveAttribute("aria-invalid", "true");
  }
  await pageSize.fill("20");
  // Invalid Record wizard includes a pending parent in the candidate, but commits neither.
  await addPage(page, "Pending parent", "/pending");
  snapshot = await owner("projects/" + summary.id);
  const revision = snapshot.revision;
  await page.getByRole("button", { name: "＋ Form", exact: true }).click();
  await page.getByLabel("Form label", { exact: true }).fill("Invalid record");
  await page.getByLabel("Form kind", { exact: true }).selectOption("Record");
  await page
    .getByRole("dialog")
    .getByLabel("Data source", { exact: true })
    .selectOption("table:" + table.id);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("group", { name: "Fields, in selection order" })
    .getByRole("checkbox")
    .first()
    .check();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "keyIds",
  );
  expect((await owner("projects/" + summary.id)).revision).toBe(revision);
  expect((await owner("projects/" + summary.id)).pages).toHaveLength(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.screenshot({
    path: info.outputPath("forms-contextual.png"),
    fullPage: true,
  });
});
