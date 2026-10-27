import { GenerationError } from '../../compiler/index.js';
import type { StableId } from '@schema-baron/model';
import { readFileSync } from 'node:fs';
import type { DocumentNode } from '@schema-baron/model';
import type { GeneratedFile, GenerationIR } from '../../ir/index.js';
import { gridFiles } from '../grid/index.js';
export const outputPackage={name:'generated-application',version:'1.0.0',private:true,type:'module',engines:{node:'24.22.1',npm:'11.19.1'},packageManager:'npm@11.19.1',scripts:{dev:'next dev',build:'next build --webpack',start:'next start',typecheck:'tsc --noEmit',test:'node --conditions=react-server --test tests/*.test.mjs'},dependencies:{next:'16.4.3',react:'19.3.1','react-dom':'19.3.1','better-sqlite3':'13.0.3',zod:'4.6.7','decimal.js':'10.6.0','server-only':'0.0.1'},devDependencies:{typescript:'7.0.2','@types/node':'24.19.2','@types/react':'19.3.0','@types/react-dom':'19.3.0','@types/better-sqlite3':'9.6.0'}};
const pretty=(value:unknown)=>JSON.stringify(value,null,2)+'\n';
export function emitApplication(ir:GenerationIR,databasePath:string):GeneratedFile[] {
 const files:GeneratedFile[]=[];const add=(path:string,content:string)=>files.push({path,content});
 add('package.json',pretty(outputPackage));add('package-lock.json',readFileSync(new URL('./package-lock.template',import.meta.url),'utf8'));
 add('.npmrc','registry=https://registry.npmjs.org/\nignore-scripts=true\nsave-exact=true\nengine-strict=true\n');add('.nvmrc','24.22.1\n');add('.gitignore','node_modules/\n.next/\n.env*\n');
 add('tsconfig.json',pretty({compilerOptions:{target:'ES2023',lib:['dom','dom.iterable','es2023'],strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,noEmit:true,allowImportingTsExtensions:true,skipLibCheck:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'react-jsx',plugins:[{name:'next'}]},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
 add('next-env.d.ts','/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
 add('next.config.ts',`import type { NextConfig } from 'next';\nconst config: NextConfig = {\n  serverExternalPackages: ['better-sqlite3']\n};\nexport default config;\n`);
 add('app/layout.tsx',`import type { ReactNode } from 'react';\nimport './styles.css';\n\nexport default function Layout({ children }: { children: ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        <main>{children}</main>\n      </body>\n    </html>\n  );\n}\n`);
 add('app/styles.css','body{font-family:system-ui,sans-serif;margin:0;background:#f7f8fa;color:#172539}main{max-width:1100px;margin:32px auto;padding:24px;background:white;border:1px solid #d5dae2}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #d5dae2}form{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:12px 0}label{display:grid;gap:4px}button,input,select{font:inherit;padding:6px}section{margin:24px 0}[role=alert]{color:#9d2424}\n');
 add('server/connection.ts',`import 'server-only';\n// Stable external data: generation never creates, copies or resets this file.\nexport const databasePath=process.env.APPLICATION_DATABASE_PATH??${JSON.stringify(databasePath)};\n`);
 add('server/repository.ts',readFileSync(new URL('./repository.template',import.meta.url),'utf8'));
 add('server/format.ts',readFileSync(new URL('./format.template',import.meta.url),'utf8'));
 let index = 0;
 for (const route of ir.routes) {
  const components = new Map<string, number>();
  for (const grid of route.grids) {
   components.set(grid.id, index);
   files.push(...gridFiles(grid, index++));
  }
  const placed = new Set<string>();
  const render = (node: DocumentNode, indent = '      '): string => {
   if (node.kind === 'text') return `${indent}{${JSON.stringify(node.text)}}`;
   if (node.kind === 'form') {
    placed.add(node.formId);
    return `${indent}<Grid${components.get(node.formId)} parameters={parameters} />`;
   }
   return `${indent}<${node.tag}>\n${node.children.map(child => render(child, indent + '  ')).join('\n')}\n${indent}</${node.tag}>`;
  };
  const document = route.document.map(node => render(node)).join('\n');
  const unplaced = route.grids.filter(g => !placed.has(g.id)).map(g => `      <Grid${components.get(g.id)} parameters={parameters} />`).join('\n');
  const depth = route.path === '/' ? 0 : route.path.slice(1).split('/').length;
  const relative = '../'.repeat(depth + 1);
  add(`app${route.path === '/' ? '' : route.path}/page.tsx`, [...components.values()].map(n => `import { Grid${n} } from '${relative}components/grid-${n}';`).join('\n') + `

export const dynamic = 'force-dynamic';
type Parameters = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Parameters> }) {
  const parameters = await searchParams;
  return (
    <>
      <h1>{${JSON.stringify(route.title)}}</h1>
${document}
${unplaced}
    </>
  );
}
`);
 }
 add('tests/output.test.mjs',readFileSync(new URL('./output-test.template',import.meta.url),'utf8'));
 add('README.md',`# ${ir.name.replaceAll('\n',' ')}\n\nIndependent Next App Router application. Use Node 24.22.1 and npm 11.19.1.\n\nRun npm ci --ignore-scripts, npm run typecheck, npm test, npm run build, then npm start.\nThe pinned SQLite package ships native NAPI artifacts; lifecycle scripts stay disabled.\nAPPLICATION_DATABASE_PATH may override the server-only configured external database path. The database must already exist. This application only reads it. No Studio service is required.\n\nList GET parameters are scoped by the form ID: :page, :sort, :direction and :filter:FIELD_ID. Fields and operators are allowlisted; values are prepared bindings. Invalid inputs show a safe error.\n\nCustom validators/actions and regeneration ownership are unavailable in this first output slice. Preserve your output before editing; Studio refuses nonempty output. Schema migration remains a separately reviewed operation.\n`);
 if(files.length>2000 || files.some(file=>Buffer.byteLength(file.content)>1_000_000) || files.reduce((sum,file)=>sum+Buffer.byteLength(file.content),0)>8_000_000) throw new GenerationError([{code:'VALIDATION_FAILED',severity:'error',objectId:ir.projectId as StableId,message:'Generation preview exceeds the supported source size (2,000 files, 1 MB per file, 8 MB total). Reduce page content or split the project before previewing.'}]);
 return files.sort((a,b)=>a.path.localeCompare(b.path));
}
