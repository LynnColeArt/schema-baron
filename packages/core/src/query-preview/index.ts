import type { Job } from '@schema-baron/model';
import { ModelValidationError } from '@schema-baron/model';
import { compileQuery, QueryError, SQLiteError, SQLiteWorker } from '@schema-baron/sqlite';
import { StorageError } from '@schema-baron/storage';
import { connectionPath } from '../connections/index.js';
import type { CommandRegistry } from '../commands/index.js';
interface Options { approvedRoots: Record<string,string>; metadataRoot: string; recordJob: (projectId:string,job:Job)=>void }
interface Active { worker: SQLiteWorker; controller: AbortController; job: Job; finished: Promise<void> }
/** Controllers are process-local; durable job observations are separate from project definitions. */
export function registerQueryPreview(registry: CommandRegistry, options: Options) {
 const active=new Map<string,Active>();let closed=false;
 const key=(projectId:string,id:string)=>JSON.stringify([projectId,id]);
 registry.registerAsync('query.preview',async(command,project)=>{
  if(command.operation!=='query.preview' || !project)throw new StorageError('INVALID_INPUT','Open a project before previewing a query.');
  const input=command.input;const query='draft' in input?input.draft:project.queries.find(q=>q.id===input.queryId);
  if(!query)throw new StorageError('NOT_FOUND','Saved query does not exist. Select a saved query or supply a draft AST.');
  let compiled;
  try{compiled=compileQuery(project,query,input.parameters,input.rowLimit);}catch(error){if(error instanceof QueryError)throw new StorageError(error.code,error.message);throw error;}
  const connection=project.connections.find(c=>project.connectionRefs.includes(c.id));if(!connection)throw new StorageError('NOT_FOUND','Bind a database connection before query preview.');
  const {path}=connectionPath(options.approvedRoots,connection.locator.approvedRootId+':'+connection.locator.relativePath,options.metadataRoot);
  if(closed)throw new StorageError('RECOVERY_REQUIRED','Query service has closed.');
  const controller=new AbortController(),worker=new SQLiteWorker(path,{readonly:true});let finish!:()=>void;
  const entry:Active={worker,controller,job:{id:command.requestId,status:'running',phase:'query-preview',committed:false,diagnostics:[]},finished:new Promise<void>(resolve=>{finish=resolve;})};const id=key(project.id,command.requestId);
  active.set(id,entry);
  try {
   options.recordJob(project.id,entry.job);
   const result=await worker.queryPreview(compiled,{expectedFingerprint:connection.fingerprint,...(input.maxScannedRows?{maxScannedRows:input.maxScannedRows}:{})},{signal:controller.signal,timeoutMs:input.timeoutMs??5000});
   entry.job={...entry.job,status:'succeeded'};return {result};
  }catch(error){
   const code=error instanceof SQLiteError?error.code:'VALIDATION_FAILED';entry.job={...entry.job,status:code==='CANCELED'?'canceled':'failed'};
   if(error instanceof SQLiteError)throw new StorageError(error.code,error.message);if(error instanceof ModelValidationError)throw error;throw new StorageError('VALIDATION_FAILED','Query preview failed. Check supported expressions, source types and connection state.');
  }finally{
   try { await worker.close();active.delete(id);options.recordJob(project.id,entry.job); } finally { finish(); }
  }
 });
 return {
  hasActive:()=>active.size>0,
  /** Invoked from the reserved job.cancel command handler, after owner/revision checks. */
  cancel(projectId:string,id:string):Promise<Job>|undefined {const entry=active.get(key(projectId,id));if(!entry)return;return (async()=>{entry.controller.abort();await entry.worker.close();await entry.finished;return structuredClone(entry.job);})();},
  async close() {closed=true;await Promise.all([...active.values()].map(async entry=>{entry.controller.abort();await entry.worker.close();await entry.finished;}));},
 };
}
