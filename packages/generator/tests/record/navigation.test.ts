import { expect, test } from 'vitest';
import { chromium, expect as browserExpect } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import { createId, parseProject } from '@schema-baron/model';
import type { Project } from '@schema-baron/model';
import { ProjectCore } from '@schema-baron/core';
import { compileProject, emitApplication, writeInitialOutput, observeOutput } from '../../src/index.js';

test('declared child keys and mixed empty typed searches survive generated production navigation', async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp12-navigation-')),definitions=join(root,'definitions');mkdirSync(definitions);
 const databasePath=join(definitions,'live.sqlite');let database=new Database(databasePath);
 database.exec(`CREATE TABLE "dispatch "" entries"("organization" TEXT NOT NULL,"entry number" INTEGER NOT NULL,"caption" TEXT NOT NULL,PRIMARY KEY("organization","entry number"));
 INSERT INTO "dispatch "" entries" VALUES('west',1,'West first'),('west',2,'West second'),('east',1,'East only');`);database.close();
 let project=parseProject({id:'navigation-project',name:'Navigation regression',formatVersion:1,revision:1,target:'next-typescript-sqlite',targetVersion:'1',connectionRefs:['connection'],connections:[{id:'connection',name:'Data',locator:{approvedRootId:'projects',relativePath:'live.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]}}],schema:{id:'schema',revision:1,opaqueObjects:[],tables:[{id:'source',physicalName:'dispatch " entries',columns:[{id:'organization-field',physicalName:'organization',type:{kind:'text'},nullable:false},{id:'entry-field',physicalName:'entry number',type:{kind:'integer'},nullable:false},{id:'caption-field',physicalName:'caption',type:{kind:'text'},nullable:false}],primaryKey:['organization-field','entry-field'],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}]},pages:[{id:'list-page',route:'/entries',title:'Entries',formIds:[],document:[]},{id:'record-page',route:'/entry',title:'Entry',formIds:[],document:[]},{id:'exact-list-page',route:'/exact-entries',title:'Exact entries',formIds:[],document:[]},{id:'exact-record-page',route:'/exact-entry',title:'Exact entry',formIds:[],document:[]}],forms:[],controls:[],actions:[],queries:[],policies:[{id:'public',scope:'global',ownerId:'navigation-project',access:'public'}],globalPolicyId:'public',extensionContracts:[],outputConfig:{approvedRootId:'output',relativePath:'application'}});
 writeFileSync(join(definitions,'project.json'),JSON.stringify(project));
 const core=new ProjectCore({ownerId:'owner',metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions,output:join(root,'output')}});
 expect(core.execute('owner',{requestId:createId(),projectId:project.id,operation:'project.open',expectedRevision:1,input:{locator:'projects:project.json'}})).toMatchObject({ok:true});
 async function command(operation:string,input:unknown) {
  const result=await core.executeAsync('owner',{requestId:createId(),projectId:project.id,operation,expectedRevision:project.revision,input});expect(result,JSON.stringify(result)).toMatchObject({ok:true});
  const current=core.execute('owner',{requestId:createId(),projectId:project.id,operation:'project.inspect',expectedRevision:result.revision,input:{}});if(!current.ok)throw Error(JSON.stringify(current));project=current.result as Project;
 }
 try {
  await command('form.construct',{pageId:'list-page',kind:'Grid',source:{kind:'table',id:'source'},fieldIds:['organization-field','entry-field','caption-field'],keyIds:['organization-field'],actions:[],links:[],style:{label:'Dispatch entries'},search:[{fieldId:'caption-field',operator:'contains'},{fieldId:'entry-field',operator:'eq'}],sorting:[{fieldId:'entry-field',direction:'asc'}],linkedRecord:{pageId:'record-page',label:'Dispatch entry',fieldIds:['organization-field','entry-field','caption-field'],keyIds:['organization-field','entry-field']}});
  const record=project.forms.find(form=>form.kind==='Record')!;
  const destination={pageId:project.pages[0]!.id,keyMapping:[],filterMapping:[{targetFieldId:project.schema.tables[0]!.columns[0]!.id,expression:{kind:'field',alias:'root',fieldId:project.schema.tables[0]!.columns[0]!.id}}]};
  await command('project.batch',{operations:[{kind:'put',entity:'form',id:record.id,value:{...record,displayFieldIds:[project.schema.tables[0]!.columns[2]!.id]}},...project.actions.filter(action=>action.formId===record.id).map(action=>({kind:'put',entity:'action',id:action.id,value:action.operation==='cancel'?{...action,destination}:{...action,success:destination}}))]});
  const source=project.schema.tables[0]!,fields=source.columns.map(field=>field.id);
  await command('form.construct',{pageId:'exact-list-page',kind:'Grid',source:{kind:'table',id:source.id},fieldIds:fields,keyIds:source.primaryKey,actions:[],links:[],style:{label:'Exact entries'},sorting:[{fieldId:source.columns[1]!.id,direction:'asc'}]});
  const exactDestination={pageId:'exact-list-page',keyMapping:[],filterMapping:source.primaryKey.map(id=>({targetFieldId:id,expression:{kind:'field',alias:'root',fieldId:id}}))};
  await command('form.construct',{pageId:'exact-record-page',kind:'Record',source:{kind:'table',id:source.id},fieldIds:fields,keyIds:source.primaryKey,actions:[],links:[],style:{label:'Exact entry'},actionDefinitions:[{operation:'cancel',destination:exactDestination}]});
 } finally {await core.close();}
 const ir=compileProject(project),grid=ir.routes[0]!.grids[0]!,record=ir.routes[1]!.records[0]!,output=join(root,'application');
 writeInitialOutput(output,emitApplication(ir,databasePath),observeOutput(output));
 writeFileSync(join(root,'authored-project.json'),JSON.stringify(project,null,2));writeFileSync('/tmp/wp12-navigation-root.txt',root);
 const npm=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js'),env={PATH:dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME??'',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'};
 function run(args:string[],name:string) {const result=spawnSync(process.execPath,args,{cwd:output,env,encoding:'utf8',timeout:90000,maxBuffer:5000000});writeFileSync(join(root,name+'.log'),(result.stdout??'')+(result.stderr??''));expect(result.error).toBeUndefined();expect(result.status,(result.stdout??'')+(result.stderr??'')).toBe(0);}
 run([npm,'ci','--ignore-scripts','--offline'],'install');
 writeFileSync(join(output,'tests/navigation.test.mjs'),`
import {writeFileSync} from 'node:fs';import {test} from 'node:test';import assert from 'node:assert/strict';
import {loadGrid,link} from '../server/grid-0.ts';
import {load,execute} from '../server/record-service.ts';
import {config} from '../server/record-1.ts';
const prefix=${JSON.stringify(grid.id)},parent=prefix+':key:organization-field',numeric=prefix+':filter:entry-field',caption=prefix+':filter:caption-field';
const tuple={[config.keyParameters[0]]:'west',[config.keyParameters[1]]:'1'};
const cancel=config.actions.find(action=>action.operation==='cancel').id;
test('declared key return executes its bound predicate rather than erroring or exposing other parents',()=>{
 const state=execute(config,cancel,tuple,{});assert.ok(state.location);const params=Object.fromEntries(new URL(state.location,'http://local').searchParams);
 assert.equal(params[parent],'west');const result=loadGrid(params);assert.equal(result.error,undefined);assert.deepEqual(result.rows.map(row=>row['caption-field']),['West first','West second']);
 assert.equal(loadGrid({[parent]:"west' OR 1=1 --"}).rows.length,0);
});
test('mixed empty numeric Search is absent in links and Cancel; required numeric Record key stays strict',()=>{
 const parameters={[caption]:'West',[numeric]:'',[prefix+':sort']:'caption-field',[prefix+':direction']:'asc'};
 assert.equal(loadGrid(parameters).error,undefined);assert.equal(loadGrid(parameters).rows.length,2);
 const state=execute(config,cancel,{...parameters,...tuple},{});assert.ok(state.location,state.summary);
 const returned=new URL(state.location,'http://local');assert.equal(returned.searchParams.get(parent),'west');assert.equal(returned.searchParams.get(caption),'West');assert.equal(returned.searchParams.has(numeric),false);
 const row=loadGrid(parameters).rows[0];
 for(const action of ${JSON.stringify(grid.actions?.filter(action=>action.operation==='navigate').map(action=>({id:action.id,new:action.destination?.newForms.length!==0}))??[])}) {
  const result=link(action.id,action.new?{}:row,parameters);const href=typeof result==='string'?result:result.href;
  assert.ok(href&&href!=='#');assert.equal(new URL(href,'http://local').searchParams.has(numeric),false);
 }
 assert.throws(()=>load(config,{...tuple,[config.keyParameters[1]]:''}));
 const invalid=execute(config,config.actions.find(action=>action.operation==='update').id,{...tuple,[config.keyParameters[1]]:''},{'organization-field':'west','entry-field':'1','caption-field':'Forged'});assert.equal(invalid.location,undefined);
});
test('ordered composite parent values survive a declared return and both bind the list',async()=>{
 const {config:exact}=await import('../server/record-3.ts');const {loadGrid:loadExact}=await import('../server/grid-2.ts');
 const tuple={[exact.keyParameters[0]]:'west',[exact.keyParameters[1]]:'2'};
 const state=execute(exact,exact.actions.find(action=>action.operation==='cancel').id,tuple,{});assert.ok(state.location,state.summary);
 const params=Object.fromEntries(new URL(state.location,'http://local').searchParams);const result=loadExact(params);assert.equal(result.error,undefined);assert.deepEqual(result.rows.map(row=>row['caption-field']),['West second']);
 const numeric=Object.keys(params).find(key=>key.endsWith(':key:entry-field'));assert.ok(numeric);assert.equal(params[numeric],'2');assert.ok(loadExact({...params,[numeric]:''}).error);
 writeFileSync(${JSON.stringify(join(root,'composite-return.json'))},JSON.stringify({location:state.location,params,numeric}));
});
`);
 run(['--conditions=react-server','--test','tests/navigation.test.mjs'],'navigation-probes');
 for(const script of ['typecheck','test','build'])run([npm,'run',script],script);
 const child=spawn(process.execPath,[join(output,'node_modules/next/dist/bin/next'),'start','-p','0','-H','127.0.0.1'],{cwd:output,env,stdio:['ignore','pipe','pipe']}),exited=once(child,'exit');
 const browser=await chromium.launch({headless:true});
 try {
  let logs='';const url=await new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Readiness timeout '+logs)),15000);child.stdout!.on('data',chunk=>{logs+=String(chunk);const match=logs.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});child.stderr!.on('data',chunk=>logs+=String(chunk));child.once('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),parent=grid.id+':key:organization-field',numeric=grid.id+':filter:entry-field',caption=grid.id+':filter:caption-field';
  const initial=new URLSearchParams({[parent]:'west',[caption]:'West',[numeric]:'',[grid.id+':sort']:'caption-field',[grid.id+':direction']:'asc'});
  const composite=JSON.parse(readFileSync(join(root,'composite-return.json'),'utf8')) as {location:string;params:Record<string,string>;numeric:string};
  const compositeResponse=await fetch(url+composite.location),compositeHtml=await compositeResponse.text();expect(compositeResponse.status).toBe(200);expect(compositeHtml).not.toContain('The list could not be read.');expect(compositeHtml).toContain('West second');expect(compositeHtml).not.toContain('West first');expect(compositeHtml).not.toContain('East only');writeFileSync(join(root,'composite-return-http.html'),compositeHtml);
  await page.goto(url+composite.location);await browserExpect(page.getByRole('row')).toHaveCount(2);await page.getByRole('button',{name:'Filter and sort',exact:true}).click();for(const [key,value] of Object.entries(composite.params))expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  const invalid=new URLSearchParams({...composite.params,[composite.numeric]:''});const invalidHtml=await(await fetch(url+'/exact-entries?'+invalid)).text();expect(invalidHtml).toContain('The list could not be read.');expect(invalidHtml).not.toContain('<tbody>');
  const foreignInvalid=new URLSearchParams({...Object.fromEntries(initial),[composite.numeric]:'invalid'});const foreignHtml=await(await fetch(url+'/entries?'+foreignInvalid)).text();expect(foreignHtml).toContain('The page filters or parent keys are invalid.');expect(foreignHtml).not.toContain('<tbody>');
  await page.goto(url+'/entries?'+initial);
  expect(await page.getByRole('alert').filter({hasText:/\S/}).count()).toBe(0);expect(await page.getByRole('link',{name:'Edit record',exact:true}).count()).toBe(2);expect(await page.getByText('East only',{exact:true}).count()).toBe(0);
  // A normal GET submits every Search input, including the untouched numeric one.
  await page.getByRole('button',{name:'Filter and sort',exact:true}).click();expect(new URL(page.url()).searchParams.get(parent)).toBe('west');expect(new URL(page.url()).searchParams.get(numeric)).toBe('');
  const response=await fetch(page.url());const html=await response.text();expect(response.status).toBe(200);expect(html).not.toContain('The list could not be read.');expect(html).not.toContain('East only');writeFileSync(join(root,'child-return-http.html'),html);
  await page.getByRole('link',{name:'Edit record',exact:true}).first().click();expect(await page.getByLabel('caption',{exact:true}).inputValue()).toBe('West first');
  await page.getByLabel('caption',{exact:true}).fill('Canceled draft');await page.getByRole('button',{name:'Cancel',exact:true}).click();await browserExpect(page).toHaveURL(/\/entries\?/);expect(new URL(page.url()).searchParams.get(parent)).toBe('west');expect(new URL(page.url()).searchParams.has(numeric)).toBe(false);expect(await page.getByText('West first',{exact:true}).count()).toBe(1);
  await page.getByRole('link',{name:'Edit record',exact:true}).first().click();await page.getByLabel('caption',{exact:true}).fill('West updated');await page.getByRole('button',{name:'Save',exact:true}).click();await browserExpect(page).toHaveURL(/\/entries\?/);expect(new URL(page.url()).searchParams.get(parent)).toBe('west');expect(await page.getByText('West updated',{exact:true}).count()).toBe(1);expect(await page.getByText('East only',{exact:true}).count()).toBe(0);
  await page.getByRole('link',{name:'New record',exact:true}).click();await page.getByLabel('organization',{exact:true}).fill('west');await page.getByLabel('entry number',{exact:true}).fill('3');await page.getByLabel('caption',{exact:true}).fill('West created');await page.getByRole('button',{name:'Save',exact:true}).click();await browserExpect(page).toHaveURL(/\/entries\?/);expect(new URL(page.url()).searchParams.get(parent)).toBe('west');
  await page.getByRole('row').filter({hasText:'West created'}).getByRole('link',{name:'Edit record',exact:true}).click();await page.getByLabel('Confirm deletion of West created').check();await page.getByRole('button',{name:'Delete',exact:true}).click();await browserExpect(page).toHaveURL(/\/entries\?/);expect(new URL(page.url()).searchParams.get(parent)).toBe('west');expect(await page.getByRole('link',{name:'Edit record',exact:true}).count()).toBe(2);
  await page.screenshot({path:join(root,'parent-return.png')});
  database=new Database(databasePath);expect(database.prepare('SELECT * FROM "dispatch "" entries" ORDER BY organization,"entry number"').all()).toEqual([{organization:'east','entry number':1,caption:'East only'},{organization:'west','entry number':1,caption:'West updated'},{organization:'west','entry number':2,caption:'West second'}]);database.close();
  writeFileSync(join(root,'observations.json'),JSON.stringify({root,output,databasePath,recordId:record.id,parentParameter:parent,blankSearchParameter:numeric,productionHttp:true,browserCancelSaveCreateDelete:true,independentRowsVerified:true},null,2));
 } finally {await browser.close();child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(timer);}
},180000);
