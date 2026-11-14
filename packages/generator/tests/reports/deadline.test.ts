import {expect,test} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync,renameSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import Database from 'better-sqlite3';
import {parseProject} from '@schema-baron/model';
import {compileProject,emitApplication} from '../../src/index.js';
function output(expensive:boolean){
 mkdirSync('.local',{recursive:true});const root=mkdtempSync(resolve('.local/report-isolation-')),database=join(root,'source.sqlite');
 const p=JSON.parse(readFileSync('fixtures/queries/project.json','utf8'));
 const q={id:'bounded-count',name:'Bounded count',sources:[{alias:'a',source:{kind:'table',id:'parents'}},...(expensive?[{alias:'b',source:{kind:'table',id:'parents'}}]:[])],joins:expensive?[{leftAlias:'a',rightAlias:'b',kind:'inner',cardinality:'many-to-many',on:{kind:'literal',type:{kind:'boolean'},value:true}}]:[],projections:[{id:'bounded-result',name:'Count',type:{kind:'integer'},nullable:false,expression:{kind:'aggregate',function:'count',zeroChildren:'zero'}}],parameters:[],groupBy:[],orderBy:[],grain:{strategy:'grouped',keys:[]}};
 p.queries=[q];p.connections=[{id:'connection',name:'data',locator:{approvedRootId:'data',relativePath:'source.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]}}];p.connectionRefs=['connection'];p.pages=[{id:'isolation-page',route:'/count',title:'Count',formIds:['isolation-form'],document:[{kind:'form',formId:'isolation-form'}]}];p.forms=[{id:'isolation-form',pageId:'isolation-page',kind:'Grid',sourceRef:{kind:'query',id:q.id},keyMapping:[],controlIds:['isolation-control'],actionIds:[],search:[],sorting:[],paging:{pageSize:20},appearance:{}}];p.controls=[{id:'isolation-control',formId:'isolation-form',kind:'label',binding:{kind:'stored',fieldId:'bounded-result'},readOnly:true,appearance:{},validation:{required:false},events:[]}];p.actions=[];
 const ir=compileProject(parseProject(p));const db=new Database(database);db.exec('CREATE TABLE "parent "" ledger"("first key" TEXT NOT NULL,"second key" INTEGER NOT NULL,PRIMARY KEY("first key","second key"));WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<90000) INSERT INTO "parent "" ledger" SELECT \'x\',x FROM n');db.close();
 // Direct Node harness removes only framework marker imports; execution/data modules are emitted unchanged.
 for(const file of emitApplication(ir,database)){const path=join(root,file.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,['server/query-runtime.ts','server/connection.ts'].includes(file.path)?file.content.replace("import 'server-only';",''):file.content);}
 const plan={...ir.queries[0]!,compiled:{...ir.queries[0]!.compiled,sql:ir.queries[0]!.compiled.sql+' OFFSET @sb_report_offset'}};
 writeFileSync(join(root,'plan.json'),JSON.stringify(plan));
 writeFileSync(join(root,'run.mjs'),`import {readFileSync} from 'node:fs';import {readReport} from './server/query-runtime.ts';const mode=process.argv[2];const controller=new AbortController();if(mode==='abort')setTimeout(()=>controller.abort(),200);if(mode==='shutdown')setTimeout(()=>process.kill(process.pid,'SIGTERM'),200);if(mode==='disconnect')setTimeout(()=>process.emit('disconnect'),200);const started=Date.now();const result=await readReport(JSON.parse(readFileSync('./plan.json','utf8')),[],{},'isolation',{signal:controller.signal});console.log(JSON.stringify({elapsed:Date.now()-started,result}));`);
 return root;
}
async function run(root:string,mode='deadline'){
 const child=spawn(process.execPath,['--conditions=react-server','run.mjs',mode],{cwd:root,env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});
 const executionPids=new Set<number>();let text='',stderr='',forced=false,resultAt=0;
 const observe=setInterval(()=>{try{for(const pid of readFileSync(`/proc/${child.pid}/task/${child.pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean))executionPids.add(Number(pid));}catch{}},10);
 child.stdout!.on('data',chunk=>{text+=String(chunk);if(text.includes('\n'))resultAt=Date.now();});child.stderr!.on('data',chunk=>stderr+=String(chunk));
 const deadline=setInterval(()=>{if(resultAt&&Date.now()-resultAt>1000){forced=true;child.kill('SIGKILL');}},20);
 const watchdog=setTimeout(()=>{forced=true;child.kill('SIGKILL');},10000);
 const exited=await new Promise<{code:number|null;signal:string|null}>(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 clearInterval(observe);clearInterval(deadline);clearTimeout(watchdog);
 const living=[...executionPids].filter(pid=>existsSync(`/proc/${pid}`));
 for(const pid of living){try{if(readFileSync(`/proc/${pid}/cmdline`,'utf8').includes(root))process.kill(pid,'SIGKILL');}catch{}}
 return {forced,exited,stderr,living,executionPids:[...executionPids],value:text?JSON.parse(text):undefined};
}
test('compiler-accepted 90k-row native join is dead before its deadline error settles',async()=>{
 const root=output(true);try{const observed=await run(root);if(process.env.SCHEMA_BARON_REPORT_EVIDENCE)writeFileSync(process.env.SCHEMA_BARON_REPORT_EVIDENCE,JSON.stringify(observed,null,2));expect(observed.value?.result.error,observed.stderr).toContain('report could not be read');expect(observed.value.elapsed).toBeGreaterThanOrEqual(4900);expect(observed.value.elapsed).toBeLessThan(8000);expect(observed.forced,'native execution kept runner alive after the error').toBe(false);expect(observed.exited.code,observed.stderr).toBe(0);expect(observed.living).toEqual([]);if(process.platform==='linux')expect(observed.executionPids.length).toBe(1);}finally{rmSync(root,{recursive:true,force:true});}
},15000);
test('success, cancellation, process failure and shutdown reap isolated report execution',async()=>{
 const fast=output(false),slow=output(true);try{
  const normal=await run(fast,'normal');expect(normal.value?.result.rows).toEqual([{'bounded-result':90000}]);expect(normal.living).toEqual([]);expect(normal.forced).toBe(false);
  for(const mode of ['abort','shutdown','disconnect']){const stopped=await run(slow,mode);expect(stopped.forced).toBe(false);expect(stopped.living).toEqual([]);if(mode==='abort'){expect(stopped.value?.result.error).toBeTruthy();expect(stopped.value.elapsed).toBeLessThan(2000);}}
  writeFileSync(join(fast,'server/connection.ts'),"export const databasePath='/missing/report-source.sqlite';\n");const failed=await run(fast,'missing');expect(failed.value?.result.error).toBeTruthy();expect(failed.living).toEqual([]);expect(failed.forced).toBe(false);
  renameSync(join(fast,'server/query-worker.mjs'),join(fast,'server/stopped-worker.mjs'));const crashed=await run(fast,'crashed');expect(crashed.value?.result.error).toBeTruthy();expect(crashed.living).toEqual([]);expect(crashed.forced).toBe(false);
 }finally{rmSync(fast,{recursive:true,force:true});rmSync(slow,{recursive:true,force:true});}
},20000);
