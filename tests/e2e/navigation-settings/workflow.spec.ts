import {test,expect} from '@playwright/test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('public Studio explicitly saves menus, guards draft dismissal and authors breadcrumb parents',async({page})=>{
 test.setTimeout(90000);
 const root=mkdtempSync('/tmp/public-navigation-ui-'),projects=join(root,'projects'),config=join(root,'owner.json');mkdirSync(projects);
 const capability=crypto.randomUUID()+crypto.randomUUID();
 writeFileSync(config,JSON.stringify({ownerId:'public-navigation-test',capability,metadataRoot:join(root,'metadata'),approvedRoots:{projects}}),{mode:0o600});
 writeFileSync(join(root,'workspace.json'),JSON.stringify({configured:true,projectsFolder:projects,databaseRoots:{},projects:{}}));
 const child=spawn(process.execPath,[resolve('apps/studio/dist/main.js')],{env:{...process.env,PORT:'0',SCHEMA_BARON_OWNER_CONFIG:config,SCHEMA_BARON_BROWSER_MODE:'local',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','ignore','pipe']});
 const exited=once(child,'exit');let deadline:ReturnType<typeof setTimeout>|undefined;
 try{
  const origin=await new Promise<string>((ready,reject)=>{let logs='';deadline=setTimeout(()=>reject(Error('Owner readiness timeout')),30000);child.stderr!.on('data',chunk=>{logs+=chunk;const match=logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(deadline);ready(match[1]!);}});child.once('exit',()=>reject(Error('Owner exited')));});
  const command=async(operation:string,input:unknown,expectedRevision:number)=>{
   const response=await fetch(origin+'/api/v1/projects/p/commands',{method:'POST',headers:{authorization:'Bearer '+capability,'content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),operation,input,expectedRevision})});const outcome=await response.json();expect(outcome,JSON.stringify(outcome)).toMatchObject({ok:true});return outcome;
  };
  await command('project.create',{name:'Public navigation',approvedRoot:'projects',target:'next-typescript-sqlite'},0);
  await command('project.batch',{operations:[{kind:'put',entity:'page',id:'home',value:{id:'home',route:'/',title:'Home',document:[],formIds:[]}},{kind:'put',entity:'page',id:'detail',value:{id:'detail',route:'/detail',title:'Detail',document:[],formIds:[]}}]},1);
  await page.addInitScript(()=>sessionStorage.setItem('studio.activeProject','p'));await page.goto(origin);
  await expect(page.getByText('● Studio service connected',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Project settings',exact:true}).click();await page.getByRole('button',{name:'Edit application navigation…',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Application navigation',exact:true});
  await dialog.getByRole('button',{name:'Add page',exact:true}).click();
  await expect(dialog.getByLabel('Entry 1 label',{exact:true})).toBeFocused();
  await dialog.getByLabel('Entry 1 label',{exact:true}).fill('Public home');
  await page.keyboard.press('Escape');await expect(dialog.getByRole('region',{name:'Discard navigation changes'})).toBeVisible();
  await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(dialog.getByLabel('Entry 1 label',{exact:true})).toHaveValue('Public home');
  await page.keyboard.press('Escape');await expect(dialog.getByRole('region',{name:'Discard navigation changes'})).toBeVisible();
  await dialog.getByRole('button',{name:'Save navigation',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Navigation saved.');
  await expect(dialog.getByRole('region',{name:'Discard navigation changes'})).toBeHidden();
  const saved=await command('project.inspect',{},3);expect(saved.result.navigation.entries).toMatchObject([{label:'Public home',pageId:'home'}]);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Project settings',exact:true}).click();await page.getByRole('button',{name:'Edit application navigation…',exact:true}).click();
  await expect(dialog.getByLabel('Entry 1 label',{exact:true})).toHaveValue('Public home');await dialog.getByRole('button',{name:'Close',exact:true}).click();
  const detail=page.locator('[role=treeitem][data-object-id=detail]');await detail.click();
  await page.getByRole('tab',{name:'Format',exact:true}).click();
  const parent=page.getByLabel('Breadcrumb parent',{exact:true});await expect(parent).toBeVisible();await parent.selectOption('home');
  await page.getByRole('button',{name:/Save/}).first().click();
  await expect.poll(async()=>{const outcome=await (await fetch(origin+'/api/v1/projects/p',{headers:{authorization:'Bearer '+capability}})).json();return outcome.result.pages.find((p:{id:string})=>p.id==='detail').breadcrumbParentId;}).toBe('home');
 }finally{clearTimeout(deadline);child.kill('SIGTERM');const force=setTimeout(()=>child.kill('SIGKILL'),8000);await exited;clearTimeout(force);rmSync(root,{recursive:true,force:true});}
});
