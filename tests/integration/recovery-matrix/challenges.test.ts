import {expect,test} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,symlinkSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {startOwner} from '../../../apps/studio/src/server/index.js';
import type {RunningOwner} from '../../../apps/studio/src/server/index.js';
import type {Operation,ReviewedPlan,MigrationHistory} from '@schema-baron/model';
import type {Outcome} from '@schema-baron/core';
import {runChild,EvidenceJournal} from '../../contracts/parity/harness.js';
const evidence=resolve(process.env.SCHEMA_BARON_RECOVERY_EVIDENCE??'docs/evidence/recovery');
async function fixture(hook?:(owner:RunningOwner,point:string)=>void){
 const root=mkdtempSync(join(tmpdir(),'baron-cross-boundary-'));
 const prepared=await runChild(process.execPath,[resolve('tests/integration/recovery-matrix/owner.mjs'),root,'prepare'],{cwd:process.cwd(),timeoutMs:25000});expect(prepared.status,prepared.stderr).toBe(0);
 const capability=crypto.randomUUID()+crypto.randomUUID();
 let owner:RunningOwner;
 owner=await startOwner({ownerId:'owner',capability,metadataRoot:join(root,'metadata'),approvedRoots:{projects:join(root,'projects'),output:join(root,'output')},maxPayloadBytes:8192,migrationFault:point=>hook?.(owner,point)});
 const snapshot=()=>owner.service.core.snapshot('owner','p');
 const command=(operation:Operation,input:unknown,expectedRevision=snapshot().revision,requestId:string=crypto.randomUUID())=>({projectId:'p',operation,input,expectedRevision,requestId});
 const send=async(c:unknown,headers:Record<string,string>={})=>{const response=await fetch(owner.url+'/api/v1/projects/p/commands',{method:'POST',headers:{authorization:'Bearer '+capability,'content-type':'application/json',...headers},body:JSON.stringify(c)});return {status:response.status,outcome:await response.json() as Outcome};};
 const good=async(operation:Operation,input:unknown)=>{const {outcome}=await send(command(operation,input));expect(outcome,JSON.stringify(outcome)).toMatchObject({ok:true});if(!outcome.ok)throw Error('Operation refused');return outcome.result;};
 const migration=async()=>{const schema=structuredClone(snapshot().schema);schema.revision++;schema.tables.find(t=>t.physicalName==='parent')!.columns.find(c=>c.physicalName==='title')!.physicalName='caption';await good('project.batch',{operations:[{kind:'put',entity:'schema',id:schema.id,value:schema}]});return await good('schema.preview',{desiredSchemaRevision:schema.revision,backfills:[]}) as Extract<ReviewedPlan,{kind:'migration'}>;};
 const apply=(plan:ReviewedPlan)=>({planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds});
 const close=async()=>{await owner.close();rmSync(root,{recursive:true,force:true});};
 return {root,owner,capability,snapshot,command,send,good,migration,apply,close};
}
for(const point of ['before-ddl','before-reconcile'])test('actual migration cancellation at '+point+' reports durable truth',async()=>{
 let cancellation:Promise<Outcome>|undefined,hit=false;const boundaryChecks:Record<string,unknown>={};
 const journal=new EvidenceJournal(evidence,'cancel-'+point);
 const f=await fixture((owner,p)=>{
  if(p!==point||hit)return;hit=true;
  const core=owner.service.core,project=core.snapshot('owner','p');
  const history=core.execute('owner',{projectId:'p',operation:'schema.history',input:{connectionId:project.connections[0]!.id},expectedRevision:project.revision,requestId:crypto.randomUUID()});
  if(!history.ok)throw Error('History unavailable at cancellation boundary');
  const job=(history.result as MigrationHistory[])[0]!;
  boundaryChecks.busy=core.execute('owner',{projectId:'p',operation:'project.batch',input:{operations:[{kind:'put',entity:'page',id:project.pages[0]!.id,value:project.pages[0]}]},expectedRevision:project.revision,requestId:crypto.randomUUID()});
  boundaryChecks.forged=core.execute('intruder',{projectId:'p',operation:'job.cancel',input:{jobId:job.id},expectedRevision:project.revision,requestId:crypto.randomUUID()});
  cancellation=core.executeAsync('owner',{projectId:'p',operation:'job.cancel',input:{jobId:job.id},expectedRevision:project.revision,requestId:'actual-cancel'});
 });
 try{
  const plan=await f.migration();journal.begin({point,revision:f.snapshot().revision});
  const result=await f.send(f.command('schema.apply',f.apply(plan)));
  expect(hit).toBe(true);expect(boundaryChecks.busy).toMatchObject({ok:false,error:{code:'PROJECT_BUSY'}});expect(boundaryChecks.forged).toMatchObject({ok:false,error:{code:'ACCESS_DENIED'}});expect(cancellation).toBeDefined();let canceled=await cancellation!;const raced=canceled;
  const committed=point==='before-reconcile';
  if(committed){expect(canceled).toMatchObject({ok:false,error:{code:'REVISION_CONFLICT'}});const history=await f.good('schema.history',{connectionId:f.snapshot().connections[0]!.id}) as MigrationHistory[];canceled=(await f.send(f.command('job.cancel',{jobId:history[0]!.id},f.snapshot().revision,'actual-cancel-current'))).outcome;}
  expect(canceled,JSON.stringify(canceled)).toMatchObject({ok:true,result:{committed,status:committed?'succeeded':'canceled'}});
  expect(result.outcome).toMatchObject(committed?{ok:true,result:{committed:true}}:{ok:false,error:{code:'CANCELED'}});
  const db=new Database(join(f.root,'projects/app.sqlite'),{readonly:true});
  try{const rows=db.prepare('SELECT * FROM parent').all();expect(rows).toEqual(committed?[{id:1,caption:'original'}]:[{id:1,title:'original'}]);expect(db.pragma('foreign_key_check')).toEqual([]);journal.observed({committed,rows,initialOutcome:raced.ok?'success':raced.error.code,cancelStatus:canceled.ok?(canceled.result as {status:string}).status:'error'});}finally{db.close();}
  const revision=f.snapshot().revision;
  const history=await f.good('schema.history',{connectionId:f.snapshot().connections[0]!.id}) as MigrationHistory[];
  expect((await f.send(f.command('job.cancel',{jobId:history[0]!.id},revision,committed?'actual-cancel-current':'actual-cancel'))).outcome).toEqual(canceled);
  journal.succeed();
 }catch(error){journal.fail(error);throw error;}finally{await f.close();}
},60000);

test('busy WAL writer and external data/schema invalidate reviewed plans without overwriting external state',async()=>{
 const f=await fixture(),journal=new EvidenceJournal(evidence,'external-wal');
 const db=new Database(join(f.root,'projects/app.sqlite'));
 try{
  journal.begin({scenario:'wal-busy-external'});const plan=await f.migration();
  db.exec('BEGIN IMMEDIATE');const busy=await f.send(f.command('schema.apply',f.apply(plan)));db.exec('ROLLBACK');
  expect(busy.outcome.ok).toBe(false);
  db.exec("INSERT INTO parent VALUES(2,'external')");
  const stale=await f.send(f.command('schema.apply',f.apply(plan)));expect(stale.outcome).toMatchObject({ok:false,error:{code:'DATABASE_CHANGED'}});
  const second=await f.good('schema.preview',{desiredSchemaRevision:f.snapshot().schema.revision,backfills:[]}) as ReviewedPlan;
  db.exec('CREATE TABLE external_evidence(id INTEGER PRIMARY KEY);INSERT INTO external_evidence VALUES(42)');
  expect((await f.send(f.command('schema.apply',f.apply(second)))).outcome).toMatchObject({ok:false,error:{code:'DATABASE_CHANGED'}});
  expect(db.prepare('SELECT * FROM parent ORDER BY id').all()).toEqual([{id:1,title:'original'},{id:2,title:'external'}]);expect(db.prepare('SELECT * FROM external_evidence').all()).toEqual([{id:42}]);
  expect(db.pragma('foreign_key_check')).toEqual([]);journal.observed({busyCode:busy.outcome.ok?'unexpected':busy.outcome.error.code,rows:db.prepare('SELECT * FROM parent ORDER BY id').all(),external:db.prepare('SELECT * FROM external_evidence').all()});journal.succeed();
 }catch(error){journal.fail(error);throw error;}finally{if(db.inTransaction)db.exec('ROLLBACK');db.close();await f.close();}
},60000);

test('recovery output conflicts and transport challenges preserve authored bytes and secrets',async()=>{
 const f=await fixture(),journal=new EvidenceJournal(evidence,'security-conflicts');
 const secret='transient-'+crypto.randomUUID();journal.redact(f.capability,secret);
 try{
  journal.begin({scenario:'output-and-security'});
  const authored=readFileSync(join(f.root,'output/app/authored/rules.ts'));
  writeFileSync(join(f.root,'output/app/README.md'),'owner modification');writeFileSync(join(f.root,'output/app/unknown.txt'),'unknown preserved');symlinkSync(join(f.root,'projects'),join(f.root,'output/app/external'));
  const plan=await f.good('generation.preview',{target:f.snapshot().target,projectRevision:f.snapshot().revision,outputRoot:'output:app'}) as ReviewedPlan;
  for(const name of ['README.md','unknown.txt','external'])expect(JSON.stringify(plan.impact)).toContain(name);
  expect((await f.send(f.command('generation.apply',f.apply(plan)))).outcome).toMatchObject({ok:false,error:{code:'OUTPUT_CONFLICT'}});
  expect(readFileSync(join(f.root,'output/app/authored/rules.ts'))).toEqual(authored);expect(readFileSync(join(f.root,'output/app/unknown.txt'),'utf8')).toBe('unknown preserved');
  const before=readFileSync(join(f.root,'projects/p.json'));
  expect((await f.send(f.command('project.inspect',{}),{authorization:'Bearer forged'})).status).toBe(401);
  expect((await f.send(f.command('project.inspect',{}),{origin:'https://evil.test'})).status).toBe(403);
  const exchange=await fetch(f.owner.url+'/api/v1/session',{method:'POST',headers:{authorization:'Bearer '+f.capability,origin:f.owner.url,'content-type':'application/json'},body:'{}'});
  const cookie=exchange.headers.get('set-cookie')!.split(';')[0]!;
  expect((await fetch(f.owner.url+'/api/v1/projects/p/commands',{method:'POST',headers:{cookie,origin:f.owner.url,'content-type':'application/json'},body:JSON.stringify(f.command('project.inspect',{}))})).status).toBe(403);
  expect((await f.send(f.command('project.inspect',{oversized:'x'.repeat(10000)}))).status).toBe(413);
  for(const path of ['projects:../escape.json','output:app/external/stolen.json'])expect((await f.send(f.command('project.export',{destination:path}))).outcome).toMatchObject({ok:false,error:{code:'PATH_OUTSIDE_ROOT'}});
  const rejected=await f.send(f.command('project.inspect',{password:secret,returnTo:'https://evil.test'}));expect(JSON.stringify(rejected)).not.toContain(secret);
  expect(readFileSync(join(f.root,'projects/p.json'))).toEqual(before);
  for(const name of readdirSync(join(f.root,'metadata')))if(!name.endsWith('-shm')){const bytes=readFileSync(join(f.root,'metadata',name)).toString();expect(bytes).not.toContain(secret);expect(bytes).not.toContain(f.capability);}
  journal.observed({conflicts:['modified-owned','unknown','symlink'],security:['forged-capability','cross-origin','csrf','oversize','traversal','symlink-export','secret-redaction'],authoredPreserved:true});journal.succeed();
 }catch(error){journal.fail(error);throw error;}finally{await f.close();}
},60000);
