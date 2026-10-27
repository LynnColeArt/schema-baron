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
async function auditMap(page:BrowserPage,path:string){if(!process.env.AXE_SOURCE)return;await page.addScriptTag({path:process.env.AXE_SOURCE});const result=await page.evaluate(async()=>{const axe=(window as unknown as {axe:{run:(context:unknown,options:unknown)=>Promise<{violations:{impact:string;id:string;nodes:unknown[]}[]}>}}).axe;return axe.run({include:[['.flow-map']]},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});});writeFileSync(path,JSON.stringify(result,null,2));expect(result.violations.filter(v=>v.impact==='critical'||v.impact==='serious')).toEqual([]);}
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
test('behavior map edits canonical edge mappings and matches standalone auth Save/Cancel handlers',async({page,browser},info)=>{
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

 await page.getByRole('button',{name:'Flow map',exact:true}).click();
 const map=page.getByRole('region',{name:'Application behavior map'});
 // Select the actual canonical edge, edit its mapping through ordinary Properties,
 // and inspect the rederived typed parameter immediately before saving.
 p=await snapshot();const navigation=p.actions.find(a=>a.operation==='navigate'&&a.destination?.pageId===record.id)!;
 const keyField=table.columns.find(c=>c.physicalName==='id')!,titleField=table.columns.find(c=>c.physicalName==='title')!;
 await map.getByText(/^Keyboard behavior list/).click();
 await map.getByRole('group',{name:'Selectable behavior list'}).getByRole('button',{name:new RegExp('destination.*'+navigation.id),exact:false}).click();
 await expect(page.getByRole('tab',{name:'Data',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByLabel('navigate destination keyMapping source 1',{exact:true}).selectOption(titleField.id);
 await expect(map.locator('.flow-details')).toContainText(titleField.id);
 await expect(map.locator('.flow-details')).toContainText('key:');
 await map.getByLabel('Focused neighbors',{exact:true}).check();await map.getByRole('button',{name:'Fit visible',exact:true}).click();await map.evaluate(element=>{element.scrollTop=0;});
 await page.getByLabel('navigate destination keyMapping source 1',{exact:true}).scrollIntoViewIfNeeded();await map.locator('.flow-details').scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('typed-edge-properties.png')});
 await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');expect((await snapshot()).actions.find(a=>a.id===navigation.id)!.destination!.keyMapping[0]!.expression).toMatchObject({kind:'field',fieldId:titleField.id});
 await page.getByLabel('navigate destination keyMapping source 1',{exact:true}).selectOption(keyField.id);
 await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');

 // Pointer selection invokes the same contextual Properties as the keyboard list.
 await map.getByRole('button',{name:'Fit visible',exact:true}).click();
 await map.locator('.react-flow__node').filter({hasText:'Edit entry'}).click();await expect(page.getByLabel('Route',{exact:true})).toHaveValue('/edit');
 const path=map.locator('.react-flow__edge[data-id="'+navigation.id+':destination"] .react-flow__edge-interaction');
 const point=await path.evaluate(async(element,id)=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const path=element as SVGPathElement;for(const fraction of [.25,.4,.5,.6,.75]){const p=path.getPointAtLength(path.getTotalLength()*fraction);const q=new DOMPoint(p.x,p.y).matrixTransform(path.getScreenCTM()!);if(document.elementFromPoint(q.x,q.y)?.closest('.react-flow__edge')?.getAttribute('data-id')===id)return {x:q.x,y:q.y};}return null;},navigation.id+':destination');expect(point,'Visible pointer hit target on projected edge').not.toBeNull();await page.mouse.click(point!.x,point!.y);
 await expect(page.getByLabel('navigate destination keyMapping source 1',{exact:true})).toHaveValue(keyField.id);
 await map.getByRole('button',{name:'Fit visible',exact:true}).click();
 const card=map.locator('.react-flow__node[data-id="'+navigation.id+'"]');const box=await card.boundingBox();expect(box).not.toBeNull();
 const sourceBeforeDrag=JSON.stringify(await snapshot());await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+25,box!.y+box!.height/2+20,{steps:8});await page.mouse.up();
 expect(JSON.stringify(await snapshot())).toBe(sourceBeforeDrag);await expect.poll(async()=>page.evaluate(id=>Object.keys(JSON.parse(sessionStorage.getItem('studio.flow.view.'+id)??'{}').positions??{}).length,p.id)).toBeGreaterThan(0);
 await page.screenshot({path:info.outputPath('pointer-edge-properties.png')});await auditMap(page,info.outputPath('axe-map.json'));
 // View changes and drag remain separate from canonical model and draft history.
 const original=JSON.stringify(await snapshot());const count=await map.getAttribute('data-projection-count');
 await map.getByRole('button',{name:'Zoom out',exact:true}).click();await map.getByRole('button',{name:'Pan right',exact:true}).click();
 await map.getByLabel('Find behavior',{exact:true}).fill('/edit');await map.getByLabel('Find behavior',{exact:true}).fill('');
 expect(await map.getAttribute('data-projection-count')).toBe(count);expect(JSON.stringify(await snapshot())).toBe(original);
 const projection=await command(await snapshot(),'flow.inspect',{projection:'application'});
 expect(projection.ok).toBe(true);
 const current=await snapshot();const http=await fetch(url+'/api/v1/projects/'+current.id+'/commands',{method:'POST',headers:{authorization:'Bearer '+capability,'content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),projectId:current.id,expectedRevision:current.revision,operation:'flow.inspect',input:{projection:'endpoint'}})});expect((await http.json()).result).toEqual(projection.result);
 expect((await command({...current,revision:current.revision-1},'flow.inspect',{projection:'application'})).ok).toBe(false);
 const inspected=projection.result as unknown as {nodes:{id:string}[];edges:{id:string;kind:string;sourceObjectId:string;context:unknown[]}[];endpoints:{handler:string;sourceObjectId:string;method:string;path:string}[]};
 expect(inspected.edges.some(e=>e.kind==='auth'&&e.sourceObjectId===record.id)).toBe(true);
 expect(inspected.edges.some(e=>e.kind==='return'&&e.context.length>0)).toBe(true);
 await map.getByLabel('Focused neighbors',{exact:true}).uncheck();
 await map.getByRole('button',{name:'Endpoints / handlers',exact:true}).click();await expect(map.getByRole('button',{name:'GET /runtime/record-1',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('endpoints-source-handlers.png')});
 await map.getByRole('button',{name:'Behavior chart',exact:true}).click();await map.getByRole('button',{name:'Fit visible',exact:true}).click();await page.screenshot({path:info.outputPath('auth-save-cancel-map.png')});
 await page.getByRole('button',{name:'Generate…',exact:true}).click();await page.getByLabel('Output location').fill('output:application');await page.getByRole('button',{name:'Preview files',exact:true}).click();await expect(page.getByRole('button',{name:'Create application',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Create application',exact:true}).click();await expect(page.getByText(/Application created/)).toBeVisible();
 for(const endpoint of inspected.endpoints)expect(readFileSync(join(root,'outputs','application',endpoint.handler),'utf8').length).toBeGreaterThan(0);
 const output=join(root,'outputs','application'),env={PATH:dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME??'',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'},npm=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');
 for(const args of [['ci','--ignore-scripts','--offline'],['run','typecheck'],['test'],['run','build']]){const result=spawnSync(process.execPath,[npm,...args],{cwd:output,env,encoding:'utf8',timeout:120000,maxBuffer:5000000});writeFileSync(info.outputPath('output-'+args[0]+'-'+(args[1]??'')+'.log'),(result.stdout??'')+(result.stderr??''));expect(result.status,(result.stdout??'')+(result.stderr??'')).toBe(0);}
 const runtime=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','0'],{cwd:output,env,stdio:['ignore','pipe','pipe']});let logs='',origin='';runtime.stdout.on('data',chunk=>{logs+=chunk.toString();origin=logs.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]??'';});runtime.stderr.on('data',chunk=>{logs+=chunk.toString();});
 try{await expect.poll(()=>origin).not.toBe('');const grid=(await snapshot()).forms.find(f=>f.kind==='Grid')!,titleId=table.columns.find(c=>c.physicalName==='title')!.id;const filterQuery=new URLSearchParams({[grid.id+':filter:'+titleId]:'r'}).toString();const visitor=await browser.newContext();const app=await visitor.newPage();await app.goto(origin+'?'+filterQuery);await expect(app.getByText('Original',{exact:true})).toBeVisible();await expect(app.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
 const link=app.getByRole('link',{name:/Open|Edit|View|navigate/}).first();await link.click();await expect(app.getByText('Sign in to continue to the selected page.',{exact:false})).toBeVisible();expect(app.url()).toContain('returnTo=');await app.getByRole('link',{name:'cancel',exact:true}).click();await expect(app).toHaveURL(origin+'/?'+filterQuery);await app.getByRole('link',{name:'Edit record',exact:true}).click();await expect(app.getByText('Sign in to continue to the selected page.',{exact:false})).toBeVisible();await app.screenshot({path:info.outputPath('friendly-selected-record-login.png')});
 await app.getByLabel('Username',{exact:true}).fill(username);await app.getByLabel('Password',{exact:true}).fill('wrong trial');await app.getByRole('button',{name:'Sign in',exact:true}).click();await expect(app.getByText('Sign in failed. Try again later.',{exact:true})).toBeVisible();await expect(app.getByLabel('Username',{exact:true})).toHaveValue(username);await expect(app.getByLabel('Password',{exact:true})).toHaveValue('');const authProject=await snapshot(),authCancel=authProject.actions.find(a=>a.operation==='cancel'&&a.formId===authProject.forms.find(f=>f.kind==='Login')?.id)!;const nonce=(await (await visitor.request.get(origin+'/runtime/auth/csrf')).json()).csrf as string;const cancelRequest=await visitor.request.post(origin+'/runtime/auth',{headers:{origin},form:{_action:authCancel.id,_csrf:nonce,returnTo:'/'}});expect(cancelRequest.status()).toBe(403);await app.getByLabel('Password',{exact:true}).fill(secret);await app.getByRole('button',{name:'Sign in',exact:true}).click();await expect(app).toHaveURL(/\/edit\?/);expect(new URL(app.url()).searchParams.get(grid.id+':filter:'+titleId)).toBe('r');expect(app.url()).toContain('west');await expect(app.getByRole('banner')).toContainText(username);await app.getByLabel('title',{exact:true}).fill('Discard this');await app.getByRole('button',{name:'Cancel',exact:true}).click();await expect(app).toHaveURL(origin+'/?'+filterQuery);await expect(app.getByText('Original',{exact:true})).toBeVisible();await app.getByRole('link',{name:'Edit record',exact:true}).click();await app.getByLabel('title',{exact:true}).fill('Updated through login');await app.getByRole('button',{name:'Save',exact:true}).click();await expect(app).toHaveURL(origin+'/?'+filterQuery);await expect(app.getByText('Updated through login',{exact:true})).toBeVisible();await app.screenshot({path:info.outputPath('signed-in-public-list.png')});
 const activeCookies=await visitor.cookies();await app.getByRole('button',{name:'Sign out',exact:true}).click();await expect(app).toHaveURL(origin+'/');await expect(app.getByRole('banner')).not.toContainText(username);await expect(app.getByText('Updated through login',{exact:true})).toBeVisible();
 const configs=JSON.parse(readFileSync(join(output,'server','record-1.ts'),'utf8').split('export const config = ')[1]!.split(' as const;')[0]!);const tokenCookie=activeCookies.find(c=>!c.name.endsWith('_csrf')&&c.name.startsWith('visitor_'))!,csrfCookie=activeCookies.find(c=>c.name.endsWith('_csrf'))!;for(const action of configs.actions.filter((a:{operation:string})=>['insert','update','delete'].includes(a.operation))){const response=await fetch(origin+'/runtime/record-1',{method:'POST',headers:{origin,'content-type':'application/json',cookie:activeCookies.map(c=>c.name+'='+c.value).join('; '),'x-csrf-token':csrfCookie.value},body:JSON.stringify({action:action.id,parameters:{},input:{}})});expect(response.status).toBe(401);}expect(tokenCookie).toBeDefined();const oracle=new Database(join(root,'definitions','catalog.sqlite'),{readonly:true});expect(oracle.prepare('SELECT title FROM entries WHERE id=?').pluck().get('west')).toBe('Updated through login');oracle.close();
 writeFileSync(info.outputPath('runtime-correspondence.json'),JSON.stringify({projectId:p.id,navigationId:navigation.id,recordPageId:record.id,loginPageId:login.id,endpoints:inspected.endpoints,typedFilter:filterQuery,observed:['public list','keyed Record redirects Login','Login Cancel retains filter','Login returns selected key and filter','Record Cancel does not write','Save updates SQLite and returns filter','revoked action handlers return 401']},null,2));
 const saved=JSON.stringify(await snapshot());expect(saved.includes(secret)).toBe(false);await visitor.close();
 }finally{runtime.kill('SIGTERM');}
});
test('100-node canonical map survives 20 Properties edits, separate layout, keyboard filters and native 200 percent zoom',async({page},info)=>{
 await connect(page);await create(page,'Scale behavior authoring');
 await page.getByRole('button',{name:'Connections…',exact:true}).click();await page.getByLabel('Relative SQLite file').fill('catalog.sqlite');await page.getByRole('button',{name:'Inspect SQLite file'}).click();await page.getByRole('button',{name:'Bind inspected database'}).click();await expect(page.getByRole('dialog')).toBeHidden();
 let p:Project=await owner('projects/'+(await owner('projects?approvedRoot=projects')).find((p:Project)=>p.name==='Scale behavior authoring').id);
 const snapshot=async():Promise<Project>=>owner('projects/'+p.id);
 const pages=Array.from({length:10},(_,i)=>({id:crypto.randomUUID(),title:'Area '+i,route:'/area-'+i,formIds:[],document:[]}));
 expect((await command(p,'project.batch',{operations:pages.map(value=>({kind:'put',entity:'page',id:value.id,value}))})).ok).toBe(true);p=await snapshot();
 const table=p.schema.tables[0]!;
 for(let i=0;i<30;i++){const target=pages[(Math.floor(i/3)+1)%10]!;const result=await command(p,'form.construct',{pageId:pages[Math.floor(i/3)]!.id,kind:'Grid',source:{kind:'table',id:table.id},fieldIds:table.columns.map(c=>c.id),keyIds:[],actions:[],links:[],style:{label:'Browse '+i},actionDefinitions:[0,1].map(()=>({operation:'navigate',destination:{pageId:target.id,keyMapping:[],filterMapping:[]}}))});expect(result.ok,JSON.stringify(result)).toBe(true);p=await snapshot();}
 await page.reload();await page.getByRole('button',{name:'Flow map',exact:true}).click();const map=page.getByRole('region',{name:'Application behavior map'});await expect(map).toContainText('100 nodes');
 const selected=pages[0]!.id;await map.getByText(/^Keyboard behavior list/).click();await map.getByRole('group',{name:'Selectable behavior list'}).getByRole('button',{name:'page: Area 0 · /area-0 · public',exact:true}).click();
 const durations:number[]=[];
 for(let i=0;i<20;i++){const start=performance.now();await page.getByLabel('Title',{exact:true}).fill('Area edited '+i);await expect(map).toHaveAttribute('data-selection',selected);await expect(map.locator('.react-flow__node[data-id="'+selected+'"]')).toContainText('Area edited '+i);await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Area edited '+i);durations.push(performance.now()-start);}
 await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');p=await snapshot();expect(p.pages.find(v=>v.id===selected)?.title).toBe('Area edited 19');
 const before=JSON.stringify(p),count=await map.getAttribute('data-projection-count');
 await map.getByLabel('Focused neighbors',{exact:true}).check();await map.getByRole('button',{name:'Fit visible',exact:true}).click();
 await map.getByLabel('Find behavior',{exact:true}).focus();await page.keyboard.type('Area edited');await page.keyboard.press('Tab');await expect(map.getByLabel('Behavior filter',{exact:true})).toBeFocused();await map.getByLabel('Find behavior',{exact:true}).fill('');
 await map.getByLabel('Behavior filter',{exact:true}).selectOption('outcomes');await map.getByLabel('Behavior filter',{exact:true}).selectOption('all');
 await map.getByRole('button',{name:'Pan left',exact:true}).click();await map.getByRole('button',{name:'Zoom in',exact:true}).click();
 expect(await map.getAttribute('data-projection-count')).toBe(count);expect(JSON.stringify(await snapshot())).toBe(before);
 await map.getByRole('button',{name:'Fit visible',exact:true}).click();await map.evaluate(element=>{element.scrollTop=0;});await page.screenshot({path:info.outputPath('scale-100-nodes-20-edits.png')});
 const layoutBefore=await page.evaluate(id=>JSON.parse(sessionStorage.getItem('studio.flow.view.'+id)??'{}'),p.id);expect(layoutBefore.selection).toBe(selected);
 await page.reload();await page.getByRole('button',{name:'Flow map',exact:true}).click();await expect(page.getByRole('region',{name:'Application behavior map'})).toHaveAttribute('data-selection',selected);
 const profile=mkdtempSync(join(root,'flow-zoom-'));mkdirSync(join(profile,'Default'));writeFileSync(join(profile,'Default','Preferences'),JSON.stringify({partition:{default_zoom_level:{x:Math.log(2)/Math.log(1.2)}}}));
 const context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',viewport:{width:1280,height:800},args:['--window-size=1280,800','--force-device-scale-factor=1','--no-sandbox']});
 try{const zoom=context.pages()[0]!;await connect(zoom);await zoom.getByRole('button',{name:'Open / Switch…',exact:true}).click();await zoom.getByRole('button').filter({hasText:'Scale behavior authoring'}).click();await expect(zoom.getByRole('dialog')).toBeHidden();await zoom.getByRole('button',{name:'Flow map',exact:true}).focus();await zoom.keyboard.press('Enter');const nativeMap=zoom.getByRole('region',{name:'Application behavior map'});await nativeMap.getByLabel('Find behavior',{exact:true}).focus();await zoom.keyboard.type('Area edited');await zoom.keyboard.press('Tab');await expect(nativeMap.getByLabel('Behavior filter',{exact:true})).toBeFocused();await nativeMap.getByText(/^Keyboard behavior list/).click();await nativeMap.getByRole('group',{name:'Selectable behavior list'}).getByRole('button').first().focus();await zoom.keyboard.press('Enter');await expect(zoom.getByLabel('Title',{exact:true})).toHaveValue('Area edited 19');await nativeMap.locator('.react-flow__node[data-id="'+selected+'"]').scrollIntoViewIfNeeded();await zoom.screenshot({path:info.outputPath('native-200-map.png'),scale:'device'});await auditMap(zoom,info.outputPath('axe-native-200-map.json'));const metrics=await zoom.evaluate(()=>({innerWidth,innerHeight,devicePixelRatio,cssZoom:getComputedStyle(document.documentElement).zoom,viewportWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));expect(metrics).toMatchObject({innerWidth:640,innerHeight:400,devicePixelRatio:2,cssZoom:'1'});expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);writeFileSync(info.outputPath('scale-and-native-metrics.json'),JSON.stringify({nodeCount:100,edits:20,lostSelections:0,lostDrafts:0,editDurationsMs:durations,viewOnlyProjectionRecomputes:0,metrics},null,2));}finally{await context.close();}
});

test('invalid typed draft edge exposes its diagnostic and stays selectable until Properties repairs it',async({page},info)=>{
 const database=join(root,'definitions','typed.sqlite');const db=new Database(database);db.exec("CREATE TABLE points(id INTEGER PRIMARY KEY,title TEXT NOT NULL);INSERT INTO points VALUES(1,'First');");db.close();
 await connect(page);await create(page,'Typed mapping repair');
 await page.getByRole('button',{name:'Connections…',exact:true}).click();await page.getByLabel('Relative SQLite file').fill('typed.sqlite');await page.getByRole('button',{name:'Inspect SQLite file'}).click();await page.getByRole('button',{name:'Bind inspected database'}).click();await expect(page.getByRole('dialog')).toBeHidden();
 const summary=(await owner('projects?approvedRoot=projects')).find((p:Project)=>p.name==='Typed mapping repair');const snapshot=async():Promise<Project>=>owner('projects/'+summary.id);
 await addPage(page,'Browse points','/points');await addPage(page,'Edit point','/point');await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
 let p=await snapshot();const list=p.pages.find(p=>p.route==='/points')!,record=p.pages.find(p=>p.route==='/point')!,table=p.schema.tables[0]!;
 await page.getByRole('treeitem').filter({hasText:'Browse points'}).first().dblclick();await wizard(page,'Grid','Points',table.id,undefined,record.id);
 p=await snapshot();const action=p.actions.find(a=>a.operation==='navigate'&&a.destination?.pageId===record.id&&a.destination.keyMapping.length===1)!,key=table.columns.find(c=>c.physicalName==='id')!,title=table.columns.find(c=>c.physicalName==='title')!;
 await page.getByRole('button',{name:'Flow map',exact:true}).click();const map=page.getByRole('region',{name:'Application behavior map'});const edgeId=action.id+':destination';const nodeCount=await map.locator('.react-flow__node').count();
 await map.getByText(/^Keyboard behavior list/).click();await map.getByRole('group',{name:'Selectable behavior list'}).getByRole('button',{name:new RegExp('destination.*'+action.id)}).click();
 await page.getByLabel('navigate destination keyMapping source 1',{exact:true}).selectOption(title.id);
 await expect(map.locator('.flow-details')).toHaveAttribute('data-validity','invalid');
 await expect(map.locator('.flow-details')).toContainText('Invalid draft flow');await expect(map.locator('.flow-details')).toContainText('TYPE_MISMATCH');
 const edge=map.locator('.react-flow__edge[data-id="'+edgeId+'"]');await expect(edge).toHaveAttribute('aria-label',/Invalid draft flow/);await expect(edge.locator('.react-flow__edge-text')).toHaveText('Invalid');await expect(edge.locator('.react-flow__edge-path')).toHaveCSS('stroke','rgb(173, 40, 49)');
 await expect(map).toHaveAttribute('data-selection',edgeId);expect(await map.locator('.react-flow__node').count()).toBe(nodeCount);
 await map.getByText(/^Keyboard behavior list/).click();const invalidItem=map.getByRole('group',{name:'Selectable behavior list'}).getByRole('button',{name:new RegExp('Invalid draft flow.*destination.*'+action.id)});await invalidItem.focus();await page.keyboard.press('Enter');
 const diagnostic=map.locator('.flow-edge-diagnostics').getByRole('button',{name:new RegExp('TYPE_MISMATCH.*'+action.id)});await diagnostic.focus();await page.keyboard.press('Enter');
 await expect(page.getByLabel('navigate destination keyMapping source 1',{exact:true})).toHaveValue(title.id);await expect(map).toHaveAttribute('data-selection',edgeId);
 await map.getByLabel('Focused neighbors',{exact:true}).check();await map.getByRole('button',{name:'Fit visible',exact:true}).click();await map.locator('.flow-details').scrollIntoViewIfNeeded();await page.getByLabel('navigate destination keyMapping source 1',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('invalid-mapping-edge-and-properties.png')});await auditMap(page,info.outputPath('axe-invalid-map.json'));
 await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.locator('.statusbar [role=status]')).toContainText(/validation failed/i);await expect.poll(async()=>JSON.stringify(await snapshot())).toBe(JSON.stringify(p));await expect(map.locator('.flow-details')).toHaveAttribute('data-validity','invalid');
 await page.getByLabel('navigate destination keyMapping source 1',{exact:true}).selectOption(key.id);
 await expect(map.locator('.flow-details')).toHaveAttribute('data-validity','valid');await expect(map.locator('.flow-details')).not.toContainText('TYPE_MISMATCH');await expect(edge).not.toHaveAttribute('aria-label',/Invalid draft flow/);await expect(map).toHaveAttribute('data-selection',edgeId);
 await page.screenshot({path:info.outputPath('repaired-mapping-edge-and-properties.png')});
 writeFileSync(info.outputPath('invalid-mapping-repair.json'),JSON.stringify({projectId:p.id,edgeId,sourceActionId:action.id,nodeCount,invalidSourceFieldId:title.id,targetKeyFieldId:key.id,observed:['canonical Properties selects incompatible source','invalid edge ARIA/label/stroke','selected-edge source-linked TYPE_MISMATCH','keyboard edge and diagnostic selection','failed Save preserves snapshot/draft','Properties repair clears edge invalidity without replacing edge ID']},null,2));
});
