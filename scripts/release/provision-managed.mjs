/** Operator adapter over the generated server API; credentials only on protected stdin. */
import { readFileSync, statSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
const [app,database]=process.argv.slice(2);
if(!app || !database || !isAbsolute(app) || !isAbsolute(database) || process.versions.node!=='24.22.1') throw Error('Use Node 24.22.1: provision-managed.mjs /absolute/app /absolute/deployment.sqlite < protected-input');
if(!statSync(database).isFile())throw Error('Deployment database must already exist.');
const {authConfig}=await import(pathToFileURL(join(resolve(app),'server/auth-config.ts')).href);
if(!authConfig.enabled || authConfig.mapping!==null)throw Error('This procedure supports enabled managed identity only; mapped sources need a separately reviewed provisioning procedure.');
const {IdentityStore,managedIdentityPath}=await import(pathToFileURL(join(resolve(app),'server/identity-store.ts')).href);
let input;
try{input=JSON.parse(readFileSync(0,'utf8'));}catch{throw Error('Provide protected JSON stdin containing username and password.');}
if(typeof input.username!=='string'||typeof input.password!=='string')throw Error('Credential input must contain username and password strings.');
const store=new IdentityStore(managedIdentityPath(database,authConfig.projectId),authConfig.projectId);
try{await store.provision(input.username,input.password,randomUUID());console.log('Visitor provisioned.');}
catch{throw Error('Provisioning refused; preserve the store and check input, duplicate username, permissions and identity configuration.');}
finally{input.password='';input.username='';store.close();}
