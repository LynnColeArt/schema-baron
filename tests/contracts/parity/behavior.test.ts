import {test,expect} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {startOwner} from '../../../apps/studio/src/server/index.js';
import type {Project,Operation,ReviewedPlan} from '@schema-baron/model';
import Database from 'better-sqlite3';
import {createServer} from 'node:net';
// These are independent command corpora, deliberately separate from the visible Publication study.
// Each executes every write cold on its primary transport; exact opposite-transport replay is extra evidence.
test('independent real MCP-first and HTTP-first corpora cover implemented commands and atomic refusals',async()=>{
 const matrices:unknown[][]=[],snapshots:Project[]=[];
 for(const primary of ['mcp','http']as const){
 const root=mkdtempSync(join(tmpdir(),'generality-corpus-')),cap=randomBytes(32).toString('base64url');mkdirSync(join(root,'definitions'));mkdirSync(join(root,'outputs'));
 const owner=await startOwner({ownerId:'corpus-owner',capability:cap,metadataRoot:join(root,'metadata'),approvedRoots:{projects:join(root,'definitions'),output:join(root,'outputs')}});
 const config=join(root,'mcp.json');writeFileSync(config,JSON.stringify({ownerUrl:owner.url,capability:cap}),{mode:0o600});
 const transport=new StdioClientTransport({command:process.execPath,args:[resolve('apps/mcp/dist/main.js')],env:{SCHEMA_BARON_MCP_CONFIG:config},stderr:'pipe'}),client=new Client({name:'complete-operation-corpus',version:'1'});await client.connect(transport);
 const exchange=await fetch(owner.url+'/api/v1/session',{method:'POST',headers:{authorization:'Bearer '+cap,origin:owner.url,'content-type':'application/json'},body:'{}'});expect(exchange.status).toBe(200);const cookie=exchange.headers.get('set-cookie')!.split(';')[0]!,csrf=(await exchange.json()).result.csrfToken;
 let p:Project|undefined;let revision=0;const matrix:unknown[]=[];let requestIndex=0;
 type Outcome={ok:boolean;revision:number;result?:unknown;jobId?:string;error?:{code:string};diagnostics:unknown[]};
 const send=async(via:'mcp'|'http',command:Record<string,unknown>):Promise<Outcome>=>{if(via==='mcp'){const {operation,...args}=command;return (await client.callTool({name:String(operation).replaceAll('.','_'),arguments:args})).structuredContent as Outcome;}const r=await fetch(owner.url+'/api/v1/projects/corpus/commands',{method:'POST',headers:{cookie,origin:owner.url,'x-csrf-token':csrf,'content-type':'application/json'},body:JSON.stringify(command)});return await r.json()as Outcome;};
 const run=async(operation:Operation,input:unknown,options:{expected?:number;error?:string;replay?:boolean;requestId?:string}={})=>{
 const command={projectId:'corpus',operation,requestId:options.requestId??'case-'+(++requestIndex),expectedRevision:options.expected??revision,input};const outcome=await send(primary,command);
 if(options.error)expect(outcome,operation).toMatchObject({ok:false,error:{code:options.error}});else expect(outcome,JSON.stringify(outcome)).toMatchObject({ok:true});
 if(options.replay!==false)expect(await send(primary==='mcp'?'http':'mcp',command),operation+' matching replay').toEqual(outcome);
 revision=outcome.revision||revision;matrix.push({operation,primary,cold:true,ok:outcome.ok,revision,error:outcome.error?.code,diagnostics:outcome.diagnostics,matchingReplay:options.replay!==false});return outcome;
 };
 const good=async<T>(op:Operation,input:unknown)=>{const r=await run(op,input);return r.result as T;};
 const snapshot=async()=>{p=await good<Project>('project.inspect',{});return p;};
 const put=(entity:string,id:string,value:unknown)=>({kind:'put',entity,id,value});
 try{
 const inventory=await client.listTools();const capabilities=await (await fetch(owner.url+'/api/v1/capabilities',{headers:{cookie,origin:owner.url}})).json();expect(inventory.tools.map(t=>t.name).sort()).toEqual(capabilities.result.operations.map((o:{operation:string})=>o.operation.replaceAll('.','_')).sort());
 p=await good<Project>('project.create',{name:'Transport corpus',approvedRoot:'projects',target:'next-typescript-sqlite'});
 await run('project.list',{approvedRoot:'projects'},{expected:0});revision=p!.revision;await good('project.open',{locator:'projects:corpus.json'});
 const inspected=await good<{connection:{id:string;fingerprint:string}}>('connection.inspect',{approvedPath:'projects:corpus.sqlite',mode:'read-only',createEmpty:true});await good('connection.bind',{connectionId:inspected.connection.id,fingerprint:inspected.connection.fingerprint});await snapshot();
 const table={id:'entries',physicalName:'corpus_entries',columns:[{id:'entry-id',physicalName:'entry_id',type:{kind:'integer'},nullable:false},{id:'entry-title',physicalName:'heading',type:{kind:'text'},nullable:false}],primaryKey:['entry-id'],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]};
 await good('project.batch',{operations:[put('table',table.id,table)]});await snapshot();
 let plan=await good<ReviewedPlan>('schema.preview',{desiredSchemaRevision:p!.schema.revision,backfills:[]});await good('schema.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds});await snapshot();
 const history=await good<{backupRef:string}[]>('schema.history',{connectionId:p!.connections[0]!.id});expect(history).toHaveLength(1);
 // Restore the reviewed empty backup before the table is bound to any forms, then reapply the schema normally.
 plan=await good<ReviewedPlan>('schema.restorePreview',{connectionId:p!.connections[0]!.id,backupRef:history[0]!.backupRef});await good('schema.restoreApply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds});await snapshot();
 await good('project.batch',{operations:[put('table',table.id,table)]});await snapshot();plan=await good<ReviewedPlan>('schema.preview',{desiredSchemaRevision:p!.schema.revision,backfills:[]});await good('schema.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds});await snapshot();
 const db=new Database(join(root,'definitions','corpus.sqlite'),{readonly:true});expect(db.prepare('SELECT count(*) n FROM corpus_entries').get()).toEqual({n:0});db.close();
 await good('project.batch',{operations:[put('page','index',{id:'index',route:'/',title:'Corpus entries',document:[],formIds:[]}),put('page','record',{id:'record',route:'/entry',title:'Entry',document:[],formIds:[]}),put('page','temporary',{id:'temporary',route:'/temporary',title:'Temporary',document:[],formIds:[]})]});
 await good('form.construct',{pageId:'index',kind:'Grid',source:{kind:'table',id:table.id},fieldIds:table.columns.map(c=>c.id),keyIds:table.primaryKey,actions:[],links:[],style:{label:'Corpus list'},linkedRecord:{pageId:'record',label:'Corpus record',fieldIds:table.columns.map(c=>c.id),keyIds:table.primaryKey}});await snapshot();
 const recordForm=p!.forms.find(f=>f.kind==='Record')!;await good('project.batch',{operations:[put('form',recordForm.id,{...recordForm,displayFieldIds:['entry-title']})]});await snapshot();
 const control=p!.controls.find(c=>c.binding?.kind==='stored'&&c.binding.fieldId==='entry-title')!;
 await good('project.batch',{operations:[put('control',control.id,{...control,appearance:{...control.appearance,label:'Headline'}}),put('policy','protected',{id:'protected',scope:'page',ownerId:'record',access:'authenticated'}),put('extension','rules',{id:'rules',relativePath:'authored/rules.ts',version:1,kind:'validator'})]});
 await good('identity.configure',{kind:'managed',storeRef:'corpus-users'});const password=randomBytes(32).toString('base64url');await good('identity.provision',{identitySourceRef:'corpus-users',username:'corpus-reader',password});const identityFile=readdirSync(join(root,'definitions')).find(name=>name.startsWith('corpus.sqlite.auth-')&&name.endsWith('.sqlite'))!;expect(identityFile).toBeTruthy();const identities=new Database(join(root,'definitions',identityFile),{readonly:true});expect(identities.prepare('SELECT username FROM identities').all()).toEqual([{username:'corpus-reader'}]);identities.close();
 // A public Login is necessary for authenticated generated pages.
 await good('project.batch',{operations:[put('page','access',{id:'access',route:'/access',title:'Access',document:[],formIds:[]})]});await good('form.construct',{pageId:'access',kind:'Login',fieldIds:[],keyIds:[],actions:['login','logout','cancel'],links:[],style:{label:'Access'}});await snapshot();
 const query={id:'titles',name:'Titles',sources:[{alias:'e',source:{kind:'table',id:'entries'}}],joins:[],projections:[{id:'title-result',name:'heading',type:{kind:'text'},nullable:false,expression:{kind:'field',alias:'e',fieldId:'entry-title'}}],parameters:[],groupBy:[],orderBy:[],grain:{strategy:'rows',keys:[]}};
 await good('project.batch',{operations:[put('query','titles',query)]});await good('query.preview',{queryId:'titles',parameters:{},rowLimit:20});
 const before=await snapshot();await run('project.batch',{operations:[put('page','bad',{id:'bad',route:'/',title:'Duplicate',document:[],formIds:[]}),put('page','partial',{id:'partial',route:'/partial',title:'Must not exist',document:[],formIds:[]})]},{error:'VALIDATION_FAILED'});expect(await snapshot()).toEqual(before);
 await run('project.batch',{operations:[put('query','titles',{...query,projections:[{...query.projections[0],expression:{kind:'javascript',code:'globalThis'}}]})]},{error:'INVALID_INPUT'});expect(await snapshot()).toEqual(before);
 await run('project.batch',{operations:[put('page','stale',{id:'stale',route:'/stale',title:'Stale',document:[],formIds:[]})]},{expected:1,error:'REVISION_CONFLICT'});
 const identityRequest='duplicate-conflict';await run('project.validate',{}, {requestId:identityRequest});await run('project.validate',{objectIds:['index']},{requestId:identityRequest,error:'IDEMPOTENCY_CONFLICT'});
 await good('project.validate',{});for(const projection of ['application','endpoint'])await good('flow.inspect',{projection});
 plan=await good<ReviewedPlan>('generation.preview',{target:p!.target,outputRoot:'output:app',projectRevision:revision});await good('generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds});
 const source=await good<{content:string;hash:string}>('extension.read',{extensionId:'rules',approvedPath:'output:app/authored/rules.ts'});const custom=source.content+'\n// Authored through '+primary+' cold write.\n';await good('extension.write',{extensionId:'rules',approvedPath:'output:app/authored/rules.ts',expectedFileHash:source.hash,content:custom});expect(readFileSync(join(root,'outputs/app/authored/rules.ts'),'utf8')).toBe(custom);
 await run('extension.write',{extensionId:'rules',approvedPath:'output:app/authored/rules.ts',expectedFileHash:source.hash,content:'stale'},{error:'OUTPUT_CONFLICT'});await good('source.read',{outputRoot:'output:app',relativePath:'app/page.tsx'});
 await good('project.batch',{operations:[{kind:'remove',entity:'page',id:'temporary'}]});await snapshot();plan=await good<ReviewedPlan>('generation.preview',{target:p!.target,outputRoot:'output:app',projectRevision:revision});expect(plan.requiredAcknowledgementIds.length).toBeGreaterThan(0);await run('generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]},{error:'IMPACT_NOT_ACKNOWLEDGED'});const promotion=await good<{manifest:{outputTreeRevision:number}}>('generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds});
 const generatedRevision=promotion.manifest.outputTreeRevision;
 await good('runtime.context',{generatedRevision,pageId:'index'});await run('runtime.route',{generatedRevision,pageId:'index',parameters:{}},{error:'PROJECT_BUSY'});await good('runtime.status',{generatedRevision});
 const installed=spawnSync(process.execPath,['/home/lynn/.nvm/versions/node/v24.22.1/lib/node_modules/npm/bin/npm-cli.js','ci','--ignore-scripts','--offline'],{cwd:join(root,'outputs/app'),encoding:'utf8',timeout:120000});expect(installed.status).toBe(0);
 const build=await run('runtime.start',{generatedRevision,intent:'build'},{replay:false});const runtime=build.result as {jobId:string};expect(runtime.jobId).toBeTruthy();
 let job:{status:string;diagnostics:unknown[]};const deadline=Date.now()+90000;do{job=await good('job.inspect',{jobId:runtime.jobId});if(!['pending','running'].includes(job.status))break;await new Promise(r=>setTimeout(r,100));}while(Date.now()<deadline);expect(job!.status,JSON.stringify(job!)).toBe('succeeded');expect(await good('job.cancel',{jobId:runtime.jobId})).toMatchObject({status:'succeeded'});
 const port=await new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const a=s.address(),port=typeof a==='object'&&a?a.port:0;s.close(()=>resolve(port));});});
 await good('runtime.start',{generatedRevision,intent:'run',port});const ready=Date.now()+30000;let status:{status:string};do{status=await good('runtime.status',{generatedRevision});if(status.status==='running'||status.status==='failed')break;await new Promise(r=>setTimeout(r,100));}while(Date.now()<ready);expect(status!.status).toBe('running');await good('runtime.route',{generatedRevision,pageId:'index',parameters:{}});expect((await fetch('http://127.0.0.1:'+port)).status).toBe(200);
 await good('runtime.stop',{generatedRevision});await good('project.export',{destination:'output:portable',outputRoot:'output:app',includeData:true});expect(readFileSync(join(root,'outputs/portable/app/authored/rules.ts'),'utf8')).toBe(custom);
 const serialized=JSON.stringify(matrix);for(const secret of [cap,cookie,csrf,password])expect(serialized.includes(secret)).toBe(false);snapshots.push(await snapshot());const executed=new Set((matrix as {operation:string}[]).map(x=>x.operation));expect([...executed].sort()).toEqual(capabilities.result.operations.map((x:{operation:string})=>x.operation).sort());
 matrices.push(matrix);writeFileSync(join(root,'redacted-matrix.json'),JSON.stringify(matrix,null,2));
 }finally{await client.close();await owner.close();rmSync(root,{recursive:true,force:true});}
 }
 // IDs allocated by the service, physical fingerprints and exact private root identities differ.
 // Canonicalize only opaque UUIDs/fingerprints; known entity IDs, values, revisions and reference topology remain.
 const normalize=(value:unknown)=>{const ids=new Map<string,string>();return JSON.parse(JSON.stringify(value,(_key,v:unknown)=>typeof v==='string'?v.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,id=>{if(!ids.has(id))ids.set(id,'opaque-'+ids.size);return ids.get(id)!;}).replace(/\b[0-9a-f]{64}\b/g,'<fingerprint>'):v));};
 expect(normalize(snapshots[0])).toEqual(normalize(snapshots[1]));
 const signatures=(rows:unknown[])=>[...new Set(rows.map(row=>{const {primary:_primary,cold:_cold,matchingReplay:_replay,...outcome}=row as Record<string,unknown>;return JSON.stringify(outcome);} ))].sort();
 expect(normalize(signatures(matrices[0]!))).toEqual(normalize(signatures(matrices[1]!)));

 mkdirSync('docs/evidence/generality',{recursive:true});writeFileSync('docs/evidence/generality/parity-snapshots.json',JSON.stringify(snapshots.map(normalize),null,2));writeFileSync('docs/evidence/generality/parity-matrix.json',JSON.stringify(matrices,null,2));
},240000);
