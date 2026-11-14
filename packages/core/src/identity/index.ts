import { lstatSync } from 'node:fs';
import { SQLiteWorker } from '@schema-baron/sqlite';
import { hash } from '@schema-baron/storage';
import type { Project, Connection } from '@schema-baron/model';
import { parseProject } from '@schema-baron/model';
import { IdentityStore, managedIdentityPath, compatibleMapping } from '@schema-baron/generator';
import { StorageError } from '@schema-baron/storage';
import { connectionPath } from '../connections/index.js';
import type { CommandRegistry } from '../commands/index.js';
export function registerIdentity(registry:CommandRegistry,options:{approvedRoots:Record<string,string>;metadataRoot:string},snapshot:(id:string)=>Project,isInspected:(id:string,c:Connection)=>boolean) {
 registry.register('identity.configure',(command,project)=>{
  if(command.operation!=='identity.configure'||!project)throw new StorageError('INVALID_INPUT','Open a project first.');
  const candidate=parseProject({...project,revision:project.revision+1,identity:command.input});
  try {compatibleMapping(candidate);}catch {throw new StorageError('INVALID_INPUT','Mapped identity requires a text primary key, unique username and versioned hash fields; other required fields need defaults.');}
  return {candidate,result:{configured:true}};
 });
 registry.registerAsync('identity.provision',async(command,project)=>{
  if(command.operation!=='identity.provision'||!project?.identity)throw new StorageError('INVALID_INPUT','Configure an identity source before provisioning.');
  const identity=project.identity;
  if(command.input.identitySourceRef!==(identity.kind==='managed'?identity.storeRef:identity.tableId)||project.connections.length!==1)throw new StorageError('INVALID_INPUT','Select the configured identity source and one bound database.');
  let mapping;try{mapping=compatibleMapping(project);}catch{throw new StorageError('INVALID_INPUT','Identity mapping is not compatible.');}
  const c=project.connections[0]!,database=connectionPath(options.approvedRoots,`${c.locator.approvedRootId}:${c.locator.relativePath}`,options.metadataRoot).path;
  if(!isInspected(project.id,c))throw new StorageError('DATABASE_CHANGED','Inspect and bind this source before provisioning.');
  const identityFile=()=>{const stat=lstatSync(connectionPath(options.approvedRoots,`${c.locator.approvedRootId}:${c.locator.relativePath}`,options.metadataRoot).path);return `${stat.dev}:${stat.ino}`;};
  const before=identityFile(),worker=new SQLiteWorker(database);try{if((await worker.inspect()).fingerprint!==c.fingerprint||before!==identityFile())throw new StorageError('DATABASE_CHANGED','Database changed; inspect and bind before provisioning.');}finally{await worker.close();}
  const guard=()=>{const current=snapshot(project.id);if(current.revision!==project.revision||hash(current.identity)!==hash(identity)||before!==identityFile())throw new StorageError('REVISION_CONFLICT','Identity source changed during provisioning.');};guard();
  const store=new IdentityStore(managedIdentityPath(database,project.id),project.id,mapping,database);
  try {const userId=await store.provision(command.input.username,command.input.password,command.requestId,guard);return {result:{userId}};}
  catch(error) {if(error instanceof StorageError)throw error;throw new StorageError('INVALID_INPUT','Provisioning could not complete. Check source compatibility, username uniqueness and use a new request ID if already consumed.');}
  finally {store.close();}
 });
}
