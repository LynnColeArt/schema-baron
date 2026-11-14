import { test, expect, chromium } from "@playwright/test";
import Database from "better-sqlite3";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Page as BrowserPage } from "@playwright/test";
import type { Project } from "@schema-baron/model";
test.use({ actionTimeout:15000, trace: "off", viewport: { width: 1280, height: 800 } });
let root: string,
  url: string,
  capability: string,
  child: ReturnType<typeof spawn>,
  mcp: Client;
let exit: Promise<unknown>;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "baron-forms-e2e-"));
  capability = randomBytes(32).toString("base64url");
  const config = join(root, "owner.json");
  writeFileSync(
    config,
    JSON.stringify({
      ownerId: "workspace-test",
      capability,
      metadataRoot: join(root, "metadata"),
      approvedRoots: { projects: join(root, "definitions"), output: join(root,"outputs") },
    }),
    { mode: 0o600 },
  );
  mkdirSync(join(root,"outputs"));
  mkdirSync(join(root,"definitions"));
  const db=new Database(join(root,"definitions","catalog.sqlite"));
  db.exec("CREATE TABLE visitor_records(user_id TEXT PRIMARY KEY NOT NULL, account TEXT NOT NULL UNIQUE, secret_hash TEXT NOT NULL);CREATE TABLE entries(id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL);INSERT INTO entries VALUES ('west','Original');");db.close();
  child = spawn(process.execPath, [resolve("apps/studio/dist/main.js")], {
    env: { ...process.env, PORT: "0", SCHEMA_BARON_BROWSER_MODE: 'capability', SCHEMA_BARON_OWNER_CONFIG: config },
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
  mcp = new Client({ name: "forms-proof", version: "1" });
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
async function wizard(page:BrowserPage,kind:string,label:string,source:string,success?:string,linked?:string){
 await page.getByRole('button',{name:'＋ Form',exact:true}).click();await page.getByLabel('Form label',{exact:true}).fill(label);await page.getByLabel('Form kind',{exact:true}).selectOption(kind);
 if(kind!=='Login')await page.getByRole('dialog').getByLabel('Data source',{exact:true}).selectOption('table:'+source);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 if(kind!=='Login'){const fields=page.getByRole('group',{name:'Fields, in selection order'}).getByRole('checkbox');for(let i=0;i<await fields.count();i++)await fields.nth(i).check();await page.getByRole('button',{name:'Use complete primary key'}).click();}
 await page.getByRole('button',{name:'Next',exact:true}).click();if(success){await page.getByLabel('Success / navigation destination',{exact:true}).selectOption(success);await page.getByLabel('Cancel destination',{exact:true}).selectOption(success);}if(linked)await page.getByLabel('Linked Record page',{exact:true}).selectOption(linked);
 await page.getByRole('button',{name:'Next',exact:true}).click();if(kind==='Grid')await page.getByLabel('Search title',{exact:true}).selectOption('contains');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Finish',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();
}
test.setTimeout(240000);
test('visible secure authoring produces independent public read/protected write app with login return',async({page,browser},info)=>{
 await connect(page);await create(page,'Visitor catalog');
 await page.getByRole('button',{name:'Connections…',exact:true}).click();await page.getByLabel('Relative SQLite file').fill('catalog.sqlite');await page.getByRole('button',{name:'Inspect SQLite file'}).click();await page.getByRole('button',{name:'Bind inspected database'}).click();await expect(page.getByRole('dialog')).toBeHidden();
 const summary=(await owner('projects?approvedRoot=projects'))[0];const snapshot=async():Promise<Project>=>owner('projects/'+summary.id);
 await addPage(page,'Public catalog','/');await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
 await addPage(page,'Edit entry','/edit');await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
 await addPage(page,'Visitor login','/login');await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
 let p=await snapshot();const list=p.pages.find(p=>p.route==='/')!,record=p.pages.find(p=>p.route==='/edit')!,login=p.pages.find(p=>p.route==='/login')!,table=p.schema.tables[0]!;
 // Select each ordinary Explorer page; construct forms with the product wizard.
 await page.getByRole('treeitem').filter({hasText:'Public catalog'}).first().dblclick();await wizard(page,'Grid','Catalog',table.id,undefined,record.id);
 await page.getByRole('treeitem').filter({hasText:'Catalog record'}).first().dblclick();await page.getByRole('tab',{name:'Data',exact:true}).click();await page.getByRole('group',{name:'Record name fields for delete confirmation'}).getByLabel('title',{exact:true}).check();await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
 await page.getByRole('treeitem').filter({hasText:'Visitor login'}).first().dblclick();await wizard(page,'Login','Visitor access',table.id,list.id);
 p=await snapshot();for(const [operation,label] of [['login','Sign in'],['logout','Sign out']]){const a=p.actions.find(a=>a.operation===operation)!;const c=p.controls.find(c=>c.events.some(e=>e.actionId===a.id))!;await page.locator(`[data-object-id="${c.id}"]`).dblclick();await page.getByRole('tab',{name:'Format',exact:true}).click();await page.getByLabel('Label',{exact:true}).fill(label!);await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');}
 await page.getByRole('button',{name:'Login and access…',exact:true}).click();await page.getByRole('button',{name:'Save identity source',exact:true}).click();await expect(page.getByText('Security settings saved.',{exact:true})).toBeVisible();
 const username=crypto.randomUUID(),secret=crypto.randomUUID()+crypto.randomUUID();await page.getByLabel('Visitor username',{exact:true}).fill(username);await page.getByLabel('Visitor password',{exact:true}).fill(secret);await page.getByRole('button',{name:'Provision user',exact:true}).click();await expect(page.getByText('User provisioned. Credentials were cleared.',{exact:true})).toBeVisible();await expect(page.getByLabel('Visitor password',{exact:true})).toHaveValue('');
 p=await snapshot();for(const target of [list,record]){const f=p.forms.find(f=>f.pageId===target.id)!;await page.getByLabel('Header form').selectOption(f.id);await page.getByRole('button',{name:'Place identity in page header'}).click();await expect.poll(async()=> (await snapshot()).controls.filter(c=>c.kind==='identity'&&!c.credentialRole).length).toBe(target.id===list.id?1:2);}
 await page.getByLabel('Policy page').selectOption(record.id);await page.getByLabel('Page access',{exact:true}).selectOption('authenticated');await expect(page.getByText('Sign in required · from page policy',{exact:true}).first()).toBeVisible();p=await snapshot();for(const a of p.actions.filter(a=>p.forms.some(f=>f.id===a.formId&&f.pageId===record.id)&&['insert','update','delete'].includes(a.operation))){await page.getByLabel(`Access for ${a.operation} ${a.id}`,{exact:true}).selectOption('authenticated');await expect.poll(async()=> (await snapshot()).policies.find(policy=>policy.ownerId===a.id)?.access).toBe('authenticated');}
 await page.screenshot({path:info.outputPath('access-inheritance.png')});await page.getByRole('button',{name:'Close',exact:true}).click();
 // Reopen from saved state; no browser draft can stand in for persisted policy.
 await page.reload();await expect(page.getByRole('button',{name:'Login and access…',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Login and access…',exact:true}).click();await page.getByLabel('Policy page').selectOption(record.id);await expect(page.getByLabel('Page access',{exact:true})).toHaveValue('authenticated');await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Generate…',exact:true}).click();await page.getByLabel('Output location').fill('output:application');await page.getByRole('button',{name:'Preview files',exact:true}).click();await expect(page.getByRole('button',{name:'Create application',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Create application',exact:true}).click();await expect(page.getByText(/Application created/)).toBeVisible();
 const output=join(root,'outputs','application'),env={PATH:dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME??'',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'},npm=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');
 for(const args of [['ci','--ignore-scripts','--offline'],['run','typecheck'],['test'],['run','build']]){const result=spawnSync(process.execPath,[npm,...args],{cwd:output,env,encoding:'utf8',timeout:120000,maxBuffer:5000000});writeFileSync(info.outputPath('output-'+args[0]+'-'+(args[1]??'')+'.log'),(result.stdout??'')+(result.stderr??''));expect(result.status,(result.stdout??'')+(result.stderr??'')).toBe(0);}
 const runtime=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','0'],{cwd:output,env,stdio:['ignore','pipe','pipe']});let logs='',origin='';runtime.stdout.on('data',chunk=>{logs+=chunk.toString();origin=logs.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]??'';});runtime.stderr.on('data',chunk=>{logs+=chunk.toString();});
 try{await expect.poll(()=>origin).not.toBe('');const grid=(await snapshot()).forms.find(f=>f.kind==='Grid')!,titleId=table.columns.find(c=>c.physicalName==='title')!.id;const filterQuery=new URLSearchParams({[grid.id+':filter:'+titleId]:'r'}).toString();const visitor=await browser.newContext();const app=await visitor.newPage();await app.goto(origin+'?'+filterQuery);await expect(app.getByText('Original',{exact:true})).toBeVisible();await expect(app.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
 const link=app.getByRole('link',{name:/Open|Edit|View|navigate/}).first();await link.click();await expect(app.getByText('Sign in to continue to the selected page.',{exact:false})).toBeVisible();expect(app.url()).toContain('returnTo=');await app.getByRole('link',{name:'cancel',exact:true}).click();await expect(app).toHaveURL(origin+'/?'+filterQuery);await app.getByRole('link',{name:'Edit record',exact:true}).click();await expect(app.getByText('Sign in to continue to the selected page.',{exact:false})).toBeVisible();await app.screenshot({path:info.outputPath('friendly-selected-record-login.png')});
 await app.getByLabel('Username',{exact:true}).fill(username);await app.getByLabel('Password',{exact:true}).fill('wrong trial');await app.getByRole('button',{name:'Sign in',exact:true}).click();await expect(app.getByText('Sign in failed. Try again later.',{exact:true})).toBeVisible();await expect(app.getByLabel('Username',{exact:true})).toHaveValue(username);await expect(app.getByLabel('Password',{exact:true})).toHaveValue('');const authProject=await snapshot(),authCancel=authProject.actions.find(a=>a.operation==='cancel'&&a.formId===authProject.forms.find(f=>f.kind==='Login')?.id)!;const nonce=(await (await visitor.request.get(origin+'/runtime/auth/csrf')).json()).csrf as string;const cancelRequest=await visitor.request.post(origin+'/runtime/auth',{headers:{origin},form:{_action:authCancel.id,_csrf:nonce,returnTo:'/'}});expect(cancelRequest.status()).toBe(403);await app.getByLabel('Password',{exact:true}).fill(secret);await app.getByRole('button',{name:'Sign in',exact:true}).click();await expect(app).toHaveURL(/\/edit\?/);expect(new URL(app.url()).searchParams.get(grid.id+':filter:'+titleId)).toBe('r');expect(app.url()).toContain('west');await expect(app.getByRole('banner')).toContainText(username);await app.getByLabel('title',{exact:true}).fill('Updated through login');await app.getByRole('button',{name:'Save',exact:true}).click();await expect(app).toHaveURL(origin+'/?'+filterQuery);await expect(app.getByText('Updated through login',{exact:true})).toBeVisible();await app.screenshot({path:info.outputPath('signed-in-public-list.png')});
 const activeCookies=await visitor.cookies();await app.getByRole('button',{name:'Sign out',exact:true}).click();await expect(app).toHaveURL(origin+'/');await expect(app.getByRole('banner')).not.toContainText(username);await expect(app.getByText('Updated through login',{exact:true})).toBeVisible();
 const configs=JSON.parse(readFileSync(join(output,'server','record-1.ts'),'utf8').split('export const config = ')[1]!.split(' as const;')[0]!);const tokenCookie=activeCookies.find(c=>!c.name.endsWith('_csrf')&&c.name.startsWith('visitor_'))!,csrfCookie=activeCookies.find(c=>c.name.endsWith('_csrf'))!;for(const action of configs.actions.filter((a:{operation:string})=>['insert','update','delete'].includes(a.operation))){const response=await fetch(origin+'/runtime/record-1',{method:'POST',headers:{origin,'content-type':'application/json',cookie:activeCookies.map(c=>c.name+'='+c.value).join('; '),'x-csrf-token':csrfCookie.value},body:JSON.stringify({action:action.id,parameters:{},input:{}})});expect(response.status).toBe(401);}expect(tokenCookie).toBeDefined();const oracle=new Database(join(root,'definitions','catalog.sqlite'),{readonly:true});expect(oracle.prepare('SELECT title FROM entries WHERE id=?').pluck().get('west')).toBe('Updated through login');oracle.close();
 const saved=JSON.stringify(await snapshot());expect(saved.includes(secret)).toBe(false);await visitor.close();
 }finally{runtime.kill('SIGTERM');}
});
test('native 200 percent zoom keeps identity setup keyboard reachable',async({},info)=>{
 const profile=mkdtempSync(join(root,'zoom-profile-'));mkdirSync(join(profile,'Default'));writeFileSync(join(profile,'Default','Preferences'),JSON.stringify({partition:{default_zoom_level:{x:Math.log(2)/Math.log(1.2)}}}));
 const context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',viewport:{width:1280,height:800},args:['--window-size=1280,800','--force-device-scale-factor=1','--no-sandbox']});
 try{const page=context.pages()[0]!;await connect(page);await create(page,'Keyboard security');await page.getByRole('button',{name:'Connections…',exact:true}).click();await page.getByLabel('Relative SQLite file').fill('catalog.sqlite');await page.getByRole('button',{name:'Inspect SQLite file'}).click();await page.getByRole('button',{name:'Bind inspected database'}).click();await expect(page.getByRole('dialog')).toBeHidden();await page.getByRole('button',{name:'Login and access…',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.getByLabel('Source type').focus();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Save identity source',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByText('Security settings saved.',{exact:true})).toBeVisible();await page.keyboard.press('Tab');await expect(page.getByLabel('Visitor username',{exact:true})).toBeFocused();await page.keyboard.type(crypto.randomUUID());await page.keyboard.press('Tab');await expect(page.getByLabel('Visitor password',{exact:true})).toBeFocused();await page.keyboard.type(crypto.randomUUID()+crypto.randomUUID());await page.keyboard.press('Tab');await page.keyboard.press('Enter');await expect(page.getByText('User provisioned. Credentials were cleared.',{exact:true})).toBeVisible();await expect(page.getByLabel('Visitor password',{exact:true})).toHaveValue('');await page.screenshot({path:info.outputPath('security-native-200.png'),scale:'device'});const metrics=await page.evaluate(()=>({innerWidth,innerHeight,devicePixelRatio,cssZoom:getComputedStyle(document.documentElement).zoom,viewportWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));expect(metrics).toMatchObject({innerWidth:640,innerHeight:400,devicePixelRatio:2,cssZoom:'1'});expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);writeFileSync(info.outputPath('native-200-metrics.json'),JSON.stringify(metrics,null,2));await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();await expect(page.getByRole('button',{name:'Login and access…',exact:true})).toBeFocused();}finally{await context.close();}
});
test('mapped identity setup validates fields and clears failed provision credentials',async({page})=>{
 await connect(page);await create(page,'Mapped visitors');await page.getByRole('button',{name:'Connections…',exact:true}).click();await page.getByLabel('Relative SQLite file').fill('catalog.sqlite');await page.getByRole('button',{name:'Inspect SQLite file'}).click();await page.getByRole('button',{name:'Bind inspected database'}).click();await expect(page.getByRole('dialog')).toBeHidden();
 const summary=(await owner('projects?approvedRoot=projects')).find((s:{name:string})=>s.name==='Mapped visitors');const snapshot=async():Promise<Project>=>owner('projects/'+summary.id);const p=await snapshot(),table=p.schema.tables.find(t=>t.physicalName==='visitor_records')!;const field=(name:string)=>table.columns.find(c=>c.physicalName===name)!.id;
 await page.getByRole('button',{name:'Login and access…',exact:true}).click();await page.getByLabel('Source type').selectOption('mapped');await page.getByLabel('Identity table',{exact:true}).selectOption(table.id);for(const label of ['User ID field','Username field','Password hash field'])await page.getByLabel(label,{exact:true}).selectOption(field('user_id'));await page.getByRole('button',{name:'Save identity source',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Mapped identity');expect((await snapshot()).identity).toBeUndefined();
 await page.getByLabel('Username field',{exact:true}).selectOption(field('account'));await page.getByLabel('Password hash field',{exact:true}).selectOption(field('secret_hash'));await page.getByRole('button',{name:'Save identity source',exact:true}).click();await expect(page.getByText('Security settings saved.',{exact:true})).toBeVisible();const username=crypto.randomUUID(),secret=crypto.randomUUID()+crypto.randomUUID();await page.getByLabel('Visitor username',{exact:true}).fill(username);await page.getByLabel('Visitor password',{exact:true}).fill(secret);await page.getByRole('button',{name:'Provision user',exact:true}).click();await expect(page.getByText('User provisioned. Credentials were cleared.',{exact:true})).toBeVisible();await page.getByLabel('Visitor password',{exact:true}).fill(crypto.randomUUID());await page.getByRole('button',{name:'Provision user',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Provisioning could not complete');await expect(page.getByLabel('Visitor password',{exact:true})).toHaveValue('');const db=new Database(join(root,'definitions','catalog.sqlite'),{readonly:true});const hash=db.prepare('SELECT secret_hash FROM visitor_records WHERE account=?').pluck().get(username) as string;expect(/^scrypt\$1\$/.test(hash)).toBe(true);expect(hash.includes(secret)).toBe(false);expect(db.prepare('SELECT count(*) FROM visitor_records WHERE account=?').pluck().get(username)).toBe(1);db.close();expect(JSON.stringify(await snapshot()).includes(secret)).toBe(false);
});
