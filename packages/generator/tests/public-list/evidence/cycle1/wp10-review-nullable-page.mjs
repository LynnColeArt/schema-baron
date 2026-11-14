import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,symlinkSync,renameSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import Database from '/tmp/wp10-browser-bn2O50/output/instruments/node_modules/better-sqlite3/lib/index.js';
import {compileProject,emitApplication} from '/home/lynn/projects/schema-baron/.worktrees/schema-baron-studio-01M5W3Q9-lane-j/packages/generator/dist/index.js';
const project=JSON.parse(readFileSync('/tmp/wp10-browser-bn2O50/definitions/'+JSON.parse(readFileSync('/tmp/wp10-browser-bn2O50/demonstration.json')).applications[0].projectId+'.json','utf8'));
const field=project.schema.tables[0].columns[1];field.type={kind:'decimal',scale:2,precision:38,encoding:'text',rounding:'half-up'};field.nullable=true;
project.forms[0].search=[{fieldId:field.id,operator:'gte'}];project.forms[0].sorting=[];
const ir=compileProject(project);const root=mkdtempSync('/tmp/wp10-review-nullable-'),dbPath=join(root,'data.sqlite'),output=join(root,'output');
const db=new Database(dbPath);db.exec('CREATE TABLE "instrument register"(code TEXT PRIMARY KEY,description TEXT)');const insert=db.prepare('INSERT INTO "instrument register" VALUES(?,?)');insert.run('a','1000000000000000000.25');insert.run('b','9.75');insert.run('c',null);db.close();
for(const f of emitApplication(ir,dbPath)){const path=join(output,f.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,f.content);}
symlinkSync('/tmp/wp10-browser-bn2O50/output/instruments/node_modules',join(output,'node_modules'),'dir');
const child=spawn(process.execPath,[join(output,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0','-H','127.0.0.1'],{cwd:output,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='';const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error(logs)),15000);child.stdout.on('data',chunk=>{logs+=chunk;const match=logs.match(/http:\/\/127.0.0.1:(\d+)/);if(match){clearTimeout(timeout);resolve('http://127.0.0.1:'+match[1]);}});child.stderr.on('data',c=>logs+=c);});
try{const read=async(path)=>{const r=await fetch(url+path),body=await r.text();return {status:r.status,alert:body.includes('role="alert"'),hasLargeDecimal:body.includes('1000000000000000000.25'),hasNullDisplay:body.includes('—')};};const initial=await read('/inventory');const filtered=await read('/inventory?'+new URLSearchParams({[project.forms[0].id+':filter:'+field.id]:'10.00'}));renameSync(dbPath,dbPath+'.saved');const missing=await read('/inventory');console.log(JSON.stringify({root,initial,filtered,missingDatabase:missing}));}finally{const exited=once(child,'exit');child.kill('SIGTERM');await exited;}
