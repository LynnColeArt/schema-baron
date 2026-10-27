import {authPath,csrfPath} from '../../behavior/index.js';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { keyParameter } from '../navigation/index.js';
import type { GeneratedFile, GenerationIR } from '../../ir/index.js';
export function authFiles(ir:GenerationIR):GeneratedFile[] {
 const loginPath=ir.routes.find(r=>r.policy.access==='public'&&r.logins.some(l=>l.actions.some(a=>a.operation==='login'&&a.access==='public')))?.path??ir.routes[0]!.path;
 const routes=ir.routes.map(route=>({
  id:route.id,path:route.path,access:route.policy.access,
  actions:[...route.records.flatMap(r=>r.config.actions as {id:string;access?:string}[]),...route.grids.flatMap(g=>g.actions??[]),...route.logins.flatMap(l=>l.actions)].map(a=>({id:a.id,access:a.access??'public'})),
  readActions:route.grids.map(g=>({parameters:[g.id+':page',g.id+':sort',g.id+':direction',...g.search.map(s=>g.id+':filter:'+s.fieldId),...g.keyMapping.map(k=>keyParameter(g,k.targetFieldId))],actions:(g.actions??[]).filter(a=>a.operation==='search').map(a=>a.id)})),
  parameters:[...ir.contexts,...route.records.flatMap(r=>[
   ...r.source.keys.map((id,i)=>({parameter:(r.config.keyParameters as string[])[i]!,kind:'key',field:r.source.fields.find(f=>f.id===id)!})),
   {parameter:r.id+':mode',kind:'mode'}
  ])]
 }));
 const config={projectId:ir.projectId,enabled:!!ir.auth,mapping:ir.auth?.mapping??null,cookie:'visitor_'+createHash('sha256').update(ir.projectId).digest('hex').slice(0,20),loginPath,contexts:ir.contexts,routes,
 logins:ir.routes.flatMap(route=>route.logins.map(login=>({...login,pageId:route.id,actions:login.actions.map(a=>({id:a.id,access:a.access??'public',operation:a.operation,...(a.label?{label:a.label}:{}),target:a.success??a.destination??null}))})))
 };

 const source=new URL('./store.ts',import.meta.url),fallback=new URL('./store.template',import.meta.url);
 return [
 {path:'server/identity-store.ts',content:"import 'server-only';\n"+readFileSync(existsSync(source)?source:fallback,'utf8')},
 {path:'server/auth-config.ts',content:`import type { IdentityMapping } from './identity-store';\nimport type { ContextField, Destination } from './navigation';\ntype Config={projectId:string;enabled:boolean;mapping:IdentityMapping|null;cookie:string;loginPath:string;contexts:ContextField[];routes:{id:string;path:string;access:string;actions:{id:string;access:string}[];readActions:{parameters:string[];actions:string[]}[];parameters:ContextField[]}[];logins:{id:string;pageId:string;username:string;password:string;usernameLabel:string;passwordLabel:string;actions:{id:string;operation:string;label?:string;access:string;target:Destination|null}[]}[]};\nexport const authConfig:Config=${JSON.stringify(config,null,2)};\n`},
 {path:'server/auth.ts',content:readFileSync(new URL('./runtime.template',import.meta.url),'utf8')},
 {path:`app${csrfPath}/route.ts`,content:`import { csrfResponse, failure } from '../../../../server/auth';\nexport const dynamic='force-dynamic';\nexport async function GET(request:Request){try{return await csrfResponse(request);}catch(error){return failure(error);}}\n`},
 {path:`app${authPath}/route.ts`,content:`import { authenticate, failure } from '../../../server/auth';\nexport async function POST(request:Request){try{return await authenticate(request);}catch(error){return failure(error);}}\n`},
 {path:'tests/identity.test.mjs',content:readFileSync(new URL('./output-test.template',import.meta.url),'utf8')},
 {path:'AUTH.md',content:`# Visitor identity\n\nConfigure a managed identity source or compatible explicit mapped source and provision a visitor through Studio owner operations identity.configure and identity.provision before running. No account is created by generation. Author Login controls with explicit credentialRole username/password; labels and ordering carry no credential meaning.\n\nThe managed SQLite identity/session store lives beside the external application database, with a project-derived filename and mode 0600, outside replaceable output. Keep this file private and persistent. APPLICATION_DATABASE_PATH relocates both database and its adjacent store; move the store deliberately with it. Mapped source fields must be distinct required text fields: single-column ID primary key, unique username, and versioned scrypt hash; other required fields need defaults. Plaintext and incompatible legacy hashes are rejected. Provisioning never rewrites an existing username.\n\nHashes use random 128-bit salts and scrypt v1 N=32768,r=8,p=1,64-byte output (64 MiB maximum KDF memory). Tune only through a separately versioned implementation after measuring deployment hardware. Login is bounded to eight attempts per minute per project, with generic failure responses for missing accounts and bad credentials. Sessions use 256-bit opaque tokens stored only as SHA-256 hashes, expire after eight hours, rotate at login and revoke at logout. Visitor sessions never accept Studio author capability.\n\nCookies are HttpOnly/SameSite=Lax, Secure for HTTPS; HTTP is permitted only for localhost/127.0.0.1/IPv6 loopback. State changes require an exact matching Origin and double-submit CSRF nonce (GET /runtime/auth/csrf). Protected logout additionally checks the session CSRF hash. Never trust forwarded headers to weaken HTTPS or host validation. Deploy behind an ingress that preserves the original Host/Origin.\n\nPage checks execute before data reads; action checks execute before data writes. Explicit per-record /runtime/record-N GET/POST handlers share the Record services. POST expects action, parameters, input, optional confirmed, with the CSRF nonce in x-csrf-token. Return targets are restricted to declared internal routes and typed declared parameters.\n`},
 {path:'components/csrf.tsx',content:`'use client';\nimport { useEffect,useState } from 'react';\nlet request:Promise<string>|undefined;\nexport function Csrf(){const [token,setToken]=useState('');useEffect(()=>{request??=fetch('/runtime/auth/csrf',{cache:'no-store'}).then(r=>r.json()).then(v=>String(v.csrf??''));request.then(setToken).catch(()=>setToken(''));},[]);return <input type="hidden" name="_csrf" value={token}/>;}\n`},

 ];
}
