import { createId } from '@schema-baron/model';
import type { EntityBatchOperation, Policy, Project, StableId } from '@schema-baron/model';

/** Author ordinary policy entities and their owner reference in one validated batch. */
export function policyOperations(project: Project, scope: Policy['scope'], ownerId: StableId, access: Policy['access']): Extract<EntityBatchOperation, { kind: 'put' }>[] {
  if (scope === 'action' && access === 'public') throw Error('Actions may inherit or require sign in.');
  if (scope === 'global' && access === 'inherit') throw Error('Choose an explicit global default.');
  const owner = scope === 'page' ? project.pages.find(p => p.id === ownerId) : scope === 'action' ? project.actions.find(a => a.id === ownerId) : undefined;
  if (scope !== 'global' && !owner) throw Error('Select an existing policy owner.');
  const existing = project.policies.find(p => p.id === (scope === 'global' ? project.globalPolicyId : owner?.policyId));
  const policy: Policy = { id: existing?.id ?? createId(), ownerId, scope, access };
  const operations: Extract<EntityBatchOperation, { kind: 'put' }>[] = [{ kind: 'put', entity: 'policy', id: policy.id, value: policy }];
  const page = scope === 'page' ? project.pages.find(p => p.id === ownerId) : undefined;
  const action = scope === 'action' ? project.actions.find(a => a.id === ownerId) : undefined;
  if (page) operations.push({ kind: 'put', entity: 'page', id: page.id, value: { ...page, policyId: policy.id } });
  if (action) operations.push({ kind: 'put', entity: 'action', id: action.id, value: { ...action, policyId: policy.id } });
  return operations;
}
