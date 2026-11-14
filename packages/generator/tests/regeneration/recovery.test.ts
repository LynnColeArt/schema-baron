import Database from 'better-sqlite3';
import {afterEach,expect,test} from 'vitest';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {recoverPromotion,promotionPending} from '../../src/promotion/index.js';
const roots:string[]=[];afterEach(()=>roots.splice(0).forEach(p=>rmSync(p,{recursive:true,force:true})));
const phases=['stage-complete','before-journal-write','after-journal-write','before-old-rename','after-old-rename','before-new-rename','after-new-rename','before-journal-clear','after-journal-clear'];
for(const phase of phases)test('hard process exit at '+phase+' retains complete old/new source and recovers',()=>{
 const root=mkdtempSync(join(tmpdir(),'wp20-hard-exit-'));roots.push(root);const output=join(root,'app');mkdirSync(output);writeFileSync(join(output,'owned.ts'),'old');const database=join(root,'external.sqlite'),db=new Database(database);db.exec("CREATE TABLE evidence(id INTEGER PRIMARY KEY,value TEXT NOT NULL);INSERT INTO evidence VALUES(1,'preserved')");db.close();const databaseBefore=readFileSync(database);
 const module=pathToFileURL(resolve('packages/generator/dist/index.js')).href;
 const script=`import {promoteSource,scanSource} from ${JSON.stringify(module)};promoteSource(${JSON.stringify(output)},[{path:'owned.ts',content:'new'},{path:'authored/hooks.ts',content:'authored'}],scanSource(${JSON.stringify(output)}).fingerprint,()=>{},phase=>{if(phase===${JSON.stringify(phase)})process.exit(91)});`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'});expect(child.status,child.stderr).toBe(91);
 if(promotionPending(output))expect(recoverPromotion(output).recovered).toBe(true);
 const after=readFileSync(join(output,'owned.ts'),'utf8');expect(after).toBe(['stage-complete','before-journal-write'].includes(phase)?'old':'new');
 expect(readFileSync(database)).toEqual(databaseBefore);const oracle=new Database(database,{readonly:true});try{expect(oracle.prepare('SELECT * FROM evidence').all()).toEqual([{id:1,value:'preserved'}]);}finally{oracle.close();}
 if(after==='new'){expect(readFileSync(join(output,'authored/hooks.ts'),'utf8')).toBe('authored');const backups=readdirSync(root).filter(n=>n.startsWith('.schema-baron-backup-'));expect(backups).toHaveLength(1);expect(readFileSync(join(root,backups[0]!,'owned.ts'),'utf8')).toBe('old');}
 expect(recoverPromotion(output)).toEqual({recovered:false});
});
test('changed staged/backup source after interruption is preserved and recovery refuses',()=>{
 const root=mkdtempSync(join(tmpdir(),'wp20-hard-conflict-'));roots.push(root);const output=join(root,'app');mkdirSync(output);writeFileSync(join(output,'owned.ts'),'old');
 const module=pathToFileURL(resolve('packages/generator/dist/index.js')).href;
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {promoteSource,scanSource} from ${JSON.stringify(module)};promoteSource(${JSON.stringify(output)},[{path:'owned.ts',content:'new'}],scanSource(${JSON.stringify(output)}).fingerprint,()=>{},p=>{if(p==='after-old-rename')process.exit(91)});`]);expect(child.status).toBe(91);
 const backup=readdirSync(root).find(n=>n.startsWith('.schema-baron-backup-'))!;writeFileSync(join(root,backup,'unknown'),'preserve me');expect(()=>recoverPromotion(output)).toThrow(/changed/);expect(readFileSync(join(root,backup,'unknown'),'utf8')).toBe('preserve me');
});
