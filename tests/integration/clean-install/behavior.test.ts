/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pinnedNpmCli, pinnedBinPath } from '../../../scripts/release/toolchain.mjs';
describe('published release prerequisites',()=>{
 it('executes the selected pinned npm beside the actual Node runtime',()=>{
  const result=spawnSync(process.execPath,[pinnedNpmCli,'--version'],{encoding:'utf8',env:{PATH:pinnedBinPath,HOME:process.env.HOME??''}});
  expect(result.status).toBe(0);expect(result.stdout.trim()).toBe('11.19.1');
  expect(pinnedBinPath.split(':')[0]).toBe(dirname(process.execPath));
 });
 it('refuses an existing release directory without touching its contents',()=>{
  const root=mkdtempSync(join(tmpdir(),'release-refusal-'));
  try{writeFileSync(join(root,'sentinel'),'private');
   const result=spawnSync(process.execPath,['scripts/release/verify.mjs',root],{encoding:'utf8'});
   expect(result.status).not.toBe(0);expect(result.stderr).toContain('existing directories are refused');
  }finally{rmSync(root,{recursive:true,force:true});}
 });
});
