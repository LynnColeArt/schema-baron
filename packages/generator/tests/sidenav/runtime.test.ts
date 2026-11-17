import { test,expect } from 'vitest';
import { mkdtempSync,writeFileSync,readFileSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compileProject,emitApplication,writeInitialOutput,observeOutput } from '../../src/index.js';
import { menuProject } from './fixture.js';
test('production generated sidenav filters through real identity store before SSR/RSC serialization',()=>{
 const root=mkdtempSync('/tmp/baron-sidenav-runtime-'),app=join(root,'app');writeInitialOutput(app,emitApplication(compileProject(menuProject()),join(root,'unused.sqlite')),observeOutput(app));
 const npm=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js'),env={...process.env,PATH:dirname(process.execPath)+':/usr/bin:/bin',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'};
 for(const file of ['qualification.mjs','ssr-qualification.mjs'])writeFileSync(join(app,file),readFileSync(new URL('./'+file,import.meta.url)));
 writeFileSync(join(app,'resolve.mjs'),`import {registerHooks} from 'node:module';registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.'))return next(specifier+'.ts',context);if(specifier.startsWith('next/'))return next(specifier+'.js',context);throw error;}}});`);
 const steps=[['install',[npm,'ci','--offline','--ignore-scripts']],['authorization',['--conditions=react-server','--import','./resolve.mjs','qualification.mjs']],['typecheck',[npm,'run','typecheck']],['build',[npm,'run','build']],['ssr',['ssr-qualification.mjs']],['browser',[fileURLToPath(new URL('./browser-qualification.mjs',import.meta.url)),app]]] as const;
 for(const [label,args] of steps){const r=spawnSync(process.execPath,args,{cwd:app,env,encoding:'utf8',timeout:150000,maxBuffer:5000000});writeFileSync(join(root,label+'.log'),(r.stdout??'')+(r.stderr??''));expect(r.error,label).toBeUndefined();expect(r.status,r.stdout+r.stderr).toBe(0);}
},300000);
