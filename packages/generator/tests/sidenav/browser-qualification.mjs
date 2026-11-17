import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
const app=process.argv[2];if(!app?.startsWith('/tmp/baron-sidenav-runtime-')||!app.endsWith('/app'))throw Error('Synthetic generated app required');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','0'],{cwd:app,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
let logs='',browser;const exited=new Promise(resolve=>child.once('exit',resolve));
try{
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs)),20000);const read=chunk=>{logs+=chunk;const match=logs.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}};child.stdout.on('data',read);child.stderr.on('data',read);child.once('exit',()=>{clearTimeout(timer);reject(Error(logs));});});
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',chromiumSandbox:true,headless:true});const context=await browser.newContext({viewport:{width:1280,height:800}});
 await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());const page=await context.newPage();await page.goto(url+'/login');
 const nav=page.getByRole('navigation',{name:'Main navigation'});assert.equal(await nav.getByRole('link',{name:'Public guide'}).isVisible(),true);assert.equal(await nav.getByRole('link',{name:'Secret destination'}).count(),0);assert.equal(await nav.locator('[aria-current="page"]').count(),1);
 const desktopNav=await nav.boundingBox(),desktopHeading=await page.getByRole('heading',{level:1}).boundingBox();assert.ok(desktopNav&&desktopHeading);assert.ok(desktopNav.x+desktopNav.width<desktopHeading.x,'Desktop nav must sit left of actual page heading');assert.equal(await page.locator('.generated-app-content').getByRole('heading',{level:1}).count(),1);
 await page.setViewportSize({width:360,height:760});const summary=nav.locator('summary');await summary.focus();await page.keyboard.press('Enter');assert.equal(await nav.getByRole('link',{name:'Public guide'}).isVisible(),false);await page.keyboard.press('Enter');assert.equal(await nav.getByRole('link',{name:'Public guide'}).isVisible(),true);
  const narrowNav=await nav.boundingBox(),narrowHeading=await page.getByRole('heading',{level:1}).boundingBox();assert.ok(narrowNav&&narrowHeading);assert.ok(narrowNav.y+narrowNav.height<=narrowHeading.y,'Narrow menu precedes content in normal flow');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 console.log('Sandboxed Chrome: desktop links visible; 360px keyboard menu closes/reopens, no horizontal overflow or anonymous private link.');
}finally{await browser?.close();child.kill('SIGTERM');await exited;}
