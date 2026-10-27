import { pinnedNpmCli, pinnedBinPath } from '../../../scripts/release/toolchain.mjs';
import { test, expect } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import type { Project } from '@schema-baron/model';
test.setTimeout(240000);
test.use({actionTimeout:15000,trace:'off',viewport:{width:1280,height:800}});
test('real wizard authors Grid/Record/Search, then independent production browser CRUD and Cancel preserve data',async({page})=>{
 const root=mkdtempSync(join(tmpdir(),'wp12-wizard-')),definitions=join(root,'definitions');mkdirSync(definitions);
 // Existing external schema and fixture rows are inputs to connection inspection,
 // not hidden application/form construction.
 const database=join(definitions,'records.sqlite');let db=new Database(database);
 db.exec(`CREATE TABLE "catalog "" records"(tenant TEXT NOT NULL,seq INT NOT NULL,title TEXT NOT NULL UNIQUE,PRIMARY KEY(tenant,seq));INSERT INTO "catalog "" records" VALUES('A',1,'Original'),('B',1,'Other');`);db.close();
 const capability=randomBytes(32).toString('base64url'),config=join(root,'owner.json');
 writeFileSync(config,JSON.stringify({ownerId:'wp12-owner',capability,metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions,output:join(root,'output')}}),{mode:0o600});
 const studio=spawn(process.execPath,[resolve('apps/studio/dist/main.js')],{env:{...process.env,PORT:'0',SCHEMA_BARON_BROWSER_MODE: 'capability', SCHEMA_BARON_OWNER_CONFIG:config},stdio:['ignore','pipe','pipe']});const studioExit=once(studio,'exit');
 let logs='';const url=await new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Studio readiness timeout')),20000);studio.stderr!.on('data',chunk=>{logs+=String(chunk);const match=logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]!);}});studio.once('exit',()=>reject(Error('Studio exited before readiness')));});
 let runtime:ReturnType<typeof spawn>|undefined,runtimeExit:Promise<unknown>|undefined;
 try {
  await page.goto(url);await page.getByLabel('Studio service owner key').fill(capability);await page.getByRole('button',{name:'Connect',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button',{name:'New project…',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('Wizard record lifecycle');await page.getByRole('button',{name:'Create project',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button',{name:'Connections…',exact:true}).click();await page.getByLabel('Relative SQLite file').fill('records.sqlite');await page.getByRole('button',{name:'Inspect SQLite file'}).click();await expect(page.getByText('1 tables · 0 read-only unsupported objects')).toBeVisible();await page.getByRole('button',{name:'Bind inspected database'}).click();await expect(page.getByRole('dialog')).toBeHidden();
  async function addPage(title:string,route:string){await page.getByRole('button',{name:'＋ Page',exact:true}).click();await page.getByLabel('Page title',{exact:true}).fill(title);await page.getByLabel('Internal route',{exact:true}).fill(route);await page.getByRole('button',{name:'Add page',exact:true}).click();}
  await addPage('Edit catalog','/record');await addPage('Search catalog','/search');await addPage('Catalog list','/catalog');
  async function wizard(kind:string,label:string,linked=false) {
   await page.getByRole('button',{name:'＋ Form',exact:true}).click();await page.getByLabel('Form label',{exact:true}).fill(label);await page.getByLabel('Form kind',{exact:true}).selectOption(kind);await page.getByRole('dialog').getByLabel('Data source',{exact:true}).selectOption({label:'Table: catalog " records'});await page.getByRole('button',{name:'Next',exact:true}).click();
   for(const checkbox of await page.getByRole('group',{name:'Fields, in selection order'}).getByRole('checkbox').all()) await checkbox.check();
   if(kind==='Grid')await page.getByRole('button',{name:'Use complete primary key'}).click();
   await page.getByRole('button',{name:'Next',exact:true}).click();if(linked)await page.getByLabel('Linked Record page',{exact:true}).selectOption({label:'Edit catalog · /record'});await page.getByRole('button',{name:'Next',exact:true}).click();
   await page.getByRole('dialog').getByLabel('Search title',{exact:true}).selectOption('contains');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Finish',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();
  }
  await wizard('Grid','Catalog records',true);
  await page.getByRole('treeitem').filter({hasText:'Catalog records record'}).click();await page.getByRole('tab',{name:'Data',exact:true}).click();await page.getByRole('group',{name:'Record name fields for delete confirmation'}).getByLabel('title',{exact:true}).check();await page.getByRole('button',{name:'▣ Save',exact:true}).click();await expect(page.getByRole('status')).toContainText('Saved');
  await page.getByRole('treeitem').filter({hasText:'Search catalog'}).dblclick();await wizard('Search','Find catalog');
  const listResponse=await fetch(url+'/api/v1/projects?approvedRoot=projects',{headers:{authorization:'Bearer '+capability}});const summaries=(await listResponse.json()).result as Project[];
  const response=await fetch(url+'/api/v1/projects/'+summaries[0]!.id,{headers:{authorization:'Bearer '+capability}});const project=(await response.json()).result as Project;
  expect(project.forms.map(f=>f.kind).sort()).toEqual(['Grid','Record','Search']);expect(project.actions.filter(a=>['insert','update','delete'].includes(a.operation)).every(a=>a.success)).toBe(true);
  await page.getByRole('button',{name:'Generate…',exact:true}).click();await page.getByLabel('Output location').fill('output:app');await page.getByRole('button',{name:'Preview files',exact:true}).click();await expect(page.getByText(/files to create/)).toBeVisible();await page.screenshot({path:'tests/e2e/generated-records/evidence/wizard-preview.png'});await page.getByRole('button',{name:'Create application',exact:true}).click();await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created');
  studio.kill('SIGTERM');await studioExit;
  const output=join(root,'output','app'),npm=pinnedNpmCli,env={PATH:pinnedBinPath,HOME:process.env.HOME??'',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'};
  for(const args of [['ci','--ignore-scripts','--offline'],...['typecheck','test','build'].map(script=>['run',script])]) {const result=spawnSync(process.execPath,[npm,...args],{cwd:output,env,encoding:'utf8',timeout:90000,maxBuffer:5000000});writeFileSync(join(root,args.at(-1)!+'.log'),(result.stdout??'')+(result.stderr??''));expect(result.status,(result.stdout??'')+(result.stderr??'')).toBe(0);}
  runtime=spawn(process.execPath,[join(output,'node_modules/next/dist/bin/next'),'start','-p','0','-H','127.0.0.1'],{cwd:output,env,stdio:['ignore','pipe','pipe']});runtimeExit=once(runtime,'exit');let runtimeLogs='';
  const appUrl=await new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('App readiness timeout '+runtimeLogs)),15000);runtime!.stdout!.on('data',chunk=>{runtimeLogs+=String(chunk);const match=runtimeLogs.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});runtime!.stderr!.on('data',chunk=>runtimeLogs+=String(chunk));});
  const grid=project.forms.find(f=>f.kind==='Grid')!,search=project.forms.find(f=>f.kind==='Search')!;
  const title=project.schema.tables[0]!.columns.find(c=>c.physicalName==='title')!.id;
  await page.goto(appUrl+'/catalog?'+new URLSearchParams({[grid.id+':filter:'+title]:'Original',[grid.id+':sort']:title,[grid.id+':direction']:'asc'}));await page.getByRole('link',{name:'Edit record'}).click();await expect(page.getByLabel('title',{exact:true})).toHaveValue('Original');
  await page.getByLabel('seq',{exact:true}).fill('invalid');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Enter an integer.'})).toBeVisible();await expect(page.getByLabel('seq',{exact:true})).toHaveValue('invalid');
  db=new Database(database);expect(db.prepare('SELECT title FROM "catalog "" records" WHERE tenant=?').get('A')).toEqual({title:'Original'});db.close();
  await page.getByLabel('seq',{exact:true}).fill('1');await page.getByLabel('title',{exact:true}).fill('Edited');const successfulRequest=page.waitForRequest(request=>request.method()==='POST'&&request.url().includes('/record'));await page.getByRole('button',{name:'Save',exact:true}).click();const savedRequest=await successfulRequest;await expect(page).toHaveURL(new RegExp('/catalog\\?'));expect(new URL(page.url()).searchParams.get(grid.id+':filter:'+title)).toBe('Original');await expect(page.getByRole('status')).toHaveText('Record saved.');await page.reload();await expect(page.getByRole('status')).toHaveCount(0);
  const replayHeaders=await savedRequest.allHeaders();delete replayHeaders['content-length'];delete replayHeaders.host;replayHeaders.origin='https://untrusted.invalid';const rejected=await fetch(savedRequest.url(),{method:'POST',headers:replayHeaders,body:(savedRequest.postData()??'').replace('Edited','Forged'),redirect:'manual'});expect(rejected.status).toBeGreaterThanOrEqual(400);
  await page.goto(appUrl+'/catalog');await page.getByRole('row').filter({hasText:'Edited'}).getByRole('link',{name:'Edit record'}).click();await page.getByLabel('title',{exact:true}).fill('Canceled');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByText('Edited',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'New record',exact:true}).click();await page.getByLabel('tenant',{exact:true}).fill('C');await page.getByLabel('seq',{exact:true}).fill('3');await page.getByLabel('title',{exact:true}).fill('Created');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByText('Created',{exact:true})).toBeVisible();
  await page.getByRole('row').filter({hasText:'Created'}).getByRole('link',{name:'Edit record'}).click();await expect(page.getByText('Delete Created?',{exact:true})).toBeVisible();await page.screenshot({path:'tests/e2e/generated-records/evidence/standalone-delete.png'});await page.getByLabel('Confirm deletion of Created').check();await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.getByText('Created',{exact:true})).toHaveCount(0);
  await page.goto(appUrl+'/search?'+new URLSearchParams({[search.id+':filter:'+title]:'Edited'}));await expect(page.getByText('Edited',{exact:true})).toBeVisible();await expect(page.getByText('Other',{exact:true})).toHaveCount(0);await page.screenshot({path:'tests/e2e/generated-records/evidence/standalone-search.png'});
  db=new Database(database);expect(db.prepare('SELECT * FROM "catalog "" records" ORDER BY tenant').all()).toEqual([{tenant:'A',seq:1,title:'Edited'},{tenant:'B',seq:1,title:'Other'}]);db.close();
  writeFileSync(join(root,'demonstration.json'),JSON.stringify({root,output,database,studioStopped:true,projectId:project.id,forms:project.forms.map(f=>({id:f.id,kind:f.kind})),independentRowsVerified:true},null,2));writeFileSync('/tmp/wp12-wizard-root.txt',root);
 } finally {if(studio.exitCode===null){studio.kill('SIGTERM');await studioExit;}if(runtime){runtime.kill('SIGTERM');const timer=setTimeout(()=>runtime?.kill('SIGKILL'),5000);await runtimeExit;clearTimeout(timer);}}
});
