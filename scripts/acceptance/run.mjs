import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { appendObservation, appendDefect, createRun, readObservations } from './evidence.mjs';
import { browserCensus, catalog, dispositions, phaseContract, qualify, validatePhase } from './report.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
process.chdir(root);
const mode=process.argv[2]??'all';
if(!['all','prepare','checks','browser','cycles','legacy'].includes(mode))throw Error('Usage: node scripts/acceptance/run.mjs [all|prepare|checks|browser|cycles|legacy]');
if(process.versions.node!=='24.22.1'||execFileSync('npm',['--version'],{encoding:'utf8'}).trim()!=='11.19.1')throw Error('Pinned Node 24.22.1 / npm 11.19.1 required');
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim())throw Error('Freeze and commit all tracked changes before qualification');
const privateRoot=mkdtempSync(join(tmpdir(),'schema-baron-final-'));chmodSync(privateRoot,0o700);
const runId=privateRoot.split('/').at(-1);
const publicRelative='docs/evidence/verification/'+runId,publicRoot=join(root,publicRelative);mkdirSync(publicRoot,{recursive:true});
console.log('Private captures: '+privateRoot+'; sanitized proof: '+publicRelative+'; code '+revision);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixtureHash=sha(readFileSync('fixtures/acceptance/cases.json'));
const env={...process.env,npm_config_ignore_scripts:'true',NEXT_TELEMETRY_DISABLED:'1',SCHEMA_BARON_PARITY_EVIDENCE:join(privateRoot,'parity'),SCHEMA_BARON_RECOVERY_EVIDENCE:join(privateRoot,'recovery'),SCHEMA_BARON_MIGRATION_EVIDENCE:join(privateRoot,'migration')};
const checks=[],cycles=[];
const historicalDefects=[
 ['LIB-LOOKUP-LABEL','high','library.red.json',['variant','regeneration']],['LIB-LOOKUP-LIMIT','high','library.red.json',['variant']],
 ['ACCESS-001','high','access.red.json',['access']],['ACCESS-002','medium','access.red.json',['access']],
 ...['DRAFT-01','DRAFT-02','DRAFT-03'].map(id=>[id,'high','drafts.failures.json',['drafts']]),
 ['DRAFT-04','medium','drafts.failures.json',['drafts']],['DRAFT-R1-obsolete-buffer','high','drafts.cycle2.failures.json',['drafts']],
 ['WP08-report-heldout','high','runs.md',['performance']],['WP08-legacy-select','medium','runs.md',[]],
 ['CODE-configured-output','high','wp07-code-output-red.json',['regeneration']],['WP08-clean-draft-save','medium','runs.md',['performance']],
].map(([id,severity,source,retests])=>({id,severity,status:'fixed',historicalSource:'docs/evidence/verification/'+source,retests,qualification:'Fixed only after both current cycles pass all named retest phases; prior scoped reports remain historical.'}));
function publish(name,value){const path=publicRelative+'/'+name+'.json';const bytes=JSON.stringify(value,null,2)+'\n';writeFileSync(join(root,path),bytes,{flag:'wx'});return {path,sha256:sha(bytes)};}
async function execute(name,command,args,environment=env){
 if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==revision||execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim())throw Error('Source changed during qualification; restart both clean cycles');
 const started=new Date().toISOString(),log=join(privateRoot,name+'.log');let output='';
 const child=spawn(command,args,{cwd:root,env:environment,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
 const result=await new Promise((done,fail)=>{child.once('error',fail);child.once('exit',(code,signal)=>done({code,signal}));});
 writeFileSync(log,output,{mode:0o600,flag:'wx'});
 const record={name,revision,command:[command,...args.map(arg=>arg.replaceAll(privateRoot,'<private-run>'))],started,finished:new Date().toISOString(),exitCode:result.code,signal:result.signal,passed:result.code===0&&result.signal===null};
 console.log(name+': '+(record.passed?'passed':'FAILED')+' (private log '+name+'.log)');
 return record;
}
async function check(name,command,args){const result=await execute(name,command,args);checks.push(result);result.evidence=publish(name,result);if(!result.passed)throw Error(name+' failed; original private log retained');return result;}
function walk(directory){return !existsSync(directory)?[]:readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(directory,e.name)):[join(directory,e.name)]);}
function sanitizedDetails(output){
 const keep={ 'regeneration-summary.json':['revision','application','cycles','authoredHash','rowsHash','modelHash','identityInvariantsPreserved','fault'], 'independent-summary.json':['revision','application','originalOwnerStopped','ownerProbeUnavailableBeforeAndAfter','checks','rowsHash','authoredHash'], 'performance-summary.json':['application','revision','reference','dataset','method','samples','p95FeedbackMs','p95SaveMs','thresholds','preservation','zeroRetries'], 'library-migration-summary.json':['mode','foreignKeys','integrity','destructiveCancel','restoration','occupiedPort','unrelatedModelUnchanged','unrelatedDatabaseUnchanged'], 'parity-summary.json':['mode','application','scope','observations','authorization'] };
 return walk(output).filter(path=>keep[path.split('/').at(-1)]).map(path=>{const source=JSON.parse(readFileSync(path,'utf8'));return {kind:path.split('/').at(-1),privateSourceSha256:sha(readFileSync(path)),data:Object.fromEntries(keep[path.split('/').at(-1)].filter(key=>key in source).map(key=>[key,source[key]]))};});
}
async function browser(name,args,expected,extra={}){
 const output=join(privateRoot,name+'-output'),json=join(privateRoot,name+'.json'),xml=join(privateRoot,name+'.xml');
 const result=await execute(name,'npm',['exec','playwright','test',...args,'--','--workers=1','--retries=0','--reporter=line,json,junit','--output='+output],{...env,...extra,PLAYWRIGHT_JSON_OUTPUT_FILE:json,PLAYWRIGHT_JUNIT_OUTPUT_FILE:xml});
 const census=existsSync(json)?browserCensus(JSON.parse(readFileSync(json,'utf8')),expected,result.exitCode):{passed:false,count:0,expected,missingReport:true};
 const proof={...result,mode:name.endsWith('-parity')?'parity':'ui_journey',passed:result.passed&&census.passed,census,details:sanitizedDetails(output)};
 if(/^cycle[12]-/.test(name))proof.passed=validatePhase(name.replace(/^cycle[12]-/,''),proof,revision);
 proof.evidence=publish(name,proof);return proof;
}
async function fault(name){
 const json=join(privateRoot,name+'.json');const result=await execute(name,'npm',['test','--','tests/integration/recovery-matrix','--reporter=json','--outputFile='+json]);
 const raw=existsSync(json)?JSON.parse(readFileSync(json,'utf8')):{};const tests=(raw.testResults??[]).flatMap(s=>s.assertionResults??[]);
 const census={count:tests.length,expected:phaseContract.fault,passed:raw.success===true&&tests.length===phaseContract.fault&&tests.every(t=>t.status==='passed')&&!(raw.numFailedTests||raw.numPendingTests||raw.numTodoTests||raw.numFailedTestSuites),tests:tests.map(t=>({title:t.fullName,status:t.status}))};
 const proof={...result,passed:result.passed&&census.passed,census,mode:'fault',scope:'Shared application-independent contract bridge: real hard-exit parent/child restart and negative boundaries; not two schema-specific interrupted UI journeys.'};proof.evidence=publish(name,proof);return proof;
}
const casePhases={ 'AC-001':['regeneration','independence'],'AC-002':['regeneration'],'AC-003':['regeneration','variant'],'AC-004':['regeneration'],'AC-005':['regeneration','access'],'AC-006':['regeneration','access'],'AC-007':['access'],'AC-008':['regeneration'],'AC-009':['regeneration'],'AC-010':['regeneration','recovery'],'AC-011':['regeneration'],'AC-012':['regeneration'],'AC-013':['independence'],'AC-014':['drafts','performance'],'AC-015':['fault','recovery'],'AC-016':['fault'],'AC-017':['parity'],'AC-018':['performance'],'AC-019':['regeneration','variant'] };
function scope(c,application){
 if(c.case_id==='AC-019')return application==='workshop'?'Workshop original UI journey proves its simple primary-key, duplicate-name and parent-context cases. Quoted identifiers and 200/201 lookup boundary use the separate supplied Library variant as a shared generic generator bridge; composite identity is Library-specific.':'Library original UI journey proves ordered composite identity and duplicate human names. Separate supplied raw existing-db variant proves quoted identifiers and 200/201 lookups; it does not seed or repair the normal journey.';
 if(c.case_id==='AC-010')return application==='workshop'?'Workshop duration migration and reviewed destructive Cancel occur inside the complete original journey. Library recovery adds independent nullable-subtitle, restoration, occupied-port and witness-isolation proof.':'Library complete ordinary UI journey includes nullable subtitle migration, destructive Cancel, explicit declaration restoration, occupied-port sentinel and unrelated UI-authored witness preservation.';
 if(c.case_id==='AC-014')return 'Each full application performance journey supplies 30 active page-draft notifications. Separate drafts suite covers schema/query/control invalid partial values and switch/reload; those shared editor fixtures are explicitly small UI-authored projects, not both complete business schemas.';
 if(c.primary_mode==='fault')return 'Shared application-independent disposable parent/child contract bridge: actual hard exits, durable recovery and rejection boundaries. Consumed by both apps through the same engine; not two schema-specific interrupted UI journeys.';
 return c.primary_mode==='parity'?'Separately named bounded real SDK MCP/direct-command fixture; no UI acceptance substitution or claim of full MCP workflow.':'Ordinary UI authoring in explicitly mapped phases; read-only observers verify outcomes. No model/data/source repair bypass.';
}
async function cycle(number){
 const handoff=mkdtempSync(join(tmpdir(),'schema-baron-final-handoff-'));chmodSync(handoff,0o700);
 const phases=[];
 for(const phase of Object.keys(phaseContract)){
  const args=['tests/e2e/acceptance/'+phase+'.spec.ts'];if(phase==='variant'){args[0]='tests/e2e/acceptance/library.spec.ts';args.push('--grep','declared raw existing-db');}
  const result=phase==='fault'?await fault(`cycle${number}-${phase}`):await browser(`cycle${number}-${phase}`,args,phaseContract[phase],{SCHEMA_BARON_PORTABILITY_HANDOFF:handoff});
  result.passed=validatePhase(phase,result,revision);
  phases.push({...result,phase});
  if(!result.passed)break; // Never run a consumer after failed production or hide a failed cycle.
 }
 const result={cycle:number,revision,fresh:true,retries:0,applications:['workshop','library'],phases,passed:phases.length===Object.keys(phaseContract).length&&phases.every(p=>p.passed)};cycles.push(result);
 for(const c of catalog.cases.filter(c=>c.case_id!=='AC-020'))for(const application of c.application==='both'?['workshop','library']:[c.application]){
  const selected=casePhases[c.case_id].map(phase=>phases.find(p=>p.phase===phase));const passed=selected.every(p=>p?.passed);
  const id=`cycle${number}-${c.primary_mode}`;if(!registered.has(id)){createRun({run_id:id,revision,application:'both',mode:c.primary_mode,toolchain:{node:process.version,npm:'11.19.1'},fixture_sha256:fixtureHash},options);registered.add(id);}
  appendObservation(c.case_id+'-'+application,{run_id:id,case_id:c.case_id,requirements:c.requirements,application,mode:c.primary_mode,revision,status:passed?'passed':selected.some(p=>p&&!p.passed)?'failed':'not_run',expected:c.expected,actual:passed?'All explicitly mapped current phases passed their exact zero-retry test census. '+scope(c,application):'Required phase failed or was not executed; private original capture retained.',evidence:selected.filter(Boolean).map(p=>p.evidence)},options);
 }
 if(!result.passed)throw Error('Cycle '+number+' incomplete; no retry or later cycle accepted');
}
const options={storageDir:join(privateRoot,'ledger'),artifactRoot:root,revision},registered=new Set();
let failure;
try{
 if(['all','prepare'].includes(mode)){
  await check('install','npm',['ci','--ignore-scripts']);await check('native-acquisition','npm',['run','native:verify']);await check('output-acquisition','node',['scripts/release/acquire-output.mjs']);await check('chromium-acquisition','npm',['exec','playwright','install','chromium']);await check('preconsumer-build','npm',['run','build']);
 }
 if(['all','checks'].includes(mode)){
  for(const script of ['native:verify','native:smoke','typecheck','lint','build','check:credentials','check:dependencies'])await check('check-'+script.replaceAll(':','-'),'npm',['run',script]);
  await check('unit-integration','npm',['test','--','--reporter=json','--outputFile='+join(privateRoot,'unit-results.json')]);
  const unit=JSON.parse(readFileSync(join(privateRoot,'unit-results.json'),'utf8'));if(unit.success!==true||unit.numFailedTests||unit.numPendingTests||unit.numTodoTests||unit.numFailedTestSuites||!unit.numPassedTests)throw Error('Incomplete unit/integration census');publish('unit-census',{revision,tests:unit.numTotalTests,passed:unit.numPassedTests,failed:unit.numFailedTests,pending:unit.numPendingTests,suites:unit.numTotalTestSuites});
  await check('check-harness-types','node',['node_modules/typescript/bin/tsc','--strict','--noUncheckedIndexedAccess','--exactOptionalPropertyTypes','--target','ES2023','--module','NodeNext','--moduleResolution','NodeNext','--noEmit','--skipLibCheck','--allowJs','tests/e2e/acceptance/performance.spec.ts','tests/e2e/equipment/workflow.spec.ts']);
  await check('foundation-report-tests','node',['--test','scripts/acceptance/evidence.test.ts','scripts/acceptance/report.test.ts']);await check('audit','npm',['audit','--audit-level=low']);
 }
 if(['all','browser','legacy'].includes(mode)){
  const legacyEnv={SCHEMA_BARON_EQUIPMENT_STUDY:join(privateRoot,'equipment.json'),SCHEMA_BARON_PUBLICATION_STUDY:join(privateRoot,'publication.json')};
  // Legacy studies have an explicit dependency; generic discovery excludes both and the final mission suite.
  for(const [name,args] of [['legacy-equipment',['tests/e2e/equipment']],['legacy-publication',['tests/e2e/publication/workflow.spec.ts']],['legacy-other',['tests/e2e/(?!acceptance/|equipment/|publication/)']]]){
   const listed=execFileSync('npm',['exec','playwright','test',...args,'--','--list'],{env:{...env,...legacyEnv},encoding:'utf8'});const match=listed.match(/Total: (\d+) tests?/);if(!match)throw Error('Missing legacy test inventory');
   const result=await browser(name,args,Number(match[1]),legacyEnv);checks.push(result);if(!result.passed)throw Error(name+' failed');
  }
 }
 if(['all','browser','cycles'].includes(mode)){await cycle(1);await cycle(2);}
}catch(error){failure=error.message;console.error(failure);}
if(cycles.length){
 const id='candidate-review';createRun({run_id:id,revision,application:'both',mode:'review',toolchain:{node:process.version,npm:'11.19.1'},fixture_sha256:fixtureHash},options);
 appendDefect('pending',{defect_id:'AC020-independent-review',revision,case_id:'AC-020',severity:'medium',status:'open',reproduction:'Independent WP09 review not performed by author; close only through independent linked review observations.'},options);
 const c=catalog.cases.find(c=>c.case_id==='AC-020'),evidence=publish('candidate-cycle-summary',{revision,cycles:cycles.map(c=>({cycle:c.cycle,passed:c.passed,phases:c.phases.map(p=>({phase:p.phase,passed:p.passed,evidence:p.evidence}))})),review:'Pending independent WP09'});
 for(const application of ['workshop','library'])appendObservation(application,{run_id:id,case_id:c.case_id,requirements:c.requirements,application,mode:'review',revision,status:'unverified',defect_id:'AC020-independent-review',expected:c.expected,actual:'Candidate only. Independent WP09 review and canonical check-ledger still required.',evidence:[evidence]},options);
}
if(cycles.length)publish('observations',{revision,records:readObservations(options)});
let matrix={cases:catalog.cases.map(c=>({case_id:c.case_id,status:'not_run'})),requirements:Object.entries(catalog.requirements).map(([requirement,text])=>({requirement,text,status:'not_run'}))};
try{matrix=dispositions(readObservations(options),options);}catch(error){failure??=error.message;}
const report={schema:'acceptance-candidate/v1',author:'codex-wp08',revision,proofCommit:'Commit containing this immutable proof is recorded separately in runs.md; source revision above remains authoritative.',runId,checks,cycles,...matrix,defects:historicalDefects.map(d=>({...d,status:cycles.length===2&&cycles.every(c=>d.retests.every(phase=>c.phases.some(p=>p.phase===phase&&p.passed)))?'fixed':'open'})),sourceArtifacts:Object.fromEntries(['fixtures/acceptance/cases.json','fixtures/acceptance/workshop.json','fixtures/acceptance/library.json','scripts/acceptance/run.mjs','scripts/acceptance/report.mjs','tests/e2e/acceptance/performance.spec.ts','tests/e2e/equipment/workflow.spec.ts'].map(path=>[path,sha(readFileSync(path))])),hosted:{status:'unverified',note:'Hosted CI must be read from its actual fresh run; local execution is not hosted success.'},failure};Object.assign(report,qualify(report));publish('report',report);
console.log('Verdict '+report.verdict+'; '+report.reasons.join('; '));
if(failure||(['all','cycles'].includes(mode)&&report.verdict==='INCOMPLETE'))process.exitCode=1;
