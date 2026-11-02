import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserCensus, qualify, percentile95, catalog, phaseContract, validatePhase, requiredChecks } from './report.mjs';
test('real Playwright results fail closed for every incomplete outcome', () => {
 const good = { suites: [{ specs: [{ title: 'real case', ok: true, tests: [{ status: 'expected', results: [{ status: 'passed', retry: 0 }] }] }] }], errors: [] };
 assert.equal(browserCensus(good, 1, 0).passed, true);
 for (const status of ['failed', 'skipped', 'timedOut', 'interrupted']) {
  const bad = structuredClone(good); bad.suites[0].specs[0].tests[0].results[0].status = status;
  assert.equal(browserCensus(bad, 1, 0).passed, false);
 }
 const flaky = structuredClone(good); flaky.suites[0].specs[0].tests[0].status = 'flaky';
 assert.equal(browserCensus(flaky, 1, 0).passed, false);
 assert.equal(browserCensus(good, 2, 0).passed, false);
 assert.equal(browserCensus(good, 1, 1).passed, false);
 assert.equal(browserCensus({ ...good, errors: [{message:'outside test'}] }, 1, 0).passed, false);
});
test('p95 uses ceil(.95*n)-1 and rejects missing/nonfinite data', () => {
 assert.equal(percentile95(Array.from({length:30},(_,i)=>i+1)),29);
 assert.throws(()=>percentile95([])); assert.throws(()=>percentile95([NaN]));
});
const revision = 'a'.repeat(40);
function complete() {
 return { revision, checks: requiredChecks.map(name=>({name, revision, passed:true})), cycles: [1,2].map(cycle=>({ cycle, revision, fresh:true, retries:0, passed:true, phases:Object.keys(phaseContract).map(phase=>({phase,passed:true})), applications:['workshop','library'] })), cases: Array.from({length:20},(_,i)=>({case_id:`AC-${String(i+1).padStart(3,'0')}`,status:i===19?'review_pending':'passed'})), requirements: Object.keys(catalog.requirements).map(requirement=>({requirement,status:'passed'})), defects:[], review:undefined };
}
test('candidate cannot become PASS without independent review',()=>{
 assert.equal(qualify(complete()).verdict,'CANDIDATE_READY');
 assert.equal(qualify({...complete(),review:{passed:true, independent:false}}).verdict,'INCOMPLETE');
});
test('missing/stale/dirty/incomplete cycles, cases, requirements, checks and high defects block candidate',()=>{
 const mutants = [
  x=>x.cycles.pop(), x=>x.cases.pop(), x=>x.requirements.pop(),
  x=>{x.cycles[0].revision='b'.repeat(40);}, x=>{x.cycles[0].fresh=false;},
  x=>{x.cycles[0].retries=1;},x=>{x.cycles[0].phases[0].passed=false;},
  x=>{x.cycles[0].applications=['workshop'];},x=>{x.checks[0].passed=false;},
  x=>{x.checks[0].revision='b'.repeat(40);},x=>{x.defects=[{severity:'high',status:'open'}];},
 ];
 for(const status of ['not_run','failed','blocked','skipped','unverified'])mutants.push(x=>{x.cases[0].status=status;});
 for(const mutate of mutants){const candidate=complete();mutate(candidate);assert.equal(qualify(candidate).verdict,'INCOMPLETE');}
});

test('phase rejects wrong application, stale evidence and missing per-app timing samples',()=>{
 const phase={passed:true,revision,census:{passed:true,count:2,tests:[{title:'workshop'},{title:'workshop duplicate'}]}};
 assert.equal(validatePhase('regeneration',phase,revision),false);
 phase.census.tests[1].title='library';phase.details=['Workshop Planner','Library Catalog'].map(application=>({kind:'regeneration-summary.json',data:{revision,application,cycles:2,identityInvariantsPreserved:true,authoredHash:'a'.repeat(64),rowsHash:'b'.repeat(64),modelHash:'c'.repeat(64)}}));assert.equal(validatePhase('regeneration',phase,revision),true);
 assert.equal(validatePhase('regeneration',phase,'b'.repeat(40)),false);
 assert.equal(validatePhase('performance',phase,revision),false);
});
