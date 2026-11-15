import {test,expect} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';
import {ProjectCore} from '@schema-baron/core';
import {parseProject} from '@schema-baron/model';
import {compileProject,emitApplication,observeOutput,writeInitialOutput} from '../../src/index.js';
function fixture(){return parseProject({id:'images',name:'Image records',formatVersion:1,revision:1,target:'next-typescript-sqlite',targetVersion:'1',connectionRefs:['connection'],connections:[{id:'connection',name:'data',locator:{approvedRootId:'data',relativePath:'records.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]}}],schema:{id:'schema',revision:1,opaqueObjects:[],tables:[{id:'source',physicalName:'items',columns:[{id:'key',physicalName:'id',type:{kind:'text'},nullable:false},{id:'title',physicalName:'title',type:{kind:'text'},nullable:false},{id:'photo',physicalName:'photo',type:{kind:'text'},nullable:true}],primaryKey:['key'],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}]},pages:[{id:'page',route:'/record',title:'Record',formIds:['form'],document:[{kind:'form',formId:'form'}]},{id:'list',route:'/list',title:'List',formIds:[],document:[]}],forms:[{id:'form',pageId:'page',kind:'Record',sourceRef:{kind:'table',id:'source'},keyMapping:[{targetFieldId:'key',expression:{kind:'field',alias:'root',fieldId:'key'}}],displayFieldIds:['title'],controlIds:['id-control','title-control','photo-control'],actionIds:['insert','update'],search:[],sorting:[],paging:{pageSize:20},appearance:{label:'Item'}}],controls:['key','title','photo'].map(field=>({id:field==='key'?'id-control':field+'-control',formId:'form',kind:field==='photo'?'image':'text',...(field==='photo'?{image:{folder:'photos'}}:{}),binding:{kind:'stored',fieldId:field},readOnly:false,validation:{required:field!=='photo'},appearance:{label:field},events:[]})),actions:['insert','update'].map(operation=>({id:operation,formId:'form',operation,success:{pageId:'list',keyMapping:[],filterMapping:[]}})),policies:[{id:'global',scope:'global',ownerId:'images',access:'public'}],globalPolicyId:'global',queries:[],extensionContracts:[],outputConfig:{approvedRootId:'output',relativePath:'app'}});}
test('image authoring configuration rejects unsafe folder and nontext bindings',()=>{
 const p=fixture();expect(compileProject(p).routes[0]?.records[0]?.config).toBeDefined();
 expect(()=>parseProject({...p,controls:p.controls.map(c=>c.kind==='image'?{...c,image:{folder:'../public'}}:c)})).toThrow();
 const q=fixture();q.schema.tables[0]!.columns[2]!.type={kind:'integer'};expect(()=>compileProject(q)).toThrow();
});
test('real generated app builds and normalizes/stores/replaces images without source bytes',()=>{
 const root=mkdtempSync('/tmp/oss-images-runtime-'),output=join(root,'app'),dbPath=join(root,'records.sqlite'),storage=join(root,'assets');mkdirSync(storage,{mode:0o700});
 const db=new Database(dbPath);db.exec('CREATE TABLE items(id TEXT PRIMARY KEY,title TEXT NOT NULL,photo TEXT)');db.close();
 const original=fixture();
 const project=parseProject({...original,identity:{kind:'managed',storeRef:'image-test-identities'},
 pages:[...original.pages,{id:'private-page',route:'/private-record',title:'Private record',formIds:['private-form'],document:[{kind:'form',formId:'private-form'}],policyId:'private-policy'},{id:'login-page',route:'/login',title:'Login',formIds:['login-form'],document:[{kind:'form',formId:'login-form'}]}],
 forms:[...original.forms,{...original.forms[0],id:'private-form',pageId:'private-page',controlIds:original.controls.map(c=>'private-'+c.id),actionIds:['private-insert','private-update']},{id:'login-form',pageId:'login-page',kind:'Login',keyMapping:[],controlIds:['username','password'],actionIds:['login'],search:[],sorting:[],paging:{pageSize:20},appearance:{}}],
 controls:[...original.controls,...original.controls.map(c=>({...c,id:'private-'+c.id,formId:'private-form'})),...['username','password'].map(role=>({id:role,formId:'login-form',kind:'text',credentialRole:role,readOnly:false,appearance:{label:role},validation:{required:true},events:[]}))],
 actions:[...original.actions,...original.actions.map(a=>({...a,id:'private-'+a.id,formId:'private-form'})),{id:'login',formId:'login-form',operation:'login',success:{pageId:'list',keyMapping:[],filterMapping:[]}}],
 policies:[...original.policies,{id:'private-policy',scope:'page',ownerId:'private-page',access:'authenticated'}]});writeInitialOutput(output,emitApplication(compileProject(project),dbPath),observeOutput(output));
 writeFileSync(join(root,'project.json'),JSON.stringify(project,null,2));writeFileSync('/tmp/oss-images-runtime-root.txt',root);
 const npm=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');
 const env={...process.env,PATH:dirname(process.execPath)+':/usr/bin:/bin',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1',SCHEMA_BARON_IMAGE_ROOT:storage};
 function run(args:string[],label:string){const r=spawnSync(process.execPath,args,{cwd:output,env,encoding:'utf8',timeout:150000,maxBuffer:5000000});writeFileSync(join(root,label+'.log'),(r.stdout??'')+(r.stderr??''));expect(r.error,label).toBeUndefined();expect(r.status,(r.stdout??'')+(r.stderr??'')).toBe(0);}
 run([npm,'ci','--offline','--ignore-scripts'],'install');
 writeFileSync(join(output,'image-qualification.mjs'),readFileSync(new URL('./qualification.mjs',import.meta.url)));
 run(['--conditions=react-server','image-qualification.mjs'],'image-qualification');
 run([npm,'run','typecheck'],'typecheck');run([npm,'run','build'],'build');
},300000);

test('Studio owner batch saves image configuration and reopens it',async()=>{
 const root=mkdtempSync('/tmp/oss-image-authoring-'),definitions=join(root,'definitions');mkdirSync(definitions);
 const p=fixture();const path=join(definitions,'project.json');writeFileSync(path,JSON.stringify(p));
 const options={ownerId:'owner',metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions}};
 const core=new ProjectCore(options);
 const opened=core.execute('owner',{requestId:'image-open',projectId:p.id,operation:'project.open',expectedRevision:1,input:{locator:'projects:project.json'}});expect(opened).toMatchObject({ok:true});
 const image=p.controls.find(c=>c.kind==='image')!;
 const changed=await core.executeAsync('owner',{requestId:'image-save',projectId:p.id,operation:'project.batch',expectedRevision:1,input:{operations:[{kind:'put',entity:'control',id:image.id,value:{...image,image:{folder:'catalog/photos'}}}]}});expect(changed,JSON.stringify(changed)).toMatchObject({ok:true});await core.close();
 const reopen=new ProjectCore(options);try{
 const result=reopen.execute('owner',{requestId:'image-reopen',projectId:p.id,operation:'project.open',expectedRevision:2,input:{locator:'projects:project.json'}});expect(result,JSON.stringify(result)).toMatchObject({ok:true});
 const inspected=reopen.execute('owner',{requestId:'image-inspect',projectId:p.id,operation:'project.inspect',expectedRevision:2,input:{}});expect(inspected).toMatchObject({ok:true});if(inspected.ok)expect((inspected.result as typeof p).controls.find(c=>c.id===image.id)?.image?.folder).toBe('catalog/photos');
 }finally{await reopen.close();}
});
