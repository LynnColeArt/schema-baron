import {test, expect} from 'vitest';
import {fixture} from './fixture.js';
import {existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {hash} from '@schema-baron/storage';

test('reviewer: externally created reserved namespace during online backup is never adopted', async () => {
 const f = await fixture(`CREATE TABLE parent(id INTEGER PRIMARY KEY,title TEXT NOT NULL); WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<100000) INSERT INTO parent SELECT x,printf('%0500d',x) FROM n`);
 try {
  const before={columns:f.db.pragma('table_info(parent)'),rows:f.db.prepare('SELECT count(*) AS n, min(id) AS first,max(id) AS last FROM parent').get()};
  const applying = f.run('schema.apply',f.apply,3);
  const directory=join(f.root,'projects','.schema-baron-backups',hash('p'));
  let installed=false;
  for(let i=0;i<10000;i++) {
   if(existsSync(directory) && readdirSync(directory).some(n=>n.endsWith('.sqlite'))) {
    try {
     f.db.exec('CREATE TABLE "__schema_baron_migrations" (id TEXT PRIMARY KEY NOT NULL, plan_hash TEXT NOT NULL, committed_at TEXT NOT NULL, schema_hash TEXT NOT NULL)');
     installed=true;break;
    } catch(error) { if(!String(error).includes('locked')) throw error; }
   }
   await new Promise(resolve=>setTimeout(resolve,1));
  }
  expect(installed).toBe(true);
  const result=await applying;
  const columns=f.db.pragma('table_info(parent)') as {name:string}[];
  const markers=f.db.prepare('SELECT * FROM __schema_baron_migrations').all();
  await f.restart();
  const blocked=await f.run('schema.preview',{desiredSchemaRevision:f.core.snapshot('owner','p').schema.revision,backfills:[]},3);
  const history=await f.run('schema.history',{connectionId:f.core.snapshot('owner','p').connections[0]!.id},3);
  console.log(JSON.stringify({before,result,after:{columns:columns.map(c=>c.name),rows:f.db.prepare('SELECT count(*) AS n, min(id) AS first,max(id) AS last FROM parent').get(),markerSQL:f.db.prepare("SELECT sql FROM sqlite_schema WHERE name='__schema_baron_migrations'").get(),markerRows:markers.length,authority:f.db.prepare("SELECT count(*) AS n FROM __schema_baron_migrations WHERE id='@authority'").get(),revision:f.core.snapshot('owner','p').revision},restartHistory:history,blockedAfterRestart:blocked}));
  expect(columns.map(c=>c.name)).toContain('title');
  expect(markers).toEqual([]);
 } finally {await f.close();}
});
