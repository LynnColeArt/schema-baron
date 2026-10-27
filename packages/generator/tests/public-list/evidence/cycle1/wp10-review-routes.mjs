import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,symlinkSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {compileProject,emitApplication} from '/home/lynn/projects/schema-baron/.worktrees/schema-baron-studio-01M5W3Q9-lane-j/packages/generator/dist/index.js';
const original='/tmp/wp10-browser-yUgdqS/output/instruments';
const project=JSON.parse(readFileSync('/tmp/wp10-browser-yUgdqS/definitions/5d0c33a3-9165-4280-beca-5103f04f3ff5.json','utf8'));
project.pages[0].route='/_inventory';
const ir=compileProject(project);
const root=mkdtempSync('/tmp/wp10-review-route-');
for(const f of emitApplication(ir,'/tmp/wp10-browser-yUgdqS/definitions/instruments.sqlite')){const path=join(root,f.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,f.content);}
symlinkSync(join(original,'node_modules'),join(root,'node_modules'),'dir');
const child=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0','-H','127.0.0.1'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='';const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error(logs)),15000);child.stdout.on('data',chunk=>{logs+=chunk;const match=logs.match(/http:\/\/127.0.0.1:(\d+)/);if(match){clearTimeout(timeout);resolve('http://127.0.0.1:'+match[1]);}});child.stderr.on('data',c=>logs+=c);});
try{const response=await fetch(url+'/_inventory');const text=await response.text();console.log(JSON.stringify({root,compiledRoute:ir.routes[0].path,emittedFile:'app/_inventory/page.tsx',httpStatus:response.status,notFound:text.includes('This page could not be found')}));}finally{const exited=once(child,'exit');child.kill('SIGTERM');await exited;}
