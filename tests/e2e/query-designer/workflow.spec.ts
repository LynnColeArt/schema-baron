import { test, expect, chromium } from "@playwright/test";
import type { Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createId } from "@schema-baron/model";
import type { Project } from "@schema-baron/model";
test.setTimeout(60000);
test.use({
  trace: "off",
  viewport: {
    width: 1280,
    height: 800,
  },
});
let root: string,
  url: string,
  capability: string,
  child: ReturnType<typeof spawn>,
  exit: Promise<unknown>,
  mcp: Client;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "wp16-browser-"));
  capability = randomBytes(32).toString("base64url");
  const config = join(root, "owner.json");
  writeFileSync(
    config,
    JSON.stringify({
      ownerId: "schema-test",
      capability,
      metadataRoot: join(root, "metadata"),
      approvedRoots: {
        projects: join(root, "definitions"),
      },
    }),
    {
      mode: 0o600,
    },
  );
  child = spawn(process.execPath, [resolve("apps/studio/dist/main.js")], {
    env: {
      ...process.env,
      PORT: "0",
      SCHEMA_BARON_BROWSER_MODE: 'capability', SCHEMA_BARON_OWNER_CONFIG: config,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  exit = once(child, "exit");
  url = await new Promise<string>((resolve, reject) => {
    let logs = "";
    const timeout = setTimeout(
      () => reject(new Error("Owner readiness timeout")),
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
      reject(new Error("Owner exited before readiness"));
    });
  });
  const configMcp = join(root, "mcp.json");
  writeFileSync(
    configMcp,
    JSON.stringify({
      ownerUrl: url,
      capability,
    }),
    {
      mode: 0o600,
    },
  );
  mcp = new Client({
    name: "schema-browser-parity",
    version: "1",
  });
  await mcp.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve("apps/mcp/dist/main.js")],
      env: {
        SCHEMA_BARON_MCP_CONFIG: configMcp,
      },
      stderr: "pipe",
    }),
  );
});
test.afterAll(async () => {
  await mcp?.close();
  child?.kill("SIGTERM");
  const timeout = setTimeout(() => child?.kill("SIGKILL"), 5000);
  await exit;
  clearTimeout(timeout);
  // Keep the private disposable fixture for reviewer inspection.
});
async function snapshot(id: string, attempt = 0): Promise<Project> {
  const response = await fetch(`${url}/api/v1/projects/${id}`, {
    headers: {
      authorization: `Bearer ${capability}`,
    },
  });
  const live = (await response.json()).result as Project;
  const result = await mcp.callTool({
    name: "project_inspect",
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: live.revision,
      input: {},
    },
  });
  const outcome = result.structuredContent as {
    ok: boolean;
    result: Project;
    error?: { code: string };
  };
  if (!outcome.ok && outcome.error?.code === "REVISION_CONFLICT" && attempt < 3)
    return snapshot(id, attempt + 1);
  expect(outcome.ok).toBe(true);
  expect(outcome.result).toEqual(live);
  return outcome.result;
}
async function start(page: Page, name: string) {
  await page.goto(url);
  const owner = page.getByLabel("Studio service owner key");
  await expect(owner).toBeVisible();
  {
    await owner.fill(capability);
    await page
      .getByRole("button", {
        name: "Connect",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  await page
    .getByRole("button", {
      name: "New project…",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Project name", {
      exact: true,
    })
    .fill(name);
  await page
    .getByRole("button", {
      name: "Create project",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const response = await fetch(url + "/api/v1/projects?approvedRoot=projects", {
    headers: {
      authorization: `Bearer ${capability}`,
    },
  });
  const list = (await response.json()).result as Project[];
  return list.find((p) => p.name === name)!.id;
}
async function click(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}
async function kind(page: Page, label: string, value: string) {
  await page.getByLabel(label + " kind", { exact: true }).selectOption(value);
}
async function field(page: Page, label: string, alias: string, name: string) {
  await kind(page, label, "field");
  await page
    .getByLabel(label + " field", { exact: true })
    .selectOption({ label: `${alias}.${name}` });
}
async function section(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Query sections" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function projection(
  page: Page,
  index: number,
  name: string,
  alias: string,
  column: string,
) {
  await click(page, "Add projection");
  await page.getByLabel(`Projection ${index} name`, { exact: true }).fill(name);
  await field(page, `Projection ${index}`, alias, column);
}
test("authors joined exact aggregate, typed minimum and reusable source through actual UI; independent SQL, MCP, recovery and limits", async ({
  page,
}, info) => {
  const id = await start(page, "Query authoring");
  // External source fixture: no query AST or application model is prebuilt.
  const db = new Database(join(root, "definitions", "source.sqlite"));
  db.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE member (tenant TEXT NOT NULL, id INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(tenant,id)); CREATE TABLE entry (id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, member_id INTEGER NOT NULL, amount TEXT NOT NULL, FOREIGN KEY(tenant,member_id) REFERENCES member(tenant,id)); INSERT INTO member VALUES ('team',1,'Ada'),('team',2,'Bert'),('team',3,'Cy'); INSERT INTO entry VALUES(1,'team',1,'0.10'),(2,'team',1,'0.20'),(3,'team',2,'12.34');",
  );
  const oracle = db
    .prepare(
      "SELECT m.name, COALESCE(SUM(CAST(REPLACE(e.amount,'.','') AS INTEGER)),0) cents FROM member m LEFT JOIN entry e ON e.tenant=m.tenant AND e.member_id=m.id GROUP BY m.id,m.name ORDER BY m.name",
    )
    .all();
  expect(oracle).toEqual([
    { name: "Ada", cents: 30 },
    { name: "Bert", cents: 1234 },
    { name: "Cy", cents: 0 },
  ]);
  db.close();
  await click(page, "Connections…");
  await page.getByLabel("Relative SQLite file").fill("source.sqlite");
  await click(page, "Inspect SQLite file");
  await click(page, "Bind inspected database");
  await expect(page.getByRole("dialog")).toBeHidden();
  // Explicit logical decimal definition through the existing schema UI; TEXT storage stays unchanged.
  await click(page, "Schema");
  await page
    .locator(".schema-table-list")
    .getByRole("button", { name: /entry/ })
    .click();
  await page
    .locator(".schema-column-list")
    .getByRole("button", { name: "amount · text", exact: true })
    .click();
  await page
    .getByLabel("Logical type", { exact: true })
    .selectOption("decimal");
  await click(page, "Save schema");
  await expect(page.locator(".schema-messages [role=status]")).toContainText(
    "Schema definition saved",
  );
  await click(page, "Queries");
  await click(page, "New query");
  await page.getByLabel("Query name", { exact: true }).fill("Member totals");
  await page
    .getByLabel("Add source", { exact: true })
    .selectOption({ label: "table: member" });
  await page.getByLabel("Source 1 alias", { exact: true }).fill("m");
  await page
    .getByLabel("Add source", { exact: true })
    .selectOption({ label: "table: entry" });
  await page.getByLabel("Source 2 alias", { exact: true }).fill("e");
  await click(page, "Add join");
  await kind(page, "Join 1 condition", "binary");
  await page
    .getByLabel("Join 1 condition operator", { exact: true })
    .selectOption("and");
  await kind(page, "Join 1 condition left", "binary");
  await field(page, "Join 1 condition left left", "m", "tenant");
  await field(page, "Join 1 condition left right", "e", "tenant");
  await kind(page, "Join 1 condition right", "binary");
  await field(page, "Join 1 condition right left", "m", "id");
  await field(page, "Join 1 condition right right", "e", "member_id");
  await page.getByLabel("m position x", { exact: true }).fill("35");
  await page.screenshot({
    path: info.outputPath("sources.png"),
    fullPage: true,
  });
  await section(page, "Fields");
  await page
    .getByLabel("Aggregate grain", { exact: true })
    .selectOption("grouped");
  await projection(page, 1, "member", "m", "name");
  await click(page, "Group by projection 1");
  await page.getByRole("checkbox", { name: "member", exact: true }).check();
  await click(page, "Order by projection 1");
  await click(page, "Add projection");
  await page.getByLabel("Projection 2 name", { exact: true }).fill("total");
  await kind(page, "Projection 2", "aggregate");
  await field(page, "Projection 2 argument", "e", "amount");
  await section(page, "Parameters");
  await click(page, "Add parameter");
  await page.getByLabel("Parameter 1 name", { exact: true }).fill("minimum");
  await page
    .getByLabel("Parameter 1 type", { exact: true })
    .selectOption("decimal");
  await page
    .getByRole("checkbox", { name: "Has default", exact: true })
    .check();
  await page.getByLabel("Parameter 1 default", { exact: true }).fill("0.00");
  await section(page, "Fields");
  await click(page, "Add having");
  await kind(page, "HAVING", "binary");
  await page.getByLabel("HAVING operator", { exact: true }).selectOption(">=");
  await kind(page, "HAVING left", "aggregate");
  await field(page, "HAVING left argument", "e", "amount");
  await kind(page, "HAVING right", "parameter");
  await page
    .getByLabel("HAVING right parameter", { exact: true })
    .selectOption({ label: "minimum" });
  await click(page, "Run preview");
  await expect(
    page.getByRole("status").filter({ hasText: "Preview complete" }),
  ).toBeVisible();
  await section(page, "Review");
  await expect(
    page.getByRole("table", { name: "Preview results" }),
  ).toContainText("0.30");
  await expect(
    page.getByRole("table", { name: "Preview results" }),
  ).toContainText("12.34");
  await expect(
    page.getByRole("table", { name: "Preview results" }),
  ).toContainText("0.00");
  await expect(page.getByLabel("Compiled SQL")).toContainText("LEFT JOIN");
  await expect(page.getByLabel("Compiled SQL")).toContainText("HAVING");
  await expect(
    page.getByLabel("Compiled SQL").locator("textarea,input"),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("preview.png"),
    fullPage: true,
  });
  await click(page, "Save query");
  await expect(
    page.getByRole("status").filter({ hasText: "Query saved" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save query", exact: true }),
  ).toBeDisabled();
  let saved = await snapshot(id);
  expect(saved.queries).toHaveLength(1);
  const query = saved.queries[0]!;
  const semanticBefore = JSON.stringify(query);
  await section(page, "Sources");
  await page.getByLabel("m position x", { exact: true }).fill("80");
  expect(JSON.stringify((await snapshot(id)).queries[0])).toBe(semanticBefore);

  expect(query.projections.map((p) => p.name)).toEqual(["member", "total"]);
  const mcpPreview = await mcp.callTool({
    name: "query_preview",
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: saved.revision,
      input: { queryId: query.id, parameters: {}, rowLimit: 200 },
    },
  });
  expect(mcpPreview.structuredContent).toMatchObject({
    ok: true,
    result: {
      rows: [
        {
          [query.projections[0]!.id]: "Ada",
          [query.projections[1]!.id]: "0.30",
        },
        {
          [query.projections[0]!.id]: "Bert",
          [query.projections[1]!.id]: "12.34",
        },
        {
          [query.projections[0]!.id]: "Cy",
          [query.projections[1]!.id]: "0.00",
        },
      ],
    },
  });
  await section(page, "Parameters");
  await page
    .getByLabel("Parameter 1 preview value", { exact: true })
    .fill("1.00");
  await expect(page.locator(".qd-toolbar [role=status]")).toContainText(
    "Preview out of date",
  );
  await click(page, "Run preview");
  await expect(
    page.getByRole("status").filter({ hasText: "Preview complete · 1 rows" }),
  ).toBeVisible();
  await section(page, "Review");
  await expect(
    page.getByRole("table", { name: "Preview results" }).locator("tbody tr"),
  ).toHaveCount(1);
  await section(page, "Parameters");
  await page
    .getByLabel("Parameter 1 preview value", { exact: true })
    .fill("100.00");
  await click(page, "Run preview");
  await expect(
    page.getByRole("status").filter({ hasText: "no matching rows" }),
  ).toBeVisible();
  // Incomplete grouping remains editable and survives reload, but cannot be saved.
  await section(page, "Fields");
  await click(page, "Remove group 1");
  await click(page, "Save query");
  await expect(
    page
      .getByRole("button")
      .filter({ hasText: "Selected nonaggregate fields must be grouped." })
      .first(),
  ).toBeVisible();
  await page.getByLabel("Query name", { exact: true }).fill("Recovered draft");
  await page.reload();
  await click(page, "Queries");
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Recovered draft",
  );
  await section(page, "Fields");
  await click(page, "Group by projection 1");
  await click(page, "Save query");
  await expect(
    page.getByRole("status").filter({ hasText: "Query saved" }),
  ).toBeVisible();
  saved = await snapshot(id);
  expect(saved.queries[0]!.id).toBe(query.id);
  expect(saved.queries[0]!.projections.map((p) => p.id)).toEqual(
    query.projections.map((p) => p.id),
  );
  await page.getByLabel("Query name", { exact: true }).fill("Renamed totals");
  await page.keyboard.press("Control+s");
  await expect(
    page.getByRole("status").filter({ hasText: "Query saved" }),
  ).toBeVisible();
  await section(page, "Review");
  await page.getByLabel("Scan cost budget", { exact: true }).fill("1");
  await click(page, "Run preview");
  await expect(
    page.getByRole("button").filter({ hasText: "QUERY_COST_EXCEEDED" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("cost-diagnostic.png"),
    fullPage: true,
  });
  await click(page, "Return to page");
  await click(page, "＋ Page");
  await page.getByLabel("Page title", { exact: true }).fill("Directory");
  await page.getByLabel("Internal route", { exact: true }).fill("/directory");
  await click(page, "Add page");
  await click(page, "＋ Form");
  await page.getByLabel("Form label", { exact: true }).fill("Totals");
  await page
    .getByRole("dialog")
    .getByLabel("Data source", { exact: true })
    .selectOption(`query:${query.id}`);
  await click(page, "Next");
  // The combined dependency set constructs ordinary forms through the five-step wizard.
  await page
    .getByRole("group", { name: "Fields, in selection order" })
    .getByRole("checkbox")
    .first()
    .check();
  await click(page, "Next");
  await click(page, "Next");
  await click(page, "Next");
  await click(page, "Finish");
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  await page.getByLabel("Map minimum", { exact: true }).check();
  await page.getByLabel("Mapped minimum", { exact: true }).fill("1.00");
  await page.getByRole("button", { name: "▣ Save", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved · revision" }),
  ).toBeVisible();
  await click(page, "Edit Data Source…");
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Renamed totals",
  );
  await section(page, "Parameters");
  await expect(
    page.getByLabel("Parameter 1 preview value", { exact: true }),
  ).toHaveValue("1.00");
  await section(page, "Review");
  await page.getByLabel("Scan cost budget", { exact: true }).fill("100000");
  await click(page, "Run preview");
  await expect(
    page.getByRole("status").filter({ hasText: "Preview complete · 1 rows" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("reopened-from-form.png"),
    fullPage: true,
  });
  // Dirty typing survives an unrelated MCP edit and a colliding rename is explicit.
  saved = await snapshot(id);
  const form = saved.forms.find((f) => f.sourceRef?.id === query.id)!;
  expect(form.queryParameters).toEqual([
    { parameterId: query.parameters[0]!.id, value: "1.00" },
  ]);
  // Public HTTP/MCP rejection parity: invalid form presets cannot advance or partially save the model.
  const presetBaseline = await snapshot(id);
  for (const defect of [
    "duplicate",
    "wrong-type",
    "missing",
    "null",
    "wrong-source",
  ]) {
    const invalid = structuredClone(form);
    if (defect === "duplicate")
      invalid.queryParameters!.push({ ...invalid.queryParameters![0]! });
    if (defect === "wrong-type")
      invalid.queryParameters![0]!.value = "not-a-decimal";
    if (defect === "missing")
      invalid.queryParameters![0]!.parameterId = createId();
    if (defect === "null") invalid.queryParameters![0]!.value = null;
    if (defect === "wrong-source")
      invalid.sourceRef = {
        kind: "table",
        id: presetBaseline.schema.tables[0]!.id,
      };
    const request = {
      requestId: createId(),
      projectId: id,
      operation: "project.batch",
      expectedRevision: presetBaseline.revision,
      input: {
        operations: [
          { kind: "put", entity: "form", id: form.id, value: invalid },
        ],
      },
    };
    const response = await fetch(`${url}/api/v1/projects/${id}/commands`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${capability}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    });
    expect(response.status).toBe(422);
    const rejected = await response.json();
    expect(rejected.ok).toBe(false);
    expect(JSON.stringify(rejected)).not.toContain("not-a-decimal");
    const { operation: _, ...args } = request;
    expect(
      (await mcp.callTool({ name: "project_batch", arguments: args }))
        .structuredContent,
    ).toEqual(rejected);
    expect(await snapshot(id)).toEqual(presetBaseline);
  }
  const staleRequest = {
    requestId: createId(),
    projectId: id,
    operation: "project.batch",
    expectedRevision: presetBaseline.revision - 1,
    input: {
      operations: [
        {
          kind: "put",
          entity: "form",
          id: form.id,
          value: { ...form, appearance: { label: "Stale overwrite" } },
        },
      ],
    },
  };
  const staleResponse = await fetch(`${url}/api/v1/projects/${id}/commands`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${capability}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(staleRequest),
  });
  expect(staleResponse.status).toBe(409);
  expect(await staleResponse.json()).toMatchObject({
    ok: false,
    error: { code: "REVISION_CONFLICT" },
  });
  expect(await snapshot(id)).toEqual(presetBaseline);
  await page.getByLabel("Query name", { exact: true }).fill("Local name draft");
  const remoteForm = {
    ...form,
    appearance: { ...form.appearance, className: "currency-presentation" },
  };
  const remote = await mcp.callTool({
    name: "project_batch",
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: saved.revision,
      input: {
        operations: [
          { kind: "put", entity: "form", id: form.id, value: remoteForm },
        ],
      },
    },
  });
  expect(remote.structuredContent).toMatchObject({ ok: true });
  await expect(page.locator(".titlebar")).toContainText("Query authoring");
  await expect
    .poll(async () => await page.locator(".revision").textContent())
    .toContain(`r${saved.revision + 1}`);
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Local name draft",
  );
  saved = await snapshot(id);
  const renamed = { ...saved.queries[0]!, name: "Agent rename" };
  const changed = await mcp.callTool({
    name: "project_batch",
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: saved.revision,
      input: {
        operations: [
          { kind: "put", entity: "query", id: query.id, value: renamed },
        ],
      },
    },
  });
  expect(changed.structuredContent).toMatchObject({ ok: true });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Query changed elsewhere: name" }),
  ).toBeVisible();
  await click(page, "Keep my query");
  await click(page, "Save query");
  await expect(
    page.getByRole("status").filter({ hasText: "Query saved" }),
  ).toBeVisible();
  // Hold only the response after a real public save, then continue typing before acknowledgement.
  let release!: () => void, observed!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const committed = new Promise<void>((resolve) => {
    observed = resolve;
  });
  await page.route("**/commands", async (route) => {
    const input = route.request().postDataJSON();
    if (
      input.operation === "project.batch" &&
      input.input.operations.some(
        (op: { entity: string }) => op.entity === "query",
      )
    ) {
      const response = await route.fetch();
      observed();
      await responseGate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByLabel("Query name", { exact: true }).fill("Save checkpoint");
  await click(page, "Save query");
  await committed;
  await page
    .getByLabel("Query name", { exact: true })
    .fill("Typed during save");
  release();
  await expect(
    page.getByRole("button", { name: "Save query", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/commands");
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Typed during save",
  );
  await expect(page.getByLabel("Query name", { exact: true })).toBeFocused();
  expect(
    await page
      .getByLabel("Query name", { exact: true })
      .evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([17, 17]);

  expect((await snapshot(id)).queries[0]!.name).toBe("Save checkpoint");
  await click(page, "Save query");
  await expect
    .poll(async () => (await snapshot(id)).queries[0]!.name)
    .toBe("Typed during save");
  // A real dependent control is configured through the public batch contract; incompatible draft output cannot persist.
  saved = await snapshot(id);
  const boundForm = saved.forms.find((f) => f.id === form.id)!;
  const controlId = createId();
  const dependency = await mcp.callTool({
    name: "project_batch",
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: saved.revision,
      input: {
        operations: [
          {
            kind: "put",
            entity: "form",
            id: form.id,
            value: {
              ...boundForm,
              controlIds: [...boundForm.controlIds, controlId],
            },
          },
          {
            kind: "put",
            entity: "control",
            id: controlId,
            value: {
              id: controlId,
              formId: form.id,
              kind: "number",
              binding: { kind: "stored", fieldId: query.projections[1]!.id },
              readOnly: true,
              appearance: { label: "Total", format: "currency" },
              validation: { required: false },
              events: [],
            },
          },
        ],
      },
    },
  });
  expect(dependency.structuredContent).toMatchObject({ ok: true });
  await section(page, "Fields");
  await click(page, "Remove projection 2");
  await click(page, "Save query");
  await expect(
    page.getByRole("button").filter({ hasText: "BROKEN_REFERENCE" }).first(),
  ).toBeVisible();
  expect((await snapshot(id)).queries[0]!.projections).toHaveLength(2);
  await page.screenshot({
    path: info.outputPath("dependent-output-blocked.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await page.getByLabel("Query name", { exact: true }).focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" at zoom");
  await expect(page.getByLabel("Query name", { exact: true })).toBeFocused();
  await page.screenshot({
    path: info.outputPath("zoom-200.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  // Query document switches preserve unrelated page/schema drafts; Ctrl+S targets the active query.
  await click(page, "Return to page");
  await page.getByRole("treeitem", { name: "Directory", exact: true }).click();
  await page.getByRole("tab", { name: "Format", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Directory draft");
  await page
    .locator(".explorer")
    .getByRole("button", { name: "Typed during save", exact: true })
    .click();
  await page.keyboard.press("Control+s");
  await expect(
    page.getByRole("button").filter({ hasText: "BROKEN_REFERENCE" }).first(),
  ).toBeVisible();
  expect(
    (await snapshot(id)).pages.find((p) => p.route === "/directory")!.title,
  ).toBe("Directory");
  await click(page, "Return to page");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Directory draft",
  );
  await click(page, "Schema");
  await page
    .locator(".schema-table-list")
    .getByRole("button", { name: /entry/ })
    .click();
  await page.getByLabel("Table name", { exact: true }).fill("entry draft");
  await click(page, "Queries");
  await click(page, "Schema");
  await expect(page.getByLabel("Table name", { exact: true })).toHaveValue(
    "entry draft",
  );
  await info.attach("public-evidence", {
    body: JSON.stringify({
      projectId: id,
      queryId: query.id,
      oracle,
      privateFixture: root,
    }),
    contentType: "application/json",
  });
});

test("real preview child cancellation, timeout, bounds and required/null inputs stay read-only", async ({
  page,
}, info) => {
  const id = await start(page, "Preview boundaries");
  const db = new Database(join(root, "definitions", "bounded.sqlite"));
  db.exec(
    "CREATE TABLE readings(id INTEGER PRIMARY KEY, amount TEXT NOT NULL); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<90000) INSERT INTO readings SELECT x,'0.01' FROM n;",
  );
  db.close();
  const before = await import("node:fs").then((fs) =>
    fs.readFileSync(join(root, "definitions", "bounded.sqlite")),
  );
  await click(page, "Connections…");
  await page.getByLabel("Relative SQLite file").fill("bounded.sqlite");
  await click(page, "Inspect SQLite file");
  await click(page, "Bind inspected database");
  await expect(page.getByRole("dialog")).toBeHidden();
  await click(page, "Schema");
  await page
    .locator(".schema-table-list")
    .getByRole("button", { name: /readings/ })
    .click();
  await page
    .locator(".schema-column-list")
    .getByRole("button", { name: "amount · text", exact: true })
    .click();
  await page
    .getByLabel("Logical type", { exact: true })
    .selectOption("decimal");
  await click(page, "Save schema");
  await expect(page.locator(".schema-messages [role=status]")).toContainText(
    "Schema definition saved",
  );
  await click(page, "Queries");
  await click(page, "New query");
  await page.getByLabel("Query name", { exact: true }).fill("Bounded sum");
  await page
    .getByLabel("Add source", { exact: true })
    .selectOption({ label: "table: readings" });
  await section(page, "Fields");
  await page
    .getByLabel("Aggregate grain", { exact: true })
    .selectOption("grouped");
  await click(page, "Add projection");
  await kind(page, "Projection 1", "aggregate");
  await field(page, "Projection 1 argument", "source1", "amount");
  await click(page, "Run preview");
  await click(page, "Cancel preview");
  await expect(
    page.getByRole("status").filter({ hasText: "Preview job canceled" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button").filter({ hasText: "CANCELED" }),
  ).toBeVisible();
  await section(page, "Review");
  await page.getByLabel("Timeout ms", { exact: true }).fill("1");
  await click(page, "Run preview");
  await expect(
    page.getByRole("button").filter({ hasText: "TIMEOUT" }),
  ).toBeVisible();
  await page.getByLabel("Timeout ms", { exact: true }).fill("5000");
  await section(page, "Fields");
  await page
    .getByLabel("Aggregate grain", { exact: true })
    .selectOption("rows");
  await field(page, "Projection 1", "source1", "amount");
  await section(page, "Review");
  await page.getByLabel("Row limit", { exact: true }).fill("1");
  await click(page, "Run preview");
  await expect(
    page.getByRole("status").filter({ hasText: "row limit reached" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Preview results" }).locator("tbody tr"),
  ).toHaveCount(1);
  await section(page, "Parameters");
  await click(page, "Add parameter");
  await page
    .getByLabel("Parameter 1 name", { exact: true })
    .fill("required limit");
  await click(page, "Run preview");
  await expect(
    page.getByRole("button").filter({ hasText: "TYPE_MISMATCH" }),
  ).toBeVisible();
  await page
    .getByLabel("Parameter 1 preview mode", { exact: true })
    .selectOption("null");
  await click(page, "Run preview");
  await expect(
    page.getByRole("button").filter({ hasText: "TYPE_MISMATCH" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Nullable parameter", exact: true })
    .check();
  await click(page, "Run preview");
  await expect(
    page.getByRole("status").filter({ hasText: "Preview complete" }),
  ).toBeVisible();
  const after = await import("node:fs").then((fs) =>
    fs.readFileSync(join(root, "definitions", "bounded.sqlite")),
  );
  expect(after).toEqual(before);
  expect((await snapshot(id)).queries).toHaveLength(0);
  await page.screenshot({
    path: info.outputPath("bounded-preview.png"),
    fullPage: true,
  });
});

test("native Chromium 200 percent keeps schema footer and query authoring keyboard and pointer reachable", async ({}, info) => {
  const profile = join(root, "native-profile");
  mkdirSync(join(profile, "Default"), { recursive: true });
  writeFileSync(
    join(profile, "Default", "Preferences"),
    JSON.stringify({
      partition: { default_zoom_level: { x: Math.log(2) / Math.log(1.2) } },
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
    const page = context.pages()[0]!;
    const id = await start(page, "Native query zoom");
    const metrics = await page.evaluate(() => ({
      innerWidth,
      innerHeight,
      outerWidth,
      outerHeight,
      dpr: devicePixelRatio,
      cssZoom: getComputedStyle(document.documentElement).zoom,
    }));
    expect(metrics).toEqual({
      innerWidth: 640,
      innerHeight: 400,
      outerWidth: 1280,
      outerHeight: 800,
      dpr: 2,
      cssZoom: "1",
    });
    const reachable = async (label: string) => {
      const input = page.getByLabel(label, { exact: true });
      await input.focus();
      const hit = await input.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.x + r.width / 2,
          y = r.y + r.height / 2;
        const target = document.elementFromPoint(x, y);
        return (
          x >= 0 &&
          x < innerWidth &&
          y >= 0 &&
          y < innerHeight &&
          (target === el || el.contains(target))
        );
      });
      expect(
        hit,
        `${label} center must receive a real pointer click at native zoom`,
      ).toBe(true);
      await input.click();
      await expect(input).toBeFocused();
    };
    await click(page, "Schema");
    const viewport = page.getByRole("region", {
      name: "Schema viewport",
      exact: true,
    });
    await viewport.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => await viewport.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "＋ Table", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Table name", { exact: true }).fill("zoom_draft");
    await page.locator(".schema-backfill summary").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(
      page.getByLabel("Backfill literal", { exact: true }),
    ).toBeFocused();
    await reachable("Backfill literal");
    await page
      .getByLabel("Backfill literal", { exact: true })
      .fill("native focus");
    await page.screenshot({
      path: info.outputPath("native-200-schema-footer.png"),
      scale: "device",
    });
    const db = new Database(join(root, "definitions", "native.sqlite"));
    db.exec(
      "CREATE TABLE sample(id INTEGER PRIMARY KEY,value TEXT NOT NULL); INSERT INTO sample VALUES(1,'Visible row');",
    );
    db.close();
    await page
      .getByRole("button", { name: "Connect SQLite…", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Relative SQLite file").fill("native.sqlite");
    await click(page, "Inspect SQLite file");
    await click(page, "Bind inspected database");
    await expect(page.getByRole("dialog")).toBeHidden();
    await click(page, "Queries");
    await page.getByRole("button", { name: "New query", exact: true }).focus();
    await page.keyboard.press("Enter");
    await reachable("Query name");
    await page.getByLabel("Query name", { exact: true }).fill("Native source");
    await page
      .getByLabel("Add source", { exact: true })
      .selectOption({ label: "table: sample" });
    await section(page, "Fields");
    await click(page, "Add projection");
    await field(page, "Projection 1", "source1", "value");
    await section(page, "Parameters");
    await click(page, "Add parameter");
    await reachable("Parameter 1 name");
    await page
      .getByLabel("Parameter 1 name", { exact: true })
      .fill("threshold");
    await page
      .getByRole("checkbox", { name: "Has default", exact: true })
      .check();
    await reachable("Parameter 1 default");
    await page.getByLabel("Parameter 1 default", { exact: true }).fill("0");
    await page.keyboard.press("Control+s");
    await expect.poll(async () => (await snapshot(id)).queries.length).toBe(1);
    await page
      .getByRole("button", { name: "Run preview", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".qd-toolbar [role=status]")).toContainText(
      "Preview complete",
    );
    await section(page, "Review");
    await expect(
      page.getByRole("table", { name: "Preview results" }),
    ).toContainText("Visible row");
    await page.getByLabel("Row limit", { exact: true }).focus();
    await reachable("Row limit");
    await page.screenshot({
      path: info.outputPath("native-200-query.png"),
      scale: "device",
    });
    await info.attach("native-zoom-metrics", {
      body: JSON.stringify(metrics),
      contentType: "application/json",
    });
  } finally {
    await context.close();
  }
});

test("unfinished query and structural history survive all switches, reload and MCP rebases; invalid save stays atomic", async ({
  page,
}, info) => {
  const id = await start(page, "Query history recovery");
  const path = join(root, "definitions", "history.sqlite"),
    db = new Database(path);
  db.exec(
    "CREATE TABLE sample(id INTEGER PRIMARY KEY,value TEXT NOT NULL); INSERT INTO sample VALUES(1,'abc');",
  );
  db.close();
  const original = await import("node:fs").then((fs) => fs.readFileSync(path));
  await click(page, "Connections…");
  await page.getByLabel("Relative SQLite file").fill("history.sqlite");
  await click(page, "Inspect SQLite file");
  await click(page, "Bind inspected database");
  await expect(page.getByRole("dialog")).toBeHidden();
  await click(page, "Queries");
  await click(page, "New query");
  await page.getByLabel("Query name", { exact: true }).fill("Function draft");
  await page
    .getByLabel("Add source", { exact: true })
    .selectOption({ label: "table: sample" });
  await section(page, "Fields");
  await click(page, "Add projection");
  await kind(page, "Projection 1", "function");
  await page
    .getByLabel("Projection 1 function", { exact: true })
    .selectOption("length");
  await page
    .getByRole("button", { name: "Remove argument", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Remove argument", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Undo query", exact: true }).focus();
  await page.keyboard.press("Control+z");
  await expect(
    page.getByRole("button", { name: "Remove argument", exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(
    page.getByRole("button", { name: "Remove argument", exact: true }),
  ).toHaveCount(0);
  await click(page, "Save query");
  await expect(
    page.getByRole("button").filter({ hasText: "Complete the query sources" }),
  ).toBeVisible();
  const draft = await page.evaluate((project) => {
    const saved = JSON.parse(
      sessionStorage.getItem(`studio.query.${project}`)!,
    );
    return saved.drafts[saved.selected].value;
  }, id);
  const queryId = draft.id,
    projectionId = draft.projections[0].id;
  const before = await snapshot(id),
    request = {
      requestId: createId(),
      operation: "project.batch",
      expectedRevision: before.revision,
      input: {
        operations: [
          { kind: "put", entity: "query", id: queryId, value: draft },
        ],
      },
    };
  const rejected = await fetch(`${url}/api/v1/projects/${id}/commands`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${capability}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });
  expect(rejected.status).toBe(400);
  expect(await snapshot(id)).toEqual(before);
  // Keep an invalid state in redo history too, then navigate without adding model history.
  await click(page, "Undo query");
  await expect(
    page.getByRole("button", { name: "Remove argument", exact: true }),
  ).toHaveCount(1);
  await click(page, "Redo query");
  const historySize = async () =>
    page.evaluate((project) => {
      const s = JSON.parse(sessionStorage.getItem(`studio.query.${project}`)!);
      return s.drafts[s.selected].past.length;
    }, id);
  const priorNavigation = await historySize();
  await section(page, "Review");
  await section(page, "Fields");
  await page.getByLabel("Query name", { exact: true }).focus();
  expect(await historySize()).toBe(priorNavigation);
  // Ctrl+Z in a real text edit must not jump to a structural argument snapshot.
  await page.getByLabel("Query name", { exact: true }).press("End");
  await page.keyboard.type("x");
  await page.keyboard.press("Control+z");
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Function draft",
  );
  const nativeFuture = await page.evaluate((project) => {
    const s = JSON.parse(sessionStorage.getItem(`studio.query.${project}`)!);
    return s.drafts[s.selected].future ?? [];
  }, id);
  expect(nativeFuture).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Remove argument", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Query name", { exact: true }).fill("Function draft");
  await click(page, "New query");
  await page
    .getByLabel("Query name", { exact: true })
    .fill("Preaggregation draft");
  await section(page, "Fields");
  await page
    .getByLabel("Aggregate grain", { exact: true })
    .selectOption("preaggregated");
  const preaggId = await page.evaluate(
    (project) =>
      JSON.parse(sessionStorage.getItem(`studio.query.${project}`)!).selected,
    id,
  );
  await click(page, "New query");
  await page.getByLabel("Query name", { exact: true }).fill("Sibling draft");
  await click(page, "Return to page");
  await click(page, "Schema");
  await click(page, "Queries");
  await click(page, "New project…");
  await page
    .getByLabel("Project name", { exact: true })
    .fill("History switch target");
  await click(page, "Create project");
  await expect(page.locator(".titlebar")).toContainText(
    "History switch target",
  );
  await click(page, "Open / Switch…");
  await page.getByRole("button", { name: /Query history recovery/ }).click();
  await expect(page.locator(".titlebar")).toContainText(
    "Query history recovery",
  );
  await page.reload();
  await click(page, "Queries");
  for (const name of [
    "Function draft *",
    "Preaggregation draft *",
    "Sibling draft *",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await click(page, "Function draft *");
  await expect(
    page.getByRole("button", { name: "Remove argument", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button").filter({ hasText: "Complete the query sources" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo query", exact: true }).focus();
  await page.keyboard.press("Control+z"); // undo native text-history entry first
  // Undo any name-only edits to reach the preceding structural boundary.
  for (
    let i = 0;
    i < 6 &&
    (await page
      .getByRole("button", { name: "Remove argument", exact: true })
      .count()) === 0;
    i++
  )
    await click(page, "Undo query");
  await expect(
    page.getByRole("button", { name: "Remove argument", exact: true }),
  ).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("recovered-query-history.png"),
    fullPage: true,
  });
  // Return to the unfinished function and continue authoring to a valid saved definition.
  while (
    await page
      .getByRole("button", { name: "Redo query", exact: true })
      .isEnabled()
  )
    await click(page, "Redo query");
  await click(page, "Add argument");
  await page
    .getByLabel("Projection 1 argument 1 type", { exact: true })
    .selectOption("text");
  await page
    .getByLabel("Projection 1 argument 1 value", { exact: true })
    .fill("abc");
  await click(page, "Save query");
  await expect.poll(async () => (await snapshot(id)).queries.length).toBe(1);
  let saved = await snapshot(id);
  expect(saved.queries[0]!.id).toBe(queryId);
  expect(saved.queries[0]!.projections[0]!.id).toBe(projectionId);
  // Undoing a committed model edit only stages a different definition until explicit Save.
  await click(page, "Undo query");
  expect((await snapshot(id)).queries).toEqual(saved.queries);
  await expect(
    page.getByRole("button", { name: "Save query", exact: true }),
  ).toBeEnabled();
  await click(page, "Redo query");
  await expect(
    page.getByRole("button", { name: "Save query", exact: true }),
  ).toBeDisabled();
  // Opening an unsaved query document is navigation. Undo can still reach its editable blank definition.
  while (
    await page
      .getByRole("button", { name: "Undo query", exact: true })
      .isEnabled()
  )
    await click(page, "Undo query");
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Untitled query",
  );
  await click(page, "Save query");
  await expect(
    page.getByRole("button").filter({ hasText: "Complete the query sources" }),
  ).toBeVisible();
  expect((await snapshot(id)).queries).toEqual(saved.queries);
  await page.reload();
  await click(page, "Queries");
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Untitled query",
  );
  while (
    await page
      .getByRole("button", { name: "Redo query", exact: true })
      .isEnabled()
  )
    await click(page, "Redo query");
  await expect(
    page.getByLabel("Projection 1 name", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save query", exact: true }),
  ).toBeDisabled();
  expect((await snapshot(id)).queries).toEqual(saved.queries);
  await click(page, "Remove projection 1");
  const remote = { ...saved.queries[0]!, name: "Remote name" };
  expect(
    (
      await mcp.callTool({
        name: "project_batch",
        arguments: {
          projectId: id,
          requestId: createId(),
          expectedRevision: saved.revision,
          input: {
            operations: [
              { kind: "put", entity: "query", id: queryId, value: remote },
            ],
          },
        },
      })
    ).structuredContent,
  ).toMatchObject({ ok: true });
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Remote name",
  );
  await click(page, "Undo query");
  await expect(
    page.getByLabel("Projection 1 name", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Query name", { exact: true })).toHaveValue(
    "Remote name",
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "Query changed elsewhere" }),
  ).toHaveCount(0);
  // An unrelated remote edit must be present when undo restores a removed source too.
  await section(page, "Sources");
  await click(page, "Remove source 1");
  await click(page, "Undo query");
  await expect(page.getByLabel("Source 1 alias", { exact: true })).toHaveValue(
    "source1",
  );
  await click(page, "Preaggregation draft *");
  await expect(page.getByLabel("Aggregate grain", { exact: true })).toHaveValue(
    "preaggregated",
  );
  await page
    .getByLabel("Aggregate grain", { exact: true })
    .selectOption("rows");
  await section(page, "Sources");
  await page
    .getByLabel("Add source", { exact: true })
    .selectOption({ label: "table: sample" });
  await section(page, "Fields");
  await projection(page, 1, "value", "source1", "value");
  await click(page, "Save query");
  await expect.poll(async () => (await snapshot(id)).queries.length).toBe(2);
  saved = await snapshot(id);
  expect(saved.queries.some((q) => q.id === preaggId)).toBe(true);
  expect(await import("node:fs").then((fs) => fs.readFileSync(path))).toEqual(
    original,
  );
  await page.screenshot({
    path: info.outputPath("continued-recovered-query.png"),
    fullPage: true,
  });
});
