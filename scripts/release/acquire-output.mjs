// Explicit online cache preparation from the published target lock, no business fixture.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pinnedNpmCli } from './toolchain.mjs';
const directory=mkdtempSync(join(tmpdir(),'baron-output-dependency-acquisition-'));
try{
 const lock=JSON.parse(readFileSync(new URL('../../packages/generator/src/templates/base/package-lock.template',import.meta.url),'utf8'));
 writeFileSync(join(directory,'package-lock.json'),JSON.stringify(lock));
 writeFileSync(join(directory,'package.json'),JSON.stringify({...lock.packages[''],private:true}));
 const child=spawn(process.execPath,[pinnedNpmCli,'ci','--ignore-scripts'],{cwd:directory,stdio:'inherit',env:process.env});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 if(code!==0)throw Error('Output dependency acquisition failed');
}finally{rmSync(directory,{recursive:true,force:true});}
