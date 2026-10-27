import { pinnedNpmCli, pinnedBinPath } from '../../../scripts/release/toolchain.mjs';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createId } from '@schema-baron/model';
import type { Project } from '@schema-baron/model';
test.setTimeout(240000);
test.use({actionTimeout:15000});
test.use({
  trace: 'off',
  viewport: {
    width: 1280,
    height: 800
  }
});
let root: string, url: string, capability: string, child: ReturnType<typeof spawn>, exit: Promise<unknown>, mcp: Client;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'wp10-browser-'));
  capability = randomBytes(32).toString('base64url');
  const config = join(root, 'owner.json');
  writeFileSync(config, JSON.stringify({
    ownerId: 'schema-test',
    capability,
    metadataRoot: join(root, 'metadata'),
    approvedRoots: {
      projects: join(root, 'definitions'), output: join(root, 'output')
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
  // Retain standalone outputs and redacted evidence for independent review.
  writeFileSync('/tmp/wp10-last-browser-root.txt',root);
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
async function authored(page:Page,name:string,tableName:string,route:string) {
 const id=await start(page,name);
 await page.getByRole('button',{name:'Connections…',exact:true}).click();await page.getByLabel('Database choice').selectOption('empty');await page.getByLabel('Relative SQLite file').fill(name+'.sqlite');await page.getByRole('button',{name:'Inspect SQLite file'}).click();await expect(page.getByText('0 tables · 0 read-only unsupported objects')).toBeVisible();await page.getByRole('button',{name:'Bind inspected database'}).click();await expect(page.getByRole('dialog')).toBeHidden();
 await page.getByRole('button',{name:'Schema',exact:true}).click();await table(page,tableName);await column(page,'code',name==='publications'?'integer':'text',false);await column(page,'description','text',false);await tab(page,'Keys');await page.getByLabel('code',{exact:true}).check();await save(page);
 await page.getByRole('button',{name:'Review migration…',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByText('CREATE TABLE',{exact:false}).first()).toBeVisible();await page.getByRole('button',{name:'Apply reviewed migration',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();expect((await snapshot(id)).connections[0]?.inspectedSchema?.tables.length).toBe(1);
 await page.getByRole('button',{name:'Schema',exact:true}).click();await page.getByRole('button',{name:'＋ Page',exact:true}).click();await page.getByLabel('Page title',{exact:true}).fill(name+' list');await page.getByLabel('Internal route',{exact:true}).fill(route);await page.getByRole('button',{name:'Add page',exact:true}).click();await page.getByRole('button',{name:'＋ Form',exact:true}).click();await page.getByLabel('Form label',{exact:true}).fill(name+' records');await page.getByLabel(/Form kind/).selectOption('Grid');await page.getByLabel(/Data source \(required for data forms\)/).selectOption({label:'Table: '+tableName});await page.getByRole('button',{name:'Add form',exact:true}).click();
 await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.getByRole('button',{name:'◇ Label',exact:true}).click();await page.getByLabel('Label',{exact:true}).fill('Description');await page.getByRole('tab',{name:'Data',exact:true}).click();await page.getByLabel('Bound field',{exact:true}).selectOption({label:'description'});await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
 const p=await snapshot(id);expect(p.pages).toHaveLength(1);expect(p.forms[0]?.sourceRef?.id).toBe(p.schema.tables[0]?.id);expect(p.controls[0]?.binding).toEqual({kind:'stored',fieldId:p.schema.tables[0]!.columns[1]!.id});
 // Explicit test rows after UI schema/page authoring: this is data, not construction.
 const db=new Database(join(root,'definitions',name+'.sqlite'));db.prepare('INSERT INTO "'+tableName.replaceAll('"','""')+'"("code","description") VALUES(?,?)').run(name==='publications'?1:'A',name+' actual row');db.close();
 await page.getByRole('button',{name:'Generate…',exact:true}).click();await page.getByLabel('Output location').fill('output:'+name);await page.getByRole('button',{name:'Preview files',exact:true}).click();await expect(page.getByText(/files to create/)).toBeVisible();await page.getByText('Create app'+route+'/page.tsx',{exact:true}).click();await expect(page.locator('pre').filter({hasText:'export default async function Page'})).toBeVisible();await page.screenshot({path:`tests/e2e/first-output/${name}-review.png`});
 // MCP creates a real preview for the same authored source. The actual UI apply
 // request is replayed below to assert exact cross-transport outcome parity.
 const outcome=await mcp.callTool({name:'generation_preview',arguments:{requestId:createId(),projectId:id,expectedRevision:p.revision,input:{target:p.target,outputRoot:'output:'+name+'-mcp',projectRevision:p.revision}}});expect(outcome.structuredContent).toMatchObject({ok:true,result:{kind:'generation',sourceRevision:p.revision}});
 const appliedResponse=page.waitForResponse(response=>response.url().endsWith('/commands')&&response.request().postDataJSON()?.operation==='generation.apply');
 await page.getByRole('button',{name:'Create application',exact:true}).click();const response=await appliedResponse;const uiOutcome=await response.json();const uiCommand=response.request().postDataJSON() as {requestId:string;expectedRevision:number;input:unknown};const sameOutcome=await mcp.callTool({name:'generation_apply',arguments:{requestId:uiCommand.requestId,projectId:id,expectedRevision:uiCommand.expectedRevision,input:uiCommand.input}});expect(sameOutcome.structuredContent).toEqual(uiOutcome);await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created');await page.screenshot({path:`tests/e2e/first-output/${name}-created.png`});await page.getByRole('button',{name:'Close',exact:true}).click();
 return {id,p,path:join(root,'output',name),database:join(root,'definitions',name+'.sqlite'),route,name};
}
function run(command:string,args:string[],cwd:string,log:string) {const result=spawnSync(command,args,{cwd,env:{PATH:pinnedBinPath,HOME:process.env.HOME!,NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_registry:'https://registry.npmjs.org/',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'},encoding:'utf8',timeout:90000,maxBuffer:5*1024*1024});writeFileSync(log,(result.stdout??'')+(result.stderr??''));expect(result.error,log).toBeUndefined();expect(result.status,log).toBe(0);}
test('two visibly authored applications build and read real SQLite after Studio stops',async({page})=>{
 const first=await authored(page,'instruments','instrument register','/inventory');
 // A new browser context starts with no hidden model/session seed.
 const context=await page.context().browser()!.newContext({viewport:{width:1280,height:800}});const second=await authored(await context.newPage(),'publications','publication catalog','/catalog');await context.close();
 await mcp.close();child.kill('SIGTERM');await exit;
 for(const app of [first,second]) {
  const before=readFileSync(app.database);const npm=pinnedNpmCli;
  run(process.execPath,[npm,'ci','--ignore-scripts'],app.path,join(root,app.name+'-install.log'));
  for(const script of ['typecheck','test','build'])run(process.execPath,[npm,'run',script],app.path,join(root,app.name+'-'+script+'.log'));
  expect(readFileSync(app.database)).toEqual(before);
  const staticRoot=join(app.path,'.next','static');const scan=(path:string):string=>readdirSync(path,{withFileTypes:true}).map(e=>e.isDirectory()?scan(join(path,e.name)):readFileSync(join(path,e.name),'utf8')).join('');const client=scan(staticRoot);expect(client).not.toContain('better-sqlite3');expect(client).not.toContain(app.database);expect(client).not.toContain('APPLICATION_DATABASE_PATH');expect(client).not.toContain('node:sqlite');
  const runtime=spawn(process.execPath,[join(app.path,'node_modules/next/dist/bin/next'),'start','-p','0','-H','127.0.0.1'],{cwd:app.path,env:{PATH:pinnedBinPath,HOME:process.env.HOME!,NODE_PATH:''},stdio:['ignore','pipe','pipe']});let logs='';const appUrl=await new Promise<string>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Generated app readiness timeout: '+logs)),15000);runtime.stdout!.on('data',chunk=>{logs+=String(chunk);const match=logs.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve('http://127.0.0.1:'+match[1]);}});runtime.stderr!.on('data',c=>logs+=String(c));runtime.once('exit',()=>reject(Error(logs)));});
  try {await page.goto(appUrl+app.route);await expect(page.getByText(app.name+' actual row',{exact:true})).toBeVisible();await page.screenshot({path:`tests/e2e/first-output/${app.name}-standalone.png`});const grid=app.p.forms[0]!;await page.goto(appUrl+app.route+'?'+encodeURIComponent(grid.id+':sort')+'=forged');await expect(page.getByRole('alert').filter({hasText:'The list could not be read'})).toContainText('could not be read');const db=new Database(app.database);db.prepare('DELETE FROM "'+app.p.schema.tables[0]!.physicalName+'"').run();db.close();await page.goto(appUrl+app.route);await expect(page.getByText('No records found.')).toBeVisible();}finally{const exited=once(runtime,'exit');runtime.kill('SIGTERM');const stop=setTimeout(()=>runtime.kill('SIGKILL'),5000);await exited;clearTimeout(stop);}
 }
 writeFileSync(join(root,'demonstration.json'),JSON.stringify({studioStopped:true,applications:[first,second].map(a=>({projectId:a.id,route:a.route,path:a.path,database:a.database,revision:a.p.revision}))},null,2));
});
