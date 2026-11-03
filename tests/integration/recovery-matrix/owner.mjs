import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {ProjectCore} from '@schema-baron/core';
const [root,action,point=''] = process.argv.slice(2);
assert(root && root.startsWith('/tmp/baron-cross-boundary-'), 'Only harness-created disposable roots are allowed');
const fixture=JSON.parse(readFileSync(new URL('../../../fixtures/recovery/project.json',import.meta.url)));
let armed=false;
const options={ownerId:'owner',metadataRoot:join(root,'metadata'),approvedRoots:{projects:join(root,'projects'),output:join(root,'output')},fault:p=>{if(armed&&action==='save'&&p===point)process.exit(73);if(armed&&action==='migrate'&&point==='metadata-save'&&p==='metadata')process.exit(88);},migrationFault:p=>{if(armed&&action==='migrate'&&p===point)process.exit(87);},...(action==='migrate'&&['before-backup','after-backup','during-rebuild','before-db-commit','after-db-commit'].includes(point)?{migrationWorkerFault:point}:{}),generationFault:p=>{if(armed&&action==='generate'&&p===point)process.exit(91);}};
for(const directory of Object.values(options.approvedRoots))mkdirSync(directory,{recursive:true});
const core=new ProjectCore(options);
const snapshot=()=>core.snapshot('owner','p');
const command=(operation,input,requestId=crypto.randomUUID())=>({projectId:'p',requestId,operation,input,expectedRevision:existsSync(join(root,'projects/p.json'))?snapshot().revision:0});
const good=async c=>{const outcome=await core.executeAsync('owner',c);assert(outcome.ok,JSON.stringify(outcome));return outcome.result;};
const run=(operation,input)=>good(command(operation,input));
const apply=plan=>({planId:plan.id,hash:plan.hash,acknowledgedImpactIds:plan.requiredAcknowledgementIds});
const preview=()=>run('generation.preview',{target:snapshot().target,projectRevision:snapshot().revision,outputRoot:'output:app'});
if(action==='prepare'){
 mkdirSync(join(root,'secrets'));writeFileSync(join(root,'secrets/runtime.key'),crypto.randomUUID()+crypto.randomUUID(),{mode:0o600});
 const db=new Database(join(root,'projects/app.sqlite'));db.pragma('journal_mode=WAL');db.exec(fixture.sql);db.close();
 await run('project.create',{name:fixture.name,approvedRoot:'projects',target:'next-typescript-sqlite'});
 const inspection=await run('connection.inspect',{approvedPath:'projects:app.sqlite',mode:'read-only'});
 await run('connection.bind',{connectionId:inspection.connection.id,fingerprint:inspection.connection.fingerprint});
 await run('project.batch',{operations:[{kind:'put',entity:'page',id:'page',value:{id:'page',route:'/',title:'Recovery',document:[],formIds:[]}}]});
 const table=snapshot().schema.tables.find(t=>t.physicalName==='parent');
 await run('form.construct',{pageId:'page',kind:'Grid',source:{kind:'table',id:table.id},fieldIds:table.columns.map(c=>c.id),keyIds:[],actions:[],links:[],style:{label:'Parents'}});
 await run('project.batch',{operations:[{kind:'put',entity:'extension',id:'hook',value:{id:'hook',kind:'validator',version:1,relativePath:'authored/rules.ts'}}]});
 await run('generation.apply',apply(await preview()));
 const source=await run('extension.read',{extensionId:'hook',approvedPath:'output:app/authored/rules.ts'});
 await run('extension.write',{extensionId:'hook',approvedPath:'output:app/authored/rules.ts',expectedFileHash:source.hash,content:fixture.authoredComment+source.content});
}else if(action==='save'){
 const page=snapshot().pages[0];const c=command('project.batch',{operations:[{kind:'put',entity:'page',id:page.id,value:{...page,title:'Saved across hard exit'}}]},'save-retry');
 writeFileSync(join(root,'save-command.json'),JSON.stringify(c));armed=true;await good(c);assert.fail('Save fault did not run');
}else if(action==='migrate'){
 const schema=structuredClone(snapshot().schema);schema.revision++;schema.tables.find(t=>t.physicalName==='parent').columns.find(c=>c.physicalName==='title').physicalName='caption';
 await run('project.batch',{operations:[{kind:'put',entity:'schema',id:schema.id,value:schema}]});
 const plan=await run('schema.preview',{desiredSchemaRevision:schema.revision,backfills:[]});
 const c=command('schema.apply',apply(plan),'migration-retry');writeFileSync(join(root,'migration-command.json'),JSON.stringify(c));armed=true;
 const outcome=await core.executeAsync('owner',c);writeFileSync(join(root,'migration-outcome.json'),JSON.stringify(outcome));
 // Worker crashes are reported as outcomes while the owner survives.
 assert(['before-backup','after-backup','during-rebuild','before-db-commit','after-db-commit'].includes(point),'Owner fault did not run');
}else if(action==='finish-migration'){
 const blocked=await core.executeAsync('owner',command('generation.preview',{target:snapshot().target,projectRevision:snapshot().revision,outputRoot:'output:app'}));assert.equal(blocked.error?.code,'DATABASE_CHANGED');
 const plan=await run('schema.preview',{desiredSchemaRevision:snapshot().schema.revision,backfills:[]});await run('schema.apply',apply(plan));
}else if(action==='generate'){
 const plan=await preview(),c=command('generation.apply',apply(plan),'generation-retry');writeFileSync(join(root,'generation-command.json'),JSON.stringify(c));writeFileSync(join(root,'generation-point.txt'),point);armed=true;await good(c);assert.fail('Promotion fault did not run');
}else if(action==='reopen'){
 // A generation preview performs canonical promotion reconciliation before observation.
 if(existsSync(join(root,'generation-command.json')))await preview();
 const retries={};for(const name of ['save','migration','generation']){const path=join(root,name+'-command.json');if(existsSync(path)&&!(name==='generation'&&['stage-complete','before-journal-write'].includes(readFileSync(join(root,'generation-point.txt'),'utf8')))&&!(name==='migration'&&existsSync(join(root,'migration-outcome.json'))&&!JSON.parse(readFileSync(join(root,'migration-outcome.json'))).ok))retries[name]=await core.executeAsync('owner',JSON.parse(readFileSync(path)));}
 const history=await run('schema.history',{connectionId:snapshot().connections[0].id});
 let blockedMutation;
 if(history.some(entry=>entry.outcome==='recovery-pending')){const page=snapshot().pages[0];blockedMutation=await core.executeAsync('owner',command('project.batch',{operations:[{kind:'put',entity:'page',id:page.id,value:{...page,title:'Must remain blocked'}}]}));assert.equal(blockedMutation.error?.code,'RECOVERY_REQUIRED');}
 writeFileSync(join(root,'observed.json'),JSON.stringify({project:snapshot(),history,retries,recovery:core.recovery,blockedMutation},null,2));
}else throw Error('Unknown action');
await core.close();
