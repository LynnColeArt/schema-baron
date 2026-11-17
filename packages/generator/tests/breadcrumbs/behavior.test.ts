import { expect, test } from 'vitest';
import { parseProject, canonicalJson, type Project } from '@schema-baron/model';
import { compileProject, emitApplication } from '../../src/index.js';
import { compileBreadcrumbs } from '../../src/compiler/breadcrumbs.js';
import { breadcrumbHeader } from '../../src/templates/navigation/breadcrumbs.js';
import { caseDesk } from './fixture.js';

test('explicit Case Desk ancestry renders accessible ordered links and exactly one unlinked current title',()=>{
 const ir=compileProject(caseDesk()), route=ir.routes.find(route=>route.id==='detail')!;
 expect(route.breadcrumbs).toEqual([{path:'/',title:'Case Desk'},{path:'/work',title:'Cases'}]);
 const page=emitApplication(ir,'/synthetic/cases.sqlite').find(file=>file.path==='app/unrelated-path/page.tsx')!.content;
 expect(page).toContain('<nav aria-label="Breadcrumb" className="generated-breadcrumbs">');expect(page).toContain('<ol>');
 expect(page.indexOf('href={"/"}')).toBeLessThan(page.indexOf('href={"/work"}'));
 expect(page).toContain('<li aria-current="page">{"Case details"}</li>');
 expect(page.match(/<h1>/g)).toHaveLength(1);expect(page.match(/Case details/g)).toHaveLength(2);expect(page.indexOf('</nav>')).toBeLessThan(page.indexOf('<h1>'));
 expect(page).toContain('await guardPage("detail",parameters)');
 expect(page).not.toContain('href={"/unrelated-path"}');
});

test('flat projects preserve legacy heading and omit breadcrumb IR',()=>{
 const project=caseDesk();project.pages=project.pages.map(({breadcrumbParentId,...page})=>page);
 const ir=compileProject(project);for(const route of ir.routes){expect(route).not.toHaveProperty('breadcrumbs');expect(breadcrumbHeader(route)).toBe(`      <h1>{${JSON.stringify(route.title)}}</h1>`);}
});

test.each(['unknown','self','cycle','multiple','duplicate'])('rejects %s parent graph',kind=>{
 const p=caseDesk();const data=JSON.parse(JSON.stringify(p));
 if(kind==='unknown')data.pages[2].breadcrumbParentId='missing';
 if(kind==='self')data.pages[2].breadcrumbParentId='detail';
 if(kind==='cycle')data.pages[0].breadcrumbParentId='detail';
 if(kind==='multiple')data.pages[2].breadcrumbParentId=['home','cases'];
 if(kind==='duplicate')data.pages.push({...data.pages[1],route:'/duplicate'});
 expect(()=>parseProject(data)).toThrow();
});

test('definition roundtrip retains explicit parent without mutating saved input',()=>{
 const p=caseDesk(),raw=JSON.stringify(p),reopened=parseProject(JSON.parse(raw));
 expect(reopened.pages[2]?.breadcrumbParentId).toBe('cases');
 expect(canonicalJson(reopened)).toBe(canonicalJson(p));
 expect(JSON.stringify(p)).toBe(raw);
});

test('protected ancestors and context-dependent destinations are omitted, never leaked or guessed',()=>{
 const p=caseDesk();p.policies.push({id:'private' as Project['id'],scope:'page',ownerId:p.pages[1]!.id,access:'authenticated'});p.pages[1]!.policyId='private' as Project['id'];
 expect(compileBreadcrumbs(p,'detail')).toEqual([{path:'/',title:'Case Desk'}]);
 delete p.pages[1]!.policyId;
 p.forms.push({id:'record' as Project['id'],pageId:p.pages[1]!.id,kind:'Record',keyMapping:[],controlIds:[],actionIds:[],search:[],sorting:[],paging:{pageSize:20},appearance:{}});
 expect(compileBreadcrumbs(p,'detail')).toEqual([{path:'/',title:'Case Desk'}]);
 const rendered=breadcrumbHeader({title:'Case details',breadcrumbs:compileBreadcrumbs(p,'detail')});expect(rendered).not.toContain('Cases');expect(rendered).not.toContain('?');
});
