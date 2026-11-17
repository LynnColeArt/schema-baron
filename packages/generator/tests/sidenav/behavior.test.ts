import { expect,test } from 'vitest';
import { parseProject } from '@schema-baron/model';
import { compileProject,emitApplication } from '../../src/index.js';
import { sidenavFiles } from '../../src/templates/sidenav/index.js';
import { configured, menuProject } from './fixture.js';
test('only server-only registry contains protected labels; page code passes current id, not registry',()=>{
 const files=emitApplication(compileProject(menuProject()),'/synthetic/data.sqlite');
 const config=files.find(f=>f.path==='server/sidenav-config.ts')!.content;expect(config).toContain("import 'server-only'");expect(config).toContain('Secret destination');expect(config).toContain('"visibility": "authenticated"');
 const page=files.find(f=>f.path==='app/login/page.tsx')!.content;expect(page).toContain('<ApplicationNavigation pageId={"login-page"}>');expect(page).not.toContain('Secret destination');expect(page).not.toContain('Staff handbook');
 const component=files.find(f=>f.path==='components/application-navigation.tsx')!.content;expect(component).not.toContain('use client');expect(component).not.toContain('menuEntries');expect(component).toContain('visibleMenu(');expect(component).toContain('<details open>');expect(component).toContain('aria-current');
});
test('absent and empty registry emit no sidenav files or component',()=>{
 const p=configured();for(const project of [p,parseProject({...p,navigation:{entries:[]}})]){const files=emitApplication(compileProject(project),'/synthetic/data.sqlite');expect(files.some(f=>f.path.includes('sidenav')||f.path.includes('application-navigation'))).toBe(false);expect(files.find(f=>f.path==='app/login/page.tsx')!.content).not.toContain('ApplicationNavigation');}
});
test('unresolved Record destinations are blocked before runtime authorization',()=>{
 const ir=compileProject(menuProject());ir.routes[1]!.records=[{} as never];const content=sidenavFiles(ir).find(f=>f.path==='server/sidenav-config.ts')!.content;expect(content).toContain('"requiresContext": true');
});
test.each(['javascript:alert(1)','http://example.com','https://user:pass@example.com','//example.com','https://example.com\\evil','https://example.com\n'])('reject unsafe URL %s before emission',url=>{
 expect(()=>parseProject({...configured(),navigation:{entries:[{id:'bad',kind:'external',label:'Bad',url}]}})).toThrow();
});

test('no authorized links returns content without a shell; visible links wrap one list beside content',async()=>{
 const { transform, loadBindings } = await import('next/dist/build/swc/index.js');await loadBindings();
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const component=sidenavFiles(compileProject(menuProject())).find(f=>f.path==='components/application-navigation.tsx')!.content;
 const source=component.replace(/^import .*\n/gm,'').replace('export async function','async function');
 const {code:js}=await transform(source,{jsc:{parser:{syntax:'typescript',tsx:true},transform:{react:{runtime:'classic'}}},module:{type:'commonjs'}});
 const factory=new Function('React','cookies','sessionCookie','visibleMenu',js+';return ApplicationNavigation;');
 const child=React.createElement('h1',null,'Actual page');
 const empty=factory(React,async()=>({get:()=>undefined}),'test',()=>[]);
 expect(renderToStaticMarkup(await empty({pageId:'x',children:child}))).toBe('<h1>Actual page</h1>');
 const populated=factory(React,async()=>({get:()=>undefined}),'test',()=>[{id:'one',href:'/one',label:'One',active:true,external:false}]);
 const html=renderToStaticMarkup(await populated({pageId:'x',children:child}));
 expect(html.match(/<nav/g)).toHaveLength(1);expect(html.match(/<ul/g)).toHaveLength(1);expect(html.match(/<h1/g)).toHaveLength(1);expect(html).toContain('class="generated-app-content"><h1>Actual page</h1>');
});
