import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileProject, emitApplication, observeOutput, writeInitialOutput } from '../../src/index.js';
import { caseDesk } from './fixture.js';

test('synthetic Case Desk breadcrumb application installs offline, typechecks and builds',()=>{
 const root=mkdtempSync('/tmp/baron-breadcrumb-runtime-'),app=join(root,'app');
 writeInitialOutput(app,emitApplication(compileProject(caseDesk()),join(root,'unused.sqlite')),observeOutput(app));
 const npm=join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');
 const env={...process.env,PATH:dirname(process.execPath)+':/usr/bin:/bin',NODE_PATH:'',npm_config_ignore_scripts:'true',npm_config_workspaces:'false',NEXT_TELEMETRY_DISABLED:'1'};
 for(const [label,args] of [['install',['ci','--offline','--ignore-scripts']],['typecheck',['run','typecheck']],['build',['run','build']]] as const){
  const result=spawnSync(process.execPath,[npm,...args],{cwd:app,env,encoding:'utf8',timeout:150000,maxBuffer:5000000});
  writeFileSync(join(root,label+'.log'),(result.stdout??'')+(result.stderr??''));
  expect(result.error,label).toBeUndefined();expect(result.status,result.stdout+result.stderr).toBe(0);
 }
},300000);
