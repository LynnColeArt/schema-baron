import {test,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProjectCore} from '../../src/index.js';

test('menu and breadcrumb metadata save with revisions, survive restart and prevent dangling destinations',async()=>{
 const root=mkdtempSync(join(tmpdir(),'public-navigation-'));
 const options={ownerId:'owner',metadataRoot:join(root,'metadata'),approvedRoots:{projects:join(root,'projects')}};
 let core=new ProjectCore(options);
 const command=(operation:string,input:unknown,revision:number,requestId=crypto.randomUUID())=>core.executeAsync('owner',{projectId:'p',requestId,operation,input,expectedRevision:revision});
 try{
  expect(await command('project.create',{name:'Navigation',approvedRoot:'projects',target:'next-typescript-sqlite'},0)).toMatchObject({ok:true});
  expect(await command('project.batch',{operations:[{kind:'put',entity:'page',id:'home',value:{id:'home',route:'/',title:'Home',document:[],formIds:[]}},{kind:'put',entity:'page',id:'detail',value:{id:'detail',route:'/detail',title:'Detail',breadcrumbParentId:'home',document:[],formIds:[]}}]},1)).toMatchObject({ok:true});
  const menu={entries:[{id:'home-link',label:'Home',kind:'page',pageId:'home'}]};
  expect(await command('navigation.configure',{menu},2)).toMatchObject({ok:true,revision:3});
  expect(await command('navigation.configure',{menu:null},2)).toMatchObject({ok:false,error:{code:'REVISION_CONFLICT'}});
  expect(await command('project.batch',{operations:[{kind:'remove',entity:'page',id:'home'}]},3)).toMatchObject({ok:false});
  await core.close();core=new ProjectCore(options);
  expect(core.snapshot('owner','p')).toMatchObject({revision:3,navigation:menu,pages:[{}, {breadcrumbParentId:'home'}]});
  expect(await command('navigation.configure',{menu:null},3)).toMatchObject({ok:true,revision:4});
  expect(core.snapshot('owner','p')).not.toHaveProperty('navigation');
  expect(core.snapshot('owner','p').pages[1]?.breadcrumbParentId).toBe('home');
 }finally{await core.close();rmSync(root,{recursive:true,force:true});}
});
