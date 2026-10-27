import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import type { Page as BrowserPage } from "@playwright/test";
import type { Project } from "@schema-baron/model";
test.use({
  trace: "off",
  viewport: {
    width: 1280,
    height: 800
  }
});
export let root: string, url: string, capability: string, child: ReturnType<typeof spawn>;
let exit: Promise<unknown>;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "baron-usability-e2e-"));
  mkdirSync(join(root, "definitions"));
  capability = randomBytes(32).toString("base64url");
  const config = join(root, "owner.json");
  writeFileSync(config, JSON.stringify({
    ownerId: "workspace-test",
    capability,
    metadataRoot: join(root, "metadata"),
    approvedRoots: {
      projects: join(root, "definitions"),
      output: join(root, "output")
    }
  }), {
    mode: 0o600
  });
  child = spawn(process.execPath, [resolve("apps/studio/dist/main.js")], {
    env: {
      ...process.env,
      PORT: "0",
      SCHEMA_BARON_OWNER_CONFIG: config
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  exit = once(child, "exit");
  url = await new Promise((resolve, reject) => {
    let logs = "";
    const timer = setTimeout(() => reject(new Error("Owner did not start")), 20000);
    child.stderr!.on("data", chunk => {
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
});
test.afterAll(async () => {
  child?.kill("SIGTERM");
  const timer = setTimeout(() => child?.kill("SIGKILL"), 5000);
  await exit;
  clearTimeout(timer);
  if (root) rmSync(root, {
    recursive: true,
    force: true
  });
});
export async function owner(path: string) {
  const response = await fetch(url + "/api/v1/" + path, {
    headers: {
      authorization: `Bearer ${capability}`
    }
  });
  const outcome = await response.json();
  expect(outcome.ok).toBe(true);
  return outcome.result;
}
export async function connect(page: BrowserPage) {
  await page.goto(url);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Studio service owner key").focus();
  await page.keyboard.insertText(capability);
  await dialog.getByRole("button", {
    name: "Connect",
    exact: true
  }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
}
export async function create(page: BrowserPage, name: string) {
  await page.getByRole("button", {
    name: "New project…",
    exact: true
  }).click();
  await page.getByLabel("Project name", {
    exact: true
  }).fill(name);
  await page.getByRole("button", {
    name: "Create project",
    exact: true
  }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
export async function command(project: Project, operation: string, input: unknown) {
  const response = await fetch(url + '/api/v1/projects/' + project.id + '/commands', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + capability,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      projectId: project.id,
      expectedRevision: project.revision,
      operation,
      input
    })
  });
  const outcome = await response.json();
  expect(outcome, JSON.stringify(outcome)).toMatchObject({
    ok: true
  });
  return outcome;
}
export async function current(name: string): Promise<Project> {
  const summary = (await owner('projects?approvedRoot=projects')).find((p: Project) => p.name === name);
  return owner('projects/' + summary.id);
}
export async function keyButton(page: BrowserPage, name: string) {
  const control = page.getByRole('button', {
    name,
    exact: true
  });
  await expect(control).toBeEnabled();
  await control.focus();
  await expect(control).toBeFocused();
  await control.press('Enter');
}
export async function keyText(page: BrowserPage, label: string, value: string) {
  const control = page.getByLabel(label, {
    exact: true
  });
  await expect(control).toBeEditable();
  await control.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(value);
}
export async function keyTab(page: BrowserPage, name: string) {
  await (['Design', 'HTML', 'Code', 'Preview', 'Live Page'].includes(name) ? page.getByRole('tablist', {
    name: 'Document modes',
    exact: true
  }) : page).getByRole('tab', {
    name,
    exact: true
  }).focus();
  await page.keyboard.press('Enter');
}
export async function keySelect(page: BrowserPage, label: string, option: string) {
  const control = page.getByLabel(label, {
    exact: true
  });
  await expect(control).toBeVisible();
  await expect.poll(() => control.locator('option').allTextContents()).toContain(option);
  const choices = await control.locator('option').allTextContents();
  const index = choices.findIndex(text => text === option);
  expect(index, choices.join(', ')).toBeGreaterThanOrEqual(0);
  await expect(control).toBeEnabled();
  await control.focus();
  if (index === choices.length - 1) await page.keyboard.press('End');else if (index === 0) await page.keyboard.press('Home');else {
    let selected = await control.evaluate((element: HTMLSelectElement) => element.selectedIndex);
    while (selected !== index) {
      await expect(control).toBeEnabled();
      await control.focus();
      await page.keyboard.press(selected < index ? 'ArrowDown' : 'ArrowUp');
      selected += selected < index ? 1 : -1;
      await expect(control).toBeEnabled();
    }
  }
  await page.keyboard.press('Tab');
}
export async function keyCheck(page: BrowserPage, label: string) {
  const control = page.getByLabel(label, {
    exact: true
  });
  await control.focus();
  if (!(await control.isChecked())) await page.keyboard.press('Space');
}
