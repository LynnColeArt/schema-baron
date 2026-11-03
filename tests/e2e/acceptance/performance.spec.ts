import { test, expect, type Page } from '@playwright/test';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpus, totalmem, loadavg, platform, release } from 'node:os';
import { workshopJourney } from './workshop-journey.js';
import { libraryJourney } from './library-journey.js';
import { button, label, saveProject, startIsolatedStudio } from './helpers.js';
import { percentile95 } from '../../../scripts/acceptance/report.mjs';

test.use({ trace:'off', actionTimeout:15000, viewport:{width:1440,height:1000} });
test.describe.configure({retries:0});test.setTimeout(1200000);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const authored=(directory:string):[string,string][]=>!existsSync(directory)?[]:readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?authored(join(directory,entry.name)):[[join(directory,entry.name).split('/authored/').at(-1)!,createHash('sha256').update(readFileSync(join(directory,entry.name))).digest('hex')] as [string,string]]);
async function properties(page:Page,id:string){await page.locator(`[role=treeitem][data-object-id="${id}"]`).dblclick();await page.getByRole('tab',{name:'Format',exact:true}).click();}
for(const [application,journey] of [['workshop',workshopJourney],['library',libraryJourney]] as const)test(application+' thirty measured UI edits and durable Saves preserve active draft and exact fixture',async({page,browser},info)=>{
 const studio=await startIsolatedStudio('schema-baron-performance-'+application+'-');const contexts:import('@playwright/test').BrowserContext[]=[];
 try{await journey(page,browser,info,studio,{onVisitor:context=>contexts.push(context),populated:async fixture=>{
  const before=await studio.project(fixture.project.id),rows=fixture.rows(),declared=authored(join(fixture.directory,'generated/app/authored'));
  const draft=before.pages[0]!,other=before.pages[1]!;await properties(page,draft.id);const title=label(page,'Title');
  const text=application+' unsaved measured draft';await title.fill(text);await title.focus();await title.press('Home');await title.press('ArrowRight');await title.press('Shift+ArrowRight');
  const remote=await page.context().newPage();
  const samples:{sample:number;feedbackMs:number;saveMs:number;receiptMs:number;load:number[]}[]=[];
  try{
   await remote.goto(studio.url);await button(remote,'Open / Switch…').click();await remote.getByRole('dialog').getByRole('button',{name:new RegExp('^'+fixture.project.name+'\\s*r')}).click();await expect(remote.getByRole('dialog')).toBeHidden();await properties(remote,other.id);
   for(let i=0;i<30;i++){
    const value=`Measured ${application} unrelated revision ${i+1}`,start=performance.now();await label(remote,'Title').fill(value);
    await expect(remote.locator(`[role=treeitem][data-object-id="${other.id}"]`)).toContainText(value);const feedbackMs=performance.now()-start,saveStart=performance.now();
    await saveProject(remote);const durable=await studio.project(before.id);expect(durable.pages.find(p=>p.id===other.id)?.title).toBe(value);const saveMs=performance.now()-saveStart;
    await expect(page.locator(`[role=treeitem][data-object-id="${other.id}"]`)).toContainText(value);
    await expect(title).toHaveValue(text);await expect(title).toBeFocused();expect(await title.evaluate((e:HTMLInputElement)=>[e.selectionStart,e.selectionEnd])).toEqual([1,2]);await expect(title).toHaveCount(1);
    expect(fixture.rows()).toEqual(rows);expect(authored(join(fixture.directory,'generated/app/authored'))).toEqual(declared);
    expect({...durable,revision:before.revision,pages:before.pages}).toEqual(before);expect(durable.pages.filter(p=>p.id!==other.id)).toEqual(before.pages.filter(p=>p.id!==other.id));
    samples.push({sample:i+1,feedbackMs,saveMs,receiptMs:performance.now()-saveStart,load:loadavg()});
    writeFileSync(info.outputPath('performance-summary.json'),JSON.stringify({application,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reference:{node:process.version,browser:browser.version(),cpu:cpus()[0]?.model,cores:cpus().length,totalMemory:totalmem(),platform:platform(),release:release(),load:'Recorded for every sample; sequential workers=1, no other owned pipeline'},dataset:{tables:before.schema.tables.length,rows:Object.fromEntries(Object.entries(rows as Record<string,unknown[]>).map(([name,values])=>[name,values.length]))},method:'feedback: fill through visible tree; Save: visible acknowledgement plus exact durable title; receipt: drafting tab sees revision; no dependency/build timing included',samples,p95FeedbackMs:percentile95(samples.map(s=>s.feedbackMs)),p95SaveMs:percentile95(samples.map(s=>s.saveMs)),thresholds:{feedbackMs:2000,validSaveMs:5000},preservation:{text:true,selection:true,focus:true,ownership:true,singleControl:true,rowsHash:digest(rows),modelExceptIntentionalUnrelatedTitle:true,authoredHash:digest(declared),authoredFileCount:declared.length},zeroRetries:true},null,2),{mode:0o600});
   }
   expect(samples).toHaveLength(30);expect(percentile95(samples.map(s=>s.feedbackMs))).toBeLessThanOrEqual(2000);expect(Math.max(...samples.map(s=>s.saveMs))).toBeLessThanOrEqual(5000);
   // Restore intentional title edits through the same controls before the original journey resumes.
   await label(remote,'Title').fill(other.title);await saveProject(remote);
   await expect(page.locator(`[role=treeitem][data-object-id="${other.id}"]`)).toContainText(other.title);
   await title.fill(draft.title);await expect(button(page,'▣ Save')).toBeDisabled();
   const after=await studio.project(before.id);expect({...after,revision:before.revision}).toEqual(before);expect(fixture.rows()).toEqual(rows);expect(authored(join(fixture.directory,'generated/app/authored'))).toEqual(declared);
  }finally{await remote.close();}
 }});}finally{for(const context of contexts)await context.close();await studio.stop();}
});
