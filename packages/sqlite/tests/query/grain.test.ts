import { afterEach, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startOwner } from '../../../../apps/studio/src/server/index.js';
import { compileQuery, SQLiteWorker } from '../../src/index.js';
import type { Expression, Project, Query, ScalarType } from '@schema-baron/model';
import { project } from './fixture.js';
const cleanups:(()=>Promise<void>)[]=[];afterEach(async()=>{for(const close of cleanups.splice(0).reverse())await close();});
const decimal:ScalarType={kind:'decimal',precision:6,scale:2,rounding:'half-even',encoding:'text'};
const field=(alias:string,fieldId:string):Expression=>({kind:'field',alias,fieldId:fieldId as never});
const eq=(left:Expression,right:Expression):Expression=>({kind:'binary',operator:'=',left,right});
const both=(left:Expression,right:Expression):Expression=>({kind:'binary',operator:'and',left,right});
function model(keyType:ScalarType=decimal,children=2,composite=false) {
 const p=project();p.queries=[];p.schema.tables=['root','first','second'].map((name,i)=>({id:name as never,physicalName:name,columns:[{id:('key'+i) as never,physicalName:'id',type:keyType,nullable:false},...(composite?[{id:('part'+i) as never,physicalName:'part',type:{kind:'integer' as const},nullable:false}]:[]),...(i===0?[{id:'amount' as never,physicalName:'amount',type:decimal,nullable:false}]:[])],primaryKey:[('key'+i) as never,...(composite?[('part'+i) as never]:[])],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}));
 const q:Query={id:'key-report' as never,name:'Key report',sources:['root','first','second'].slice(0,children+1).map((id,i)=>({alias:'s'+i,source:{kind:'table',id:id as never}})),joins:Array.from({length:children},(_,n)=>{const i=n+1;return {leftAlias:'s0',rightAlias:'s'+i,kind:'left' as const,cardinality:'many-to-one' as const,on:composite?both(eq(field('s0','key0'),field('s'+i,'key'+i)),eq(field('s0','part0'),field('s'+i,'part'+i))):eq(field('s0','key0'),field('s'+i,'key'+i))};}),projections:[{id:'outkey' as never,name:'key',type:keyType,nullable:false,expression:field('s0','key0')},{id:'outtotal' as never,name:'total',type:decimal,nullable:true,expression:{kind:'aggregate',function:'sum',argument:field('s0','amount')}}],parameters:[],groupBy:[field('s0','key0')],orderBy:[],grain:{strategy:'grouped',keys:['outkey' as never]}};
 if(composite){q.projections.push({id:'outpart' as never,name:'part',type:{kind:'integer'},nullable:false,expression:field('s0','part0')});q.groupBy.push(field('s0','part0'));q.grain.keys.push('outpart' as never);}
 return {p,q};
}
function seed(path:string,variant:'decimal'|'negative'|'zero'|'canonical'|'composite'|'scaled'|'affinity'|'collation'='decimal') {
 const db=new Database(path);const composite=variant==='composite',physical=variant==='scaled'?'INTEGER':variant==='affinity'?'INTEGER':variant==='collation'?'TEXT COLLATE NOCASE':'TEXT';
 db.exec(`CREATE TABLE root(id ${physical} NOT NULL,${composite?'part INTEGER NOT NULL,':''}amount TEXT NOT NULL,PRIMARY KEY(id${composite?',part':''})); CREATE TABLE first(id ${variant==='scaled'?'INTEGER':'TEXT'} NOT NULL${composite?',part INTEGER NOT NULL':''},PRIMARY KEY(id${composite?',part':''})); CREATE TABLE second(id ${variant==='scaled'?'INTEGER':'TEXT'} NOT NULL${composite?',part INTEGER NOT NULL':''},PRIMARY KEY(id${composite?',part':''}));`);
 const key=variant==='negative'?'-1':variant==='zero'?'0':variant==='collation'?'A':variant==='scaled'?100:'1';const alternatives=variant==='negative'?['-1','-1.00']:variant==='zero'?['0','-0.00']:variant==='collation'?['A','a']:variant==='affinity'?['1','01']:variant==='scaled'?[100,101]:variant==='canonical'?['1.00','2.00']:['1','1.00'];
 db.prepare(`INSERT INTO root VALUES(?${composite?',?':''},?)`).run(...(composite?[key,1,'10.00']:[key,'10.00']));
 for(const name of ['first','second'])for(const [i,value] of alternatives.entries())db.prepare(`INSERT INTO ${name} VALUES(?${composite?',?':''})`).run(...(composite?[value,i+1]:[value]));
 db.close();return readFileSync(path);
}
async function fixture(variant:Parameters<typeof seed>[1]='decimal') {const root=mkdtempSync(join(tmpdir(),'wp15-grain-'));cleanups.push(async()=>rmSync(root,{recursive:true,force:true}));const path=join(root,'data.sqlite');const before=seed(path,variant);const worker=new SQLiteWorker(path);cleanups.push(()=>worker.close());return {worker,path,before};}
for(const variant of ['decimal','negative','zero','affinity','collation'] as const)test('reject actual semantic key collisions before returning totals: '+variant,async()=>{
 const {worker,path,before}=await fixture(variant);const {p,q}=model(variant==='affinity'?{kind:'integer'}:variant==='collation'?{kind:'text'}:decimal);
 await expect(worker.queryPreview(compileQuery(p,q,{},1))).rejects.toMatchObject({code:'INVALID_QUERY_GRAIN'});expect(readFileSync(path)).toEqual(before);
});
test('a single normalized decimal join cannot silently double an aggregate',async()=>{const {worker}=await fixture('negative');const {p,q}=model(decimal,1);await expect(worker.queryPreview(compileQuery(p,q,{},200))).rejects.toMatchObject({code:'INVALID_QUERY_GRAIN'});});
test('complete composite tuples and canonical/scaled keys preserve valid joins',async()=>{
 for(const variant of ['canonical','composite','scaled'] as const){const {worker}=await fixture(variant);const {p,q}=model(variant==='scaled'?{...decimal,encoding:'scaled-integer'}:decimal,2,variant==='composite');const result=await worker.queryPreview(compileQuery(p,q,{},200));expect(result.rows).toEqual([{outkey:'1.00',outtotal:'10.00',...(variant==='composite'?{outpart:1}:{})}]);}
});
test('grouped child queries normalize decimal grain before joining and retain independent equal amounts',async()=>{
 const {worker,path}=await fixture();const {p,q}=model();
 for(const [i,name] of ['first','second'].entries()){const alias='child'+i;const child:Query={id:('grouped'+i) as never,name:'Grouped child '+i,sources:[{alias,source:{kind:'table',id:name as never}}],joins:[],parameters:[],groupBy:[field(alias,'key'+(i+1))],orderBy:[],grain:{strategy:'grouped',keys:[('groupkey'+i) as never]},projections:[{id:('groupkey'+i) as never,name:'grouped key',type:decimal,nullable:false,expression:field(alias,'key'+(i+1))}]};p.queries.push(child);q.sources[i+1]!.source={kind:'query',id:child.id};q.joins[i]!.on=eq(field('s0','key0'),field('s'+(i+1),'groupkey'+i));}
 const db=new Database(path);db.prepare('INSERT INTO root VALUES(?,?)').run('1.0','10.00');db.close();
 q.grain={strategy:'preaggregated',keys:['outkey' as never],sourceAliases:['s1','s2']};expect((await worker.queryPreview(compileQuery(p,q,{},200))).rows).toEqual([{outkey:'1.00',outtotal:'20.00'}]);
});
test('public saved and draft HTTP plus fresh MCP fail closed on numeric-equivalent TEXT unique keys',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp15-public-grain-'));const definitions=join(root,'definitions'),cap='grain-private-'+'x'.repeat(40);const owner=await startOwner({ownerId:'owner',capability:cap,metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions}});cleanups.push(async()=>{await owner.close();rmSync(root,{recursive:true,force:true});});
 const {p,q}=model();writeFileSync(join(definitions,'import.json'),JSON.stringify(p));const path=join(definitions,'data.sqlite'),before=seed(path);
 const command=(operation:string,input:unknown,expectedRevision=1)=>({projectId:p.id,operation,input,expectedRevision,requestId:crypto.randomUUID()});const http=async(body:unknown)=>(await fetch(owner.url+'/api/v1/projects/'+p.id+'/commands',{method:'POST',headers:{authorization:'Bearer '+cap,'content-type':'application/json'},body:JSON.stringify(body)})).json();
 expect(await http(command('project.open',{locator:'projects:import.json'}))).toMatchObject({ok:true});const inspection=await http(command('connection.inspect',{approvedPath:'projects:data.sqlite',mode:'read-only'}));expect(inspection).toMatchObject({ok:true});expect(await http(command('connection.bind',{connectionId:inspection.result.connection.id,fingerprint:inspection.result.connection.fingerprint}))).toMatchObject({ok:true,revision:2});const current=await http(command('project.inspect',{},2));const schema={...p.schema,id:current.result.schema.id,revision:current.result.schema.revision};expect(await http(command('project.batch',{operations:[{kind:'put',entity:'schema',id:schema.id,value:schema},{kind:'put',entity:'query',id:q.id,value:q}]},2))).toMatchObject({ok:true,revision:3});
 const config=join(root,'mcp.json');writeFileSync(config,JSON.stringify({ownerUrl:owner.url,capability:cap}),{mode:0o600});const mcp=new Client({name:'semantic-grain',version:'1'});await mcp.connect(new StdioClientTransport({command:process.execPath,args:[resolve('apps/mcp/dist/main.js')],env:{SCHEMA_BARON_MCP_CONFIG:config},stderr:'pipe'}));cleanups.push(()=>mcp.close());
 const saved=command('query.preview',{queryId:q.id,parameters:{},rowLimit:1},3);const failed=await http(saved);expect(failed).toMatchObject({ok:false,error:{code:'INVALID_QUERY_GRAIN'}});expect(failed.error.message).toMatch(/join|grain/i);const {operation:_,...args}=saved;expect((await mcp.callTool({name:'query_preview',arguments:args})).structuredContent).toEqual(failed);
 expect((await mcp.callTool({name:'query_preview',arguments:{...args,requestId:crypto.randomUUID()}})).structuredContent).toMatchObject({ok:false,error:{code:'INVALID_QUERY_GRAIN'}});expect(await http(command('query.preview',{draft:q,parameters:{},rowLimit:200},3))).toMatchObject({ok:false,error:{code:'INVALID_QUERY_GRAIN'}});
 const single={...q,sources:q.sources.slice(0,2),joins:q.joins.slice(0,1)};expect(await http(command('query.preview',{draft:single,parameters:{},rowLimit:200},3))).toMatchObject({ok:false,error:{code:'INVALID_QUERY_GRAIN'}});
 expect((await mcp.callTool({name:'query_preview',arguments:{...args,requestId:crypto.randomUUID(),input:{draft:single,parameters:{},rowLimit:200}}})).structuredContent).toMatchObject({ok:false,error:{code:'INVALID_QUERY_GRAIN'}});expect(readFileSync(path)).toEqual(before);
});
test('a collision after the sampled first group is rejected and all composite components use actual equality',async()=>{
 const {worker,path}=await fixture('composite');const {p,q}=model(decimal,2,true);const db=new Database(path);db.exec("UPDATE first SET part=1; UPDATE second SET part=1; INSERT INTO root VALUES('2',1,'10.00'); INSERT INTO first VALUES('2',1); INSERT INTO second VALUES('2',1)");db.close();q.orderBy=[{expression:field('s0','key0'),direction:'desc'}];
 await expect(worker.queryPreview(compileQuery(p,q,{},1))).rejects.toMatchObject({code:'INVALID_QUERY_GRAIN'});
});
test('the proof respects operand order and collation of the actual ON expression',async()=>{
 const {worker}=await fixture('collation');const {p,q}=model({kind:'text'});for(const j of q.joins){if(j.on.kind==='binary')j.on={...j.on,left:j.on.right,right:j.on.left};}
 expect((await worker.queryPreview(compileQuery(p,q,{},200))).rows).toEqual([{outkey:'A',outtotal:'10.00'}]);
});
test('actual multiplicity proof obeys the worker timeout and cancellation budget',async()=>{
 const {worker,path}=await fixture('canonical');const {p,q}=model(decimal,1);const db=new Database(path);db.exec("DELETE FROM root; DELETE FROM first; WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<2000) INSERT INTO root SELECT CAST(x AS TEXT),'10.00' FROM n; INSERT INTO first SELECT id FROM root");db.close();const compiled=compileQuery(p,q,{},1);
 await worker.inspect();await expect(worker.queryPreview(compiled,{}, {timeoutMs:30})).rejects.toMatchObject({code:'TIMEOUT'});await worker.close();
 const other=new SQLiteWorker(path);cleanups.push(()=>other.close());await other.inspect();const abort=new AbortController();const pending=other.queryPreview(compiled,{}, {signal:abort.signal,timeoutMs:2000});setTimeout(()=>abort.abort(),30);await expect(pending).rejects.toMatchObject({code:'CANCELED'});
});
test('one-to-one validates the left logical key as well as the right physical key',async()=>{
 const {worker,path}=await fixture('canonical');const {p,q}=model(decimal,1);const db=new Database(path);db.exec("INSERT INTO root VALUES('1.0','10.00')");db.close();q.joins[0]!.cardinality='one-to-one';
 await expect(worker.queryPreview(compileQuery(p,q,{},200))).rejects.toMatchObject({code:'INVALID_QUERY_GRAIN'});
});
