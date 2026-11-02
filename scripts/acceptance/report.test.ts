import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { browserCensus, qualify, percentile95, catalog, phaseContract, validatePhase, requiredChecks, dispositions } from './report.mjs';
import { createRun, appendDefect, appendObservation, readObservations, summarizeLedger } from './evidence.mjs';
const revision='a'.repeat(40),artifactRoot=mkdtempSync(join(tmpdir(),'baron-report-tests-')),options={artifactRoot};let sequence=0;
after(()=>rmSync(artifactRoot,{recursive:true,force:true}));
function evidence(value:unknown){const path=`docs/evidence/verification/proof-${++sequence}.json`,bytes=JSON.stringify(value,null,2)+'\n';mkdirSync(join(artifactRoot,'docs/evidence/verification'),{recursive:true});writeFileSync(join(artifactRoot,path),bytes);return {path,sha256:createHash('sha256').update(bytes).digest('hex')};}
function phaseProof(phase:string){
 const count=phaseContract[phase],tests=Array.from({length:count},(_,i)=>({title:i%2?'library':'workshop',status:phase==='fault'?'passed':'expected',...(phase==='fault'?{}:{attempts:[{status:'passed',retry:0}]})}));
 const proof:any={passed:true,mode:phase==='parity'?'parity':phase==='fault'?'fault':'ui_journey',revision,exitCode:0,signal:null,census:{passed:true,count,expected:count,exitCode:0,errors:0,tests},details:[]};
 if(phase==='regeneration')proof.details=['Workshop Planner','Library Catalog'].map(application=>({kind:'regeneration-summary.json',data:{revision,application,cycles:2,identityInvariantsPreserved:true,authoredHash:'a'.repeat(64),rowsHash:'b'.repeat(64),modelHash:'c'.repeat(64)}}));
 if(phase==='independence')proof.details=['Workshop Planner','Library Catalog'].map(application=>({kind:'independent-summary.json',data:{revision,application,originalOwnerStopped:true,ownerProbeUnavailableBeforeAndAfter:true}}));
 if(phase==='performance')proof.details=['workshop','library'].map(application=>({kind:'performance-summary.json',data:{application,revision,zeroRetries:true,samples:Array.from({length:30},(_,i)=>({sample:i+1,feedbackMs:1,saveMs:1,receiptMs:1,load:[0,0,0]})),p95FeedbackMs:1,p95SaveMs:1,thresholds:{feedbackMs:2000,validSaveMs:5000},dataset:{tables:2,rows:{parent:2,child:3}},reference:{node:'24.22.1',browser:'Chromium',cpu:'synthetic contract test'},preservation:{text:true,selection:true,focus:true,ownership:true,singleControl:true,modelExceptIntentionalUnrelatedTitle:true,rowsHash:'a'.repeat(64),authoredHash:'b'.repeat(64)}}}));
 return proof;
}
function complete(){
 return {author:'codex-wp08',revision,checks:requiredChecks.map(name=>{const result={name,revision,passed:true,exitCode:0,signal:null};return {...result,evidence:evidence(result)};}),cycles:[1,2].map(cycle=>({cycle,revision,fresh:true,retries:0,passed:true,applications:['workshop','library'],phases:Object.keys(phaseContract).map(phase=>{const proof=phaseProof(phase);return {...proof,evidence:evidence(proof),phase};})})),cases:catalog.cases.map(c=>({case_id:c.case_id,status:c.case_id==='AC-020'?'review_pending':'passed',applications:(c.application==='both'?['workshop','library']:[c.application]).map(application=>({application,status:c.case_id==='AC-020'?'unverified':'passed',observations:1}))})),requirements:Object.entries(catalog.requirements).map(([requirement,text])=>{const cases=catalog.cases.filter(c=>c.requirements.includes(requirement)).map(c=>c.case_id);return {requirement,text,cases,status:cases.includes('AC-020')?'review_pending':'passed'};}),defects:[] as any[],review:undefined as any};
}
test('actual Playwright census rejects missing cases, nonzero exit, errors, skipped/interrupted/flaky/retried results and empty discovery',()=>{
 const good={suites:[{specs:[{title:'real case',tests:[{status:'expected',results:[{status:'passed',retry:0}]}]}]}],errors:[]};assert.equal(browserCensus(good,1,0).passed,true);
 for(const status of ['failed','skipped','timedOut','interrupted']){const bad=structuredClone(good);bad.suites[0].specs[0].tests[0].results[0].status=status;assert.equal(browserCensus(bad,1,0).passed,false);}
 for(const status of ['flaky','unexpected','skipped']){const bad=structuredClone(good);bad.suites[0].specs[0].tests[0].status=status;assert.equal(browserCensus(bad,1,0).passed,false);}
 const retried=structuredClone(good);retried.suites[0].specs[0].tests[0].results[0].retry=1;assert.equal(browserCensus(retried,1,0).passed,false);
 for(const expected of [0,-1,NaN,1.5,2])assert.equal(browserCensus(good,expected,0).passed,false);
 assert.equal(browserCensus({suites:[],errors:[]},0,0).passed,false);assert.equal(browserCensus(good,1,1).passed,false);assert.equal(browserCensus({...good,errors:[{}]},1,0).passed,false);
});
test('p95 uses ceil(.95*n)-1 and rejects negative/nonfinite/missing data',()=>{assert.equal(percentile95(Array.from({length:30},(_,i)=>i+1)),29);for(const values of [[],[NaN],[Infinity],[-1]])assert.throws(()=>percentile95(values));});
test('complete hash-bound current evidence is candidate only until independent review',()=>{assert.equal(qualify(complete(),options).verdict,'CANDIDATE_READY');const input=complete();input.review={independent:true,passed:true,revision};assert.equal(qualify(input,options).verdict,'INCOMPLETE');});
test('heldout: missing nested proof, blanket pending dispositions and review booleans fail closed',()=>{
 const input=complete();input.cycles.forEach(c=>{c.phases=Object.keys(phaseContract).map(phase=>({phase,passed:true}));});assert.equal(qualify(input,options).verdict,'INCOMPLETE');
 input.requirements.forEach(r=>{r.status='review_pending';});input.review={independent:true,passed:true,revision};assert.equal(qualify(input,options).accepted,false);
});
test('mandatory cases/requirements/checks, provenance, app coverage and unresolved defects cannot be waived',()=>{
 const mutants=[x=>x.cycles.pop(),x=>x.cases.pop(),x=>x.requirements.pop(),x=>x.checks.pop(),x=>{x.cycles[0].revision='b'.repeat(40);},x=>{x.cycles[0].fresh=false;},x=>{x.cycles[0].retries=1;},x=>{x.cycles[0].phases[0].census.tests[0].attempts[0].status='skipped';},x=>{x.cycles[0].applications=['workshop'];},x=>{x.checks[0].passed=false;},x=>{x.checks[0].revision='b'.repeat(40);},x=>{x.defects=[{severity:'high',status:'open'}];},x=>{x.requirements[0].cases=[];},x=>{x.cases[0].applications[1].application='workshop';},x=>{x.cycles[0].phases[0].evidence.sha256='0'.repeat(64);}];
 for(const status of ['not_run','failed','blocked','skipped','unverified'])mutants.push(x=>{x.cases[0].status=status;});for(const mutate of mutants){const input=complete();mutate(input);assert.equal(qualify(input,options).verdict,'INCOMPLETE');}
});
test('phase rejects unknown phase, empty census, stale source and wrong app',()=>{
 assert.equal(validatePhase('unknown-phase',{passed:true,revision,census:{passed:true}},revision),false);
 const phase=phaseProof('regeneration');assert.equal(validatePhase('regeneration',phase,revision),true);phase.mode='parity';assert.equal(validatePhase('regeneration',phase,revision),false);phase.mode='ui_journey';phase.census.tests[1].title='workshop duplicate';assert.equal(validatePhase('regeneration',phase,revision),false);assert.equal(validatePhase('regeneration',phase,'b'.repeat(40)),false);
});
test('heldout: all thirty actual timing samples must be finite, nonnegative and within unchanged bounds',()=>{
 assert.equal(validatePhase('performance',phaseProof('performance'),revision),true);
 for(const value of [-1,NaN,Infinity,-Infinity])for(const key of ['feedbackMs','saveMs','receiptMs']){const phase=phaseProof('performance');phase.details[0].data.samples[0][key]=value;assert.equal(validatePhase('performance',phase,revision),false);}
 for(const mutate of [p=>p.details.pop(),p=>p.details[0].data.samples.pop(),p=>{p.details[0].data.samples[1].sample=1;},p=>{p.details[0].data.samples[0].saveMs=5001;},p=>{p.details[0].data.thresholds.feedbackMs=3000;},p=>{p.details[0].data.p95SaveMs=0;},p=>{p.details[0].data.preservation.focus=false;}]){const phase=phaseProof('performance');mutate(phase);assert.equal(validatePhase('performance',phase,revision),false);}
});
test('PASS requires all dispositions passed plus hash-verified canonical ledger and distinct WP09 linked observations',()=>{
 const input=complete();input.cases.forEach(c=>{c.status='passed';c.applications.forEach(a=>{a.status='passed';});});input.requirements.forEach(r=>{r.status='passed';});
 const c=catalog.cases.find(c=>c.case_id==='AC-020')!,note=evidence({actual:'Independent synthetic reviewer contract test'}),records=['workshop','library'].map(application=>({run_id:'independent-review',case_id:'AC-020',requirements:c.requirements,application,mode:'review',revision,status:'passed',expected:c.expected,actual:'Independent canonical ledger reviewed',evidence:[note],defect_id:'AC020-independent-review',retests_observation:'candidate-review/'+application}));
 input.review={independent:true,passed:true,revision,work_package:'WP09',actor:'independent-reviewer',ledgerEvidence:evidence({schema:'acceptance-ledger/v1',complete:true,cases:input.cases,requirements:input.requirements.map(r=>({...r,observations:1}))}),observationsEvidence:evidence({schema:'independent-acceptance-review/v1',revision,work_package:'WP09',reviewer:'independent-reviewer',author:input.author,records})};
 assert.equal(qualify(input,options).verdict,'PASS');
 const pending=complete();pending.review=input.review;assert.equal(qualify(pending,options).accepted,false);
 input.review.actor=input.author;assert.equal(qualify(input,options).accepted,false);
});

test('real ledger pending -> independent linked review -> recomputed dispositions and canonical PASS',()=>{
 const storageDir=join(artifactRoot,'.local','protocol-ledger'),ledgerOptions={...options,storageDir,revision},note=evidence({scope:'Synthetic protocol integration proof; no application acceptance claim'}),input=complete();
 for(const mode of ['ui_journey','parity','fault','review'])createRun({run_id:mode==='review'?'candidate-review':'unit-'+mode,revision,application:'both',mode,toolchain:{node:process.version},fixture_sha256:'f'.repeat(64)},ledgerOptions);
 appendDefect('pending',{defect_id:'AC020-independent-review',revision,case_id:'AC-020',severity:'medium',status:'open',reproduction:'Synthetic pending independent review'},ledgerOptions);
 for(const c of catalog.cases)for(const application of c.application==='both'?['workshop','library']:[c.application]){
  const pending=c.case_id==='AC-020';appendObservation(pending?application:c.case_id+'-'+application,{run_id:pending?'candidate-review':'unit-'+c.primary_mode,case_id:c.case_id,requirements:c.requirements,application,mode:c.primary_mode,revision,status:pending?'unverified':'passed',expected:c.expected,actual:pending?'Independent review pending':'Synthetic protocol outcome',evidence:[note],...(pending?{defect_id:'AC020-independent-review'}:{})},ledgerOptions);
 }
 Object.assign(input,dispositions(readObservations(ledgerOptions),ledgerOptions));assert.equal(qualify(input,options).verdict,'CANDIDATE_READY');
 const pendingRecords=readObservations(ledgerOptions),reviewRequirements=catalog.cases.find(c=>c.case_id==='AC-020')!.requirements;
 for(const status of ['failed','blocked','skipped','not_run']){
  const bad=structuredClone(pendingRecords);for(const record of bad)if(record.observation.case_id==='AC-020')record.observation.status=status;
  const matrix=dispositions(bad,ledgerOptions);assert.equal(matrix.requirements.filter(r=>reviewRequirements.includes(r.requirement)).every(r=>r.status==='incomplete'),true);
  assert.equal(qualify({...input,...matrix},options).verdict,'INCOMPLETE');
 }
 assert.throws(()=>summarizeLedger(readObservations(ledgerOptions),{...ledgerOptions,requireComplete:true,requirePassed:true}));
 createRun({run_id:'independent-review',revision,application:'both',mode:'review',toolchain:{node:process.version},fixture_sha256:'f'.repeat(64)},ledgerOptions);
 const c=catalog.cases.find(c=>c.case_id==='AC-020')!,records=['workshop','library'].map(application=>({run_id:'independent-review',case_id:c.case_id,requirements:c.requirements,application,mode:'review',revision,status:'passed',expected:c.expected,actual:'Independent synthetic reviewer completed canonical protocol',evidence:[note],defect_id:'AC020-independent-review',retests_observation:'candidate-review/'+application}));
 appendObservation(records[0]!.application,records[0]!,ledgerOptions);
 const halfReviewed=dispositions(readObservations(ledgerOptions),ledgerOptions);assert.equal(halfReviewed.requirements.filter(r=>reviewRequirements.includes(r.requirement)).every(r=>r.status==='incomplete'),true);assert.equal(qualify({...input,...halfReviewed},options).verdict,'INCOMPLETE');
 appendObservation(records[1]!.application,records[1]!,ledgerOptions);
 appendDefect('closed',{defect_id:'AC020-independent-review',revision,case_id:'AC-020',severity:'medium',status:'fixed',reproduction:'Both explicitly linked independent reviews appended'},ledgerOptions);
 const canonical=summarizeLedger(readObservations(ledgerOptions),{...ledgerOptions,requireComplete:true,requirePassed:true}),recomputed=dispositions(readObservations(ledgerOptions),ledgerOptions);
 assert.equal(recomputed.cases.every(c=>c.status==='passed'),true);
 assert.equal(recomputed.requirements.every(r=>r.status==='passed'),true);
 Object.assign(input,recomputed,{review:{independent:true,passed:true,revision,work_package:'WP09',actor:'independent-reviewer',ledgerEvidence:evidence(canonical),observationsEvidence:evidence({schema:'independent-acceptance-review/v1',revision,work_package:'WP09',reviewer:'independent-reviewer',author:input.author,records})}});
 assert.equal(qualify(input,options).verdict,'PASS');
});
