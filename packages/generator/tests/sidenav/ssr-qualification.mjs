import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const session=JSON.parse(readFileSync('./synthetic-session.json','utf8'));
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','0'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
let logs='';const exited=new Promise(resolve=>child.once('exit',resolve));
try{
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs)),20000);const read=chunk=>{logs+=chunk;const match=logs.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}};child.stdout.on('data',read);child.stderr.on('data',read);child.once('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 for(const headers of [{},{cookie:session.cookie+'=invalid'},{RSC:'1'}]){const response=await fetch(url+'/login',{headers});assert.equal(response.status,200);const body=await response.text();assert.equal(body.includes('Secret destination'),false);assert.equal(body.includes('Staff handbook'),false);assert.ok(body.includes('Public guide'));}
 const response=await fetch(url+'/private',{headers:{cookie:session.cookie+'='+session.token}});assert.equal(response.status,200);const body=await response.text();assert.ok(body.includes('Secret destination'));assert.ok(body.includes('Staff handbook'));assert.ok(body.includes('<nav aria-label="Main navigation">'));assert.ok(body.includes('<details open="">'));assert.ok(body.includes('aria-current="page"'));assert.equal(body.includes('menuEntries'),false);
 const denied=await fetch(url+'/private',{redirect:'manual'});assert.equal(denied.status,307);
 console.log('Production Next HTTP/SSR and RSC: protected labels absent anonymously; authenticated navigation and active route present; direct page guard intact.');
}finally{child.kill('SIGTERM');await exited;writeFileSync('./ssr-server.log',logs);}
