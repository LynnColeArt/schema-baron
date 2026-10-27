import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, symlinkSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { inspectDatabase } from '@schema-baron/sqlite';
import { createId, parseProject } from '@schema-baron/model';
import type { Project, ReviewedPlan } from '@schema-baron/model';
import { StorageError } from '@schema-baron/storage';
import { ProjectCore, planHash } from '@schema-baron/core';
import { compileProject, emitApplication, observeOutput, writeInitialOutput, verifyFiles } from '../../src/index.js';
const roots:string[]=[];const cores:ProjectCore[]=[];
afterEach(async()=>{await Promise.all(cores.splice(0).map(c=>c.close()));roots.splice(0).forEach(r=>rmSync(r,{recursive:true,force:true}));});
function root(){const path=mkdtempSync(join(tmpdir(),'wp10-generator-'));roots.push(path);return path;}
function project(name='volumes',route='/library'):Project {
 const p=createId(),policy=createId(),table=createId(),field=createId(),page=createId(),form=createId(),control=createId();
 const schema={id:createId(),revision:1,tables:[{id:table,physicalName:name,columns:[{id:field,physicalName:'title',type:{kind:'text'},nullable:false}],primaryKey:[field],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}],opaqueObjects:[]};
 return parseProject({id:p,formatVersion:1,revision:1,name:'Independent '+name,target:'next-typescript-sqlite',targetVersion:'1',connectionRefs:['connection'],connections:[{id:'connection',name:'Application data',locator:{approvedRootId:'projects',relativePath:'data.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]},inspectedSchema:schema}],schema,queries:[],pages:[{id:page,route,title:name,document:[{kind:'form',formId:form}],formIds:[form]}],forms:[{id:form,pageId:page,kind:'Grid',sourceRef:{kind:'table',id:table},keyMapping:[],controlIds:[control],actionIds:[],search:[{fieldId:field,operator:'contains'}],sorting:[{fieldId:field,direction:'asc'}],paging:{pageSize:20},appearance:{label:name}}],controls:[{id:control,formId:form,kind:'label',binding:{kind:'stored',fieldId:field},readOnly:true,appearance:{label:'Title'},validation:{required:false},events:[]}],actions:[],policies:[{id:policy,ownerId:p,scope:'global',access:'public'}],globalPolicyId:policy,outputConfig:{approvedRootId:'output',relativePath:'app'},extensionContracts:[]});
}
function setup(generationFault?:(phase:string)=>void){const path=root(),definitions=join(path,'definitions'),output=join(path,'output');mkdirSync(definitions);mkdirSync(output);const p=project();writeFileSync(join(definitions,p.id+'.json'),JSON.stringify(p));const db=new Database(join(definitions,'data.sqlite'));db.exec("CREATE TABLE volumes(title TEXT PRIMARY KEY); INSERT INTO volumes VALUES('Real data')");p.connections[0]!.fingerprint=inspectDatabase(db).fingerprint;db.close();writeFileSync(join(definitions,p.id+'.json'),JSON.stringify(p));const core=new ProjectCore({...(generationFault?{generationFault}:{}),ownerId:'owner',metadataRoot:join(path,'metadata'),approvedRoots:{projects:definitions,output}});cores.push(core);expect(core.execute('owner',{requestId:createId(),projectId:p.id,operation:'project.open',expectedRevision:1,input:{locator:`projects:${p.id}.json`}}).ok).toBe(true);return {path,definitions,output,p,core};}
function command(core:ProjectCore,p:Project,operation:string,input:unknown,requestId=createId()){return core.executeAsync('owner',{requestId,projectId:p.id,operation,expectedRevision:p.revision,input});}
async function preview(core:ProjectCore,p:Project){const result=await command(core,p,'generation.preview',{target:p.target,projectRevision:p.revision,outputRoot:'output:app'});expect(result).toMatchObject({ok:true});if(!result.ok)throw Error(JSON.stringify(result));return result.result as Extract<ReviewedPlan,{kind:'generation'}>;}
test('unrelated and quoted schemas compile explicit sources/routes/policies deterministically',async()=>{for(const [name,path] of [['volumes','/library'],['odd " select','/stock']] as const){const p=project(name,path),ir=compileProject(p);expect(ir.routes[0]).toMatchObject({path,policy:{access:'public'},grids:[{source:{name,keys:p.schema.tables[0]!.primaryKey}}]});const files=emitApplication(ir,'/external/stable.sqlite');expect(files.find(f=>f.path===`app${path}/page.tsx`)?.content).toContain('Grid0');expect(files.every(f=>!f.content.includes('@schema-baron/'))).toBe(true);expect(emitApplication(ir,'/external/stable.sqlite')).toEqual(files);}});
test('broken references, hostile routes and unsupported protection block with object diagnostics',async()=>{const p=project();p.controls[0]!.binding={kind:'stored',fieldId:createId()};expect(()=>compileProject(p)).toThrow();for(const route of ['/../../escape','/[dynamic]']){const hostile=project();hostile.pages[0]!.route=route;expect(()=>compileProject(hostile)).toThrow();}const auth=project();auth.policies[0]!.access='authenticated';try{compileProject(auth);throw Error('unexpected compile');}catch(e){expect(e).toMatchObject({diagnostics:[{objectId:auth.pages[0]!.id,code:'UNSUPPORTED_SCHEMA_OBJECT'}]});}});
test('real preview/apply preserve rows and idempotency; nonempty regeneration is refused',async()=>{const {core,p,output,definitions}=setup(),before=readFileSync(join(definitions,'data.sqlite')),plan=await preview(core,p);expect(plan.steps.every(s=>s.operation==='create'&&s.afterContent&&s.afterHash)).toBe(true);const input={planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]},id=createId();const result=await command(core,p,'generation.apply',input,id);expect(result).toMatchObject({ok:true,result:{committed:true,recoveryRequired:false}});expect(await command(core,p,'generation.apply',input,id)).toEqual(result);expect(await command(core,p,'generation.apply',{...input,hash:'f'.repeat(64)},id)).toMatchObject({error:{code:'IDEMPOTENCY_CONFLICT'}});expect(readFileSync(join(definitions,'data.sqlite'))).toEqual(before);expect(readFileSync(join(output,'app','server/connection.ts'),'utf8')).toContain('data.sqlite');expect(await command(core,p,'generation.preview',{target:p.target,projectRevision:1,outputRoot:'output:app'})).toMatchObject({error:{code:'OUTPUT_CONFLICT'}});});
test('stale revision, bad hash, traversal and symlinks perform no output writes',async()=>{const {core,p,output}=setup(),plan=await preview(core,p);for(const outputRoot of ['output:../escape','output:.'])expect(await command(core,p,'generation.preview',{target:p.target,projectRevision:1,outputRoot})).toMatchObject({error:{code:'PATH_OUTSIDE_ROOT'}});symlinkSync(root(),join(output,'link'));expect(await command(core,p,'generation.preview',{target:p.target,projectRevision:1,outputRoot:'output:link/app'})).toMatchObject({error:{code:'PATH_OUTSIDE_ROOT'}});expect(await command(core,p,'generation.apply',{planId:plan.id,hash:'f'.repeat(64),acknowledgedImpactIds:[]})).toMatchObject({error:{code:'PLAN_HASH_MISMATCH'}});expect(await command(core,{...p,revision:2},'generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]})).toMatchObject({error:{code:'REVISION_CONFLICT'}});expect(readdirSync(output).filter(name=>!name.startsWith('.schema-baron-writer.sqlite'))).toEqual(['link']);});
test('staging cancellation and a competing destination preserve authored files; parent inode races fail',async()=>{const directory=root(),path=join(directory,'app'),files=[{path:'app/page.tsx',content:'hello'}],observed=observeOutput(path);expect(()=>writeInitialOutput(path,files,observed,()=>{},()=>{throw Error('cancel before promotion');})).toThrow('cancel');expect(readdirSync(directory)).toEqual([]);expect(()=>writeInitialOutput(path,files,observed,()=>{},phase=>{if(phase==='staged'){mkdirSync(path);writeFileSync(join(path,'authored.txt'),'keep');}})).toThrow('Output');expect(readFileSync(join(path,'authored.txt'),'utf8')).toBe('keep');expect(readdirSync(directory)).toEqual(['app']);const parent=join(directory,'parent');mkdirSync(parent);const target=join(parent,'new'),fingerprint=observeOutput(target);renameSync(parent,join(directory,'old-parent'));mkdirSync(parent);expect(()=>writeInitialOutput(target,files,fingerprint)).toThrow('parent changed');expect(readdirSync(parent)).toEqual([]);});
test('a caller-created lookalike tree cannot be adopted; changed output remains untouched',async()=>{const {core,p,output}=setup(),plan=await preview(core,p),files=plan.steps.map(s=>({path:s.path,content:s.afterContent!}));writeInitialOutput(join(output,'app'),files,plan.outputFingerprint);expect(verifyFiles(join(output,'app'),files)).toBe(true);const input={planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]};expect(await command(core,p,'generation.apply',input)).toMatchObject({error:{code:'OUTPUT_CONFLICT'}});writeFileSync(join(output,'app','README.md'),'authored');expect(await command(core,p,'generation.apply',input)).toMatchObject({error:{code:'OUTPUT_CONFLICT'}});expect(readFileSync(join(output,'app','README.md'),'utf8')).toBe('authored');});

test('canonical apply intent recovers promotion after an uncertain outcome without redoing output',async()=>{let interrupted=false;const {core,p,output}=setup(()=>{if(!interrupted){interrupted=true;throw new StorageError('RECOVERY_REQUIRED','Simulated loss after promotion');}}),plan=await preview(core,p),request=createId(),input={planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]};expect(await command(core,p,'generation.apply',input,request)).toMatchObject({error:{code:'RECOVERY_REQUIRED'}});const before=readFileSync(join(output,'app','.schema-baron-generation.json'));expect(await command(core,p,'generation.apply',input,request)).toMatchObject({ok:true,result:{committed:true}});expect(readFileSync(join(output,'app','.schema-baron-generation.json'))).toEqual(before);});

test('actual apply rejects expired, unacknowledged and stale plans before writes',async()=>{
 const {core,p,output}=setup(),plan=await preview(core,p);
 const input={planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]};
 expect(await command(core,p,'generation.apply',{...input,acknowledgedImpactIds:[createId()]})).toMatchObject({error:{code:'IMPACT_NOT_ACKNOWLEDGED'}});
 const expired={...plan,id:createId(),createdAt:'2020-01-01T00:00:00.000Z',expiresAt:'2020-01-01T00:01:00.000Z'};expired.hash=planHash(expired);core.plans.record('owner',p.id,expired);
 expect(await command(core,p,'generation.apply',{...input,planId:expired.id,hash:expired.hash})).toMatchObject({error:{code:'PLAN_EXPIRED'}});
 expect(await command(core,p,'project.batch',{operations:[{kind:'put',entity:'page',id:p.pages[0]!.id,value:{...p.pages[0]!,title:'Changed'}}]})).toMatchObject({ok:true,revision:2});
 expect(await command(core,{...p,revision:2},'generation.apply',input)).toMatchObject({error:{code:'REVISION_CONFLICT'}});
 expect(readdirSync(output).filter(name=>!name.startsWith('.schema-baron-writer.sqlite'))).toEqual([]);
});
test('kernel no-clobber promotion detects a target created after final freshness check',async()=>{
 const directory=root(),path=join(directory,'app'),files=[{path:'README.md',content:'generated'}],fingerprint=observeOutput(path);
 expect(()=>writeInitialOutput(path,files,fingerprint,()=>{},phase=>{if(phase==='promote'){mkdirSync(path);writeFileSync(join(path,'authored.txt'),'keep');}})).toThrow('promotion refused');
 expect(readFileSync(join(path,'authored.txt'),'utf8')).toBe('keep');expect(readdirSync(path)).toEqual(['authored.txt']);expect(readdirSync(directory)).toEqual(['app']);
});

test('schema/file drift blocks output while ordinary row changes remain legitimate live data',async()=>{
 const {core,p,output,definitions}=setup(),plan=await preview(core,p),path=join(definitions,'data.sqlite');
 let db=new Database(path);db.prepare('INSERT INTO volumes VALUES(?)').run('More live data');db.close();
 expect(await command(core,p,'generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]})).toMatchObject({ok:true,result:{committed:true}});
 const other=setup(),otherPlan=await preview(other.core,other.p);db=new Database(join(other.definitions,'data.sqlite'));db.exec('ALTER TABLE volumes ADD COLUMN extra TEXT');db.close();
 expect(await command(other.core,other.p,'generation.apply',{planId:otherPlan.id,hash:otherPlan.hash,acknowledgedImpactIds:[]})).toMatchObject({error:{code:'DATABASE_CHANGED'}});
 expect(await command(other.core,other.p,'generation.preview',{target:other.p.target,projectRevision:1,outputRoot:'output:new'})).toMatchObject({error:{code:'DATABASE_CHANGED'}});
 expect(readdirSync(other.output).filter(n=>!n.startsWith('.schema-baron-writer.sqlite'))).toEqual([]);
 expect(readFileSync(join(output,'app','README.md'),'utf8')).toContain('Independent');
});
test('matching async generation requests share one outcome and conflicting payloads do no writes',async()=>{
 const {core,p}=setup(),plan=await preview(core,p),request=createId(),input={planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]};
 const first=command(core,p,'generation.apply',input,request),matching=command(core,p,'generation.apply',input,request);
 expect(await command(core,p,'generation.apply',{...input,hash:'f'.repeat(64)},request)).toMatchObject({error:{code:'IDEMPOTENCY_CONFLICT'}});
 const result=await first;expect(result).toMatchObject({ok:true,result:{committed:true}});expect(await matching).toEqual(result);
});
test('replacement with the same schema and owner cancellation both refuse first promotion',async()=>{
 const changed=setup(),plan=await preview(changed.core,changed.p),path=join(changed.definitions,'data.sqlite'),bytes=readFileSync(path);renameSync(path,path+'.previous');writeFileSync(path,bytes);
 expect(await command(changed.core,changed.p,'generation.apply',{planId:plan.id,hash:plan.hash,acknowledgedImpactIds:[]})).toMatchObject({error:{code:'DATABASE_CHANGED'}});
 const closing=setup(),closingPlan=await preview(closing.core,closing.p),pending=command(closing.core,closing.p,'generation.apply',{planId:closingPlan.id,hash:closingPlan.hash,acknowledgedImpactIds:[]});
 await Promise.resolve();await closing.core.close();expect(await pending).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});
 expect(readdirSync(closing.output).filter(n=>!n.startsWith('.schema-baron-writer.sqlite'))).toEqual([]);
});

test('oversized preview content is rejected with a project diagnostic',()=>{const p=project();p.pages[0]!.document.push({kind:'text',text:'x'.repeat(1_000_001)});expect(()=>emitApplication(compileProject(p),'/external/data.sqlite')).toThrow('supported source size');});

test('an injected staging-directory symlink cannot redirect source writes outside the approved parent',()=>{
 const directory=root(),outside=root(),path=join(directory,'app'),files=[{path:'server/connection.ts',content:'generated'}];writeFileSync(join(outside,'authored.txt'),'keep');
 expect(()=>writeInitialOutput(path,files,observeOutput(path),()=>{},phase=>{if(phase==='stage-created'){const stage=readdirSync(directory).find(name=>name.startsWith('.schema-baron-stage-'))!;symlinkSync(outside,join(directory,stage,'server'));}})).toThrow('symbolic links');
 expect(readdirSync(outside)).toEqual(['authored.txt']);expect(readFileSync(join(outside,'authored.txt'),'utf8')).toBe('keep');expect(readdirSync(directory)).toEqual([]);
});
