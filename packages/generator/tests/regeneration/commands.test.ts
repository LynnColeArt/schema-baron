import {afterEach,expect,test} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import Database from 'better-sqlite3';
import {ProjectCore} from '@schema-baron/core';
import {createId} from '@schema-baron/model';
import type {Project,ReviewedPlan,Operation} from '@schema-baron/model';
import type {RuntimeLifecyclePort} from '../../src/promotion/index.js';
const cores:ProjectCore[]=[],roots:string[]=[];
afterEach(async()=>{await Promise.all(cores.splice(0).map(c=>c.close()));roots.splice(0).forEach(p=>rmSync(p,{recursive:true,force:true}));});
async function setup(runtimeLifecycle?:RuntimeLifecyclePort,generationFault?:(phase:string)=>void) {
 const root=mkdtempSync(join(tmpdir(),'wp20-commands-'));roots.push(root);const definitions=join(root,'definitions'),output=join(root,'output');mkdirSync(definitions);mkdirSync(output);
 const db=new Database(join(definitions,'records.sqlite'));db.exec("CREATE TABLE ledger(code TEXT PRIMARY KEY,caption TEXT NOT NULL);INSERT INTO ledger VALUES('A','Original'),('B','Other')");db.close();
 const core=new ProjectCore({ownerId:'owner',metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions,output},...(runtimeLifecycle?{runtimeLifecycle}:{}),...(generationFault?{generationFault}:{})});cores.push(core);
 const id=createId();let p:Project;
 async function run(operation:Operation,input:unknown,expectedRevision=p?.revision??0,requestId=createId()){return core.executeAsync('owner',{requestId,projectId:id,operation,expectedRevision,input});}
 async function good(operation:Operation,input:unknown){const result=await run(operation,input);if(!result.ok)throw Error(JSON.stringify(result));p=core.snapshot('owner',id);return result.result;}
 p=await good('project.create',{name:'Authored ledger',approvedRoot:'projects',target:'next-typescript-sqlite'}) as Project;
 const inspected=await good('connection.inspect',{approvedPath:'projects:records.sqlite',mode:'read-only'}) as {connection:{id:string;fingerprint:string}};
 await good('connection.bind',{connectionId:inspected.connection.id,fingerprint:inspected.connection.fingerprint});
 const page=createId();await good('project.batch',{operations:[{kind:'put',entity:'page',id:page,value:{id:page,route:'/',title:'Ledger',document:[],formIds:[]}}]});
 const table=p.schema.tables[0]!;await good('form.construct',{pageId:page,kind:'Grid',source:{kind:'table',id:table.id},fieldIds:table.columns.map(c=>c.id),keyIds:[],actions:[],links:[],style:{label:'Ledger'}});
 const hook=createId();await good('project.batch',{operations:[{kind:'put',entity:'extension',id:hook,value:{id:hook,kind:'validator',version:1,relativePath:'authored/rules.ts'}}]});
 const preview=()=>good('generation.preview',{target:p.target,projectRevision:p.revision,outputRoot:'output:app'}) as Promise<Extract<ReviewedPlan,{kind:'generation'}>>;
 const apply=(plan:Extract<ReviewedPlan,{kind:'generation'}>,requestId=createId())=>run('generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds},p.revision,requestId);
 return {root,core,output,definitions,run,good,preview,apply,hook,get project(){return p;}};
}
test('public commands preserve exact authored bytes and independently queried SQLite through two cycles; stale writes/apply refuse',async()=>{
 const s=await setup();const first=await s.preview();expect(await s.apply(first)).toMatchObject({ok:true,result:{manifest:{outputTreeRevision:1}}});
 const source=await s.good('extension.read',{extensionId:s.hook,approvedPath:'output:app/authored/rules.ts'}) as {content:string;hash:string};
 const custom=source.content.replace('(_context) => ({})',"(context) => context.values.caption === 'forbidden' ? {caption:'Authored rejection'} : ({})");
 expect(custom).not.toBe(source.content);await s.good('extension.write',{extensionId:s.hook,approvedPath:'output:app/authored/rules.ts',expectedFileHash:source.hash,content:custom});
 expect(await s.run('extension.write',{extensionId:s.hook,approvedPath:'output:app/authored/rules.ts',expectedFileHash:source.hash,content:'stale'})).toMatchObject({ok:false,error:{code:'OUTPUT_CONFLICT'}});
 const codeOnly=await s.preview(),codeRequest=createId(),codeResult=await s.apply(codeOnly,codeRequest);expect(codeOnly.sourceRevision).toBe(first.sourceRevision);expect(codeResult).toMatchObject({ok:true,result:{manifest:{modelVersion:first.sourceRevision,outputTreeRevision:2}}});expect(await s.apply(codeOnly,codeRequest)).toEqual(codeResult);
 const db=new Database(join(s.definitions,'records.sqlite'),{readonly:true});const oracle=()=>db.prepare('SELECT code,caption FROM ledger ORDER BY code').all(),before=oracle();
 for(let cycle=0;cycle<2;cycle++){const p=s.project;await s.good('project.batch',{operations:[{kind:'put',entity:'page',id:p.pages[0]!.id,value:{...p.pages[0],title:'Ledger cycle '+cycle}}]});mkdirSync(join(s.output,'app','node_modules'));writeFileSync(join(s.output,'app','node_modules','artifact'),'build cache');const plan=await s.preview();expect(plan.steps).toContainEqual(expect.objectContaining({path:'node_modules',operation:'delete'}));expect(plan.impact.some(i=>i.kind==='conflict')).toBe(false);const applied=await s.apply(plan);expect(applied,JSON.stringify(applied)).toMatchObject({ok:true,result:{manifest:{outputTreeRevision:cycle+3}}});expect(readFileSync(join(s.output,'app','authored/rules.ts'),'utf8')).toBe(custom);expect(oracle()).toEqual(before);}
 const stale=await s.preview();writeFileSync(join(s.output,'app','authored/rules.ts'),custom+'\n');expect(await s.apply(stale)).toMatchObject({ok:false,error:{code:'OUTPUT_CONFLICT'}});db.close();
 expect(await s.run('extension.write',{extensionId:s.hook,approvedPath:'output:app/server/auth.ts',expectedFileHash:source.hash,content:'bad'})).toMatchObject({ok:false,error:{code:'ACCESS_DENIED'}});
 expect(s.core.execute('intruder',{requestId:createId(),projectId:s.project.id,operation:'extension.read',expectedRevision:s.project.revision,input:{extensionId:s.hook,approvedPath:'output:app/authored/rules.ts'}})).toMatchObject({ok:false,error:{code:'ACCESS_DENIED'}});
});
test('modified owned, unknown, symlink and removed-interface files block without deletion',async()=>{
 const s=await setup();expect(await s.apply(await s.preview())).toMatchObject({ok:true});const path=join(s.output,'app');writeFileSync(join(path,'README.md'),'owner changes');writeFileSync(join(path,'notes.txt'),'private');symlinkSync(s.definitions,join(path,'external'));
 const plan=await s.preview();for(const name of ['README.md','external','notes.txt'])expect(plan.impact.filter(i=>i.kind==='conflict').map(i=>i.description).join(' ')).toContain(name);expect(await s.apply(plan)).toMatchObject({ok:false,error:{code:'OUTPUT_CONFLICT'}});expect(readFileSync(join(path,'notes.txt'),'utf8')).toBe('private');
});
test('lifecycle stop is awaited before promotion and a refusal preserves complete active output',async()=>{
 let active=false;const lifecycle:RuntimeLifecyclePort={async stopForPromotion(){if(active)throw Error('known active preview cannot stop');return {status:'unmanaged'};}};
 const s=await setup(lifecycle);expect(await s.apply(await s.preview())).toMatchObject({ok:true});const before=readFileSync(join(s.output,'app','README.md'));active=true;const plan=await s.preview();expect(await s.apply(plan)).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});expect(readFileSync(join(s.output,'app','README.md'))).toEqual(before);
});
test('row-only external edits survive apply and a database rebound inside runtime artifacts is refused',async()=>{
 const s=await setup();expect(await s.apply(await s.preview())).toMatchObject({ok:true});
 const stale=await s.preview(),db=new Database(join(s.definitions,'records.sqlite'));db.exec("INSERT INTO ledger VALUES('C','External write')");db.close();
 expect(await s.apply(stale)).toMatchObject({ok:true});const oracle=new Database(join(s.definitions,'records.sqlite'),{readonly:true});expect(oracle.prepare('SELECT caption FROM ledger WHERE code=?').get('C')).toEqual({caption:'External write'});oracle.close();
 mkdirSync(join(s.output,'app','.next'));const inside=new Database(join(s.output,'app','.next','data.sqlite'));inside.exec('CREATE TABLE ledger(code TEXT PRIMARY KEY,caption TEXT NOT NULL)');inside.close();
 const inspected=await s.good('connection.inspect',{approvedPath:'output:app/.next/data.sqlite',mode:'read-only',connectionId:s.project.connections[0]!.id}) as {connection:{id:string;fingerprint:string}};
 await s.good('connection.bind',{connectionId:inspected.connection.id,fingerprint:inspected.connection.fingerprint});
 expect(await s.run('generation.preview',{target:s.project.target,projectRevision:s.project.revision,outputRoot:'output:app'})).toMatchObject({ok:false,diagnostics:[{objectId:s.project.connections[0]!.id,code:'PATH_OUTSIDE_ROOT'}]});
 expect(readFileSync(join(s.output,'app','README.md'),'utf8')).toContain('Independent');
});
test('page removal requires exact reviewed acknowledgement; custom interface changes cannot be overwritten',async()=>{
 const s=await setup(),extra=createId();await s.good('project.batch',{operations:[{kind:'put',entity:'page',id:extra,value:{id:extra,route:'/temporary',title:'Temporary',formIds:[],document:[{kind:'text',text:'Owned route'}]}}]});expect(await s.apply(await s.preview())).toMatchObject({ok:true});
 await s.good('project.batch',{operations:[{kind:'remove',entity:'page',id:extra}]});const plan=await s.preview();expect(plan.steps).toContainEqual(expect.objectContaining({path:'app/temporary/page.tsx',operation:'delete'}));
 expect(await s.run('generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]})).toMatchObject({ok:false,error:{code:'IMPACT_NOT_ACKNOWLEDGED'}});expect(await s.apply(plan)).toMatchObject({ok:true});
 const source=await s.good('extension.read',{extensionId:s.hook,approvedPath:'output:app/authored/rules.ts'}) as {content:string;hash:string};await s.good('extension.write',{extensionId:s.hook,approvedPath:'output:app/authored/rules.ts',expectedFileHash:source.hash,content:source.content.replace('contractVersion = 1','contractVersion = 2')});const incompatible=await s.preview();expect(incompatible.impact).toContainEqual(expect.objectContaining({kind:'conflict',description:expect.stringContaining('interface')}));expect(await s.apply(incompatible)).toMatchObject({ok:false,error:{code:'OUTPUT_CONFLICT'}});
 await s.good('project.batch',{operations:[{kind:'remove',entity:'extension',id:s.hook}]});const removed=await s.preview();expect(removed.impact).toContainEqual(expect.objectContaining({kind:'conflict',description:expect.stringContaining('removed')}));expect(readFileSync(join(s.output,'app','authored/rules.ts'),'utf8')).toContain('contractVersion = 2');
});
test('interrupted promotion is reconciled from its canonical intent, preserving the original committed retry after a later model edit',async()=>{
 let fail=false;const s=await setup(undefined,phase=>{if(fail&&phase==='after-new-rename'){fail=false;throw Error('process interrupted after promotion');}});expect(await s.apply(await s.preview())).toMatchObject({ok:true});
 const plan=await s.preview(),requestId=createId();fail=true;expect(await s.apply(plan,requestId)).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});
 const page=s.project.pages[0]!;await s.good('project.batch',{operations:[{kind:'put',entity:'page',id:page.id,value:{...page,title:'Later model'}}]});
 await s.preview();expect(await s.run('generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds},plan.sourceRevision,requestId)).toMatchObject({ok:true,revision:plan.sourceRevision,result:{committed:true,manifest:{outputTreeRevision:2}}});
});
test('generation preserves nonempty canonical migration history and data independently',async()=>{
 const s=await setup(),schema=s.project.schema,table=schema.tables[0]!;await s.good('project.batch',{operations:[{kind:'put',entity:'schema',id:schema.id,value:{...schema,revision:schema.revision+1,tables:[table,{id:'migration-source',physicalName:'migration_source',columns:[{id:'migration-key',physicalName:'id',nullable:false,type:{kind:'text'}}],primaryKey:['migration-key'],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}]}}]});
 const migration=await s.good('schema.preview',{desiredSchemaRevision:s.project.schema.revision,backfills:[]}) as Extract<ReviewedPlan,{kind:'migration'}>;
 await s.good('schema.apply',{planId:migration.id,hash:migration.hash,acknowledgedImpactIds:migration.requiredAcknowledgementIds});
 const history=await s.good('schema.history',{connectionId:s.project.connections[0]!.id});expect(history).toEqual(expect.arrayContaining([expect.objectContaining({outcome:'committed'})]));
 for(let i=0;i<2;i++)expect(await s.apply(await s.preview())).toMatchObject({ok:true});expect(await s.good('schema.history',{connectionId:s.project.connections[0]!.id})).toEqual(history);
 const db=new Database(join(s.definitions,'records.sqlite'),{readonly:true});try{expect(db.prepare('SELECT code,caption FROM ledger ORDER BY code').all()).toEqual([{code:'A',caption:'Original'},{code:'B',caption:'Other'}]);}finally{db.close();}
});
test('recovery refuses a later in-output data rebind before moving the reviewed old tree',async()=>{
 let fail=false;const s=await setup(undefined,phase=>{if(fail&&phase==='before-old-rename'){fail=false;throw Error('interrupted before old rename');}});expect(await s.apply(await s.preview())).toMatchObject({ok:true});
 mkdirSync(join(s.output,'app','.next'));const path=join(s.output,'app','.next','data.sqlite'),db=new Database(path);db.exec('CREATE TABLE ledger(code TEXT PRIMARY KEY,caption TEXT NOT NULL)');db.close();
 const plan=await s.preview();fail=true;expect(await s.apply(plan)).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});
 const inspected=await s.good('connection.inspect',{approvedPath:'output:app/.next/data.sqlite',mode:'read-only',connectionId:s.project.connections[0]!.id}) as {connection:{id:string;fingerprint:string}};await s.good('connection.bind',{connectionId:inspected.connection.id,fingerprint:inspected.connection.fingerprint});
 expect(await s.run('generation.preview',{target:s.project.target,projectRevision:s.project.revision,outputRoot:'output:app'})).toMatchObject({ok:false,diagnostics:[{code:'PATH_OUTSIDE_ROOT'}]});expect(readFileSync(path).subarray(0,15).toString()).toBe('SQLite format 3');
});
