import { existsSync, lstatSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { createId, idSchema, parseProject, schemaSchema, validateProject } from '@schema-baron/model';
import type { Action, EntityBatchOperation, Page, Project, ReviewedPlan, Schema, StableId } from '@schema-baron/model';
import { constructForm, connectionPath, schemaFromInspection } from '@schema-baron/core';
import type { ProjectCore, CoreOptions } from '@schema-baron/core';
import { SQLiteWorker, SQLiteError } from '@schema-baron/sqlite';
import { hash, StorageError } from '@schema-baron/storage';
import type { LocalWorkspace } from './workspace.js';

export const applicationOptionsSchema = z.strictObject({
 tables: z.array(z.strictObject({ tableId: idSchema, list: z.boolean(), record: z.boolean(), search: z.boolean() })).max(100),
 login: z.boolean(), protectWrites: z.boolean(), menu: z.boolean(), startTableId: z.string(),
});
export type ApplicationOptions = z.infer<typeof applicationOptionsSchema>;
const databaseSchema = z.discriminatedUnion('kind', [
 z.strictObject({ kind: z.literal('new'), file: z.string().min(1).max(240) }),
 z.strictObject({ kind: z.literal('existing'), inspectionId: idSchema }),
]);
export const setupInputSchema = z.strictObject({
 requestId: idSchema.refine(id => !/[\\/]/.test(id) && !['.', '..'].includes(id), 'Invalid project identity'), name: z.string().trim().min(1).max(120), projectsFolder: z.string().min(1).max(4096),
 database: databaseSchema, schema: schemaSchema, options: applicationOptionsSchema,
});
export type SetupInput = z.infer<typeof setupInputSchema>;
export interface SetupPreview { planId: string; project: Project; database: string; changes: string[]; expiresAt: string }
interface Inspection { path: string; fingerprint: string; identity: string; schema: Schema; expires: number }
interface Proposal { input: SetupInput; preview: SetupPreview; inspection?: Inspection; completed?: Project; work?: Promise<Project> }
const destination = (pageId: StableId) => ({ pageId, keyMapping: [], filterMapping: [] });
function page(title: string, route: string): Page { return { id: createId(), title, route, document: [], formIds: [] }; }
export function emptySetupProject(id: StableId, name: string, schema: Schema): Project {
 const policy = createId();
 return parseProject({ id, name, formatVersion: 1, revision: 1, target: 'next-typescript-sqlite', targetVersion: '1', connectionRefs: [], connections: [], schema, queries: [], pages: [], forms: [], controls: [], actions: [], policies: [{ id: policy, ownerId: id, scope: 'global', access: 'public' }], globalPolicyId: policy, outputConfig: { approvedRootId: 'output', relativePath: 'generated/app' }, extensionContracts: [] });
}
/** Ordinary project entities, constructed by the same engine as the form wizard. */
export function proposeApplication(original: Project, options: ApplicationOptions): Project {
 let project = structuredClone(original);
 if (project.pages.length) throw new StorageError('INVALID_INPUT', 'Guided setup starts with an empty application.');
 if (options.protectWrites && !options.login) throw new StorageError('INVALID_INPUT', 'Enable simple login before protecting write actions.');
 const choices = options.tables.filter(t => t.list || t.record || t.search);
 if (new Set(options.tables.map(t => t.tableId)).size !== options.tables.length) throw new StorageError('INVALID_INPUT', 'Choose each table once.');
 const selected = choices.map(c => {
  const table = project.schema.tables.find(t => t.id === c.tableId);
  if (!table) throw new StorageError('INVALID_INPUT', 'A selected table is no longer in the schema.');
  if (!c.list || (c.record && !table.primaryKey.length)) throw new StorageError('INVALID_INPUT', 'Record pages require a list and a complete primary key.');
  if (c.record && table.columns.some(c => c.type.kind === 'blob' && !c.nullable && !c.default && !c.generated)) throw new StorageError('INVALID_INPUT', 'Use a list for tables with required binary fields; their records need a supported binary editor.');
  const fields = table.columns.filter(c => c.type.kind !== 'blob').map(c => c.id);
  if (!fields.length || (c.record && table.primaryKey.some(k => !fields.includes(k)))) throw new StorageError('INVALID_INPUT', 'Choose a table with supported fields and keys for these pages.');
  return { ...c, table, fields };
 });
 if (!selected.length) throw new StorageError('INVALID_INPUT', 'Select at least one table for a list page.');
 const first = selected.find(c => c.table.id === options.startTableId) ?? selected[0]!;
 const routes = new Set<string>(['/login']);
 const entries = selected.map((c, i) => {
  const base = c.table.physicalName.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || `table-${i + 1}`;
  let slug = base; let suffix = 2;
  while (routes.has(`/${slug}`) || routes.has(`/${slug}/record`)) slug = `${base}-${suffix++}`;
  routes.add(`/${slug}`); routes.add(`/${slug}/record`);
  return { ...c, listPage: page(c.table.physicalName, c === first ? '/' : `/${slug}`), recordPage: c.record ? page(`${c.table.physicalName} record`, `/${slug}/record`) : undefined };
 });
 const loginPage = options.login ? page('Login', '/login') : undefined;
 project.pages.push(...entries.flatMap(e => [e.listPage, ...(e.recordPage ? [e.recordPage] : [])]), ...(loginPage ? [loginPage] : []));
 if (loginPage) project.identity = { kind: 'managed', storeRef: createId() };
 for (const e of entries) {
  const definitions: Omit<Action, 'id' | 'formId'>[] = [];
  if (options.menu) for (const target of entries.filter(t => t !== e)) definitions.push({ operation: 'navigate', destination: destination(target.listPage.id) });
  const made = constructForm(project, {
   pageId: e.listPage.id, kind: 'Grid', source: { kind: 'table', id: e.table.id }, fieldIds: e.fields, keyIds: e.table.primaryKey,
   actions: [], links: [], style: { label: e.table.physicalName }, actionDefinitions: definitions,
   search: e.search ? e.table.columns.filter(c => c.type.kind !== 'blob').map(c => ({ fieldId: c.id, operator: c.type.kind === 'text' ? 'contains' as const : 'eq' as const })) : [],
   ...(e.recordPage ? { linkedRecord: { pageId: e.recordPage.id, label: `${e.table.physicalName} record`, fieldIds: e.fields, keyIds: e.table.primaryKey } } : {}),
  });
  project = made.candidate;
  const grid = project.forms.find(f => f.pageId === e.listPage.id && f.kind === 'Grid')!;
  // Linked Record construction already supplies Add and Edit actions. Give its
  // Add action a captioned control rather than declaring a second destination.
  for (const action of project.actions.filter(a => a.formId === grid.id && a.operation === 'navigate' && a.destination?.pageId === e.recordPage?.id && a.destination?.keyMapping.length === 0)) {
   if (project.controls.some(c => c.formId === grid.id && c.events.some(event => event.actionId === action.id))) continue;
   const id = createId(); grid.controlIds.push(id);
   project.controls.push({ id, formId: grid.id, kind: 'link', readOnly: true, appearance: { label: `Add ${e.table.physicalName}` }, validation: { required: false }, events: [{ event: 'click', actionId: action.id }] });
  }
  for (const c of project.controls.filter(c => c.formId === grid.id)) {
   const a = project.actions.find(a => c.events.some(ev => ev.actionId === a.id));
   if (!a?.destination || a.destination.keyMapping.length) continue;
   c.appearance.label = a.destination.pageId === e.recordPage?.id ? `Add ${e.table.physicalName}` : `Go to ${project.pages.find(p => p.id === a.destination!.pageId)?.title}`;
  }
 }
 if (loginPage) {
  project = constructForm(project, { pageId: loginPage.id, kind: 'Login', fieldIds: [], keyIds: [], actions: [], links: [], style: { label: 'Sign in' }, actionDefinitions: [{ operation: 'login', success: destination(firstPage(project)) }, { operation: 'logout', success: destination(firstPage(project)) }, { operation: 'cancel', destination: destination(firstPage(project)) }] }).candidate;
  for (const f of project.forms.filter(f => f.kind === 'Grid')) {
   const id = createId(); f.controlIds.push(id);
   project.controls.push({ id, formId: f.id, kind: 'identity', readOnly: true, appearance: { label: 'Signed in as' }, validation: { required: false }, events: [] });
  }
 }
 if (options.protectWrites) for (const action of project.actions.filter(a => ['insert', 'update', 'delete'].includes(a.operation))) {
  const policyId = createId(); action.policyId = policyId;
  project.policies.push({ id: policyId, ownerId: action.id, scope: 'action', access: 'authenticated' });
 }
 if (options.protectWrites) for (const recordPage of project.pages.filter(p => project.forms.some(f => f.pageId === p.id && f.kind === 'Record'))) {
  const policyId = createId(); recordPage.policyId = policyId;
  project.policies.push({ id: policyId, ownerId: recordPage.id, scope: 'page', access: 'authenticated' });
 }
 if ([project.pages, project.forms, project.controls, project.actions, project.policies].reduce((count, values) => count + values.length, 0) > 1000) throw new StorageError('INVALID_INPUT', 'This proposal is too large for one setup. Select fewer tables and add further pages after setup.');
 for (const form of project.forms.filter(f => f.kind === 'Record')) {
  const table = project.schema.tables.find(t => t.id === form.sourceRef?.id)!;
  form.displayFieldIds = [table.columns.find(c => c.type.kind === 'text' && !table.primaryKey.includes(c.id))?.id ?? table.primaryKey[0]!];
 }
 const validation = validateProject(project);
 if (!validation.ok) throw new StorageError('VALIDATION_FAILED', validation.diagnostics.filter(d => d.severity === 'error').map(d => d.message).join(' '));
 return parseProject(project);
}
function firstPage(project: Project) { return project.pages.find(p => p.route === '/')!.id; }
function fileIdentity(path: string) { const s = lstatSync(path); return `${s.dev}:${s.ino}`; }

/** Review is read-only. Complete delegates every durable mutation to canonical commands. */
export class ProjectSetup {
 private closed = false;
 private workers = new Set<SQLiteWorker>();
 private inspections = new Map<string, Inspection>();
 private proposals = new Map<string, Proposal>();
 constructor(private core: ProjectCore, private options: CoreOptions, private workspace?: LocalWorkspace) {}
 private sweep() {
  if (this.closed) throw new StorageError('RECOVERY_REQUIRED', 'Studio is shutting down. Reopen setup after restarting.');
  const now = Date.now();
  for (const [id, value] of this.inspections) if (value.expires < now) this.inspections.delete(id);
  for (const [id, value] of this.proposals) if (!value.work && Date.parse(value.preview.expiresAt) < now) this.proposals.delete(id);
  if (this.inspections.size + this.proposals.size >= 100) throw new StorageError('PROJECT_BUSY', 'Close or finish an earlier setup before starting another.');
 }
 async inspect(path: string) {
  this.sweep();
  const expanded = path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
  if (!isAbsolute(expanded)) throw new StorageError('INVALID_INPUT', 'Enter an absolute SQLite file path or a ~/ path.');
  const directory = dirname(resolve(expanded));
  const file = connectionPath({ selected: directory }, `selected:${basename(expanded)}`, this.options.metadataRoot).path;
  if (!existsSync(file) || !lstatSync(file).isFile()) throw new StorageError('NOT_FOUND', 'Choose an existing SQLite database file.');
  const before = fileIdentity(file), worker = new SQLiteWorker(file);
  this.workers.add(worker);
  try {
   const inspection = await worker.inspect();
   if (before !== fileIdentity(file)) throw new StorageError('DATABASE_CHANGED', 'Database changed while reading it. Choose it again.');
   const schema = schemaFromInspection(inspection, { id: createId(), revision: 1, tables: [], opaqueObjects: [] });
   const inspectionId = createId();
   this.inspections.set(inspectionId, { path: file, fingerprint: inspection.fingerprint, identity: before, schema, expires: Date.now() + 1800000 });
   return { inspectionId, schema, path: file, tableCount: schema.tables.length, unsupportedCount: schema.opaqueObjects.length };
  } catch (error) { if (error instanceof SQLiteError) throw new StorageError(error.code, error.message); throw error; } finally { await worker.close(); this.workers.delete(worker); }
 }
 preview(input: SetupInput): SetupPreview {
  this.sweep();
  const inspection = input.database.kind === 'existing' ? this.inspections.get(input.database.inspectionId) : undefined;
  if (input.database.kind === 'existing' && (!inspection || inspection.expires < Date.now())) throw new StorageError('PLAN_EXPIRED', 'Read the existing database again before reviewing.');
  if (inspection && hash(input.schema) !== hash(inspection.schema)) throw new StorageError('INVALID_INPUT', 'Existing database setup preserves its imported schema. Edit it after setup through reviewed migrations.');
  if (input.database.kind === 'new' && (/[\\/]/.test(input.database.file) || !/\.(sqlite|sqlite3|db)$/i.test(input.database.file))) throw new StorageError('INVALID_INPUT', 'Use a SQLite filename such as application.sqlite.');
  const schema = inspection?.schema ?? input.schema;
  const project = proposeApplication(emptySetupProject(input.requestId, input.name, schema), input.options);
  const preview: SetupPreview = { planId: createId(), project, database: inspection ? inspection.path : input.database.kind === 'new' ? input.database.file : '', changes: inspection ? ['Use the existing database without changing its tables or rows.'] : schema.tables.map(t => `Create table ${t.physicalName} (${t.columns.length} columns; ${t.primaryKey.length} primary-key fields; ${t.foreignKeys.length} relationships).`), expiresAt: new Date(Date.now() + 1800000).toISOString() };
  this.proposals.set(preview.planId, { input: structuredClone(input), preview, ...(inspection ? { inspection } : {}) });
  return preview;
 }
 async complete(id: string): Promise<Project> {
  if (this.closed) throw new StorageError('RECOVERY_REQUIRED', 'Studio is shutting down.');
  const proposal = this.proposals.get(id);
  if (!proposal || Date.parse(proposal.preview.expiresAt) < Date.now()) throw new StorageError('PLAN_EXPIRED', 'Review the application again before completing setup.');
  if (proposal.completed) return proposal.completed;
  if (proposal.work) return proposal.work;
  proposal.work = this.finish(proposal).then(project => (proposal.completed = project));
  try { return await proposal.work; } finally { delete proposal.work; }
 }
 private async command(projectId: string, operation: string, input: unknown, requestId = createId()) {
  if (this.closed) throw new StorageError('RECOVERY_REQUIRED', 'Studio is shutting down.');
  const project = operation === 'project.create' ? undefined : this.core.snapshot(this.options.ownerId, projectId);
  const result = await this.core.executeAsync(this.options.ownerId, { projectId, operation, requestId, expectedRevision: project?.revision ?? 0, input });
  if (!result.ok) throw new StorageError(result.error.code, result.error.message);
  return result.result;
 }
 private async finish(plan: Proposal) {
  const { input, preview, inspection } = plan;
  if (!this.workspace) throw new StorageError('INVALID_INPUT', 'Guided setup requires a local workspace.');
  if (inspection) {
   const worker = new SQLiteWorker(inspection.path); this.workers.add(worker);
   try { if (fileIdentity(inspection.path) !== inspection.identity || (await worker.inspect()).fingerprint !== inspection.fingerprint) throw new StorageError('DATABASE_CHANGED', 'The selected database changed. Read and review it again.'); } finally { await worker.close(); this.workers.delete(worker); }
  }
  if (this.closed) throw new StorageError('RECOVERY_REQUIRED', 'Studio is shutting down.');
  const root = this.workspace.project(input.name, input.requestId, this.core, input.projectsFolder);
  let live: Project;
  try { live = this.core.snapshot(this.options.ownerId, input.requestId); }
  catch { live = await this.command(input.requestId, 'project.create', { name: input.name, approvedRoot: root, target: 'next-typescript-sqlite', schema: preview.project.schema, globalPolicyId: preview.project.globalPolicyId, outputConfig: { approvedRootId: root, relativePath: 'generated/app' } }, input.requestId) as Project; }
  if (live.pages.length) throw new StorageError('REVISION_CONFLICT', 'This project already has pages. Open it rather than replacing its application.');
  if (!live.connections.length) {
   let locator: string;
   if (inspection) {
    const approvedRoot = this.workspace.approveDatabase(inspection.path, this.core);
    locator = `${approvedRoot}:${basename(inspection.path)}`;
   } else locator = `${root}:${input.database.kind === 'new' ? input.database.file : 'application.sqlite'}`;
   const found = await this.command(live.id, 'connection.inspect', { approvedPath: locator, mode: 'read-only', ...(!inspection ? { createEmpty: true } : {}) }) as { connection: Project['connections'][number] };
   if (inspection && found.connection.fingerprint !== inspection.fingerprint) throw new StorageError('DATABASE_CHANGED', 'The database changed; review it again.');
   await this.command(live.id, 'connection.bind', { connectionId: found.connection.id, fingerprint: found.connection.fingerprint });
  }
  live = this.core.snapshot(this.options.ownerId, live.id);
  if (!inspection) {
   if (hash(live.schema.tables) !== hash(preview.project.schema.tables)) await this.command(live.id, 'project.batch', { operations: [{ kind: 'put', entity: 'schema', id: live.schema.id, value: { ...preview.project.schema, id: live.schema.id } }] });
   live = this.core.snapshot(this.options.ownerId, live.id);
   const migration = await this.command(live.id, 'schema.preview', { desiredSchemaRevision: live.schema.revision, backfills: [] }) as Extract<ReviewedPlan, { kind: 'migration' }>;
   if (migration.requiredAcknowledgementIds.length) throw new StorageError('VALIDATION_FAILED', 'Setup only creates new tables. Review this migration in Schema before proceeding.');
   if (migration.steps.length) {
    const applied = await this.command(live.id, 'schema.apply', { planId: migration.id, hash: migration.hash, acknowledgedImpactIds: [] }) as { committed: boolean; recoveryRequired: boolean };
    if (!applied.committed || applied.recoveryRequired) throw new StorageError('RECOVERY_REQUIRED', 'Schema creation needs recovery. Open the saved project and inspect migration history.');
   }
  }
  if (preview.project.identity && !live.identity) await this.command(live.id, 'identity.configure', preview.project.identity);
  const operations: EntityBatchOperation[] = [];
  for (const [entity, values] of [['page', preview.project.pages], ['form', preview.project.forms], ['control', preview.project.controls], ['action', preview.project.actions], ['policy', preview.project.policies]] as const)
   for (const value of values) operations.push({ kind: 'put', entity, id: value.id, value } as EntityBatchOperation);
  await this.command(live.id, 'project.batch', { operations });
  return this.core.snapshot(this.options.ownerId, live.id);
 }
 async close() {
  this.closed = true;
  await Promise.allSettled([...this.workers].map(worker => worker.close()));
  await Promise.allSettled([...this.proposals.values()].flatMap(p => p.work ? [p.work] : []));
  this.inspections.clear(); this.proposals.clear();
 }

}
