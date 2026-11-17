import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { store,sessionCookie } from './server/authorization.ts';
import { visibleMenu } from './server/sidenav.ts';
import { menuEntries } from './server/sidenav-config.ts';
const anon=visibleMenu(undefined,'login-page');assert.deepEqual(anon.map(link=>link.label),['Sign in','Public guide']);assert.equal(anon.filter(link=>link.active).length,1);
assert.deepEqual(visibleMenu('invalid','login-page'),anon);
const identity=store();try {
 await identity.provision('nav-user','Synthetic-nav-passphrase-42','nav-provision');
 const session=await identity.login('nav-user','Synthetic-nav-passphrase-42',undefined,'local-test');assert.ok(session?.token);
 const links=visibleMenu(session.token,'private-page');assert.deepEqual(links.map(link=>link.label),['Sign in','Secret destination','Public guide','Staff handbook']);assert.equal(links.filter(link=>link.active).length,1);
 // Runtime defense-in-depth: tampered external hrefs/unknown pages never render.
 menuEntries.push({id:'bad1',label:'BAD1',kind:'external',url:'javascript:alert(1)',visibility:'public'},{id:'bad2',label:'BAD2',kind:'external',url:'https://u:p@example.com',visibility:'public'},{id:'bad3',label:'BAD3',kind:'page',pageId:'missing',href:'/missing',requiresContext:false},{id:'bad4',label:'BAD4',kind:'page',pageId:'private-page',href:'/changed',requiresContext:false},{id:'needs-key',label:'KEY REQUIRED',kind:'page',pageId:'private-page',href:'/private',requiresContext:true});
 assert.equal(JSON.stringify(visibleMenu(session.token,'private-page')).includes('BAD'),false);assert.equal(JSON.stringify(visibleMenu(session.token,'private-page')).includes('KEY REQUIRED'),false);
 menuEntries.push({...menuEntries[1],id:'same-destination'});assert.equal(visibleMenu(session.token,'private-page').filter(link=>link.active).length,1);
 const revoked=await identity.login('nav-user','Synthetic-nav-passphrase-42',undefined,'local-revoked');identity.logout(revoked.token);assert.deepEqual(visibleMenu(revoked.token,'login-page'),anon);
 const expired=await identity.login('nav-user','Synthetic-nav-passphrase-42',undefined,'local-expired',Date.now()-1000,1);assert.deepEqual(visibleMenu(expired.token,'login-page'),anon);
 writeFileSync('./synthetic-session.json',JSON.stringify({token:session.token,cookie:sessionCookie}));
}finally{identity.close();}
console.log('Real IdentityStore authorization: anonymous, invalid, valid, expired, revoked, malformed href and context omission passed.');
