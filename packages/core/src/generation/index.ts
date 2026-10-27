import { existsSync, lstatSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { createId, reviewedPlanSchema } from '@schema-baron/model';
import type { Project } from '@schema-baron/model';
import type { ProjectStorage } from '@schema-baron/storage';
import { hash, safePath, StorageError } from '@schema-baron/storage';
import { compileProject, emitApplication, contentHash, observeOutput, writeInitialOutput, verifyFiles, GenerationError, OutputError, scanSource, readManifest, sourceManifest, ownershipPreview, manifestPath, generatorVersion, promoteSource, recoverPromotion, promotionPending } from '@schema-baron/generator';
import { SQLiteWorker, SQLiteError } from '@schema-baron/sqlite';
import type { GeneratedFile, RuntimeLifecyclePort } from '@schema-baron/generator';
import type { CommandRegistry } from '../commands/index.js';
import type { PlanRepository } from '../plans/index.js';
import { planHash } from '../plans/index.js';
import { connectionPath } from '../connections/index.js';
export { GenerationError };
interface Options {ownerId:string;approvedRoots:Record<string,string>;metadataRoot:string;generationFault?:(phase:string)=>void;runtimeLifecycle?:RuntimeLifecyclePort}
export function registerGeneration(registry:CommandRegistry,options:Options,plans:PlanRepository,storage:ProjectStorage) {
 const workers=new Set<SQLiteWorker>();let closed=false;
 async function verifyConnection(project:Project) {
  const connection=project.connections[0]!;
  const locator=`${connection.locator.approvedRootId}:${connection.locator.relativePath}`;
  const path=connectionPath(options.approvedRoots,locator,options.metadataRoot).path;
  const identity=()=>{const current=connectionPath(options.approvedRoots,locator,options.metadataRoot).path;const stat=lstatSync(current);return `${stat.dev}:${stat.ino}`;};
  const before=identity(),worker=new SQLiteWorker(path);workers.add(worker);
  try {
   const observed=await worker.inspect();
   if(closed)throw new StorageError('RECOVERY_REQUIRED','Owner closed during generation validation; no output was written.');
   if(before!==identity()||observed.fingerprint!==connection.fingerprint)throw new StorageError('DATABASE_CHANGED','Connected schema or database file changed. Inspect/bind or review its migration before generating.');
   return before;
  }catch(error){if(error instanceof SQLiteError)throw new StorageError(error.code,error.message);throw error;}
  finally{await worker.close();workers.delete(worker);}
 }
 const locate=(locator:string)=>{const split=locator.indexOf(':');const id=locator.slice(0,split);const root=options.approvedRoots[id];if(split<1||!root||!locator.slice(split+1)||locator.slice(split+1)==='.')throw new StorageError('PATH_OUTSIDE_ROOT','Choose approvedRootId:new-directory for output.');const path=safePath(root,locator.slice(split+1));if(path===safePath(root,'.'))throw new StorageError('PATH_OUTSIDE_ROOT','Output must be a new child of an approved root.');return {id,path};};
 const compile=(project:Project,output:string)=>{
  const ir=compileProject(project);const connection=project.connections[0]!;
  if(!connection.inspectedSchema||hash(connection.inspectedSchema.tables)!==hash(project.schema.tables))throw new StorageError('DATABASE_CHANGED','Review and apply the schema migration before generation.');
  const database=connectionPath(options.approvedRoots,`${connection.locator.approvedRootId}:${connection.locator.relativePath}`,options.metadataRoot).path;
  const rel=relative(output,database);if(rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..')||database.split(sep).some(part=>/^\.schema-baron-(?:stage|backup)-/.test(part)))throw new GenerationError([{code:'PATH_OUTSIDE_ROOT',severity:'error',objectId:connection.id,field:'locator',message:'The connected database and adjacent identity store must live outside active output and generated staging/backup namespaces.'}]);
  if(!existsSync(database)||!lstatSync(database).isFile())throw new StorageError('NOT_FOUND','Connected database is unavailable.');
  const files=emitApplication(ir,database);const authored=new Set(project.extensionContracts.map(c=>c.relativePath));
  const manifest=sourceManifest(project.id,hash(project),files.filter(f=>!authored.has(f.path)),project.extensionContracts);
  return [...files,{path:manifestPath,content:JSON.stringify(manifest,null,2)+'\n'}].sort((a,b)=>a.path.localeCompare(b.path));
 };
 const boundary=async<T>(work:()=>Promise<T>):Promise<T>=>{try{return await work();}catch(error){if(error instanceof OutputError)throw new StorageError(error.code,error.message);if(error instanceof StorageError||error instanceof GenerationError)throw error;throw new StorageError('RECOVERY_REQUIRED','Generation was interrupted. Inspect the reviewed promotion recovery before retrying.');}};
 const authorityKey=(path:string)=>'output-'+contentHash(path);
 const intentKey=(path:string)=>'promotion-'+contentHash(path);
 const stored=(project:Project,key:string)=>storage.job(project.id,key) as {outcome?:{result?:Record<string,string>}}|undefined;
 const recordAuthority=(project:Project,path:string,files:GeneratedFile[],planId:string)=>{
  const prior=stored(project,authorityKey(path))?.outcome?.result;
  const treeRevision=prior?.planId===planId?Number(prior.outputTreeRevision):Number(prior?.outputTreeRevision??'0')+1;
  if(!Number.isSafeInteger(treeRevision)||treeRevision<1)throw new StorageError('RECOVERY_REQUIRED','Output revision authority is invalid. Preserve output and inspect metadata.');
  const plan=plans.inspect(options.ownerId,project.id,planId);
  if(plan.kind!=='generation'||!plan.outputLocator)throw new StorageError('RECOVERY_REQUIRED','Output authority requires a canonical generation plan.');
  const intent=stored(project,intentKey(path))?.outcome?.result;
  const generatedProject=intent?.project?JSON.parse(intent.project) as Project:project;
  if(hash(generatedProject)!==plan.modelHash)throw new StorageError('RECOVERY_REQUIRED','Generated snapshot differs from canonical plan.');
  // Capture the reviewed snapshot, not a later model/draft, including crash recovery.
  storage.putJob(project.id,'output-current',{id:'output-current',status:'succeeded',committed:true,diagnostics:[],outcome:{ok:true,revision:plan.sourceRevision,result:{outputLocator:plan.outputLocator,outputTreeRevision:treeRevision,modelRevision:plan.sourceRevision,project:generatedProject},diagnostics:[]}});
  storage.putJob(project.id,authorityKey(path),{id:authorityKey(path),status:'succeeded',committed:true,diagnostics:[],outcome:{ok:true,revision:project.revision,result:{manifestHash:contentHash(files.find(f=>f.path===manifestPath)!.content),planId,outputTreeRevision:String(treeRevision)},diagnostics:[]}});
  return treeRevision;
 };
 const planFiles=(plan:Extract<import('@schema-baron/model').ReviewedPlan,{kind:'generation'}>)=>plan.steps.filter(s=>s.operation!=='delete').map(s=>({path:s.path,content:s.afterContent!}));
 const resultFor=(planId:string,revision:number,modelHash:string,files:GeneratedFile[],treeRevision:number)=>{const marker=JSON.parse(files.find(f=>f.path===manifestPath)!.content) as ReturnType<typeof sourceManifest>;return {planId,committed:true,recoveryRequired:false,manifest:{generatorVersion:marker.generatorVersion,modelVersion:revision,modelHash,ownedFileHashes:marker.ownedFileHashes,authoredContractVersions:Object.fromEntries(marker.authoredContracts.map(c=>[c.id,c.version])),outputTreeRevision:treeRevision}};};
 const recover=(project:Project,path:string)=>{
  const intent=stored(project,intentKey(path))?.outcome?.result;
  if(promotionPending(path)&&!intent?.planId)throw new StorageError('RECOVERY_REQUIRED','Promotion has no canonical source intent. Preserve the journal and all source trees for owner recovery.');
  if(intent?.planId){
   const plan=plans.inspect(options.ownerId,project.id,intent.planId);
   if(plan.kind!=='generation'||!plan.outputLocator||locate(plan.outputLocator).path!==path||plan.hash!==intent.planHash)throw new StorageError('RECOVERY_REQUIRED','Promotion intent differs from its canonical reviewed plan.');
   const files=planFiles(plan);recoverPromotion(path,options.generationFault,{before:plan.outputFingerprint,files});
   if(verifyFiles(path,files)){
    const treeRevision=recordAuthority(project,path,files,plan.id);
    if(intent.requestId&&intent.payloadHash&&!storage.lookup(project.id,intent.requestId)){
     const outcome={ok:true,revision:plan.sourceRevision,result:resultFor(plan.id,plan.sourceRevision,plan.modelHash,files,treeRevision),diagnostics:[]};
     storage.complete(project.id,{requestId:intent.requestId,payloadHash:intent.payloadHash,actor:options.ownerId,baseRevision:plan.sourceRevision,outcome},null);
     storage.putJob(project.id,plan.id,{id:plan.id,status:'succeeded',phase:'Interrupted promotion reconciled',committed:true,diagnostics:[],outcome});
    }
   }
  }
 };
 const observe=(path:string)=>existsSync(path)?scanSource(path).fingerprint:observeOutput(path);
 registry.registerAsync('generation.preview',(command,project)=>boundary(async()=>{
  if(command.operation!=='generation.preview'||!project)throw new StorageError('INVALID_INPUT','Open a project first.');
  if(command.input.projectRevision!==project.revision||command.input.target!==project.target)throw new StorageError('REVISION_CONFLICT','Preview must use the current project revision and target.');
  const {id:rootId,path}=locate(command.input.outputRoot);const files=compile(project,path);recover(project,path);
  const fingerprint=observe(path),id=createId(),createdAt=new Date().toISOString();
  const scan=existsSync(path)?scanSource(path):undefined,previous=scan?readManifest(scan,project.id):undefined;
  const expected=stored(project,authorityKey(path))?.outcome?.result?.manifestHash;
  const marker=scan?.entries.find(e=>e.path===manifestPath);
  const manifestConflict=!!scan&&(!previous||!expected||marker?.hash!==expected);
  const diff:ReturnType<typeof ownershipPreview>=scan?ownershipPreview(scan,previous,files,project.extensionContracts):{steps:files.map(f=>({path:f.path,operation:'create' as const,afterHash:contentHash(f.content),afterContent:f.content})),conflicts:[]};
  if(manifestConflict)diff.conflicts.unshift({path:manifestPath,message:'Output ownership authority is missing or modified. Preserve this tree and restore its reviewed manifest; a lookalike output cannot be adopted.'});
  const markerFile=files.find(f=>f.path===manifestPath)!;
  if(scan)diff.steps.push({path:manifestPath,operation:marker?.hash===contentHash(markerFile.content)?'preserve':marker?'replace':'create',...(marker?.hash?{beforeHash:marker.hash}:{}),afterHash:contentHash(markerFile.content),afterContent:markerFile.content});
  const connectionIdentity=await verifyConnection(project);
  const impact=[...diff.conflicts.map(c=>({id:createId(),kind:'conflict' as const,description:c.path+': '+c.message,requiresAcknowledgement:false})),...diff.steps.filter(s=>s.operation==='delete').map(s=>({id:createId(),kind:'delete' as const,description:`Remove ${s.path} from active source. The complete old tree remains in a recoverable backup; runtime artifacts must be explicitly rebuilt.`,requiresAcknowledgement:true})),{id:createId(),kind:'create' as const,description:`Promote a complete reviewed source tree to ${command.input.outputRoot}. Database, identity, secrets and migration history remain external.`,requiresAcknowledgement:false}];
  const content={id,kind:'generation' as const,sourceRevision:project.revision,modelHash:hash(project),createdAt,expiresAt:new Date(Date.now()+300000).toISOString(),generatorVersion,outputFingerprint:fingerprint,outputRootId:rootId,outputLocator:command.input.outputRoot,connectionIdentity,extensionHashes:Object.fromEntries(project.extensionContracts.flatMap(c=>{const e=scan?.entries.find(e=>e.path===c.relativePath);return e?.hash?[[c.id,e.hash]]:[];})),steps:diff.steps.map(s=>({id:createId(),...s})),impact,requiredAcknowledgementIds:impact.filter(i=>i.requiresAcknowledgement).map(i=>i.id)};
  const plan=reviewedPlanSchema.parse({...content,hash:planHash(content)});return {result:plans.record(options.ownerId,project.id,plan)};
 }));
 registry.registerAsync('generation.apply',(command,project)=>boundary(async()=>{
  if(command.operation!=='generation.apply'||!project)throw new StorageError('INVALID_INPUT','Open a project first.');
  const plan=plans.inspect(options.ownerId,project.id,command.input.planId);if(plan.kind!=='generation'||!plan.outputLocator)throw new StorageError('PLAN_HASH_MISMATCH','Select a generation preview.');
  const {path,id}=locate(plan.outputLocator);const fresh=compile(project,path);if(id!==plan.outputRootId)throw new StorageError('PLAN_HASH_MISMATCH','Output approval differs from the reviewed plan.');
  const preflight=plans.validate(options.ownerId,project.id,command.input,{fingerprint:plan.outputFingerprint,now:new Date().toISOString()});if(preflight.length)throw new StorageError(preflight[0]!.code,preflight[0]!.message);
  if(plan.impact.some(i=>i.kind==='conflict'))throw new StorageError('OUTPUT_CONFLICT','Resolve the disclosed source conflicts, preserve your work, then review a fresh preview. Acknowledgement never overrides conflicts.');
  const intent=stored(project,intentKey(path))?.outcome?.result;
  const matching=intent?.requestId===command.requestId&&intent.payloadHash===hash(command)&&intent.planHash===plan.hash;
  if(promotionPending(path)&&!matching)throw new StorageError('RECOVERY_REQUIRED','Recover the interrupted reviewed promotion before another apply. Preview reconciles its exact old/new trees.');
  if(matching)recover(project,path);
  const files=planFiles(plan);if(files.some(f=>typeof f.content!=='string')||plan.steps.some(s=>s.afterContent!==undefined&&contentHash(s.afterContent)!==s.afterHash))throw new StorageError('PLAN_HASH_MISMATCH','Reviewed source content differs from its hash.');
  const recovered=matching&&verifyFiles(path,files);
  const validate=()=>{locate(plan.outputLocator!);if(closed)throw new StorageError('RECOVERY_REQUIRED','Owner closed before source promotion.');const ds=plans.validate(options.ownerId,project.id,command.input,{fingerprint:observe(path),now:new Date().toISOString()});if(ds.length)throw new StorageError(ds[0]!.code,ds[0]!.message);};
  if(!recovered)validate();
  const authored=new Set(project.extensionContracts.map(c=>c.relativePath));
  if(fresh.filter(f=>!authored.has(f.path)).some(f=>!files.some(p=>p.path===f.path&&p.content===f.content)))throw new StorageError('PLAN_HASH_MISMATCH','Generator output changed after preview.');
  const identity=await verifyConnection(project);if(identity!==plan.connectionIdentity)throw new StorageError('DATABASE_CHANGED','Connected database was replaced after preview.');
  if(!recovered){
   // Managed jobs must positively stop before any active source rename.
   if(options.runtimeLifecycle){const stopped=await options.runtimeLifecycle.stopForPromotion({projectId:project.id,outputPath:path});if(!['stopped','unmanaged'].includes(stopped.status))throw new StorageError('PROJECT_BUSY','Managed preview could not be stopped.');}
   if(await verifyConnection(project)!==plan.connectionIdentity)throw new StorageError('DATABASE_CHANGED','Connected schema or database identity changed after preview or during preview shutdown.');
   validate();
   const job={id:plan.id,status:'running',phase:'Staging reviewed complete source',committed:false,diagnostics:[],outcome:{ok:true,revision:project.revision,result:{planId:plan.id,requestId:command.requestId,payloadHash:hash(command),planHash:plan.hash,project:JSON.stringify(project)},diagnostics:[]}};
   storage.putJob(project.id,plan.id,job);storage.putJob(project.id,intentKey(path),{...job,id:intentKey(path)});
   if(existsSync(path))promoteSource(path,files,plan.outputFingerprint,validate,options.generationFault);else writeInitialOutput(path,files,plan.outputFingerprint,validate);
   options.generationFault?.('promoted-before-record');
  }
  const treeRevision=recordAuthority(project,path,files,plan.id);
  storage.putJob(project.id,plan.id,{id:plan.id,status:'succeeded',phase:'Complete output promoted',committed:true,diagnostics:[],outcome:{ok:true,revision:project.revision,result:{requestId:command.requestId,payloadHash:hash(command),planHash:plan.hash},diagnostics:[]}});
  return {result:resultFor(plan.id,project.revision,hash(project),files,treeRevision)};
 }));
 return async()=>{closed=true;await Promise.all([...workers].map(worker=>worker.close()));};
}
