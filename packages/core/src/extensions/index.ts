import {closeSync,constants,fsyncSync,lstatSync,openSync,readFileSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {basename,dirname,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {OutputError,contentHash,manifestPath,readManifest,scanSource,validateExtensionContracts} from '@schema-baron/generator';
import {safePath,StorageError} from '@schema-baron/storage';
import type {ProjectStorage} from '@schema-baron/storage';
import type {Project} from '@schema-baron/model';
import type {CommandHandler,CommandRegistry} from '../commands/index.js';
export function registerExtensions(registry:CommandRegistry,options:{approvedRoots:Record<string,string>},storage:ProjectStorage) {
 const boundary=(handler:CommandHandler):CommandHandler=>(command,project)=>{try{return handler(command,project);}catch(error){if(error instanceof OutputError)throw new StorageError(error.code,error.message);throw error;}};
 function locate(locator:string){const split=locator.indexOf(':'),root=options.approvedRoots[locator.slice(0,split)];if(split<1||!root)throw new StorageError('PATH_OUTSIDE_ROOT','Choose an approved output locator.');return safePath(root,locator.slice(split+1));}
 function inspect(project:Project,output:string){
  const scan=scanSource(output),manifest=readManifest(scan,project.id);
  const authority=storage.job(project.id,'output-'+contentHash(output)) as {outcome?:{result?:{manifestHash?:string}}}|undefined;
  if(!manifest||scan.entries.find(e=>e.path===manifestPath)?.hash!==authority?.outcome?.result?.manifestHash)throw new StorageError('OUTPUT_CONFLICT','Generate or recover this project output before inspecting source.');
  return {scan,manifest};
 }
 registry.register('source.read',boundary((command,project)=>{
  if(command.operation!=='source.read'||!project)throw new StorageError('INVALID_INPUT','Open a project first.');
  const output=locate(command.input.outputRoot),{scan,manifest}=inspect(project,output),path=command.input.relativePath;
  if(!manifest.ownedFileHashes[path])throw new StorageError('ACCESS_DENIED','Only reviewed owned source is available in this read-only view.');
  const entry=scan.entries.find(e=>e.path===path);if(entry?.kind!=='file'||!entry.content)throw new StorageError('OUTPUT_CONFLICT','Owned source is missing or unavailable.');
  return {result:{path,content:entry.content,hash:entry.hash!,readOnly:true}};
 }));
 for(const operation of ['extension.read','extension.write'] as const)registry.register(operation,boundary((command,project)=>{
  if((command.operation!=='extension.read'&&command.operation!=='extension.write')||!project)throw new StorageError('INVALID_INPUT','Open a project first.');
  const contract=project.extensionContracts.find(c=>c.id===command.input.extensionId);if(!contract)throw new StorageError('NOT_FOUND','Declare an authored hook before editing source.');
  validateExtensionContracts([contract]);
  const suffix='/'+contract.relativePath;if(!command.input.approvedPath.endsWith(suffix))throw new StorageError('ACCESS_DENIED','Source locator must match the declared authored path.');
  const output=locate(command.input.approvedPath.slice(0,-suffix.length)),path=safePath(output,contract.relativePath),{scan,manifest}=inspect(project,output);
  const prior=manifest.authoredContracts.find(c=>c.id===contract.id);if(!prior||prior.relativePath!==contract.relativePath||prior.version!==contract.version||prior.kind!==contract.kind)throw new StorageError('OUTPUT_CONFLICT','Declared interface differs from generated output. Review compatibility before editing.');
  const entry=scan.entries.find(e=>e.path===contract.relativePath);if(entry?.kind!=='file')throw new StorageError('OUTPUT_CONFLICT','Authored module is missing or unsafe.');
  if(command.operation==='extension.read')return {result:{extensionId:contract.id,content:entry.content!,hash:entry.hash!}};
  if(entry.hash!==command.input.expectedFileHash)throw new StorageError('OUTPUT_CONFLICT','Authored source changed. Read the current file and reconcile before saving.');
  if(Buffer.byteLength(command.input.content)>1_000_000)throw new StorageError('INVALID_INPUT','Authored module exceeds the supported 1 MB limit.');
  const parent=dirname(path),fd=openSync(parent,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),anchor=`/proc/${process.pid}/fd/${fd}`,temporary=join(anchor,'.extension-'+randomUUID());
  try {
   const leaf=join(anchor,basename(path)),stat=lstatSync(leaf);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||contentHash(readFileSync(leaf,'utf8'))!==entry.hash)throw new StorageError('OUTPUT_CONFLICT','Authored source changed before saving.');
   const file=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{writeFileSync(file,command.input.content);fsyncSync(file);}finally{closeSync(file);}
   if(contentHash(readFileSync(leaf,'utf8'))!==entry.hash)throw new StorageError('OUTPUT_CONFLICT','Authored source changed while saving.');
   renameSync(temporary,leaf);fsyncSync(fd);
  }finally{try{unlinkSync(temporary);}catch{}closeSync(fd);}
  return {result:{extensionId:contract.id,hash:contentHash(command.input.content)}};
 }));
}
