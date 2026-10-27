import { test,expect } from 'vitest';
import { mkdtempSync,mkdirSync,readFileSync,writeFileSync,symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { ProjectCore } from '../../src/index.js';
import { IdentityStore,managedIdentityPath } from '@schema-baron/generator';
import { createId } from '@schema-baron/model';
import { hash } from '@schema-baron/storage';
test('mapped provisioning uses explicit compatible physical fields, retains transient safety, and rejects changed sources',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp13-mapped-')),data=join(root,'data'),definitions=join(root,'definitions');mkdirSync(data);mkdirSync(definitions);
 const database=join(data,'separate.sqlite');let db=new Database(database);
 db.exec('CREATE TABLE "accounts \' mapped"("opaque id" TEXT PRIMARY KEY NOT NULL,"account label" TEXT NOT NULL UNIQUE,"encoded credential" TEXT NOT NULL,other TEXT); CREATE TABLE legacy(id INTEGER PRIMARY KEY,username TEXT,password TEXT);');db.close();
 const options={ownerId:'owner',metadataRoot:join(root,'metadata'),approvedRoots:{projects:definitions,data}};
 let core=new ProjectCore(options),revision=0;
 const command=(operation:string,input:unknown,requestId:string=createId())=>({operation,input,requestId,projectId:'mapped-project',expectedRevision:revision});
 const run=async(operation:string,input:unknown)=>{const result=await core.executeAsync('owner',command(operation,input));expect(result,JSON.stringify(result)).toMatchObject({ok:true});if(!result.ok)throw Error('Command failed');revision=result.revision;return result.result;};
 try {
  await run('project.create',{name:'Mapped identity',approvedRoot:'projects',target:'next-typescript-sqlite'});
  const inspected=await run('connection.inspect',{mode:'read-only',approvedPath:'data:separate.sqlite'}) as {connection:{id:string;fingerprint:string}};
  await run('connection.bind',{connectionId:inspected.connection.id,fingerprint:inspected.connection.fingerprint});
  const table=core.snapshot('owner','mapped-project').schema.tables.find(t=>t.physicalName.startsWith('accounts'))!;
  const identity={kind:'mapped',tableId:table.id,userIdColumnId:table.columns[0]!.id,usernameColumnId:table.columns[1]!.id,passwordHashColumnId:table.columns[2]!.id};
  expect(await core.executeAsync('owner',command('identity.configure',{...identity,usernameColumnId:identity.userIdColumnId}))).toMatchObject({error:{code:'INVALID_INPUT'}});
  await run('identity.configure',identity);
  const password=crypto.randomUUID(),username=crypto.randomUUID(),input={identitySourceRef:table.id,username,password},provision=command('identity.provision',input);
  expect(await core.executeAsync('intruder',provision)).toMatchObject({error:{code:'ACCESS_DENIED'}});
  const pending=core.executeAsync('owner',provision),replay=core.executeAsync('owner',provision);const first=await pending;expect(await replay).toEqual(first);expect(first).toMatchObject({ok:true});
  const record=core.operation('owner','mapped-project',provision.requestId) as {payloadHash:string};expect(record.payloadHash).not.toBe(hash(provision));
  db=new Database(database);const rows=db.prepare('SELECT * FROM "accounts \' mapped"').all() as Record<string,string>[];expect(rows).toHaveLength(1);expect(rows[0]!['encoded credential']).toMatch(/^scrypt\$1\$/);expect(JSON.stringify(rows)).not.toContain(password);db.close();
  const store=new IdentityStore(managedIdentityPath(database,'mapped-project'),'mapped-project',{table:table.physicalName,id:'opaque id',username:'account label',password:'encoded credential'},database);
  const session=await store.login(username,password,undefined,'test');expect(store.session(session.token)).toMatchObject({user:rows[0]!['opaque id']});store.close();
  for(const body of [JSON.stringify(core.snapshot('owner','mapped-project')),JSON.stringify(record),JSON.stringify(core.events('owner','mapped-project',0)),readFileSync(join(definitions,'mapped-project.json'),'utf8')])expect(body).not.toContain(password);
  await core.close();core=new ProjectCore(options);
  expect(await core.executeAsync('owner',provision)).toMatchObject({error:{code:'IDEMPOTENCY_CONFLICT'}});
  const original=database+'.original';const {renameSync}=await import('node:fs');renameSync(database,original);db=new Database(database);db.exec('CREATE TABLE replacement(id INTEGER PRIMARY KEY)');db.close();
  expect(await core.executeAsync('owner',command('identity.provision',{...input,username:username+'new'}))).toMatchObject({error:{code:'DATABASE_CHANGED'}});
 }finally{await core.close();}
});
test('identity session hashes, project isolation, expiry, fixed-cost incompatible hashes and file alias checks',async()=>{
 const root=mkdtempSync(join(tmpdir(),'wp13-sessions-')),path=join(root,'identity.sqlite');
 const a=new IdentityStore(path,'one'),b=new IdentityStore(path,'two');
 try {
  const secret=crypto.randomUUID();await a.provision('account',secret,'create-one');await b.provision('account',secret,'create-two');
  const first=await a.login('account',secret,undefined,'ip',1000,20);expect(a.session(first.token,1010)).toBeDefined();expect(a.session(first.token,1020)).toBeUndefined();expect(b.session(first.token,1010)).toBeUndefined();
  const second=await a.login('account',secret,first.token,'ip',1010);expect(a.session(first.token,1011)).toBeUndefined();expect(a.session(second.token,1011)).toBeDefined();a.logout(second.token);expect(a.session(second.token,1011)).toBeUndefined();
  const db=new Database(path);db.prepare('UPDATE identities SET password=? WHERE project=?').run('plaintext legacy','one');db.close();expect(await a.login('account','plaintext legacy',undefined,'ip').catch(e=>(e as Error).message)).toBe('Sign in failed. Try again later.');
  const unrelated=join(root,'unrelated.sqlite'),unrelatedDb=new Database(unrelated);unrelatedDb.exec('CREATE TABLE preserve_me(value TEXT); INSERT INTO preserve_me VALUES(\'keep\');');unrelatedDb.close();const before=readFileSync(unrelated);expect(()=>new IdentityStore(unrelated,'one')).toThrow('unrelated');expect(readFileSync(unrelated)).toEqual(before);
  const broken=join(root,'broken.sqlite');symlinkSync(join(root,'missing-target.sqlite'),broken);expect(()=>new IdentityStore(broken,'one')).toThrow('alias');
  const alias=join(root,'alias.sqlite');symlinkSync(path,alias);expect(()=>new IdentityStore(alias,'one')).toThrow('alias');
  const safe=join(root,'safe.sqlite');writeFileSync(safe,'');symlinkSync(path,safe+'-wal');expect(()=>new IdentityStore(safe,'one')).toThrow('alias');
 }finally{a.close();b.close();}
});
