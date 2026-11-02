import {expect,test} from 'vitest';
import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {runChild,EvidenceJournal} from '../../contracts/parity/harness.js';

const evidence=resolve(process.env.SCHEMA_BARON_RECOVERY_EVIDENCE??'docs/evidence/recovery');
const savePoints=['intent','metadata','replacement','cleanup'];
const migrationPoints=['before-backup','after-backup','during-rebuild','before-db-commit','after-db-commit','before-reconcile','after-reconcile','metadata-save','before-reconcile'];
const generationPoints=['stage-complete','before-journal-write','after-journal-write','before-old-rename','after-old-rename','before-new-rename','after-new-rename','before-journal-clear','after-journal-clear'];
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
function tree(root:string):Record<string,string>{return Object.fromEntries(readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?Object.entries(tree(join(root,entry.name))).map(([path,hash])=>[entry.name+'/'+path,hash]):[[entry.name,sha(readFileSync(join(root,entry.name)))]]).sort(([a],[b])=>a!.localeCompare(b!)));}
// Business values and physical constraints remain authoritative even with uncheckpointed WAL.
function durableDatabase(path:string) {
 const db=new Database(path,{readonly:true});
 try{return {parent:db.prepare('SELECT * FROM parent ORDER BY id').all(),child:db.prepare('SELECT * FROM child ORDER BY id').all(),schema:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),foreignKeys:db.pragma('foreign_key_check'),integrity:db.pragma('integrity_check')};}finally{db.close();}
}
async function child(root:string,action:string,point=''){
 const args=[resolve('tests/integration/recovery-matrix/owner.mjs'),root,action,point];
 const workerFault=action==='migrate'&&['before-backup','after-backup','during-rebuild','before-db-commit','after-db-commit'].includes(point);
 const result=await runChild(workerFault?'strace':process.execPath,workerFault?['-f','-e','trace=process','-o',join(root,'worker-process.trace'),process.execPath,...args]:args,{cwd:process.cwd(),timeoutMs:25000});
 expect(result.timedOut).toBe(false);expect(result.signal).toBeNull();expect(result.stderr).toBe('');return result;
}
for(const [i,generation] of generationPoints.entries())test(`save → WAL migration → promotion hard restart ${generation}`,async()=>{
 const root=mkdtempSync(join(tmpdir(),'baron-cross-boundary-')),journal=new EvidenceJournal(evidence,`boundary-${i}`);
 const migration=migrationPoints[i]!,save=savePoints[i%savePoints.length]!;
 journal.begin({save,migration,generation,node:process.version,platform:process.platform});
 try{
  expect((await child(root,'prepare')).status).toBe(0);
  const externalSecretHash=sha(readFileSync(join(root,'secrets/runtime.key')));
  const oldTree=tree(join(root,'output/app')),authored=readFileSync(join(root,'output/app/authored/rules.ts'));
  journal.observed({phase:'prepared',tree:oldTree,databaseHash:sha(readFileSync(join(root,'projects/app.sqlite')))});
  expect((await child(root,'save',save)).status).toBe(73);
  const interrupted=new Database(join(root,'metadata/metadata.sqlite'),{readonly:true});
  try{const entries=interrupted.prepare('SELECT snapshot FROM journal').all() as {snapshot:string}[];expect(entries).toHaveLength(1);journal.observed({phase:'save-before-restart',journalEntries:entries.length,targetRevision:JSON.parse(entries[0]!.snapshot).revision,definitionHash:sha(readFileSync(join(root,'projects/p.json')))});}finally{interrupted.close();}
  expect((await child(root,'reopen')).status).toBe(0);
  let observed=JSON.parse(readFileSync(join(root,'observed.json'),'utf8'));
  expect(observed.project.pages[0].title).toBe('Saved across hard exit');expect(observed.retries.save.ok).toBe(true);
  const migrationChild=await child(root,'migrate',migration);expect(migrationChild.status).toBe(i<5?0:migration==='metadata-save'?88:87);
  if(i<5){const trace=readFileSync(join(root,'worker-process.trace'),'utf8');expect(trace).toMatch(/exited with 86/);writeFileSync(join(evidence,'worker-'+migration+'.trace'),trace);journal.observed({phase:'worker-termination',workerExitCode:86,trace:'worker-'+migration+'.trace'});}
  expect((await child(root,'reopen')).status).toBe(0);
  observed=JSON.parse(readFileSync(join(root,'observed.json'),'utf8'));
  const committed=i>=4,db=new Database(join(root,'projects/app.sqlite'));
  let oracle:Record<string,unknown>;
  try{
   expect(db.pragma('journal_mode',{simple:true})).toBe('wal');
   const rows=db.prepare('SELECT * FROM parent').all(),children=db.prepare('SELECT * FROM child').all(),indexes=db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='index' AND name='title_lookup'").all();
   expect(rows).toEqual(committed?[{id:1,caption:'original'}]:[{id:1,title:'original'}]);expect(children).toEqual([{id:9,parent_id:1}]);
   expect(indexes).toHaveLength(1);expect(JSON.stringify(indexes)).toContain(committed?'caption':'title');
   expect(db.pragma('foreign_key_list(child)')).toMatchObject([{table:'parent',from:'parent_id',to:'id'}]);db.pragma('foreign_keys=ON');
   expect(()=>db.prepare('INSERT INTO child VALUES(10,999)').run()).toThrow(/FOREIGN KEY/);expect(()=>db.prepare('INSERT INTO child VALUES(-1,1)').run()).toThrow(/CHECK/);expect(()=>db.prepare('INSERT INTO parent VALUES(2,NULL)').run()).toThrow(/NOT NULL/);
   expect(db.pragma('foreign_key_check')).toEqual([]);expect(db.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);
   expect(db.prepare("SELECT sql FROM sqlite_schema WHERE name='child'").get()).toEqual({sql:expect.stringContaining('CHECK')});
   expect(observed.history).toHaveLength(1);expect(observed.history[0].outcome).toBe(committed?'committed':'rolled-back');
   const marker=db.prepare("SELECT name FROM sqlite_schema WHERE name='__schema_baron_migrations'").get();
   if(committed){expect(db.prepare("SELECT count(*) AS n FROM __schema_baron_migrations WHERE id!='@authority'").get()).toEqual({n:1});expect(observed.retries.migration).toMatchObject({ok:true,result:{committed:true}});}
   else expect(marker).toBeUndefined();
   oracle={rows,children,indexes,constraintRejections:['foreign-key','check','not-null'],foreignKeyDefinition:db.pragma('foreign_key_list(child)'),foreignKeys:db.pragma('foreign_key_check'),integrity:db.pragma('integrity_check'),markerPresent:!!marker,history:observed.history.map(({outcome,backupValidated}:{outcome:string;backupValidated:boolean})=>({outcome,backupValidated}))};
  }finally{db.close();}
  if(observed.history[0].backupValidated){
   const base=join(root,'projects/.schema-baron-backups'),relative=readdirSync(base,{recursive:true,encoding:'utf8'}).find(path=>path.endsWith(observed.history[0].backupRef+'.sqlite'));expect(relative).toBeDefined();
   const backup=new Database(join(base,relative!),{readonly:true});
   try{expect(backup.prepare('SELECT * FROM parent').all()).toEqual([{id:1,title:'original'}]);expect(backup.prepare('SELECT * FROM child').all()).toEqual([{id:9,parent_id:1}]);expect(backup.pragma('foreign_key_check')).toEqual([]);expect(backup.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);oracle.backup={hash:sha(readFileSync(join(base,relative!))),parentRows:backup.prepare('SELECT * FROM parent').all(),childRows:backup.prepare('SELECT * FROM child').all()};}finally{backup.close();}
  }
  journal.observed({phase:'migration-reconciled',oracle});
  if(!committed)expect((await child(root,'finish-migration')).status).toBe(0);
  const databaseBefore=sha(readFileSync(join(root,'projects/app.sqlite'))),durableBefore=durableDatabase(join(root,'projects/app.sqlite'));
  const projectBefore=JSON.parse(readFileSync(join(root,'projects/p.json'),'utf8'));
  expect((await child(root,'generate',generation)).status).toBe(91);
  expect((await child(root,'reopen')).status).toBe(0);
  observed=JSON.parse(readFileSync(join(root,'observed.json'),'utf8'));
  const activeTree=tree(join(root,'output/app'));
  expect(durableDatabase(join(root,'projects/app.sqlite'))).toEqual(durableBefore);
  expect(observed.project).toEqual(projectBefore);
  expect(readFileSync(join(root,'output/app/authored/rules.ts'))).toEqual(authored);
  expect(sha(readFileSync(join(root,'projects/app.sqlite')))).toBe(databaseBefore);expect(sha(readFileSync(join(root,'secrets/runtime.key')))).toBe(externalSecretHash);
  if(i<2){expect(activeTree).toEqual(oldTree);expect(observed.retries.generation).toBeUndefined();}
  else{
   expect(observed.retries.generation).toMatchObject({ok:true,result:{committed:true}});
   const backups=readdirSync(join(root,'output')).filter(name=>name.startsWith('.schema-baron-backup-'));
   expect(backups).toHaveLength(1);expect(tree(join(root,'output',backups[0]!))).toEqual(oldTree);
   expect(Object.keys(activeTree)).toEqual(Object.keys(oldTree));expect(activeTree).not.toEqual(oldTree);
  }
  const metadata=new Database(join(root,'metadata/metadata.sqlite'),{readonly:true});
  try{expect(metadata.prepare('SELECT count(*) AS n FROM journal').get()).toEqual({n:0});expect(JSON.parse((metadata.prepare("SELECT snapshot FROM projects WHERE id='p'").get() as {snapshot:string}).snapshot)).toEqual(observed.project);expect(JSON.parse(readFileSync(join(root,'projects/p.json'),'utf8'))).toEqual(observed.project);}
  finally{metadata.close();}
  journal.observed({phase:'restarted',exit:{save:73,migration:migrationChild.status,generation:91},revision:observed.project.revision,oracle,activeTree,oldTree,externalSecretPreserved:true,durableBefore,durableAfter:durableDatabase(join(root,'projects/app.sqlite')),databaseBefore,databaseAfter:sha(readFileSync(join(root,'projects/app.sqlite')))});
  const stableProject=observed.project;expect((await child(root,'reopen')).status).toBe(0);expect(JSON.parse(readFileSync(join(root,'observed.json'),'utf8')).project).toEqual(stableProject);expect(tree(join(root,'output/app'))).toEqual(activeTree);expect(durableDatabase(join(root,'projects/app.sqlite'))).toEqual(durableBefore);
  journal.succeed();
 }catch(error){journal.fail(error);throw error;}finally{rmSync(root,{recursive:true,force:true});journal.cleanup({disposableRootRemoved:!existsSync(root)});}
},120000);

test('external schema changes after committed owner exit block recovery and preserve both states',async()=>{
 const root=mkdtempSync(join(tmpdir(),'baron-cross-boundary-')),journal=new EvidenceJournal(evidence,'external-after-crash');
 try{
  journal.begin({point:'before-reconcile',externalMutation:true});
  expect((await child(root,'prepare')).status).toBe(0);expect((await child(root,'migrate','before-reconcile')).status).toBe(87);
  const db=new Database(join(root,'projects/app.sqlite'));
  try{db.exec('CREATE TABLE outside_change(id INTEGER PRIMARY KEY);INSERT INTO outside_change VALUES(42)');}finally{db.close();}
  expect((await child(root,'reopen')).status).toBe(0);
  const observed=JSON.parse(readFileSync(join(root,'observed.json'),'utf8'));
  expect(observed.history).toMatchObject([{outcome:'recovery-pending'}]);expect(observed.blockedMutation).toMatchObject({ok:false,error:{code:'RECOVERY_REQUIRED'}});
  expect(observed.retries.migration).toMatchObject({ok:true,result:{committed:true,recoveryRequired:true}});
  const oracle=new Database(join(root,'projects/app.sqlite'),{readonly:true});
  try{expect(oracle.prepare('SELECT * FROM outside_change').all()).toEqual([{id:42}]);expect(oracle.prepare('SELECT * FROM parent').all()).toEqual([{id:1,caption:'original'}]);expect(oracle.pragma('foreign_key_check')).toEqual([]);journal.observed({history:'recovery-pending',committedRows:oracle.prepare('SELECT * FROM parent').all(),externalRows:oracle.prepare('SELECT * FROM outside_change').all()});}finally{oracle.close();}
  journal.succeed();
 }catch(error){journal.fail(error);throw error;}finally{rmSync(root,{recursive:true,force:true});}
},60000);
