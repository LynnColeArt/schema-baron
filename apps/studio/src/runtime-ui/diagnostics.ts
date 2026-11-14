export interface RuntimeMessage {
  code: string;
  message: string;
  objectId?: string | undefined;
  field?: string | undefined;
  path?: string | undefined;
}
export function isRuntimeStatusDiagnostic(d: RuntimeMessage, projectId: string) {
  return d.objectId === projectId && (d.path === 'runtime.status' || !d.path && d.field === 'runtime' && d.code === 'NOT_FOUND' && d.message.startsWith('Generate the application'));
}
export function reconcileRuntimeMessages<T extends RuntimeMessage>(current: T[], incoming: T[], projectId: string, recovered: boolean) {
  const retained = recovered ? current.filter(d => !isRuntimeStatusDiagnostic(d, projectId)) : current;
  const next = recovered ? incoming.filter(d => !isRuntimeStatusDiagnostic(d, projectId)) : incoming;
  const runtimeOnly = incoming.length > 0 && incoming.every(d => d.path?.startsWith('runtime.') || isRuntimeStatusDiagnostic(d, projectId));
  const merged = incoming.length && !runtimeOnly ? next : [...retained, ...next];
  return [...new Map(merged.map(d => [JSON.stringify(d), d])).values()];
}
