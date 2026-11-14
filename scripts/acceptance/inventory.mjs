import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeLedger, validateObservation, readObservations } from './evidence.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=name=>JSON.parse(readFileSync(resolve(root,`fixtures/acceptance/${name}.json`),'utf8'));
const fail=message=>{throw new Error(message);};
const same=(actual,expected,label)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))fail(`Descriptor oracle mismatch: ${label}`);};
const cents=value=>{if(!/^\d+\.\d{2}$/.test(value))fail('Expected exact nonnegative decimal string');return BigInt(value.replace('.',''));};
const decimal=value=>`${value/100n}.${String(value%100n).padStart(2,'0')}`;
export function checkDescriptors() {
 const workshop=read('workshop'),library=read('library'),catalog=read('cases');
 if(catalog.cases.length!==20||Object.keys(catalog.requirements).length!==29)fail('Incomplete acceptance catalog');
 for(const c of catalog.cases) for(const path of c.existing_tests)if(!existsSync(resolve(root,path)))fail(`Missing inventory reference: ${path}`);
 const counts=workshop.rows.workshops.map(w=>({id:w.id,count:workshop.rows.sessions.filter(s=>s.workshop_id===w.id).length}));
 same(counts,workshop.expected.session_counts,'workshop counts');
 same(counts.filter(x=>x.count>=1).map(x=>x.id),workshop.expected.minimum_count_1,'workshop threshold');
 const authors=library.rows.authors.map(a=>({id:a.id,count:new Set(library.rows.book_authors.filter(x=>x.author_id===a.id).map(x=>x.book_id)).size}));
 same(authors,library.expected.author_book_counts,'author distinct counts');
 const totals=library.rows.books.map(b=>({id:b.id,total:decimal(library.rows.copies.filter(c=>c.book_id===b.id).reduce((sum,c)=>sum+(c.replacement_cost===null?0n:cents(c.replacement_cost)),0n))}));
 same(totals,library.expected.book_copy_totals,'copy exact totals');
 same(totals.filter(x=>cents(x.total)>=1500n).map(x=>x.id),library.expected.minimum_total_15,'library threshold');
 const v=library.variants.copy_lifecycle,base=cents(totals.find(x=>x.id===v.input.book_id).total);
 same(decimal(base+cents(v.input.replacement_cost)),v.after_add_total,'copy addition');
 same(decimal(base+cents(v.edit_cost)),v.after_edit_total,'copy edit');same(decimal(base),v.after_delete_total,'copy deletion');
 same(library.tables.find(t=>t.name==='book_authors').primary_key,['book_id','author_id'],'ordered composite identity');
 for(const name of ['workshop','library'])if(read(name).purpose.includes('Studio model seed')===false&&name==='workshop')fail('Fixture intent missing');
 return {workshop:'passed: descriptor arithmetic only',library:'passed: descriptor arithmetic only'};
}
export function inventory() {
 const fixture_checks=checkDescriptors();
 const ledger=summarizeLedger([],{artifactRoot:root});
 return {...ledger,source_revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),historical_baseline:'fe22d9b06be0967b1dec89c352d2979787330f34',toolchain:{node:process.versions.node},fixture_checks,fixtures:Object.fromEntries(['cases','workshop','library'].map(name=>[name,createHash('sha256').update(readFileSync(resolve(root,`fixtures/acceptance/${name}.json`))).digest('hex')])),cases:ledger.cases.map(c=>({...c,...read('cases').cases.find(x=>x.case_id===c.case_id)}))};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {
  const args=process.argv.slice(2);
  if(args.length===0)console.log(JSON.stringify(inventory(),null,2));
  else if(args[0]==='validate-observation' && args.length===3) {
   const observation=JSON.parse(readFileSync(resolve(args[1]),'utf8'));
   validateObservation(observation,{artifactRoot:resolve(args[2])});
   console.log(JSON.stringify({valid:true,case_id:observation.case_id,note:'Observation shape/hash validation only; not final acceptance.'}));
  } else if(args[0]==='check-ledger' && args.length===4) {
   const options={storageDir:resolve(args[1]),artifactRoot:resolve(args[2]),revision:args[3],requireComplete:true,requirePassed:true};
   console.log(JSON.stringify(summarizeLedger(readObservations(options),options),null,2));
  } else fail('Usage: node scripts/acceptance/inventory.mjs [validate-observation <input.json> <artifact-root> | check-ledger <private-ledger-dir> <artifact-root> <revision>]');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
