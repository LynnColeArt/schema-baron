import { pinnedNpmCli, pinnedBinPath } from '../../../scripts/release/toolchain.mjs';
import { test, expect, type Page } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir, cpus, totalmem, platform, release, arch } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { exactBorrowerTotals } from './oracle.js';
import { createServer } from 'node:net';
import Database from 'better-sqlite3';
import type { Project } from '@schema-baron/model';
// All authoring uses visible controls. HTTP GETs and independent SQLite handles are read-only oracles.
// Traces are disabled: Playwright traces include password fill arguments even for masked inputs.
test.use({
  trace: 'off',
  actionTimeout: 15000,
  viewport: {
    width: 1280,
    height: 800
  }
});
test.setTimeout(600000);
let root: string, url: string, capability: string, child: ReturnType<typeof spawn>, exit: Promise<unknown>;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'equipment-visible-'));
  mkdirSync(join(root, 'definitions'));
  mkdirSync(join(root, 'outputs'));
  capability = randomBytes(32).toString('base64url');
  const config = join(root, 'owner.json');
  writeFileSync(config, JSON.stringify({
    ownerId: 'equipment-study',
    capability,
    metadataRoot: join(root, 'metadata'),
    approvedRoots: {
      projects: join(root, 'definitions'),
      output: join(root, 'outputs')
    }
  }), {
    mode: 0o600
  });
  child = spawn(process.execPath, [resolve('apps/studio/dist/main.js')], {
    detached: true,
    env: {
      ...process.env,
      PORT: '0',
      SCHEMA_BARON_BROWSER_MODE: 'capability', SCHEMA_BARON_OWNER_CONFIG: config
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  exit = once(child, 'exit');
  url = await new Promise((resolve, reject) => {
    let logs = '';
    const timer = setTimeout(() => reject(new Error('Owner readiness timeout')), 20000);
    child.stderr!.on('data', chunk => {
      logs += String(chunk);
      const found = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);
      if (found) {
        clearTimeout(timer);
        resolve(found[1]!);
      }
    });
  });
  writeFileSync(process.env.SCHEMA_BARON_EQUIPMENT_STUDY ?? join(root, 'study-location.json'), JSON.stringify({
    root,
    url,
    ownerPid: child.pid
  }, null, 2));
});
test.afterEach(async ({
  page
}, info) => {
  if (info.status !== info.expectedStatus) {
    await page.screenshot({
      path: info.outputPath('studio-failure.png'),
      mask: [page.locator('input[type=password]')]
    });
    writeFileSync(info.outputPath('studio-visible-failure.txt'), await page.locator('body').innerText());
  }
});
test.afterAll(async () => {
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
  await exit;
  // Intentionally retain disposable study project/output/data; owner config remains private 0600.
});
async function read(path: string) {
  const r = await fetch(url + '/api/v1/' + path, {
    headers: {
      authorization: `Bearer ${capability}`
    }
  });
  const result = await r.json();
  expect(result.ok).toBe(true);
  return result.result;
}
const button = (page: Page, name: string) => page.getByRole('button', {
  name,
  exact: true
});
const label = (page: Page, name: string) => page.getByLabel(name, {
  exact: true
});
async function save(page: Page) {
  await button(page, '▣ Save').click();
  await expect(page.getByRole('status')).toContainText('Saved');
}
async function schemaTable(page: Page, name: string, columns: [string, string][]) {
  await button(page, '＋ Table').click();
  await label(page, 'Table name').fill(name);
  await page.getByRole('tab', {
    name: 'Columns',
    exact: true
  }).click();
  for (const [name, type] of columns) {
    await button(page, '＋ Column').click();
    await label(page, 'Column name').fill(name);
    await label(page, 'Logical type').selectOption(type);
    await label(page, 'Allow NULL').uncheck();
  }
  await page.getByRole('tab', {
    name: 'Keys',
    exact: true
  }).click();
  await label(page, 'id').check();
}
async function foreignKey(page: Page, local: string, field: string, target: string) {
  await button(page, '＋ Relationship').click();
  await label(page, 'Local table').selectOption({
    label: local
  });
  await label(page, 'Referenced table').selectOption({
    label: target
  });
  await label(page, 'Local column 1').selectOption({
    label: field
  });
  await label(page, 'Referenced column 1').selectOption({
    label: 'id'
  });
  await label(page, 'On delete').selectOption('restrict');
  await button(page, 'Add relationship draft').click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
async function addPage(page: Page, title: string, route: string) {
  await button(page, '＋ Page').click();
  await label(page, 'Page title').fill(title);
  await label(page, 'Internal route').fill(route);
  await button(page, 'Add page').click();
  await save(page);
}
async function wizard(page: Page, kind: string, name: string, tableId: string, linked?: string) {
  await button(page, '＋ Form').click();
  await label(page, 'Form label').fill(name);
  await label(page, 'Form kind').selectOption(kind);
  if (kind !== 'Login') await page.getByRole('dialog').getByLabel('Data source', {
    exact: true
  }).selectOption('table:' + tableId);
  await button(page, 'Next').click();
  if (kind !== 'Login') {
    const fields = page.getByRole('group', {
      name: 'Fields, in selection order'
    }).getByRole('checkbox');
    for (let i = 0; i < (await fields.count()); i++) await fields.nth(i).check();
    await button(page, 'Use complete primary key').click();
  }
  await button(page, 'Next').click();
  if (linked) await label(page, 'Linked Record page').selectOption(linked);
  await button(page, 'Next').click();
  await button(page, 'Next').click();
  await button(page, 'Finish').click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
test('Equipment Desk starts blank and authors schema and forms through supported controls', async ({
  page,
  browser
}, info) => {
  writeFileSync(info.outputPath('environment.json'), JSON.stringify({
    node: process.version,
    browser: browser.version(),
    os: platform() + ' ' + release(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    memoryBytes: totalmem(),
    viewport: {
      width: 1280,
      height: 800
    },
    tracePolicy: 'off; operation-only browser response log excludes request payloads'
  }, null, 2));
  const schemaOutcomes: unknown[] = [];
  page.on('response', async response => {
    if (response.request().method() === 'POST' && response.request().postDataJSON()?.operation === 'schema.preview') {
      const outcome = await response.json();
      schemaOutcomes.push({
        ok: outcome.ok,
        error: outcome.error,
        diagnostics: outcome.diagnostics
      });
      writeFileSync(info.outputPath('schema-preview-outcomes.json'), JSON.stringify(schemaOutcomes, null, 2));
    }
  });
  const actions: {
    operation: string;
    httpStatus: number;
    at: string;
  }[] = [];
  page.on('response', response => {
    const request = response.request();
    if (request.method() === 'POST' && request.url().startsWith(url + '/api/v1/')) {
      let operation = 'owner-session-or-project-create';
      try {
        operation = request.postDataJSON()?.operation ?? operation;
      } catch {}
      actions.push({
        operation,
        httpStatus: response.status(),
        at: new Date().toISOString()
      });
      writeFileSync(info.outputPath('redacted-browser-operations.json'), JSON.stringify(actions, null, 2));
    }
  });
  await page.goto(url);
  await label(page, 'Studio service owner key').fill(capability);
  await button(page, 'Connect').click();
  await button(page, 'New project…').click();
  await label(page, 'Project name').fill('Equipment Desk');
  await button(page, 'Create project').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await button(page, 'Connections…').click();
  await label(page, 'Database choice').selectOption('empty');
  await label(page, 'Relative SQLite file').fill('equipment.sqlite');
  await button(page, 'Inspect SQLite file').click();
  await expect(page.getByText('0 tables · 0 read-only unsupported objects')).toBeVisible();
  await button(page, 'Bind inspected database').click();
  await button(page, 'Schema').click();
  await schemaTable(page, 'assets', [['id', 'integer'], ['label', 'text'], ['daily_rate', 'decimal']]);
  await schemaTable(page, 'borrowers', [['id', 'integer'], ['name', 'text'], ['email', 'text']]);
  await page.getByRole('tab', {
    name: 'Constraints',
    exact: true
  }).click();
  await label(page, 'email').check();
  await button(page, 'Add unique constraint').click();
  await schemaTable(page, 'loans', [['id', 'integer'], ['borrower_id', 'integer'], ['asset_id', 'integer'], ['starts_on', 'date'], ['status', 'text']]);
  await schemaTable(page, 'loan_lines', [['id', 'integer'], ['loan_id', 'integer'], ['description', 'text'], ['quantity', 'integer'], ['unit_price', 'decimal']]);
  await foreignKey(page, 'loans', 'borrower_id', 'borrowers');
  await foreignKey(page, 'loans', 'asset_id', 'assets');
  await foreignKey(page, 'loan_lines', 'loan_id', 'loans');
  await button(page, 'Save schema').click();
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('Schema definition saved');
  const db = new Database(join(root, 'definitions', 'equipment.sqlite'), {
    readonly: true
  });
  expect(db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all()).toEqual([]);
  await button(page, 'Review migration…').click();
  await expect(page.getByRole('dialog')).toContainText('CREATE TABLE');
  await page.screenshot({
    path: info.outputPath('schema-review.png')
  });
  await button(page, 'Apply reviewed migration').click();
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('Migration committed');
  expect(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('assets','borrowers','loans','loan_lines') ORDER BY name").all()).toEqual([{
    name: 'assets'
  }, {
    name: 'borrowers'
  }, {
    name: 'loan_lines'
  }, {
    name: 'loans'
  }]);
  expect(db.prepare('PRAGMA foreign_key_list(loans)').all()).toHaveLength(2);
  expect(db.prepare('PRAGMA foreign_key_list(loan_lines)').all()).toHaveLength(1);
  db.close();
  const summary = (await read('projects?approvedRoot=projects'))[0];
  const snapshot = async (): Promise<Project> => read('projects/' + summary.id);
  await button(page, 'Schema').click();
  for (const [name, route] of [['Assets', '/'], ['Borrowers', '/borrowers'], ['Loans', '/loans'], ['Lines', '/lines'], ['Edit asset', '/asset'], ['Edit borrower', '/borrower'], ['Edit loan', '/loan'], ['Edit line', '/line'], ['Login', '/login']]) await addPage(page, name!, route!);
  let p = await snapshot();
  for (const [tableName, title, recordRoute] of [['assets', 'Assets', '/asset'], ['borrowers', 'Borrowers', '/borrower'], ['loans', 'Loans', '/loan'], ['loan_lines', 'Lines', '/line']]) {
    await page.getByRole('treeitem').filter({
      hasText: title!
    }).first().dblclick();
    await wizard(page, 'Grid', title + ' list', p.schema.tables.find(t => t.physicalName === tableName)!.id, p.pages.find(q => q.route === recordRoute)!.id);
  }
  p = await snapshot();
  expect(p.forms.filter(f => f.kind === 'Grid')).toHaveLength(4);
  expect(p.forms.filter(f => f.kind === 'Record')).toHaveLength(4);
  writeFileSync(info.outputPath('authored-project.json'), JSON.stringify(p, null, 2));
  await page.screenshot({
    path: info.outputPath('visible-forms.png')
  });
  await addPage(page, 'Asset search', '/search');
  await wizard(page, 'Search', 'Asset search', p.schema.tables.find(t => t.physicalName === 'assets')!.id);
  // Ordinary Properties configure search, child filters and return destinations.
  const select = async (id: string) => {
    await page.locator(`[role=treeitem][data-object-id="${id}"]`).dblclick();
    await page.getByRole('tab', {
      name: 'Data',
      exact: true
    }).click();
  };
  for (const tableName of ['assets', 'borrowers', 'loans', 'loan_lines']) {
    p = await snapshot();
    const table = p.schema.tables.find(t => t.physicalName === tableName)!;
    const grid = p.forms.find(f => f.kind === 'Grid' && f.sourceRef?.id === table.id)!;
    const record = p.forms.find(f => f.kind === 'Record' && f.sourceRef?.id === table.id)!;
    await select(grid.id);
    const searchField = table.columns.find(c => ['label', 'name', 'description', 'status'].includes(c.physicalName))!;
    await label(page, 'Search ' + searchField.physicalName).selectOption('contains');
    if (tableName === 'loans') await label(page, 'Search borrower_id').selectOption('eq');
    if (tableName === 'loan_lines') await label(page, 'Search loan_id').selectOption('eq');
    await save(page);
    await select(record.id);
    await page.getByRole('group', {
      name: 'Record name fields for delete confirmation'
    }).getByLabel(searchField.physicalName, {
      exact: true
    }).check();
    for (const op of ['insert', 'update', 'delete']) await label(page, op + ' success page').selectOption(grid.pageId);
    await label(page, 'cancel destination page').selectOption(grid.pageId);
    await save(page);
  }
  // Visibly compose Login, provision a managed visitor, protect writes and show identity headers.
  p = await snapshot();
  await select(p.pages.find(q => q.route === '/login')!.id);
  await wizard(page, 'Login', 'Visitor access', '');
  p = await snapshot();
  const loginForm = p.forms.find(form => form.kind === 'Login')!;
  await select(loginForm.id);
  await label(page, 'cancel destination page').selectOption(p.pages.find(page => page.route === '/lines')!.id);
  await save(page);
  for (const [operation, name] of [['login', 'Sign in'], ['logout', 'Sign out']]) {
    const action = p.actions.find(a => a.operation === operation)!;
    const control = p.controls.find(c => c.events.some(e => e.actionId === action.id))!;
    await select(control.id);
    await page.getByRole('tab', {
      name: 'Format',
      exact: true
    }).click();
    await label(page, 'Label').fill(name!);
    await save(page);
  }
  await button(page, 'Login and access…').click();
  await button(page, 'Save identity source').click();
  await expect(page.getByText('Security settings saved.', {
    exact: true
  })).toBeVisible();
  await expect(label(page, 'Global default')).toHaveValue('public');
  await label(page, 'Policy page').selectOption(loginForm.pageId);
  await label(page, 'Page access').selectOption('public');
  const username = 'equipment-librarian',
    secret = randomBytes(32).toString('base64url');
  await label(page, 'Visitor username').fill(username);
  await label(page, 'Visitor password').fill(secret);
  await button(page, 'Provision user').click();
  await expect(page.getByText('User provisioned. Credentials were cleared.', {
    exact: true
  })).toBeVisible();
  p = await snapshot();
  for (const form of p.forms.filter(f => f.kind === 'Grid' || f.kind === 'Record')) {
    await label(page, 'Header form').selectOption(form.id);
    await button(page, 'Place identity in page header').click();
    await expect.poll(async () => (await snapshot()).controls.filter(c => c.formId === form.id && c.kind === 'identity' && !c.credentialRole).length).toBe(1);
  }
  for (const form of p.forms.filter(f => f.kind === 'Record')) {
    await label(page, 'Policy page').selectOption(form.pageId);
    await label(page, 'Page access').selectOption('authenticated');
    for (const a of p.actions.filter(a => a.formId === form.id && ['insert', 'update', 'delete'].includes(a.operation))) {
      await label(page, `Access for ${a.operation} ${a.id}`).selectOption('authenticated');
      await expect.poll(async () => (await snapshot()).policies.find(q => q.ownerId === a.id)?.access).toBe('authenticated');
    }
  }
  await page.screenshot({
    path: info.outputPath('security.png')
  });
  await button(page, 'Close').click();
  // Author a reusable grouped child query first, avoiding fanout by its complete loan grain.
  await button(page, 'Queries').click();
  const kind = async (name: string, value: string) => label(page, name + ' kind').selectOption(value);
  const field = async (name: string, value: string) => {
    await kind(name, 'field');
    await label(page, name + ' field').selectOption({
      label: value
    });
  };
  const section = async (name: string) => page.getByRole('navigation', {
    name: 'Query sections'
  }).getByRole('button', {
    name,
    exact: true
  }).click();
  const projection = async (i: number, name: string, value: string) => {
    await button(page, 'Add projection').click();
    await label(page, `Projection ${i} name`).fill(name);
    await field(`Projection ${i}`, value);
  };
  const queryStart = async (name: string) => {
    await button(page, 'New query').click();
    await label(page, 'Query name').fill(name);
  };
  const querySave = async () => {
    await button(page, 'Run preview').click();
    await expect(page.getByRole('status').filter({
      hasText: 'Preview complete'
    })).toBeVisible();
    await button(page, 'Save query').click();
    await expect(page.getByRole('status').filter({
      hasText: 'Query saved'
    })).toBeVisible();
  };
  await queryStart('Loan totals');
  await label(page, 'Add source').selectOption({
    label: 'table: loan_lines'
  });
  await label(page, 'Source 1 alias').fill('x');
  await section('Fields');
  await label(page, 'Aggregate grain').selectOption('grouped');
  await projection(1, 'loan_id', 'x.loan_id');
  await button(page, 'Group by projection 1').click();
  await page.getByRole('checkbox', {
    name: 'loan_id',
    exact: true
  }).check();
  await button(page, 'Add projection').click();
  await label(page, 'Projection 2 name').fill('total');
  await kind('Projection 2', 'aggregate');
  await kind('Projection 2 argument', 'binary');
  await label(page, 'Projection 2 argument operator').selectOption('*');
  await field('Projection 2 argument left', 'x.unit_price');
  await field('Projection 2 argument right', 'x.quantity');
  await querySave();
  await queryStart('Borrower totals');
  for (const [i, table, alias] of [[1, 'borrowers', 'b'], [2, 'loans', 'l']] as const) {
    await label(page, 'Add source').selectOption({
      label: 'table: ' + table
    });
    await label(page, `Source ${i} alias`).fill(alias);
  }
  await label(page, 'Add source').selectOption({
    label: 'query: Loan totals'
  });
  await label(page, 'Source 3 alias').fill('x');
  for (const [i, left, right, lf, rf, cardinality] of [[1, 'b', 'l', 'b.id', 'l.borrower_id', 'one-to-many'], [2, 'l', 'x', 'l.id', 'x.loan_id', 'one-to-one']] as const) {
    await button(page, 'Add join').click();
    await label(page, `Join ${i} leftAlias`).selectOption(left);
    await label(page, `Join ${i} rightAlias`).selectOption(right);
    await label(page, `Join ${i} kind`).selectOption('left');
    await label(page, `Join ${i} cardinality`).selectOption(cardinality);
    await kind(`Join ${i} condition`, 'binary');
    await field(`Join ${i} condition left`, lf);
    await field(`Join ${i} condition right`, rf);
  }
  await section('Fields');
  await label(page, 'Aggregate grain').selectOption('grouped');
  for (const [i, name, value] of [[1, 'borrower_id', 'b.id'], [2, 'borrower', 'b.name']] as const) {
    await projection(i, name, value);
    await button(page, `Group by projection ${i}`).click();
    await page.getByRole('checkbox', {
      name,
      exact: true
    }).check();
  }
  const total = async (name: string) => {
    await kind(name, 'aggregate');
    await field(name + ' argument', 'x.total');
  };
  await button(page, 'Add projection').click();
  await label(page, 'Projection 3 name').fill('total');
  await total('Projection 3');
  await section('Parameters');
  await button(page, 'Add parameter').click();
  await label(page, 'Parameter 1 name').fill('minimum');
  await label(page, 'Parameter 1 type').selectOption('decimal');
  await label(page, 'Parameter 1 type rounding').selectOption('half-even');
  await page.getByRole('checkbox', {
    name: 'Has default',
    exact: true
  }).check();
  await label(page, 'Parameter 1 default').fill('0.00');
  await section('Fields');
  await button(page, 'Add having').click();
  await kind('HAVING', 'binary');
  await label(page, 'HAVING operator').selectOption('>=');
  await total('HAVING left');
  await kind('HAVING right', 'parameter');
  await label(page, 'HAVING right parameter').selectOption({
    label: 'minimum'
  });
  await querySave();
  await button(page, 'Return to page').click();
  await addPage(page, 'Borrower report', '/report');
  p = await snapshot();
  const q = p.queries.find(q => q.name === 'Borrower totals')!;
  await button(page, '＋ Form').click();
  await label(page, 'Form label').fill('Borrower totals report');
  await label(page, 'Form kind').selectOption('Grid');
  await page.getByRole('dialog').getByLabel('Data source', {
    exact: true
  }).selectOption('query:' + q.id);
  await button(page, 'Next').click();
  for (const box of await page.getByRole('group', {
    name: 'Fields, in selection order'
  }).getByRole('checkbox').all()) await box.check();
  for (let i = 0; i < 3; i++) await button(page, 'Next').click();
  await button(page, 'Finish').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  // Create ordinary navigation actions, then bind displayed controls through Events.
  const childLink = async (formId: string, controlFieldId: string, pageId: string, targetFieldId: string, sourceFieldId: string) => {
    await select(formId);
    await button(page, 'Add action').click();
    await label(page, 'cancel operation').selectOption('navigate');
    const actionGroup = page.getByRole('group', {
      name: 'Action: navigate',
      exact: true
    }).last();
    await actionGroup.getByLabel('navigate destination page', {
      exact: true
    }).selectOption(pageId);
    await actionGroup.getByRole('group', {
      name: 'destination',
      exact: true
    }).getByRole('button', {
      name: 'Add filter mapping',
      exact: true
    }).click();
    await actionGroup.getByLabel('navigate destination filterMapping target 1', {
      exact: true
    }).selectOption(targetFieldId);
    await actionGroup.getByLabel('navigate destination filterMapping source 1', {
      exact: true
    }).selectOption(sourceFieldId);
    await save(page);
    p = await snapshot();
    const action = p.actions.find(a => a.formId === formId && a.destination?.pageId === pageId)!;
    const control = p.controls.find(c => c.formId === formId && c.binding?.kind === 'stored' && c.binding.fieldId === controlFieldId)!;
    await select(control.id);
    await label(page, 'Control type').selectOption('link');
    await page.getByRole('tab', {
      name: 'Events',
      exact: true
    }).click();
    await button(page, 'Add event').click();
    await label(page, 'Event action 1').selectOption(action.id);
    await save(page);
    return action;
  };
  p = await snapshot();
  const loan = p.schema.tables.find(t => t.physicalName === 'loans')!,
    borrower = p.schema.tables.find(t => t.physicalName === 'borrowers')!,
    line = p.schema.tables.find(t => t.physicalName === 'loan_lines')!;
  const gridFor = (id: string) => p.forms.find(f => f.kind === 'Grid' && f.sourceRef?.id === id)!;
  const report = p.forms.find(f => f.sourceRef?.id === q.id)!;
  await select(report.id);
  await label(page, 'Input source minimum').selectOption('runtime');
  await label(page, 'Runtime name minimum').fill('minimum');
  await save(page);
  const reportLink = await childLink(report.id, q.projections.find(f => f.name === 'borrower')!.id, gridFor(loan.id).pageId, loan.columns.find(c => c.physicalName === 'borrower_id')!.id, q.projections.find(f => f.name === 'borrower_id')!.id);
  await childLink(gridFor(borrower.id).id, borrower.columns.find(c => c.physicalName === 'name')!.id, gridFor(loan.id).pageId, loan.columns.find(c => c.physicalName === 'borrower_id')!.id, borrower.columns[0]!.id);
  await childLink(gridFor(loan.id).id, loan.columns.find(c => c.physicalName === 'status')!.id, gridFor(line.id).pageId, line.columns.find(c => c.physicalName === 'loan_id')!.id, loan.columns[0]!.id);
  await button(page, 'Flow map').click();
  const map = page.getByRole('tabpanel', {
    name: 'Application flow map'
  });
  await map.locator('summary').filter({
    hasText: 'Keyboard behavior list'
  }).click();
  await map.getByRole('group', {
    name: 'Selectable behavior list'
  }).getByRole('button', {
    name: new RegExp('destination.*' + reportLink.id)
  }).first().click();
  await expect(page.getByText('Action Properties', {
    exact: true
  })).toBeVisible();
  await expect(label(page, 'navigate destination filterMapping target 1')).toHaveValue(loan.columns.find(c => c.physicalName === 'borrower_id')!.id);
  await page.screenshot({
    path: info.outputPath('flow-properties.png')
  });
  p = await snapshot();
  const mappedLineRecord = p.forms.find(form => form.kind === 'Record' && form.sourceRef?.id === line.id)!;
  for (const [action, slot] of [[p.actions.find(a => a.formId === mappedLineRecord.id && a.operation === 'update')!, 'success'], [p.actions.find(a => a.formId === mappedLineRecord.id && a.operation === 'cancel')!, 'destination'], [p.actions.find(a => a.formId === loginForm.id && a.operation === 'cancel')!, 'destination']] as const) {
    if ((await map.locator('details.flow-list').getAttribute('open')) === null) await map.locator('summary').filter({
      hasText: 'Keyboard behavior list'
    }).click();
    await map.getByRole('group', {
      name: 'Selectable behavior list'
    }).getByRole('button', {
      name: new RegExp(slot + '.*' + action.id)
    }).click();
    await expect(label(page, action.operation + ' ' + slot + ' page')).toHaveValue(gridFor(line.id).pageId);
  }
  await page.screenshot({
    path: info.outputPath('flow-save-cancel-properties.png')
  });
  await button(page, 'Flow map').click();
  // Declare both authored modules in the actual Code editor.
  await page.getByRole('tab', {
    name: 'Code',
    exact: true
  }).click();
  await page.getByText('Declare authored hook', {
    exact: true
  }).click();
  for (const hook of ['validator', 'action']) {
    await label(page, 'Hook kind').selectOption(hook);
    await label(page, 'Module name').fill('equipment-' + hook);
    await button(page, 'Declare hook').click();
    await expect(label(page, 'Source module').locator('option').filter({
      hasText: 'authored/equipment-' + hook + '.ts'
    })).toHaveCount(1);
  }
  p = await snapshot();
  const lineTable = p.schema.tables.find(t => t.physicalName === 'loan_lines')!,
    lineRecord = p.forms.find(f => f.kind === 'Record' && f.sourceRef?.id === lineTable.id)!;
  await select(lineRecord.id);
  await label(page, 'update source hook').selectOption(p.extensionContracts.find(c => c.kind === 'action')!.id);
  await save(page);
  let generationCycle = 0;
  const generate = async () => {
    await button(page, 'Generate…').click();
    await label(page, 'Output location').fill('output:app');
    await button(page, 'Preview files').click();
    await expect(page.getByRole('dialog')).toContainText(/\d+ files to create\/change\/delete or preserve/);
    writeFileSync(info.outputPath('generation-review-' + generationCycle + '.txt'), await page.getByRole('dialog').innerText());
    generationCycle++;
    for (const box of await page.getByRole('dialog').getByRole('checkbox').all()) await box.check();
    await button(page, 'Create application').click();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created');
    await button(page, 'Close').click();
  };
  await generate();
  await page.getByRole('tab', {
    name: 'Code',
    exact: true
  }).click();
  p = await snapshot();
  const description = lineTable.columns.find(c => c.physicalName === 'description')!.id;
  const expectedSources: Record<string, string> = {};
  for (const contract of p.extensionContracts) {
    await label(page, 'Source module').selectOption(contract.id);
    await button(page, 'Read source').click();
    await expect(label(page, 'Source code')).toHaveValue(new RegExp('Authored ' + contract.kind + ' interface'));
    const source = await label(page, 'Source code').inputValue();
    const expression = contract.kind === 'validator' ? `(context) => context.values[${JSON.stringify(description)}] === 'forbidden' ? {[${JSON.stringify(description)}]:'Equipment validator rejected this description.'} : ({})` : `(context) => {if(context.values[${JSON.stringify(description)}] === 'action-fail') throw Error('Equipment action rejected this description.');}`;
    const custom = source.replace(contract.kind === 'validator' ? '(_context) => ({})' : '(_context) => {}', expression);
    expect(custom).not.toBe(source);
    await label(page, 'Source code').fill(custom);
    await button(page, 'Save authored source').click();
    await expect(button(page, 'Save authored source')).toBeEnabled();
    expectedSources[contract.relativePath] = custom;
  }
  const output = join(root, 'outputs', 'app'),
    npm = pinnedNpmCli;
  const installed = spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--offline'], {
    cwd: output,
    encoding: 'utf8',
    timeout: 120000
  });
  writeFileSync(info.outputPath('output-install.log'), installed.stdout + installed.stderr);
  expect(installed.status).toBe(0);
  for (const script of ['typecheck', 'test']) {
    const checked = spawnSync(process.execPath, [npm, 'run', script], {
      cwd: output,
      encoding: 'utf8',
      timeout: 120000
    });
    writeFileSync(info.outputPath('output-' + script + '.log'), checked.stdout + checked.stderr);
    expect(checked.status).toBe(0);
  }
  await button(page, 'Build generated output').click();
  await expect(button(page, 'Start / retry')).toBeEnabled({
    timeout: 120000
  });
  const port = await new Promise<number>(resolve => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const selected = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(selected));
    });
  });
  await label(page, 'Runtime port').fill(String(port));
  await button(page, 'Start / retry').click();
  await expect(page.getByRole('region', {
    name: 'Managed generated runtime'
  }).locator('strong').first()).toHaveText('Generated runtime · running', {
    timeout: 30000
  });
  const origin = 'http://127.0.0.1:' + port,
    visitor = await browser.newContext({
      viewport: {
        width: 1280,
        height: 800
      }
    }),
    app = await visitor.newPage();
  app.on('response', response => {
    if (response.request().method() === 'POST') {
      actions.push({
        operation: 'generated-ui ' + new URL(response.url()).pathname,
        httpStatus: response.status(),
        at: new Date().toISOString()
      });
      writeFileSync(info.outputPath('redacted-browser-operations.json'), JSON.stringify(actions, null, 2));
    }
  });
  await app.goto(origin + '/');
  await expect(app.getByText('No records', {
    exact: false
  })).toBeVisible();
  await app.goto(origin + '/line');
  await expect(app.getByText('Sign in to continue to the selected page.', {
    exact: false
  })).toBeVisible();
  await label(app, 'Username').fill(username);
  await label(app, 'Password').fill('incorrect trial');
  await button(app, 'Sign in').click();
  await expect(app.getByText('Sign in failed. Try again later.', {
    exact: true
  })).toBeVisible();
  await expect(label(app, 'Password')).toHaveValue('');
  await label(app, 'Password').fill(secret);
  await button(app, 'Sign in').click();
  await expect(app).toHaveURL(/\/line/);
  const rows = () => {
    const oracle = new Database(join(root, 'definitions', 'equipment.sqlite'), {
      readonly: true
    });
    try {
      return {
        assets: oracle.prepare('SELECT * FROM assets ORDER BY id').all(),
        borrowers: oracle.prepare('SELECT * FROM borrowers ORDER BY id').all(),
        loans: oracle.prepare('SELECT * FROM loans ORDER BY id').all(),
        lines: oracle.prepare('SELECT * FROM loan_lines ORDER BY id').all()
      };
    } finally {
      oracle.close();
    }
  };
  const add = async (route: string, values: Record<string, string>) => {
    const record = p.forms.find(f => f.kind === 'Record' && p.pages.find(page => page.id === f.pageId)?.route === route)!;
    const grid = p.forms.find(f => f.kind === 'Grid' && f.sourceRef?.id === record.sourceRef?.id)!;
    await app.goto(origin + p.pages.find(page => page.id === grid.pageId)!.route);
    await app.getByRole('link', {
      name: 'New record',
      exact: true
    }).click();
    for (const [name, value] of Object.entries(values)) await label(app, name).fill(value);
    await button(app, 'Save').click();
    await expect(app.getByText('Record saved.', {
      exact: false
    })).toBeVisible();
  };
  await add('/asset', {
    id: '1',
    label: 'Camera',
    daily_rate: '12.34'
  });
  await add('/borrower', {
    id: '1',
    name: 'Ada',
    email: 'ada@example.test'
  });
  await add('/borrower', {
    id: '2',
    name: 'Zero',
    email: 'zero@example.test'
  });
  await add('/loan', {
    id: '1',
    borrower_id: '1',
    asset_id: '1',
    starts_on: '2026-10-27',
    status: 'Open'
  });
  await add('/line', {
    id: '1',
    loan_id: '1',
    description: 'Lens',
    quantity: '3',
    unit_price: '0.10'
  });
  await add('/line', {
    id: '2',
    loan_id: '1',
    description: 'Stand',
    quantity: '2',
    unit_price: '1.25'
  });
  expect(rows().lines).toHaveLength(2);
  writeFileSync(info.outputPath('runtime-rows.json'), JSON.stringify(rows(), null, 2));
  const reportOracle = async () => {
    const totals = exactBorrowerTotals(join(root, 'definitions', 'equipment.sqlite'));
    await app.goto(origin + '/report');
    for (const person of totals) await expect(app.getByRole('row').filter({
      hasText: person.name
    })).toContainText(person.total);
    return totals;
  };
  expect(await reportOracle()).toEqual([{
    id: 1,
    name: 'Ada',
    total: '2.80'
  }, {
    id: 2,
    name: 'Zero',
    total: '0.00'
  }]);
  await app.screenshot({
    path: info.outputPath('runtime-report.png')
  });
  const minimumParameter = report.id + ':parameter:minimum';
  await label(app, 'minimum').fill('1.00');
  await app.getByRole('combobox', {
    name: 'Input mode',
    exact: true
  }).selectOption('value');
  await app.getByRole('button', {
    name: 'Apply parameters',
    exact: true
  }).click();
  await expect(app).toHaveURL(new RegExp(encodeURIComponent(minimumParameter) + '=1.00'));
  await expect(app.getByRole('row').filter({
    hasText: 'Zero'
  })).toHaveCount(0);
  await expect(app.getByRole('row').filter({
    hasText: 'Ada'
  })).toContainText('2.80');
  await app.getByRole('link', {
    name: 'Ada',
    exact: true
  }).click();
  expect(new URL(app.url()).searchParams.get(gridFor(loan.id).id + ':filter:' + loan.columns.find(c => c.physicalName === 'borrower_id')!.id)).toBe('1');
  await app.getByRole('link', {
    name: 'Open',
    exact: true
  }).click();
  expect(new URL(app.url()).searchParams.get(gridFor(line.id).id + ':filter:' + line.columns.find(c => c.physicalName === 'loan_id')!.id)).toBe('1');
  const lineRow = app.getByRole('row').filter({
    hasText: 'Lens'
  });
  await lineRow.getByRole('link', {
    name: 'Edit record',
    exact: true
  }).click();
  const selectedLine = app.url(),
    beforeCancel = rows();
  await label(app, 'description').fill('Discarded');
  await button(app, 'Cancel').click();
  await expect(app).toHaveURL(/\/lines(?:\?|$)/);
  expect(rows()).toEqual(beforeCancel);
  expect(new URL(app.url()).searchParams.get(minimumParameter)).toBe('1.00');
  await app.goto(selectedLine);
  for (const value of ['forbidden', 'action-fail']) {
    await label(app, 'description').fill(value);
    await button(app, 'Save').click();
    await expect(app.getByRole('alert').filter({
      hasText: 'Equipment ' + (value === 'forbidden' ? 'validator' : 'action') + ' rejected this description.'
    })).toBeVisible();
    await expect(label(app, 'description')).toHaveValue(value);
    expect(rows()).toEqual(beforeCancel);
  }
  await label(app, 'description').fill('Lens');
  await label(app, 'unit_price').fill('0.123');
  await button(app, 'Save').click();
  await expect(app.getByText('Amount exceeds configured precision or scale.', {
    exact: true
  })).toBeVisible();
  await expect(label(app, 'unit_price')).toHaveValue('0.123');
  expect(rows()).toEqual(beforeCancel);
  await label(app, 'description').fill('Lens revised');
  await label(app, 'unit_price').fill('0.20');
  await button(app, 'Save').click();
  await expect(app).toHaveURL(/\/lines(?:\?|$)/);
  expect(rows().lines[0]).toMatchObject({
    description: 'Lens revised',
    unit_price: '0.20'
  });
  expect((await reportOracle())[0]!.total).toBe('3.10');
  await add('/line', {
    id: '3',
    loan_id: '1',
    description: 'Disposable',
    quantity: '2',
    unit_price: '0.05'
  });
  expect((await reportOracle())[0]!.total).toBe('3.20');
  await app.goto(origin + '/lines');
  await app.getByRole('row').filter({
    hasText: 'Disposable'
  }).getByRole('link', {
    name: 'Edit record',
    exact: true
  }).click();
  await label(app, 'Confirm deletion of Disposable').check();
  await button(app, 'Delete').click();
  await expect(app).toHaveURL(/\/lines(?:\?|$)/);
  expect((await reportOracle())[0]!.total).toBe('3.10');
  await app.goto(origin + '/loans');
  await app.getByRole('link', {
    name: 'Edit record',
    exact: true
  }).first().click();
  const beforeRestricted = rows();
  await label(app, 'Confirm deletion of Open').check();
  await button(app, 'Delete').click();
  await expect(app.getByRole('alert').filter({
    hasText: 'RELATED_RECORDS_EXIST'
  })).toContainText(/related|dependent|referenced/i);
  expect(rows()).toEqual(beforeRestricted);
  // Sign out, navigate a filtered child and resume its selected record after a fresh login.
  const cookiesBeforeLogout = await visitor.cookies();
  await button(app, 'Sign out').click();
  await expect(app.getByRole('banner')).not.toContainText(username);
  await app.goto(origin + '/report');
  await app.getByRole('link', {
    name: 'Ada',
    exact: true
  }).click();
  await app.getByRole('link', {
    name: 'Open',
    exact: true
  }).click();
  const filteredLines = app.url();
  await app.getByRole('row').filter({
    hasText: 'Lens revised'
  }).getByRole('link', {
    name: 'Edit record',
    exact: true
  }).click();
  await expect(app.getByText('Sign in to continue to the selected page.', {
    exact: false
  })).toBeVisible();
  await app.getByRole('link', {
    name: 'cancel',
    exact: true
  }).click();
  await expect(app).toHaveURL(filteredLines);
  await app.getByRole('row').filter({
    hasText: 'Lens revised'
  }).getByRole('link', {
    name: 'Edit record',
    exact: true
  }).click();
  await label(app, 'Username').fill(username);
  await label(app, 'Password').fill(secret);
  await button(app, 'Sign in').click();
  await expect(label(app, 'description')).toHaveValue('Lens revised');
  expect(new URL(app.url()).searchParams.get(gridFor(line.id).id + ':filter:' + line.columns.find(c => c.physicalName === 'loan_id')!.id)).toBe('1');
  const anonymous = await browser.newContext(),
    revoked = await browser.newContext();
  await revoked.addCookies(cookiesBeforeLogout);
  const writeAction = p.actions.find(a => a.formId === lineRecord.id && a.operation === 'insert')!;
  const handlerFile = readdirSync(join(output, 'server')).find(file => /^record-\d+\.ts$/.test(file) && readFileSync(join(output, 'server', file), 'utf8').includes(JSON.stringify(lineRecord.id)))!;
  expect(handlerFile).toBeDefined();
  for (const context of [anonymous, revoked]) {
    const nonce = (await (await context.request.get(origin + '/runtime/auth/csrf')).json()).csrf;
    const response = await context.request.post(origin + '/runtime/' + handlerFile.replace(/\.ts$/, ''), {
      headers: {
        origin,
        'x-csrf-token': nonce
      },
      data: {
        action: writeAction.id,
        parameters: {},
        input: {},
        confirmed: false
      }
    });
    expect(response.status()).toBe(401);
  }
  expect(rows()).toEqual(beforeRestricted);
  await anonymous.close();
  await revoked.close();
  await button(page, 'Queries').click();
  await button(page, 'Borrower totals').click();
  await section('Parameters');
  await label(page, 'Parameter 1 preview value').fill('1.00');
  await button(page, 'Run preview').click();
  await expect(page.getByRole('status').filter({
    hasText: 'Preview complete'
  })).toBeVisible();
  await section('Review');
  await expect(page.getByRole('table', {
    name: 'Preview results'
  })).toContainText('3.10');
  await expect(page.getByRole('table', {
    name: 'Preview results'
  })).not.toContainText('Zero');
  await page.screenshot({
    path: info.outputPath('designer-exact-preview.png')
  });
  await button(page, 'Return to page').click();
  writeFileSync(info.outputPath('authored-project.json'), JSON.stringify(await snapshot(), null, 2));
  await button(page, 'Stop runtime').click();
  await expect(page.getByRole('region', {
    name: 'Managed generated runtime'
  }).locator('strong').first()).toHaveText('Generated runtime · stopped');
  const preserved = rows();
  let settings = await snapshot();
  const saveSchema = async () => {
    await button(page, 'Save schema').click();
    await expect(page.locator('.schema-messages p[role=status]')).toContainText('Schema definition saved');
  };
  const migrate = async () => {
    await button(page, 'Review migration…').click();
    await expect(page.getByRole('dialog')).toContainText('Reviewed SQL');
    await page.screenshot({
      path: info.outputPath('schema-evolution-review.png')
    });
    writeFileSync(info.outputPath('schema-evolution-review.txt'), await page.getByRole('dialog').innerText());
    for (const box of await page.getByRole('dialog').getByRole('checkbox').all()) await box.check();
    await button(page, 'Apply reviewed migration').click();
    await expect(page.locator('.schema-messages p[role=status]')).toContainText('Migration committed');
  };
  await button(page, 'Schema').click();
  await page.locator('.schema-table-list').getByRole('button', {
    name: /assets/
  }).click();
  await page.getByRole('tab', {
    name: 'Columns',
    exact: true
  }).click();
  await page.locator('.schema-column-list').getByRole('button', {
    name: 'label · text',
    exact: true
  }).click();
  await label(page, 'Column name').fill('caption');
  for (const [name, required] of [['notes', false], ['condition', true]] as const) {
    await button(page, '＋ Column').click();
    await label(page, 'Column name').fill(name);
    await label(page, 'Allow NULL').setChecked(!required);
  }
  await saveSchema();
  await page.getByText('Backfill rules (0)', {
    exact: true
  }).click();
  await label(page, 'Backfill column').selectOption({
    label: 'assets.condition'
  });
  await label(page, 'Backfill literal').fill('ready');
  await button(page, 'Set backfill rule').click();
  await migrate();
  const evolved = rows();
  expect(evolved.assets).toEqual([{
    id: 1,
    caption: 'Camera',
    daily_rate: '12.34',
    notes: null,
    condition: 'ready'
  }]);
  expect(evolved.borrowers).toEqual(preserved.borrowers);
  expect(evolved.loans).toEqual(preserved.loans);
  expect(evolved.lines).toEqual(preserved.lines);
  while (await button(page, 'Remove rule').count()) await button(page, 'Remove rule').first().click();
  // Cancel a reviewed destructive type change; restore the desired type through the same visible control.
  await page.locator('.schema-column-list').getByRole('button', {
    name: 'notes · text',
    exact: true
  }).click();
  await label(page, 'Logical type').selectOption('integer');
  await saveSchema();
  await label(page, 'Backfill column').selectOption({
    label: 'assets.notes'
  });
  await label(page, 'Backfill literal').fill('0');
  await button(page, 'Set backfill rule').click();
  await button(page, 'Review migration…').click();
  await expect(page.getByRole('dialog')).toContainText(/drop|remove|rebuild/i);
  await page.screenshot({
    path: info.outputPath('schema-destructive-cancel.png')
  });
  writeFileSync(info.outputPath('schema-destructive-review.txt'), await page.getByRole('dialog').innerText());
  await button(page, 'Cancel review').click();
  expect(rows()).toEqual(evolved);
  await button(page, 'Remove rule').click();
  await label(page, 'Logical type').selectOption('text');
  await saveSchema();
  // A second visible editor changes the revision after review; direct stale apply is a negative probe only.
  const reviewedResponse = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.operation === 'schema.preview');
  await button(page, 'Review migration…').click();
  const oldPlan = (await (await reviewedResponse).json()).result;
  const second = await page.context().newPage();
  await second.goto(url);
  await button(second, 'Open / Switch…').click();
  await second.getByRole('dialog').getByRole('button', {
    name: /Equipment Desk/
  }).click();
  await second.locator(`[role=treeitem][data-object-id="${settings.pages.find(q => q.route === '/')!.id}"]`).dblclick();
  await second.getByRole('tab', {
    name: 'Format',
    exact: true
  }).click();
  await label(second, 'Title').fill('Asset inventory');
  await save(second);
  await second.close();
  await expect(button(page, 'Apply reviewed migration')).toBeDisabled();
  const current = await snapshot();
  const stale = await fetch(url + '/api/v1/projects/' + current.id + '/commands', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${capability}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      operation: 'schema.apply',
      expectedRevision: current.revision,
      input: {
        planId: oldPlan.id,
        hash: oldPlan.hash,
        acknowledgedImpactIds: oldPlan.requiredAcknowledgementIds
      }
    })
  });
  expect(stale.status).toBe(409);
  writeFileSync(info.outputPath('stale-refusal.json'), JSON.stringify(await stale.json(), null, 2));
  await page.screenshot({
    path: info.outputPath('stale-review.png')
  });
  await button(page, 'Cancel review').click();
  expect(rows()).toEqual(evolved);
  await button(page, 'Schema').click();
  const history = () => {
    const oracle = new Database(join(root, 'definitions', 'equipment.sqlite'), {
      readonly: true
    });
    try {
      return oracle.prepare('SELECT * FROM __schema_baron_migrations ORDER BY id').all();
    } finally {
      oracle.close();
    }
  };
  const evolvedProject = await snapshot(),
    assetRecord = evolvedProject.forms.find(form => form.kind === 'Record' && form.sourceRef?.id === evolvedProject.schema.tables.find(t => t.physicalName === 'assets')!.id)!;
  await select(assetRecord.id);
  await page.getByRole('tab', {
    name: 'Controls',
    exact: true
  }).click();
  await button(page, '◇ Text input').click();
  await page.getByRole('tab', {
    name: 'Format',
    exact: true
  }).click();
  await label(page, 'Label').fill('condition');
  await page.getByRole('tab', {
    name: 'Data',
    exact: true
  }).click();
  await label(page, 'Bound field').selectOption({
    label: 'condition · text'
  });
  await label(page, 'Required').check();
  await save(page);
  settings = await snapshot();
  const migrationHistory = history();
  expect(migrationHistory.length).toBeGreaterThanOrEqual(2);
  // Both promotion cycles follow real UI writes and authored Code edits; stop the managed group first.
  for (const cycle of [1, 2]) {
    await select(lineRecord.pageId);
    await page.getByRole('tab', {
      name: 'Code',
      exact: true
    }).click();
    for (const contract of (await snapshot()).extensionContracts) {
      await label(page, 'Source module').selectOption(contract.id);
      await button(page, 'Read source').click();
      await expect(label(page, 'Source code')).toHaveValue(expectedSources[contract.relativePath]!);
      const updated = expectedSources[contract.relativePath] + `\n// Retained regeneration cycle ${cycle}.\n`;
      await label(page, 'Source code').fill(updated);
      await button(page, 'Save authored source').click();
      await expect(button(page, 'Save authored source')).toBeEnabled();
      expectedSources[contract.relativePath] = updated;
    }
    await generate();
    const cycleInstall = spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--offline'], {
      cwd: output,
      encoding: 'utf8',
      timeout: 120000
    });
    writeFileSync(info.outputPath('cycle-' + cycle + '-install.log'), cycleInstall.stdout + cycleInstall.stderr);
    expect(cycleInstall.status).toBe(0);
    expect(rows()).toEqual(evolved);
    expect(history()).toEqual(migrationHistory);
    for (const [path, bytes] of Object.entries(expectedSources)) expect(readFileSync(join(output, path), 'utf8')).toBe(bytes);
    await button(page, 'Build generated output').click();
    await expect(button(page, 'Start / retry')).toBeEnabled({
      timeout: 120000
    });
    await label(page,'Runtime port').fill(String(port));
    await button(page, 'Start / retry').click();
    await expect(page.getByRole('region', {
      name: 'Managed generated runtime'
    }).locator('strong').first()).toHaveText('Generated runtime · running', {
      timeout: 30000
    });
    expect((await reportOracle())[0]!.total).toBe('3.10');
    await add('/asset', {
      id: '2',
      label: 'Disposable asset',
      daily_rate: '0.10',
      condition: 'ready'
    });
    await app.goto(origin + '/');
    await app.getByRole('row').filter({
      hasText: 'Disposable asset'
    }).getByRole('link', {
      name: 'Edit record',
      exact: true
    }).click();
    await label(app, 'Confirm deletion of Disposable asset').check();
    await button(app, 'Delete').click();
    await expect(app).toHaveURL(origin + '/');
    expect(rows()).toEqual(evolved);
    await button(page, 'Stop runtime').click();
    await expect(page.getByRole('region', {
      name: 'Managed generated runtime'
    }).locator('strong').first()).toHaveText('Generated runtime · stopped');
  }
  await page.reload();
  p = await snapshot();
  expect(p.policies).toEqual(settings.policies);
  expect(p.queries).toEqual(settings.queries);
  expect(p.actions).toEqual(settings.actions);
  expect(p.forms).toEqual(settings.forms);
  expect(rows()).toEqual(evolved);
  expect(history()).toEqual(migrationHistory);
  await button(page, 'Login and access…').click();
  await expect(label(page, 'Global default')).toHaveValue('public');
  for (const record of p.forms.filter(form => form.kind === 'Record')) {
    await label(page, 'Policy page').selectOption(record.pageId);
    await expect(label(page, 'Page access')).toHaveValue('authenticated');
    for (const action of p.actions.filter(action => action.formId === record.id && ['insert', 'update', 'delete'].includes(action.operation))) await expect(label(page, `Access for ${action.operation} ${action.id}`)).toHaveValue('authenticated');
  }
  await label(page, 'Policy page').selectOption(loginForm.pageId);
  await expect(label(page, 'Page access')).toHaveValue('public');
  await button(page, 'Close').click();
  await button(page, 'Queries').click();
  await button(page, 'Borrower totals').click();
  await expect(label(page, 'Query name')).toHaveValue('Borrower totals');
  await section('Parameters');
  await expect(label(page, 'Parameter 1 name')).toHaveValue('minimum');
  await expect(label(page, 'Parameter 1 default')).toHaveValue('0.00');
  await section('Fields');
  await expect(label(page, 'HAVING operator')).toHaveValue('>=');
  await button(page, 'Return to page').click();
  await select(report.id);
  await expect(label(page, 'Runtime name minimum')).toHaveValue('minimum');
  await expect(label(page, 'navigate destination filterMapping target 1')).toHaveValue(loan.columns.find(c => c.physicalName === 'borrower_id')!.id);
  await select(lineRecord.id);
  await expect(label(page, 'update source hook')).toHaveValue(p.extensionContracts.find(contract => contract.kind === 'action')!.id);
  await expect(label(page, 'cancel destination page')).toHaveValue(gridFor(line.id).pageId);
  await page.getByRole('tab', {
    name: 'Code',
    exact: true
  }).click();
  for (const contract of p.extensionContracts) {
    await label(page, 'Source module').selectOption(contract.id);
    await button(page, 'Read source').click();
    await expect(label(page, 'Source code')).toHaveValue(expectedSources[contract.relativePath]!);
  }
  await page.screenshot({
    path: info.outputPath('reopened-authored-source.png')
  });
  const physical = new Database(join(root, 'definitions', 'equipment.sqlite'), {
    readonly: true
  });
  const integrity = physical.pragma('integrity_check'),
    fkViolations = physical.pragma('foreign_key_check'),
    uniqueIndexes = physical.pragma('index_list(borrowers)') as {
      unique: number;
    }[];
  expect(integrity).toEqual([{
    integrity_check: 'ok'
  }]);
  expect(fkViolations).toEqual([]);
  expect(uniqueIndexes.some(index => index.unique === 1)).toBe(true);
  physical.close();
  writeFileSync(info.outputPath('database-integrity.json'), JSON.stringify({
    integrity,
    fkViolations,
    uniqueIndexes
  }, null, 2));
  writeFileSync(info.outputPath('final-project.json'), JSON.stringify(p, null, 2));
  writeFileSync(info.outputPath('final-rows.json'), JSON.stringify(evolved, null, 2));
  writeFileSync(info.outputPath('migration-history.json'), JSON.stringify(migrationHistory, null, 2));
  writeFileSync(info.outputPath('expected-authored.json'), JSON.stringify(expectedSources, null, 2));
  await page.getByText('Portable definition and output export', {
    exact: true
  }).click();
  await label(page, 'Export destination').fill('output:portable');
  await page.getByRole('checkbox', {
    name: /I reviewed including/
  }).check();
  await button(page, 'Export portable application').click();
  await expect(page.getByRole('alert').filter({
    hasText: 'Portable export created'
  })).toBeVisible();
  await visitor.close();
  if (child.pid) process.kill(-child.pid, 'SIGTERM');
  await exit;
  expect(await fetch(url).then(() => true, () => false)).toBe(false);
  const portable = join(root, 'outputs', 'portable', 'app'),
    cleanEnv = {
      PATH: pinnedBinPath,
      HOME: process.env.HOME ?? '',
      NODE_PATH: '',
      npm_config_ignore_scripts: 'true',
      npm_config_workspaces: 'false',
      NEXT_TELEMETRY_DISABLED: '1'
    };
  for (const args of [['ci', '--ignore-scripts', '--offline'], ['run', 'typecheck'], ['test'], ['run', 'build']]) {
    const checked = spawnSync(process.execPath, [npm, ...args], {
      cwd: portable,
      env: cleanEnv,
      encoding: 'utf8',
      timeout: 120000
    });
    writeFileSync(info.outputPath('portable-' + args.join('-') + '.log'), checked.stdout + checked.stderr);
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  }
  const deployed = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: portable,
    env: cleanEnv,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const deployedExit = once(deployed, 'exit');
  try {
    await expect.poll(() => fetch(origin + '/report').then(r => r.status, () => 0), {
      timeout: 30000
    }).toBe(200);
    const exported = await browser.newPage();
    await exported.goto(origin + '/report');
    await expect(exported.getByRole('row').filter({
      hasText: 'Ada'
    })).toContainText('3.10');
    await expect(exported.getByRole('row').filter({
      hasText: 'Zero'
    })).toContainText('0.00');
    await exported.screenshot({
      path: info.outputPath('independent-export.png')
    });
    await exported.close();
    for (const [path, bytes] of Object.entries(expectedSources)) expect(readFileSync(join(portable, path), 'utf8')).toBe(bytes);
    const walk = (directory: string): string[] => readdirSync(directory, {
      withFileTypes: true
    }).flatMap(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
    const scanned = [...walk(info.outputDir), ...walk(join(portable, '.next', 'static')), ...walk(join(output, '.next', 'static'))];
    for (const file of scanned) {
      const bytes = readFileSync(file);
      expect(bytes.includes(Buffer.from(secret)), 'Visitor password absent from artifact/client file').toBe(false);
      expect(bytes.includes(Buffer.from(capability)), 'Owner key absent from artifact/client file').toBe(false);
    }
    expect(JSON.stringify(p).includes(secret)).toBe(false);
    expect(JSON.stringify(p).includes(capability)).toBe(false);
    writeFileSync(info.outputPath('credential-scan.json'), JSON.stringify({
      fileCount: scanned.length,
      visitorPasswordAbsent: true,
      ownerCapabilityAbsent: true,
      scope: 'retained evidence + both client static outputs + project model'
    }, null, 2));
  } finally {
    if (deployed.pid && deployed.exitCode === null && deployed.signalCode === null) process.kill(-deployed.pid, 'SIGTERM');
    await deployedExit;
  }
});
