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
  root = mkdtempSync(join(tmpdir(), "baron-workspace-e2e-"));
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
    env: { ...process.env, PORT: "0", SCHEMA_BARON_OWNER_CONFIG: config },
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
  mcp = new Client({ name: "workspace-proof", version: "1" });
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
async function addForm(page: BrowserPage, label: string) {
  await page.getByRole("button", { name: "＋ Form", exact: true }).click();
  await page.getByLabel("Form label", { exact: true }).fill(label);
  await page.getByRole("button", { name: "Add form", exact: true }).click();
}
async function save(page: BrowserPage) {
  await page.getByRole("button", { name: "▣ Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
}
async function agentEdit(
  project: Project,
  pageId: string,
  patch: Record<string, string>,
) {
  const value = { ...project.pages.find((p) => p.id === pageId)!, ...patch };
  const result = await mcp.callTool({
    name: "project_batch",
    arguments: {
      requestId: crypto.randomUUID(),
      projectId: project.id,
      expectedRevision: project.revision,
      input: {
        operations: [{ kind: "put", entity: "page", id: pageId, value }],
      },
    },
  });
  expect(result.isError).not.toBe(true);
}
test("real blank lifecycle, atomic Cancel, keyboard authoring, contextual controls, undo/redo, dirty close and reopen", async ({
  page,
}, info) => {
  await page.goto(url);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Studio service owner key")
    .fill("invalid-private-key");
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Studio service owner key")).toHaveValue("");
  await dialog.getByLabel("Studio service owner key").fill(capability);
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(dialog).toBeHidden();
  const before = await owner("projects?approvedRoot=projects");
  await page.getByRole("button", { name: "New project…", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Canceled");
  await page.keyboard.press("Escape");
  expect(await owner("projects?approvedRoot=projects")).toEqual(before);
  await create(page, "Keyboard studio");
  let summaries = await owner("projects?approvedRoot=projects");
  const projectId = summaries.find(
    (s: { name: string }) => s.name === "Keyboard studio",
  ).id;
  expect(await owner("projects/" + projectId)).toMatchObject({
    pages: [],
    forms: [],
    controls: [],
    schema: { tables: [] },
  });
  await page.getByRole("button", { name: "＋ Page", exact: true }).click();
  await page.getByLabel("Page title").fill("Canceled page");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("treeitem", { name: /Canceled page/ }),
  ).toHaveCount(0);
  await addPage(page, "First", "/first");
  await addForm(page, "First login");
  await page.getByRole("tab", { name: "Controls", exact: true }).click();
  await page.getByRole("button", { name: "◇ Label", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).fill("Account label");
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await expect(
    page.getByText("No events assigned.", { exact: false }),
  ).toBeVisible();
  await addPage(page, "Second", "/second");
  await addForm(page, "Second login");
  await page.getByRole("treeitem", { name: /^First\s*unsaved$/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tab", { name: "First *", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Title", { exact: true }).fill("First renamed");
  await page.getByRole("button", { name: "↶ Undo", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("First");
  await page.getByRole("button", { name: "↷ Redo", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "First renamed",
  );
  await save(page);
  const snapshot: Project = await owner("projects/" + projectId);
  expect(snapshot.pages).toHaveLength(2);
  expect(snapshot.forms).toHaveLength(2);
  expect(snapshot.controls[0]!.appearance.label).toBe("Account label");
  await page.getByRole("button", { name: "↶ Undo", exact: true }).click();
  await expect(page.getByRole("treeitem")).toHaveCount(0);
  expect((await owner("projects/" + projectId)).revision).toBe(
    snapshot.revision,
  );
  await page.getByRole("button", { name: "↷ Redo", exact: true }).click();
  await expect(page.getByRole("treeitem")).toHaveCount(5);
  const inspected = await mcp.callTool({
    name: "project_inspect",
    arguments: {
      requestId: crypto.randomUUID(),
      projectId,
      expectedRevision: snapshot.revision,
      input: {},
    },
  });
  expect(inspected.structuredContent).toMatchObject({ result: snapshot });
  await page.getByLabel("Title", { exact: true }).fill("Recoverable draft");
  await page
    .getByRole("button", { name: "Close Recoverable draft", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Title")).toHaveValue("Recoverable draft");
  await page
    .getByRole("button", { name: "Close Recoverable draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep draft and close", exact: true })
    .click();
  await page.getByRole("treeitem", { name: /Recoverable draft/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Title")).toHaveValue("Recoverable draft");
  page.on("dialog", (d) => void d.accept());
  await page.reload();
  await expect(page.getByLabel("Title")).toHaveValue("Recoverable draft");
  await expect(
    page.getByRole("button", { name: "Disconnect service", exact: true }),
  ).toBeVisible();
  expect((await owner("projects/" + projectId)).pages[0].id).toBe(
    snapshot.pages[0]!.id,
  );
  expect(
    await page.evaluate(
      (key) =>
        [
          document.documentElement.outerHTML,
          JSON.stringify({ ...localStorage }),
          JSON.stringify({ ...sessionStorage }),
        ].some((text) => text.includes(key)),
      capability,
    ),
  ).toBe(false);
  if (process.env.STUDIO_AXE_SCRIPT) {
    await page.addScriptTag({ path: process.env.STUDIO_AXE_SCRIPT });
    const audit = await page.evaluate(async () => {
      const result = await (
        window as unknown as {
          axe: { run: (options: object) => Promise<{ violations: unknown[] }> };
        }
      ).axe.run({
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      });
      return result.violations;
    });
    writeFileSync(info.outputPath("axe-wcag21aa.json"), JSON.stringify(audit));
    await info.attach("axe-wcag21aa", {
      path: info.outputPath("axe-wcag21aa.json"),
      contentType: "application/json",
    });
    expect(audit).toEqual([]);
  }
  await page.screenshot({
    path: info.outputPath("workspace-baseline.png"),
    fullPage: true,
  });
  await info.attach("workspace-baseline", {
    path: info.outputPath("workspace-baseline.png"),
    contentType: "image/png",
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({
    path: info.outputPath("workspace-1920.png"),
    fullPage: true,
  });
  await info.attach("workspace-1920", {
    path: info.outputPath("workspace-1920.png"),
    contentType: "image/png",
  });
});
test("two drafts survive project switches and MCP edits; conflict resolution, invalid atomic save, focus, resizing and reduced viewport", async ({
  page,
}, info) => {
  await connect(page);
  await create(page, "Revision studio");
  await addPage(page, "Alpha", "/alpha");
  await addForm(page, "Alpha login");
  await addPage(page, "Beta", "/beta");
  await addForm(page, "Beta login");
  await save(page);
  let summaries = await owner("projects?approvedRoot=projects");
  const projectId = summaries.find(
    (s: { name: string }) => s.name === "Revision studio",
  ).id;
  let snapshot: Project = await owner("projects/" + projectId);
  const alpha = snapshot.pages.find((p) => p.title === "Alpha")!,
    beta = snapshot.pages.find((p) => p.title === "Beta")!;
  await page.getByRole("treeitem", { name: /^Alpha$/ }).dblclick();
  const title = page.getByLabel("Title", { exact: true });
  await title.fill("Alpha draft");
  await page.getByRole("treeitem", { name: /^Beta$/ }).dblclick();
  await title.fill("Beta draft");
  await title.press("ArrowLeft");
  const focusBefore = await title.evaluate(
    (input: HTMLInputElement) => input.selectionStart,
  );
  await agentEdit(snapshot, alpha.id, { route: "/agent-route" });

  await expect(page.getByRole("status")).toContainText("received");
  await expect(title).toBeFocused();
  expect(
    await title.evaluate((input: HTMLInputElement) => input.selectionStart),
  ).toBe(focusBefore);
  await expect(title).toHaveValue("Beta draft");
  await create(page, "Switch target");
  await page
    .getByRole("button", { name: "Open / Switch…", exact: true })
    .click();
  await page.getByRole("button", { name: /Revision studio/ }).click();
  await expect(title).toHaveValue("Beta draft");
  await page.getByRole("treeitem", { name: /Alpha draft/ }).dblclick();
  await expect(title).toHaveValue("Alpha draft");
  await page.getByRole("tab", { name: "Data", exact: true }).click();
  await expect(page.getByLabel("Route")).toHaveValue("/agent-route");
  snapshot = await owner("projects/" + projectId);
  await agentEdit(snapshot, alpha.id, { title: "Agent title" });
  await expect(
    page.getByRole("alert").filter({ hasText: "Conflicting service revision" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "▣ Save", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Keep my draft", exact: true })
    .click();
  await save(page);
  snapshot = await owner("projects/" + projectId);
  expect(snapshot.pages.find((p) => p.id === alpha.id)).toMatchObject({
    title: "Alpha draft",
    route: "/agent-route",
  });
  expect(snapshot.pages.find((p) => p.id === beta.id)!.title).toBe(
    "Beta draft",
  );
  await page.getByLabel("Route").fill("/beta");
  await page.getByLabel("Route").press("ControlOrMeta+s");
  await expect(
    page
      .getByRole("region", { name: "Messages", exact: true })
      .getByRole("button"),
  ).toContainText("Route must be unique");
  expect((await owner("projects/" + projectId)).revision).toBe(
    snapshot.revision,
  );
  await expect(page.getByLabel("Route")).toBeFocused();
  await page
    .getByRole("region", { name: "Messages", exact: true })
    .getByRole("button")
    .click();
  await expect(page.getByLabel("Route")).toBeFocused();
  await page.getByLabel("Route").fill("/alpha-final");
  await save(page);
  await page
    .getByRole("separator", { name: "Explorer width", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("separator", { name: "Explorer width", exact: true }),
  ).toHaveAttribute("aria-valuenow", "256");
  const samples: number[] = [];
  await page.getByRole("tab", { name: "Format", exact: true }).click();
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await title.fill("Latency " + i);
    await expect(title).toHaveValue("Latency " + i);
    samples.push(performance.now() - start);
  }
  await title.press("ArrowLeft");
  const savedCaret = await title.evaluate(
    (input: HTMLInputElement) => input.selectionStart,
  );
  await title.press("ControlOrMeta+s");
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(title).toBeFocused();
  expect(
    await title.evaluate((input: HTMLInputElement) => input.selectionStart),
  ).toBe(savedCaret);
  const sorted = [...samples].sort((a, b) => a - b);
  const timing = {
    browser: "Chromium 156.0.8078.4",
    samples,
    median: sorted[15],
    p95: sorted[28],
    scope:
      "30 Playwright input-to-observed-value samples in a two-page/two-form workspace; includes automation overhead; no full-scale NFR budget claim",
  };
  writeFileSync(
    info.outputPath("latency.json"),
    JSON.stringify(timing, null, 2),
  );
  await info.attach("latency-samples-ms", {
    path: info.outputPath("latency.json"),
    contentType: "application/json",
  });
  await page.setViewportSize({ width: 640, height: 400 });
  await page.screenshot({
    path: info.outputPath("workspace-reduced-640x400.png"),
    fullPage: true,
  });
  await info.attach("reduced-viewport-layout", {
    path: info.outputPath("workspace-reduced-640x400.png"),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await page.getByRole("button", { name: "Explorer", exact: true }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Design document" }),
  ).toBeVisible();
});
