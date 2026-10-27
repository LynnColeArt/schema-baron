import {afterEach,expect,test} from 'vitest';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync,readFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ownershipPreview,sourceManifest,scanSource} from '../../src/ownership/index.js';
const roots:string[]=[];
afterEach(()=>roots.splice(0).forEach(p=>rmSync(p,{recursive:true,force:true})));
function tree(){const p=mkdtempSync(join(tmpdir(),'regen-'));roots.push(p);return p;}
const files=[{path:'app/page.tsx',content:'original'}];
test('deterministic manifest distinguishes changed, removed, authored and unknown files',()=>{const p=tree();mkdirSync(join(p,'app'));writeFileSync(join(p,'app/page.tsx'),'original');const manifest=sourceManifest('project','a'.repeat(64),files,[]);expect(sourceManifest('project','a'.repeat(64),files,[])).toEqual(manifest);const next=ownershipPreview(scanSource(p),manifest,[{path:'app/new.tsx',content:'new'}],[]);expect(next.conflicts).toEqual([]);expect(next.steps).toMatchObject([{path:'app/new.tsx',operation:'create'},{path:'app/page.tsx',operation:'delete'}]);writeFileSync(join(p,'app/page.tsx'),'handwritten');writeFileSync(join(p,'unknown.txt'),'mine');const blocked=ownershipPreview(scanSource(p),manifest,files,[]);expect(blocked.conflicts.map(c=>c.path)).toEqual(['app/page.tsx','unknown.txt']);expect(readFileSync(join(p,'app/page.tsx'),'utf8')).toBe('handwritten');});
test('links are conflicts and scanning never follows them',()=>{const p=tree(),outside=tree();writeFileSync(join(outside,'secret'),'private');symlinkSync(outside,join(p,'link'));expect(scanSource(p).entries).toEqual([{path:'link',kind:'link'}]);expect(ownershipPreview(scanSource(p),undefined,[],[]).conflicts).toMatchObject([{path:'link'}]);});
