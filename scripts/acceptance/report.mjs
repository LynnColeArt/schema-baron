import { readFileSync } from 'node:fs';
import { summarizeLedger } from './evidence.mjs';
export const catalog = JSON.parse(readFileSync(new URL('../../fixtures/acceptance/cases.json', import.meta.url), 'utf8'));
export const phaseContract = { regeneration:2, independence:2, access:1, variant:1, drafts:5, recovery:1, parity:2, performance:2, fault:15 };
export function percentile95(values) {
 if (!values.length || values.some(x=>!Number.isFinite(x)||x<0)) throw Error('Missing or invalid timing samples');
 return [...values].sort((a,b)=>a-b)[Math.ceil(.95*values.length)-1];
}
export function browserCensus(report, expected, exitCode) {
 const specs=[]; const visit=s=>{specs.push(...(s.specs??[]));for(const child of s.suites??[])visit(child);};visit(report);
 const tests=specs.flatMap(s=>(s.tests??[]).map(t=>({title:s.title,status:t.status,attempts:(t.results??[]).map(r=>({status:r.status,retry:r.retry}))})));
 const passed=exitCode===0 && !(report.errors??[]).length && tests.length===expected && tests.every(t=>t.status==='expected'&&t.attempts.length===1&&t.attempts[0].status==='passed'&&t.attempts[0].retry===0);
 return { passed, exitCode, expected, count:tests.length, errors:(report.errors??[]).length, tests };
}
export function validatePhase(phase, proof, revision) {
 if(!proof.passed||proof.revision!==revision||proof.census?.count!==phaseContract[phase]||!proof.census?.passed)return false;
 if(['regeneration','independence','parity','performance'].includes(phase)&&!['workshop','library'].every(app=>proof.census.tests.some(t=>t.title.toLowerCase().includes(app))))return false;
 if(phase==='regeneration'){
  const details=proof.details?.filter(d=>d.kind==='regeneration-summary.json')??[];
  if(details.length!==2||!['Workshop Planner','Library Catalog'].every(app=>details.some(d=>d.data.application===app&&d.data.revision===revision&&d.data.cycles===2&&d.data.identityInvariantsPreserved===true&&['authoredHash','rowsHash','modelHash'].every(key=>/^[a-f0-9]{64}$/.test(d.data[key])))))return false;
 }
 if(phase==='independence'){
  const details=proof.details?.filter(d=>d.kind==='independent-summary.json')??[];
  if(details.length!==2||!['Workshop Planner','Library Catalog'].every(app=>details.some(d=>d.data.application===app&&d.data.revision===revision&&d.data.originalOwnerStopped===true&&d.data.ownerProbeUnavailableBeforeAndAfter===true)))return false;
 }
 if(phase==='performance'){
  const details=proof.details?.filter(d=>d.kind==='performance-summary.json')??[];
  if(details.length!==2||!['workshop','library'].every(app=>details.some(d=>d.data.application===app&&d.data.revision===revision&&d.data.zeroRetries===true&&d.data.samples?.length===30&&d.data.samples.every(s=>Number.isFinite(s.feedbackMs)&&Number.isFinite(s.saveMs)&&s.saveMs<=5000)&&percentile95(d.data.samples.map(s=>s.feedbackMs))<=2000&&['text','selection','focus','ownership','singleControl','modelExceptIntentionalUnrelatedTitle'].every(key=>d.data.preservation?.[key]===true))))return false;
 }
 return true;
}
export const requiredChecks=['check-native-verify','check-native-smoke','check-typecheck','check-lint','check-build','check-check-credentials','check-check-dependencies','unit-integration','foundation-report-tests','check-harness-types','audit','legacy-equipment','legacy-publication','legacy-other'];
export function qualify(input) {
 const reasons=[];
 if(!/^[a-f0-9]{40}$/.test(input.revision??''))reasons.push('Missing source revision');
 if(!input.checks?.length||requiredChecks.some(name=>!input.checks.some(c=>c.name===name&&c.passed))||input.checks.some(c=>!c.passed||c.revision!==input.revision))reasons.push('Current automated checks incomplete');
 if(input.cycles?.length!==2||input.cycles.some((c,i)=>c.cycle!==i+1||c.revision!==input.revision||!c.fresh||c.retries!==0||!c.passed||c.phases?.length!==Object.keys(phaseContract).length||Object.keys(phaseContract).some(phase=>!c.phases.some(p=>p.phase===phase&&p.passed))||JSON.stringify(c.applications)!==JSON.stringify(['workshop','library'])))reasons.push('Two consecutive fresh final-code cycles required');
 if(input.cases?.length!==20||new Set(input.cases.map(c=>c.case_id)).size!==20||catalog.cases.some(c=>!input.cases.some(x=>x.case_id===c.case_id))||input.cases.some(c=>c.status!=='passed'&&!(c.case_id==='AC-020'&&c.status==='review_pending')))reasons.push('Mandatory case disposition incomplete');
 if(input.requirements?.length!==29||new Set(input.requirements.map(r=>r.requirement)).size!==29||Object.keys(catalog.requirements).some(ref=>!input.requirements.some(r=>r.requirement===ref))||input.requirements.some(r=>!['passed','review_pending'].includes(r.status)))reasons.push('Mandatory requirement disposition incomplete');
 if((input.defects??[]).some(d=>d.status!=='fixed'&&(['high','critical'].includes(d.severity)||d.mandatory)))reasons.push('Unresolved mandatory/high defect');
 if(input.review && (!input.review.independent||!input.review.passed||input.review.revision!==input.revision))reasons.push('Independent review invalid');
 const reviewed=input.review?.independent&&input.review?.passed&&input.review?.revision===input.revision;
 return { verdict:reasons.length?'INCOMPLETE':reviewed?'PASS':'CANDIDATE_READY', accepted:!reasons.length&&!!reviewed, reasons, note:'AC-020 requires independent WP09 review and canonical check-ledger; author evidence cannot approve itself.' };
}
export function dispositions(records, options) {
 const summary=summarizeLedger(records,{...options,requireComplete:true});
 return {cases:summary.cases.map(c=>({...c,status:c.case_id==='AC-020'&&c.applications.every(a=>a.status==='unverified')?'review_pending':c.status})),requirements:Object.entries(catalog.requirements).map(([requirement,text])=>{
  const cases=catalog.cases.filter(c=>c.requirements.includes(requirement)).map(c=>c.case_id);
  const statuses=summary.cases.filter(c=>cases.includes(c.case_id)&&c.case_id!=='AC-020').map(c=>c.status);
  return {requirement,text,cases,status:statuses.every(s=>s==='passed')?(cases.includes('AC-020')?'review_pending':'passed'):'incomplete'};
 })};
}
