import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateObservation, appendObservation, createRun, appendDefect, readObservations, summarizeLedger } from './evidence.mjs';

const revision = 'a'.repeat(40);
function fixture(t: TestContext) {
 const root = mkdtempSync(join(tmpdir(), 'baron-evidence-'));
 t.after(() => rmSync(root, { recursive: true, force: true }));
 const path = 'docs/evidence/verification/synthetic.txt';
 mkdirSync(join(root, 'docs/evidence/verification'), { recursive: true });
 writeFileSync(join(root, path), 'Synthetic harness proof; not product acceptance.');
 const sha256 = createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
 const options = { artifactRoot: root, storageDir: join(root, '.local/acceptance'), revision };
 const observation = {run_id:'harness-01', case_id:'AC-002', requirements:['FR-002','FR-004','C-003'], application:'workshop',mode:'ui_journey',revision,status:'passed',expected:'Synthetic validator input',actual:'Harness only',evidence:[{path,sha256}]};
 return { root, options, observation, path };
}
test('validates a synthetic observation against schema, case and real artifact bytes', t => {
 const f = fixture(t); assert.deepEqual(validateObservation(f.observation, f.options), f.observation);
});
test('rejects false green, unknown IDs, missing case requirements, stale code and malformed shape', t => {
 const {observation:o,options} = fixture(t);
 const bad = [{...o,evidence:[]},{...o,actual:''},{...o,case_id:'AC-999'}, {...o,requirements:['FR-999']},{...o,requirements:['FR-002']},{...o,revision:'b'.repeat(40)},{...o,mode:'seeded'},{...o,application:'library'},{...o,extra:true}];
 for(const x of bad) assert.throws(()=>validateObservation(x,options));
});
test('rejects wrong hashes, missing artifacts, private paths, traversal and symlink escapes', t => {
 const f=fixture(t),o=f.observation;
 for(const path of ['../outside.txt','/tmp/proof.txt','docs/evidence/verification/../proof.txt','.local/private.txt','docs/evidence/verification/identity.json','docs/evidence/verification/raw.trace','docs/evidence/verification/data.sqlite','docs/evidence/verification/missing.txt']) {
  assert.throws(()=>validateObservation({...o,evidence:[{path,sha256:'0'.repeat(64)}]},f.options));
 }
 assert.throws(()=>validateObservation({...o,evidence:[{path:f.path,sha256:'0'.repeat(64)}]},f.options));
 const external=mkdtempSync(join(tmpdir(),'baron-outside-'));t.after(()=>rmSync(external,{recursive:true,force:true}));
 writeFileSync(join(external,'proof.txt'),'outside');symlinkSync(join(external,'proof.txt'),join(f.root,'docs/evidence/verification/link.txt'));
 assert.throws(()=>validateObservation({...o,evidence:[{path:'docs/evidence/verification/link.txt',sha256:'0'.repeat(64)}]},f.options));
});
test('rejects obvious credentials in public textual proof', t=> {
 const f=fixture(t);writeFileSync(join(f.root,f.path),'Authorization: Bearer synthetic-unsafe-token');
 const sha256=createHash('sha256').update(readFileSync(join(f.root,f.path))).digest('hex');
 assert.throws(()=>validateObservation({...f.observation,evidence:[{path:f.path,sha256}]},f.options),/credential/i);
});
test('retains failure and linked retest immutably; rejects missing or unrelated retest targets',t=>{
 const f=fixture(t),o=f.observation;
 createRun({run_id:o.run_id,revision,application:'workshop',mode:'ui_journey',toolchain:{node:process.versions.node},fixture_sha256:'1'.repeat(64)},f.options);
 appendDefect('initial',{defect_id:'D-001',case_id:o.case_id,severity:'high',revision,reproduction:'Synthetic failure',status:'open'},f.options);
 appendObservation('first',{...o,status:'failed',actual:'Synthetic failure',defect_id:'D-001'},f.options);
 appendObservation('retest',{...o,defect_id:'D-001',retests_observation:`${o.run_id}/first`},f.options);
 assert.deepEqual(readObservations(f.options).map(x=>x.observation.status),['failed','passed']);
 assert.throws(()=>appendObservation('first',o,f.options),/exist/i);
 assert.throws(()=>createRun({run_id:o.run_id,revision,application:'workshop',mode:'ui_journey',toolchain:{node:process.versions.node},fixture_sha256:'1'.repeat(64)},f.options),/exist/i);
 assert.throws(()=>appendObservation('bad',{...o,retests_observation:'missing/first'},f.options));
 assert.throws(()=>appendObservation('bad',{...o,retests_observation:`${o.run_id}/first`,case_id:'AC-008',requirements:['FR-009']},f.options));
 assert.equal(readObservations(f.options).length,2);
});
test('requires a registered run and known defect; never writes to public evidence',t=>{
 const f=fixture(t);assert.throws(()=>appendObservation('first',f.observation,f.options),/run/i);
 assert.throws(()=>createRun({run_id:'bad/../../x',revision},f.options));
 assert.throws(()=>createRun({run_id:'good',revision,application:'workshop',mode:'ui_journey',toolchain:{node:process.versions.node},fixture_sha256:'1'.repeat(64)},{...f.options,storageDir:join(f.root,'docs/evidence/verification')}),/private/i);
});
test('pending or partially dispositioned ledger cannot count as complete or accepted',t=>{
 const f=fixture(t);const pending=summarizeLedger([],f.options);
 assert.equal(pending.cases.length,20);assert.equal(pending.requirements.length,29);assert.equal(pending.complete,false);assert.equal(pending.accepted,false);
 assert.ok(pending.cases.every((x: {status: string})=>x.status==='not_run'));
 const partial=summarizeLedger([{observation:f.observation}],f.options);
 assert.equal(partial.complete,false);assert.equal(partial.accepted,false);
 assert.throws(()=>summarizeLedger([{observation:f.observation}],{...f.options,requireComplete:true}),/missing/i);
});
test('inventory CLI emits only a pending inventory and validates fixture oracles',()=>{
 const run=spawnSync(process.execPath,['scripts/acceptance/inventory.mjs'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);const p=JSON.parse(run.stdout);
 assert.equal(p.cases.length,20);assert.equal(p.requirements.length,29);assert.equal(p.accepted,false);
 assert.ok(p.cases.every((x: {status: string})=>x.status==='not_run'));assert.equal(p.fixture_checks.library,'passed: descriptor arithmetic only');
});
test('refuses aggregate both-app passes and parity substituted for a UI journey',t=>{
 const f=fixture(t);
 assert.throws(()=>validateObservation({...f.observation,case_id:'AC-005',requirements:['FR-006'],application:'both'},f.options),/one application/);
 assert.throws(()=>validateObservation({...f.observation,mode:'parity'},f.options),/mode/);
});
for(const status of ['failed','skipped','blocked','unverified'])test(`live ledger CLI rejects a fully dispositioned ledger containing ${status}`,t=>{
 const f=fixture(t);
 const catalog=JSON.parse(readFileSync('fixtures/acceptance/cases.json','utf8'));
 for(const c of catalog.cases)for(const app of c.application==='both'?['workshop','library']:[c.application]) {
  const run_id=`harness-${c.case_id}-${app}`;
  createRun({run_id,revision,application:app,mode:c.primary_mode,toolchain:{node:process.versions.node},fixture_sha256:'1'.repeat(64)},f.options);
  appendObservation('result',{...f.observation,run_id,case_id:c.case_id,application:app,mode:c.primary_mode,requirements:Object.keys(catalog.requirements),status:c.case_id==='AC-002'?status:'passed'},f.options);
 }
 const p=spawnSync(process.execPath,['scripts/acceptance/inventory.mjs','check-ledger',f.options.storageDir,f.root,revision],{encoding:'utf8'});
 assert.equal(p.status,1,p.stdout);assert.match(p.stderr,/Mandatory cases/);
});
test('live ledger CLI rejects a missing mandatory disposition',t=>{
 const f=fixture(t);
 const p=spawnSync(process.execPath,['scripts/acceptance/inventory.mjs','check-ledger',f.options.storageDir,f.root,revision],{encoding:'utf8'});
 assert.equal(p.status,1);assert.match(p.stderr,/Missing mandatory dispositions/);
});
