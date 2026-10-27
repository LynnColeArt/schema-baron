import { afterEach, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { startOwner } from '../../../../apps/studio/src/server/index.js';
import { ProjectCore } from '@schema-baron/core';
import type { Outcome } from '@schema-baron/core';
import { project, seed } from './fixture.js';
const cleanups:(()=>Promise<void>)[]=[];afterEach(async()=>{for(const close of cleanups.splice(0).reverse())await close();});
function command(operation:string,input:unknown,expectedRevision=1,requestId:string=crypto.randomUUID()){return {projectId:'query-project',requestId,operation,expectedRevision,input};}
async function setup(cancellationWorkload=false){
 const root=mkdtempSync(join(tmpdir(),'wp15-owner-'));const definitions=join(root,'definitions'),cap='query-preview-'+'x'.repeat(40);
 const owner=await startOwner({ownerId:'owner',capability:cap,metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions}});
 cleanups.push(async()=>{await owner.close();rmSync(root,{recursive:true,force:true});});
 const http=async(body:unknown)=>{const response=await fetch(owner.url+'/api/v1/projects/query-project/commands',{method:'POST',headers:{authorization:'Bearer '+cap,'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,outcome:await response.json()};};
 const config=join(root,'mcp.json');writeFileSync(config,JSON.stringify({ownerUrl:owner.url,capability:cap}),{mode:0o600});const mcp=new Client({name:'query-proof',version:'1'});await mcp.connect(new StdioClientTransport({command:process.execPath,args:[resolve('apps/mcp/dist/main.js')],env:{SCHEMA_BARON_MCP_CONFIG:config},stderr:'pipe'}));cleanups.push(()=>mcp.close());
 const agent=async(body:Record<string,unknown>)=>{const {operation,...args}=body;return (await mcp.callTool({name:String(operation).replaceAll('.','_'),arguments:args})).structuredContent;};
 const p=project();writeFileSync(join(definitions,'import.json'),JSON.stringify({...p,queries:[]}));expect((await http(command('project.open',{locator:'projects:import.json'}))).outcome.ok).toBe(true);
 const path=join(definitions,'data.sqlite'),db=seed(path);
 // Keep real decimal aggregation pending while the public stale/forged boundary probes run.
 // The original four-row query could finish before the subsequent MCP cancellation arrived.
 if(cancellationWorkload)db.exec("WITH RECURSIVE fixture(n) AS (SELECT 5 UNION ALL SELECT n+1 FROM fixture WHERE n<75004) INSERT INTO detail SELECT n,'many',1,'0.1000','1.0000' FROM fixture");
 const before=readFileSync(path);db.close();
 const inspection=(await http(command('connection.inspect',{approvedPath:'projects:data.sqlite',mode:'read-only'}))).outcome.result;
 // Bind inspection-proven physical metadata while retaining explicit logical decimal encodings and IDs.
 // The public connection.bind imports inferred TEXT types. Restore the authored logical model using public batch after binding.
 expect((await http(command('connection.bind',{connectionId:inspection.connection.id,fingerprint:inspection.connection.fingerprint}))).outcome).toMatchObject({ok:true,revision:2});
 const current=owner.service.core.snapshot('owner','query-project');const schema={...p.schema,id:current.schema.id,revision:current.schema.revision};
 const loaded=await http(command('project.batch',{operations:[{kind:'put',entity:'schema',id:schema.id,value:schema},...p.queries.map(q=>({kind:'put',entity:'query',id:q.id,value:q}))]},2));expect(loaded.outcome).toMatchObject({ok:true,revision:3});
 return {owner,http,agent,path,before,project:p,revision:3,cap};
}
test('saved and draft preview share actual HTTP/MCP values, shape, rejection and immutable SQLite bytes',async()=>{
 const {http,agent,path,before,project:p}=await setup();
 const saved=command('query.preview',{queryId:'report',parameters:{minimum:'0.0000',floor:'0.0000'},rowLimit:200},3);const result=(await http(saved)).outcome;expect(result).toMatchObject({ok:true,revision:3,result:{truncated:false,rows:[{rt:'0.0000'},{rt:'0.3000'},{rt:'3.7750'},{rt:'10.0000'}]}});expect(await agent(saved)).toEqual(result);
 const draft=structuredClone(p.queries.at(-1)!);draft.joins[0]!.kind='inner';const request=command('query.preview',{draft,parameters:{},rowLimit:1},3);const sampled=(await http(request)).outcome;expect(sampled).toMatchObject({ok:true,result:{rows:[{ra:'one',rt:'0.3000'}],truncated:true}});expect(await agent(request)).toEqual(sampled);
 const bad=structuredClone(draft);bad.projections[0]!.expression={kind:'field',alias:'p',fieldId:'unknown' as never};
 const cases=[{draft:bad,parameters:{},rowLimit:10},{queryId:'report',parameters:{minimum:0.1},rowLimit:10},{queryId:'report',parameters:{},rowLimit:10,maxScannedRows:1},{queryId:'report',parameters:{},rowLimit:10,timeoutMs:1}];
 const codes=['VALIDATION_FAILED','TYPE_MISMATCH','QUERY_COST_EXCEEDED','TIMEOUT'];for(const [index,input] of cases.entries()){const c=command('query.preview',input,3);const failure=(await http(c)).outcome;expect(failure).toMatchObject({ok:false,error:{code:codes[index]}});expect(await agent(c)).toEqual(failure);}
 expect(readFileSync(path)).toEqual(before);
});
test('public cancel waits for worker exit; stale/conflicting cancellations have no effects and service remains responsive',async()=>{
 const {owner,http,agent,path,before}=await setup(true);const c=command('query.preview',{queryId:'report',parameters:{},rowLimit:200},3,'running-preview');
 const pending=http(c);
 // Observe the public running-job record; no mocked handlers or blocked native APIs.
 for(let i=0;i<100;i++){const job=owner.service.core.job('owner','query-project','running-preview') as {status:string}|undefined;if(job?.status==='running')break;await new Promise(resolve=>setTimeout(resolve,1));}
 const stale=command('job.cancel',{jobId:'running-preview'},2,'bad-cancel');expect((await http(stale)).outcome).toMatchObject({error:{code:'REVISION_CONFLICT'}});
 expect(owner.service.core.job('owner','query-project','running-preview')).toMatchObject({status:'running'});
 const forged=await fetch(owner.url+'/api/v1/projects/query-project/commands',{method:'POST',headers:{authorization:'Bearer invalid-owner','content-type':'application/json'},body:JSON.stringify(command('job.cancel',{jobId:'running-preview'},3,'forged-cancel'))});expect(forged.status).toBe(401);expect(owner.service.core.job('owner','query-project','running-preview')).toMatchObject({status:'running'});
 const cancel=command('job.cancel',{jobId:'running-preview'},3,'cancel-preview');const canceled=(await agent(cancel)) as Outcome;expect(canceled).toMatchObject({ok:true,result:{id:'running-preview',status:'canceled',committed:false}});expect((await pending).outcome).toMatchObject({error:{code:'CANCELED'}});expect((await http(cancel)).outcome).toEqual(canceled);
 expect((await http({...cancel,input:{jobId:'unrelated'}})).outcome).toMatchObject({error:{code:'IDEMPOTENCY_CONFLICT'}});expect((await http(command('project.inspect',{},3))).outcome).toMatchObject({ok:true,revision:3});
 expect(readFileSync(path)).toEqual(before);const check=new Database(path,{readonly:true});expect(check.pragma('integrity_check',{simple:true})).toBe('ok');check.close();
});
test('owner shutdown confirms preview exit and persists terminal cancellation before reopening',async()=>{
 const {owner,http,path,before}=await setup();const core=owner.service.core;const c=command('query.preview',{queryId:'report',parameters:{},rowLimit:200},3,'shutdown-preview');
 const pending=http(c);
 for(let i=0;i<100;i++){if(core.job('owner','query-project','shutdown-preview'))break;await new Promise(resolve=>setTimeout(resolve,1));}
 await owner.close();expect((await pending).outcome).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});
 const reopened=new ProjectCore({ownerId:'owner',metadataRoot:join(dirname(dirname(path)),'metadata'),approvedRoots:{projects:dirname(path)}});
 try{expect(reopened.job('owner','query-project','shutdown-preview')).toMatchObject({status:'canceled',committed:false});expect(reopened.snapshot('owner','query-project').revision).toBe(3);}finally{await reopened.close();}
 expect(readFileSync(path)).toEqual(before);
});
