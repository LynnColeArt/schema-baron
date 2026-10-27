import { test, expect, chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Page as BrowserPage } from "@playwright/test";
import type { Project } from "@schema-baron/model";
test.use({ actionTimeout: 10000, trace: "off", viewport: { width: 1280, height: 800 } });
let root: string,
  url: string,
  capability: string,
  child: ReturnType<typeof spawn>,
  mcp: Client;
let exit: Promise<unknown>;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "baron-document-modes-e2e-"));
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
  mcp = new Client({ name: "document-modes-proof", version: "1" });
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

async function loginForm(page: BrowserPage, label: string) {
  await page.getByRole('button', { name: '＋ Form', exact: true }).click();
  await page.getByLabel('Form label', { exact: true }).fill(label);
  await page.getByLabel('Form kind', { exact: true }).selectOption('Login');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
const mode = (page: BrowserPage, name: string) => page.getByRole('tablist', { name: 'Document modes', exact: true }).getByRole('tab', { name, exact: true });

test('actual authoring: HTML and Design share stable objects, recovery, conflicts and isolated current draft', async ({ page }, info) => {
  test.setTimeout(120000);
  await connect(page);
  await create(page, 'Draft notebook');
  await addPage(page, 'Notebook', '/notebook');
  await loginForm(page, 'Primary sign in');
  await loginForm(page, 'Secondary sign in');
  const summary = (await owner('projects?approvedRoot=projects'))[0];
  let snapshot: Project = await owner('projects/' + summary.id);
  const originalControls = structuredClone(snapshot.controls);
  const p = snapshot.pages[0]!, [a, b] = snapshot.forms;
  expect(a && b).toBeTruthy();
  const ref = (form: NonNullable<typeof a>, reverse = false) => `<sb-form id="${form.id}">\n${[...form.controlIds].sort((x, y) => reverse ? form.controlIds.indexOf(y) - form.controlIds.indexOf(x) : form.controlIds.indexOf(x) - form.controlIds.indexOf(y)).map(id => `  <sb-control id="${id}" />`).join('\n')}\n</sb-form>`;
  const source = `<header><h1>Current notebook</h1></header>\n<section>\n${ref(b!)}\n${ref(a!, true)}\n</section>`;
  await mode(page, 'HTML').click();
  const html = page.getByLabel('HTML source', { exact: true });
  await html.fill(source);
  await page.getByRole('button', { name: 'Apply HTML to draft', exact: true }).click();
  await mode(page, 'Design').click();
  await expect(page.getByLabel('Static text 0.0.0')).toHaveValue('Current notebook');
  await expect(page.locator('.page-sheet .form-caption')).toHaveText(['LOGINSecondary sign in', 'LOGINPrimary sign in']);
  await page.getByRole('button', { name: 'Move Primary sign in earlier', exact: true }).click();
  await expect(page.locator('.page-sheet .form-caption')).toHaveText(['LOGINPrimary sign in', 'LOGINSecondary sign in']);
  await page.locator('.page-sheet .form-caption').first().click();
  await page.getByRole('tab', { name: 'Format', exact: true }).click();
  await page.getByLabel('Label', { exact: true }).fill('Renamed sign in');
  await page.getByRole('button', { name: '▣ Save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  snapshot = await owner('projects/' + summary.id);
  expect(snapshot.forms.find(f => f.id === a!.id)?.controlIds).toEqual([...a!.controlIds].reverse());
  expect(snapshot.controls).toEqual(originalControls);
  expect(snapshot.forms.find(f => f.id === a!.id)?.appearance.label).toBe('Renamed sign in');
  expect(snapshot.forms.map(f => f.id)).toEqual([a!.id, b!.id]);
  await mode(page, 'HTML').click();
  // Formatting survives mode/property switches while the document semantics stay stable.
  const formatted = (await html.inputValue()).replace('<section>', '<section>\n\n');
  await html.fill(formatted);
  await page.getByRole('button', { name: 'Apply HTML to draft', exact: true }).click();
  await mode(page, 'Preview').click();
  await expect(page.getByText('Current draft preview', { exact: true })).toBeVisible();
  const frame = page.frameLocator('iframe[title="Isolated current draft preview"]');
  await expect(frame.getByRole('heading', { name: 'Current notebook' })).toBeVisible();
  const previewFrame = page.frames().find(f => f.parentFrame());
  expect(await previewFrame!.evaluate(() => { try { return !!parent.document.body; } catch { return false; } })).toBe(false);
  expect(await previewFrame!.evaluate(async target => { try { await fetch(target, { credentials: 'include' }); return false; } catch { return true; } }, url + '/api/v1/projects')).toBe(true);
  expect(await page.locator('iframe').getAttribute('sandbox')).toBe('');
  await mode(page, 'HTML').click();
  await expect(html).toHaveValue(formatted);
  await html.press('Control+Home');
  await html.press('ArrowRight');
  const caret = await html.evaluate(element => ({ start: (element as HTMLTextAreaElement).selectionStart, end: (element as HTMLTextAreaElement).selectionEnd }));
  await mode(page, 'Preview').click();
  await mode(page, 'HTML').click();
  await expect(html).toBeFocused();
  expect(await html.evaluate(element => ({ start: (element as HTMLTextAreaElement).selectionStart, end: (element as HTMLTextAreaElement).selectionEnd }))).toEqual(caret);
  await html.press('Control+End');
  await html.press('x');
  await expect(html).toHaveValue(formatted + 'x');
  await html.press('Control+z');
  await expect(html).toHaveValue(formatted);
  await html.fill(formatted.replace('Current notebook', 'Unsaved current draft'));
  await mode(page, 'Preview').click();
  await expect(frame.getByRole('heading', { name: 'Unsaved current draft' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('preview-current-pending-1280.png'), fullPage: true });
  await mode(page, 'HTML').click();
  await page.getByRole('button', { name: 'Apply HTML to draft', exact: true }).click();
  // Real model undo differs from native textarea undo.
  await page.getByRole('button', { name: '↶ Undo', exact: true }).click();
  await mode(page, 'Preview').click();
  await expect(frame.getByRole('heading', { name: 'Current notebook' })).toBeVisible();
  await mode(page, 'HTML').click();
  const stable = await html.inputValue();
  const invalid = '<script>fetch("/api/v1/projects")</script>\n' + stable;
  await html.fill(invalid);
  await expect(html).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: '▣ Save', exact: true }).click();
  await expect(page.getByText('Apply or resolve pending HTML drafts before saving. Source is retained in HTML mode.').first()).toBeVisible();
  await mode(page, 'Preview').click();
  await expect(page.getByText('Invalid HTML · last valid model draft fallback', { exact: true })).toBeVisible();
  await expect(frame.getByRole('heading', { name: 'Current notebook' })).toBeVisible();
  await mode(page, 'HTML').click();
  await page.reload();
  await expect(html).toHaveValue(invalid);
  // Switch projects and return through the UI; invalid raw HTML remains session recovered.
  await create(page, 'Separate project');
  await page.getByRole('button', { name: 'Open / Switch…', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Draft notebook/ }).click();
  await expect(html).toHaveValue(invalid);
  await html.fill(stable.replace('Current notebook', 'Local pending layout'));
  snapshot = await owner('projects/' + summary.id);
  const savedPage = snapshot.pages.find(v => v.id === p.id)!;
  expect((await command(snapshot, 'project.batch', { operations: [{ kind: 'put', entity: 'page', id: p.id, value: { ...savedPage, title: 'Remote title', document: [...savedPage.document, { kind: 'element', tag: 'p', children: [{ kind: 'text', text: 'Remote paragraph' }] }] } }] })).ok).toBe(true);
  await expect(page.getByText('Layout changed while HTML was pending.', { exact: true })).toBeVisible();
  await expect(html).toHaveValue(stable.replace('Current notebook', 'Local pending layout'));
  await page.getByRole('button', { name: 'Keep HTML placement', exact: true }).click();
  await page.getByRole('button', { name: '▣ Save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  snapshot = await owner('projects/' + summary.id);
  expect(snapshot.pages[0]?.title).toBe('Remote title');
  expect(JSON.stringify(snapshot.pages[0]?.document)).toContain('Local pending layout');
  await mode(page, 'Code').click();
  await expect(page.getByRole('heading', { name: 'Generated source · read-only ownership' })).toBeVisible();
  await mode(page, 'Live Page').click();
  await expect(page.getByText('Managed route resolution is unavailable until WP21 is integrated. Use Preview to inspect the current draft now.')).toBeVisible();
  // Roving keyboard mode tabs are real controls.
  await mode(page, 'Live Page').focus();
  await page.keyboard.press('Home');
  await expect(mode(page, 'Design')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(mode(page, 'HTML')).toBeFocused();
  await page.screenshot({ path: info.outputPath('html-1280.png'), fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mode(page, 'Design').click();
  await page.screenshot({ path: info.outputPath('design-1920.png'), fullPage: true });
  const axePath = process.env.STUDIO_AXE_SCRIPT;
  if (axePath) {
    await page.addScriptTag({ content: readFileSync(axePath, 'utf8') });
    const audit = await page.evaluate(async () => (window as unknown as { axe: { run: (options: unknown) => Promise<{ violations: unknown[] }> } }).axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
    writeFileSync(info.outputPath('axe-document-modes.json'), JSON.stringify(audit, null, 2));
    await info.attach('axe-document-modes', { body: JSON.stringify(audit), contentType: 'application/json' });
    expect(audit.violations).toEqual([]);
  }
});

test('Design literal braces and encoded HTML survive apply, save and reopen', async ({ page }, info) => {
  await connect(page);
  await create(page, 'Literal static content');
  await addPage(page, 'Literal page', '/literal');
  await page.getByRole('button', { name: 'Insert paragraph', exact: true }).click();
  await page.getByLabel('Static text 0.0', { exact: true }).fill('Literal {brace}');
  await page.getByRole('button', { name: '▣ Save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  await mode(page, 'HTML').click();
  const html = page.getByLabel('HTML source', { exact: true });
  await expect(html).toHaveValue('<p>Literal &#123;brace&#125;</p>');
  await expect(html).toHaveAttribute('aria-invalid', 'false');
  await html.fill('<p>Literal &#x7b;brace&#x7d; &amp; &#123;other&#125;</p>');
  await page.getByRole('button', { name: 'Apply HTML to draft', exact: true }).click();
  await page.getByRole('button', { name: '▣ Save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  await mode(page, 'Design').click();
  await expect(page.getByLabel('Static text 0.0', { exact: true })).toHaveValue('Literal {brace} & {other}');
  // A structural edit invokes canonical serialization rather than preserving raw source.
  await page.getByRole('button', { name: 'Insert heading', exact: true }).click();
  await page.getByRole('button', { name: '▣ Save', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  await mode(page, 'HTML').click();
  const canonical = '<p>Literal &#123;brace&#125; &amp; &#123;other&#125;</p><h1>New heading</h1>';
  await expect(html).toHaveValue(canonical);
  await expect(html).toHaveAttribute('aria-invalid', 'false');
  const summary = (await owner('projects?approvedRoot=projects')).find((value: { name: string }) => value.name === 'Literal static content');
  const persisted: Project = await owner('projects/' + summary.id);
  expect(persisted.pages[0]?.document).toEqual([
    { kind: 'element', tag: 'p', children: [{ kind: 'text', text: 'Literal {brace} & {other}' }] },
    { kind: 'element', tag: 'h1', children: [{ kind: 'text', text: 'New heading' }] },
  ]);
  await page.reload();
  await expect(html).toHaveValue(canonical);
  await expect(html).toHaveAttribute('aria-invalid', 'false');
  await create(page, 'Separate literal project');
  await page.getByRole('button', { name: 'Open / Switch…', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Literal static content/ }).click();
  await expect(html).toHaveValue(canonical);
  await expect(html).toHaveAttribute('aria-invalid', 'false');
  await mode(page, 'Preview').click();
  await expect(page.frameLocator('iframe').getByText('Literal {brace} & {other}', { exact: true })).toBeVisible();
  await mode(page, 'HTML').click();
  await page.screenshot({ path: info.outputPath('literal-braces-html-reopened.png'), fullPage: true });
  const dynamic = canonical + '<p>{serverHook()}</p>';
  await html.fill(dynamic);
  await expect(html).toHaveAttribute('aria-invalid', 'true');
  await expect(html).toHaveValue(dynamic);
  await expect(page.getByRole('button', { name: 'Apply HTML to draft', exact: true })).toBeDisabled();
});

test('native 200 percent zoom retains keyboard authoring and scrollable modes', async ({}, info) => {
  test.setTimeout(90000);
  const profile = mkdtempSync(join(root, 'native-zoom-profile-'));
  mkdirSync(join(profile, 'Default'));
  writeFileSync(join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(2) / Math.log(1.2) } } }));
  const context = await chromium.launchPersistentContext(profile, { headless: true, channel: 'chromium', viewport: { width: 1280, height: 800 }, args: ['--window-size=1280,800', '--force-device-scale-factor=1', '--no-sandbox'] });
  try {
    const page = context.pages()[0]!;
    await connect(page);
    await create(page, 'Native zoom document');
    await addPage(page, 'Zoom page', '/zoom');
    await mode(page, 'HTML').click();
    await page.getByLabel('HTML source', { exact: true }).fill('<h1>Native zoom content</h1>');
    await page.getByRole('button', { name: 'Apply HTML to draft', exact: true }).click();
    await mode(page, 'Preview').click();
    await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Native zoom content' })).toBeVisible();
    const metrics = await page.evaluate(() => ({ innerWidth, innerHeight, devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom, viewportScale: visualViewport?.scale }));
    expect(metrics).toMatchObject({ innerWidth: 640, innerHeight: 400, devicePixelRatio: 2, cssZoom: '1', viewportScale: 1 });
    writeFileSync(info.outputPath('native-zoom-metrics.json'), JSON.stringify(metrics, null, 2));
    await info.attach('native-zoom-metrics', { body: JSON.stringify(metrics), contentType: 'application/json' });
    await page.getByRole('button', { name: 'Explorer', exact: true }).click();
    await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    await page.screenshot({ path: info.outputPath('preview-native-200-full.png'), scale: 'device', fullPage: true });
    await mode(page, 'Preview').focus();
    await page.screenshot({ path: info.outputPath('preview-native-200.png'), scale: 'device' });
  } finally { await context.close(); }
});

test('WP20 and WP21 final full-mode integration acceptance', () => {
  test.skip(true, 'Acceptance gated: WP20 must supply approved generated source/extension editor and WP21 managed route resolver. Capability states are tested above; full integration is not yet implemented.');
});
