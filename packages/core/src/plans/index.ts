import { reviewedPlanSchema, operationInputSchemas, validatePlanApplication } from '@schema-baron/model';
import type { ReviewedPlan } from '@schema-baron/model';
import { hash, StorageError } from '@schema-baron/storage';
import type { ProjectStorage } from '@schema-baron/storage';
export function planHash(plan: object) { const { hash: _hash, ...content } = plan as { hash?: unknown }; return hash(content); }
export class PlanRepository {
 constructor(private storage: ProjectStorage, private authorize: (actor: string) => void) {}
 record(actor: string, projectId: string, input: unknown): ReviewedPlan { this.authorize(actor); const plan = reviewedPlanSchema.parse(input); if (planHash(plan) !== plan.hash) throw new StorageError('PLAN_HASH_MISMATCH', 'Plan content hash does not match.'); const project = this.storage.snapshot(projectId); if (project.revision !== plan.sourceRevision || hash(project) !== plan.modelHash) throw new StorageError('REVISION_CONFLICT', 'Preview source changed.'); this.storage.putPlan(projectId, plan.id, plan); return structuredClone(plan); }
 inspect(actor: string, projectId: string, id: string): ReviewedPlan { this.authorize(actor); const stored = this.storage.plan(projectId, id); if (stored === undefined) throw new StorageError('INVALID_INPUT', 'Reviewed plan was not found. Create a preview before applying.'); const plan = reviewedPlanSchema.parse(stored); if (planHash(plan) !== plan.hash) throw new StorageError('PLAN_HASH_MISMATCH', 'Persisted plan content changed.'); return plan; }
 validate(actor: string, projectId: string, input: { planId: string; hash: string; acknowledgedImpactIds: string[] }, observed: { fingerprint: string; dataFingerprint?: string; now: string }) { this.authorize(actor); input = operationInputSchemas['generation.apply'].parse(input); const plan = this.inspect(actor, projectId, input.planId); const project = this.storage.snapshot(projectId); return validatePlanApplication(plan, { ...input, planId: plan.id, acknowledgedImpactIds: input.acknowledgedImpactIds as ReviewedPlan['requiredAcknowledgementIds'] }, { ...observed, revision: project.revision, modelHash: hash(project) }); }
}
