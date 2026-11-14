import {test,expect} from 'vitest';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {startOwner} from '../../../apps/studio/src/server/index.js';
import {EvidenceJournal,parityEvidenceRoot,runChild,type ChildResult} from './harness.js';
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

test('warmed real owner stays responsive during asynchronous child work and idle socket expiry',async()=>{
 const root=mkdtempSync(join(tmpdir(),'parity-responsive-')),cap=randomBytes(32).toString('base64url'),journal=new EvidenceJournal(parityEvidenceRoot(),'owner-responsiveness');journal.redact(cap,root);
 const owner=await startOwner({ownerId:'responsive-owner',capability:cap,metadataRoot:join(root,'metadata'),approvedRoots:{projects:join(root,'projects')}});
 const fetchOwner=async(phase:string)=>{journal.begin({phase,transport:'http',operation:'capabilities'});const response=await fetch(owner.url+'/api/v1/capabilities',{headers:{authorization:'Bearer '+cap}});await response.text();journal.observed({httpStatus:response.status});expect(response.status).toBe(200);};
 let childWork:Promise<ChildResult>|undefined;
 const warm=async()=>{for(let i=0;i<3;i++){await fetchOwner('warm-pool');await pause(20);}};
 try{
  await warm();journal.begin({phase:'asynchronous-idle-control',durationMs:7200});await pause(7200);await fetchOwner('after-asynchronous-idle');
  await warm();journal.begin({phase:'asynchronous-child-start',durationMs:7200});let completed=false;
  const child=childWork=runChild(process.execPath,['-e',"process.stdout.write('started\\n');setTimeout(()=>process.stdout.write('finished\\n'),7200)"],{cwd:root,timeoutMs:120000}).then(result=>{completed=true;return result;});
  // The same helper used by npm ci must leave the owner responsive before the child exits.
  await pause(250);expect(completed).toBe(false);await fetchOwner('during-asynchronous-child');expect(completed).toBe(false);
  const result=await child;journal.observed({child:result});expect(result).toMatchObject({status:0,signal:null,timedOut:false,stderr:'',stdout:'started\nfinished\n'});
  // More than the default keep-alive idle interval elapsed after the in-child probe.
  await fetchOwner('after-asynchronous-child-idle');journal.succeed();
 }catch(error){journal.fail(error);throw error;}finally{if(childWork)await childWork;await owner.close();rmSync(root,{recursive:true,force:true});journal.cleanup({ownerClosed:true,childCompleted:true,scratchRemoved:true});}
});

test('failed phase evidence survives cleanup and redacts nested errors and child output',async()=>{
 const root=mkdtempSync(join(tmpdir(),'parity-failure-evidence-')),secret='private-evidence-sentinel',journal=new EvidenceJournal(root,'failure');journal.redact(secret);
 try{
  journal.begin({phase:'offline-install',operation:'npm.ci',transport:'child'});
  const result=await runChild(process.execPath,['-e',"process.stdout.write('private-evidence-sentinel');process.stderr.write('failed');process.exitCode=7"],{cwd:root,timeoutMs:120000});journal.observed({child:result});expect(result.status).toBe(7);
  journal.begin({phase:'command',operation:'runtime.start',transport:'http',requestId:'known-request',expectedRevision:16});
  journal.fail(new TypeError('fetch failed '+secret,{cause:Object.assign(new Error('read ECONNRESET'),{code:'ECONNRESET'})}));
  journal.fail(new Error('cleanup failed after primary failure'));
  const retained=readFileSync(join(root,'failure.json'),'utf8');expect(retained).not.toContain(secret);expect(JSON.parse(retained)).toMatchObject({status:'failed',failure:{context:{operation:'runtime.start',transport:'http',requestId:'known-request'},error:{cause:{code:'ECONNRESET'}}}});mkdirSync(parityEvidenceRoot(),{recursive:true});copyFileSync(join(root,'failure.json'),join(parityEvidenceRoot(),'controlled-failure-evidence.json'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
