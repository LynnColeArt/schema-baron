// Run against the already-built owned fixture directory, never a real project.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import sharp from 'sharp';
const root=process.argv[2];if(!root?.startsWith('/tmp/oss-images-runtime-'))throw Error('Synthetic fixture required');
const output=join(root,'app'),env={...process.env,SCHEMA_BARON_IMAGE_ROOT:join(root,'assets'),NEXT_TELEMETRY_DISABLED:'1'};
const child=spawn(process.execPath,[join(output,'node_modules/next/dist/bin/next'),'start','-p','0','-H','127.0.0.1'],{cwd:output,env,stdio:['ignore','pipe','pipe']});let logs='';
const exited=once(child,'exit');let browser;
try{
 const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error(logs)),20000);const read=b=>{logs+=b;const m=logs.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timeout);resolve('http://127.0.0.1:'+m[1]);}};child.stdout.on('data',read);child.stderr.on('data',read);child.once('exit',()=>{clearTimeout(timeout);reject(Error(logs));});});
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',chromiumSandbox:true,headless:true});
 const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
 const page=await context.newPage();const id='browser-'+Date.now();
 await page.goto(url+'/record?'+new URLSearchParams({'form:mode':'new'}));await page.locator('input[name="_csrf"]').waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('input[name="_csrf"]')?.value.length>0);
 await page.getByLabel('key',{exact:true}).fill(id);await page.getByLabel('title',{exact:true}).fill('Browser image');
 const source=await sharp({create:{width:64,height:32,channels:3,background:'#0f0'}}).jpeg().withExif({IFD0:{Artist:'BROWSER-SECRET'}}).toBuffer();
 await page.getByLabel('photo',{exact:true}).setInputFiles({name:'private.jpg',mimeType:'image/jpeg',buffer:source});
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForURL('**/list');
 const db=new Database(join(root,'records.sqlite'));let row=db.prepare('SELECT * FROM items WHERE id=?').get(id);assert.match(row.photo,/^[a-f0-9]{48}\.webp$/);const old=row.photo;
 const params={'form:key:key':id};await page.goto(url+'/record?'+new URLSearchParams(params));await page.locator('img').waitFor();assert.equal(await page.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
 const imageURL=url+'/runtime/record-0/image?'+new URLSearchParams({...params,_field:'photo'});
 let response=await context.request.get(imageURL);assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/image\/webp/);const served=await response.body();assert.equal((await sharp(served).metadata()).exif,undefined);assert.equal(served.includes(Buffer.from('BROWSER-SECRET')),false);
 response=await context.request.post(url+'/runtime/record-0',{data:{action:'update',parameters:params,input:{title:'attack',photo:old}}});assert.equal(response.status(),403);
 response=await context.request.get(url+'/runtime/record-1/image?'+new URLSearchParams({'private-form:key:key':id,_field:'photo'}));assert.equal(response.status(),401);
 const csrf=await (await context.request.get(url+'/runtime/auth/csrf')).json();
 response=await context.request.post(url+'/runtime/record-0',{headers:{origin:url,'x-csrf-token':csrf.csrf},data:{action:'update',parameters:params,input:{key:id,title:'attack',photo:old}}});assert.equal(response.status(),400);assert.equal(db.prepare('SELECT photo FROM items WHERE id=?').get(id).photo,old);
 response=await context.request.get(url+'/runtime/record-0/image?'+new URLSearchParams({'form:key:key':'does-not-exist',_field:'photo'}));assert.equal(response.status(),400);
 await page.getByLabel('title',{exact:true}).fill('Kept image');await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForURL('**/list');assert.equal(db.prepare('SELECT photo FROM items WHERE id=?').get(id).photo,old);
 db.close();writeFileSync(join(root,'browser-result.json'),JSON.stringify({passed:true,scope:'real built Next server, sandboxed Chrome, multipart action, record image read, no-file save, CSRF and JSON forgery denial',url},null,2));console.log('Real browser image upload/read/reopen/no-file/CSRF/forgery checks passed.');
}finally{await browser?.close();child.kill('SIGTERM');await exited;writeFileSync(join(root,'browser-server.log'),logs);}
