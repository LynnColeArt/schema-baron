import {projectBehavior} from '../flow/index.js';
import {RuntimeManager} from '../runtime/index.js';
import {registerExport} from '../export/index.js';
import {registerExtensions} from '../extensions/index.js';
import type {RuntimeLifecyclePort} from '@schema-baron/generator';
import { createHmac, randomBytes } from 'node:crypto';
import { registerIdentity } from '../identity/index.js';
import { commandSchema, idSchema, diagnosticCodeSchema, jobSchema, createId, parseProject, validateProject, ModelValidationError, FORMAT_VERSION } from '@schema-baron/model';
import type { Command, Diagnostic, EntityBatchOperation, Project } from '@schema-baron/model';
import { ProjectStorage, StorageError, hash } from '@schema-baron/storage';
import type { StorageOptions } from '@schema-baron/storage';
import type { CommandEffect } from '../commands/index.js';
import { registerSchemaApply, CommittedMigrationError } from '../schema-apply/index.js';
import { registerSchemaPreview, SchemaPreviewError } from '../schema-preview/index.js';
import { registerGeneration, GenerationError } from '../generation/index.js';
import { registerQueryPreview } from '../query-preview/index.js';
import { registerConnections } from '../connections/index.js';
import { CommandRegistry } from '../commands/index.js';
import { constructForm } from '../form-construction/index.js';
import { PlanRepository } from '../plans/index.js';
export interface CoreOptions extends StorageOptions { ownerId: string; runtimeSecrets?:string[]; runtimeFault?:(point:'after-port-probe')=>void; runtimeLifecycle?:RuntimeLifecyclePort; generationFault?: (phase:string)=>void; migrationFault?: (point: string) => void; migrationWorkerFault?: string }
export type Outcome = { ok: true; revision: number; result: unknown; diagnostics: Diagnostic[]; jobId?:string } | { ok: false; revision: number; error: { code: string; message: string; retryable: boolean }; diagnostics: Diagnostic[] };
interface PendingCommand { projectId:string; operation: string; payloadHash: string; outcome: Promise<Outcome> }
const collection = { connection: 'connections', table: 'tables', query: 'queries', page: 'pages', form: 'forms', control: 'controls', action: 'actions', policy: 'policies', extension: 'extensionContracts' } as const;
export function stageBatch(project: Project, operations: EntityBatchOperation[]): Project {
 const candidate = structuredClone(project);
 for (const op of operations) {
  if (op.entity === 'connection' && op.kind === 'put') { const old = project.connections.find(c => c.id === op.id); if (!old || hash({ ...old, name: op.value.name, secretRef: op.value.secretRef }) !== hash(op.value)) throw new StorageError('ACCESS_DENIED', 'Inspected connection state can only change through inspect and bind.'); }
  if (op.entity === 'schema') { if (op.kind === 'remove') throw new StorageError('VALIDATION_FAILED', 'The project schema cannot be removed.'); candidate.schema = op.value; continue; }
  const values = (op.entity === 'table' ? candidate.schema.tables : candidate[collection[op.entity]]) as { id: string }[];
  const index = values.findIndex(value => value.id === op.id);
  if (op.kind === 'remove') { if (index < 0) throw new StorageError('INVALID_INPUT', 'Unknown entity.'); values.splice(index, 1); }
  else if (index < 0) values.push(op.value); else values[index] = op.value;
 }
 return candidate;
}
export function applyBatch(project: Project, operations: EntityBatchOperation[]): Project {
 const candidate=stageBatch(project,operations);candidate.revision++;return parseProject(candidate);
}
export class ProjectCore {
 private runtime:RuntimeManager;
 private closing?:Promise<void>;
 private transientKey=randomBytes(32);
 private commandHash(command:Command) {return command.operation==='identity.provision'?createHmac('sha256',this.transientKey).update(JSON.stringify(command)).digest('hex'):hash(command);}
 private migration: ReturnType<typeof registerSchemaApply>;
 private pending = new Map<string, PendingCommand>();
 private closeExport:()=>Promise<void>;
 private closeGeneration:()=>Promise<void>;
 private queryPreview: ReturnType<typeof registerQueryPreview>;
 private storage: ProjectStorage; private closed = false; private closeConnections: () => Promise<void>; private closeSchemaPreview: () => Promise<void>;
 readonly registry = new CommandRegistry(); readonly plans: PlanRepository;
 constructor(private options: CoreOptions) {
  this.storage = new ProjectStorage(options); this.plans = new PlanRepository(this.storage, actor => this.authorize(actor));
  this.runtime=new RuntimeManager({...options,isPromoting:id=>[...this.pending.values()].some(p=>p.projectId===id&&p.operation==='generation.apply')},this.storage);this.runtime.register(this.registry);
  this.closeExport=registerExport(this.registry,options,this.storage);
  registerIdentity(this.registry,options,id=>this.storage.snapshot(id),(id,c)=>this.storage.hasInspectedConnection(id,c));
  registerExtensions(this.registry,options,this.storage);
  this.closeGeneration=registerGeneration(this.registry, {...options,runtimeLifecycle:{stopForPromotion:async input=>{const result=await this.runtime.stopForPromotion(input);if(options.runtimeLifecycle){const external=await options.runtimeLifecycle.stopForPromotion(input);if(!['stopped','unmanaged'].includes(external.status))throw new StorageError('PROJECT_BUSY','Managed runtime refused to stop; output is preserved.');}return result;}}}, this.plans, this.storage);
  this.migration = registerSchemaApply(this.registry, options, this.storage, this.plans);
  this.closeConnections = registerConnections(this.registry, options, (id, connection) => this.storage.hasInspectedConnection(id, connection));
  this.closeSchemaPreview = registerSchemaPreview(this.registry, options, this.plans, id => this.closed ? undefined : this.storage.snapshot(id), (id, connection) => this.storage.hasInspectedConnection(id, connection));
  this.queryPreview = registerQueryPreview(this.registry, {...options,recordJob:(projectId,job)=>this.recordJob(options.ownerId,projectId,job)});
  this.registry.register('project.create', c => { if (c.operation !== 'project.create') throw new Error(); if (c.input.emptyDatabaseLocation) throw new StorageError('INVALID_INPUT', 'Database creation belongs to the connection adapter.'); const id = c.projectId; const policy = createId(); const candidate = parseProject({ id, formatVersion: FORMAT_VERSION, revision: 1, name: c.input.name, target: c.input.target, targetVersion: '1', connectionRefs: [], connections: [], schema: { id: createId(), revision: 1, tables: [], opaqueObjects: [] }, queries: [], pages: [], forms: [], controls: [], actions: [], policies: [{ id: policy, ownerId: id, scope: 'global', access: 'public' }], globalPolicyId: policy, outputConfig: { approvedRootId: 'output', relativePath: 'app' }, extensionContracts: [] }); return { result: candidate, candidate, root: c.input.approvedRoot }; });
  this.registry.register('project.batch', (c, p) => { if (c.operation !== 'project.batch' || !p) throw new Error(); return { result: { changedIds: c.input.operations.map(op => op.id) }, candidate: applyBatch(p, c.input.operations as EntityBatchOperation[]), changedIds: c.input.operations.map(op => op.id) }; });
  this.registry.register('form.construct', (c,p) => { if(c.operation !== 'form.construct' || !p) throw new Error(); return constructForm(p,c.input); });
  for (const operation of ['project.inspect', 'project.open'] as const) this.registry.register(operation, (c, p) => { return { result: p }; });
  this.registry.register('project.list', c => { if (c.operation !== 'project.list') throw new Error(); return { result: this.storage.list(c.input.approvedRoot) }; });
  this.registry.register('flow.inspect',(c,p)=>{if(c.operation!=='flow.inspect'||!p)throw new Error();if(c.input.projection==='schema')throw new StorageError('INVALID_INPUT','Use the schema editor for schema relationships; flow.inspect supports application and endpoint projections.');return {result:projectBehavior(p)};});
  this.registry.register('project.validate', (_c, p) => { const result = validateProject(p); return { result: { valid: result.ok, diagnostics: result.diagnostics } }; });

 }
 private authorize(actor: string) { if (actor !== this.options.ownerId) throw new StorageError('ACCESS_DENIED', 'Owner access is required.'); }
 snapshot(actor: string, id: string) { this.authorize(actor); return this.storage.snapshot(id); }
 events(actor: string, id: string, after: number, limit = 100) { this.authorize(actor); const events = this.storage.events(id, after, limit); return { events, refetchRequired: after > this.storage.latestSequence(id) || (after > 0 && events.length > 0 && events[0]!.sequence !== after + 1) }; }
 job(actor: string, projectId: string, id: string) { this.authorize(actor); return this.storage.job(projectId, id); }
 recordJob(actor: string, projectId: string, input: unknown) { this.authorize(actor); const job = jobSchema.parse(input); this.storage.putJob(projectId, job.id, job); return job; }
 operation(actor: string, projectId: string, requestId: string) { this.authorize(actor); return this.storage.operation(projectId, requestId); }
 /** Called only by an already reserved command handler; authorization still applies. */
 cancelQueryPreview(actor: string, projectId: string, id: string) { this.authorize(actor); return this.queryPreview.cancel(projectId,id); }
 get recovery() { return structuredClone(this.storage.recovery); }
 /** Reserve the canonical key before invoking an async feature, including its first
  * synchronous effect. The store's writer/root leases exclude another live core.
  * Completed outcomes remain durable in storage; pending matches share one result. */
 async executeAsync(actor: string, input: unknown): Promise<Outcome> {
  let command: Command; let project: Project; let payloadHash: string; let key: string;
  try {
   if (this.closed) return this.execute(actor, input);
   this.authorize(actor); command = commandSchema.parse(input);
   key = JSON.stringify([command.projectId, command.requestId]); payloadHash = this.commandHash(command);
   const pending = this.pending.get(key);
   if (pending) return pending.payloadHash === payloadHash ? pending.outcome : this.execute(actor, command);
   if (!this.registry.isAsync(command.operation)) return this.execute(actor, command);
   if (this.storage.lookup(command.projectId, command.requestId)) return this.execute(actor, command);
   project = this.storage.snapshot(command.projectId);
   if (command.expectedRevision !== project.revision) return this.execute(actor, command);
  } catch { return this.execute(actor, input); }
  const reservation: PendingCommand = { projectId:command.projectId, operation: command.operation, payloadHash, outcome: Promise.resolve().then(async () => {
   // Deferral lets us publish the reservation before any handler code executes.
   if (this.closed) return this.executePrepared(actor, command, undefined, reservation);
   try {
    // A synchronous mutation may have run between reservation and this microtask.
    if (this.storage.snapshot(command.projectId).revision !== command.expectedRevision) return this.executePrepared(actor, command, undefined, reservation);
    this.migration.guard(command.projectId, command.operation);
    const effect = await this.registry.runAsync(command, project);
    return this.executePrepared(actor, command, () => effect, reservation);
   } catch (error) { if (error instanceof CommittedMigrationError) return { ok: true as const, revision: command.expectedRevision, result: error.result, diagnostics: [] }; return this.executePrepared(actor, command, () => { throw error; }, reservation); }
  }).finally(() => { this.pending.delete(key); }) };
  this.pending.set(key, reservation);
  return reservation.outcome;
 }
 execute(actor: string, input: unknown): Outcome { return this.executePrepared(actor, input); }
 private executePrepared(actor: string, input: unknown, prepared?: () => CommandEffect, reservation?: PendingCommand): Outcome {
  let revision = 0; let accepted: Command | undefined; let payloadHash: string | undefined;
  try {
   if (this.closed && !(reservation && ['schema.apply','schema.restoreApply'].includes(reservation.operation))) throw new StorageError('RECOVERY_REQUIRED', 'Owner has closed; inspect the durable outcome after restart.');
   this.authorize(actor); const parsed = commandSchema.safeParse(input); if (!parsed.success) throw new StorageError('INVALID_INPUT', 'Command does not match the operation schema.'); const command: Command = parsed.data;
   if (!this.registry.has(command.operation)) throw new StorageError('INVALID_INPUT', 'Operation is not available.');
   payloadHash = this.commandHash(command); const retry = this.storage.lookup(command.projectId, command.requestId);
   if (retry) { if (retry.payloadHash !== payloadHash) throw new StorageError('IDEMPOTENCY_CONFLICT', command.operation==='identity.provision'?'Transient provisioning request was consumed or changed. After restart inspect the identity source and use a new request ID.':'Request ID already identifies a different payload.'); return retry.outcome as Outcome; }
   const recovering = this.migration.retry(command.projectId,command.requestId,payloadHash); if (recovering) return recovering;
   const pending = this.pending.get(JSON.stringify([command.projectId, command.requestId]));
   if (pending && pending !== reservation) {
    if (pending.payloadHash !== payloadHash) throw new StorageError('IDEMPOTENCY_CONFLICT', command.operation==='identity.provision'?'Transient provisioning request was consumed or changed. After restart inspect the identity source and use a new request ID.':'Request ID already identifies a different payload.');
    throw new StorageError('PROJECT_BUSY', 'This request is still running. Await executeAsync or retry after completion.');
   }
   this.migration.guard(command.projectId, command.operation);
   const project = command.operation === 'project.create' || command.operation === 'project.list' ? undefined : command.operation === 'project.open' ? this.storage.open(command.projectId, command.input.locator) : this.storage.snapshot(command.projectId); revision = project?.revision ?? 0;
   if (command.expectedRevision !== revision) {if(reservation&&command.operation==='project.export')accepted=command;throw new StorageError('REVISION_CONFLICT', 'Read the current revision before changing this project.');}
   if(command.operation==='identity.provision'&&!project?.identity)throw new StorageError('INVALID_INPUT','Configure identity before provisioning.');
   accepted = command;
   const effect = prepared ? prepared() : this.registry.run(command, project); const outcome: Outcome = { ok: true, revision: effect.candidate?.revision ?? revision, result: effect.result, diagnostics: [], ...(command.operation==='runtime.start'&&effect.result&&typeof effect.result==='object'&&'jobId' in effect.result&&typeof effect.result.jobId==='string'?{jobId:effect.result.jobId}:{}) };
   if (effect.job) { jobSchema.parse(effect.job); if (command.operation !== 'job.cancel' || command.input.jobId !== effect.job.id || effect.candidate) throw new StorageError('VALIDATION_FAILED', 'Job effects must match the cancellation command.'); }
   if (effect.candidate && (effect.candidate.id !== command.projectId || effect.candidate.revision !== revision + 1)) throw new StorageError('VALIDATION_FAILED', 'A mutation must preserve project identity and advance exactly one revision.');
   if (effect.candidate) this.storage.save(effect.candidate, effect.root, { requestId: command.requestId, payloadHash, actor, baseRevision: revision, newRevision: outcome.revision, outcome }, { revision: outcome.revision, kind: 'revision', objectIds: effect.changedIds ?? [command.projectId], diagnostics: [] });
   else if (project) this.storage.complete(command.projectId, { requestId: command.requestId, payloadHash, actor, baseRevision: revision, outcome }, null, effect.job);
   return outcome;
  } catch (error) {
   if (error instanceof CommittedMigrationError) return { ok: true, revision, result: error.result, diagnostics: [] };
   const diagnostics = error instanceof GenerationError || error instanceof ModelValidationError || error instanceof SchemaPreviewError ? error.diagnostics : accepted?.operation.startsWith('runtime.')&&error instanceof StorageError&&diagnosticCodeSchema.safeParse(error.code).success?[{code:diagnosticCodeSchema.parse(error.code),severity:'error' as const,objectId:idSchema.parse(accepted.operation==='runtime.route'?accepted.input.pageId:accepted.projectId),field:accepted.operation==='runtime.route'?'parameters':'runtime',path:accepted.operation,message:error.message}]:[];
   const outcome: Outcome = { ok: false, revision, error: { code: error instanceof StorageError ? error.code : error instanceof ModelValidationError || error instanceof GenerationError ? 'VALIDATION_FAILED' : 'RECOVERY_REQUIRED', message: error instanceof StorageError ? error.message : error instanceof ModelValidationError || error instanceof GenerationError ? error.message : 'Operation failed; inspect recovery before retrying.', retryable: error instanceof StorageError && ['PROJECT_BUSY', 'RECOVERY_REQUIRED'].includes(error.code) }, diagnostics };
   if (accepted && payloadHash && revision > 0 && !(error instanceof StorageError && error.code === 'RECOVERY_REQUIRED')) { try { this.storage.complete(accepted.projectId, { requestId: accepted.requestId, payloadHash, actor, baseRevision: revision, outcome }, { revision, kind: 'diagnostic', objectIds: diagnostics.flatMap(d => d.objectId ? [d.objectId] : []), diagnostics }); } catch { return { ok: false, revision, error: { code: 'RECOVERY_REQUIRED', message: 'Outcome could not be recorded; restart before retrying.', retryable: true }, diagnostics: [] }; } }
   return outcome;
  }
 }
 cancelRuntime(actor:string,projectId:string,jobId:string){this.authorize(actor);return this.runtime.cancel(projectId,jobId);}
 cancelMigration(projectId: string, jobId: string) { return this.migration.cancel(projectId, jobId); }
 close() {
  if (this.closed) return this.closing??Promise.resolve();
  this.closed = true;
  const ownedPending=[...this.pending.values()].filter(p=>['schema.apply','schema.restoreApply','project.export','runtime.start','runtime.stop','job.cancel'].includes(p.operation));
  const active = this.migration.active || this.queryPreview.hasActive() || this.runtime.hasActive() || ownedPending.length>0;
  const settling = Promise.all([this.migration.close(), this.closeConnections(), this.closeSchemaPreview(), this.closeGeneration(), this.queryPreview.close(), this.runtime.close(), this.closeExport()]);
  if (!active) { this.storage.close(); return this.closing=settling.then(() => {}); }
  return this.closing=settling.then(async () => {
   await Promise.all(ownedPending.map(p=>p.outcome));
   this.storage.close();
  });
 }
}
