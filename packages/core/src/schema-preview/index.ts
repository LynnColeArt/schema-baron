import { lstatSync } from 'node:fs';
import { createId, expressionSchema, parseProject, reviewedPlanSchema, validateProject } from '@schema-baron/model';
import type { Connection, Diagnostic, Project } from '@schema-baron/model';
import { hash, StorageError } from '@schema-baron/storage';
import { SQLiteError, SQLiteWorker } from '@schema-baron/sqlite';
import { connectionPath } from '../connections/index.js';
import type { CommandRegistry } from '../commands/index.js';
import { planHash } from '../plans/index.js';
import type { PlanRepository } from '../plans/index.js';
export class SchemaPreviewError extends StorageError { constructor(readonly diagnostics: Diagnostic[]) { super(diagnostics[0]?.code ?? 'VALIDATION_FAILED', diagnostics[0]?.message ?? 'Schema preview failed.'); } }
interface Options { ownerId: string; approvedRoots: Record<string,string>; metadataRoot: string }
/** Same production handler is consumed by HTTP and MCP through ProjectCore. */
export function registerSchemaPreview(registry: CommandRegistry, options: Options, plans: PlanRepository, current: (id:string) => Project | undefined, hasBaseline: (projectId:string, connection:Connection) => boolean) {
 const workers=new Set<SQLiteWorker>(); let closed=false;
 registry.registerAsync('schema.preview',async(command,project)=>{
  if(command.operation!=='schema.preview' || !project) throw new StorageError('INVALID_INPUT','Open a project first.');
  parseProject(project); // Includes coordinated reference/type validation of all consumers.
  if(command.input.desiredSchemaRevision!==project.schema.revision) throw new StorageError('REVISION_CONFLICT','Desired schema revision changed. Read the current schema before preview.');
  if(project.connections.length!==1 || project.connectionRefs[0]!==project.connections[0]?.id) throw new StorageError('VALIDATION_FAILED','Bind one inspected application database before preview.');
  const connection=project.connections[0]!; if(!connection.inspectedSchema || !connection.physical) throw new StorageError('DATABASE_CHANGED','Connection lacks a stable inspected baseline. Inspect and bind again before preview.');
  if(!hasBaseline(project.id,connection)) throw new StorageError('DATABASE_CHANGED','Imported or changed connection baseline has no matching owner inspection. Inspect and bind this database again before preview.');
  const backfills=command.input.backfills.map(b=>({...b,expression:expressionSchema.parse(b.expression)}));
  for(const backfill of backfills) {
   const target=project.schema.tables.find(t=>t.id===backfill.tableId)?.columns.find(c=>c.id===backfill.columnId);
   if(!target) throw new StorageError('INVALID_INPUT','Backfill target is not present in the candidate.');
   const projectionId=createId();
   const {identity:_identity,...validationProject}=project;
   // Assignment permits a non-null expression into a nullable column. Ordinary
   // query result metadata remains exact; only this temporary projection varies.
   const validateBackfill=(nullable:boolean)=>validateProject({...validationProject,schema:connection.inspectedSchema,queries:[{id:createId(),name:'Backfill validation',sources:[{alias:'self',source:{kind:'table',id:backfill.tableId}}],joins:[],projections:[{id:projectionId,name:'value',type:target.type,nullable,expression:backfill.expression}],parameters:[],groupBy:[],orderBy:[],grain:{strategy:'rows',keys:[]}}],pages:[],forms:[],controls:[],actions:[],policies:project.policies.filter(p=>p.id===project.globalPolicyId),extensionContracts:[]});
   let validation=validateBackfill(false);
   if(!validation.ok && target.nullable) validation=validateBackfill(true);
   if(!validation.ok) throw new SchemaPreviewError(validation.diagnostics.map(d=>({...d,objectId:target.id})));
  }
  const {path}=connectionPath(options.approvedRoots,`${connection.locator.approvedRootId}:${connection.locator.relativePath}`,options.metadataRoot);
  const identity=()=>{try {const stat=lstatSync(path);return `${stat.dev}:${stat.ino}`;}catch {throw new StorageError('NOT_FOUND','Bound database is missing. Reconnect before preview.');}}; const before=identity();
  const worker=new SQLiteWorker(path);workers.add(worker);
  try {
   const compiled=await worker.schemaPlan({baseline:connection.inspectedSchema,desired:project.schema,schemaFingerprint:connection.fingerprint,backfills});
   if(compiled.diagnostics.length) throw new SchemaPreviewError(compiled.diagnostics);
   await worker.close();
   const snapshot=current(project.id); if(closed || !snapshot) throw new StorageError('RECOVERY_REQUIRED','Owner closed during preview; no plan was recorded.');
   if(hash(snapshot)!==hash(project)) throw new StorageError('REVISION_CONFLICT','Project changed during preview. Create a new preview from the current candidate.');
   if(identity()!==before) throw new StorageError('DATABASE_CHANGED','Bound file was replaced during preview. Inspect again.');
   const createdAt=new Date().toISOString(); const id=createId();
   const content={id,kind:'migration' as const,sourceRevision:project.revision,modelHash:hash(project),connectionId:connection.id,schemaFingerprint:compiled.schemaFingerprint,dataFingerprint:compiled.dataFingerprint,createdAt,expiresAt:new Date(Date.parse(createdAt)+300000).toISOString(),steps:compiled.steps,impact:compiled.impact,changes:compiled.changes,requiredAcknowledgementIds:compiled.impact.filter(i=>i.requiresAcknowledgement).map(i=>i.id),backupPolicy:{required:true as const,approvedRootId:connection.locator.approvedRootId},recovery:{backupMethod:'sqlite-online-backup' as const,sqliteVersion:compiled.sqliteVersion,strategy:compiled.strategy,foreignKeysBeforeTransaction:false as const,verifyBeforeCommit:['foreign_key_check','integrity_check'] as const,restoreRequiresReview:true as const,instructions:['Acquire the migration lease and recheck schema/data fingerprints under a write transaction before changing data.','Create and verify an SQLite online backup in the disclosed owner-approved root before DDL.','Set foreign_keys OFF before BEGIN for a rebuild; execute all reviewed steps in one transaction and reject failed foreign_key_check or integrity_check before commit. Restore the original connection settings.','On failure roll back the transaction. Inspect the durable migration journal and database marker to distinguish rollback from a committed migration before retrying.','Restoring a backup requires a separately reviewed restore plan and exact acknowledgements; preview never performs a restore.']}};
   const plan=reviewedPlanSchema.parse({...content,hash:planHash(content)});
   return {result:plans.record(options.ownerId,project.id,plan)};
  } catch(error) {if(error instanceof SQLiteError)throw new StorageError(error.code,error.message);throw error;}
  finally {await worker.close();workers.delete(worker);}
 });
 return async()=>{closed=true;await Promise.all([...workers].map(worker=>worker.close()));};
}
