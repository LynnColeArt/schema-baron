import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const catalog = JSON.parse(readFileSync(resolve(repository, 'fixtures/acceptance/cases.json'), 'utf8'));
const schema = JSON.parse(readFileSync(resolve(repository, 'kitty-specs/studio-verification-hardening-01M6AQ6R/contracts/evidence.schema.json'), 'utf8'));
const identifier = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;
const hash = /^[0-9a-f]{64}$/;
const modes = new Set(['ui_journey', 'parity', 'fault', 'review']);
const applications = new Set(['workshop', 'library', 'both']);
const reject = message => { throw new Error(message); };
const within = (root, path) => { const rel = relative(root, path); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
function id(value, label) { if (typeof value !== 'string' || !identifier.test(value)) reject(`Invalid ${label}`); }
function revision(value) { if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) reject('Invalid revision'); }

// Deliberately supports only the keywords used by the pinned observation contract.
// Unknown schema keywords fail closed rather than being silently ignored.
function check(value, rule, path = 'observation') {
 const supported = new Set(['$schema', 'title', 'type', 'additionalProperties', 'required', 'properties', 'items', 'minItems', 'uniqueItems', 'minLength', 'pattern', 'enum', 'const', 'allOf', 'if', 'then']);
 for (const key of Object.keys(rule)) if (!supported.has(key)) reject(`Unsupported contract keyword ${key}`);
 if (rule.const !== undefined && value !== rule.const) reject(`${path}: wrong constant`);
 if (rule.enum && !rule.enum.includes(value)) reject(`${path}: invalid value`);
 if (rule.type === 'object') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject(`${path}: expected object`);
  for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) reject(`${path}: missing ${key}`);
  if (rule.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(rule.properties ?? {}, key)) reject(`${path}: unknown ${key}`);
 }
 if (rule.properties && value && typeof value === 'object') for (const [key, child] of Object.entries(rule.properties)) if (Object.hasOwn(value, key)) check(value[key], child, `${path}.${key}`);
 if (rule.type === 'string' && typeof value !== 'string') reject(`${path}: expected string`);
 if (typeof value === 'string') {
  if (rule.minLength !== undefined && value.length < rule.minLength) reject(`${path}: too short`);
  if (rule.pattern && !new RegExp(rule.pattern).test(value)) reject(`${path}: invalid format`);
 }
 if (rule.type === 'array' && !Array.isArray(value)) reject(`${path}: expected array`);
 if (Array.isArray(value)) {
  if (rule.minItems !== undefined && value.length < rule.minItems) reject(`${path}: missing items`);
  if (rule.uniqueItems && new Set(value.map(x => JSON.stringify(x))).size !== value.length) reject(`${path}: duplicate items`);
  for (const item of value) check(item, rule.items ?? {}, `${path}[]`);
 }
 for (const child of rule.allOf ?? []) check(value, child, path);
 if (rule.if) { let match = true; try { check(value, rule.if, path); } catch { match = false; } if (match && rule.then) check(value, rule.then, path); }
}
function artifact(entry, root) {
 const path = entry.path;
 if (isAbsolute(path) || path.includes('\\') || path.split('/').some(x => ['', '.', '..'].includes(x))) reject('Unsafe evidence path');
 if (!path.startsWith('docs/evidence/verification/') || !/\.(json|jsonl|txt|log|md|png|jpg|jpeg)$/.test(path)) reject('Evidence must be a sanitized public artifact');
 if (/(^|\/)(?:identity|owner|private|credentials|secrets|\.env)(?:[./_-]|$)/i.test(path)) reject('Private evidence path');
 const full = resolve(root, path);
 if (!existsSync(full) || !within(realpathSync(root), realpathSync(full)) || !statSync(full).isFile()) reject('Missing or unsafe evidence artifact');
 const bytes = readFileSync(full);
 if (sha256(bytes) !== entry.sha256) reject('Evidence hash mismatch');
 if (!/\.(png|jpe?g)$/.test(path) && /(?:Authorization\s*:\s*Bearer\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:password|capability|session_token)\s*[=:]\s*["']?(?!\[REDACTED\]|<redacted>)\S{6,})/i.test(bytes.toString('utf8'))) reject('Potential credential in public evidence');
}
export function validateObservation(observation, options = {}) {
 check(observation, schema);
 const c = catalog.cases.find(x => x.case_id === observation.case_id);
 if (!c) reject('Unknown case');
 for (const ref of observation.requirements) if (!Object.hasOwn(catalog.requirements, ref)) reject('Unknown requirement');
 for (const ref of c.requirements) if (!observation.requirements.includes(ref)) reject(`Missing case requirement ${ref}`);
 if (c.application !== 'both' && observation.application !== c.application) reject('Wrong application for case');
 if (observation.status === 'passed' && observation.mode !== c.primary_mode) reject('Pass uses wrong case evidence mode');
 if (observation.status === 'passed' && c.application === 'both' && observation.application === 'both') reject('Passing evidence must identify one application, not aggregate both');
 if (options.revision && observation.revision !== options.revision) reject('Observation revision differs from run');
 id(observation.run_id, 'run ID');
 if (observation.defect_id) id(observation.defect_id, 'defect ID');
 if (observation.retests_observation && !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(observation.retests_observation)) reject('Invalid retest reference');
 for (const entry of observation.evidence) artifact(entry, resolve(options.artifactRoot ?? repository));
 return observation;
}
function store(options) {
 if (!options.storageDir) reject('An explicit private storageDir is required');
 const root = resolve(options.artifactRoot ?? repository), storage = resolve(options.storageDir);
 if (within(root, storage) && !within(resolve(root, '.local'), storage)) reject('Ledger storage must be private (.local or external)');
 mkdirSync(storage, { recursive: true, mode: 0o700 });
 if (within(realpathSync(root), realpathSync(storage)) && !within(resolve(realpathSync(root), '.local'), realpathSync(storage))) reject('Ledger symlink points into public files');
 return storage;
}
function writeNew(path, value) { mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {flag:'wx',mode:0o600}); }
export function createRun(manifest, options = {}) {
 id(manifest.run_id, 'run ID'); revision(manifest.revision);
 if (!applications.has(manifest.application) || !modes.has(manifest.mode)) reject('Invalid run application/mode');
 if (!manifest.toolchain || typeof manifest.toolchain !== 'object' || !Object.keys(manifest.toolchain).length || !hash.test(manifest.fixture_sha256)) reject('Missing toolchain/fixture provenance');
 if (options.revision && manifest.revision !== options.revision) reject('Run revision mismatch');
 const path = resolve(store(options), 'runs', `${manifest.run_id}.json`);writeNew(path, manifest);return path;
}
export function appendDefect(recordId, defect, options = {}) {
 id(recordId,'defect record ID');id(defect.defect_id,'defect ID');revision(defect.revision);
 if (!catalog.cases.some(x=>x.case_id===defect.case_id) || !['critical','high','medium','low'].includes(defect.severity) || !['open','fixed','deferred'].includes(defect.status) || typeof defect.reproduction!=='string' || !defect.reproduction.trim()) reject('Invalid defect record');
 const path=resolve(store(options),'defects',defect.defect_id,`${recordId}.json`);writeNew(path,defect);return path;
}
export function appendObservation(observationId, observation, options = {}) {
 id(observationId,'observation ID');validateObservation(observation,options);
 const storage=store(options),runPath=resolve(storage,'runs',`${observation.run_id}.json`);
 if(!existsSync(runPath)) reject('Observation requires a registered run');
 const run=json(runPath);
 if(run.revision!==observation.revision || run.mode!==observation.mode || (run.application!=='both' && run.application!==observation.application)) reject('Observation differs from registered run');
 if(observation.defect_id) {
  const path=resolve(storage,'defects',observation.defect_id);
  if(!existsSync(path) || !readdirSync(path).some(name=>name.endsWith('.json') && json(resolve(path,name)).case_id===observation.case_id)) reject('Unknown or unrelated defect');
 }
 if(observation.retests_observation) {
  const [runId,priorId]=observation.retests_observation.split('/');
  const prior=resolve(storage,'observations',runId,`${priorId}.json`);
  if(!existsSync(prior)) reject('Retest target missing');
  const previous=json(prior).observation;
  if(previous.case_id!==observation.case_id || previous.application!==observation.application || !['failed','blocked','unverified'].includes(previous.status) || !observation.defect_id || previous.defect_id!==observation.defect_id) reject('Retest target unrelated or not failed');
 }
 const path=resolve(storage,'observations',observation.run_id,`${observationId}.json`);
 if(existsSync(path))reject('Observation already exists');
 const orderDirectory=resolve(storage,'append-order');mkdirSync(orderDirectory,{recursive:true,mode:0o700});
 const orders=readdirSync(orderDirectory).map(name=>Number(name.replace(/\.json$/,'')));
 if(orders.some(n=>!Number.isSafeInteger(n)||n<1))reject('Invalid persisted append order');
 const sequence=Math.max(0,...orders)+1;
 if(!Number.isSafeInteger(sequence))reject('Append order exhausted');
 // Exclusive reservation makes concurrent writers fail instead of reordering history.
 // Gaps after an interrupted write are harmless; reserved positions are never reused.
 writeNew(resolve(orderDirectory,`${String(sequence).padStart(12,'0')}.json`),{sequence,run_id:observation.run_id,observation_id:observationId});
 const record={record_schema:'acceptance-record/v2',sequence,observation_id:observationId,recorded_at:new Date().toISOString(),observation};writeNew(path,record);return record;
}
export function readObservations(options = {}) {
 const directory=resolve(store(options),'observations');if(!existsSync(directory))return [];
 return orderedRecords(readdirSync(directory).flatMap(run=>readdirSync(resolve(directory,run)).map(name=>json(resolve(directory,run,name)))));
}
function orderedRecords(records) {
 if(records.length<2)return records;
 const sequences=new Set(),legacyTimes=new Set();
 for(const record of records) {
  if(record.record_schema==='acceptance-record/v2') {
   if(!Number.isSafeInteger(record.sequence)||record.sequence<1||sequences.has(record.sequence))reject('Ambiguous persisted append order');
   sequences.add(record.sequence);
  } else {
   if(record.record_schema!==undefined||typeof record.recorded_at!=='string'||!Number.isFinite(Date.parse(record.recorded_at)))reject('Missing legacy ordering metadata');
   const time=Date.parse(record.recorded_at);
   if(legacyTimes.has(time))reject('Ambiguous legacy timestamps; explicit review required');
   legacyTimes.add(time);
  }
 }
 // Legacy records remain byte-for-byte intact and precede the upgraded writer.
 // Legacy timestamp ties are unverified, never broken by a convenient identifier.
 return [...records].sort((a,b)=>a.sequence!==undefined&&b.sequence!==undefined?a.sequence-b.sequence:a.sequence!==undefined?1:b.sequence!==undefined?-1:Date.parse(a.recorded_at)-Date.parse(b.recorded_at));
}
export function summarizeLedger(records, options = {}) {
 const ordered=orderedRecords(records),observations=ordered.map(x=>x.observation);
 for(const o of observations)validateObservation(o,options);
 const cases=catalog.cases.map(c=>{
  const apps=c.application==='both'?['workshop','library']:[c.application];
  const applications=apps.map(application=>{
   const values=ordered.filter(r=>r.observation.case_id===c.case_id && r.observation.application===application && r.observation.mode===c.primary_mode);
   const unresolved=new Map();
   for(const record of values) {
    const o=record.observation,key=`${o.run_id}/${record.observation_id}`;
    if(['failed','blocked','unverified'].includes(o.status))unresolved.set(key,o);
    if(o.status==='passed' && o.retests_observation) {
     const prior=unresolved.get(o.retests_observation);
     if(!prior||!o.defect_id||prior.defect_id!==o.defect_id)reject('Retest must explicitly supersede an earlier matching failure');
     unresolved.delete(o.retests_observation);
    }
   }
   const unresolvedStatus=[...unresolved.values()].some(o=>o.status==='failed')?'failed':[...unresolved.values()].at(-1)?.status;
   return {application,status:unresolvedStatus??values.at(-1)?.observation.status??'not_run',observations:values.length};
  });
  const status=applications.every(x=>x.status==='passed')?'passed':applications.find(x=>x.status==='failed')?.status??applications.find(x=>x.status!=='passed')?.status??'not_run';
  return {case_id:c.case_id,application:c.application,status,applications,observations:applications.reduce((sum,a)=>sum+a.observations,0)};
 });
 const requirements=Object.keys(catalog.requirements).map(ref=>({requirement:ref,observations:observations.filter(o=>o.requirements.includes(ref)).length}));
 const missing=[...cases.flatMap(c=>c.applications.filter(a=>!a.observations).map(a=>`${c.case_id}/${a.application}`)),...requirements.filter(r=>!r.observations).map(r=>r.requirement)];
 if(options.requireComplete && missing.length)reject(`Missing mandatory dispositions: ${missing.join(', ')}`);
 if(options.requirePassed && cases.some(c=>c.status!=='passed'))reject('Mandatory cases are failed, blocked, skipped, unverified or not run');
 return {schema:'acceptance-ledger/v1',cases,requirements,complete:missing.length===0,accepted:false,note:'Foundation summary only. Final verdict additionally requires both apps, final-code clean cycles, defect closure and independent review.'};
}
