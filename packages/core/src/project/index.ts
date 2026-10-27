import { commandSchema, jobSchema, createId, parseProject, validateProject, ModelValidationError, FORMAT_VERSION } from '@schema-baron/model';
import type { Command, Diagnostic, EntityBatchOperation, Project } from '@schema-baron/model';
import { ProjectStorage, StorageError, hash } from '@schema-baron/storage';
import type { StorageOptions } from '@schema-baron/storage';
import { CommandRegistry } from '../commands/index.js';
import { PlanRepository } from '../plans/index.js';
export interface CoreOptions extends StorageOptions { ownerId: string }
export type Outcome = { ok: true; revision: number; result: unknown; diagnostics: Diagnostic[] } | { ok: false; revision: number; error: { code: string; message: string; retryable: boolean }; diagnostics: Diagnostic[] };
const collection = { connection: 'connections', table: 'tables', query: 'queries', page: 'pages', form: 'forms', control: 'controls', action: 'actions', policy: 'policies', extension: 'extensionContracts' } as const;
export function applyBatch(project: Project, operations: EntityBatchOperation[]): Project {
 const candidate = structuredClone(project);
 for (const op of operations) {
  if (op.entity === 'schema') { if (op.kind === 'remove') throw new StorageError('VALIDATION_FAILED', 'The project schema cannot be removed.'); candidate.schema = op.value; continue; }
  const values = (op.entity === 'table' ? candidate.schema.tables : candidate[collection[op.entity]]) as { id: string }[];
  const index = values.findIndex(value => value.id === op.id);
  if (op.kind === 'remove') { if (index < 0) throw new StorageError('INVALID_INPUT', 'Unknown entity.'); values.splice(index, 1); }
  else if (index < 0) values.push(op.value); else values[index] = op.value;
 }
 candidate.revision++; return parseProject(candidate);
}
export class ProjectCore {
 private storage: ProjectStorage;
 readonly registry = new CommandRegistry(); readonly plans: PlanRepository;
 constructor(private options: CoreOptions) {
  this.storage = new ProjectStorage(options); this.plans = new PlanRepository(this.storage, actor => this.authorize(actor));
  this.registry.register('project.create', c => { if (c.operation !== 'project.create') throw new Error(); if (c.input.emptyDatabaseLocation) throw new StorageError('INVALID_INPUT', 'Database creation belongs to the connection adapter.'); const id = c.projectId; const policy = createId(); const candidate = parseProject({ id, formatVersion: FORMAT_VERSION, revision: 1, name: c.input.name, target: c.input.target, targetVersion: '1', connectionRefs: [], connections: [], schema: { id: createId(), revision: 1, tables: [], opaqueObjects: [] }, queries: [], pages: [], forms: [], controls: [], actions: [], policies: [{ id: policy, ownerId: id, scope: 'global', access: 'public' }], globalPolicyId: policy, outputConfig: { approvedRootId: 'output', relativePath: 'app' }, extensionContracts: [] }); return { result: candidate, candidate, root: c.input.approvedRoot }; });
  this.registry.register('project.batch', (c, p) => { if (c.operation !== 'project.batch' || !p) throw new Error(); return { result: { changedIds: c.input.operations.map(op => op.id) }, candidate: applyBatch(p, c.input.operations as EntityBatchOperation[]), changedIds: c.input.operations.map(op => op.id) }; });
  for (const operation of ['project.inspect', 'project.open'] as const) this.registry.register(operation, (c, p) => { return { result: p }; });
  this.registry.register('project.list', c => { if (c.operation !== 'project.list') throw new Error(); return { result: this.storage.list(c.input.approvedRoot) }; });
  this.registry.register('project.validate', (_c, p) => { const result = validateProject(p); return { result: { valid: result.ok, diagnostics: result.diagnostics } }; });
  this.registry.register('project.export', c => { if (c.operation !== 'project.export') throw new Error(); if (c.input.includeData) throw new StorageError('INVALID_INPUT', 'Data export is not available through definition export.'); const split = c.input.destination.indexOf(':'); if (split < 1) throw new StorageError('PATH_OUTSIDE_ROOT', 'Use approvedRootId:relativePath for export.'); return { result: this.storage.export(c.projectId, c.input.destination.slice(0, split), c.input.destination.slice(split + 1)) }; });
 }
 private authorize(actor: string) { if (actor !== this.options.ownerId) throw new StorageError('ACCESS_DENIED', 'Owner access is required.'); }
 snapshot(actor: string, id: string) { this.authorize(actor); return this.storage.snapshot(id); }
 events(actor: string, id: string, after: number, limit = 100) { this.authorize(actor); const events = this.storage.events(id, after, limit); return { events, refetchRequired: after > this.storage.latestSequence(id) || (after > 0 && events.length > 0 && events[0]!.sequence !== after + 1) }; }
 job(actor: string, projectId: string, id: string) { this.authorize(actor); return this.storage.job(projectId, id); }
 recordJob(actor: string, projectId: string, input: unknown) { this.authorize(actor); const job = jobSchema.parse(input); this.storage.putJob(projectId, job.id, job); return job; }
 operation(actor: string, projectId: string, requestId: string) { this.authorize(actor); return this.storage.operation(projectId, requestId); }
 get recovery() { return structuredClone(this.storage.recovery); }
 execute(actor: string, input: unknown): Outcome {
  let revision = 0; let accepted: Command | undefined; let payloadHash: string | undefined;
  try {
   this.authorize(actor); const parsed = commandSchema.safeParse(input); if (!parsed.success) throw new StorageError('INVALID_INPUT', 'Command does not match the operation schema.'); const command: Command = parsed.data;
   if (!this.registry.has(command.operation)) throw new StorageError('INVALID_INPUT', 'Operation is not available.');
   payloadHash = hash(command); const retry = this.storage.lookup(command.projectId, command.requestId);
   if (retry) { if (retry.payloadHash !== payloadHash) throw new StorageError('IDEMPOTENCY_CONFLICT', 'Request ID already identifies a different payload.'); return retry.outcome as Outcome; }
   const project = command.operation === 'project.create' || command.operation === 'project.list' ? undefined : command.operation === 'project.open' ? this.storage.open(command.projectId, command.input.locator) : this.storage.snapshot(command.projectId); revision = project?.revision ?? 0;
   if (command.expectedRevision !== revision) throw new StorageError('REVISION_CONFLICT', 'Read the current revision before changing this project.');
   accepted = command;
   const effect = this.registry.run(command, project); const outcome: Outcome = { ok: true, revision: effect.candidate?.revision ?? revision, result: effect.result, diagnostics: [] };
   if (effect.candidate && (effect.candidate.id !== command.projectId || effect.candidate.revision !== revision + 1)) throw new StorageError('VALIDATION_FAILED', 'A mutation must preserve project identity and advance exactly one revision.');
   if (effect.candidate) this.storage.save(effect.candidate, effect.root, { requestId: command.requestId, payloadHash, actor, baseRevision: revision, newRevision: outcome.revision, outcome }, { revision: outcome.revision, kind: 'revision', objectIds: effect.changedIds ?? [command.projectId], diagnostics: [] });
   else if (project) this.storage.complete(command.projectId, { requestId: command.requestId, payloadHash, actor, baseRevision: revision, outcome }, null);
   return outcome;
  } catch (error) {
   const diagnostics = error instanceof ModelValidationError ? error.diagnostics : [];
   const outcome: Outcome = { ok: false, revision, error: { code: error instanceof StorageError ? error.code : error instanceof ModelValidationError ? 'VALIDATION_FAILED' : 'RECOVERY_REQUIRED', message: error instanceof StorageError ? error.message : error instanceof ModelValidationError ? 'Candidate project is invalid.' : 'Operation failed; inspect recovery before retrying.', retryable: error instanceof StorageError && ['PROJECT_BUSY', 'RECOVERY_REQUIRED'].includes(error.code) }, diagnostics };
   if (accepted && payloadHash && revision > 0 && !(error instanceof StorageError && error.code === 'RECOVERY_REQUIRED')) { try { this.storage.complete(accepted.projectId, { requestId: accepted.requestId, payloadHash, actor, baseRevision: revision, outcome }, { revision, kind: 'diagnostic', objectIds: diagnostics.flatMap(d => d.objectId ? [d.objectId] : []), diagnostics }); } catch { return { ok: false, revision, error: { code: 'RECOVERY_REQUIRED', message: 'Outcome could not be recorded; restart before retrying.', retryable: true }, diagnostics: [] }; } }
   return outcome;
  }
 }
 close() { this.storage.close(); }
}
