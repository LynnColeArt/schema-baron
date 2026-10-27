import { z } from 'zod';
import { actionSchema, connectionSchema, controlSchema, expressionSchema, extensionContractSchema, formSchema, hashSchema, idSchema, pageSchema, policySchema, projectSchema, querySchema, revisionSchema, schemaSchema, sourceRefSchema, tableSchema, targetSchema } from './schemas.js';
import { diagnosticSchema, outcomeSchema } from './diagnostics.js';
import type { Diagnostic } from './diagnostics.js';

const text = z.string().min(1);
const ids = z.array(idSchema);
const scalar = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const applyInput = z.strictObject({ planId: idSchema, hash: hashSchema, acknowledgedImpactIds: ids });
const previewSchemaInput = z.strictObject({ desiredSchemaRevision: revisionSchema, backfills: z.array(z.strictObject({ tableId: idSchema, columnId: idSchema, expression: expressionSchema })) });
export const entitySchemas = { connection: connectionSchema, schema: schemaSchema, table: tableSchema, query: querySchema, page: pageSchema, form: formSchema, control: controlSchema, action: actionSchema, policy: policySchema, extension: extensionContractSchema } as const;
export const entityBatchOperationSchema = z.union(Object.entries(entitySchemas).flatMap(([entity, schema]) => [z.strictObject({ kind: z.literal('put'), entity: z.literal(entity), id: idSchema, value: schema }).refine(op => op.id === op.value.id, 'Entity identity must match'), z.strictObject({ kind: z.literal('remove'), entity: z.literal(entity), id: idSchema })]));
export type EntityBatchOperation = { [K in keyof typeof entitySchemas]: { kind: 'put'; entity: K; id: z.infer<typeof idSchema>; value: z.infer<(typeof entitySchemas)[K]> } | { kind: 'remove'; entity: K; id: z.infer<typeof idSchema> } }[keyof typeof entitySchemas];
// No raw SQL/filesystem patch operation exists. Adapters consume the same schemas.
export const operationInputSchemas = {
  'project.create': z.strictObject({ name: text, approvedRoot: text, target: targetSchema, emptyDatabaseLocation: text.optional() }),
  'project.inspect': z.strictObject({ projection: z.enum(['full', 'summary']).optional() }),
  'project.open': z.strictObject({ locator: text }),
  'project.list': z.strictObject({ approvedRoot: text }),
  'project.batch': z.strictObject({ operations: z.array(entityBatchOperationSchema).min(1).max(1000) }),
  'project.export': z.strictObject({ destination: text, includeData: z.boolean().default(false) }),
  'connection.inspect': z.strictObject({ approvedPath: text, mode: z.literal('read-only'), createEmpty: z.literal(true).optional(), connectionId: idSchema.optional() }),
  'connection.bind': z.strictObject({ connectionId: idSchema, fingerprint: hashSchema }),
  'schema.preview': previewSchemaInput,
  'schema.apply': applyInput,
  'schema.history': z.strictObject({ connectionId: idSchema }),
  'schema.restorePreview': z.strictObject({ connectionId: idSchema, backupRef: idSchema }),
  'schema.restoreApply': applyInput,
  'query.preview': z.union([z.strictObject({ queryId: idSchema, parameters: z.record(idSchema, scalar), rowLimit: z.number().int().min(1).max(200) }), z.strictObject({ draft: querySchema, parameters: z.record(idSchema, scalar), rowLimit: z.number().int().min(1).max(200) })]),
  'form.construct': z.strictObject({ pageId: idSchema, kind: formSchema.shape.kind, source: sourceRefSchema.optional(), fieldIds: ids, keyIds: ids, actions: z.array(actionSchema.shape.operation), links: z.array(actionSchema.shape.destination.unwrap()), style: formSchema.shape.appearance }),
  'extension.read': z.strictObject({ extensionId: idSchema, approvedPath: text }),
  'extension.write': z.strictObject({ extensionId: idSchema, approvedPath: text, content: z.string(), expectedFileHash: hashSchema }),
  // Transient only. Never serialize this input into Project, OperationRecord or diagnostics.
  'identity.provision': z.strictObject({ identitySourceRef: idSchema, username: text, password: z.string().min(1).max(1024) }),
  'project.validate': z.strictObject({ objectIds: ids.optional() }),
  'flow.inspect': z.strictObject({ projection: z.enum(['application', 'schema', 'endpoint']), selectedId: idSchema.optional() }),
  'generation.preview': z.strictObject({ target: targetSchema, outputRoot: text, projectRevision: revisionSchema }),
  'generation.apply': applyInput,
  'runtime.start': z.strictObject({ generatedRevision: revisionSchema, intent: z.enum(['build', 'run']) }),
  'runtime.stop': z.strictObject({ generatedRevision: revisionSchema }),
  'runtime.status': z.strictObject({ generatedRevision: revisionSchema }),
  'job.inspect': z.strictObject({ jobId: idSchema }),
  'job.cancel': z.strictObject({ jobId: idSchema }),
} as const;
export type Operation = keyof typeof operationInputSchemas;
export type Command = { [K in Operation]: { requestId: z.infer<typeof idSchema>; projectId: z.infer<typeof idSchema>; operation: K; expectedRevision: number; input: z.input<(typeof operationInputSchemas)[K]> } }[Operation];
export const commandSchema = z.union(Object.entries(operationInputSchemas).map(([operation, input]) => z.strictObject({ requestId: idSchema, projectId: idSchema, operation: z.literal(operation), expectedRevision: operation === 'project.create' || operation === 'project.list' ? z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) : revisionSchema, input }))) as z.ZodType<Command>;
export const impactSchema = z.strictObject({ id: idSchema, objectId: idSchema.optional(), kind: z.enum(['create', 'change', 'delete', 'data-loss', 'conflict', 'cascade', 'backfill']), description: text, requiresAcknowledgement: z.boolean(), affectedCount: z.number().int().min(0).optional() });
const planBase = { id: idSchema, sourceRevision: revisionSchema, modelHash: hashSchema, hash: hashSchema, createdAt: z.iso.datetime(), expiresAt: z.iso.datetime(), impact: z.array(impactSchema), requiredAcknowledgementIds: ids };
export const reviewedPlanSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...planBase, kind: z.literal('migration'), connectionId: idSchema, schemaFingerprint: hashSchema, dataFingerprint: hashSchema, backupPolicy: z.strictObject({ required: z.literal(true), approvedRootId: idSchema }), recovery: z.strictObject({ backupMethod: z.literal('sqlite-online-backup'), instructions: z.array(text).min(1), foreignKeysBeforeTransaction: z.literal(false), verifyBeforeCommit: z.array(z.enum(['foreign_key_check', 'integrity_check'])), restoreRequiresReview: z.literal(true), sqliteVersion: text, strategy: z.enum(['native', 'rebuild']) }).optional(), changes: z.array(z.strictObject({ objectId: idSchema, tableId: idSchema, kind: z.enum(['rename','add','drop','type','key','index','foreign-key','constraint']), description: text })).optional(), steps: z.array(z.strictObject({ id: idSchema, sql: text, objectIds: ids, transactional: z.boolean() })) }),
  z.strictObject({ ...planBase, kind: z.literal('restore'), connectionId: idSchema, backupRef: idSchema, schemaFingerprint: hashSchema, dataFingerprint: hashSchema, backupFingerprint: hashSchema, backupDataFingerprint: hashSchema, restoredSchema: schemaSchema, steps: z.array(z.strictObject({ id: idSchema, sql: text, objectIds: ids, transactional: z.literal(true) })) }),
  z.strictObject({ ...planBase, kind: z.literal('generation'), generatorVersion: text, outputFingerprint: hashSchema, outputRootId: idSchema, extensionHashes: z.record(idSchema, hashSchema), steps: z.array(z.strictObject({ id: idSchema, path: text, operation: z.enum(['create', 'replace', 'delete', 'preserve']), beforeHash: hashSchema.optional(), afterHash: hashSchema.optional() })) }),
]).superRefine((plan, ctx) => {
  if (Date.parse(plan.expiresAt) <= Date.parse(plan.createdAt)) ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Plan expiry must follow creation' });
  const required = plan.impact.filter(i => i.requiresAcknowledgement).map(i => i.id).sort();
  if (new Set(plan.impact.map(i => i.id)).size !== plan.impact.length || new Set(plan.requiredAcknowledgementIds).size !== plan.requiredAcknowledgementIds.length || JSON.stringify(required) !== JSON.stringify([...plan.requiredAcknowledgementIds].sort())) ctx.addIssue({ code: 'custom', path: ['requiredAcknowledgementIds'], message: 'Required acknowledgement IDs must exactly match disclosed impact' });
});
export type ReviewedPlan = z.infer<typeof reviewedPlanSchema>;
/** Pure freshness check. Services must call while holding their actual lease/transaction. */
export function validatePlanApplication(plan: ReviewedPlan, input: z.infer<typeof applyInput>, observed: { revision: number; modelHash: string; fingerprint: string; dataFingerprint?: string; now: string }): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const fail = (code: Diagnostic['code'], field: string, message: string) => diagnostics.push({ code, field, message, severity: 'error', objectId: plan.id });
  if (input.planId !== plan.id || input.hash !== plan.hash) fail('PLAN_HASH_MISMATCH', 'hash', 'Apply must reference the reviewed plan and hash.');
  if (observed.revision !== plan.sourceRevision || observed.modelHash !== plan.modelHash) fail('REVISION_CONFLICT', 'sourceRevision', 'Model changed after preview.');
  if (!Number.isFinite(Date.parse(observed.now)) || Date.parse(observed.now) >= Date.parse(plan.expiresAt)) fail('PLAN_EXPIRED', 'expiresAt', 'Reviewed plan has expired.');
  if (observed.fingerprint !== (plan.kind !== 'generation' ? plan.schemaFingerprint : plan.outputFingerprint) || (plan.kind !== 'generation' && observed.dataFingerprint !== plan.dataFingerprint)) fail(plan.kind !== 'generation' ? 'DATABASE_CHANGED' : 'OUTPUT_CONFLICT', 'fingerprint', 'External state changed after preview.');
  if (new Set(input.acknowledgedImpactIds).size !== input.acknowledgedImpactIds.length || JSON.stringify([...input.acknowledgedImpactIds].sort()) !== JSON.stringify([...plan.requiredAcknowledgementIds].sort())) fail('IMPACT_NOT_ACKNOWLEDGED', 'acknowledgedImpactIds', 'Acknowledge the exact impact IDs from this plan.');
  return diagnostics;
}
export const operationRecordSchema = z.strictObject({ requestId: idSchema, payloadHash: hashSchema, actor: idSchema, baseRevision: z.number().int().min(0), newRevision: revisionSchema.optional(), planId: idSchema.optional(), outcome: z.enum(['committed', 'failed', 'recovery-pending']), eventSequence: z.number().int().min(0) });
export const generationManifestSchema = z.strictObject({ generatorVersion: text, modelVersion: revisionSchema, modelHash: hashSchema, ownedFileHashes: z.record(text, hashSchema), authoredContractVersions: z.record(idSchema, revisionSchema), outputTreeRevision: revisionSchema });
export const editorDraftSchema = z.strictObject({ objectId: idSchema, baseRevision: revisionSchema, dirtyFields: z.array(text), validation: z.array(diagnosticSchema), focus: z.string().optional(), selection: ids, history: z.array(z.strictObject({ operation: entityBatchOperationSchema })) });
export const viewStateSchema = z.strictObject({ revision: revisionSchema, positions: z.record(idSchema, z.strictObject({ x: z.number().finite(), y: z.number().finite() })), viewport: z.strictObject({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().positive() }), paneSizes: z.record(text, z.number().positive()), selectedObjectId: idSchema.optional() });
export const jobSchema = z.strictObject({ id: idSchema, status: z.enum(['pending', 'running', 'succeeded', 'failed', 'canceled']), phase: text.optional(), progress: z.number().min(0).max(1).optional(), committed: z.boolean(), diagnostics: z.array(diagnosticSchema), outcome: outcomeSchema(z.unknown()).optional() }).refine(job => !(job.committed && job.status === 'canceled'), 'Committed work cannot be canceled');
export const eventSchema = z.strictObject({ sequence: z.number().int().min(1), revision: revisionSchema, kind: z.enum(['revision', 'job', 'diagnostic']), objectIds: ids, jobId: idSchema.optional(), diagnostics: z.array(diagnosticSchema) });
export const projectOutcomeSchema = outcomeSchema(projectSchema);
export const planOutcomeSchema = outcomeSchema(reviewedPlanSchema);
export const jobOutcomeSchema = outcomeSchema(jobSchema);
export type OperationRecord = z.infer<typeof operationRecordSchema>;
export type GenerationManifest = z.infer<typeof generationManifestSchema>;
export type EditorDraft = z.infer<typeof editorDraftSchema>;
export type ViewState = z.infer<typeof viewStateSchema>;
export type Job = z.infer<typeof jobSchema>;

const changedResult = z.strictObject({ changedIds: ids });
const runtimeResult = z.strictObject({ status: z.enum(['stopped', 'building', 'running', 'failed']), generatedRevision: revisionSchema, jobId: idSchema.optional(), port: z.number().int().min(1).max(65535).optional() });
/** A registry's implementation must satisfy its result schema as well as its input. */
export const migrationHistorySchema = z.strictObject({ id: idSchema, planId: idSchema, requestId: idSchema, connectionId: idSchema, backupRef: idSchema, kind: z.enum(['migration','restore']), createdAt: z.iso.datetime(), baseRevision: revisionSchema, newRevision: revisionSchema.optional(), outcome: z.enum(['applying','committed','rolled-back','recovery-pending']), backupValidated: z.boolean(), message: text });
export type MigrationHistory = z.infer<typeof migrationHistorySchema>;
export const operationResultSchemas = {
  'project.create': projectSchema,
  'project.inspect': projectSchema,
  'project.open': projectSchema,
  'project.list': z.array(z.strictObject({ id: idSchema, name: text, revision: revisionSchema })),
  'project.batch': changedResult,
  'project.export': z.strictObject({ destination: text, modelHash: hashSchema, includedData: z.boolean() }),
  'connection.inspect': z.strictObject({ connection: connectionSchema, schema: schemaSchema }),
  'connection.bind': changedResult,
  'schema.preview': reviewedPlanSchema,
  'schema.apply': z.strictObject({ planId: idSchema, committed: z.boolean(), recoveryRequired: z.boolean(), backupRef: idSchema }),
  'schema.history': z.array(migrationHistorySchema),
  'schema.restorePreview': reviewedPlanSchema,
  'schema.restoreApply': z.strictObject({ planId: idSchema, committed: z.boolean(), recoveryRequired: z.boolean(), backupRef: idSchema }),
  'query.preview': z.strictObject({ fields: z.array(querySchema.shape.projections.element.omit({ expression: true })), rows: z.array(z.record(idSchema, scalar)).max(200), sql: text, truncated: z.boolean() }),
  'form.construct': changedResult,
  'extension.read': z.strictObject({ extensionId: idSchema, content: z.string(), hash: hashSchema }),
  'extension.write': z.strictObject({ extensionId: idSchema, hash: hashSchema }),
  'identity.provision': z.strictObject({ userId: idSchema }),
  'project.validate': z.strictObject({ valid: z.boolean(), diagnostics: z.array(diagnosticSchema) }),
  'flow.inspect': z.strictObject({ nodes: z.array(z.strictObject({ id: idSchema, sourceObjectId: idSchema, kind: text })), edges: z.array(z.strictObject({ id: idSchema, sourceObjectId: idSchema, fromId: idSchema, toId: idSchema, kind: text })) }),
  'generation.preview': reviewedPlanSchema,
  'generation.apply': z.strictObject({ planId: idSchema, committed: z.boolean(), recoveryRequired: z.boolean(), manifest: generationManifestSchema }),
  'runtime.start': runtimeResult,
  'runtime.stop': runtimeResult,
  'runtime.status': runtimeResult,
  'job.inspect': jobSchema,
  'job.cancel': jobSchema,
} as const satisfies Record<Operation, z.ZodType>;
export type OperationResult<K extends Operation> = z.infer<(typeof operationResultSchemas)[K]>;
