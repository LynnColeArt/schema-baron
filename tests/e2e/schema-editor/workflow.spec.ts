import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createId } from '@schema-baron/model';
import type { Project, Table } from '@schema-baron/model';
test.setTimeout(90000);
test.use({
  trace: 'off',
  viewport: {
    width: 1280,
    height: 800
  }
});
let root: string, url: string, capability: string, child: ReturnType<typeof spawn>, exit: Promise<unknown>, mcp: Client;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wp08-browser-'));
  capability = randomBytes(32).toString('base64url');
  const config = join(root, 'owner.json');
  writeFileSync(config, JSON.stringify({
    ownerId: 'schema-test',
    capability,
    metadataRoot: join(root, 'metadata'),
    approvedRoots: {
      projects: join(root, 'definitions')
    }
  }), {
    mode: 0o600
  });
  child = spawn(process.execPath, [resolve('apps/studio/dist/main.js')], {
    env: {
      ...process.env,
      PORT: '0',
      SCHEMA_BARON_OWNER_CONFIG: config
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  exit = once(child, 'exit');
  url = await new Promise<string>((resolve, reject) => {
    let logs = '';
    const timeout = setTimeout(() => reject(new Error('Owner readiness timeout')), 20000);
    child.stderr!.on('data', chunk => {
      logs += String(chunk);
      const match = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]!);
      }
    });
    child.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Owner exited before readiness'));
    });
  });
  const configMcp = join(root, 'mcp.json');
  writeFileSync(configMcp, JSON.stringify({
    ownerUrl: url,
    capability
  }), {
    mode: 0o600
  });
  mcp = new Client({
    name: 'schema-browser-parity',
    version: '1'
  });
  await mcp.connect(new StdioClientTransport({
    command: process.execPath,
    args: [resolve('apps/mcp/dist/main.js')],
    env: {
      SCHEMA_BARON_MCP_CONFIG: configMcp
    },
    stderr: 'pipe'
  }));
});
test.afterAll(async () => {
  await mcp?.close();
  child?.kill('SIGTERM');
  const timeout = setTimeout(() => child?.kill('SIGKILL'), 5000);
  await exit;
  clearTimeout(timeout);
  if (root) rmSync(root, {
    recursive: true,
    force: true
  });
});
async function snapshot(id: string): Promise<Project> {
  const response = await fetch(`${url}/api/v1/projects/${id}`, {
    headers: {
      authorization: `Bearer ${capability}`
    }
  });
  const live = (await response.json()).result as Project;
  const result = await mcp.callTool({
    name: 'project_inspect',
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: live.revision,
      input: {}
    }
  });
  const outcome = result.structuredContent as {
    ok: boolean;
    result: Project;
  };
  expect(outcome.ok).toBe(true);
  expect(outcome.result).toEqual(live);
  return outcome.result;
}
async function start(page: Page, name: string) {
  await page.goto(url);
  const owner = page.getByLabel('Studio service owner key');
  await expect(owner).toBeVisible();
  {
    await owner.fill(capability);
    await page.getByRole('button', {
      name: 'Connect',
      exact: true
    }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await page.getByRole('button', {
    name: 'New project…',
    exact: true
  }).click();
  await page.getByLabel('Project name', {
    exact: true
  }).fill(name);
  await page.getByRole('button', {
    name: 'Create project',
    exact: true
  }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const response = await fetch(url + '/api/v1/projects?approvedRoot=projects', {
    headers: {
      authorization: `Bearer ${capability}`
    }
  });
  const list = (await response.json()).result as Project[];
  return list.find(p => p.name === name)!.id;
}
async function table(page: Page, name: string) {
  await page.getByRole('button', {
    name: '＋ Table',
    exact: true
  }).click();
  await page.getByLabel('Table name', {
    exact: true
  }).fill(name);
}
async function column(page: Page, name: string, type = 'text', nullable = true) {
  await page.getByRole('button', {
    name: '＋ Column',
    exact: true
  }).click();
  await page.getByLabel('Column name', {
    exact: true
  }).fill(name);
  await page.getByLabel('Logical type', {
    exact: true
  }).selectOption(type);
  await page.getByLabel('Allow NULL', {
    exact: true
  }).setChecked(nullable);
}
async function tab(page: Page, name: string) {
  await page.getByRole('tab', {
    name,
    exact: true
  }).click();
}
async function save(page: Page) {
  await page.getByRole('button', {
    name: 'Save schema',
    exact: true
  }).click();
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('Schema definition saved');
}
test('blank SQLite is authored visibly with constraints and ordered composite FK, preview/cancel is read-only; drafts and layout survive reload and MCP changes', async ({
  page
}, info) => {
  const id = await start(page, 'Schema authoring');
  await page.getByRole('button', {
    name: 'Connections…',
    exact: true
  }).click();
  await page.getByLabel('Database choice').selectOption('empty');
  await page.getByLabel('Relative SQLite file').fill('authored.sqlite');
  await page.getByRole('button', {
    name: 'Inspect SQLite file'
  }).click();
  await expect(page.getByText('0 tables · 0 read-only unsupported objects')).toBeVisible();
  await page.getByRole('button', {
    name: 'Bind inspected database'
  }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', {
    name: 'Schema',
    exact: true
  }).click();
  await table(page, 'parent');
  await column(page, 'tenant', 'text', false);
  await column(page, 'code', 'integer', false);
  await tab(page, 'Keys');
  await page.getByLabel('tenant', {
    exact: true
  }).check();
  await page.getByLabel('code', {
    exact: true
  }).check();
  await table(page, 'child');
  await column(page, 'id', 'integer', false);
  await column(page, 'tenant', 'text', false);
  await column(page, 'code', 'integer', false);
  await column(page, 'quantity', 'integer', false);
  await page.getByLabel('Default literal', {
    exact: true
  }).fill('wrong');
  await expect(page.getByRole('alert').filter({
    hasText: 'Invalid default'
  })).toContainText('Invalid default');
  await page.getByLabel('Default literal', {
    exact: true
  }).fill('0');
  await tab(page, 'Keys');
  await page.getByLabel('id', {
    exact: true
  }).check();
  await tab(page, 'Constraints');
  await page.getByLabel('id', {
    exact: true
  }).check();
  await page.getByRole('button', {
    name: 'Add unique constraint',
    exact: true
  }).click();
  await page.getByLabel('Check column').selectOption({
    label: 'quantity'
  });
  await page.getByLabel('Check literal').fill('0');
  await page.getByRole('button', {
    name: 'Add check constraint',
    exact: true
  }).click();
  await tab(page, 'Indexes');
  await page.getByLabel('Index name').fill('child_parent_lookup');
  await page.getByLabel('tenant', {
    exact: true
  }).check();
  await page.getByLabel('code', {
    exact: true
  }).check();
  await page.getByRole('button', {
    name: 'Add index',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '＋ Relationship',
    exact: true
  }).click();
  await page.getByLabel('Local table', {
    exact: true
  }).selectOption({
    label: 'child'
  });
  await page.getByLabel('Referenced table', {
    exact: true
  }).selectOption({
    label: 'parent'
  });
  await page.getByLabel('Local column 1', {
    exact: true
  }).selectOption({
    label: 'tenant'
  });
  await page.getByLabel('Referenced column 1', {
    exact: true
  }).selectOption({
    label: 'tenant'
  });
  await page.getByRole('button', {
    name: 'Add ordered pair'
  }).click();
  await page.getByLabel('Local column 2', {
    exact: true
  }).selectOption({
    label: 'code'
  });
  await page.getByLabel('Referenced column 2', {
    exact: true
  }).selectOption({
    label: 'code'
  });
  await page.getByLabel('Referenced column 2', {
    exact: true
  }).selectOption({
    label: 'tenant'
  });
  await page.getByRole('button', {
    name: 'Add relationship draft',
    exact: true
  }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('distinct');
  await page.getByLabel('Referenced column 2', {
    exact: true
  }).selectOption({
    label: 'code'
  });
  await page.getByLabel('On delete').selectOption('cascade');
  await page.getByRole('button', {
    name: 'Add relationship draft'
  }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await save(page);
  const authored = await snapshot(id),
    parent = authored.schema.tables.find(t => t.physicalName === 'parent')!,
    childTable = authored.schema.tables.find(t => t.physicalName === 'child')!;
  expect(parent.primaryKey).toEqual(parent.columns.map(c => c.id));
  expect(childTable.foreignKeys[0]).toMatchObject({
    columnIds: childTable.columns.slice(1, 3).map(c => c.id),
    referencedColumnIds: parent.primaryKey,
    onDelete: 'cascade'
  });
  expect(childTable.checks).toHaveLength(1);
  expect(childTable.uniqueConstraints).toHaveLength(1);
  expect(childTable.indexes[0]!.columnIds).toEqual(childTable.foreignKeys[0]!.columnIds);
  const semanticBefore = await snapshot(id);
  const sourceHandle = page.locator(`.react-flow__node[data-id="${childTable.id}"] .source[data-handleid="${childTable.columns[1]!.id}"]`),
    targetHandle = page.locator(`.react-flow__node[data-id="${parent.id}"] .target[data-handleid="${parent.columns[0]!.id}"]`);
  const sourceBox = await sourceHandle.boundingBox(),
    targetBox = await targetHandle.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox!.x + 5, sourceBox!.y + 5);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + 5, targetBox!.y + 5, {
    steps: 12
  });
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Local column 1', {
    exact: true
  })).toHaveValue(childTable.columns[1]!.id);
  await page.getByRole('button', {
    name: 'Cancel',
    exact: true
  }).click();
  const node = page.locator(`.react-flow__node[data-id="${parent.id}"]`);
  const nodeBox = await node.boundingBox();
  await page.mouse.move(nodeBox!.x + 90, nodeBox!.y + 12);
  await page.mouse.down();
  await page.mouse.move(nodeBox!.x + 130, nodeBox!.y + 80, {
    steps: 12
  });
  await page.mouse.up();
  expect((await snapshot(id)).schema).toEqual(semanticBefore.schema);
  const savedPosition = await page.evaluate(id => JSON.parse(sessionStorage.getItem('studio.schema.' + id)!).positions, id);
  expect(savedPosition[parent.id]).toBeDefined();
  await page.locator('.schema-table-list').getByRole('button').filter({
    hasText: 'child'
  }).click();
  const db = new Database(join(root, 'definitions', 'authored.sqlite'), {
    readonly: true
  });
  expect(db.prepare('SELECT name FROM sqlite_schema').all()).toEqual([]);
  await page.getByRole('button', {
    name: 'Review migration…',
    exact: true
  }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('CREATE TABLE');
  // WP09 advertises apply; WP08 alone exposes a read-only review. This fresh
  // CREATE-only proposal has no required acknowledgements in either baseline.
  const capabilities = await (await fetch(url + '/api/v1/capabilities', {
    headers: { authorization: `Bearer ${capability}` }
  })).json();
  expect(capabilities.ok).toBe(true);
  const canApply = capabilities.result.operations.some((o: { operation: string }) => o.operation === 'schema.apply');
  await expect(page.getByRole('dialog').getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByRole('alert').filter({ hasText: 'This plan is stale' })).toBeHidden();
  await expect(page.getByRole('button', {
    name: 'Apply reviewed migration'
  })).toBeEnabled({ enabled: canApply });
  await page.screenshot({
    path: info.outputPath('review-1280x800.png')
  });
  const changed = await mcp.callTool({
    name: 'project_batch',
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: authored.revision,
      input: {
        operations: [{
          kind: 'put',
          entity: 'table',
          id: parent.id,
          value: {
            ...parent,
            physicalName: 'parent_remote'
          }
        }]
      }
    }
  });
  expect(changed.structuredContent).toMatchObject({
    ok: true
  });
  await expect(page.getByRole('dialog')).toContainText('This plan is stale');
  await expect(page.getByRole('button', { name: 'Apply reviewed migration' })).toBeDisabled();
  await page.getByRole('button', {
    name: 'Cancel review'
  }).click();
  expect(db.prepare('SELECT name FROM sqlite_schema').all()).toEqual([]);
  db.close();
  await page.getByLabel('Table name', {
    exact: true
  }).fill('');
  await saveInvalid(page);
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toHaveValue('');
  await page.getByRole('button', {
    name: 'Schema',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Schema',
    exact: true
  }).click();
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toHaveValue('');
  await page.getByLabel('Table name', {
    exact: true
  }).fill('child_local');
  const remote = {
    ...childTable,
    physicalName: 'child_remote'
  };
  const outcome = await mcp.callTool({
    name: 'project_batch',
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: (await snapshot(id)).revision,
      input: {
        operations: [{
          kind: 'put',
          entity: 'table',
          id: remote.id,
          value: remote
        }]
      }
    }
  });
  expect(outcome.structuredContent).toMatchObject({
    ok: true
  });
  await expect(page.getByRole('alert').filter({
    hasText: 'Service edits conflict'
  })).toContainText('Service edits conflict');
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toHaveValue('child_local');
  await page.getByRole('button', {
    name: 'Keep draft',
    exact: true
  }).click();
  await page.getByLabel('Table name', {
    exact: true
  }).focus();
  await page.keyboard.press('Control+s');
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('Schema definition saved');
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toBeFocused();
  expect((await snapshot(id)).schema.tables.find(t => t.id === childTable.id)!.physicalName).toBe('child_local');
  await page.screenshot({
    path: info.outputPath('schema-1280x800.png')
  });
  await page.setViewportSize({
    width: 1920,
    height: 1080
  });
  await page.screenshot({
    path: info.outputPath('schema-1920x1080.png')
  });
  await page.setViewportSize({
    width: 640,
    height: 400
  });
  await expect(page.getByRole('button', {
    name: '＋ Table',
    exact: true
  })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('schema-reflow-640x400.png')
  });
  await page.setViewportSize({
    width: 1280,
    height: 800
  });
  await tab(page, 'Columns');
  await page.getByLabel('Table name', {
    exact: true
  }).fill('');
  await page.locator('.schema-column-list').getByRole('button', {
    name: 'quantity · integer',
    exact: true
  }).click();
  await page.getByLabel('Default literal', {
    exact: true
  }).fill('unfinished-number');
  await page.getByRole('button', {
    name: '＋ Relationship',
    exact: true
  }).click();
  await page.getByLabel('Local table', {
    exact: true
  }).selectOption(childTable.id);
  await page.getByLabel('Referenced table', {
    exact: true
  }).selectOption({
    label: 'parent_remote'
  });
  await page.getByLabel('Local column 1', {
    exact: true
  }).selectOption({
    label: 'tenant'
  });
  await page.getByRole('button', {
    name: 'Cancel',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'New project…',
    exact: true
  }).click();
  await page.getByLabel('Project name', {
    exact: true
  }).fill('Draft parking');
  await page.getByRole('button', {
    name: 'Create project',
    exact: true
  }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', {
    name: 'Open / Switch…',
    exact: true
  }).click();
  await page.getByRole('dialog').getByRole('button').filter({
    hasText: 'Schema authoring'
  }).click();
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toHaveValue('');
  await expect(page.getByLabel('Default literal', {
    exact: true
  })).toHaveValue('unfinished-number');
  await page.reload();
  await page.getByRole('button', {
    name: 'Schema',
    exact: true
  }).click();
  await expect(page.getByLabel('Default literal', {
    exact: true
  })).toHaveValue('unfinished-number');
  await page.getByRole('button', {
    name: '＋ Relationship',
    exact: true
  }).click();
  await expect(page.getByLabel('Local column 1', {
    exact: true
  })).toHaveValue(childTable.columns[1]!.id);
  await page.getByRole('button', {
    name: 'Cancel',
    exact: true
  }).click();
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toHaveValue('');
  const protectedRaw = await page.evaluate(id => {
    const key = 'studio.schema.' + id;
    const saved = JSON.parse(sessionStorage.getItem(key)!);
    saved.drafts.broken = {
      value: 42
    };
    const raw = JSON.stringify(saved);
    sessionStorage.setItem(key, raw);
    return raw;
  }, id);
  await page.reload();
  await page.getByRole('button', {
    name: 'Schema',
    exact: true
  }).click();
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toHaveValue('');
  await expect(page.getByLabel('Default literal', {
    exact: true
  })).toHaveValue('unfinished-number');
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('Recoverable drafts were restored');
  expect(await page.evaluate(id => sessionStorage.getItem('studio.schema.' + id), id)).toBe(protectedRaw);
});
async function saveInvalid(page: Page) {
  await page.getByRole('button', {
    name: 'Save schema',
    exact: true
  }).click();
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('Correct the highlighted schema diagnostics');
}
test('50 tables and 500 columns remain searchable; 20 edits retain selection, invalid drafts and keyboard navigation', async ({
  page
}, info) => {
  const id = await start(page, 'Navigation scale');
  const project = await snapshot(id);
  const tables: Table[] = Array.from({
    length: 50
  }, (_, i) => ({
    id: createId(),
    physicalName: 'table_' + String(i).padStart(2, '0'),
    columns: Array.from({
      length: 10
    }, (_, n) => ({
      id: createId(),
      physicalName: 'column_' + n,
      type: {
        kind: 'integer'
      },
      nullable: true
    })),
    primaryKey: [],
    foreignKeys: [],
    uniqueConstraints: [],
    checks: [],
    indexes: []
  }));
  const result = await mcp.callTool({
    name: 'project_batch',
    arguments: {
      projectId: id,
      requestId: createId(),
      expectedRevision: project.revision,
      input: {
        operations: tables.map(t => ({
          kind: 'put',
          entity: 'table',
          id: t.id,
          value: t
        }))
      }
    }
  });
  expect(result.structuredContent).toMatchObject({
    ok: true
  });
  await page.getByRole('button', {
    name: 'Schema',
    exact: true
  }).click();
  await expect(page.getByText('50 tables · 500 columns', {
    exact: true
  })).toBeVisible();
  await tab(page, 'Table list');
  const durations: number[] = [];
  const begin = performance.now();
  for (let i = 0; i < 20; i++) {
    const editStart = performance.now();
    const name = 'table_' + String(i).padStart(2, '0');
    await page.getByLabel('Find table or column').fill(name);
    await page.locator('.schema-table-list').getByRole('button').click();
    await expect(page.getByLabel('Table name', {
      exact: true
    })).toHaveValue(name);
    await page.getByLabel('Table name', {
      exact: true
    }).fill(i % 2 ? 'edited_' + i : '');
    durations.push(performance.now() - editStart);
  }
  await page.getByLabel('Find table or column').fill('');
  for (let i = 0; i < 20; i++) {
    await page.locator('.schema-table-list').getByRole('button').nth(30 + i).click();
    await expect(page.getByLabel('Table name', {
      exact: true
    })).toHaveValue(i % 2 ? 'edited_' + i : '');
  }
  const metrics=JSON.stringify({
      tables: 50,
      columns: 500,
      edits: 20,
      draftLoss: 0,
      selectionLoss: 0,
      totalMs: performance.now() - begin,
      editMs: durations
    });writeFileSync(info.outputPath('scale-metrics.json'),metrics);await info.attach('scale-metrics.json',{body:metrics,contentType:'application/json'});
  await page.screenshot({
    path: info.outputPath('scale-50x500-20drafts.png')
  });
  expect((await snapshot(id)).schema.tables).toEqual(tables);
  await expect(page.getByText('20 drafts · r2', {
    exact: true
  })).toBeVisible();
});
test('destructive preview discloses exact impacts and cancellation leaves existing rows intact', async ({
  page
}, info) => {
  const db = new Database(join(root, 'definitions', 'retained.sqlite'));
  db.exec('CREATE TABLE retained (id INTEGER PRIMARY KEY, amount INTEGER NOT NULL);INSERT INTO retained VALUES(1,17),(2,29)');
  const before = db.prepare('SELECT * FROM retained').all();
  const id = await start(page, 'Destructive cancellation');
  await page.getByRole('button', {
    name: 'Connections…',
    exact: true
  }).click();
  await page.getByLabel('Relative SQLite file').fill('retained.sqlite');
  await page.getByRole('button', {
    name: 'Inspect SQLite file'
  }).click();
  await page.getByRole('button', {
    name: 'Bind inspected database'
  }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', {
    name: 'Schema',
    exact: true
  }).click();
  await page.locator('.schema-table-list').getByRole('button').click();
  await column(page, 'required_value', 'integer', false);
  await save(page);
  await page.getByRole('button', {
    name: 'Review migration…',
    exact: true
  }).click();
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('backfill');
  await page.getByText('Backfill rules (0)', {
    exact: true
  }).click();
  await page.getByLabel('Backfill column', {
    exact: true
  }).selectOption({
    label: 'retained.required_value'
  });
  await page.getByLabel('Backfill literal', {
    exact: true
  }).fill('0');
  await page.getByRole('button', {
    name: 'Set backfill rule',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Review migration…',
    exact: true
  }).click();
  await expect(page.getByRole('dialog')).toContainText('Replace values');
  await page.getByRole('button', {
    name: 'Cancel review',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Remove rule',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Delete table draft',
    exact: true
  }).click();
  await save(page);
  await page.getByRole('button', {
    name: 'Review migration…',
    exact: true
  }).click();
  await expect(page.getByRole('dialog')).toContainText('DROP TABLE');
  await expect(page.getByRole('dialog')).toContainText('2 affected rows');
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).not.toBeChecked();
  await page.setViewportSize({
    width: 640,
    height: 400
  });
  const bounds = await page.getByRole('button', {
    name: 'Cancel review',
    exact: true
  }).boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(400);
  await page.screenshot({
    path: info.outputPath('destructive-review-reflow.png')
  });
  await page.getByRole('button', {
    name: 'Cancel review',
    exact: true
  }).click();
  expect(db.prepare('SELECT * FROM retained').all()).toEqual(before);
  expect((await snapshot(id)).schema.tables).toEqual([]);
  db.close();
});
test('imported opaque view is clearly read-only and blocks unsafe migration without losing the draft', async ({
  page
}, info) => {
  const db = new Database(join(root, 'definitions', 'opaque.sqlite'));
  db.exec('CREATE TABLE guarded (id INTEGER PRIMARY KEY);CREATE VIEW guarded_view AS SELECT * FROM guarded');
  const before = db.prepare('SELECT sql FROM sqlite_schema ORDER BY name').all();
  await start(page, 'Opaque preservation');
  await page.getByRole('button', {
    name: 'Connections…',
    exact: true
  }).click();
  await page.getByLabel('Relative SQLite file').fill('opaque.sqlite');
  await page.getByRole('button', {
    name: 'Inspect SQLite file'
  }).click();
  await page.getByRole('button', {
    name: 'Bind inspected database'
  }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', {
    name: 'Schema',
    exact: true
  }).click();
  await page.getByText('Read-only imported objects (1)', {
    exact: true
  }).click();
  await expect(page.locator('.schema-explorer')).toContainText('guarded_view');
  await page.locator('.schema-table-list').getByRole('button').click();
  await page.getByLabel('Table name', {
    exact: true
  }).fill('guarded_renamed');
  await save(page);
  await page.getByRole('button', {
    name: 'Review migration…',
    exact: true
  }).click();
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('Cannot prove preservation');
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toHaveValue('guarded_renamed');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(db.prepare('SELECT sql FROM sqlite_schema ORDER BY name').all()).toEqual(before);
  await page.screenshot({
    path: info.outputPath('opaque-readonly-diagnostic.png')
  });
  db.close();
});
