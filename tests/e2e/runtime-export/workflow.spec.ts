import { test, expect } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createId } from '@schema-baron/model';
import type { Project } from '@schema-baron/model';
test.use({
  trace: 'off',
  actionTimeout: 20000,
  viewport: {
    width: 1440,
    height: 1100
  }
});
test('UI/MCP authoring, managed commands and selected route share authority; export survives owner shutdown', async ({
  page
}, info) => {
  test.setTimeout(240000);
  const root = mkdtempSync(join(tmpdir(), 'wp21-browser-')),
    capability = crypto.randomUUID() + crypto.randomUUID();
  mkdirSync(join(root, 'definitions'));
  mkdirSync(join(root, 'output'));
  const db = new Database(join(root, 'definitions', 'records.sqlite'));
  db.exec("CREATE TABLE records(code TEXT PRIMARY KEY NOT NULL,caption TEXT NOT NULL);INSERT INTO records VALUES('A','Independent row')");
  db.close();
  const config = join(root, 'owner.json');
  writeFileSync(config, JSON.stringify({
    ownerId: 'browser-owner',
    capability,
    metadataRoot: join(root, 'metadata'),
    approvedRoots: {
      projects: join(root, 'definitions'),
      output: join(root, 'output')
    }
  }), {
    mode: 0o600
  });
  const child = spawn(process.execPath, [resolve('apps/studio/dist/main.js')], {
    env: {
      ...process.env,
      PORT: '0',
      SCHEMA_BARON_OWNER_CONFIG: config
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const exited = once(child, 'exit');
  let ownerStopped = false;
  const mcp = new Client({
    name: 'wp21-real-proof',
    version: '1'
  });
  let logs = '';
  child.stderr!.on('data', chunk => logs += String(chunk));
  let url = '';
  for (let i = 0; i < 200; i++) {
    const match = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);
    if (match) {
      url = match[1]!;
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  expect(url, logs).not.toBe('');
  const mcpConfig = join(root, 'mcp.json');
  writeFileSync(mcpConfig, JSON.stringify({
    ownerUrl: url,
    capability
  }), {
    mode: 0o600
  });
  await mcp.connect(new StdioClientTransport({
    command: process.execPath,
    args: [resolve('apps/mcp/dist/main.js')],
    env: {
      SCHEMA_BARON_MCP_CONFIG: mcpConfig
    },
    stderr: 'pipe'
  }));
  let project: Project;
  const snapshot = async () => {
    project = (await (await fetch(url + '/api/v1/projects/' + project.id, {
      headers: {
        authorization: 'Bearer ' + capability
      }
    })).json()).result;
    return project;
  };
  const command = async (operation: string, input: unknown) => {
    const reply = await mcp.callTool({
      name: operation.replaceAll('.', '_'),
      arguments: {
        projectId: project.id,
        requestId: createId(),
        expectedRevision: project.revision,
        input
      }
    });
    const outcome = reply.structuredContent as any;
    expect(outcome, JSON.stringify(outcome)).toMatchObject({
      ok: true
    });
    await snapshot();
    return outcome.result;
  };
  try {
    await page.goto(url);
    await page.getByLabel('Studio service owner key').fill(capability);
    await page.getByRole('button', {
      name: 'Connect',
      exact: true
    }).click();
    await page.getByRole('button', {
      name: 'New project…',
      exact: true
    }).click();
    await page.getByLabel('Project name', {
      exact: true
    }).fill('Managed portable records');
    await page.getByRole('button', {
      name: 'Create project',
      exact: true
    }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    const list = (await (await fetch(url + '/api/v1/projects?approvedRoot=projects', {
      headers: {
        authorization: 'Bearer ' + capability
      }
    })).json()).result;
    project = {
      id: list[0].id
    } as Project;
    await snapshot();
    const inspected = await command('connection.inspect', {
      approvedPath: 'projects:records.sqlite',
      mode: 'read-only'
    });
    await command('connection.bind', {
      connectionId: inspected.connection.id,
      fingerprint: inspected.connection.fingerprint
    });
    await expect(page.getByText('Schema · 1 tables', {
      exact: true
    })).toBeVisible();
    await page.getByRole('button', {
      name: '＋ Page',
      exact: true
    }).click();
    await page.getByLabel('Page title', {
      exact: true
    }).fill('Runtime record');
    await page.getByLabel('Internal route', {
      exact: true
    }).fill('/record');
    await page.getByRole('button', {
      name: 'Add page',
      exact: true
    }).click();
    await page.getByRole('button', {
      name: '▣ Save',
      exact: true
    }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await snapshot();
    const record = project.pages.find(p => p.title === 'Runtime record')!,
      saved = createId();
    await command('project.batch', {
      operations: [{
        kind: 'put',
        entity: 'page',
        id: saved,
        value: {
          id: saved,
          title: 'Saved',
          route: '/saved',
          document: [{
            kind: 'text',
            text: 'Complete'
          }],
          formIds: []
        }
      }]
    });
    const table = project.schema.tables[0]!;
    await command('form.construct', {
      pageId: record.id,
      kind: 'Record',
      source: {
        kind: 'table',
        id: table.id
      },
      fieldIds: table.columns.map(c => c.id),
      keyIds: table.primaryKey,
      actions: ['insert', 'update', 'cancel'],
      links: [],
      style: {
        label: 'Runtime record'
      },
      actionDefinitions: [{
        operation: 'insert',
        success: {
          pageId: saved,
          keyMapping: [],
          filterMapping: []
        }
      }, {
        operation: 'update',
        success: {
          pageId: saved,
          keyMapping: [],
          filterMapping: []
        }
      }, {
        operation: 'cancel',
        destination: {
          pageId: saved,
          keyMapping: [],
          filterMapping: []
        }
      }]
    });
    await expect(page.getByText('r' + project.revision + ' · 0 dirty objects', {
      exact: true
    })).toBeVisible();
    await page.getByRole('button', {
      name: 'Generate…',
      exact: true
    }).click();
    await page.getByLabel('Output location').fill('output:app');
    await page.getByRole('button', {
      name: 'Preview files',
      exact: true
    }).click();
    await expect(page.getByText(/files to create/)).toBeVisible();
    await page.getByRole('button', {
      name: 'Create application',
      exact: true
    }).click();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created');
    await page.getByRole('button', {
      name: 'Close',
      exact: true
    }).click();
    await page.getByRole('tablist', {
      name: 'Document modes',
      exact: true
    }).getByRole('tab', {
      name: 'HTML',
      exact: true
    }).click();
    const html = page.getByLabel('HTML source');
    const draft = (await html.inputValue()) + '<p>Unapplied current draft</p>';
    await html.fill(draft);
    await expect(page.getByRole('region', {
      name: 'Managed generated runtime'
    })).toContainText('unsaved draft retained');
    const npm = '/home/lynn/.nvm/versions/node/v24.22.1/lib/node_modules/npm/bin/npm-cli.js';
    expect(spawnSync(process.execPath, [npm, 'ci', '--ignore-scripts', '--offline'], {
      cwd: join(root, 'output/app'),
      encoding: 'utf8'
    }).status).toBe(0);
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/commands') && response.request().postDataJSON()?.operation === 'runtime.start');
    await page.getByRole('button', {
      name: 'Build generated output',
      exact: true
    }).click();
    const response = await responsePromise,
      ui = await response.json(),
      sent = response.request().postDataJSON();
    const replay = await mcp.callTool({
      name: 'runtime_start',
      arguments: {
        projectId: project.id,
        requestId: sent.requestId,
        expectedRevision: sent.expectedRevision,
        input: sent.input
      }
    });
    expect(replay.structuredContent).toEqual(ui);
    await expect(page.getByRole('button', {
      name: 'Start / retry',
      exact: true
    })).toBeEnabled({
      timeout: 90000
    });
    await page.getByLabel('Runtime port').fill('32191');
    await page.getByRole('button', {
      name: 'Start / retry',
      exact: true
    }).click();
    await expect.poll(async () => (await command('runtime.status', {})).status).toBe('running');
    await page.getByRole('tablist', {
      name: 'Document modes',
      exact: true
    }).getByRole('tab', {
      name: 'Live Page',
      exact: true
    }).click();
    const form = project.forms.find(f => f.kind === 'Record')!,
      key = form.id + ':key:' + table.primaryKey[0];
    const descriptors = await command('runtime.context', {
      generatedRevision: 1,
      pageId: record.id
    });
    const descriptor = descriptors.fields.find((field: any) => field.parameter === key);
    expect(descriptor.label).toBe('Runtime record · code');
    await expect(page.getByRole('region', {
      name: 'Diagnostic messages'
    })).not.toContainText('Generate the application');
    await page.getByLabel('Runtime record · code', {
      exact: true
    }).fill('A');
    const visitor = page.waitForEvent('popup');
    await page.getByRole('button', {
      name: 'Open selected generated page',
      exact: true
    }).click();
    const live = await visitor;
    await live.waitForURL(/\/record\?/);
    const route = live.url();
    expect(route).toContain('/record?');
    await expect(live.getByLabel('caption', {
      exact: true
    })).toHaveValue('Independent row');
    await expect(live.locator('body')).not.toContainText(capability);
    await expect(live.locator('body')).not.toContainText('Unapplied current draft');
    expect(await html.inputValue()).toBe(draft);
    await live.close();
    await page.getByLabel('Runtime record · record mode', {
      exact: true
    }).selectOption('new');
    await expect(page.getByLabel('Runtime record · code', {
      exact: true
    })).toBeDisabled();
    const newVisitor = page.waitForEvent('popup');
    await page.getByRole('button', {
      name: 'Open selected generated page',
      exact: true
    }).click();
    const creating = await newVisitor;
    await creating.waitForURL(/mode=new/);
    await expect(creating.getByLabel('caption', {
      exact: true
    })).toHaveValue('');
    await creating.close();
    await page.getByLabel('Runtime record · record mode', {
      exact: true
    }).selectOption('existing');
    await page.screenshot({
      path: info.outputPath('runtime-live-page.png')
    });
    await page.getByRole('button', {
      name: 'Stop runtime',
      exact: true
    }).click();
    await expect.poll(async () => (await command('runtime.status', {})).status).toBe('stopped');
    await page.getByText('Portable definition and output export', {
      exact: true
    }).click();
    await page.getByLabel('Export destination').fill('output:portable');
    await page.getByRole('checkbox', {
      name: /I reviewed including/
    }).check();
    await page.getByRole('button', {
      name: 'Export portable application',
      exact: true
    }).click();
    await expect(page.getByRole('alert').filter({
      hasText: 'Portable export created'
    })).toBeVisible();
    await mcp.close();
    child.kill('SIGTERM');
    await exited;
    ownerStopped = true;
    expect(await fetch(url).then(() => true, () => false)).toBe(false);
    const portable = join(root, 'output/portable/app');
    for (const args of [['ci', '--ignore-scripts', '--offline'], ['run', 'typecheck'], ['test'], ['run', 'build']]) {
      const result = spawnSync(process.execPath, [npm, ...args], {
        cwd: portable,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          NEXT_TELEMETRY_DISABLED: '1'
        },
        encoding: 'utf8'
      });
      writeFileSync(info.outputPath('portable-' + args.join('-') + '.log'), result.stdout + result.stderr);
      expect(result.status, result.stdout + result.stderr).toBe(0);
    }
    const deployed = spawn(process.execPath, ['./node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '32192'], {
      cwd: portable,
      env: {
        PATH: process.env.PATH,
        NEXT_TELEMETRY_DISABLED: '1'
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    try {
      await expect.poll(async () => fetch('http://127.0.0.1:32192/record?' + new URLSearchParams({
        [key]: 'A'
      })).then(r => r.text(), () => ''), {
        timeout: 20000
      }).toContain('Independent row');
      const proof = JSON.stringify({
        root,
        route,
        uiMcpSame: true,
        studioStopped: true,
        portable: portable,
        recordRow: 'Independent row'
      });
      writeFileSync(info.outputPath('proof.json'), proof);
      expect(readFileSync(join(portable, 'server/connection.ts'), 'utf8')).not.toContain(root);
    } finally {
      if (deployed.pid) process.kill(-deployed.pid, 'SIGTERM');
      await once(deployed, 'close');
    }
  } finally {
    await mcp.close();
    if (!ownerStopped) {
      child.kill('SIGTERM');
      await exited;
    }
  }
});
