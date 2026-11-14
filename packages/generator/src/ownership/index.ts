import {lstatSync,readFileSync,readdirSync,openSync,closeSync,constants,fstatSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {contentHash,OutputError} from '../initial-output/index.js';
import type {GeneratedFile} from '../ir/index.js';
export const manifestPath='.schema-baron-generation.json';
export const generatorVersion='0.2.0';
export interface AuthoredContract {id:string;relativePath:string;version:number;kind:string}
export interface SourceManifest {formatVersion:1;projectId:string;generatorVersion:string;generatorHash:string;modelHash:string;ownedFileHashes:Record<string,string>;authoredContracts:AuthoredContract[];runtimeArtifactDirectories:string[]}
export interface SourceEntry {path:string;kind:'file'|'link'|'special'|'runtime';hash?:string;content?:string}
export interface SourceScan {entries:SourceEntry[];fingerprint:string}
export interface SourceStep {path:string;operation:'create'|'replace'|'delete'|'preserve';beforeHash?:string;afterHash?:string;afterContent?:string}
export function validSourcePath(path:string) {return /^[A-Za-z0-9_.\/-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').some(p=>!p||p==='.'||p==='..');}
function generatorHash(){const root=fileURLToPath(new URL('../',import.meta.url));const walk=(path:string):string[]=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(path,e.name)):/\.(?:ts|js|template)$/.test(e.name)?[join(path,e.name)]:[]);return contentHash(JSON.stringify(walk(root).sort().map(p=>[p.slice(root.length),contentHash(readFileSync(p,'utf8'))])));}
export function sourceManifest(projectId:string,modelHash:string,files:GeneratedFile[],contracts:AuthoredContract[]):SourceManifest {
 return {formatVersion:1,projectId,generatorVersion,generatorHash:generatorHash(),modelHash,runtimeArtifactDirectories:['node_modules','.next'],ownedFileHashes:Object.fromEntries([...files].sort((a,b)=>a.path.localeCompare(b.path)).map(f=>[f.path,contentHash(f.content)])),authoredContracts:[...contracts].sort((a,b)=>a.id.localeCompare(b.id))};
}
export function scanSource(path:string):SourceScan {
 const entries:SourceEntry[]=[];let count=0,bytes=0;
 function walk(directory:string,prefix:string,expected:{dev:number;ino:number}){const directoryFd=openSync(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{const openedDirectory=fstatSync(directoryFd);if(openedDirectory.dev!==expected.dev||openedDirectory.ino!==expected.ino)throw new OutputError('OUTPUT_CONFLICT','Source directory changed while reading.');const anchor=`/proc/${process.pid}/fd/${directoryFd}`;const children=readdirSync(anchor).sort();if(!children.length&&prefix)entries.push({path:prefix.slice(0,-1),kind:'special'});for(const name of children) {
  const relative=prefix+name,full=join(anchor,name),stat=lstatSync(full);
  if(++count>5000)throw new OutputError('OUTPUT_CONFLICT','Output contains too many entries. Move build artifacts outside source output before regeneration.');
  if(stat.isSymbolicLink()){entries.push({path:relative,kind:'link'});continue;}
  if(stat.isDirectory()){if(prefix===''&&['node_modules','.next'].includes(name)){entries.push({path:relative,kind:'runtime',hash:contentHash(`${stat.dev}:${stat.ino}:${stat.mtimeMs}`)});continue;}walk(full,relative+'/',stat);continue;}
  if(!stat.isFile()||stat.nlink!==1||stat.size>1_000_000){entries.push({path:relative,kind:'special'});continue;}
  bytes+=stat.size;if(bytes>12_000_000)throw new OutputError('OUTPUT_CONFLICT','Output exceeds supported source size. Move unknown data outside output.');
  const fileFd=openSync(full,constants.O_RDONLY|constants.O_NOFOLLOW);let content:string;try{const opened=fstatSync(fileFd);if(opened.ino!==stat.ino||opened.dev!==stat.dev||opened.nlink!==1||!opened.isFile())throw new OutputError('OUTPUT_CONFLICT','Source entry changed while reading.');const bytes=readFileSync(fileFd);content=bytes.toString('utf8');if(!Buffer.from(content,'utf8').equals(bytes)){entries.push({path:relative,kind:'special'});continue;}const after=fstatSync(fileFd);if(after.mtimeMs!==opened.mtimeMs||after.size!==opened.size)throw new OutputError('OUTPUT_CONFLICT','Source file changed while reading.');}finally{closeSync(fileFd);}entries.push({path:relative,kind:'file',hash:contentHash(content),content});
 }}finally{closeSync(directoryFd);}}
 const stat=lstatSync(path);if(!stat.isDirectory()||stat.isSymbolicLink())throw new OutputError('PATH_OUTSIDE_ROOT','Output must be a real source directory.');walk(path,'',stat);
 return {entries,fingerprint:contentHash(JSON.stringify({identity:`${stat.dev}:${stat.ino}`,entries:entries.map(({content:_content,...e})=>e)}))};
}
export function readManifest(scan:SourceScan,projectId:string):SourceManifest|undefined {
 const entry=scan.entries.find(e=>e.path===manifestPath);if(!entry)return undefined;
 try {const m=JSON.parse(entry.content??'') as SourceManifest;
  if(m.formatVersion!==1||m.projectId!==projectId||!m.ownedFileHashes||!Array.isArray(m.authoredContracts)||Object.entries(m.ownedFileHashes).some(([p,h])=>!validSourcePath(p)||!/^[a-f0-9]{64}$/.test(h)))throw Error();return m;
 }catch{throw new OutputError('OUTPUT_CONFLICT','Ownership manifest is invalid. Preserve output and restore its reviewed manifest before regeneration.');}
}
export function ownershipPreview(scan:SourceScan,previous:SourceManifest|undefined,generated:GeneratedFile[],contracts:AuthoredContract[]) {
 const steps:SourceStep[]=[],conflicts:{path:string;message:string}[]=[];
 const next=new Map(generated.map(f=>[f.path,f]));const authored=new Map(contracts.map(c=>[c.relativePath,c]));const observed=new Map(scan.entries.map(e=>[e.path,e]));
 for(const entry of scan.entries) {
  if(entry.path===manifestPath)continue;
  const owned=previous?.ownedFileHashes[entry.path],contract=authored.get(entry.path),old=previous?.authoredContracts.find(c=>c.relativePath===entry.path);
  if(entry.kind==='runtime'&&previous?.runtimeArtifactDirectories?.includes(entry.path)){steps.push({path:entry.path,operation:'delete',beforeHash:entry.hash!});continue;}
  if(entry.kind!=='file') {conflicts.push({path:entry.path,message:'Link, special entry or runtime artifact. Move it outside source output and review a fresh preview.'});continue;}
  if(owned) {if(entry.hash!==owned){conflicts.push({path:entry.path,message:'Modified generated source. Preserve your changes outside output, restore the owned version, then preview again.'});continue;}
   const file=next.get(entry.path);steps.push({path:entry.path,operation:!file?'delete':contentHash(file.content)===entry.hash?'preserve':'replace',beforeHash:entry.hash!,...(file?{afterHash:contentHash(file.content),afterContent:file.content}:{})});next.delete(entry.path);continue;
  }
  if(contract&&old&&old.id===contract.id&&old.kind===contract.kind&&old.version===contract.version) {if(!/^export const contractVersion\s*=\s*1\s+as\s+const;?\s*$/m.test(entry.content??'')){conflicts.push({path:entry.path,message:'Authored interface must explicitly export const contractVersion = 1 as const. Migrate incompatible source before apply.'});continue;}steps.push({path:entry.path,operation:'preserve',beforeHash:entry.hash!,afterHash:entry.hash!,afterContent:entry.content!});continue;}
  conflicts.push({path:entry.path,message:old?'Authored interface changed or was removed. Move source aside and explicitly migrate the declared interface before a fresh preview.':'Unknown file. Move it outside replaceable source output before a fresh preview.'});
 }
 for(const path of Object.keys(previous?.ownedFileHashes??{}))if(!observed.has(path))conflicts.push({path,message:'Owned source is missing. Restore it or preserve this output elsewhere before regeneration.'});
 for(const [path,file] of next)if(!observed.has(path))steps.push({path,operation:'create',afterHash:contentHash(file.content),afterContent:file.content});
 for(const contract of contracts)if(!observed.has(contract.relativePath)){const file=generated.find(f=>f.path===contract.relativePath);if(!file)throw new OutputError('INVALID_INPUT','Authored module seed is unavailable.');}
 steps.sort((a,b)=>a.path.localeCompare(b.path));conflicts.sort((a,b)=>a.path.localeCompare(b.path));return {steps,conflicts};
}
