// Invoke against a fresh portable app only, after install/build and with Studio stopped.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { chromium, expect } from '@playwright/test';
const [appArgument,database,receipt]=process.argv.slice(2),app=resolve(appArgument);
const {authConfig}=await import(pathToFileURL(join(app,'server/auth-config.ts')).href);
const {IdentityStore,managedIdentityPath}=await import(pathToFileURL(join(app,'server/identity-store.ts')).href);
assert.equal(authConfig.mapping,null);assert.equal(authConfig.enabled,true);
const storePath=managedIdentityPath(database,authConfig.projectId);
const user=randomBytes(16).toString('hex'),password=randomBytes(32).toString('base64url');
async function provision(){const child=spawn(process.execPath,['--conditions=react-server',resolve('scripts/release/provision-managed.mjs'),app,database],{stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>output+=v);child.stdin.end(JSON.stringify({username:user,password}));const [code]=await once(child,'exit');assert(!output.includes(password));return code;}
assert.equal(await provision(),0);assert.notEqual(await provision(),0);
let store=new IdentityStore(storePath,authConfig.projectId);
const request=randomUUID();await store.provision(randomBytes(12).toString('hex'),password,request);await assert.rejects(()=>store.provision('duplicate-request',password,request));
await assert.rejects(()=>store.login(user,'wrong',undefined,'probe'));
const session=await store.login(user,password,undefined,'probe');assert(store.session(session.token));assert(store.checkCsrf(session.token,session.csrf));store.logout(session.token);assert.equal(store.session(session.token),undefined);store.close();
store=new IdentityStore(storePath,authConfig.projectId);const reopened=await store.login(user,password,undefined,'reopen');assert(store.session(reopened.token));store.logout(reopened.token);store.close();assert.equal(statSync(storePath).mode&0o777,0o600);
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:app,env:{...process.env,APPLICATION_DATABASE_PATH:database},detached:true,stdio:['ignore','pipe','pipe']}),exit=once(child,'exit');
let logs='';child.stdout.on('data',v=>logs+=v);child.stderr.on('data',v=>logs+=v);
let browser;
try{const origin='http://127.0.0.1:'+port;await expect.poll(()=>fetch(origin).then(r=>r.status,()=>0),{timeout:30000}).toBe(200);browser=await chromium.launch({headless:true});const page=await browser.newPage();const protectedRoute=authConfig.routes.find(r=>r.access==='authenticated').path;await page.goto(origin+protectedRoute);await expect(page.getByLabel('Username',{exact:true})).toBeVisible();await page.getByLabel('Username',{exact:true}).fill(user);await page.getByLabel('Password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Sign in failed'})).toBeVisible();await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(origin+protectedRoute);await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.goto(origin+protectedRoute);await expect(page.getByLabel('Username',{exact:true})).toBeVisible();assert(!logs.includes(password));writeFileSync(receipt,JSON.stringify({node:process.version,managedMapping:null,protectedStdin:true,adapterProvisioned:true,duplicateUsernameRefused:true,duplicateRequestRefused:true,wrongPasswordRefused:true,sessionCsrf:true,revocation:true,reopenLogin:true,mode:'0600',actualPortableBrowserLoginAndLogout:true,protectedRoute},null,2));}
finally{await browser?.close();if(child.pid&&child.exitCode===null&&child.signalCode===null)process.kill(-child.pid,'SIGTERM');await exit;}
