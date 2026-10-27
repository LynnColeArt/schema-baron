import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import { audit, nativeMetrics } from './accessibility';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { connect, current, root, url, keyButton as button, keyText as text, keyTab as tab, keySelect as select, keyCheck as check } from './harness';
export async function keyboardJourney(page: Page, info: TestInfo, native = false) {
  const name = native ? 'Native keyboard fidelity' : 'Keyboard fidelity';
  const database = native ? 'native-keyboard.sqlite' : 'keyboard.sqlite';
  const output = native ? 'native-keyboard' : 'keyboard';
  // Every authoring activation below uses focus plus keyboard; focus is a test locator convenience.
  // Database fixture is blank; project/schema/forms/query/policies are authored visibly.
  // Connection bootstrap secret is isolated owner setup, not part of authoring walkthrough.
  await connect(page);
  await button(page, 'New project…');
  await text(page, 'Project name', name);
  await button(page, 'Create project');
  await expect(page.getByRole('dialog')).toBeHidden();
  await button(page, 'Connections…');
  await select(page, 'Database choice', 'Create new empty SQLite file');
  await text(page, 'Relative SQLite file', database);
  await button(page, 'Inspect SQLite file');
  await button(page, 'Bind inspected database');
  await expect(page.getByRole('dialog')).toBeHidden();
  await button(page, 'Schema');
  for (const name of ['parent', 'child']) {
    await button(page, '＋ Table');
    await text(page, 'Table name', name);
    for (const column of ['tenant', 'code']) {
      await button(page, '＋ Column');
      await text(page, 'Column name', column);
      await select(page, 'Logical type', 'text');
      const nullable = page.getByLabel('Allow NULL', {
        exact: true
      });
      await nullable.focus();
      if (await nullable.isChecked()) await page.keyboard.press('Space');
    }
    await tab(page, 'Keys');
    await check(page, 'tenant');
    await check(page, 'code');
  }
  await button(page, '＋ Relationship');
  await select(page, 'Local table', 'child');
  await select(page, 'Referenced table', 'parent');
  await select(page, 'Local column 1', 'tenant');
  await select(page, 'Referenced column 1', 'tenant');
  await button(page, 'Add ordered pair');
  await select(page, 'Local column 2', 'code');
  await select(page, 'Referenced column 2', 'code');
  await button(page, 'Add relationship draft');
  await button(page, 'Save schema');
  await expect(page.locator('.schema-messages p[role=status]')).toContainText('Schema definition saved');
  await button(page, 'Review migration…');
  await button(page, 'Apply reviewed migration');
  await expect(page.getByRole('dialog')).toBeHidden();
  const p = await current(name);
  expect(p.schema.tables.find(t => t.physicalName === 'child')?.foreignKeys[0]?.columnIds).toHaveLength(2);
  await button(page, 'Schema');
  await button(page, '＋ Page');
  await text(page, 'Page title', 'Keyboard home');
  await text(page, 'Internal route', '/keyboard');
  await button(page, 'Add page');
  await button(page, '＋ Form');
  await text(page, 'Form label', 'Keyboard login');
  await select(page, 'Form kind', 'Login');
  for (let i = 0; i < 4; i++) await button(page, 'Next');
  await button(page, 'Finish');
  await expect(page.getByRole('dialog')).toBeHidden();
  await button(page, 'Login and access…');
  await button(page, 'Save identity source');
  await expect.poll(async () => (await current(p.name)).identity?.kind).toBe('managed');
  await select(page, 'Page access', 'Sign in required');
  await expect(page.getByText('Sign in required · from page policy', {
    exact: true
  }).first()).toBeVisible();
  await select(page, 'Page access', 'Public override (including Login)');
  await button(page, 'Close');
  await button(page, 'Queries');
  await button(page, 'New query');
  await text(page, 'Query name', 'Keyboard parent');
  await select(page, 'Add source', 'table: parent');
  await button(page, 'Fields');
  await button(page, 'Add projection');
  await select(page, 'Projection 1 kind', 'field');
  await select(page, 'Projection 1 field', 'source1.tenant');
  await button(page, 'Save query');
  await expect(page.locator('.qd-toolbar [role=status]')).toContainText('Query saved');
  await button(page, 'Run preview');
  await expect(page.locator('.qd-toolbar [role=status]')).toContainText('Preview complete');
  await button(page, 'Return to page');
  await button(page, '＋ Page');
  await text(page, 'Page title', 'Keyboard record');
  await text(page, 'Internal route', '/record');
  await button(page, 'Add page');
  await button(page, '＋ Form');
  await text(page, 'Form label', 'Keyboard record');
  await select(page, 'Form kind', 'Record');
  await select(page, 'Data source', 'Table: parent');
  await button(page, 'Next');
  for (const checkbox of await page.getByRole('group', {
    name: 'Fields, in selection order'
  }).getByRole('checkbox').all()) {
    await checkbox.focus();
    await page.keyboard.press('Space');
  }
  await button(page, 'Use complete primary key');
  await button(page, 'Next');
  for (const checkbox of await page.getByRole('group', {
    name: 'Declared actions'
  }).getByRole('checkbox').all()) {
    const label = (await checkbox.locator('..').innerText()).trim();
    const wanted = ['insert', 'cancel'].includes(label);
    await checkbox.focus();
    if ((await checkbox.isChecked()) !== wanted) await page.keyboard.press('Space');
  }
  await select(page, 'Success / navigation destination', 'Keyboard home · /keyboard');
  await select(page, 'Cancel destination', 'Keyboard home · /keyboard');
  await button(page, 'Next');
  await button(page, 'Next');
  await button(page, 'Finish');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('treeitem', {
    name: 'Keyboard home',
    exact: true
  }).focus();
  await page.keyboard.press('Enter');
  await button(page, 'Flow map');
  const map = page.getByRole('region', {
    name: 'Application behavior map'
  });
  await map.getByText(/^Keyboard behavior list/).focus();
  await page.keyboard.press('Enter');
  await map.getByRole('group', {
    name: 'Selectable behavior list'
  }).getByRole('button').first().focus();
  await page.keyboard.press('Enter');
  await button(page, 'Pan left');
  await button(page, 'Zoom in');
  await button(page, 'Fit visible');
  await button(page, 'Flow map');
  await page.getByRole('treeitem').filter({
    hasText: 'Keyboard login'
  }).first().focus();
  await page.keyboard.press('Enter');
  // Model draft and selection stay stable through repeated actual key edits.
  await tab(page, 'Format');
  for (let i = 0; i < 20; i++) {
    await text(page, 'Label', 'Keyboard login ' + i);
    await expect(page.getByLabel('Label', {
      exact: true
    })).toBeFocused();
    await expect(page.getByLabel('Label', {
      exact: true
    })).toHaveValue('Keyboard login ' + i);
  }
  await button(page, '▣ Save');
  await expect(page.getByRole('status')).toContainText('Saved');
  await tab(page, 'HTML');
  const html = page.getByLabel('HTML source', {
    exact: true
  });
  const existing = await html.inputValue();
  await text(page, 'HTML source', '<h1>Saved keyboard heading</h1>' + existing);
  await button(page, 'Apply HTML to draft');
  await button(page, '▣ Save');
  await expect(page.getByRole('status')).toContainText('Saved');
  await tab(page, 'Preview');
  await expect(page.frameLocator('iframe[title="Isolated current draft preview"]').getByRole('heading', {
    name: 'Saved keyboard heading'
  })).toBeVisible();
  await tab(page, 'Code');
  await page.getByText('Declare authored hook', {
    exact: true
  }).focus();
  await page.keyboard.press('Enter');
  await select(page, 'Hook kind', 'validator');
  await text(page, 'Module name', 'keyboard');
  await button(page, 'Declare hook');
  await expect.poll(async () => (await current(p.name)).extensionContracts.length).toBe(1);
  await expect(page.getByRole('button', {
    name: 'Declare hook',
    exact: true
  })).toBeEnabled();
  async function generate() {
    await button(page, 'Generate…');
    await text(page, 'Output location', 'output:' + output);
    const previewReply = page.waitForResponse(response => response.url().endsWith('/commands') && response.request().postDataJSON()?.operation === 'generation.preview');
    await button(page, 'Preview files');
    const previewResult = await (await previewReply).json();
    expect(previewResult, JSON.stringify(previewResult)).toMatchObject({
      ok: true
    });
    await expect(page.getByRole('button', {
      name: 'Create application',
      exact: true
    }), await page.getByRole('dialog').innerText()).toBeEnabled();
    for (const box of await page.getByRole('dialog').getByRole('checkbox').all()) {
      await box.focus();
      if (!(await box.isChecked())) await page.keyboard.press('Space');
    }
    await button(page, 'Create application');
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created');
    await button(page, 'Close');
  }
  await generate();
  await tab(page, 'Code');
  await text(page, 'Source output', 'output:' + output);
  const contract = (await current(p.name)).extensionContracts[0]!;
  await select(page, 'Source module', contract.relativePath + ' · ' + contract.kind + ' v' + contract.version);
  await button(page, 'Read source');
  await expect(page.getByLabel('Source code')).toHaveValue(/Authored validator interface/);
  const source = await page.getByLabel('Source code').inputValue();
  const tenantId = p.schema.tables.find(t => t.physicalName === 'parent')!.columns.find(c => c.physicalName === 'tenant')!.id;
  const authored = source.replace('(_context) => ({})', `(context) => context.values[${JSON.stringify(tenantId)}] === 'blocked' ? {[${JSON.stringify(tenantId)}]:'Keyboard-authored validator rejected tenant.'} : ({})`);
  expect(authored).not.toBe(source);
  await text(page, 'Source code', authored);
  await button(page, 'Save authored source');
  await expect.poll(() => readFileSync(join(root, 'output', output, contract.relativePath), 'utf8')).toContain('Keyboard-authored validator');
  await generate();
  expect(readFileSync(join(root, 'output', output, contract.relativePath), 'utf8')).toContain('Keyboard-authored validator');
  const install = spawnSync(process.execPath, ['/home/lynn/.nvm/versions/node/v24.22.1/lib/node_modules/npm/bin/npm-cli.js', 'ci', '--ignore-scripts', '--offline'], {
    cwd: join(root, 'output', output),
    encoding: 'utf8'
  });
  expect(install.status, install.stdout + install.stderr).toBe(0);
  await tab(page, 'Live Page');
  await button(page, 'Build generated output');
  await expect(page.getByRole('button', {
    name: 'Start / retry',
    exact: true
  })).toBeEnabled({
    timeout: 90000
  });
  await text(page, 'Runtime port', native ? '32296' : '32295');
  await button(page, 'Start / retry');
  await expect(page.getByRole('button', {
    name: 'Open selected generated page',
    exact: true
  })).toBeEnabled({
    timeout: 30000
  });
  const popup = page.waitForEvent('popup');
  await button(page, 'Open selected generated page');
  const live = await popup;
  await expect(live).toHaveURL(/\/keyboard/);
  await expect(live.getByRole('heading', {
    name: 'Saved keyboard heading'
  })).toBeVisible();
  await page.getByRole('treeitem', {
    name: 'Keyboard record',
    exact: true
  }).filter({
    has: page.locator('span')
  }).first().focus();
  await page.keyboard.press('Enter');
  await tab(page, 'Live Page');
  await select(page, 'Keyboard record · record mode', 'New record');
  const recordPopup = page.waitForEvent('popup');
  await button(page, 'Open selected generated page');
  const creating = await recordPopup;
  await expect(creating).toHaveURL(/mode=new/);
  await text(creating, 'tenant', 'blocked');
  await text(creating, 'code', 'one');
  await button(creating, 'Save');
  await expect(creating.getByRole('alert').filter({
    hasText: 'Keyboard-authored validator rejected tenant.'
  }).first()).toBeVisible();
  const oracle = () => {
    const databaseOracle = new Database(join(root, 'definitions', database), {
      readonly: true
    });
    try {
      return databaseOracle.prepare('SELECT tenant,code FROM parent').all();
    } finally {
      databaseOracle.close();
    }
  };
  const rejectedRows = oracle();
  expect(rejectedRows).toEqual([]);
  await expect(creating.getByLabel('tenant', {
    exact: true
  })).toHaveValue('blocked');
  await text(creating, 'tenant', 'accepted');
  await button(creating, 'Save');
  await expect(creating).toHaveURL(/\/keyboard/);
  const acceptedRows = oracle();
  const returnRoute = new URL(creating.url()).pathname;
  expect(acceptedRows).toEqual([{
    tenant: 'accepted',
    code: 'one'
  }]);
  await creating.close();
  await page.getByRole('treeitem', {
    name: 'Keyboard home',
    exact: true
  }).focus();
  await page.keyboard.press('Enter');
  await tab(page, 'HTML');
  await text(page, 'HTML source', '<h1>Unsaved current draft</h1>' + existing);
  await tab(page, 'Preview');
  await expect(page.frameLocator('iframe[title="Isolated current draft preview"]').getByRole('heading', {
    name: 'Unsaved current draft'
  })).toBeVisible();
  await live.reload();
  await expect(live.getByRole('heading', {
    name: 'Saved keyboard heading'
  })).toBeVisible();
  await audit(page, info, 'axe-keyboard-workspace');
  if (native) {
    await nativeMetrics(page, info);
    await page.screenshot({
      path: info.outputPath('keyboard-native-200.png'),
      scale: 'device'
    });
  } else for (const size of [{
    width: 1280,
    height: 800
  }, {
    width: 1920,
    height: 1080
  }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    for (const region of ['Explorer','Toolbox','Properties','Messages']) await expect(page.getByRole('region',{name:region,exact:true})).toBeVisible();
    for (const mode of ['Design', 'HTML', 'Code', 'Preview', 'Live Page']) {
      await tab(page, mode);
      await page.screenshot({
        path: info.outputPath(`fidelity-${mode.replace(' ', '-')}-${size.width}.png`),
        fullPage: true
      });
    }
    await page.getByRole('treeitem', {
      name: 'Keyboard login 19',
      exact: true
    }).focus();
    await page.keyboard.press('Enter');
    for (const property of ['Format', 'Data', 'Events']) {
      if(property === 'Events') {await page.getByRole('treeitem',{name:'Username',exact:true}).focus();await page.keyboard.press('Enter');}
      await tab(page, property);
      await page.screenshot({
        path: info.outputPath(`properties-${property}-${size.width}.png`),
        fullPage: true
      });
    }
  }
  await button(page, 'Stop runtime');
  await live.close();
  writeFileSync(info.outputPath('keyboard-journey.json'), JSON.stringify({
    pointerActions: 0,
    functionalCode: {contractPath: contract.relativePath, editedSource: authored, rejectedRows, acceptedRows, returnRoute},
    authoring: ['blank project', 'blank SQLite', 'two tables', 'ordered composite FK', 'Login wizard', 'named query saved and real SQLite preview', 'identity source and effective page policy', 'selectable map and pan/zoom', '20 property edits', 'HTML', 'Design', 'Preview', 'functional authored validator Code edit', 'generated Record rejection retains inputs and writes zero rows', 'corrected Record saves SQLite and returns declared route', 'two generations', 'built runtime', 'Live Page route', 'draft/output distinction'],
    limitations: []
  }, null, 2));
}
