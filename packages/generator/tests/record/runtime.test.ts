import { expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { createId, parseProject } from '@schema-baron/model';
import type { Project, Form, Control } from '@schema-baron/model';
import { ProjectCore } from '@schema-baron/core';
import { compileProject, emitApplication, writeInitialOutput, observeOutput } from '../../src/index.js';

test('authored Search and Record modules transact against independent quoted/composite SQLite, and build outside Studio', async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp12-record-runtime-')), definitions=join(root,'definitions');mkdirSync(definitions);
 const databasePath=join(definitions,'live.sqlite'),db=new Database(databasePath);
 db.pragma('foreign_keys = ON');
 db.exec(`CREATE TABLE "register "" rows"(tenant TEXT NOT NULL,seq INTEGER NOT NULL,title TEXT NOT NULL UNIQUE,parent INTEGER,amount TEXT,PRIMARY KEY(tenant,seq),FOREIGN KEY(parent) REFERENCES parents(pk));
 CREATE TABLE parents(pk INTEGER PRIMARY KEY,title TEXT NOT NULL);
 CREATE TABLE restrict_children(parent INTEGER REFERENCES parents(pk) ON DELETE RESTRICT);
 CREATE TABLE cascade_children(parent INTEGER REFERENCES parents(pk) ON DELETE CASCADE);
 CREATE TABLE ordinary(pk INTEGER PRIMARY KEY,title TEXT NOT NULL,flag INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE intkey(pk INT PRIMARY KEY,title TEXT NOT NULL);
 CREATE TABLE desckey(pk INTEGER PRIMARY KEY DESC,title TEXT NOT NULL);
 INSERT INTO parents VALUES(1,'Restricted'),(2,'Cascading'); INSERT INTO restrict_children VALUES(1); INSERT INTO cascade_children VALUES(2);
 INSERT INTO "register "" rows" VALUES('A',1,'Original',NULL,NULL),('B',1,'Other',NULL,NULL);`);db.close();
 const field=(id:string,name:string,kind:'text'|'integer',nullable=false)=>({id,physicalName:name,type:{kind},nullable});
 const tables=[{id:'rows',physicalName:'register " rows',columns:[field('tenant','tenant','text'),field('seq','seq','integer'),field('title','title','text'),field('parent','parent','integer',true),{id:'amount',physicalName:'amount',type:{kind:'decimal',encoding:'text',scale:2,precision:38,rounding:'half-up'},nullable:true}],primaryKey:['tenant','seq'],foreignKeys:[{id:'parent-fk',columnIds:['parent'],referencedTableId:'parents',referencedColumnIds:['parent-id'],onDelete:'restrict',onUpdate:'restrict',deferrable:false}],uniqueConstraints:[{id:'unique-title',columnIds:['title']}],checks:[],indexes:[]},...['parents','ordinary','intkey','desckey'].map(name=>({id:name,physicalName:name,columns:[field(name==='parents'?'parent-id':name+'-pk','pk','integer'),field(name+'-title','title','text'),...(name==='ordinary'?[{id:'ordinary-flag',physicalName:'flag',type:{kind:'boolean'},nullable:false,default:{kind:'literal',value:false,type:{kind:'boolean'}}}]:[])],primaryKey:[name==='parents'?'parent-id':name+'-pk'],foreignKeys:[],uniqueConstraints:[],checks:[],indexes:[]}))];
 let project=parseProject({id:'runtime',name:'Record runtime',formatVersion:1,revision:1,target:'next-typescript-sqlite',targetVersion:'1',connectionRefs:['connection'],connections:[{id:'connection',name:'Data',locator:{approvedRootId:'projects',relativePath:'live.sqlite'},fingerprint:'0'.repeat(64),capabilities:{sqliteVersion:'3',foreignKeys:true,returning:true,strictTables:true,unsupportedObjects:[]}}],schema:{id:'schema',revision:1,tables,opaqueObjects:[]},pages:['list','record','parents','ordinary','intkey','desckey'].map(id=>({id:'page-'+id,title:id,route:'/'+id,document:[],formIds:[]})),forms:[],controls:[],queries:[],actions:[],policies:[{id:'public',scope:'global',ownerId:'runtime',access:'public'}],globalPolicyId:'public',outputConfig:{approvedRootId:'output',relativePath:'app'},extensionContracts:[]});
 writeFileSync(join(definitions,'runtime.json'),JSON.stringify(project));
 const core=new ProjectCore({ownerId:'owner',metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions,output:join(root,'output')}});
 async function command(operation:string,input:unknown) {
  const result=await core.executeAsync('owner',{requestId:createId(),projectId:project.id,operation,expectedRevision:project.revision,input});
  expect(result,JSON.stringify(result)).toMatchObject({ok:true});
  const current=core.execute('owner',{requestId:createId(),projectId:project.id,operation:'project.inspect',expectedRevision:result.revision,input:{}});if(!current.ok)throw Error(JSON.stringify(current));project=current.result as Project;
 }
 expect(core.execute('owner',{requestId:createId(),projectId:project.id,operation:'project.open',expectedRevision:1,input:{locator:'projects:runtime.json'}})).toMatchObject({ok:true});
 const list={pageId:'page-list',keyMapping:[],filterMapping:[]};
 try {
  await command('form.construct',{pageId:'page-list',kind:'Search',source:{kind:'table',id:'rows'},fieldIds:['tenant','seq','title','parent'],keyIds:[],actions:[],links:[],style:{label:'Search records'},search:[{fieldId:'title',operator:'contains'},{fieldId:'tenant',operator:'eq'},{fieldId:'parent',operator:'eq'}],sorting:[{fieldId:'seq',direction:'asc'}]});
  const parentLabel=project.controls.find(c=>c.binding?.kind==='stored'&&c.binding.fieldId==='parent')!;
  await command('project.batch',{operations:[{kind:'put',entity:'control',id:parentLabel.id,value:{...parentLabel,lookup:{source:{kind:'table',id:'parents'},valueFieldIds:['parent-id'],labelFieldId:'parents-title'}}}]});
  for(const name of ['rows','parents','ordinary','intkey','desckey']) {
   const table=project.schema.tables.find(t=>t.id===name)!;
   const target=name==='rows'?{...list,filterMapping:[{targetFieldId:'tenant',expression:{kind:'field',alias:'root',fieldId:'tenant'}}]}:list;
   await command('form.construct',{pageId:'page-'+(name==='rows'?'record':name),kind:'Record',source:{kind:'table',id:name},fieldIds:table.columns.map(c=>c.id),keyIds:table.primaryKey,actions:[],links:[],style:{label:name},actionDefinitions:['insert','update','delete','cancel'].map(operation=>({operation,...(operation==='cancel'?{destination:target}:{success:target})}))});
   const form=project.forms.at(-1)!;
   const changes:{kind:'put';entity:'form'|'control';id:string;value:Form|Control}[]=[{kind:'put',entity:'form',id:form.id,value:{...form,displayFieldIds:[table.columns.find(c=>c.physicalName==='title')!.id]}}];
   if(name==='rows') {
    const control=project.controls.find(c=>c.formId===form.id&&c.binding?.kind==='stored'&&c.binding.fieldId==='parent')!;
    changes.push({kind:'put',entity:'control',id:control.id,value:{...control,kind:'select',lookup:{source:{kind:'table',id:project.schema.tables.find(t=>t.id==='parents')!.id},valueFieldIds:[project.schema.tables.find(t=>t.id==='parents')!.primaryKey[0]!],labelFieldId:project.schema.tables.find(t=>t.id==='parents')!.columns[1]!.id}}});
   }
   await command('project.batch',{operations:changes});
  }
 } finally {await core.close();}
 const ir=compileProject(project), output=join(root,'app');
 writeInitialOutput(output,emitApplication(ir,databasePath),observeOutput(output));
 writeFileSync(join(root,'authored-project.json'),JSON.stringify(project,null,2));writeFileSync('/tmp/wp12-runtime-root.txt',root);
 const npm=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');
 const env={PATH:dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME??'',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'};
 function run(args:string[]) {const result=spawnSync(process.execPath,args,{cwd:output,env,encoding:'utf8',timeout:90000,maxBuffer:5000000});writeFileSync(join(root,args.includes('run')?args.at(-1)!+'.log':args.at(-1)!.split('/').at(-1)!+'.log'),(result.stdout??'')+(result.stderr??''));expect(result.error).toBeUndefined();expect(result.status,(result.stdout??'')+(result.stderr??'')).toBe(0);}
 run([npm,'ci','--ignore-scripts','--offline']);
 const records=ir.routes.flatMap(route=>route.records), indices=ir.routes.flatMap(route=>[...route.grids,...route.records]).map((form,index)=>({form,index}));
 const entries=records.map(record=>({table:record.source.id,index:indices.find(i=>i.form.id===record.id)!.index}));
 writeFileSync(join(output,'tests/record-behavior.mjs'),`
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {execute,load} from '../server/record-service.ts';
import {automaticKey,connect} from '../server/record-repository.ts';
import {readGrid} from '../server/repository.ts';
import {loadGrid} from '../server/grid-0.ts';
const entries=${JSON.stringify(entries)};
const configs={};for(const entry of entries)configs[entry.table]=(await import('../server/record-'+entry.index+'.ts')).config;
const db=new Database(${JSON.stringify(databasePath)}); db.defaultSafeIntegers(true);
const row=()=>db.prepare('SELECT * FROM "register "" rows" WHERE tenant=? AND seq=?').get('A',1);
const count=()=>db.prepare('SELECT count(*) FROM "register "" rows"').pluck().get();
const cfg=configs.rows,action=operation=>cfg.actions.find(a=>a.operation===operation).id;
const params={ [cfg.keyParameters[0]]:'A',[cfg.keyParameters[1]]:'1' };
const gridMeta=${JSON.stringify(ir.routes[0]!.grids[0])};
const parentControl=gridMeta.controls.find(c=>c.fieldId==='parent');
db.prepare('UPDATE "register "" rows" SET parent=1 WHERE tenant=?').run('A');
const named=loadGrid({}).rows.find(row=>row.tenant==='A');assert.equal(named.parent,1n);assert.equal(named['__lookup:'+parentControl.id],'Restricted');
assert.equal(loadGrid({[gridMeta.id+':filter:parent']:'2'}).rows.length,0);
db.prepare('UPDATE "register "" rows" SET parent=NULL WHERE tenant=?').run('A');
assert.equal(load(cfg,{[cfg.id+':mode']:'new',[gridMeta.id+':filter:parent']:'1'}).values.parent,'1');
assert.equal(load(cfg,{...params,[gridMeta.id+':filter:parent']:'2'}).values.parent,'');
assert.throws(()=>load(cfg,{[cfg.id+':mode']:'new',[gridMeta.id+':filter:parent']:'bad'}));
const input={tenant:'A',seq:'1',title:'Changed',parent:'',amount:'1000000000000000000.25'};
let result=execute(cfg,action('update'),params,{...input,seq:'invalid'});
assert.ok(result.errors.seq);assert.equal(result.values.seq,'invalid');assert.equal(row().title,'Original');assert.equal(count(),2n);
result=execute(cfg,action('update'),params,input);assert.ok(result.location);assert.equal(row().title,'Changed');assert.equal(row().amount,'1000000000000000000.25');assert.equal(row().parent,null);assert.equal(db.prepare('SELECT title FROM "register "" rows" WHERE tenant=?').get('B').title,'Other');
assert.equal(result.saved,true);
result=execute(cfg,action('update'),params,{...input,title:'Other'});assert.match(result.summary,/already exists/);assert.equal(row().title,'Changed');
result=execute(cfg,action('update'),params,{...input,parent:'999'});assert.match(result.summary,/existing related/);assert.equal(row().parent,null);
const fresh={...params,[cfg.id+':mode']:'new'};
result=execute(cfg,action('insert'),fresh,{...input,tenant:'C',seq:'4',title:'Created'});assert.ok(result.location);assert.equal(count(),3n);
result=execute(cfg,action('update'),{...params,[cfg.keyParameters[1]]:'1 OR 1=1'},input);assert.equal(result.location,undefined);assert.equal(count(),3n);
result=execute(cfg,action('update'),{...params,returnTo:'https://untrusted.invalid',source:'forged'},input);assert.equal(result.location,undefined);assert.equal(row().title,'Changed');
result=execute(cfg,action('cancel'),params,{...input,title:'Canceled'});assert.equal(new URL(result.location,'http://local').searchParams.get(${JSON.stringify(ir.routes[0]!.grids[0]!.id+':filter:tenant')}),'A');assert.equal(row().title,'Changed');
assert.equal(load(cfg,params).name,'Changed');assert.equal(load(cfg,params).options.parent.length,2);
result=execute(cfg,action('delete'),params,{},false);assert.match(result.summary,/Confirm/);assert.equal(count(),3n);
result=execute(cfg,action('delete'),params,{},true);assert.equal(new URL(result.location,'http://local').searchParams.get(${JSON.stringify(ir.routes[0]!.grids[0]!.id+':filter:tenant')}),'A');assert.equal(count(),2n);
const parent=configs.parents,paction=parent.actions.find(a=>a.operation==='delete').id;
const restricted={ [parent.keyParameters[0]]:'1' };assert.equal(load(parent,restricted).impacts[0].rule,'RESTRICT');
result=execute(parent,paction,restricted,{},true);assert.match(result.summary,/RELATED_RECORDS_EXIST/);assert.equal(db.prepare('SELECT count(*) FROM parents').pluck().get(),2n);assert.equal(db.prepare('SELECT count(*) FROM restrict_children').pluck().get(),1n);
const cascading={ [parent.keyParameters[0]]:'2' };assert.equal(load(parent,cascading).impacts[0].rule,'CASCADE');
result=execute(parent,paction,cascading,{},true);assert.equal(result.location,'/list');assert.equal(db.prepare('SELECT count(*) FROM parents').pluck().get(),1n);assert.equal(db.prepare('SELECT count(*) FROM cascade_children').pluck().get(),0n);
for(const table of ['ordinary','intkey','desckey']) {
 const config=configs[table],connection=connect();assert.equal(automaticKey(connection,config.source),table==='ordinary'?table+'-pk':undefined);connection.close();
 const insert=config.actions.find(a=>a.operation==='insert').id;
 const result=execute(config,insert,{[config.id+':mode']:'new'},{[table+'-pk']:'',[table+'-title']:'Example'});
 assert.equal(Boolean(result.location),table==='ordinary');if(table==='ordinary')assert.equal(db.prepare('SELECT flag FROM ordinary').pluck().get(),0n);assert.equal(db.prepare('SELECT count(*) FROM "'+table+'"').pluck().get(),table==='ordinary'?1n:0n);
}
const grid=${JSON.stringify(ir.routes[0]!.grids[0])};const list={table:grid.source.name,fields:grid.source.fields,search:grid.search,sorting:grid.sorting,pageSize:1};
assert.equal(readGrid(list,{[grid.id+':filter:title']:'Other'},grid.id).rows.length,1);assert.ok(readGrid(list,{[grid.id+':sort']:'title; DROP TABLE parents'},grid.id).error);assert.ok(readGrid(list,{[grid.id+':page']:'-1'},grid.id).error);assert.equal(readGrid(list,{[grid.id+':filter:title']:"' OR 1=1 --"},grid.id).rows.length,0);
assert.equal(loadGrid({[grid.id+':filter:title']:'Other'}).rows.length,1);assert.ok(loadGrid({[grid.id+':sort']:'unknown-field'}).error);assert.ok(loadGrid({[grid.id+':direction']:'sideways'}).error);
db.close();console.log('Independent Record/Search SQLite assertions passed');
`);
 run(['--conditions=react-server','tests/record-behavior.mjs']);
 for(const script of ['typecheck','test','build']) run([npm,'run',script]);
 expect(readFileSync(join(root,'build.log'),'utf8')).toContain('Compiled successfully');
},180000);
