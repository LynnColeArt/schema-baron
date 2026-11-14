import { expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startOwner } from '../../../../apps/studio/src/server/index.js';
import type { Project } from '@schema-baron/model';
// Lower-level generic regression only: never used to set up visible Equipment acceptance.
async function fixture(nullable:boolean, run:(command:(operation:string,input:unknown)=>Promise<any>,db:Database.Database,project:Project)=>Promise<void>) {
  const root=mkdtempSync(join(tmpdir(),'nullable-backfill-')),capability=crypto.randomUUID()+crypto.randomUUID();
  const owner=await startOwner({ownerId:'nullable-preview',capability,metadataRoot:join(root,'metadata'),approvedRoots:{projects:join(root,'projects')}});
  const db=new Database(join(root,'projects','ledger.sqlite'));db.exec("CREATE TABLE ledger(id INTEGER PRIMARY KEY,amount TEXT);INSERT INTO ledger VALUES(1,'7');");
  let revision=0;
  const command=async(operation:string,input:unknown)=>{const response=await fetch(owner.url+'/api/v1/projects/nullable-project/commands',{method:'POST',headers:{authorization:'Bearer '+capability,'content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),operation,expectedRevision:revision,input})});const outcome=await response.json();if(outcome.ok)revision=outcome.revision;return outcome;};
  try {
    expect(await command('project.create',{name:'Nullable conversion',approvedRoot:'projects',target:'next-typescript-sqlite'})).toMatchObject({ok:true});
    const inspected=await command('connection.inspect',{approvedPath:'projects:ledger.sqlite',mode:'read-only'});expect(inspected.ok).toBe(true);
    expect(await command('connection.bind',{connectionId:inspected.result.connection.id,fingerprint:inspected.result.connection.fingerprint})).toMatchObject({ok:true});
    const p=(await command('project.inspect',{})).result as Project,table=p.schema.tables[0]!,column=table.columns.find(c=>c.physicalName==='amount')!;column.type={kind:'integer'};column.nullable=nullable;p.schema.revision++;
    expect(await command('project.batch',{operations:[{kind:'put',entity:'schema',id:p.schema.id,value:p.schema}]})).toMatchObject({ok:true});
    await run(command,db,p);
  } finally {db.close();await owner.close();rmSync(root,{recursive:true,force:true});}
}
function preview(project:Project,value:number|null) {const table=project.schema.tables[0]!,column=table.columns.find(c=>c.physicalName==='amount')!;return {desiredSchemaRevision:project.schema.revision,backfills:[{tableId:table.id,columnId:column.id,expression:{kind:'literal',value,type:{kind:'integer'}}}]};}
test.each([0,null])('nullable conversion backfill %s previews read-only then applies exactly the reviewed value',async value=>fixture(true,async(command,db,p)=>{
  const planned=await command('schema.preview',preview(p,value));expect(planned).toMatchObject({ok:true,result:{kind:'migration'}});expect(db.prepare('SELECT * FROM ledger').all()).toEqual([{id:1,amount:'7'}]);
  const plan=planned.result;const applied=await command('schema.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds});expect(applied,JSON.stringify(applied)).toMatchObject({ok:true,result:{committed:true,recoveryRequired:false}});
  expect(db.prepare('SELECT * FROM ledger').all()).toEqual([{id:1,amount:value}]);expect(db.pragma('table_info(ledger)')).toEqual(expect.arrayContaining([expect.objectContaining({name:'amount',type:'INTEGER',notnull:0})]));expect(db.prepare('SELECT count(*) n FROM __schema_baron_migrations WHERE plan_hash=?').get(plan.hash)).toEqual({n:1});
}));
test('required target rejects NULL backfill before any physical mutation',async()=>fixture(false,async(command,db,p)=>{
  expect(await command('schema.preview',preview(p,null))).toMatchObject({ok:false,error:{code:'TYPE_MISMATCH'}});expect(db.prepare('SELECT * FROM ledger').all()).toEqual([{id:1,amount:'7'}]);expect(db.pragma('table_info(ledger)')).toEqual(expect.arrayContaining([expect.objectContaining({name:'amount',type:'TEXT',notnull:0})]));expect(db.prepare("SELECT name FROM sqlite_schema WHERE name='__schema_baron_migrations'").all()).toEqual([]);
}));
