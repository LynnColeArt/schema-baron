import { test, expect } from 'vitest';
import { chromium, expect as browserExpect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import { createId } from '@schema-baron/model';
import type { Project, ReviewedPlan } from '@schema-baron/model';
import { startOwner } from '../../../apps/studio/src/server/index.js';
import type { Outcome } from '@schema-baron/core';
import { managedIdentityPath } from '@schema-baron/generator';

// All semantic configuration is authored through ordinary owner HTTP/MCP commands.
// SQL creates only the independently supplied application data, never project metadata.
test('blank authored project provisions through HTTP/stdio and runs isolated secure production routes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp13-auth-')),dataRoot=join(root,'data'),definitions=join(root,'definitions'),outputRoot=join(root,'outputs');
 for(const p of [dataRoot,definitions,outputRoot])mkdirSync(p);
 const databasePath=join(dataRoot,'application.sqlite'),db=new Database(databasePath);
 db.exec('CREATE TABLE "registry entries"(code TEXT PRIMARY KEY NOT NULL,sequence INTEGER NOT NULL,caption TEXT NOT NULL); INSERT INTO "registry entries" VALUES(\'west\',7,\'Original\');');db.close();
 const capability=crypto.randomUUID()+crypto.randomUUID(),password=crypto.randomUUID()+crypto.randomUUID(),username=crypto.randomUUID();
 const options={ownerId:'author',capability,metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions,data:dataRoot,output:outputRoot}};
 let owner=await startOwner(options);let revision=0;const projectId='auth-project';
 const send=async(operation:string,input:unknown,requestId:string=createId(),expectedRevision=revision,authorization=capability):Promise<Outcome>=>{
  const response=await fetch(owner.url+`/api/v1/projects/${projectId}/commands`,{method:'POST',headers:{authorization:'Bearer '+authorization,'content-type':'application/json'},body:JSON.stringify({requestId,projectId,operation,expectedRevision,input})});
  const outcome=await response.json() as Outcome;if(outcome.ok)revision=outcome.revision;return outcome;
 };
 const ok=async(operation:string,input:unknown)=>{const result=await send(operation,input);expect(result,JSON.stringify(result)).toMatchObject({ok:true});if(!result.ok)throw Error('Command failed');return result.result;};
 const snapshot=()=>owner.service.core.snapshot('author',projectId);
 const configPath=join(root,'mcp-private.json');writeFileSync(configPath,JSON.stringify({ownerUrl:owner.url,capability}),{mode:0o600});
 const client=new Client({name:'auth-boundary-proof',version:'1'}),transport=new StdioClientTransport({command:process.execPath,args:[resolve('apps/mcp/dist/main.js')],env:{SCHEMA_BARON_MCP_CONFIG:configPath},stderr:'pipe'});let stderr='';transport.stderr?.on('data',v=>{stderr+=v.toString();});
 let project:Project,plan:ReviewedPlan;
 try {
  await ok('project.create',{name:'Boundary demonstration',approvedRoot:'projects',target:'next-typescript-sqlite'});
  const inspected=await ok('connection.inspect',{approvedPath:'data:application.sqlite',mode:'read-only'}) as {connection:{id:string;fingerprint:string}};
  await ok('connection.bind',{connectionId:inspected.connection.id,fingerprint:inspected.connection.fingerprint});
  const table=snapshot().schema.tables[0]!,fields=table.columns.map(c=>c.id),key=table.primaryKey;
  await ok('project.batch',{operations:['list','record','private','login'].map(id=>({kind:'put',entity:'page',id,value:{id,route:'/'+id,title:id,formIds:[],document:[]}}))});
  await ok('form.construct',{pageId:'list',kind:'Grid',source:{kind:'table',id:table.id},fieldIds:fields,keyIds:key,actions:[],links:[],style:{label:'Public registry'}});
  const list={pageId:'list',keyMapping:[],filterMapping:[]};
  for(const pageId of ['record','private'])await ok('form.construct',{pageId,kind:'Record',source:{kind:'table',id:table.id},fieldIds:fields,keyIds:key,actions:[],links:[],style:{label:'Record'},actionDefinitions:[{operation:'update',success:list}]});
  await ok('form.construct',{pageId:'login',kind:'Login',fieldIds:[],keyIds:[],actions:[],links:[],style:{label:'Access'},actionDefinitions:[{operation:'login',success:list},{operation:'logout'}]});
  // WP14 renders the authored action label; declare the label used by the visible login proof.
  const loginAction=snapshot().actions.find(a=>a.operation==='login')!;
  const loginButton=snapshot().controls.find(c=>c.events.some(e=>e.actionId===loginAction.id))!;
  await ok('project.batch',{operations:[{kind:'put',entity:'control',id:loginButton.id,value:{...loginButton,appearance:{...loginButton.appearance,label:'Sign in'}}}]});
  const grid=snapshot().forms.find(f=>f.pageId==='list')!,captionField=table.columns.find(c=>c.physicalName==='caption')!.id;
  await ok('project.batch',{operations:[
   {kind:'put',entity:'action',id:'guarded-search',value:{id:'guarded-search',formId:grid.id,operation:'search',policyId:'guarded-search-policy'}},
   {kind:'put',entity:'action',id:'guarded-navigation',value:{id:'guarded-navigation',formId:grid.id,operation:'navigate',policyId:'guarded-navigation-policy',destination:{pageId:'record',keyMapping:[{targetFieldId:key[0],expression:{kind:'field',alias:'root',fieldId:key[0]}}],filterMapping:[]}}},
   {kind:'put',entity:'policy',id:'guarded-search-policy',value:{id:'guarded-search-policy',ownerId:'guarded-search',scope:'action',access:'authenticated'}},
   {kind:'put',entity:'policy',id:'guarded-navigation-policy',value:{id:'guarded-navigation-policy',ownerId:'guarded-navigation',scope:'action',access:'authenticated'}},
   {kind:'put',entity:'control',id:'search-submit',value:{id:'search-submit',formId:grid.id,kind:'button',readOnly:false,appearance:{label:'Find \"records\" <&>'},validation:{required:false},events:[{event:'submit',actionId:'guarded-search'}]}},
   {kind:'put',entity:'control',id:'navigation-link',value:{id:'navigation-link',formId:grid.id,kind:'link',readOnly:true,appearance:{label:'Open'},validation:{required:false},events:[{event:'click',actionId:'guarded-navigation'}]}},
   {kind:'put',entity:'form',id:grid.id,value:{...grid,actionIds:['guarded-search','guarded-navigation'],controlIds:[...grid.controlIds,'navigation-link','search-submit'],search:[{fieldId:captionField,operator:'contains'}]}}
  ]});
  // Exercise report input modes and Record creation modes through the same auth return boundary.
  const reportQuery={id:'return-report-query',name:'Return report',sources:[{alias:'root',source:{kind:'table',id:table.id}}],joins:[],projections:table.columns.map(c=>({id:'report-'+c.id,name:c.physicalName,type:c.type,nullable:c.nullable,expression:{kind:'field',alias:'root',fieldId:c.id}})),parameters:[{id:'report-minimum',name:'Minimum sequence',type:{kind:'integer'},nullable:true,default:0}],where:{kind:'binary',operator:'>=',left:{kind:'field',alias:'root',fieldId:table.columns.find(c=>c.physicalName==='sequence')!.id},right:{kind:'parameter',parameterId:'report-minimum'}},groupBy:[],orderBy:[],grain:{strategy:'rows',keys:[]}};
  await ok('project.batch',{operations:[{kind:'put',entity:'query',id:reportQuery.id,value:reportQuery},{kind:'put',entity:'policy',id:'report-private',value:{id:'report-private',scope:'page',ownerId:'report',access:'authenticated'}},{kind:'put',entity:'page',id:'report',value:{id:'report',route:'/report',title:'Report',formIds:[],document:[],policyId:'report-private'}}]});
  await ok('form.construct',{pageId:'report',kind:'Grid',source:{kind:'query',id:reportQuery.id},fieldIds:reportQuery.projections.map(f=>f.id),keyIds:[],actions:[],links:[],style:{label:'Protected report'}});
  const reportForm=snapshot().forms.find(f=>f.pageId==='report')!;
  await ok('project.batch',{operations:[{kind:'put',entity:'form',id:reportForm.id,value:{...reportForm,queryParameters:[{parameterId:'report-minimum',runtime:{name:'minimum'}}]}}]});
  const before=snapshot(),record=before.forms.find(f=>f.pageId==='record')!,protectedForm=before.forms.find(f=>f.pageId==='private')!,update=before.actions.find(a=>a.formId===record.id)!,privatePage=before.pages.find(p=>p.id==='private')!;
  await ok('project.batch',{operations:[{kind:'put',entity:'policy',id:'write-policy',value:{id:'write-policy',scope:'action',ownerId:update.id,access:'authenticated'}},{kind:'put',entity:'action',id:update.id,value:{...update,policyId:'write-policy'}},{kind:'put',entity:'policy',id:'private-policy',value:{id:'private-policy',scope:'page',ownerId:'private',access:'authenticated'}},{kind:'put',entity:'page',id:'private',value:{...privatePage,policyId:'private-policy'}}]});
  await client.connect(transport);expect((await client.listTools()).tools.map(t=>t.name)).toEqual(expect.arrayContaining(['identity_configure','identity_provision']));
  const configured=await client.callTool({name:'identity_configure',arguments:{requestId:createId(),projectId,expectedRevision:revision,input:{kind:'managed',storeRef:'visitor-identities'}}});expect(configured.structuredContent).toMatchObject({ok:true});revision=(configured.structuredContent as {revision:number}).revision;
  const provisionInput={identitySourceRef:'visitor-identities',username,password},requestId=createId();
  expect(await send('identity.provision',provisionInput,createId(),revision,'forged'.repeat(8))).toMatchObject({ok:false,error:{code:'AUTH_REQUIRED'}});
  const first=await send('identity.provision',provisionInput,requestId);expect(first).toMatchObject({ok:true});
  const replay=await client.callTool({name:'identity_provision',arguments:{requestId,projectId,expectedRevision:revision,input:provisionInput}});expect(replay.structuredContent).toEqual(first);
  expect(await send('identity.provision',{...provisionInput,password:'different'},requestId)).toMatchObject({error:{code:'IDEMPOTENCY_CONFLICT'}});
  expect(await send('identity.provision',provisionInput,createId(),revision-1)).toMatchObject({error:{code:'REVISION_CONFLICT'}});
  const identityFile=managedIdentityPath(databasePath,projectId),identities=new Database(identityFile,{readonly:true});
  const rows=identities.prepare('SELECT * FROM identities').all() as {password:string}[];expect(rows).toHaveLength(1);expect(rows[0]!.password).toMatch(/^scrypt\$1\$32768\$8\$1\$/);expect(statSync(identityFile).mode&0o777).toBe(0o600);identities.close();
  const second=await client.callTool({name:'identity_provision',arguments:{requestId:createId(),projectId,expectedRevision:revision,input:{...provisionInput,username:username+'2'}}});expect(second.structuredContent).toMatchObject({ok:true});
  const salted=new Database(identityFile,{readonly:true});const hashes=(salted.prepare('SELECT password FROM identities').all() as {password:string}[]).map(r=>r.password);expect(new Set(hashes).size).toBe(2);salted.close();
  await client.close();await owner.close();owner=await startOwner(options);
  expect(await send('identity.provision',provisionInput,requestId)).toMatchObject({error:{code:'IDEMPOTENCY_CONFLICT'}});
  const afterRestart=new Database(identityFile,{readonly:true});expect(afterRestart.prepare('SELECT count(*) FROM identities').pluck().get()).toBe(2);afterRestart.close();
  const metadata=new Database(join(options.metadataRoot,'metadata.sqlite'),{readonly:true});for(const tableName of ['projects','operations','events','journal','plans','jobs']){const serialized=JSON.stringify(metadata.prepare('SELECT * FROM '+tableName).all());for(const secret of [password,capability])expect(serialized).not.toContain(secret);}metadata.close();
  project=snapshot();plan=await ok('generation.preview',{target:project.target,projectRevision:revision,outputRoot:'output:app'}) as ReviewedPlan;
  await ok('generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]});
  expect(stderr).not.toContain(password);expect(stderr).not.toContain(capability);
  // Prevent parameter-role inference: arbitrary labels and control ordering still compile.
  const roles=project.controls.filter(c=>c.credentialRole);expect(roles.map(c=>c.credentialRole).sort()).toEqual(['password','username']);
  writeFileSync(join(root,'coordinates.json'),JSON.stringify({projectId,record,protectedForm,table,project}));
 }finally {await client.close().catch(()=>{});await owner.close();}
 const output=join(outputRoot,'app');const emittedSearch=readFileSync(join(output,'components/grid-0.tsx'),'utf8');expect(emittedSearch).toContain('<button>{'+JSON.stringify('Find \"records\" <&>')+'}</button>');expect(emittedSearch).not.toContain('<th>{'+JSON.stringify('Find \"records\" <&>'));writeFileSync('/tmp/wp13-runtime-root.txt',root);
 const env={PATH:dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME??'',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'};
 const npm=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');
 const run=(args:string[],log:string)=>{const result=spawnSync(process.execPath,args,{cwd:output,env,encoding:'utf8',timeout:120000,maxBuffer:5000000});writeFileSync(join(root,log),(result.stdout??'')+(result.stderr??''));expect(result.error).toBeUndefined();expect(result.status,(result.stdout??'')+(result.stderr??'')).toBe(0);};
 run([npm,'ci','--ignore-scripts','--offline'],'install.log');run([npm,'run','typecheck'],'typecheck.log');run([npm,'test'],'test.log');run([npm,'run','build'],'build.log');
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','0'],{cwd:output,env,stdio:['ignore','pipe','pipe']});let logs='',origin='';
 child.stdout.on('data',chunk=>{logs+=chunk.toString();const match=/http:\/\/127\.0\.0\.1:(\d+)/.exec(logs);if(match)origin=match[0];});child.stderr.on('data',chunk=>{logs+=chunk.toString();});
 try {
  for(let i=0;i<100&&!origin;i++)await new Promise(r=>setTimeout(r,100));expect(origin,logs).not.toBe('');
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/list')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const config=JSON.parse(readFileSync(join(output,'server/auth-config.ts'),'utf8').split('export const authConfig:Config=')[1]!.replace(/;\s*$/,'')) as {cookie:string;logins:{username:string;password:string;actions:{id:string;operation:string}[]}[]};
  const recordFiles=readdirSync(join(output,'server')).filter(n=>/^record-\d+\.ts$/.test(n));const configs=recordFiles.map(n=>({index:Number(n.match(/\d+/)![0]),value:JSON.parse(readFileSync(join(output,'server',n),'utf8').split('export const config = ')[1]!.split(' as const;')[0]!)}));
  const record=configs.find(c=>c.value.pageId==='record')!,privateRecord=configs.find(c=>c.value.pageId==='private')!;
  const params={[record.value.keyParameters[0]]:'west'},privateParams={[privateRecord.value.keyParameters[0]]:'west'};
  const endpoint='/runtime/record-'+record.index,privateEndpoint='/runtime/record-'+privateRecord.index;
  const observations:Record<string,unknown>={};
  expect((await fetch(origin+'/list')).status).toBe(200);expect((await fetch(origin+endpoint+'?'+new URLSearchParams(params))).status).toBe(200);
  expect((await fetch(origin+privateEndpoint+'?'+new URLSearchParams(privateParams))).status).toBe(401);
  const gridForm=project!.forms.find(f=>f.pageId==='list')!,captionField=project!.schema.tables[0]!.columns.find(c=>c.physicalName==='caption')!.id;
  const searchQuery=new URLSearchParams({[gridForm.id+':filter:'+captionField]:'Original'}),navigationQuery=new URLSearchParams({_action:'guarded-navigation','_key:0':'west'});
  expect((await fetch(origin+'/list?'+searchQuery,{redirect:'manual'})).status).toBe(307);expect((await fetch(origin+'/runtime/navigation-0?'+navigationQuery,{redirect:'manual'})).status).toBe(401);
  const redirect=await fetch(origin+'/private?'+new URLSearchParams(privateParams),{redirect:'manual'});expect(redirect.status).toBe(307);expect(redirect.headers.get('location')).toContain('returnTo=');
  const reportForm=project!.forms.find(f=>f.pageId==='report')!,reportInput=reportForm.id+':parameter:minimum';
  const reportTargets=['value','default','null'].map(mode=>'/report?'+new URLSearchParams({[reportInput]:'7',[reportInput+':mode']:mode}));
  for(const target of reportTargets){const response=await fetch(origin+target,{redirect:'manual'});expect(response.status).toBe(307);const location=new URL(response.headers.get('location')!,origin);const retained=new URL(location.searchParams.get('returnTo')!,origin);expect(retained.searchParams.get(reportInput+':mode')).toBe(new URL(target,origin).searchParams.get(reportInput+':mode'));}
  const newTarget='/private?'+new URLSearchParams({[privateRecord.value.id+':mode']:'new'});expect((await fetch(origin+newTarget,{redirect:'manual'})).status).toBe(307);
  let jar:Record<string,string>={};const cookieHeader=()=>Object.entries(jar).map(([k,v])=>k+'='+v).join('; ');
  const updateCookies=(response:Response)=>{for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0]!,split=pair.indexOf('=');jar[pair.slice(0,split)]=pair.slice(split+1);}};
  const csrf=async()=>{const response=await fetch(origin+'/runtime/auth/csrf');updateCookies(response);return (await response.json() as {csrf:string}).csrf;};let nonce=await csrf();
  const body={action:record.value.actions[0].id,parameters:params,input:Object.fromEntries(record.value.source.fields.map((f:{id:string;name:string})=>[f.id,f.name==='code'?'west':f.name==='sequence'?'7':'Changed']))};
  const write=async(overrides:Record<string,unknown>={},headers:Record<string,string>={})=>fetch(origin+endpoint,{method:'POST',headers:{origin,'content-type':'application/json',cookie:cookieHeader(),'x-csrf-token':nonce,...headers},body:JSON.stringify({...body,...overrides})});
  expect((await write()).status).toBe(401);expect((await write({}, {authorization:'Bearer '+capability})).status).toBe(401);
  renameSync(databasePath,databasePath+'.held');try{expect((await write()).status).toBe(401);expect((await fetch(origin+privateEndpoint+'?'+new URLSearchParams(privateParams))).status).toBe(401);expect(existsSync(databasePath)).toBe(false);}finally{renameSync(databasePath+'.held',databasePath);}
  expect((await write({}, {origin:'https://forged.invalid'})).status).toBe(403);expect((await write({}, {'x-csrf-token':'forged'})).status).toBe(403);
  const login=config.logins[0]!,loginAction=login.actions.find(a=>a.operation==='login')!.id,logoutAction=login.actions.find(a=>a.operation==='logout')!.id;
  const signIn=async(user:string,secret:string,target='/private?'+new URLSearchParams(privateParams))=>{const data=new FormData();data.set('_csrf',nonce);data.set('_action',loginAction);data.set(login.username,user);data.set(login.password,secret);data.set('returnTo',target);return fetch(origin+'/runtime/auth',{method:'POST',headers:{origin,cookie:cookieHeader()},body:data});};
  const missing=await signIn('missing',password),wrong=await signIn(username,'wrong');expect(missing.status).toBe(401);expect(await wrong.text()).toBe(await missing.text());
  for(const target of ['/report?undeclared=1','/report?'+new URLSearchParams({[reportInput]:'7'})+'&'+new URLSearchParams({[reportInput]:'8'}),'/report?'+new URLSearchParams({[reportInput]:'invalid',[reportInput+':mode']:'value'}),'/report?'+new URLSearchParams({[reportInput+':mode']:'new'}),'/private?'+new URLSearchParams({[privateRecord.value.id+':mode']:'default'}),'https://forged.invalid','//forged.invalid','/missing','/private?undeclared=1','/private?'+privateRecord.value.keyParameters[0]+'=west&'+privateRecord.value.keyParameters[0]+'=east'])expect((await signIn(username,password,target)).status).toBe(400);
  const response=await signIn(username,password);expect(response.status).toBe(200);const location=(await response.json() as {location:string}).location;expect(location).toBe('/private?'+new URLSearchParams(privateParams));updateCookies(response);
  for(const raw of response.headers.getSetCookie())expect(raw).toMatch(/HttpOnly/i);expect(response.headers.getSetCookie().some(s=>/SameSite=lax/i.test(s))).toBe(true);
  nonce=jar[config.cookie+'_csrf']!;const firstToken=jar[config.cookie]!;
  const sessionDb=new Database(managedIdentityPath(databasePath,projectId));const sessionRows=JSON.stringify(sessionDb.prepare('SELECT * FROM sessions').all());expect(sessionRows).not.toContain(firstToken);expect(sessionRows).not.toContain(nonce);
  expect((await fetch(origin+location,{headers:{cookie:cookieHeader()}})).status).toBe(200);
  expect((await fetch(origin+'/list?'+searchQuery,{headers:{cookie:cookieHeader()}})).status).toBe(200);
  const navigated=await fetch(origin+'/runtime/navigation-0?'+navigationQuery,{headers:{cookie:cookieHeader()},redirect:'manual'});expect(navigated.status).toBe(303);expect(navigated.headers.get('location')).toContain('/record?');expect(navigated.headers.get('location')).toContain('west');
  expect((await write({action:'forged-action'})).status).toBe(403);expect((await write({parameters:{...params,[record.value.keyParameters[0]]:'west OR 1=1'}})).status).toBe(400);
  const written=await write();expect(written.status,await written.clone().text()).toBe(200);const oracle=new Database(databasePath,{readonly:true});expect(oracle.prepare('SELECT caption FROM "registry entries" WHERE code=?').pluck().get('west')).toBe('Changed');oracle.close();
  const second=await signIn(username,password,reportTargets[0]);expect(second.status).toBe(200);const reportReturn=(await second.clone().json() as {location:string}).location;expect(new URL(reportReturn,origin).searchParams.get(reportInput+':mode')).toBe('value');updateCookies(second);nonce=jar[config.cookie+'_csrf']!;expect(jar[config.cookie]).not.toBe(firstToken);
  const reportResponse=await fetch(origin+reportReturn,{headers:{cookie:cookieHeader()}});expect(reportResponse.status).toBe(200);const reportHtml=await reportResponse.text();expect(reportHtml).toContain('Changed');expect(reportHtml).not.toContain('report could not be read');
  // Follow the protected report through the generated visible Login form, without a preloaded session.
  const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage();await page.goto(origin+reportTargets[0]);await browserExpect(page).toHaveURL(/\/login\?returnTo=/);await page.getByLabel('Username',{exact:true}).fill(username);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await browserExpect(page).toHaveURL(/\/report\?/);expect(new URL(page.url()).searchParams.get(reportInput+':mode')).toBe('value');await browserExpect(page.getByRole('table')).toContainText('Changed');await page.screenshot({path:join(root,'authenticated-report-browser.png')});}finally{await browser.close();}
  const activeJar={...jar};jar[config.cookie]=firstToken;expect((await write()).status).toBe(401);jar=activeJar;
  // Expiry is enforced from durable server state on the next direct request.
  sessionDb.prepare('UPDATE sessions SET expires=0').run();expect((await write()).status).toBe(401);
  const third=await signIn(username,password);expect(third.status).toBe(200);updateCookies(third);nonce=jar[config.cookie+'_csrf']!;const revoked={...jar};
  const logout=new FormData();logout.set('_csrf',nonce);logout.set('_action',logoutAction);const loggedOut=await fetch(origin+'/runtime/auth',{method:'POST',headers:{origin,cookie:cookieHeader()},body:logout});expect(loggedOut.status).toBe(200);jar=revoked;expect((await write()).status).toBe(401);sessionDb.close();
  for(let i=0;i<8;i++)await signIn('missing','wrong');expect((await signIn(username,password)).status).toBe(401);
  const walk=(path:string):string[]=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&!['node_modules','.git'].includes(e.name)?walk(join(path,e.name)):e.isFile()?[join(path,e.name)]:[]);
  for(const path of walk(output)){if(/\.(?:ts|tsx|js|mjs|json|html|txt)$/.test(path)){const content=readFileSync(path,'utf8');for(const secret of [password,capability,firstToken])expect(content,path).not.toContain(secret);}}
  for(const path of walk(join(output,'.next/static')))expect(readFileSync(path,'utf8')).not.toMatch(/scrypt\$1\$32768\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}/);
  observations.directCases=['public list/read','protected read before DB','protected Search direct GET','protected navigation GET','anonymous write','owner capability rejected','cross origin','CSRF','consistent missing/wrong login','external/undeclared/duplicate return rejected','typed selected key retained','forged action/key rejected','authenticated write oracle','rotation','expiry','logout revocation','rate limit','source/client secret scan'];
  writeFileSync(join(root,'observations.json'),JSON.stringify(observations,null,2));
 }finally{child.kill('SIGTERM');await once(child,'exit');writeFileSync(join(root,'runtime.log'),logs.replaceAll(capability,'[redacted]').replaceAll(password,'[redacted]'));}
},240000);
