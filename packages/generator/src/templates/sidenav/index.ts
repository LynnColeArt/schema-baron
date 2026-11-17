import { readFileSync } from 'node:fs';
import type { GeneratedFile, GenerationIR } from '../../ir/index.js';
export function sidenavFiles(ir: GenerationIR): GeneratedFile[] {
 if (!ir.navigation?.entries.length) return [];
 const entries = ir.navigation.entries.map(entry => {
  if (entry.kind === 'external') return entry;
  const route=ir.routes.find(route=>route.id===entry.pageId);
  // No row keys, query inputs or action context are accepted from visitor URLs.
  const requiresContext=!route || route.records.length>0 || route.grids.some(grid=>grid.keyMapping.length>0 || (grid.report?.parameters??[]).some(parameter=>parameter.runtime));
  return {...entry,href:route?.path??'',requiresContext};
 });
 return [
  {path:'server/sidenav-config.ts',content:`import 'server-only';\nimport type { MenuEntry } from './sidenav';\nexport const menuEntries:readonly MenuEntry[]=${JSON.stringify(entries,null,2)};\n`},
  {path:'server/sidenav.ts',content:readFileSync(new URL('./runtime.template',import.meta.url),'utf8')},
  {path:'components/application-navigation.tsx',content:`import 'server-only';
import type { ReactNode } from 'react';
import './application-navigation.css';
import { cookies } from 'next/headers';
import { sessionCookie } from '../server/authorization';
import { visibleMenu } from '../server/sidenav';
export async function ApplicationNavigation({pageId,children}:{pageId:string;children:ReactNode}) {
 const links=visibleMenu((await cookies()).get(sessionCookie)?.value,pageId);
 if(!links.length)return <>{children}</>;
 return <div className="generated-app-frame"><nav aria-label="Main navigation"><details open><summary>Menu</summary><ul>{links.map(link=><li key={link.id}><a href={link.href} aria-current={link.active?'page':undefined} {...(link.external?{rel:'noopener noreferrer'}:{})}>{link.label}</a></li>)}</ul></details></nav><div className="generated-app-content">{children}</div></div>;
}
`},
  {path:'components/application-navigation.css',content:`
.generated-app-frame{display:grid;grid-template-columns:minmax(10rem,14rem) minmax(0,1fr);gap:1.5rem;align-items:start;min-width:0}
.generated-app-frame>nav,.generated-app-content{min-width:0;overflow-wrap:anywhere}
.generated-app-frame>nav{border-inline-end:1px solid #d5dae2;padding-inline-end:1rem}
.generated-app-frame>nav summary{cursor:pointer;font-weight:600;padding:.5rem}
.generated-app-frame>nav ul{list-style:none;margin:.5rem 0;padding:0;display:grid;gap:.25rem}
.generated-app-frame>nav a{display:block;padding:.55rem .65rem;border-radius:.25rem;color:inherit;text-decoration:none;overflow-wrap:anywhere}
.generated-app-frame>nav a:hover{text-decoration:underline}
.generated-app-frame>nav a[aria-current=page]{font-weight:700;background:#e7edf5;border-inline-start:3px solid currentColor}
.generated-app-frame>nav a:focus-visible,.generated-app-frame>nav summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}
@media(max-width:700px){.generated-app-frame{grid-template-columns:minmax(0,1fr);gap:1rem}.generated-app-frame>nav{border-inline-end:0;border-bottom:1px solid #d5dae2;padding-inline-end:0;padding-bottom:.5rem}}
`},
 ];
}
