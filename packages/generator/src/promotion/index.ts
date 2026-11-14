import {closeSync,constants,existsSync,fsyncSync,lstatSync,openSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
import {basename,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {contentHash,observeOutput,OutputError,writeInitialOutput,verifyFiles} from '../initial-output/index.js';
import {scanSource} from '../ownership/index.js';
import type {GeneratedFile} from '../ir/index.js';
export interface RuntimeLifecyclePort {stopForPromotion(input:{projectId:string;outputPath:string}):Promise<{status:'stopped'|'unmanaged'}>}
interface Journal {version:1;output:string;stage:string;backup:string;before:string;after:string}
const journalPath=(path:string)=>join(dirname(path),'.schema-baron-promotion-'+contentHash(basename(path)).slice(0,20)+'.json');
const present=(path:string)=>{try{lstatSync(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}};
function syncDirectory(path:string){const fd=openSync(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(fd);}finally{closeSync(fd);}}
function fingerprint(path:string){return present(path)?scanSource(path).fingerprint:undefined;}
function move(from:string,to:string){const result=spawnSync('/usr/bin/mv',['--no-copy','--no-clobber','-T',from,to],{stdio:'ignore',env:{PATH:'/usr/bin:/bin'}});if(result.error||result.status!==0||present(from))throw new OutputError('RECOVERY_REQUIRED','Promotion rename refused. Preserve both trees and inspect the recovery journal.');}
/** Journal identities are deliberately outside the deterministic source tree. A
 * complete old tree is retained, including build artifacts, never copied. */
export function recoverPromotion(path:string,fault?:(phase:string)=>void,authority?:{before:string;files:GeneratedFile[]}):{recovered:boolean;backup?:string} {
 const file=journalPath(path);if(!present(file))return {recovered:false};
 const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new OutputError('RECOVERY_REQUIRED','Promotion journal is not a regular private file.');
 let j:Journal;try{j=JSON.parse(readFileSync(file,'utf8')) as Journal;}catch{throw new OutputError('RECOVERY_REQUIRED','Promotion journal is invalid; preserve it for recovery.');}
 const name=basename(path);if(j.version!==1||j.output!==name||!new RegExp('^\\.schema-baron-stage-[a-f0-9-]+$').test(j.stage)||!new RegExp('^\\.schema-baron-backup-[a-f0-9-]+$').test(j.backup)||!/^[a-f0-9]{64}$/.test(j.before)||!/^[a-f0-9]{64}$/.test(j.after))throw new OutputError('RECOVERY_REQUIRED','Promotion journal does not match this output.');
 const parent=dirname(path),fd=openSync(parent,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW),anchor=`/proc/${process.pid}/fd/${fd}`;
 try {
  const active=join(anchor,name),stage=join(anchor,j.stage),backup=join(anchor,j.backup);
  if(authority&&(j.before!==authority.before||!verifyFiles(stage,authority.files)&&!verifyFiles(active,authority.files)))throw new OutputError('RECOVERY_REQUIRED','Promotion journal does not match the canonical reviewed source intent.');
  let current=fingerprint(active),prior=fingerprint(backup),staged=fingerprint(stage);
  if(current===j.before&&!prior&&staged===j.after){fault?.('before-old-rename');move(active,backup);fsyncSync(fd);fault?.('after-old-rename');current=undefined;prior=j.before;}
  if(!current&&prior===j.before&&staged===j.after){fault?.('before-new-rename');move(stage,active);fsyncSync(fd);fault?.('after-new-rename');current=j.after;staged=undefined;}
  if(current!==j.after||prior!==j.before||staged)throw new OutputError('RECOVERY_REQUIRED','An output, backup or staged file changed during interrupted promotion. All trees were preserved. Restore the reviewed tree before retrying.');
  fault?.('before-journal-clear');unlinkSync(join(anchor,basename(file)));fsyncSync(fd);fault?.('after-journal-clear');
  return {recovered:true,backup:join(parent,j.backup)};
 }finally{closeSync(fd);}
}
export function promoteSource(path:string,files:GeneratedFile[],expected:string,check:()=>void,fault?:(phase:string)=>void):{backup:string} {
 if(process.platform!=='linux')throw new OutputError('UNSUPPORTED_FORMAT','Safe regeneration requires Linux, GNU mv 9.4+ and procfs.');
 if(present(journalPath(path)))throw new OutputError('RECOVERY_REQUIRED','Recover the previous promotion before applying another preview.');
 if(scanSource(path).fingerprint!==expected)throw new OutputError('OUTPUT_CONFLICT','Source changed after preview.');
 const parent=dirname(path),stageName='.schema-baron-stage-'+randomUUID(),backupName='.schema-baron-backup-'+randomUUID(),stage=join(parent,stageName);
 // Reuse the existing Linux/GNU/procfs exclusive creation authority for staging.
 writeInitialOutput(stage,files,observeOutput(stage));fault?.('stage-complete');
 check();if(scanSource(path).fingerprint!==expected)throw new OutputError('OUTPUT_CONFLICT','Source changed while staging; no active source was replaced.');
 const j:Journal={version:1,output:basename(path),stage:stageName,backup:backupName,before:expected,after:scanSource(stage).fingerprint};
 fault?.('before-journal-write');const fd=openSync(journalPath(path),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{writeFileSync(fd,JSON.stringify(j)+'\n');fsyncSync(fd);}finally{closeSync(fd);}syncDirectory(parent);fault?.('after-journal-write');
 recoverPromotion(path,fault,{before:expected,files});return {backup:join(parent,backupName)};
}
export function promotionPending(path:string){return existsSync(journalPath(path));}
