import { expect, test } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ProjectCore } from '@schema-baron/core';
import { project, seed } from './fixture.js';
test('built production Next owner SIGTERM interrupts a live preview and releases its writer after terminal observation',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp15-next-shutdown-')),definitions=join(root,'definitions'),metadataRoot=join(root,'metadata');mkdirSync(definitions);
 const capability='wp15-private-'+'x'.repeat(40);const options={ownerId:'owner',metadataRoot,approvedRoots:{projects:definitions}};const config=join(root,'owner.json');writeFileSync(config,JSON.stringify({...options,capability}),{mode:0o600});
 const p=project();writeFileSync(join(definitions,'import.json'),JSON.stringify({...p,queries:[]}));const path=join(definitions,'data.sqlite'),db=seed(path);db.close();const bytes=readFileSync(path);
 const child=spawn(process.execPath,[resolve('apps/studio/dist/main.js')],{env:{...process.env,PORT:'0',SCHEMA_BARON_OWNER_CONFIG:config},stdio:['ignore','pipe','pipe']});const exited=once(child,'exit');let logs='';
 try{
 const url=await new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Production owner readiness timed out.')),15000);child.stderr.on('data',(chunk:Buffer)=>{logs+=chunk.toString();const match=logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]!);}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('Production owner exited before readiness.'));});});
 const headers={authorization:'Bearer '+capability,'content-type':'application/json'};
 const command=async(operation:string,input:unknown,expectedRevision:number,requestId:string=crypto.randomUUID())=>(await fetch(url+'/api/v1/projects/query-project/commands',{method:'POST',headers,body:JSON.stringify({projectId:'query-project',operation,input,expectedRevision,requestId})})).json();
 expect(await command('project.open',{locator:'projects:import.json'},1)).toMatchObject({ok:true});
 const inspection=await command('connection.inspect',{approvedPath:'projects:data.sqlite',mode:'read-only'},1);expect(inspection).toMatchObject({ok:true});expect(await command('connection.bind',{connectionId:inspection.result.connection.id,fingerprint:inspection.result.connection.fingerprint},1)).toMatchObject({ok:true,revision:2});
 const current=await command('project.inspect',{},2);const schema={...p.schema,id:current.result.schema.id,revision:current.result.schema.revision};expect(await command('project.batch',{operations:[{kind:'put',entity:'schema',id:schema.id,value:schema},...p.queries.map(q=>({kind:'put',entity:'query',id:q.id,value:q}))]},2)).toMatchObject({ok:true,revision:3});
 const pending=command('query.preview',{queryId:'report',parameters:{},rowLimit:200},3,'production-live-preview');let observed=false;
 for(let i=0;i<100;i++){const job=await (await fetch(url+'/api/v1/jobs/production-live-preview?projectId=query-project',{headers})).json();if(job.ok && job.result.status==='running'){observed=true;break;}await new Promise(resolve=>setTimeout(resolve,1));}
 expect(observed).toBe(true);child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),4000);const [code,signal]=await exited;clearTimeout(timer);expect(code).toBe(0);expect(signal).toBe(null);expect(await pending).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});
 const reopened=new ProjectCore(options);try{expect(reopened.job('owner','query-project','production-live-preview')).toMatchObject({status:'canceled',committed:false});expect(reopened.snapshot('owner','query-project').revision).toBe(3);}finally{await reopened.close();}
 expect(readFileSync(path)).toEqual(bytes);expect(logs).not.toContain(capability);
 }finally{if(child.exitCode===null && child.signalCode===null){child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(timer);}rmSync(root,{recursive:true,force:true});}
});
