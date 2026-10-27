import { afterEach, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { project, seed } from './fixture.js';
import { compileQuery } from '../../src/query/index.js';
import { SQLiteWorker } from '../../src/adapter/index.js';
const roots: string[]=[]; afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture(){const root=mkdtempSync(join(tmpdir(),'wp15-query-'));roots.push(root);const path=join(root,'data.sqlite');return {path,db:seed(path)};}
test('real SQLite preaggregated composite-key outer joins and decimal HAVING/order match independent integer oracle',async()=>{
 const {path,db}=fixture();const before=db.prepare('SELECT * FROM detail').all();const p=project();const q=p.queries.at(-1)!;const compiled=compileQuery(p,q,{},200);const worker=new SQLiteWorker(path);
 try { const result=await worker.queryPreview(compiled); const oracle = (prices: [bigint,bigint][]) => (prices.reduce((sum,[price,qty])=>sum+price*qty/10000n,0n)).toString().padStart(5,'0').replace(/(\d{4})$/,'.$1');
 expect(result.rows).toEqual([{ra:'zero',rb:1,rt:'0.0000',rf:'0.0000'},{ra:'one',rb:1,rt:oracle([[1000n,30000n]]),rf:'0.0000'},{ra:'many',rb:1,rt:oracle([[23500n,15000n],[1250n,20000n]]),rf:'1.3750'},{ra:'many',rb:2,rt:'10.0000',rf:'0.0000'}]);
 const filtered=await worker.queryPreview(compileQuery(p,q,{minimum:'1.0000',floor:'1.0000'},1));expect(filtered.rows).toEqual([{ra:'many',rb:1,rt:'3.5250',rf:'1.3750'}]);expect(filtered.truncated).toBe(true);
 expect(result.fields).toEqual(q.projections.map(({expression:_,...f})=>f));expect(result.sql).toContain('HAVING'); expect(db.prepare('SELECT * FROM detail').all()).toEqual(before);
 }finally{await worker.close();db.close();}
});
test('unsafe AST, unknown IDs, false cardinality, incomplete composite keys, cycles and parameters fail before SQL',()=>{
 const p=project();const q=p.queries.at(-1)!;
 const invalid=[{...q,where:{kind:'raw',sql:'DROP TABLE detail'}},{...q,where:{kind:'function',function:'load_extension',args:[]}},{...q,projections:[{...q.projections[0]!,expression:{kind:'field',alias:'p',fieldId:'missing'}}]}];
 for(const draft of invalid)expect(()=>compileQuery(p,draft,{},200)).toThrow();
 const incomplete=structuredClone(q);incomplete.joins[0]!.on=incomplete.joins[0]!.on.kind==='binary' ? incomplete.joins[0]!.on.left : incomplete.joins[0]!.on;expect(()=>compileQuery(p,incomplete,{},200)).toThrow(/unique|grain/i);
 const cycle=structuredClone(p);cycle.queries[0]!.sources[0]!.source={kind:'query',id:cycle.queries[0]!.id};expect(()=>compileQuery(cycle,q,{},200)).toThrow();
 expect(()=>compileQuery(p,q,{minimum:1.2},200)).toThrow();expect(()=>compileQuery(p,q,{unknown:'x'},200)).toThrow();expect(()=>compileQuery(p,q,{},201)).toThrow();
});
test('injection-shaped text stays bound; row caps, cost failures, worker timeout and cancellation preserve data',async()=>{
 const {path,db}=fixture();const p=project();const base=p.queries.at(-1)!;const q={...base,parameters:[...base.parameters,{id:'search' as never,name:'search',type:{kind:'text' as const},nullable:false}],where:{kind:'binary' as const,operator:'=' as const,left:{kind:'field' as const,alias:'p',fieldId:'pa' as never},right:{kind:'parameter' as const,parameterId:'search' as never}}};
 const attack="'; DROP TABLE detail; --"; const compiled=compileQuery(p,q,{search:attack},200);expect(compiled.sql).not.toContain(attack);expect(Object.values(compiled.parameters)).toContain(attack);const worker=new SQLiteWorker(path);
 try{expect((await worker.queryPreview(compiled)).rows).toEqual([]);await expect(worker.queryPreview(compileQuery(p,base,{},200),{maxScannedRows:1})).rejects.toMatchObject({code:'QUERY_COST_EXCEEDED'});}finally{await worker.close();}
 const abort=new AbortController();abort.abort();const canceled=new SQLiteWorker(path);await expect(canceled.queryPreview(compileQuery(p,base,{},200),{}, {signal:abort.signal})).rejects.toMatchObject({code:'CANCELED'});await canceled.close();
 const timed=new SQLiteWorker(path);await expect(timed.queryPreview(compileQuery(p,base,{},200),{}, {timeoutMs:1})).rejects.toMatchObject({code:'TIMEOUT'});await timed.close();expect(db.prepare('SELECT count(*) AS n FROM detail').get()).toEqual({n:4});db.close();
});
test('raw two-child fanout and lying many-to-one claims are rejected; full grouped keys are required',()=>{
 const p=project(); const q=structuredClone(p.queries.at(-1)!);
 q.grain={strategy:'grouped',keys:q.grain.keys};q.sources[1]!.source={kind:'table',id:'lines' as never};q.sources[2]!.source={kind:'table',id:'fees' as never};
 const replacements:Record<string,string>={suba:'la',subb:'lb',subvalue:'price',feea:'fa',feeb:'fb',feevalue:'fee'};
 const rewritten=JSON.parse(JSON.stringify(q,(_k,v)=>typeof v==='string'?replacements[v]??v:v));
 expect(()=>compileQuery(p,rewritten,{},200)).toThrow(/unique key/i);
 for(const join of rewritten.joins)join.cardinality='one-to-many';expect(()=>compileQuery(p,rewritten,{},200)).toThrow();
});
test('worker rejects forged physical uniqueness and invalid exact physical data before returning plausible results',async()=>{
 const {path,db}=fixture();const p=project();const q=p.queries.at(-1)!;
 const worker=new SQLiteWorker(path);
 try{
 const forged=structuredClone(p);forged.schema.tables[1]!.uniqueConstraints.push({id:'fake-key' as never,columnIds:['price' as never]});
 await expect(worker.queryPreview(compileQuery(forged,q,{},200))).rejects.toMatchObject({code:'DATABASE_CHANGED'});
 db.exec("UPDATE detail SET price='not a decimal' WHERE id=1");await expect(worker.queryPreview(compileQuery(p,q,{},200))).rejects.toMatchObject({code:'TYPE_MISMATCH'});
 db.exec("UPDATE detail SET price='9999999999999999.9999',quantity='9999999999999999.9999' WHERE id=1");await expect(worker.queryPreview(compileQuery(p,q,{},200))).rejects.toMatchObject({code:'TYPE_MISMATCH'});
 }finally{await worker.close();db.close();}
});
test('scaled-integer SQLite storage stays exact beyond JavaScript safe integer precision',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp15-scaled-'));roots.push(root);const path=join(root,'scaled.sqlite');const db=new Database(path);db.exec('CREATE TABLE exact(id INTEGER PRIMARY KEY,value INTEGER NOT NULL); INSERT INTO exact VALUES(1,900719925474099312),(2,-23450)');
 const p=project();p.schema.tables=[{id:'scaled-table' as never,physicalName:'exact',columns:[{id:'scaled-id' as never,physicalName:'id',type:{kind:'integer'},nullable:false},{id:'scaled-value' as never,physicalName:'value',type:{kind:'decimal',precision:18,scale:4,rounding:'half-even',encoding:'scaled-integer'},nullable:false}],primaryKey:['scaled-id' as never],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}];p.queries=[];
 const query={id:'scaled-query',name:'scaled',sources:[{alias:'e',source:{kind:'table',id:'scaled-table'}}],joins:[],projections:[{id:'out',name:'exact',type:p.schema.tables[0]!.columns[1]!.type,nullable:false,expression:{kind:'field',alias:'e',fieldId:'scaled-value'}}],parameters:[],groupBy:[],orderBy:[{expression:{kind:'field',alias:'e',fieldId:'scaled-value'},direction:'asc'}],grain:{strategy:'rows',keys:[]}};
 const worker=new SQLiteWorker(path);try{expect((await worker.queryPreview(compileQuery(p,query,{},200))).rows).toEqual([{out:'-2.3450'},{out:'90071992547409.9312'}]);}finally{await worker.close();db.close();}
});
test('running expensive structured query cancellation confirms process exit while parent event loop responds',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp15-running-'));roots.push(root);const path=join(root,'cost.sqlite'),db=new Database(path);db.exec('CREATE TABLE numbers(n INTEGER NOT NULL); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10000) INSERT INTO numbers SELECT x FROM n');
 const p=project();p.queries=[];p.schema.tables=[{id:'numbers' as never,physicalName:'numbers',columns:[{id:'number' as never,physicalName:'n',type:{kind:'integer'},nullable:false}],primaryKey:[],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}];
 const query={id:'cost-query',name:'cost',sources:['a','b','c'].map(alias=>({alias,source:{kind:'table',id:'numbers'}})),joins:[['a','b'],['b','c']].map(([leftAlias,rightAlias])=>({leftAlias,rightAlias,kind:'inner',cardinality:'many-to-many',on:{kind:'literal',value:true,type:{kind:'boolean'}}})),projections:[{id:'result',name:'number',type:{kind:'integer'},nullable:false,expression:{kind:'field',alias:'a',fieldId:'number'}}],parameters:[],groupBy:[],orderBy:[{expression:{kind:'binary',operator:'+',left:{kind:'field',alias:'b',fieldId:'number'},right:{kind:'field',alias:'c',fieldId:'number'}},direction:'desc'}],grain:{strategy:'rows',keys:[]}};
 const worker=new SQLiteWorker(path);await worker.inspect();const abort=new AbortController();let responded=false;const start=performance.now();const pending=worker.queryPreview(compileQuery(p,query,{},200),{},{signal:abort.signal,timeoutMs:2000});setTimeout(()=>{responded=true;abort.abort();},40);
 await expect(pending).rejects.toMatchObject({code:'CANCELED'});await worker.close();expect(responded).toBe(true);expect(performance.now()-start).toBeLessThan(1000);expect(db.prepare('SELECT count(*) AS n FROM numbers').get()).toEqual({n:10000});db.close();
});
test('typed blob/date/boolean bindings and allowlisted scalar functions decode their declared shape',async()=>{
 const {path,db}=fixture();const p=project();
 const literal=(value:unknown,type:unknown)=>({kind:'literal',value,type});const fn=(name:string,...args:unknown[])=>({kind:'function',function:name,args});
 const query={id:'scalar-query',name:'scalar',sources:[{alias:'p',source:{kind:'table',id:'parents'}}],joins:[],parameters:[{id:'blob-param',name:'blob',type:{kind:'blob'},nullable:false}],groupBy:[],orderBy:[],grain:{strategy:'rows',keys:[]},projections:[
 {id:'blob-out',name:'blob',type:{kind:'blob'},nullable:false,expression:{kind:'parameter',parameterId:'blob-param'}},
 {id:'text-out',name:'text',type:{kind:'text'},nullable:false,expression:fn('lower',fn('coalesce',literal(null,{kind:'text'}),literal('AbC',{kind:'text'})))},
 {id:'year-out',name:'year',type:{kind:'integer'},nullable:false,expression:fn('year',literal('2024-02-29',{kind:'date',encoding:'iso-date'}))},
 {id:'bool-out',name:'boolean',type:{kind:'boolean'},nullable:false,expression:literal(true,{kind:'boolean'})},
 ]};const worker=new SQLiteWorker(path);try{expect((await worker.queryPreview(compileQuery(p,query,{'blob-param':'AAEC'},1))).rows).toEqual([{'blob-out':'AAEC','text-out':'abc','year-out':2024,'bool-out':true}]);}finally{await worker.close();db.close();}
});
