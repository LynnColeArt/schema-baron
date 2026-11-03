import { constants, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { GeneratedFile } from '../ir/index.js';
export const contentHash=(content:string)=>createHash('sha256').update(content).digest('hex');
export class OutputError extends Error {constructor(readonly code:string,message:string){super(message);}}
function openDirectory(path:string):number {
 try{return openSync(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);}
 catch(error){if(['ELOOP','ENOTDIR'].includes((error as {code?:string}).code??''))throw new OutputError('PATH_OUTSIDE_ROOT','Output and staging directories cannot contain symbolic links or replaced file entries.');throw error;}
}
/** First-write scope deliberately excludes replacement/regeneration. */
export function observeOutput(path:string):string {
 if(existsSync(path)||(()=>{try{lstatSync(path);return true;}catch{return false;}})()) throw new OutputError('OUTPUT_CONFLICT','Output already exists. Choose a new child directory. Nonempty regeneration and replacement require the later ownership capability.');
 const parent=lstatSync(dirname(path));if(!parent.isDirectory()||parent.isSymbolicLink())throw new OutputError('PATH_OUTSIDE_ROOT','Output parent must be an existing approved directory.');
 return contentHash(`absent:${resolve(path)}:${parent.dev}:${parent.ino}`);
}
/** GNU no-clobber rename uses the kernel no-replace primitive. No copy fallback or
 * shell interpolation; anchored parent fd prevents a renamed/symlinked parent
 * from redirecting writes. Unsupported platforms fail before creating files. */
export function writeInitialOutput(path:string,files:GeneratedFile[],expected:string,check:()=>void=()=>{},fault?:(phase:string)=>void):void {
 if(process.platform!=='linux')throw new OutputError('UNSUPPORTED_FORMAT','Safe initial output promotion currently requires Linux with GNU coreutils 9.4 or newer.');
 if(observeOutput(path)!==expected)throw new OutputError('OUTPUT_CONFLICT','Output parent changed after preview.');
 const version=spawnSync('/usr/bin/mv',['--version'],{encoding:'utf8',env:{PATH:'/usr/bin:/bin'}});
 if(version.status!==0||!/^mv \(GNU coreutils\) (?:9\.[4-9]|9\.\d{2,}|[1-9]\d\.)/.test(version.stdout??''))throw new OutputError('UNSUPPORTED_FORMAT','Safe promotion requires GNU coreutils mv 9.4 or newer at /usr/bin/mv.');
 const parent=dirname(path);const fd=openDirectory(parent);const anchor=`/proc/${process.pid}/fd/${fd}`;
 let stage:string|undefined;
 try {
  if(!existsSync(anchor))throw new OutputError('UNSUPPORTED_FORMAT','Safe initial promotion requires Linux procfs directory descriptor access.');
  const anchored=join(anchor,basename(path));
  if(observeOutput(path)!==expected)throw new OutputError('OUTPUT_CONFLICT','Output changed before staging.');
  stage=mkdtempSync(join(anchor,'.schema-baron-stage-'));
  fault?.('stage-created');
  const stageFd=openDirectory(stage);
  try {
   for(const file of files) {
    if(!/^[A-Za-z0-9_.\/-]+$/.test(file.path)||file.path.split('/').some(part=>!part||part==='.'||part==='..')||file.path.startsWith('/'))throw new OutputError('PATH_OUTSIDE_ROOT','Invalid generated file path.');
    const parts=file.path.split('/'),name=parts.pop()!;
    let directoryFd=stageFd;
    const handles:number[]=[];
    try {
     for(const part of parts) {
      const child=`/proc/${process.pid}/fd/${directoryFd}/${part}`;
      try{mkdirSync(child);}catch(error){if((error as {code?:string}).code!=='EEXIST')throw error;}
      const next=openDirectory(child);
      handles.push(next);directoryFd=next;
     }
     const target=`/proc/${process.pid}/fd/${directoryFd}/${name}`;
     const handle=openSync(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
     try{writeFileSync(handle,file.content);fsyncSync(handle);}finally{closeSync(handle);}
    }finally{handles.reverse().forEach(handle=>closeSync(handle));}
   }
  }finally{closeSync(stageFd);}
  if(!verifyFiles(stage,files))throw new OutputError('OUTPUT_CONFLICT','Staged source changed before promotion. No output was promoted.');
  fault?.('staged');check();
  if(observeOutput(path)!==expected)throw new OutputError('OUTPUT_CONFLICT','Output changed during staging.');
  fault?.('promote');
  const result=spawnSync('/usr/bin/mv',['--no-copy','--no-clobber','-T',stage,anchored],{stdio:'ignore',env:{PATH:'/usr/bin:/bin'}});
  if(result.error||result.status!==0||existsSync(stage))throw new OutputError('OUTPUT_CONFLICT','Output promotion refused. Preserve existing output and choose an unused directory.');
  stage=undefined;fsyncSync(fd);
  if(!verifyFiles(path,files))throw new OutputError('RECOVERY_REQUIRED','Output was promoted but changed before verification. Preserve it and inspect before retrying.');
 }finally{if(stage)rmSync(stage,{recursive:true,force:true});closeSync(fd);}
}
export function verifyFiles(path:string,files:GeneratedFile[]):boolean {try{const stat=lstatSync(path);if(!stat.isDirectory()||stat.isSymbolicLink())return false;const walk=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(e=>{const full=join(directory,e.name);if(e.isSymbolicLink())throw Error('Link');return e.isDirectory()?walk(full):[full.slice(path.length+1)];});return JSON.stringify(walk(path).sort())===JSON.stringify(files.map(f=>f.path).sort())&&files.every(f=>lstatSync(join(path,f.path)).isFile()&&readFileSync(join(path,f.path),'utf8')===f.content);}catch{return false;}}
