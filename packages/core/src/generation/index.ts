import { existsSync, lstatSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { createId, reviewedPlanSchema } from '@schema-baron/model';
import type { Project } from '@schema-baron/model';
import type { ProjectStorage } from '@schema-baron/storage';
import { hash, safePath, StorageError } from '@schema-baron/storage';
import { compileProject, emitApplication, contentHash, observeOutput, writeInitialOutput, verifyFiles, GenerationError, OutputError } from '@schema-baron/generator';
import { SQLiteWorker, SQLiteError } from '@schema-baron/sqlite';
import type { CommandRegistry } from '../commands/index.js';
import type { PlanRepository } from '../plans/index.js';
import { planHash } from '../plans/index.js';
import { connectionPath } from '../connections/index.js';
export { GenerationError };
interface Options {ownerId:string;approvedRoots:Record<string,string>;metadataRoot:string;generationFault?:(phase:string)=>void}
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
 const compile=(project:Project,output:string,planId:string)=>{
  const ir=compileProject(project);const connection=project.connections[0]!;
  if(!connection.inspectedSchema||hash(connection.inspectedSchema.tables)!==hash(project.schema.tables))throw new StorageError('DATABASE_CHANGED','Review and apply the schema migration before generation.');
  const database=connectionPath(options.approvedRoots,`${connection.locator.approvedRootId}:${connection.locator.relativePath}`,options.metadataRoot).path;
  const rel=relative(output,database);if(rel===''||(!rel.startsWith(`..${sep}`)&&rel!=='..'))throw new StorageError('PATH_OUTSIDE_ROOT','The connected database must live outside replaceable output.');
  if(!existsSync(database)||!lstatSync(database).isFile())throw new StorageError('NOT_FOUND','Connected database is unavailable.');
  return [...emitApplication(ir,database),{path:'.schema-baron-generation.json',content:JSON.stringify({planId,modelHash:hash(project),generatorVersion:'0.1.0'})+'\n'}].sort((a,b)=>a.path.localeCompare(b.path));
 };
 const boundary=async<T>(work:()=>Promise<T>):Promise<T>=>{try{return await work();}catch(error){if(error instanceof OutputError)throw new StorageError(error.code,error.message);throw error;}};
 registry.registerAsync('generation.preview',(command,project)=>boundary(async()=>{
  if(command.operation!=='generation.preview'||!project)throw new StorageError('INVALID_INPUT','Open a project first.');
  if(command.input.projectRevision!==project.revision||command.input.target!==project.target)throw new StorageError('REVISION_CONFLICT','Preview must use the current project revision and target.');
  const {id:rootId,path}=locate(command.input.outputRoot);const fingerprint=observeOutput(path);const id=createId();const files=compile(project,path,id);const createdAt=new Date().toISOString();
  const connectionIdentity=await verifyConnection(project);
  const content={id,kind:'generation' as const,sourceRevision:project.revision,modelHash:hash(project),createdAt,expiresAt:new Date(Date.now()+300000).toISOString(),generatorVersion:'0.1.0',outputFingerprint:fingerprint,outputRootId:rootId,outputLocator:command.input.outputRoot,connectionIdentity,extensionHashes:{},steps:files.map(f=>({id:createId(),path:f.path,operation:'create' as const,afterHash:contentHash(f.content),afterContent:f.content})),impact:[{id:createId(),kind:'create' as const,description:`Create ${files.length} source/configuration files in ${command.input.outputRoot}. No application data is written.`,requiresAcknowledgement:false}],requiredAcknowledgementIds:[]};
  const plan=reviewedPlanSchema.parse({...content,hash:planHash(content)});return {result:plans.record(options.ownerId,project.id,plan)};
 }));
 registry.registerAsync('generation.apply',(command,project)=>boundary(async()=>{
  if(command.operation!=='generation.apply'||!project)throw new StorageError('INVALID_INPUT','Open a project first.');
  const plan=plans.inspect(options.ownerId,project.id,command.input.planId);if(plan.kind!=='generation')throw new StorageError('PLAN_HASH_MISMATCH','Select a generation preview.');
  if(!plan.outputLocator)throw new StorageError('PLAN_HASH_MISMATCH','Generation output location is unavailable.');
  const {path,id}=locate(plan.outputLocator);if(id!==plan.outputRootId)throw new StorageError('PLAN_HASH_MISMATCH','Output approval differs from the reviewed plan.');
  const planDiagnostics=plans.validate(options.ownerId,project.id,command.input,{fingerprint:plan.outputFingerprint,now:new Date().toISOString()});
  if(planDiagnostics.length)throw new StorageError(planDiagnostics[0]!.code,planDiagnostics[0]!.message);
  const validate=()=>{const diagnostics=plans.validate(options.ownerId,project.id,command.input,{fingerprint:observeOutput(path),now:new Date().toISOString()});if(diagnostics.length)throw new StorageError(diagnostics[0]!.code,diagnostics[0]!.message);};
  const files=compile(project,path,plan.id);if(hash(files.map(f=>({path:f.path,hash:contentHash(f.content)})))!==hash(plan.steps.map(s=>({path:s.path,hash:s.afterHash}))))throw new StorageError('PLAN_HASH_MISMATCH','Generator output changed after preview.');
  if(plan.steps.some(step=>contentHash(step.afterContent??'')!==step.afterHash))throw new StorageError('PLAN_HASH_MISMATCH','Reviewed file content differs from its hash.');
  const identity=await verifyConnection(project);
  if(identity!==plan.connectionIdentity)throw new StorageError('DATABASE_CHANGED','Connected database was replaced after preview. Review a new generation plan.');
  // A complete exact staged marker/tree proves an uncertain first promotion; no files are rewritten on retry.
  const intent=storage.job(project.id,plan.id) as {outcome?:{ok?:boolean;result?:{requestId?:string;payloadHash?:string;planHash?:string}}}|undefined;
  const owned=intent?.outcome?.result;
  const matching=owned?.requestId===command.requestId&&owned.payloadHash===hash(command)&&owned.planHash===plan.hash;
  const recovered=matching&&verifyFiles(path,files);
  if(recovered){const diagnostics=plans.validate(options.ownerId,project.id,command.input,{fingerprint:plan.outputFingerprint,now:new Date().toISOString()});if(diagnostics.length)throw new StorageError(diagnostics[0]!.code,diagnostics[0]!.message);}
  else validate();
  // Core holds the canonical synchronous writer reservation through promotion.
  if(!recovered){
   storage.putJob(project.id,plan.id,{id:plan.id,status:'running',phase:'Staging initial source output',committed:false,diagnostics:[],outcome:{ok:true,revision:project.revision,result:{requestId:command.requestId,payloadHash:hash(command),planHash:plan.hash},diagnostics:[]}});
   writeInitialOutput(path,files,plan.outputFingerprint,validate);
   options.generationFault?.('promoted-before-record');
  }
  storage.putJob(project.id,plan.id,{id:plan.id,status:'succeeded',phase:'Complete output promoted',committed:true,diagnostics:[],outcome:{ok:true,revision:project.revision,result:{requestId:command.requestId,payloadHash:hash(command),planHash:plan.hash},diagnostics:[]}});
  return {result:{planId:plan.id,committed:true,recoveryRequired:false,manifest:{generatorVersion:plan.generatorVersion,modelVersion:project.revision,modelHash:hash(project),ownedFileHashes:Object.fromEntries(files.map(f=>[f.path,contentHash(f.content)])),authoredContractVersions:{},outputTreeRevision:1}}};
 }));
 return async()=>{closed=true;await Promise.all([...workers].map(worker=>worker.close()));};
}
