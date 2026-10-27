import {emissionOrder,pageFile} from '../../behavior/index.js';
import { identityControlFiles } from '../identity-controls/index.js';
import {extensionFiles} from '../../extensions/index.js';
import {reportFiles} from '../report/index.js';
import {queryRuntimeFiles,queryScalarFile} from '../report/runtime-files.js';
import { authFiles } from '../auth/index.js';
import { searchFiles } from '../search/index.js';
import { createHash } from 'node:crypto';
import { recordFiles } from '../record/index.js';
import { GenerationError } from '../../compiler/index.js';
import type { StableId } from '@schema-baron/model';
import { readFileSync } from 'node:fs';
import type { DocumentNode } from '@schema-baron/model';
import type { GeneratedFile, GenerationIR } from '../../ir/index.js';
import { gridFiles } from '../grid/index.js';
export const outputPackage={name:'generated-application',version:'1.0.0',private:true,type:'module',engines:{node:'24.22.1',npm:'11.19.1'},packageManager:'npm@11.19.1',scripts:{dev:'next dev',build:'next build --webpack',start:'next start',typecheck:'tsc --noEmit',test:'node --conditions=react-server --test tests/*.test.mjs'},dependencies:{next:'16.4.3',react:'19.3.1','react-dom':'19.3.1','better-sqlite3':'13.0.3',zod:'4.6.7','decimal.js':'10.6.0','server-only':'0.0.1'},devDependencies:{typescript:'7.0.2','@types/node':'24.19.2','@types/react':'19.3.0','@types/react-dom':'19.3.0','@types/better-sqlite3':'9.6.0'}};
const pretty=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
export function emitApplication(ir:GenerationIR,databasePath:string):GeneratedFile[] {
 const flashCookie='record_saved_'+createHash('sha256').update(ir.projectId).digest('hex').slice(0,20);
 const files:GeneratedFile[]=[...authFiles(ir),...identityControlFiles(),...extensionFiles(ir.extensions??[])];const add=(path:string,content:string)=>files.push({path,content});
 add('package.json',pretty(outputPackage));add('package-lock.json',readFileSync(new URL('./package-lock.template',import.meta.url),'utf8'));
 add('.npmrc','registry=https://registry.npmjs.org/\nignore-scripts=true\nsave-exact=true\nengine-strict=true\n');add('.nvmrc','24.22.1\n');add('.gitignore','node_modules/\n.next/\n.env*\n');
 add('tsconfig.json',pretty({compilerOptions:{target:'ES2023',lib:['dom','dom.iterable','es2023'],strict:true,incremental:true,tsBuildInfoFile:'.next/cache/typescript/tsconfig.tsbuildinfo',noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,noEmit:true,allowJs:true,checkJs:false,allowImportingTsExtensions:true,skipLibCheck:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'react-jsx',plugins:[{name:'next'}]},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts','.next/dev/types/**/*.ts'],exclude:['node_modules']}));
 add('next-env.d.ts','/// <reference types="next" />\n/// <reference types="next/image-types/global" />\nimport "./.next/types/routes.d.ts";\nimport "./.next/types/root-params.d.ts";\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.\n');
 add('next.config.ts',`import type { NextConfig } from 'next';\nconst config: NextConfig = {\n  serverExternalPackages: ['better-sqlite3']\n};\nexport default config;\n`);
 add('app/layout.tsx',`import type { ReactNode } from 'react';\nimport './styles.css';\n\nexport default function Layout({ children }: { children: ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        <main>{children}</main>\n      </body>\n    </html>\n  );\n}\n`);
 add('app/styles.css','body{font-family:system-ui,sans-serif;margin:0;background:#f7f8fa;color:#172539}main{max-width:1100px;margin:32px auto;padding:24px;background:white;border:1px solid #d5dae2}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #d5dae2}form{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:12px 0}label{display:grid;gap:4px}button,input,select{font:inherit;padding:6px}section{margin:24px 0}[role=alert]{color:#9d2424}.record-form{display:block}.record-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.record-delete{margin:20px 0}.record-delete label{display:flex;align-items:center}.record-actions{display:flex;gap:8px}\n');
 add('server/connection.ts',`import 'server-only';\n// Stable external data: generation never creates, copies or resets this file.\nexport const databasePath=process.env.APPLICATION_DATABASE_PATH??${JSON.stringify(databasePath)};\n`);
 add('server/repository.ts',readFileSync(new URL('./repository.template',import.meta.url),'utf8'));
 add('server/format.ts',readFileSync(new URL('./format.template',import.meta.url),'utf8'));
 for(const name of ['validation','repository','service']) add('server/record-'+name+'.ts',readFileSync(new URL('../record/'+name+'.template',import.meta.url),'utf8'));
 add('components/saved-notice.tsx',`'use client';\nimport { useEffect } from 'react';\nexport function SavedNotice({saved,cookieName}:{saved:boolean;cookieName:string}) {\n useEffect(()=>{if(saved) document.cookie=cookieName+'=; Path=/; Max-Age=0; SameSite=Lax';},[saved,cookieName]);\n return saved?<p role="status">Record saved.</p>:null;\n}\n`);
 add('server/navigation.ts',readFileSync(new URL('../navigation/runtime.template',import.meta.url),'utf8'));
 files.push(queryScalarFile());
 if(ir.queries.length){files.push(...queryRuntimeFiles());add('server/query-runtime.ts',readFileSync(new URL('../report/runtime.template',import.meta.url),'utf8'));add('server/query-worker.mjs',readFileSync(new URL('../report/worker.template',import.meta.url),'utf8'));}
 const order=emissionOrder(ir.routes);
 for (const route of ir.routes) {
  const components = new Map<string, number>();
  for (const grid of route.grids) {
   const index=order.find(entry=>entry.formId===grid.id)!.index;
   components.set(grid.id, index);
   files.push(...(grid.report?reportFiles(grid,index,ir.queries):(grid.kind==='Search'?searchFiles:gridFiles)(grid,index)));
  }
  const recordComponents=new Map<string,number>();
  for(const record of route.records) {const index=order.find(entry=>entry.formId===record.id)!.index;recordComponents.set(record.id,index);files.push(...recordFiles(record,index,flashCookie));}
  const placed = new Set<string>();
  const render = (node: DocumentNode, indent = '      '): string => {
   if (node.kind === 'text') return `${indent}{${JSON.stringify(node.text)}}`;
   if (node.kind === 'form') {
    placed.add(node.formId);
    const login=route.logins.find(l=>l.id===node.formId);if(login)return `${indent}<Login username={${JSON.stringify(login.username)}} password={${JSON.stringify(login.password)}} usernameLabel={${JSON.stringify(login.usernameLabel)}} passwordLabel={${JSON.stringify(login.passwordLabel)}} cancelTo={loginCancel(${JSON.stringify(login.id)},parameters)} actions={${JSON.stringify(login.actions.map(a=>({id:a.id,operation:a.operation,...(a.label?{label:a.label}:{})})))}} returnTo={typeof parameters.returnTo==='string'?parameters.returnTo:''} />`;
    return recordComponents.has(node.formId)?`${indent}{renderRecord${recordComponents.get(node.formId)}()}`:`${indent}<Grid${components.get(node.formId)} parameters={parameters} />`;
   }
   return `${indent}<${node.tag}>\n${node.children.map(child => render(child, indent + '  ')).join('\n')}\n${indent}</${node.tag}>`;
  };
  const document = route.document.map(node => render(node)).join('\n');
  const unplaced = route.grids.filter(g => !placed.has(g.id)).map(g => `      <Grid${components.get(g.id)} parameters={parameters} />`).join('\n');
  const depth = route.path === '/' ? 0 : route.path.slice(1).split('/').length;
  const relative = '../'.repeat(depth + 1);
  add(pageFile(route.path), [...components.values()].map(n => `import { Grid${n} } from '${relative}components/grid-${n}';`).join('\n') + [...recordComponents.values()].map(n=>`\nimport { Record${n} } from '${relative}components/record-${n}';\nimport { loadRecord as loadRecord${n}, config as config${n} } from '${relative}server/record-${n}';`).join('')+`\nimport { IdentityHeader } from '${relative}components/identity-header';\nimport { guardPage, loginCancel, pageReturn } from '${relative}server/auth';\nimport { Login } from '${relative}components/login';\nimport { cookies } from 'next/headers';\nimport { SavedNotice } from '${relative}components/saved-notice';\nimport { context } from '${relative}server/navigation';` + `

export const dynamic = 'force-dynamic';
type Parameters = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Parameters> }) {
  const parameters = await searchParams;
  await guardPage(${JSON.stringify(route.id)},parameters);
${[...recordComponents.values()].map(n=>`  const renderRecord${n}=()=>{try {const data=loadRecord${n}(parameters);const params:Record<string,string>={...context(parameters,config${n}.context)};for(const key of [...config${n}.keyParameters,config${n}.id+':mode']) {const text=parameters[key];if(typeof text==='string')params[key]=text;}return <Record${n} parameters={params} initial={data.values} isNew={data.isNew} name={data.name} impacts={data.impacts} options={data.options} />;}catch{return <p role="alert">The record could not be loaded. Check its complete key and the configured database.</p>;}};`).join('\n')}
  const saved=(await cookies()).get(${JSON.stringify(flashCookie)})?.value==='1';
  return (
    <>
${route.identityCaption!==undefined?`      <IdentityHeader caption={${JSON.stringify(route.identityCaption)}} returnTo={(() => { try { return pageReturn(${JSON.stringify(route.id)},parameters); } catch { return undefined; } })()} />`:''}
      <h1>{${JSON.stringify(route.title)}}</h1>
      <SavedNotice saved={saved} cookieName={${JSON.stringify(flashCookie)}} />
${document}
${unplaced}
    </>
  );
}
`);
 }
 add('tests/output.test.mjs',readFileSync(new URL('./output-test.template',import.meta.url),'utf8'));
 add('README.md',`# ${ir.name.replaceAll('\n',' ')}\n\nIndependent Next App Router application. Use Node 24.22.1 and npm 11.19.1.\n\nRun npm ci --ignore-scripts, npm run typecheck, npm test, npm run build, then npm start.\nThe pinned SQLite package ships native NAPI artifacts; lifecycle scripts stay disabled.\nAPPLICATION_DATABASE_PATH may override the server-only configured external database path. The database must already exist. This application reads and writes declared records using server validation and SQLite transactions. No Studio service is required.\n\nList GET parameters are scoped by the form ID: :page, :sort, :direction and :filter:FIELD_ID. Fields and operators are allowlisted; values are prepared bindings. Invalid inputs show a safe error.\n\nAuthored hooks live only at declared authored/name.ts paths. Interface v1 exports contractVersion=1 and validate (validator), execute (action), beforeWrite (service), or afterWrite (event), typed by server/extension-contracts.ts. Validators and services run after built-in server validation, before writes; events run after writes inside the same SQLite transaction. A thrown hook rolls back the transaction and prevents success confirmation. All v1 hooks must be synchronous; avoid external side effects because SQLite cannot roll them back. Action hooks are bound explicitly by extensionHookRef. Validator/service/event hooks apply to Record writes in this application. Cancel never invokes hooks.\n\nRegenerate through Studio preview/apply. Owned files are read-only; modified owned files and unknown source block apply until preserved outside output and restored. Authored modules retain exact bytes. node_modules and .next are disclosed rebuildable artifacts retained in the recoverable old tree; reinstall/build explicitly after promotion. Backups remain beside output for owner recovery. Database, identity store, secrets and migration history must stay outside replaceable output. Schema migration is a separately reviewed operation.\n`);
 if(files.length>2000 || files.some(file=>Buffer.byteLength(file.content)>1_000_000) || files.reduce((sum,file)=>sum+Buffer.byteLength(file.content),0)>8_000_000) throw new GenerationError([{code:'VALIDATION_FAILED',severity:'error',objectId:ir.projectId as StableId,message:'Generation preview exceeds the supported source size (2,000 files, 1 MB per file, 8 MB total). Reduce page content or split the project before previewing.'}]);
 return files.sort((a,b)=>a.path.localeCompare(b.path));
}
