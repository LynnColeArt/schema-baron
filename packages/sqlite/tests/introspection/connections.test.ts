import {delayFlowDispatch} from '../../../core/tests/flow/async-fixture.js';
import { afterEach, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, existsSync, chmodSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startOwner } from '../../../../apps/studio/src/server/index.js';
import { createId } from '@schema-baron/model';
import type { Command, Project } from '@schema-baron/model';
import type { CommandEffect } from '@schema-baron/core';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); });
async function setup() {
 const root = mkdtempSync(join(tmpdir(), 'wp06-owner-')); const cap = 'connection-test-' + 'x'.repeat(40);
 const owner = await startOwner({ ownerId: 'owner', capability: cap, metadataRoot: join(root,'metadata'), approvedRoots: { projects: join(root,'definitions') } });
 cleanups.push(async () => { await owner.close(); rmSync(root, { recursive: true, force: true }); });
 const http = async (body: unknown) => { const response = await fetch(owner.url+'/api/v1/projects/p/commands', { method:'POST', headers: { authorization: 'Bearer '+cap, 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: response.status, outcome: await response.json() }; };
 const config = join(root,'mcp.json'); writeFileSync(config,JSON.stringify({ownerUrl:owner.url,capability:cap}),{mode:0o600}); const mcp = new Client({ name:'connection-parity',version:'1' }); await mcp.connect(new StdioClientTransport({command:process.execPath,args:[resolve('apps/mcp/dist/main.js')],env:{SCHEMA_BARON_MCP_CONFIG:config},stderr:'pipe'})); cleanups.push(()=>mcp.close());
 const agent = async (body: Record<string,unknown>) => { const { operation,...args } = body; return (await mcp.callTool({name:String(operation).replaceAll('.','_'),arguments:args})).structuredContent; };
 expect((await http(command('project.create',{name:'External connection',approvedRoot:'projects',target:'next-typescript-sqlite'},0))).outcome.ok).toBe(true);
 return { root,owner,http,agent,mcp, path: join(root,'definitions','external.sqlite') };
}
function command(operation: string,input: unknown,expectedRevision=1,requestId:string=crypto.randomUUID()) { return { projectId:'p',requestId,operation,expectedRevision,input }; }
function seed(path: string) { const db = new Database(path); db.pragma('journal_mode=WAL'); db.exec(`CREATE TABLE "parent \"\" name" ("first key" TEXT NOT NULL, second INTEGER NOT NULL, PRIMARY KEY("first key",second)); CREATE TABLE child (id INTEGER PRIMARY KEY, a TEXT, b INTEGER, amount DECIMAL(10,2) DEFAULT '1.00', FOREIGN KEY(a,b) REFERENCES "parent \"\" name"("first key",second)); CREATE INDEX "amount positive" ON child(amount) WHERE amount>0; CREATE TRIGGER audit AFTER INSERT ON child BEGIN UPDATE child SET amount=NEW.amount WHERE id=NEW.id; END; CREATE VIEW summary AS SELECT * FROM child; INSERT INTO "parent \"\" name" VALUES('a',1); INSERT INTO child VALUES(7,'a',1,'2.35');`); return db; }
test('real HTTP and MCP inspect/bind exact WAL schema; stale fingerprints reject and relocation preserves connection and schema identities', async () => {
 const {path,root,http,agent,mcp}=await setup(); const db=seed(path); const before={ schema:db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all(), rows:db.prepare('SELECT * FROM child').all() };
 const request=command('connection.inspect',{approvedPath:'projects:external.sqlite',mode:'read-only'}); const preview=(await http(request)).outcome; expect(preview).toMatchObject({ok:true,revision:1,result:{connection:{capabilities:{foreignKeys:true},physical:{encoding:'UTF-8'}}}}); expect(await agent(request)).toEqual(preview);
 const {connection,schema}=preview.result; expect(schema.tables.find((t: {physicalName:string})=>t.physicalName==='parent " name').primaryKey).toHaveLength(2); expect(schema.opaqueObjects.map((o:{kind:string})=>o.kind)).toEqual(expect.arrayContaining(['table','trigger','view','index'])); expect(connection.physical.objects).toEqual(before.schema);
 const bind=command('connection.bind',{connectionId:connection.id,fingerprint:connection.fingerprint}); expect(await agent(bind)).toEqual((await http(bind)).outcome); expect((await http(bind)).outcome).toMatchObject({ok:true,revision:2}); expect({schema:db.prepare('SELECT * FROM sqlite_schema ORDER BY name').all(),rows:db.prepare('SELECT * FROM child').all()}).toEqual(before);
 const bound=(await http(command('project.inspect',{},2))).outcome.result; db.exec('CREATE TABLE external_change (id INTEGER)');
 const second=(await http(command('connection.inspect',{approvedPath:'projects:external.sqlite',mode:'read-only',connectionId:connection.id},2))).outcome.result; db.exec('CREATE TABLE later_change (id INTEGER)');
 const stale=command('connection.bind',{connectionId:second.connection.id,fingerprint:second.connection.fingerprint},2); expect((await http(stale)).outcome).toMatchObject({ok:false,error:{code:'DATABASE_CHANGED'}}); expect(await agent(stale)).toEqual((await http(stale)).outcome);
 db.close(); renameSync(path,join(root,'definitions','relocated.sqlite'));
 const missing=command('connection.inspect',{approvedPath:'projects:external.sqlite',mode:'read-only'},2); expect((await http(missing)).outcome).toMatchObject({error:{code:'NOT_FOUND'}}); expect(existsSync(path)).toBe(false);
 const relocated=(await agent(command('connection.inspect',{approvedPath:'projects:relocated.sqlite',mode:'read-only',connectionId:connection.id},2))) as {result:{connection:{id:string;fingerprint:string}}}; const rebind=command('connection.bind',{connectionId:relocated.result.connection.id,fingerprint:relocated.result.connection.fingerprint},2); expect((await http(rebind)).outcome).toMatchObject({ok:true,revision:3});
 const after=(await http(command('project.inspect',{},3))).outcome.result as Project; expect(after.connections[0]!.id).toBe(bound.connections[0].id); expect(after.connections[0]!.locator.relativePath).toBe('relocated.sqlite'); expect(after.schema.tables.find(t=>t.physicalName==='child')?.id).toBe(bound.schema.tables.find((t:{physicalName:string})=>t.physicalName==='child').id);
 expect((await mcp.listTools()).tools.map(t=>t.name)).toContain('connection_inspect'); const check=new Database(join(root,'definitions','relocated.sqlite'),{readonly:true}); expect(check.prepare('SELECT * FROM child').all()).toEqual(before.rows); check.close();
});
test('missing, corrupt, permissions, locks, escapes, aliases and explicit empty creation share safe transport failures', async () => {
 const { root,path,http,agent }=await setup(); const db=seed(path);
 writeFileSync(join(root,'definitions','corrupt.sqlite'),'not sqlite'); writeFileSync(join(root,'definitions','denied.sqlite'),''); chmodSync(join(root,'definitions','denied.sqlite'),0); symlinkSync(path,join(root,'definitions','alias.sqlite'));
 const cases=[['projects:missing.sqlite','NOT_FOUND'],['projects:corrupt.sqlite','UNSUPPORTED_FORMAT'],['projects:denied.sqlite','ACCESS_DENIED'],['projects:../outside.sqlite','PATH_OUTSIDE_ROOT'],['projects:alias.sqlite','PATH_OUTSIDE_ROOT'],['unknown:file','PATH_OUTSIDE_ROOT'],['projects:p.json','PATH_OUTSIDE_ROOT']];
 for(const [approvedPath,code] of cases) { const request=command('connection.inspect',{approvedPath,mode:'read-only'}); const response=await http(request); expect(response.outcome).toMatchObject({ok:false,error:{code}}); expect(await agent(request)).toEqual(response.outcome); }
 expect(existsSync(join(root,'definitions','missing.sqlite'))).toBe(false);
 const locked=join(root,'definitions','locked.sqlite'); const lock=new Database(locked); lock.exec('CREATE TABLE locked(id INTEGER); BEGIN EXCLUSIVE'); const lockRequest=command('connection.inspect',{approvedPath:'projects:locked.sqlite',mode:'read-only'}); expect((await http(lockRequest)).outcome).toMatchObject({error:{code:'PROJECT_BUSY'}}); expect(await agent(lockRequest)).toEqual((await http(lockRequest)).outcome); lock.exec('ROLLBACK'); lock.close();
 const emptyRequest=command('connection.inspect',{approvedPath:'projects:new.sqlite',mode:'read-only',createEmpty:true}); const empty=await http(emptyRequest); expect(empty.outcome).toMatchObject({ok:true,result:{schema:{tables:[]}}}); expect(await agent(emptyRequest)).toEqual(empty.outcome);
 expect((await http(command('connection.inspect',{approvedPath:'projects:new.sqlite',mode:'read-only',createEmpty:true}))).outcome).toMatchObject({error:{code:'OUTPUT_CONFLICT'}});
 db.close();
});
test('awaited effects revalidate revision and matching/conflicting idempotency while synchronous commands continue', async () => {
 const {owner,http}=await setup(); const releases: (()=>void)[]=[]; const started: (()=>void)[]=[];
 delayFlowDispatch(owner.service.core.registry,async (_command,snapshot)=> { await new Promise<void>(resolve=>{releases.push(resolve); started.shift()?.();}); const candidate=structuredClone(snapshot!); candidate.revision++; candidate.name='async effect'; return {result:{nodes:[],edges:[],endpoints:[],diagnostics:[]},candidate} as CommandEffect; });
 const waitStart=()=>new Promise<void>(resolve=>started.push(resolve));
 const request=command('flow.inspect',{projection:'schema'},1,'overlap'); const start=waitStart(); const pending=http(request); await start;
 expect((await http(command('project.batch',{operations:[{kind:'put',entity:'page',id:'page',value:{id:'page',route:'/page',title:'During worker',document:[],formIds:[]}}]},1))).outcome).toMatchObject({ok:true,revision:2}); releases.shift()!(); expect((await pending).outcome).toMatchObject({ok:false,error:{code:'REVISION_CONFLICT'}});
 const same=command('flow.inspect',{projection:'schema'},2,'same-key'); const aStart=waitStart(); const a=http(same); await aStart; const b=http(same); releases.shift()!(); const outcome=(await a).outcome; expect((await b).outcome).toEqual(outcome); expect(outcome).toMatchObject({ok:true,revision:3});
 const conflicting=command('flow.inspect',{projection:'schema'},3,'conflict-key'); const cStart=waitStart(); const c=http(conflicting); await cStart; const d=http({...conflicting,input:{projection:'application'}}); expect((await d).outcome).toMatchObject({error:{code:'IDEMPOTENCY_CONFLICT'}}); releases.shift()!(); expect((await c).outcome).toMatchObject({ok:true,revision:4});
 expect(owner.service.core.snapshot('owner','p')).toMatchObject({revision:4,pages:[{id:'page',title:'During worker'}]});
});
test('owner close rejects delayed asynchronous finalization and reopening sees only the committed snapshot',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp06-close-')); const {ProjectCore}=await import('@schema-baron/core'); const options={ownerId:'owner',metadataRoot:join(root,'metadata'),approvedRoots:{projects:join(root,'definitions')}}; const core=new ProjectCore(options);
 core.execute('owner',command('project.create',{name:'Before close',approvedRoot:'projects',target:'next-typescript-sqlite'},0));
 let release!:()=>void;let began!:()=>void;const started=new Promise<void>(resolve=>{began=resolve;});delayFlowDispatch(core.registry,async(_command,project)=>{await new Promise<void>(resolve=>{release=resolve;began();});return {result:{nodes:[],edges:[],endpoints:[],diagnostics:[]},candidate:{...project!,name:'Late forbidden commit',revision:2}};});
 const pending=core.executeAsync('owner',command('flow.inspect',{projection:'schema'}));await started;await core.close();release();expect(await pending).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});const reopened=new ProjectCore(options);expect(reopened.snapshot('owner','p')).toMatchObject({name:'Before close',revision:1});await reopened.close();rmSync(root,{recursive:true,force:true});
});
test('actual awaited connection inspect and bind cannot finalize across a synchronous project revision',async()=>{
 const {owner,path,http}=await setup();const db=seed(path);const core=owner.service.core;
 const pending=core.executeAsync('owner',command('connection.inspect',{approvedPath:'projects:external.sqlite',mode:'read-only'}));
 const change=(revision:number,id:string)=>core.execute('owner',command('project.batch',{operations:[{kind:'put',entity:'page',id,value:{id,route:'/'+id,title:id,document:[],formIds:[]}}]},revision));
 expect(change(1,'during-inspect')).toMatchObject({ok:true,revision:2});expect(await pending).toMatchObject({error:{code:'REVISION_CONFLICT'}});
 const preview=(await http(command('connection.inspect',{approvedPath:'projects:external.sqlite',mode:'read-only'},2))).outcome.result;
 const binding=core.executeAsync('owner',command('connection.bind',{connectionId:preview.connection.id,fingerprint:preview.connection.fingerprint},2));expect(change(2,'during-bind')).toMatchObject({ok:true,revision:3});expect(await binding).toMatchObject({error:{code:'REVISION_CONFLICT'}});expect(core.snapshot('owner','p').connections).toEqual([]);expect(db.prepare('SELECT * FROM child').all()).toEqual([{id:7,a:'a',b:1,amount:2.35}]);db.close();
});
test('actual HTTP and MCP duplicates share one createEmpty execution and conflicting transport payloads create no extra file', async () => {
 const { root, owner, http, agent } = await setup();
 const request = command('connection.inspect', { approvedPath: 'projects:transport-once.sqlite', mode: 'read-only', createEmpty: true }, 1, 'transport-once');
 const first = owner.service.core.executeAsync('owner', request);
 const [result, browser, mcp] = await Promise.all([first, http(request), agent(request)]);
 expect(result).toMatchObject({ ok: true, revision: 1 }); expect(browser.outcome).toEqual(result); expect(mcp).toEqual(result);
 const conflict = { ...request, input: { ...request.input as object, approvedPath: 'projects:transport-rejected.sqlite' } };
 expect((await http(conflict)).outcome).toMatchObject({ error: { code: 'IDEMPOTENCY_CONFLICT' } }); expect(await agent(conflict)).toEqual((await http(conflict)).outcome);
 expect(existsSync(join(root, 'definitions', 'transport-once.sqlite'))).toBe(true); expect(existsSync(join(root, 'definitions', 'transport-rejected.sqlite'))).toBe(false);
 expect(owner.service.core.snapshot('owner', 'p')).toMatchObject({ revision: 1, connections: [] }); expect(owner.service.core.operation('owner', 'p', 'transport-once')).toMatchObject({ outcome: 'committed', baseRevision: 1 });
});
