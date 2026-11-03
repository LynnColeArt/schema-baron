import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeLedger, validateObservation } from './evidence.mjs';
const repository=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const catalog=JSON.parse(readFileSync(new URL('../../fixtures/acceptance/cases.json',import.meta.url),'utf8'));
export const phaseContract={regeneration:2,independence:2,access:1,variant:1,drafts:5,recovery:1,parity:2,performance:2,fault:15};
export const requiredChecks=['check-native-verify','check-native-smoke','check-typecheck','check-lint','check-build','check-check-credentials','check-check-dependencies','unit-integration','foundation-report-tests','check-harness-types','audit','legacy-equipment','legacy-publication','legacy-other'];
const applications=c=>c.application==='both'?['workshop','library']:[c.application];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const finiteTime=value=>Number.isFinite(value)&&value>=0;
export function percentile95(values){
 if(!values.length||values.some(x=>!finiteTime(x)))throw Error('Missing or invalid timing samples');
 return [...values].sort((a,b)=>a-b)[Math.ceil(.95*values.length)-1];
}
export function browserCensus(report,expected,exitCode){
 const specs=[];const visit=s=>{specs.push(...(s.specs??[]));for(const child of s.suites??[])visit(child);};visit(report);
 const tests=specs.flatMap(s=>(s.tests??[]).map(t=>({title:s.title,status:t.status,attempts:(t.results??[]).map(r=>({status:r.status,retry:r.retry}))})));
 const passed=Number.isInteger(expected)&&expected>0&&exitCode===0&&!(report.errors??[]).length&&tests.length===expected&&tests.every(t=>t.status==='expected'&&t.attempts.length===1&&t.attempts[0].status==='passed'&&t.attempts[0].retry===0);
 return {passed,exitCode,expected,count:tests.length,errors:(report.errors??[]).length,tests};
}
export function validatePhase(phase,proof,revision){
 if(!Object.hasOwn(phaseContract,phase)||!proof||!proof.passed||proof.revision!==revision||proof.mode!==(phase==='parity'?'parity':phase==='fault'?'fault':'ui_journey')||proof.exitCode!==0||proof.signal!==null||!proof.census?.passed||proof.census.count!==phaseContract[phase]||proof.census.tests?.length!==phaseContract[phase])return false;
 const tests=proof.census.tests;
 if(phase==='fault'){
  if(tests.some(t=>t.status!=='passed'))return false;
 }else if(proof.census.errors!==0||proof.census.exitCode!==0||tests.some(t=>t.status!=='expected'||t.attempts?.length!==1||t.attempts[0].status!=='passed'||t.attempts[0].retry!==0))return false;
 if(['regeneration','independence','parity','performance'].includes(phase)&&!['workshop','library'].every(app=>tests.some(t=>typeof t.title==='string'&&t.title.toLowerCase().includes(app))))return false;
 if(phase==='regeneration'){
  const details=proof.details?.filter(d=>d.kind==='regeneration-summary.json')??[];
  if(details.length!==2||!['Workshop Planner','Library Catalog'].every(app=>details.some(d=>d.data.application===app&&d.data.revision===revision&&d.data.cycles===2&&d.data.identityInvariantsPreserved===true&&['authoredHash','rowsHash','modelHash'].every(key=>hash(d.data[key])))))return false;
 }
 if(phase==='independence'){
  const details=proof.details?.filter(d=>d.kind==='independent-summary.json')??[];
  if(details.length!==2||!['Workshop Planner','Library Catalog'].every(app=>details.some(d=>d.data.application===app&&d.data.revision===revision&&d.data.originalOwnerStopped===true&&d.data.ownerProbeUnavailableBeforeAndAfter===true)))return false;
 }
 if(phase==='performance'){
  const details=proof.details?.filter(d=>d.kind==='performance-summary.json')??[];
  if(details.length!==2)return false;
  for(const application of ['workshop','library']){
   const data=details.find(d=>d.data.application===application)?.data;
   if(!data||data.revision!==revision||data.zeroRetries!==true||data.samples?.length!==30||!data.samples.every((s,i)=>s.sample===i+1&&finiteTime(s.feedbackMs)&&finiteTime(s.saveMs)&&finiteTime(s.receiptMs)&&s.saveMs<=5000))return false;
   const feedback=percentile95(data.samples.map(s=>s.feedbackMs)),save=percentile95(data.samples.map(s=>s.saveMs));
   if(feedback>2000||data.p95FeedbackMs!==feedback||data.p95SaveMs!==save||data.thresholds?.feedbackMs!==2000||data.thresholds?.validSaveMs!==5000)return false;
   if(!Number.isInteger(data.dataset?.tables)||data.dataset.tables<1||data.dataset.tables>12||!data.dataset.rows||Object.values(data.dataset.rows).some(n=>!Number.isInteger(n)||n<0||n>200))return false;
   if(!data.reference?.node||!data.reference.browser||!data.reference.cpu||!['text','selection','focus','ownership','singleControl','modelExceptIntentionalUnrelatedTitle'].every(key=>data.preservation?.[key]===true)||!hash(data.preservation.rowsHash)||!hash(data.preservation.authoredHash))return false;
  }
 }
 return true;
}
function verifyEvidence(entry,revision,options){
 const c=catalog.cases[0];
 validateObservation({run_id:'report-proof',case_id:c.case_id,requirements:c.requirements,application:'workshop',mode:'ui_journey',revision,status:'passed',expected:'Hash-verified sanitized public proof',actual:'The referenced artifact is retained',evidence:[entry]},options);
 return JSON.parse(readFileSync(resolve(options.artifactRoot??repository,entry.path),'utf8'));
}
function independentProof(input,options){
 const review=input.review;
 if(!review||review.independent!==true||review.passed!==true||review.revision!==input.revision||review.work_package!=='WP09'||typeof review.actor!=='string'||!review.actor.trim()||!input.author||review.actor===input.author)return false;
 try{
  const ledger=verifyEvidence(review.ledgerEvidence,input.revision,options),proof=verifyEvidence(review.observationsEvidence,input.revision,options);
  if(ledger.schema!=='acceptance-ledger/v1'||ledger.complete!==true||ledger.cases?.length!==20||ledger.requirements?.length!==29||!catalog.cases.every(c=>ledger.cases.some(x=>x.case_id===c.case_id&&x.status==='passed'&&applications(c).every(app=>x.applications?.some(a=>a.application===app&&a.status==='passed'))))||!Object.keys(catalog.requirements).every(ref=>ledger.requirements.some(r=>r.requirement===ref&&r.observations>0)))return false;
  if(proof.schema!=='independent-acceptance-review/v1'||proof.revision!==input.revision||proof.work_package!=='WP09'||proof.reviewer!==review.actor||proof.author!==input.author||proof.records?.length!==2)return false;
  for(const application of ['workshop','library']){
   const observation=proof.records.find(r=>r.application===application);
   if(!observation||observation.case_id!=='AC-020'||observation.mode!=='review'||observation.status!=='passed'||observation.revision!==input.revision||observation.defect_id!=='AC020-independent-review'||observation.retests_observation!=='candidate-review/'+application)return false;
   validateObservation(observation,{...options,revision:input.revision});
  }
  return true;
 }catch{return false;}
}
function matchesProof(value,revision,options){const {evidence,phase,...expected}=value;return same(verifyEvidence(evidence,revision,options),expected);}
export function qualify(input,options={}){
 const reasons=[];
 if(!/^[a-f0-9]{40}$/.test(input.revision??''))reasons.push('Missing source revision');
 let checkProofs=true;try{for(const check of input.checks??[])if(!matchesProof(check,input.revision,options))checkProofs=false;}catch{checkProofs=false;}
 if(!checkProofs||!input.checks?.length||requiredChecks.some(name=>!input.checks.some(c=>c.name===name&&c.passed))||input.checks.some(c=>!c.passed||c.revision!==input.revision||c.exitCode!==0||c.signal!==null))reasons.push('Current automated checks incomplete');
 let cyclesValid=input.cycles?.length===2&&input.cycles.every((c,i)=>c.cycle===i+1&&c.revision===input.revision&&c.fresh===true&&c.retries===0&&c.passed===true&&same(c.applications,['workshop','library'])&&c.phases?.length===Object.keys(phaseContract).length&&Object.keys(phaseContract).every(phase=>c.phases.some(p=>p.phase===phase&&validatePhase(phase,p,input.revision))));
 if(cyclesValid)try{for(const cycle of input.cycles)for(const phase of cycle.phases)if(!matchesProof(phase,input.revision,options))cyclesValid=false;}catch{cyclesValid=false;}
 if(!cyclesValid)reasons.push('Two consecutive fresh final-code cycles with actual phase proof required');
 const case20=input.cases?.find(c=>c.case_id==='AC-020'),pending=case20?.status==='review_pending';
 const casesValid=input.cases?.length===20&&new Set(input.cases.map(c=>c.case_id)).size===20&&catalog.cases.every(c=>input.cases.some(x=>x.case_id===c.case_id&&x.status===(c.case_id==='AC-020'&&pending?'review_pending':'passed')&&x.applications?.length===applications(c).length&&applications(c).every(app=>x.applications.some(a=>a.application===app&&a.status===(c.case_id==='AC-020'&&pending?'unverified':'passed')&&a.observations>0))));
 if(!casesValid)reasons.push('Mandatory case disposition incomplete');
 const requirementsValid=input.requirements?.length===29&&new Set(input.requirements.map(r=>r.requirement)).size===29&&Object.keys(catalog.requirements).every(ref=>{
  const cases=catalog.cases.filter(c=>c.requirements.includes(ref)).map(c=>c.case_id),expected=pending&&cases.includes('AC-020')?'review_pending':'passed';
  return input.requirements.some(r=>r.requirement===ref&&r.text===catalog.requirements[ref]&&same(r.cases,cases)&&r.status===expected);
 });
 if(!requirementsValid)reasons.push('Mandatory requirement disposition incomplete');
 if((input.defects??[]).some(d=>d.status!=='fixed'&&(['high','critical'].includes(d.severity)||d.mandatory)))reasons.push('Unresolved mandatory/high defect');
 const reviewed=independentProof(input,options);
 if(reviewed&&pending)reasons.push('Independent proof cannot override pending input dispositions');
 if(input.review&&!reviewed)reasons.push('Independent review lacks canonical source-linked proof');
 if(!pending&&!reviewed)reasons.push('Passed AC-020 requires independent WP09 proof');
 return {verdict:reasons.length?'INCOMPLETE':reviewed?'PASS':'CANDIDATE_READY',accepted:!reasons.length&&reviewed,reasons,note:'AC-020 requires independent WP09 review and canonical check-ledger; author evidence cannot approve itself.'};
}
export function dispositions(records,options){
 const summary=summarizeLedger(records,{...options,requireComplete:true});
 return {cases:summary.cases.map(c=>({...c,status:c.case_id==='AC-020'&&c.applications.every(a=>a.status==='unverified')?'review_pending':c.status})),requirements:Object.entries(catalog.requirements).map(([requirement,text])=>{
  const cases=catalog.cases.filter(c=>c.requirements.includes(requirement)).map(c=>c.case_id),associated=summary.cases.filter(c=>cases.includes(c.case_id));
  const pending=associated.some(c=>c.case_id==='AC-020'&&c.status==='unverified'&&c.applications.every(a=>a.status==='unverified'));
  const resolved=associated.every(c=>c.status==='passed'||(pending&&c.case_id==='AC-020'));
  return {requirement,text,cases,status:resolved?(pending?'review_pending':'passed'):'incomplete'};
 })};
}
