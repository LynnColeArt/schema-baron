import { test, expect } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { workspaceFixture, schemaFixture, flowPages } from '../../../fixtures/scale/build';
import { distribution, environment, beginRenderMeasure, endRenderMeasure } from '../../performance/behavior';
import { audit, nativeContext, nativeMetrics } from './accessibility';
import { connect, create, command, current, root, keyButton, keyText } from './harness';
test.setTimeout(180000);
function record(info: TestInfo, name: string, value: unknown) {
  writeFileSync(info.outputPath(name + '.json'), JSON.stringify(value, null, 2));
}
test('full 50 page 200 form 1000 control rendered workspace selection/property response and ready reopen', async ({
  page,
  browser
}, info) => {
  await connect(page);
  await create(page, 'Full workspace scale');
  let p = await current('Full workspace scale');
  for (const [start, end] of [[0, 25], [25, 50]]) {
    await command(p, 'project.batch', {
      operations: workspaceFixture(start, end)
    });
    p = await current(p.name);
  }
  expect([p.pages.length, p.forms.length, p.controls.length]).toEqual([50, 200, 1000]);
  await page.reload();
  await expect(page.getByRole('treeitem')).toHaveCount(1250);
  const first = p.pages[0]!;
  await page.getByRole('treeitem', {
    name: first.title,
    exact: true
  }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.page-sheet .form-caption')).toHaveCount(4);
  const samples: number[] = [],
    selections: number[] = [],
    renderProperty: number[] = [],
    renderSelection: number[] = [];
  for (let i = 0; i < 35; i++) {
    const target = p.pages[i % 50]!;
    let start = performance.now();
    await page.getByRole('treeitem', {
      name: new RegExp('^' + target.title + '$')
    }).focus();
    await beginRenderMeasure(page, 'keydown', target.title, false);
    await page.keyboard.press('Enter');
    const selectionPaint = await endRenderMeasure(page);
    await expect(page.getByLabel('Title', {
      exact: true
    })).toHaveValue(target.title);
    if (i >= 5) {
      selections.push(performance.now() - start);
      renderSelection.push(selectionPaint);
    }
    start = performance.now();
    const value = 'Measured draft ' + i;
    await beginRenderMeasure(page, 'input', value, true);
    await page.getByLabel('Title', {
      exact: true
    }).fill(value);
    const propertyPaint = await endRenderMeasure(page);
    await expect(page.getByLabel('Title', {
      exact: true
    })).toHaveValue(value);
    await expect(page.getByRole('tab', {
      name: value + ' *',
      exact: true
    })).toHaveAttribute('aria-selected', 'true');
    if (i >= 5) {
      samples.push(performance.now() - start);
      renderProperty.push(propertyPaint);
    }
  }
  const saveStart = performance.now();
  await keyButton(page, '▣ Save');
  await expect(page.getByRole('status')).toContainText('Saved');
  const saveMs = performance.now() - saveStart;
  const start = performance.now();
  await page.reload();
  await expect(page.getByLabel('Title', {
    exact: true
  })).toHaveValue('Measured draft 34');
  const reopenMs = performance.now() - start;
  const result = {
    environment: environment(browser.version()),
    fixture: {
      pages: 50,
      forms: 200,
      controls: 1000
    },
    property: distribution(renderProperty),
    selection: distribution(renderSelection),
    automationPropertyRoundtrip: distribution(samples),
    automationSelectionRoundtrip: distribution(selections),
    reopenMs,
    saveRoundtripMs: saveMs,
    serviceReadyBeforeReopen: true
  };
  record(info, 'workspace-scale', result);
  await page.screenshot({
    path: info.outputPath('workspace-scale.png')
  });
  expect.soft(result.property.p95Ms).toBeLessThan(200);
  expect.soft(result.selection.p95Ms).toBeLessThan(200);
  expect.soft(reopenMs).toBeLessThan(3000);
});
test('actual 50 table 500 column diagram preserves 20 selected drafts through save drag and reprojection', async ({
  page,
  browser
}, info) => {
  await connect(page);
  await create(page, 'Schema diagram scale');
  let p = await current('Schema diagram scale');
  const tables = schemaFixture();
  await command(p, 'project.batch', {
    operations: tables.map(value => ({
      kind: 'put',
      entity: 'table',
      id: value.id,
      value
    }))
  });
  await keyButton(page, 'Schema');
  const diagram = page.getByLabel('Schema relationship diagram');
  await expect(page.getByText('50 tables · 500 columns', {
    exact: true
  })).toBeVisible();
  const node = diagram.locator('.react-flow__node[data-id="' + tables[0]!.id + '"]');
  await expect(node).toBeVisible();
  await node.getByText('scale_table_0', {
    exact: true
  }).click();
  const sizes: unknown[] = [],
    samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const start = performance.now();
    const value = 'Diagram draft ' + i;
    await page.getByLabel('Table name', {
      exact: true
    }).fill(value);
    await expect(node).toContainText(value);
    await expect(node).toHaveClass(/selected/);
    await expect(page.getByLabel('Table name', {
      exact: true
    })).toHaveValue(value);
    const bounds = await node.boundingBox();
    sizes.push(bounds);
    expect(bounds?.width).toBeGreaterThan(100);
    expect(bounds?.height).toBeGreaterThan(100);
    samples.push(performance.now() - start);
  }
  const before = await node.getAttribute('style');
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 70, box.y + 14);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 45, {
    steps: 6
  });
  await page.mouse.up();
  await expect(node).not.toHaveAttribute('style', before!);
  const dragged = await page.evaluate(id => JSON.parse(sessionStorage.getItem('studio.schema.' + id) ?? '{}').positions, p.id);
  expect(dragged[tables[0]!.id]).toBeDefined();
  await keyButton(page, 'Save schema');
  await expect(page.getByLabel('Table name', {
    exact: true
  })).toHaveValue('Diagram draft 19');
  await expect(node).toContainText('Diagram draft 19');
  await page.getByRole('button', {
    name: 'Zoom Out',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Zoom In',
    exact: true
  }).click();
  await expect(node).toBeVisible();
  await expect(node).toHaveClass(/selected/);
  p = await current(p.name);
  expect(p.schema.tables[0]?.physicalName).toBe('Diagram draft 19');
  record(info, 'schema-diagram-scale', {
    environment: environment(browser.version()),
    tables: 50,
    columns: 500,
    edits: 20,
    lostDrafts: 0,
    lostSelections: 0,
    sizes,
    durations: distribution(samples)
  });
  await page.screenshot({
    path: info.outputPath('schema-diagram-scale.png')
  });
  const context = await nativeContext(root);
  try {
    const zoom = context.pages()[0]!;
    await connect(zoom);
    await keyButton(zoom, 'Open / Switch…');
    const choice = zoom.getByRole('dialog').getByRole('button').filter({
      hasText: 'Schema diagram scale'
    });
    await choice.focus();
    await zoom.keyboard.press('Enter');
    await expect(zoom.getByRole('dialog')).toBeHidden();
    await keyButton(zoom, 'Schema');
    const graph = zoom.getByLabel('Schema relationship diagram'),
      zoomNode = graph.locator('.react-flow__node[data-id="' + tables[0]!.id + '"]');
    await expect(zoomNode).toBeVisible();
    await zoomNode.getByText('Diagram draft 19', {
      exact: true
    }).focus();
    await zoom.keyboard.press('Enter');
    for (let i = 0; i < 20; i++) {
      await keyText(zoom, 'Table name', 'Native diagram ' + i);
      await expect(zoomNode).toContainText('Native diagram ' + i);
      await expect(zoomNode).toHaveClass(/selected/);
    }
    await keyButton(zoom, 'Save schema');
    await expect(zoomNode).toContainText('Native diagram 19');
    const nativeBox = (await zoomNode.boundingBox())!,
      nativeStyle = await zoomNode.getAttribute('style');
    await zoom.mouse.move(nativeBox.x + 50, nativeBox.y + 12);
    await zoom.mouse.down();
    await zoom.mouse.move(nativeBox.x + 70, nativeBox.y + 24, {
      steps: 6
    });
    await zoom.mouse.up();
    await expect(zoomNode).not.toHaveAttribute('style', nativeStyle!);
    const nativePositions = await zoom.evaluate(id => JSON.parse(sessionStorage.getItem('studio.schema.' + id) ?? '{}').positions, p.id);
    expect(nativePositions[tables[0]!.id]).toBeDefined();
    const viewport = graph.locator('.react-flow__viewport'),
      panBefore = await viewport.getAttribute('style'),
      graphBox = (await graph.boundingBox())!;
    await zoom.mouse.move(graphBox.x + 8, graphBox.y + 8);
    await zoom.mouse.down();
    await zoom.mouse.move(graphBox.x + 25, graphBox.y + 18, {
      steps: 6
    });
    await zoom.mouse.up();
    await expect(viewport).not.toHaveAttribute('style', panBefore!);
    await zoom.getByRole('tab', {
      name: 'Table list',
      exact: true
    }).focus();
    await zoom.keyboard.press('Enter');
    await zoom.getByRole('tab', {
      name: 'Diagram',
      exact: true
    }).focus();
    await zoom.keyboard.press('Enter');
    await expect(zoomNode).toBeVisible();
    await expect(zoomNode).toHaveClass(/selected/);
    await expect(zoom.getByLabel('Table name', {
      exact: true
    })).toHaveValue('Native diagram 19');
    await nativeMetrics(zoom, info);
    await audit(zoom, info, 'axe-schema-native');
    await zoom.screenshot({
      path: info.outputPath('schema-native-200.png'),
      scale: 'device'
    });
  } finally {
    await context.close();
  }
});
test('indexed 10000 row keyset paging through real owner and 100 node map with 20 live edits', async ({
  page,
  browser
}, info) => {
  const db = new Database(join(root, 'definitions', 'scale.sqlite'));
  db.exec('CREATE TABLE records(id INTEGER PRIMARY KEY, caption TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO records VALUES(?,?)');
  db.transaction(() => {
    for (let i = 1; i <= 10000; i++) insert.run(i, 'Row ' + i);
  })();
  const queryPlan = db.prepare('EXPLAIN QUERY PLAN SELECT id,caption FROM records WHERE id>? ORDER BY id LIMIT 100').all(5000);
  db.close();
  await connect(page);
  await create(page, 'Flow and query scale');
  await keyButton(page, 'Connections…');
  await keyText(page, 'Relative SQLite file', 'scale.sqlite');
  await keyButton(page, 'Inspect SQLite file');
  await keyButton(page, 'Bind inspected database');
  await expect(page.getByRole('dialog')).toBeHidden();
  let p = await current('Flow and query scale');
  const table = p.schema.tables[0]!,
    key = table.columns.find(c => c.physicalName === 'id')!,
    caption = table.columns.find(c => c.physicalName === 'caption')!;
  const id = crypto.randomUUID(),
    parameter = crypto.randomUUID(),
    keyProjection = crypto.randomUUID(),
    captionProjection = crypto.randomUUID();
  const draft = {
    id,
    name: 'Indexed paging',
    sources: [{
      alias: 'r',
      source: {
        kind: 'table',
        id: table.id
      }
    }],
    joins: [],
    projections: [{
      id: keyProjection,
      name: 'id',
      type: key.type,
      nullable: false,
      expression: {
        kind: 'field',
        alias: 'r',
        fieldId: key.id
      }
    }, {
      id: captionProjection,
      name: 'caption',
      type: caption.type,
      nullable: false,
      expression: {
        kind: 'field',
        alias: 'r',
        fieldId: caption.id
      }
    }],
    parameters: [{
      id: parameter,
      name: 'after',
      type: {
        kind: 'integer'
      },
      nullable: false
    }],
    where: {
      kind: 'binary',
      operator: '>',
      left: {
        kind: 'field',
        alias: 'r',
        fieldId: key.id
      },
      right: {
        kind: 'parameter',
        parameterId: parameter
      }
    },
    groupBy: [],
    orderBy: [{
      expression: {
        kind: 'field',
        alias: 'r',
        fieldId: key.id
      },
      direction: 'asc'
    }],
    grain: {
      strategy: 'rows',
      keys: [keyProjection]
    }
  };
  const samples: number[] = [];
  for (let i = 0; i < 35; i++) {
    const after = i * 251 % 9800,
      start = performance.now();
    const result = await command(p, 'query.preview', {
      draft,
      parameters: {
        [parameter]: after
      },
      rowLimit: 100
    });
    expect(result.result.rows).toHaveLength(100);
    expect(result.result.rows[0][keyProjection]).toBe(after + 1);
    if (i >= 5) samples.push(performance.now() - start);
  }
  record(info, 'indexed-query', {
    environment: environment(browser.version()),
    rows: 10000,
    pageSize: 100,
    indexQueryPlan: queryPlan,
    paging: distribution(samples)
  });
  expect.soft(distribution(samples).p95Ms).toBeLessThan(1000);
  const pages = flowPages();
  await command(p, 'project.batch', {
    operations: pages.map(value => ({
      kind: 'put',
      entity: 'page',
      id: value.id,
      value
    }))
  });
  p = await current(p.name);
  for (let i = 0; i < 30; i++) {
    await command(p, 'form.construct', {
      pageId: pages[Math.floor(i / 3)]!.id,
      kind: 'Grid',
      source: {
        kind: 'table',
        id: table.id
      },
      fieldIds: table.columns.map(c => c.id),
      keyIds: [],
      actions: [],
      links: [],
      style: {
        label: 'Browse ' + i
      },
      actionDefinitions: [0, 1].map(() => ({
        operation: 'navigate',
        destination: {
          pageId: pages[(Math.floor(i / 3) + 1) % 10]!.id,
          keyMapping: [],
          filterMapping: []
        }
      }))
    });
    p = await current(p.name);
  }
  await page.reload();
  await keyButton(page, 'Flow map');
  const map = page.getByRole('region', {
    name: 'Application behavior map'
  });
  await expect(map).toContainText('100 nodes');
  await map.getByText(/^Keyboard behavior list/).focus();
  await page.keyboard.press('Enter');
  const item = map.getByRole('group', {
    name: 'Selectable behavior list'
  }).getByRole('button', {
    name: 'page: Flow area 0 · /flow-0 · public',
    exact: true
  });
  await item.focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 20; i++) {
    await keyText(page, 'Title', 'Flow draft ' + i);
    await expect(map).toHaveAttribute('data-selection', pages[0]!.id);
    await expect(map.locator('.react-flow__node[data-id="' + pages[0]!.id + '"]')).toContainText('Flow draft ' + i);
  }
  await keyButton(page, 'Pan left');
  await keyButton(page, 'Zoom in');
  await keyButton(page, 'Fit visible');
  await keyButton(page, '▣ Save');
  await expect(page.getByRole('status')).toContainText('Saved');
  p = await current(p.name);
  expect(p.pages[0]?.title).toBe('Flow draft 19');
  record(info, 'flow-scale', {
    nodes: 100,
    edits: 20,
    lostDrafts: 0,
    lostSelections: 0
  });
  await page.screenshot({
    path: info.outputPath('flow-scale.png')
  });
});
