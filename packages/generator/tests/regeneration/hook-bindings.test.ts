import { pinnedNpmCli } from '../../../../scripts/release/toolchain.mjs';
import {afterEach,expect,test} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';
import {createId,parseProject} from '@schema-baron/model';
const sid=(value:string)=>createId(()=>value);
import type {Action,Form} from '@schema-baron/model';
import {compileProject,emitApplication,GenerationError} from '@schema-baron/generator';
const roots:string[]=[];
afterEach(()=>roots.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));
function project(kind:Form['kind'],operation:Action['operation']) {
 const login=kind==='Login';
 return parseProject({id:'project',formatVersion:1,revision:1,name:'Hook binding boundaries',target:'next-typescript-sqlite',targetVersion:'1',connectionRefs:['connection'],connections:[{id:'connection',name:'External data',locator:{approvedRootId:'data',relativePath:'records.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]}}],schema:{id:'schema',revision:1,tables:[{id:'table',physicalName:'records',columns:[{id:'key',physicalName:'code',nullable:false,type:{kind:'text'}},{id:'title',physicalName:'caption',nullable:false,type:{kind:'text'}}],primaryKey:['key'],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}],opaqueObjects:[]},queries:[],pages:[{id:'page',route:'/',title:'Records',document:[{kind:'form',formId:'form'}],formIds:['form']},{id:'list',route:'/list',title:'List',document:[],formIds:[]}],forms:[{id:'form',pageId:'page',kind,...(login?{}:{sourceRef:{kind:'table',id:'table'}}),keyMapping:kind==='Record'?[{targetFieldId:'key',expression:{kind:'field',alias:'root',fieldId:'key'}}]:[],displayFieldIds:login?[]:['title'],controlIds:['key-control','title-control'],actionIds:['action'],search:[],sorting:[],paging:{pageSize:20},appearance:{label:'Records'}}],controls:[{id:'key-control',formId:'form',kind:'text',...(login?{credentialRole:'username'}:{binding:{kind:'stored',fieldId:'key'}}),readOnly:false,appearance:{label:'Code'},validation:{required:true},events:[]},{id:'title-control',formId:'form',kind:'text',...(login?{credentialRole:'password'}:{binding:{kind:'stored',fieldId:'title'}}),readOnly:false,appearance:{label:'Caption'},validation:{required:true},events:[]}],actions:[{id:'action',formId:'form',operation,extensionHookRef:'action-hook',destination:{pageId:'list',keyMapping:[],filterMapping:[]},success:{pageId:'list',keyMapping:[],filterMapping:[]}}],policies:[{id:'global',ownerId:'project',scope:'global',access:'public'}],globalPolicyId:'global',outputConfig:{approvedRootId:'output',relativePath:'app'},extensionContracts:[{id:'action-hook',kind:'action',version:1,relativePath:'authored/action.ts'}],...(login?{identity:{kind:'managed',storeRef:'identity'}}:{})});
}
const operations:Action['operation'][]=['insert','update','delete','navigate','search','login','logout','cancel','extension'];
const unsupported: [Form['kind'],Action['operation']][]=(['Grid','Search','Login','Record'] as const).flatMap(kind=>operations.filter(operation=>!(kind==='Record'&&['insert','update','delete','extension'].includes(operation))&&!(kind==='Login'&&['insert','update','delete'].includes(operation))).map(operation=>[kind,operation] as [Form['kind'],Action['operation']]));
test.each(unsupported)('%s %s source hook is diagnosed on its Action before output emission',(kind,operation)=>{
 const model=project(kind,operation);
 try {emitApplication(compileProject(model),'/external/records.sqlite');throw Error('Unsupported hook was accepted.');}
 catch(error){expect(error).toBeInstanceOf(GenerationError);expect((error as GenerationError).diagnostics).toContainEqual(expect.objectContaining({code:'UNSUPPORTED_SCHEMA_OBJECT',objectId:model.actions[0]!.id,field:'extensionHookRef',message:expect.stringContaining('Record'),recoveryAction:expect.stringContaining('Remove')}));}
});

test('production Record output executes supported hooks and rolls back failures; Cancel invokes none',()=>{
 const root=mkdtempSync(join(tmpdir(),'wp20-supported-hooks-'));roots.push(root);const output=join(root,'app'),database=join(root,'records.sqlite');mkdirSync(output);
 const db=new Database(database);db.exec("CREATE TABLE records(code TEXT NOT NULL PRIMARY KEY,caption TEXT NOT NULL);INSERT INTO records VALUES('A','Original')");db.close();
 const model=project('Record','update');
 model.actions=['insert','update','delete','extension','cancel'].map(operation=>({...model.actions[0]!,id:operation,operation,...(operation==='cancel'?{extensionHookRef:undefined}:{})})) as typeof model.actions;
 // Cancel deliberately has no authored hook binding.
 delete model.actions.at(-1)!.extensionHookRef;model.forms[0]!.actionIds=model.actions.map(action=>action.id);
 model.extensionContracts.push(...(['validator','service','event'] as const).map(kind=>({id:sid(kind+'-hook'),kind,version:1,relativePath:'authored/'+kind+'.ts'})));
 model.forms.push({...model.forms[0]!,id:sid('list-form'),pageId:sid('list'),kind:'Grid',keyMapping:[],displayFieldIds:[],controlIds:[sid('list-key-control'),sid('list-title-control')],actionIds:[]});
 model.controls.push(...model.controls.map(control=>({...control,id:sid('list-'+control.id),formId:sid('list-form'),kind:'label' as const,readOnly:true})));model.pages[1]!.formIds=[sid('list-form')];model.pages[1]!.document=[{kind:'form',formId:sid('list-form')}];
 const files=emitApplication(compileProject(parseProject(model)),database);
 for(const file of files){const path=join(output,file.path);mkdirSync(join(path,'..'),{recursive:true});writeFileSync(path,file.content);}
 const signatures={validator:['ValidatorV1','validate'],action:['ActionV1','execute'],service:['ServiceV1','beforeWrite'],event:['EventV1','afterWrite']} as const;
 for(const [kind,[signature,name]] of Object.entries(signatures))writeFileSync(join(output,'authored',kind+'.ts'),`import type {${signature}} from '../server/extension-contracts';\nexport const contractVersion=1 as const;\nexport const ${name}:${signature}=(context)=>{const probe=globalThis as typeof globalThis & {hookCalls:string[];failHook:string};probe.hookCalls.push('${kind}');if(probe.failHook==='${kind}')${kind==='validator'?"return {title:'Validator rejected'}":"throw Error('Rejected by '+probe.failHook)"};${kind==='validator'?'return {};':''}};\n`);
 const npm=pinnedNpmCli;
 for(const args of [['ci','--ignore-scripts','--offline'],['run','typecheck']]){const checked=spawnSync(process.execPath,[npm,...args],{cwd:output,encoding:'utf8',timeout:60000});expect(checked.status,checked.stdout+checked.stderr).toBe(0);}
 const proof=`import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {execute} from './server/record-service.ts';
import {config} from './server/record-0.ts';
const database=${JSON.stringify(database)};
const db=new Database(database);
const baseline=[{code:'A',caption:'Original'}];
const rows=()=>db.prepare('SELECT code,caption FROM records ORDER BY code').all();
const reset=()=>{db.exec("DELETE FROM records;INSERT INTO records VALUES('A','Original')");globalThis.hookCalls=[];globalThis.failHook='';};
for(const operation of ['insert','update','delete','extension']) {
 const parameters=operation==='insert'?{'form:mode':'new'}:{'form:key:key':'A'};
 const input=operation==='delete'?{}:{key:operation==='insert'?'N':'A',title:'Changed'};
 const expected=operation==='delete'?['service','action','event']:['validator','service','action','event'];
 for(const failure of expected){reset();globalThis.failHook=failure;const result=execute(config,operation,parameters,input,true);assert.ok(result.summary);assert.equal(result.location,undefined);assert.equal(result.saved,undefined);assert.deepEqual(rows(),baseline);assert.deepEqual(globalThis.hookCalls,expected.slice(0,expected.indexOf(failure)+1));}
 reset();const result=execute(config,operation,parameters,input,true);assert.equal(result.summary,'');assert.equal(result.location,'/list');assert.deepEqual(globalThis.hookCalls,expected);
 assert.deepEqual(rows(),operation==='insert'?[...baseline,{code:'N',caption:'Changed'}]:operation==='update'?[{code:'A',caption:'Changed'}]:operation==='delete'?[]:baseline);
}
reset();globalThis.failHook='event';const canceled=execute(config,'cancel',{'form:key:key':'A'},{unexpected:'invalid'},true);assert.equal(canceled.location,'/list');assert.deepEqual(globalThis.hookCalls,[]);assert.deepEqual(rows(),baseline);db.close();console.log('Supported insert/update/delete/extension hooks executed; validator/service/action/event failures rolled back; Cancel invoked no hooks.');`;
 writeFileSync(join(output,'hook-proof.mjs'),proof);
 const executed=spawnSync(process.execPath,['--conditions=react-server','hook-proof.mjs'],{cwd:output,encoding:'utf8',timeout:60000});expect(executed.status,executed.stdout+executed.stderr).toBe(0);expect(executed.stdout).toContain('Cancel invoked no hooks.');
},90000);
