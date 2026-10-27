import { expect, test } from 'vitest';
import { passwordHash, verifyPassword } from '../../src/templates/auth/store.js';
test('versioned salts differ and verification rejects malformed/legacy encodings',async()=>{
 const a=await passwordHash('strong trial value'),b=await passwordHash('strong trial value');
 expect(a).not.toBe(b);expect(a).toMatch(/^scrypt\$1\$32768\$8\$1\$/);
 expect(await verifyPassword('strong trial value',a)).toBe(true);
 expect(await verifyPassword('wrong',a)).toBe(false);
 for(const bad of ['plaintext','scrypt$1$2$8$1$aa$aa',a.replace('$32768$','$99999999$')]) expect(await verifyPassword('strong trial value',bad)).toBe(false);
});

import { parseProject } from '@schema-baron/model';
import { compileProject, emitApplication } from '../../src/index.js';
function configured() {
 return parseProject({id:'typed-auth-project',formatVersion:1,revision:1,name:'Typed credentials',target:'next-typescript-sqlite',targetVersion:'1',connectionRefs:['connection'],connections:[{id:'connection',name:'Data',locator:{approvedRootId:'data',relativePath:'external.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]}}],schema:{id:'schema',revision:1,tables:[],opaqueObjects:[]},queries:[],pages:[{id:'login-page',route:'/login',title:'Access',document:[{kind:'form',formId:'login-form'}],formIds:['login-form'],policyId:'login-public'},{id:'private-page',route:'/private',title:'Private',document:[],formIds:[]}],forms:[{id:'login-form',pageId:'login-page',kind:'Login',keyMapping:[],controlIds:['secret-control','name-control'],actionIds:['enter'],search:[],sorting:[],paging:{pageSize:20},appearance:{}}],controls:[{id:'name-control',formId:'login-form',kind:'text',credentialRole:'username',readOnly:false,appearance:{label:'Arbitrary label B'},validation:{required:true},events:[]},{id:'secret-control',formId:'login-form',kind:'text',credentialRole:'password',readOnly:false,appearance:{label:'Arbitrary label A'},validation:{required:true},events:[]}],actions:[{id:'enter',formId:'login-form',operation:'login',success:{pageId:'private-page',keyMapping:[],filterMapping:[]}}],policies:[{id:'global',scope:'global',ownerId:'typed-auth-project',access:'authenticated'},{id:'login-public',scope:'page',ownerId:'login-page',access:'public'}],globalPolicyId:'global',identity:{kind:'managed',storeRef:'configured-identities'},extensionContracts:[],outputConfig:{approvedRootId:'output',relativePath:'app'}});
}
test('global/page inheritance and credential semantics survive arbitrary labels and control order',()=>{
 const ir=compileProject(configured());expect(ir.routes.find(r=>r.path==='/private')!.policy).toEqual({access:'authenticated',sourceId:'global'});
 expect(ir.routes[0]!.logins[0]).toMatchObject({username:'name-control',password:'secret-control'});
 const page=emitApplication(ir,'/external/application.sqlite').find(f=>f.path==='app/private/page.tsx')!.content;
 expect(page).toContain('await guardPage("private-page",parameters)');
 const missing=configured();delete missing.controls[0]!.credentialRole;expect(()=>compileProject(missing)).toThrow('exactly one explicit');
 const duplicate=configured();duplicate.controls[0]!.credentialRole='password';expect(()=>compileProject(duplicate)).toThrow('exactly one explicit');
 const inaccessible=configured();delete inaccessible.pages[0]!.policyId;expect(()=>compileProject(inaccessible)).toThrow('public Login form');
});
