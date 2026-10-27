import { pinnedNpmCli } from '../../../scripts/release/toolchain.mjs';
import { test, expect, type Page } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir, cpus, totalmem, platform, release, arch } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import Database from 'better-sqlite3';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Project } from '@schema-baron/model';
// All authoring uses visible controls. HTTP GETs and independent SQLite handles are read-only oracles.
// Traces are disabled: Playwright traces include password fill arguments even for masked inputs.
test.use({
  trace: 'off',
  actionTimeout: 15000,
  viewport: {
    width: 1280,
    height: 800
  }
});
test.setTimeout(600000);
let equipmentRoot: string;
let root: string, catalogRootId: string, catalogOutputRootId: string, url: string, capability: string, child: ReturnType<typeof spawn>, exit: Promise<unknown>;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'publication-visible-'));
  catalogRootId='catalog-'+root.split('-').at(-1);catalogOutputRootId='catalog-output-'+root.split('-').at(-1);
  mkdirSync(join(root, 'definitions'));
  mkdirSync(join(root, 'outputs'));
  capability = randomBytes(32).toString('base64url');
  const config = join(root, 'owner.json');
  const prerequisite = process.env.SCHEMA_BARON_EQUIPMENT_STUDY;
  if (!prerequisite) throw new Error('Run the fresh Equipment study first with SCHEMA_BARON_EQUIPMENT_STUDY set to its location JSON; pass the same path here.');
  equipmentRoot = JSON.parse(readFileSync(prerequisite, 'utf8')).root;
  const equipmentConfig = JSON.parse(readFileSync(join(equipmentRoot, 'owner.json'),'utf8'));
  writeFileSync(config, JSON.stringify({
    ownerId: equipmentConfig.ownerId,
    capability,
    metadataRoot: equipmentConfig.metadataRoot,
    approvedRoots: {
      ...equipmentConfig.approvedRoots,
      [catalogRootId]: join(root, 'definitions'),
      [catalogOutputRootId]: join(root, 'outputs')
    }
  }), {
    mode: 0o600
  });
  child = spawn(process.execPath, [resolve('apps/studio/dist/main.js')], {
    detached: true,
    env: {
      ...process.env,
      PORT: '0',
      SCHEMA_BARON_OWNER_CONFIG: config
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  exit = once(child, 'exit');
  url = await new Promise((resolve, reject) => {
    let logs = '';
    const timer = setTimeout(() => reject(new Error('Owner readiness timeout')), 20000);
    child.stderr!.on('data', chunk => {
      logs += String(chunk);
      const found = logs.match(/owner ready at (http:\/\/127\.0\.0\.1:\d+)/);
      if (found) {
        clearTimeout(timer);
        resolve(found[1]!);
      }
    });
  });
  writeFileSync(process.env.SCHEMA_BARON_PUBLICATION_STUDY ?? join(root, 'study-location.json'), JSON.stringify({
    root,
    url,
    ownerPid: child.pid
  }, null, 2));
});
test.afterEach(async ({
  page
}, info) => {
  if (info.status !== info.expectedStatus) {
    await page.screenshot({
      path: info.outputPath('studio-failure.png'),
      mask: [page.locator('input[type=password]')]
    });
    writeFileSync(info.outputPath('studio-visible-failure.txt'), await page.locator('body').innerText());
  }
});
test.afterAll(async () => {
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
  await exit;
  // Intentionally retain disposable study project/output/data; owner config remains private 0600.
});
async function read(path: string) {
  const r = await fetch(url + '/api/v1/' + path, {
    headers: {
      authorization: `Bearer ${capability}`
    }
  });
  const result = await r.json();
  expect(result.ok).toBe(true);
  return result.result;
}
const canonicalUrl=(value:string)=>{const u=new URL(value);u.searchParams.sort();return u.href;};
const button = (page: Page, name: string) => page.getByRole('button', {
  name,
  exact: true
});
const label = (page: Page, name: string) => page.getByLabel(name, {
  exact: true
});
async function save(page: Page) {
  await button(page, '▣ Save').click();
  await expect(page.getByRole('status')).toContainText('Saved');
}
async function schemaTable(page: Page, name: string, columns: [string, string][], keys: string[] = ['id']) {
  await button(page, '＋ Table').click();
  await label(page, 'Table name').fill(name);
  await page.getByRole('tab', {
    name: 'Columns',
    exact: true
  }).click();
  for (const [name, type] of columns) {
    await button(page, '＋ Column').click();
    await label(page, 'Column name').fill(name);
    await label(page, 'Logical type').selectOption(type);
    await label(page, 'Allow NULL').uncheck();
  }
  await page.getByRole('tab', {
    name: 'Keys',
    exact: true
  }).click();
  for (const key of keys) await label(page, key).check();
}
async function foreignKey(page: Page, local: string, field: string, target: string) {
  await button(page, '＋ Relationship').click();
  await label(page, 'Local table').selectOption({
    label: local
  });
  await label(page, 'Referenced table').selectOption({
    label: target
  });
  await label(page, 'Local column 1').selectOption({
    label: field
  });
  await label(page, 'Referenced column 1').selectOption({
    label: 'id'
  });
  await label(page, 'On delete').selectOption('restrict');
  await button(page, 'Add relationship draft').click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
async function addPage(page: Page, title: string, route: string) {
  await button(page, '＋ Page').click();
  await label(page, 'Page title').fill(title);
  await label(page, 'Internal route').fill(route);
  await button(page, 'Add page').click();
  await save(page);
}
async function wizard(page: Page, kind: string, name: string, tableId: string, linked?: string) {
  await button(page, '＋ Form').click();
  await label(page, 'Form label').fill(name);
  await label(page, 'Form kind').selectOption(kind);
  if (kind !== 'Login') await page.getByRole('dialog').getByLabel('Data source', {
    exact: true
  }).selectOption('table:' + tableId);
  await button(page, 'Next').click();
  if (kind !== 'Login') {
    const fields = page.getByRole('group', {
      name: 'Fields, in selection order'
    }).getByRole('checkbox');
    for (let i = 0; i < (await fields.count()); i++) await fields.nth(i).check();
    await button(page, 'Use complete primary key').click();
  }
  await button(page, 'Next').click();
  if (linked) await label(page, 'Linked Record page').selectOption(linked);
  await button(page, 'Next').click();
  await button(page, 'Next').click();
  await button(page, 'Finish').click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
test('Publication Catalog visibly authors an unrelated composite-key application', async ({page,browser},info) => {
 writeFileSync(info.outputPath('environment.json'),JSON.stringify({node:process.version,browser:browser.version(),os:platform()+' '+release(),arch:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,memoryBytes:totalmem(),viewport:{width:1280,height:800},tracePolicy:'off; payloads excluded'},null,2));
 const operations:unknown[]=[];
 page.on('response', r=>{if(r.request().method()==='POST' && r.url().startsWith(url+'/api/v1/')){let operation='owner-session';try{operation=r.request().postDataJSON()?.operation??operation;}catch{} operations.push({operation,status:r.status()});writeFileSync(info.outputPath('operations.json'),JSON.stringify(operations,null,2));}});
 await page.goto(url); await label(page,'Studio service owner key').fill(capability); await button(page,'Connect').click();
 await button(page,'New project…').click(); await label(page,'Project name').fill('Publication Catalog');await page.getByRole('dialog').locator('select[name=root]').selectOption(catalogRootId); await button(page,'Create project').click();
 await expect(page.getByRole('dialog')).toBeHidden();
 await button(page,'Connections…').click(); await label(page,'Database choice').selectOption('empty');await label(page,'Approved database root').selectOption(catalogRootId); await label(page,'Relative SQLite file').fill('catalog.sqlite'); await button(page,'Inspect SQLite file').click(); await expect(page.getByText('0 tables · 0 read-only unsupported objects')).toBeVisible(); await button(page,'Bind inspected database').click();
 await button(page,'Schema').click();
 await schemaTable(page,'authors',[['id','integer'],['pen_name','text'],['email','text']]);
 await page.getByRole('tab',{name:'Constraints',exact:true}).click(); await label(page,'email').check();await button(page,'Add unique constraint').click();
 await schemaTable(page,'publications',[['id','integer'],['author_id','integer'],['title','text'],['royalty','decimal']]);
 await schemaTable(page,'categories',[['id','integer'],['caption','text']]);
 await schemaTable(page,'publication_categories',[['publication_id','integer'],['category_id','integer'],['annotation','text']],['publication_id','category_id']);
 await foreignKey(page,'publications','author_id','authors'); await foreignKey(page,'publication_categories','publication_id','publications');await foreignKey(page,'publication_categories','category_id','categories');
 await button(page,'Save schema').click(); await expect(page.locator('.schema-messages p[role=status]')).toContainText('Schema definition saved');
 const oracle=()=>new Database(join(root,'definitions','catalog.sqlite'),{readonly:true});
 let db=oracle();expect(db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all()).toEqual([]);db.close();
 await button(page,'Review migration…').click();await expect(page.getByRole('dialog')).toContainText('PRIMARY KEY');await page.screenshot({path:info.outputPath('schema-review.png')});writeFileSync(info.outputPath('schema-review.txt'),await page.getByRole('dialog').innerText()); await button(page,'Apply reviewed migration').click();await expect(page.locator('.schema-messages p[role=status]')).toContainText('Migration committed');
 db=oracle();expect((db.prepare('PRAGMA table_info(publication_categories)').all() as {name:string;pk:number}[]).filter(c=>c.pk).map(c=>c.name)).toEqual(['publication_id','category_id']);db.close();
 const summary=(await read('projects?approvedRoot='+catalogRootId))[0];const snapshot=async():Promise<Project>=>read('projects/'+summary.id);
 await button(page,'Schema').click();
 const routes=[['Publications','/'],['Writers','/writers'],['Subjects','/subjects'],['Memberships','/memberships'],['Publication record','/publication'],['Writer record','/writer'],['Subject record','/subject'],['Membership record','/membership'],['Access','/access']] as const;
 for(const [title,route]of routes)await addPage(page,title,route);
 let p=await snapshot();
 const domains=[['publications','Publications','/publication','title'],['authors','Writers','/writer','pen_name'],['categories','Subjects','/subject','caption'],['publication_categories','Memberships','/membership','annotation']] as const;
 for(const [table,title,record]of domains){await page.getByRole('treeitem').filter({hasText:title}).first().dblclick();await wizard(page,'Grid',title+' list',p.schema.tables.find(t=>t.physicalName===table)!.id,p.pages.find(q=>q.route===record)!.id);}
 const select=async(id:string)=>{await page.locator(`[role=treeitem][data-object-id="${id}"]`).dblclick();await page.getByRole('tab',{name:'Data',exact:true}).click();};
 for(const [name,,,display]of domains){p=await snapshot();const table=p.schema.tables.find(t=>t.physicalName===name)!; const grid=p.forms.find(f=>f.kind==='Grid'&&f.sourceRef?.id===table.id)!,record=p.forms.find(f=>f.kind==='Record'&&f.sourceRef?.id===table.id)!;
 await select(grid.id);await label(page,'Search '+display).selectOption('contains');if(name==='publications')await label(page,'Search author_id').selectOption('eq');if(name==='publication_categories')await label(page,'Search publication_id').selectOption('eq');await save(page);
 await select(record.id);await page.getByRole('group',{name:'Record name fields for delete confirmation'}).getByLabel(display,{exact:true}).check();for(const op of ['insert','update','delete'])await label(page,op+' success page').selectOption(grid.pageId);await label(page,'cancel destination page').selectOption(grid.pageId);await save(page);}
 await addPage(page,'Catalog search','/find');await wizard(page,'Search','Find publication',p.schema.tables.find(t=>t.physicalName==='publications')!.id);
 const searchForm=(await snapshot()).forms.find(f=>f.kind==='Search')!;await select(searchForm.id);await label(page,'Search title').selectOption('contains');await save(page);

 p=await snapshot();await select(p.pages.find(q=>q.route==='/access')!.id);await wizard(page,'Login','Catalog access','');p=await snapshot();const login=p.forms.find(f=>f.kind==='Login')!;await select(login.id);await label(page,'cancel destination page').selectOption(p.pages.find(q=>q.route==='/memberships')!.id);await save(page);
 for(const [op,name]of [['login','Sign in'],['logout','Sign out']]){const a=p.actions.find(a=>a.operation===op)!,c=p.controls.find(c=>c.events.some(e=>e.actionId===a.id))!;await select(c.id);await page.getByRole('tab',{name:'Format',exact:true}).click();await label(page,'Label').fill(name!);await save(page);}
 await button(page,'Login and access…').click();await button(page,'Save identity source').click();await expect(page.getByText('Security settings saved.',{exact:true})).toBeVisible();
 const username='catalog-librarian-'+root.split('-').at(-1),secret=randomBytes(32).toString('base64url');await label(page,'Visitor username').fill(username);await label(page,'Visitor password').fill(secret);await button(page,'Provision user').click();await expect(page.getByText('User provisioned. Credentials were cleared.',{exact:true})).toBeVisible();
 p=await snapshot();for(const f of p.forms.filter(f=>f.kind==='Grid'||f.kind==='Record')){await label(page,'Header form').selectOption(f.id);await button(page,'Place identity in page header').click();await expect.poll(async()=>(await snapshot()).controls.filter(c=>c.formId===f.id&&c.kind==='identity'&&!c.credentialRole).length).toBe(1);}
 for(const f of p.forms.filter(f=>f.kind==='Record')){await label(page,'Policy page').selectOption(f.pageId);await label(page,'Page access').selectOption('authenticated');for(const a of p.actions.filter(a=>a.formId===f.id&&['insert','update','delete'].includes(a.operation)))await label(page,`Access for ${a.operation} ${a.id}`).selectOption('authenticated');}await button(page,'Close').click();
 p=await snapshot();for(const [tableName,field,target] of [['publications','author_id','authors'],['publication_categories','publication_id','publications'],['publication_categories','category_id','categories']]as const){const t=p.schema.tables.find(t=>t.physicalName===tableName)!,f=p.forms.find(f=>f.kind==='Record'&&f.sourceRef?.id===t.id)!,c=p.controls.find(c=>c.formId===f.id&&c.binding?.kind==='stored'&&c.binding.fieldId===t.columns.find(c=>c.physicalName===field)!.id)!;await select(c.id);await label(page,'Lookup relationship').selectOption(p.schema.tables.find(t=>t.physicalName===target)!.id);await save(page);}
 writeFileSync(info.outputPath('authored-project.json'),JSON.stringify(await snapshot(),null,2));await page.screenshot({path:info.outputPath('visible-authored.png')});
  await button(page, 'Queries').click();
  const kind = async (name: string, value: string) => label(page, name + ' kind').selectOption(value);
  const field = async (name: string, value: string) => {
    await kind(name, 'field');
    await label(page, name + ' field').selectOption({
      label: value
    });
  };
  const section = async (name: string) => page.getByRole('navigation', {
    name: 'Query sections'
  }).getByRole('button', {
    name,
    exact: true
  }).click();
  const projection = async (i: number, name: string, value: string) => {
    await button(page, 'Add projection').click();
    await label(page, `Projection ${i} name`).fill(name);
    await field(`Projection ${i}`, value);
  };
  const queryStart = async (name: string) => {
    await button(page, 'New query').click();
    await label(page, 'Query name').fill(name);
  };
  const querySave = async () => {
    await button(page, 'Run preview').click();
    await expect(page.getByRole('status').filter({
      hasText: 'Preview complete'
    })).toBeVisible();
    await button(page, 'Save query').click();
    await expect(page.getByRole('status').filter({
      hasText: 'Query saved'
    })).toBeVisible();
  };

 await queryStart('Writer royalties');
 for(const [i,table,alias]of [[1,'authors','a'],[2,'publications','b']] as const){await label(page,'Add source').selectOption({label:'table: '+table});await label(page,`Source ${i} alias`).fill(alias);}
 await button(page,'Add join').click();await label(page,'Join 1 leftAlias').selectOption('a');await label(page,'Join 1 rightAlias').selectOption('b');await label(page,'Join 1 kind').selectOption('left');await label(page,'Join 1 cardinality').selectOption('one-to-many');await kind('Join 1 condition','binary');await field('Join 1 condition left','a.id');await field('Join 1 condition right','b.author_id');
 await section('Fields');await label(page,'Aggregate grain').selectOption('grouped');
 for(const [i,name,value]of [[1,'writer_id','a.id'],[2,'writer','a.pen_name']]as const){await projection(i,name,value);await button(page,`Group by projection ${i}`).click();await page.getByRole('checkbox',{name,exact:true}).check();}
 const total=async(name:string)=>{await kind(name,'aggregate');await field(name+' argument','b.royalty');};await button(page,'Add projection').click();await label(page,'Projection 3 name').fill('total');await total('Projection 3');
 await section('Parameters');await button(page,'Add parameter').click();await label(page,'Parameter 1 name').fill('minimum');await label(page,'Parameter 1 type').selectOption('decimal');await label(page,'Parameter 1 type rounding').selectOption('half-even');await page.getByRole('checkbox',{name:'Has default',exact:true}).check();await label(page,'Parameter 1 default').fill('0.00');
 await section('Fields');await button(page,'Add having').click();await kind('HAVING','binary');await label(page,'HAVING operator').selectOption('>=');await total('HAVING left');await kind('HAVING right','parameter');await label(page,'HAVING right parameter').selectOption({label:'minimum'});await querySave();await button(page,'Return to page').click();
 await addPage(page,'Writer royalty report','/royalties');p=await snapshot();const q=p.queries.find(q=>q.name==='Writer royalties')!;
 await button(page,'＋ Form').click();await label(page,'Form label').fill('Writer royalties');await label(page,'Form kind').selectOption('Grid');await page.getByRole('dialog').getByLabel('Data source',{exact:true}).selectOption('query:'+q.id);await button(page,'Next').click();for(const box of await page.getByRole('group',{name:'Fields, in selection order'}).getByRole('checkbox').all())await box.check();for(let i=0;i<3;i++)await button(page,'Next').click();await button(page,'Finish').click();await expect(page.getByRole('dialog')).toBeHidden();
  const childLink = async (formId: string, controlFieldId: string, pageId: string, targetFieldId: string, sourceFieldId: string) => {
    await select(formId);
    await button(page, 'Add action').click();
    await label(page, 'cancel operation').selectOption('navigate');
    const actionGroup = page.getByRole('group', {
      name: 'Action: navigate',
      exact: true
    }).last();
    await actionGroup.getByLabel('navigate destination page', {
      exact: true
    }).selectOption(pageId);
    await actionGroup.getByRole('group', {
      name: 'destination',
      exact: true
    }).getByRole('button', {
      name: 'Add filter mapping',
      exact: true
    }).click();
    await actionGroup.getByLabel('navigate destination filterMapping target 1', {
      exact: true
    }).selectOption(targetFieldId);
    await actionGroup.getByLabel('navigate destination filterMapping source 1', {
      exact: true
    }).selectOption(sourceFieldId);
    await save(page);
    p = await snapshot();
    const action = p.actions.find(a => a.formId === formId && a.destination?.pageId === pageId)!;
    const control = p.controls.find(c => c.formId === formId && c.binding?.kind === 'stored' && c.binding.fieldId === controlFieldId)!;
    await select(control.id);
    await label(page, 'Control type').selectOption('link');
    await page.getByRole('tab', {
      name: 'Events',
      exact: true
    }).click();
    await button(page, 'Add event').click();
    await label(page, 'Event action 1').selectOption(action.id);
    await save(page);
    return action;
  };

 p=await snapshot();const author=p.schema.tables.find(t=>t.physicalName==='authors')!,publication=p.schema.tables.find(t=>t.physicalName==='publications')!,membership=p.schema.tables.find(t=>t.physicalName==='publication_categories')!;
 const gridFor=(id:string)=>p.forms.find(f=>f.kind==='Grid'&&f.sourceRef?.id===id)!;
 const report=p.forms.find(f=>f.sourceRef?.id===q.id)!;await select(report.id);await label(page,'Input source minimum').selectOption('runtime');await label(page,'Runtime name minimum').fill('minimum');await save(page);
 await childLink(report.id,q.projections.find(f=>f.name==='writer')!.id,gridFor(publication.id).pageId,publication.columns.find(c=>c.physicalName==='author_id')!.id,q.projections.find(f=>f.name==='writer_id')!.id);
 await childLink(gridFor(author.id).id,author.columns.find(c=>c.physicalName==='pen_name')!.id,gridFor(publication.id).pageId,publication.columns.find(c=>c.physicalName==='author_id')!.id,author.columns[0]!.id);
 await childLink(gridFor(publication.id).id,publication.columns.find(c=>c.physicalName==='title')!.id,gridFor(membership.id).pageId,membership.columns.find(c=>c.physicalName==='publication_id')!.id,publication.columns[0]!.id);
 p=await snapshot();const mappedRecord=p.forms.find(f=>f.kind==='Record'&&f.sourceRef?.id===membership.id)!,mappedEdit=p.actions.find(a=>a.formId===gridFor(membership.id).id&&a.destination?.pageId===mappedRecord.pageId&&a.destination.keyMapping.length===2)!;expect(mappedEdit).toBeDefined();await button(page,'Flow map').click();const map=page.getByRole('tabpanel',{name:'Application flow map'});await map.locator('summary').filter({hasText:'Keyboard behavior list'}).click();await map.getByRole('group',{name:'Selectable behavior list'}).getByRole('button',{name:new RegExp('destination.*'+mappedEdit.id)}).first().click();for(let i=0;i<2;i++)await expect(label(page,`navigate destination keyMapping target ${i+1}`)).toHaveValue(membership.primaryKey[i]!);await page.screenshot({path:info.outputPath('composite-flow-properties.png')});await button(page,'Flow map').click();
 await page.getByRole('tab',{name:'Code',exact:true}).click();await page.getByText('Declare authored hook',{exact:true}).click();await label(page,'Hook kind').selectOption('validator');await label(page,'Module name').fill('catalog-validation');await button(page,'Declare hook').click();
 let generationCycle=0;
  const generate = async () => {
    await button(page, 'Generate…').click();
    await label(page, 'Output location').fill(catalogOutputRootId+':app');
    await button(page, 'Preview files').click();
    await expect(page.getByRole('dialog')).toContainText(/\d+ files to create\/change\/delete or preserve/);
    writeFileSync(info.outputPath('generation-review-' + generationCycle + '.txt'), await page.getByRole('dialog').innerText());
    generationCycle++;
    for (const box of await page.getByRole('dialog').getByRole('checkbox').all()) await box.check();
    await button(page, 'Create application').click();
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('Application created');
    await button(page, 'Close').click();
  };
  p=await snapshot();const membershipRecord=p.forms.find(f=>f.kind==='Record'&&f.sourceRef?.id===membership.id)!,membershipUpdate=p.actions.find(a=>a.formId===membershipRecord.id&&a.operation==='update')!,membershipButton=p.controls.find(c=>c.events.some(e=>e.actionId===membershipUpdate.id))!;const authoredCaption='Store "shelf" <&>';
 await select(membershipButton.id);await page.getByRole('tab',{name:'Format',exact:true}).click();await label(page,'Label').fill(authoredCaption);await page.getByRole('tab',{name:'Events',exact:true}).click();await label(page,'Event 1').selectOption('change');await save(page);
 await button(page,'Generate…').click();await label(page,'Output location').fill(catalogOutputRootId+':app');await button(page,'Preview files').click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('control event is not consumed');await page.screenshot({path:info.outputPath('unsupported-event-preview.png')});await button(page,'Cancel').click();await label(page,'Event 1').selectOption('click');await save(page);
 await generate();


 p=await snapshot();const contract=p.extensionContracts[0]!;
 await page.getByRole('tab',{name:'Code',exact:true}).click();await label(page,'Source output').fill(catalogOutputRootId+':app');await label(page,'Source module').selectOption(contract.id);await button(page,'Read source').click();await expect(label(page,'Source code')).toHaveValue(/Authored validator interface/);let authored=await label(page,'Source code').inputValue();const annotationField=membership.columns.find(c=>c.physicalName==='annotation')!.id;authored=authored.replace('(_context) => ({})',`(context) => context.values[${JSON.stringify(annotationField)}] === 'forbidden' ? {[${JSON.stringify(annotationField)}]:'Catalog annotation is reserved.'} : ({})`);authored+='\n// Publication Catalog authored preservation marker.\n';await label(page,'Source code').fill(authored);await button(page,'Save authored source').click();await expect(button(page,'Save authored source')).toBeEnabled();
 const output=join(root,'outputs','app'),npm=pinnedNpmCli;
 const install=()=>{const r=spawnSync(process.execPath,[npm,'ci','--ignore-scripts','--offline'],{cwd:output,encoding:'utf8',timeout:120000});expect(r.status,r.stdout+r.stderr).toBe(0);};install();
 const port=await new Promise<number>(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const a=server.address();const port=typeof a==='object'&&a?a.port:0;server.close(()=>resolve(port));});});
 const start=async()=>{await button(page,'Build generated output').click();await expect(button(page,'Start / retry')).toBeEnabled({timeout:120000});await label(page,'Runtime port').fill(String(port));await button(page,'Start / retry').click();await expect(page.getByRole('region',{name:'Managed generated runtime'}).locator('strong').first()).toHaveText('Generated runtime · running',{timeout:30000});};
 const stop=async()=>{await button(page,'Stop runtime').click();await expect(page.getByRole('region',{name:'Managed generated runtime'}).locator('strong').first()).toHaveText('Generated runtime · stopped');};
 await start();const origin='http://127.0.0.1:'+port,visitor=await browser.newContext(),app=await visitor.newPage();
 const rows=()=>{const d=oracle();try{return {authors:d.prepare('SELECT * FROM authors ORDER BY id').all(),publications:d.prepare('SELECT * FROM publications ORDER BY id').all(),categories:d.prepare('SELECT * FROM categories ORDER BY id').all(),memberships:d.prepare('SELECT * FROM publication_categories ORDER BY publication_id,category_id').all()};}finally{d.close();}};
 await app.goto(origin+'/membership');await expect(app.getByText('Sign in to continue to the selected page.',{exact:false})).toBeVisible();await label(app,'Username').fill(username);await label(app,'Password').fill(secret);await button(app,'Sign in').click();await expect(app).toHaveURL(/\/membership/);
 const add=async(route:string,values:Record<string,string>)=>{const record=p.forms.find(f=>f.kind==='Record'&&p.pages.find(q=>q.id===f.pageId)?.route===route)!,grid=p.forms.find(f=>f.kind==='Grid'&&f.sourceRef?.id===record.sourceRef?.id)!;await app.goto(origin+p.pages.find(q=>q.id===grid.pageId)!.route);await app.getByRole('link',{name:'New record',exact:true}).click();for(const [name,value]of Object.entries(values)){const control=label(app,name);if(await control.evaluate(e=>e.tagName)==='SELECT')await control.selectOption(value);else await control.fill(value);}await button(app,'Save').click();await expect(app.getByText('Record saved.',{exact:false})).toBeVisible();};
 await add('/writer',{id:'1',pen_name:'Octavia',email:'octavia@example.test'});await add('/writer',{id:'2',pen_name:'Silent',email:'silent@example.test'});await add('/publication',{id:'1',author_id:'1',title:'Dawn studies',royalty:'0.10'});await add('/publication',{id:'2',author_id:'1',title:'Evening studies',royalty:'1.25'});await add('/subject',{id:'1',caption:'Fiction'});await add('/subject',{id:'2',caption:'Essays'});await add('/membership',{publication_id:'1',category_id:'1',annotation:'Primary shelf'});await add('/membership',{publication_id:'1',category_id:'2',annotation:'Secondary shelf'});
 const initial=rows();expect(initial.memberships).toHaveLength(2);await app.goto(origin+'/find');await label(app,'title').fill('Dawn');await button(app,'search').click();await expect(app.getByRole('table')).toContainText('Dawn studies');await expect(app.getByRole('table')).not.toContainText('Evening studies');
 await app.goto(origin+'/memberships');await app.getByRole('row').filter({hasText:'Secondary shelf'}).getByRole('link',{name:'Edit record',exact:true}).click();await label(app,'annotation').fill('forbidden');await button(app,authoredCaption).click();await expect(app.getByRole('alert').filter({hasText:'Catalog annotation is reserved.'})).toBeVisible();expect(rows().memberships).toEqual(initial.memberships);await label(app,'annotation').fill('Revised shelf');await button(app,authoredCaption).click();await expect(app.getByText('Record saved.',{exact:false})).toBeVisible();expect(rows().memberships).toEqual([{publication_id:1,category_id:1,annotation:'Primary shelf'},{publication_id:1,category_id:2,annotation:'Revised shelf'}]);
 await app.getByRole('row').filter({hasText:'Revised shelf'}).getByRole('link',{name:'Edit record',exact:true}).click();await label(app,'annotation').fill('Discard me');await button(app,'Cancel').click();await expect(app).toHaveURL(origin+'/memberships');expect(rows().memberships).toEqual([{publication_id:1,category_id:1,annotation:'Primary shelf'},{publication_id:1,category_id:2,annotation:'Revised shelf'}]);
 await app.getByRole('row').filter({hasText:'Revised shelf'}).getByRole('link',{name:'Edit record',exact:true}).click();await label(app,'Confirm deletion of Revised shelf').check();await button(app,'Delete').click();await expect(app).toHaveURL(origin+'/memberships');expect(rows().memberships).toEqual([{publication_id:1,category_id:1,annotation:'Primary shelf'}]);
 await app.goto(origin+'/');await app.getByRole('row').filter({hasText:'Dawn studies'}).getByRole('link',{name:'Edit record',exact:true}).click();await label(app,'royalty').fill('invalid');await button(app,'Save').click();await expect(app.getByText('Correct the highlighted fields.',{exact:true})).toBeVisible();await expect(label(app,'royalty')).toHaveValue('invalid');expect(rows().publications).toEqual(initial.publications);await label(app,'royalty').fill('0.10');await label(app,'Confirm deletion of Dawn studies').check();await button(app,'Delete').click();await expect(app.getByRole('alert').filter({hasText:/related/i})).toBeVisible();expect(rows().publications).toEqual(initial.publications);
 const totals=()=>{const d=oracle();try{const authors=d.prepare('SELECT id,pen_name FROM authors ORDER BY id').all()as{id:number;pen_name:string}[];const pubs=d.prepare('SELECT author_id,royalty FROM publications').all()as{author_id:number;royalty:string}[];return authors.map(a=>({name:a.pen_name,total:(()=>{const cents=pubs.filter(p=>p.author_id===a.id).reduce((sum,p)=>sum+BigInt(p.royalty.replace('.','')),0n);return String(cents/100n)+'.'+String(cents%100n).padStart(2,'0');})()}));}finally{d.close();}};
 await app.goto(origin+'/royalties');for(const t of totals())await expect(app.getByRole('row').filter({hasText:t.name})).toContainText(t.total);expect(totals()).toEqual([{name:'Octavia',total:'1.35'},{name:'Silent',total:'0.00'}]);await app.screenshot({path:info.outputPath('report.png')});await label(app,'minimum').fill('1.00');await app.getByRole('combobox',{name:'Input mode',exact:true}).selectOption('value');await button(app,'Apply parameters').click();await expect(app.getByRole('row').filter({hasText:'Silent'})).toHaveCount(0);await expect(app.getByRole('row').filter({hasText:'Octavia'})).toContainText('1.35');
 await app.getByRole('link',{name:'Octavia',exact:true}).click();await expect(app.getByRole('table')).toContainText('Dawn studies');await app.getByRole('link',{name:'Dawn studies',exact:true}).click();await expect(app.getByRole('table')).toContainText('Primary shelf');await expect(app.getByRole('table')).not.toContainText('Revised shelf');
 const filteredMemberships=app.url();await button(app,'Sign out').click();await expect(app).toHaveURL(origin+'/');await app.goto(filteredMemberships);await app.getByRole('row').filter({hasText:'Primary shelf'}).getByRole('link',{name:'Edit record',exact:true}).click();await app.getByRole('link',{name:'cancel',exact:true}).click();await expect.poll(()=>canonicalUrl(app.url())).toBe(canonicalUrl(filteredMemberships));await app.getByRole('row').filter({hasText:'Primary shelf'}).getByRole('link',{name:'Edit record',exact:true}).click();await label(app,'Username').fill(username);await label(app,'Password').fill(secret);await button(app,'Sign in').click();await expect(label(app,'annotation')).toHaveValue('Primary shelf');
 const preserved=rows();await stop();
 await button(page,'Schema').click();await page.locator('.schema-table-list').getByRole('button',{name:/publications/}).click();await page.getByRole('tab',{name:'Columns',exact:true}).click();await button(page,'＋ Column').click();await label(page,'Column name').fill('editor_note');await label(page,'Allow NULL').check();await button(page,'Save schema').click();await expect(page.locator('.schema-messages p[role=status]')).toContainText('Schema definition saved');await button(page,'Review migration…').click();writeFileSync(info.outputPath('evolution-review.txt'),await page.getByRole('dialog').innerText());for(const box of await page.getByRole('dialog').getByRole('checkbox').all())await box.check();await button(page,'Apply reviewed migration').click();await expect(page.locator('.schema-messages p[role=status]')).toContainText('Migration committed');
 const evolved=rows();expect(evolved.memberships).toEqual(preserved.memberships);expect(evolved.authors).toEqual(preserved.authors);expect(evolved.publications).toEqual(preserved.publications.map(r=>({...r as object,editor_note:null})));
 const history=()=>{const d=oracle();try{return d.prepare("SELECT * FROM __schema_baron_migrations WHERE id <> '@authority' ORDER BY id").all();}finally{d.close();}};const migrationHistory=history();expect(migrationHistory.length).toBe(2);await button(page,'Schema').click();
 for(const cycle of [1,2]){await select(p.pages.find(q=>q.route==='/membership')!.id);await page.getByRole('tab',{name:'Code',exact:true}).click();await label(page,'Source output').fill(catalogOutputRootId+':app');await label(page,'Source module').selectOption(contract.id);await button(page,'Read source').click();await expect(label(page,'Source code')).toHaveValue(authored);authored+=`\n// Regeneration cycle ${cycle}.\n`;await label(page,'Source code').fill(authored);await button(page,'Save authored source').click();await expect(button(page,'Save authored source')).toBeEnabled();await generate();install();expect(readFileSync(join(output,contract.relativePath),'utf8')).toBe(authored);expect(rows()).toEqual(evolved);expect(history()).toEqual(migrationHistory);await start();await app.goto(origin+'/royalties');await expect(app.getByRole('row').filter({hasText:'Octavia'})).toContainText('1.35');if(cycle===2){await add('/membership',{publication_id:'1',category_id:'2',annotation:'Cycle shelf'});await app.getByRole('row').filter({hasText:'Cycle shelf'}).getByRole('link',{name:'Edit record',exact:true}).click();await label(app,'annotation').fill('Cycle revised');await button(app,authoredCaption).click();await expect(app.getByText('Record saved.',{exact:false})).toBeVisible();await app.getByRole('row').filter({hasText:'Cycle revised'}).getByRole('link',{name:'Edit record',exact:true}).click();await label(app,'Confirm deletion of Cycle revised').check();await button(app,'Delete').click();await expect(app).toHaveURL(origin+'/memberships');expect(rows()).toEqual(evolved);}await stop();}
 const settings=await snapshot();await page.reload();p=await snapshot();expect(p.forms).toEqual(settings.forms);expect(p.queries).toEqual(settings.queries);expect(p.policies).toEqual(settings.policies);expect(rows()).toEqual(evolved);await select(p.pages.find(q=>q.route==='/membership')!.id);await page.getByRole('tab',{name:'Code',exact:true}).click();await label(page,'Source output').fill(catalogOutputRootId+':app');await label(page,'Source module').selectOption(contract.id);await button(page,'Read source').click();await expect(label(page,'Source code')).toHaveValue(authored);await page.screenshot({path:info.outputPath('reopened-source.png')});

 // Same owner process reopens the retained Equipment study via its supported root registration.
 const equipmentSummary=(await read('projects?approvedRoot=projects')).find((x:{name:string})=>x.name==='Equipment Desk');expect(equipmentSummary).toBeDefined();
 const equipmentRows=()=>{const d=new Database(join(equipmentRoot,'definitions/equipment.sqlite'),{readonly:true});try{return ['assets','borrowers','loans','loan_lines'].map(t=>d.prepare('SELECT * FROM '+t+' ORDER BY id').all());}finally{d.close();}};const equipmentBefore=equipmentRows();
 const switchTo=async(name:string)=>{await button(page,'Open / Switch…').click();await page.getByRole('dialog').getByRole('button',{name:new RegExp(name)}).click();await expect(page.getByRole('dialog')).toBeHidden();};
 await switchTo('Equipment Desk');const equipmentProject=await read('projects/'+equipmentSummary.id)as Project;await select(equipmentProject.pages[0]!.id);await page.getByRole('tab',{name:'Code',exact:true}).click();await button(page,'Login and access…').click();const equipmentSecret=randomBytes(32).toString('base64url');await label(page,'Visitor username').fill(username);await label(page,'Visitor password').fill(equipmentSecret);await button(page,'Provision user').click();await expect(page.getByText('User provisioned. Credentials were cleared.',{exact:true})).toBeVisible();await button(page,'Close').click();
 const eqPort=await new Promise<number>(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const a=s.address(),v=typeof a==='object'&&a?a.port:0;s.close(()=>resolve(v));});});
 await button(page,'Build generated output').click();await expect(button(page,'Start / retry')).toBeEnabled({timeout:120000});await label(page,'Runtime port').fill(String(eqPort));await button(page,'Start / retry').click();await expect(page.getByRole('region',{name:'Managed generated runtime'}).locator('strong').first()).toHaveText('Generated runtime · running',{timeout:30000});
 const equipmentOrigin='http://127.0.0.1:'+eqPort,equipmentApp=await visitor.newPage();await equipmentApp.goto(equipmentOrigin+'/report');await expect(equipmentApp.getByRole('table')).toContainText('Ada');await expect(equipmentApp.getByRole('table')).not.toContainText('Octavia');await equipmentApp.goto(equipmentOrigin+'/line');await expect(label(equipmentApp,'Username')).toBeVisible();await label(equipmentApp,'Username').fill(username);await label(equipmentApp,'Password').fill(secret);await button(equipmentApp,'Sign in').click();await expect(equipmentApp.getByRole('alert').filter({hasText:'Sign in failed'})).toBeVisible();await label(equipmentApp,'Password').fill(equipmentSecret);await button(equipmentApp,'Sign in').click();await expect(equipmentApp).toHaveURL(/\/line/);
 await switchTo('Publication Catalog');await start();await app.goto(origin+'/royalties');await expect(app.getByRole('table')).toContainText('Octavia');await expect(app.getByRole('table')).not.toContainText('Ada');await app.goto(origin+'/memberships');await app.getByRole('row').filter({hasText:'Primary shelf'}).getByRole('link',{name:'Edit record',exact:true}).click();await expect(label(app,'annotation')).toHaveValue('Primary shelf');
 const cookies=await visitor.cookies();expect(new Set(cookies.filter(c=>c.name.startsWith('visitor_')&&!c.name.endsWith('_csrf')).map(c=>c.name)).size).toBe(2);await stop();await switchTo('Equipment Desk');await select(equipmentProject.pages[0]!.id);await page.getByRole('tab',{name:'Code',exact:true}).click();await stop();await expect.poll(()=>fetch(equipmentOrigin).then(()=>true,()=>false)).toBe(false);await expect.poll(()=>fetch(origin).then(()=>true,()=>false)).toBe(false);expect(equipmentRows()).toEqual(equipmentBefore);expect(rows()).toEqual(evolved);
 await switchTo('Publication Catalog');
 const mcpConfig=join(root,'mcp.json');writeFileSync(mcpConfig,JSON.stringify({ownerUrl:url,capability}),{mode:0o600});const agent=new Client({name:'draft-isolation',version:'1'});await agent.connect(new StdioClientTransport({command:process.execPath,args:[resolve('apps/mcp/dist/main.js')],env:{SCHEMA_BARON_MCP_CONFIG:mcpConfig},stderr:'pipe'}));
 try{
 const main=p.pages.find(q=>q.route==='/')!,other=p.pages.find(q=>q.route==='/writers')!;await select(main.id);await page.getByRole('tab',{name:'Format',exact:true}).click();await label(page,'Title').fill('Unrelated local catalog draft');await select(other.id);await page.getByRole('tab',{name:'Format',exact:true}).click();await label(page,'Title').fill('');
 const edit=async(id:string,patch:Record<string,string>)=>{const current=await snapshot(),pageValue=current.pages.find(q=>q.id===id)!;const result=await agent.callTool({name:'project_batch',arguments:{projectId:current.id,expectedRevision:current.revision,requestId:crypto.randomUUID(),input:{operations:[{kind:'put',entity:'page',id,value:{...pageValue,...patch}}]}}});expect(result.structuredContent).toMatchObject({ok:true});};
 await edit(main.id,{route:'/catalog'});await expect(label(page,'Title')).toHaveValue('');await switchTo('Equipment Desk');await switchTo('Publication Catalog');await expect(label(page,'Title')).toHaveValue('');
 // Force the documented event-gap signal at the HTTP event boundary, with the real snapshot fetched afterward.
 let gaps=0;await page.route('**/api/v1/projects/*/events?*',async route=>{gaps++;await route.fulfill({status:200,contentType:'text/event-stream',body:'event: refetch\ndata: {"refetchRequired":true}\n\n'});});await expect.poll(()=>gaps).toBeGreaterThan(0);await expect(label(page,'Title')).toHaveValue('');await page.unroute('**/api/v1/projects/*/events?*');
 let reconnects=0;await page.route('**/api/v1/projects/*/events?*',async route=>{reconnects++;await route.abort('connectionrefused');});await expect.poll(()=>reconnects).toBeGreaterThan(0);await expect(label(page,'Title')).toHaveValue('');await page.unroute('**/api/v1/projects/*/events?*');await edit(main.id,{route:'/catalog-reconnected'});await expect(page.getByRole('status')).toContainText('received');await expect(label(page,'Title')).toHaveValue('');
 page.on('dialog',d=>void d.accept());await page.reload();await expect(label(page,'Title')).toHaveValue('');await button(page,'↶ Undo').click();await expect(label(page,'Title')).toHaveValue('Writers');await button(page,'↷ Redo').click();await expect(label(page,'Title')).toHaveValue('');
 await edit(other.id,{title:'Agent writer title'});await expect(page.getByRole('alert').filter({hasText:'Conflicting service revision'})).toBeVisible();await expect(button(page,'▣ Save')).toBeDisabled();await expect(label(page,'Title')).toHaveValue('');const conflict=await snapshot();expect(conflict.pages.find(q=>q.id===main.id)!.title).toBe(main.title);expect(conflict.pages.find(q=>q.id===other.id)!.title).toBe('Agent writer title');await page.screenshot({path:info.outputPath('conflicting-draft.png')});
 await button(page,'Keep my draft').click();await label(page,'Title').fill('Writer directory');await select(main.id);await page.getByRole('tab',{name:'Format',exact:true}).click();await expect(label(page,'Title')).toHaveValue('Unrelated local catalog draft');await page.getByRole('tab',{name:'Data',exact:true}).click();await expect(label(page,'Route')).toHaveValue('/catalog-reconnected');await save(page);const reconciled=await snapshot();expect(reconciled.pages.find(q=>q.id===main.id)!.title).toBe('Unrelated local catalog draft');expect(reconciled.pages.find(q=>q.id===other.id)!.title).toBe('Writer directory');
 writeFileSync(info.outputPath('isolation.json'),JSON.stringify({equipmentUnchanged:equipmentRows(),publicationUnchanged:rows(),eventGapObserved:gaps>0,bothRuntimeGroupsStopped:true,distinctSessionCookieNames: cookies.filter(c=>c.name.startsWith('visitor_')&&!c.name.endsWith('_csrf')).map(c=>c.name),conflictRevision:conflict.revision,reconciledRevision:reconciled.revision},null,2));
 }finally{await agent.close();await equipmentApp.close();}

 p=await snapshot();const restoredMain=p.pages.find(q=>q.route==='/catalog-reconnected')!,restoredWriter=p.pages.find(q=>q.route==='/writers')!;await select(restoredMain.id);await page.getByRole('tab',{name:'Format',exact:true}).click();await label(page,'Title').fill('Publications');await page.getByRole('tab',{name:'Data',exact:true}).click();await label(page,'Route').fill('/');await select(restoredWriter.id);await page.getByRole('tab',{name:'Format',exact:true}).click();await label(page,'Title').fill('Writers');await save(page);await generate();install();await page.getByRole('tab',{name:'Code',exact:true}).click();await start();await app.goto(origin+'/royalties');await expect(app.getByRole('row').filter({hasText:'Octavia'})).toContainText('1.35');await stop();
 p=await snapshot();const verified=oracle();try{expect(verified.pragma('integrity_check')).toEqual([{integrity_check:'ok'}]);expect(verified.pragma('foreign_key_check')).toEqual([]);writeFileSync(info.outputPath('migration-history.json'),JSON.stringify(verified.prepare("SELECT * FROM __schema_baron_migrations WHERE id <> '@authority' ORDER BY id").all(),null,2));}finally{verified.close();}
 await page.getByText('Portable definition and output export',{exact:true}).click();await label(page,'Export destination').fill(catalogOutputRootId+':portable');await page.getByRole('checkbox',{name:/I reviewed including/}).check();await button(page,'Export portable application').click();await expect(page.getByRole('alert').filter({hasText:'Portable export created'})).toBeVisible();
 writeFileSync(info.outputPath('final-project.json'),JSON.stringify(p,null,2));writeFileSync(info.outputPath('final-rows.json'),JSON.stringify(evolved,null,2));writeFileSync(info.outputPath('expected-authored.json'),JSON.stringify({[contract.relativePath]:authored},null,2));
 const walk=(directory:string):string[]=>readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(directory,e.name)):[join(directory,e.name)]);const scanned=[...walk(info.outputDir),...walk(join(output,'.next','static')),...walk(join(equipmentRoot,'outputs/app/.next/static'))];for(const file of scanned){const bytes=readFileSync(file);for(const value of [secret,equipmentSecret,capability])expect(bytes.includes(Buffer.from(value)),'Secret absent from retained evidence and static clients').toBe(false);}for(const value of [secret,equipmentSecret,capability])expect(JSON.stringify(p).includes(value)).toBe(false);writeFileSync(info.outputPath('credential-scan.json'),JSON.stringify({fileCount:scanned.length,visitorPasswordsAbsent:true,ownerCapabilityAbsent:true,scope:'retained evidence, both static client builds and project model'},null,2));
 await visitor.close();

});
