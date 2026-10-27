import { FORMAT_VERSION, projectSchema } from './schemas.js';
import type { DocumentNode, Expression, Form, Project, Query, ScalarType, StableId } from './schemas.js';
import type { Diagnostic, DiagnosticCode } from './diagnostics.js';

type Field = { id: StableId; type: ScalarType; nullable: boolean };
type Shape = { type: ScalarType; nullable: boolean; aggregate: boolean };
type Context = { sources: Map<string, Field[]>; parameters: Query['parameters']; nullableAliases: Set<string>; aggregateAllowed: boolean };
export type ValidationResult = { ok: true; project: Project; diagnostics: [] } | { ok: false; diagnostics: Diagnostic[] };
export const sameType = (a: ScalarType, b: ScalarType): boolean => canonicalJson(a) === canonicalJson(b);
const numeric = (type: ScalarType) => ['integer', 'real', 'decimal'].includes(type.kind);
export function isLiteralValue(value: unknown, type: ScalarType, nullable: boolean): boolean {
  if (value === null) return nullable;
  switch (type.kind) {
    case 'integer': return typeof value === 'number' && Number.isSafeInteger(value);
    case 'real': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'text': return typeof value === 'string';
    case 'blob': return typeof value === 'string' && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
    case 'decimal': {
      if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return false;
      const [whole = '', fraction = ''] = value.replace(/^-/, '').split('.');
      return fraction.length <= type.scale && whole.replace(/^0+/, '').length <= type.precision - type.scale;
    }
    case 'date': return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    case 'datetime': return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
  }
}
export function normalizeRoute(route: string): string { return route.normalize('NFC').replace(/\/+$/, '') || '/'; }
/** Returns both effective access and the policy that introduced it. Actions can only tighten. */
export function effectiveAccess(project: Project, pageId: string, actionId?: string): { access: 'public' | 'authenticated'; sourcePolicyId: StableId } {
  const global = project.policies.find(p => p.id === project.globalPolicyId);
  if (!global || global.scope !== 'global' || global.access === 'inherit') throw new Error('Invalid global policy');
  let result = { access: global.access, sourcePolicyId: global.id };
  const page = project.pages.find(p => p.id === pageId);
  if (!page) throw new Error('Unknown page');
  const pagePolicy = project.policies.find(p => p.id === page.policyId);
  if (pagePolicy && pagePolicy.access !== 'inherit') result = { access: pagePolicy.access, sourcePolicyId: pagePolicy.id };
  const action = project.actions.find(a => a.id === actionId);
  const policy = project.policies.find(p => p.id === action?.policyId);
  if (policy?.access === 'authenticated') result = { access: 'authenticated', sourcePolicyId: policy.id };
  return result;
}
export function validateProject(input: unknown): ValidationResult {
  if (typeof input === 'object' && input !== null && 'formatVersion' in input && input.formatVersion !== FORMAT_VERSION) return { ok: false, diagnostics: [{ code: 'UNSUPPORTED_FORMAT', severity: 'error', message: 'This project format is unsupported.', field: 'formatVersion' }] };
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, diagnostics: parsed.error.issues.map(issue => {
    let cursor: unknown = input;
    let objectId: StableId | undefined;
    for (const segment of [...issue.path, undefined]) {
      if (typeof cursor !== 'object' || cursor === null) break;
      if ('id' in cursor && typeof cursor.id === 'string' && cursor.id.length > 0 && cursor.id.length <= 256) objectId = cursor.id as StableId;
      if (segment === undefined) break;
      cursor = Reflect.get(cursor, segment);
    }
    return { code: issue.path.some(p => ['expression', 'on', 'where', 'having', 'default'].includes(String(p))) ? 'UNSAFE_EXPRESSION' as const : 'INVALID_INPUT' as const, severity: 'error' as const, message: 'Invalid model shape or unsupported property.', path: issue.path.map(String).join('.'), ...(objectId ? { objectId } : {}) };
  }) };
  const p = parsed.data;
  const diagnostics: Diagnostic[] = [];
  const error = (code: DiagnosticCode, objectId: StableId, field: string, message: string) => { diagnostics.push({ code, severity: 'error', objectId, field, message }); };
  const ref = <T extends { id: string }>(items: T[], id: string, owner: StableId, field: string): T | undefined => { const found = items.find(item => item.id === id); if (!found) error('BROKEN_REFERENCE', owner, field, 'Reference does not resolve.'); return found; };
  const unique = (values: string[], owner: StableId, field: string) => { if (new Set(values).size !== values.length) error('VALIDATION_FAILED', owner, field, 'Values must be unique.'); };
  // IDs occupy one namespace; renaming physical names never changes reference resolution.
  const all = [p, p.schema, ...p.connections, ...p.schema.tables, ...p.schema.opaqueObjects, ...p.queries, ...p.pages, ...p.forms, ...p.controls, ...p.actions, ...p.policies, ...p.extensionContracts,
    ...p.schema.tables.flatMap(t => [...t.columns, ...t.foreignKeys, ...t.uniqueConstraints, ...t.checks, ...t.indexes]), ...p.queries.flatMap(q => [...q.parameters, ...q.projections])];
  unique(all.map(o => o.id), p.id, 'id');
  unique(p.connectionRefs, p.id, 'connectionRefs');
  for (const id of p.connectionRefs) ref(p.connections, id, p.id, 'connectionRefs');
  const sourceFields = (source: { kind: 'table' | 'query'; id: StableId }, owner: StableId, field: string): Field[] => source.kind === 'table' ? (ref(p.schema.tables, source.id, owner, field)?.columns ?? []) : (ref(p.queries, source.id, owner, field)?.projections ?? []);
  const sourceContext = (source: Form['sourceRef'], owner: StableId): Context => ({ sources: new Map(source ? [['root', sourceFields(source, owner, 'sourceRef')]] : []), parameters: [], nullableAliases: new Set(), aggregateAllowed: false });
  function expr(e: Expression, ctx: Context, owner: StableId, field: string, insideAggregate = false): Shape | undefined {
    const fail = (code: DiagnosticCode = 'TYPE_MISMATCH', message = 'Expression types or arguments are incompatible.') => { error(code, owner, field, message); return undefined; };
    if (e.kind === 'literal') { if (!isLiteralValue(e.value, e.type, true)) return fail(); return { type: e.type, nullable: e.value === null, aggregate: false }; }
    if (e.kind === 'field') { const value = ctx.sources.get(e.alias)?.find(f => f.id === e.fieldId); if (!value) return fail('BROKEN_REFERENCE', 'Expression field or alias does not resolve.'); return { type: value.type, nullable: value.nullable || ctx.nullableAliases.has(e.alias), aggregate: false }; }
    if (e.kind === 'parameter') { const value = ref(ctx.parameters, e.parameterId, owner, field); return value ? { type: value.type, nullable: value.nullable, aggregate: false } : undefined; }
    if (e.kind === 'aggregate') {
      if (!ctx.aggregateAllowed || insideAggregate) return fail('INVALID_QUERY_GRAIN', 'Aggregate is not allowed in this expression context.');
      if (e.function !== 'count' && !e.argument) return fail();
      if (e.distinct && !e.argument) return fail();
      const arg = e.argument ? expr(e.argument, ctx, owner, field, true) : undefined;
      if (e.argument && !arg) return undefined;
      if (['sum', 'avg'].includes(e.function) && arg && !numeric(arg.type)) return fail();
      if (e.zeroChildren === 'zero' && e.function !== 'count' && arg && !numeric(arg.type)) return fail();
      const type: ScalarType = e.function === 'count' ? { kind: 'integer' } : e.function === 'avg' && arg?.type.kind !== 'decimal' ? { kind: 'real' } : arg!.type;
      return { type, nullable: e.function !== 'count' && e.zeroChildren !== 'zero', aggregate: true };
    }
    if (e.kind === 'binary') {
      const left = expr(e.left, ctx, owner, field, insideAggregate); const right = expr(e.right, ctx, owner, field, insideAggregate);
      if (!left || !right) return undefined;
      const boolean = ['and', 'or'].includes(e.operator); const arithmetic = ['+', '-', '*', '/'].includes(e.operator);
      if (!sameType(left.type, right.type) || (boolean && left.type.kind !== 'boolean') || (arithmetic && !numeric(left.type))) return fail();
      return { type: arithmetic ? left.type : { kind: 'boolean' }, nullable: left.nullable || right.nullable, aggregate: left.aggregate || right.aggregate };
    }
    const args = e.args.map(a => expr(a, ctx, owner, field, insideAggregate));
    if (args.some(a => !a)) return undefined;
    const first = args[0]!;
    if (e.function !== 'coalesce' && args.length !== 1) return fail();
    if (e.function === 'coalesce' && (args.length < 2 || args.some(a => !sameType(a!.type, first.type)))) return fail();
    if (['lower', 'upper', 'length'].includes(e.function) && first.type.kind !== 'text') return fail();
    if (e.function === 'abs' && !numeric(first.type)) return fail();
    if (['date', 'year'].includes(e.function) && !['date', 'datetime'].includes(first.type.kind)) return fail();
    const type: ScalarType = ['length', 'year'].includes(e.function) ? { kind: 'integer' } : e.function === 'date' ? { kind: 'date', encoding: 'iso-date' } : first.type;
    return { type, nullable: e.function === 'coalesce' ? args.every(a => a!.nullable) : first.nullable, aggregate: args.some(a => a!.aggregate) };
  }
  function predicate(e: Expression | undefined, ctx: Context, owner: StableId, field: string) { if (e) { const shape = expr(e, ctx, owner, field); if (shape && shape.type.kind !== 'boolean') error('TYPE_MISMATCH', owner, field, 'Predicate must be boolean.'); } }
  const tuple = (table: Project['schema']['tables'][number], values: StableId[], owner: StableId, field: string) => { unique(values, owner, field); return values.map(id => ref(table.columns, id, owner, field)); };
  unique(p.schema.tables.map(t => t.physicalName.toLowerCase()), p.schema.id, 'tables.physicalName');
  for (const table of p.schema.tables) {
    unique(table.columns.map(c => c.physicalName.toLowerCase()), table.id, 'columns.physicalName');
    const ctx: Context = { sources: new Map([['self', table.columns]]), parameters: [], nullableAliases: new Set(), aggregateAllowed: false };
    for (const col of tuple(table, table.primaryKey, table.id, 'primaryKey')) if (col?.nullable) error('VALIDATION_FAILED', table.id, 'primaryKey', 'Primary key columns cannot be nullable.');
    for (const u of [...table.uniqueConstraints, ...table.indexes]) tuple(table, u.columnIds, u.id, 'columnIds');
    for (const index of table.indexes) predicate(index.where, ctx, index.id, 'where');
    for (const check of table.checks) predicate(check.expression, ctx, check.id, 'expression');
    for (const col of table.columns) {
      if (col.default) { const shape = expr(col.default, { ...ctx, sources: new Map() }, col.id, 'default'); if (shape && (!sameType(shape.type, col.type) || (shape.nullable && !col.nullable))) error('TYPE_MISMATCH', col.id, 'default', 'Default type/nullability must match column.'); }
      if (col.generated) {
        if (col.default) error('VALIDATION_FAILED', col.id, 'generated', 'A generated column cannot also have a stored default.');
        const shape = expr(col.generated.expression, ctx, col.id, 'generated.expression');
        if (shape && (!sameType(shape.type, col.type) || (shape.nullable && !col.nullable))) error('TYPE_MISMATCH', col.id, 'generated', 'Generated result must match column type/nullability.');
        for (const id of col.generated.sourceDependencies) ref(p.schema.tables, id, col.id, 'generated.sourceDependencies');
      }
    }
    for (const fk of table.foreignKeys) {
      const target = ref(p.schema.tables, fk.referencedTableId, fk.id, 'referencedTableId'); const local = tuple(table, fk.columnIds, fk.id, 'columnIds');
      if (!target) continue;
      const remote = tuple(target, fk.referencedColumnIds, fk.id, 'referencedColumnIds');
      if (local.length !== remote.length) error('VALIDATION_FAILED', fk.id, 'columnIds', 'Foreign key tuple arity must match.');
      const candidateKeys = [target.primaryKey, ...target.uniqueConstraints.map(u => u.columnIds), ...target.indexes.filter(i => i.unique && !i.where).map(i => i.columnIds)];
      if (!candidateKeys.some(key => key.length > 0 && JSON.stringify(key) === JSON.stringify(fk.referencedColumnIds))) error('VALIDATION_FAILED', fk.id, 'referencedColumnIds', 'Referenced tuple must be an ordered unique key.');
      local.forEach((col, index) => { if (col && remote[index] && !sameType(col.type, remote[index]!.type)) error('TYPE_MISMATCH', fk.id, 'columnIds', 'Foreign key column types must match in order.'); if (col && [fk.onDelete, fk.onUpdate].includes('set-null') && !col.nullable) error('VALIDATION_FAILED', fk.id, 'onDelete', 'SET NULL requires nullable local columns.'); if (col && [fk.onDelete, fk.onUpdate].includes('set-default') && !col.default) error('VALIDATION_FAILED', fk.id, 'onUpdate', 'SET DEFAULT requires explicit defaults.'); });
    }
  }
  for (const object of p.schema.opaqueObjects) for (const id of object.dependencies) ref(all, id, object.id, 'dependencies');
  const visiting = new Set<string>(); const visited = new Set<string>();
  function queryCycle(query: Query) { if (visiting.has(query.id)) { error('INVALID_QUERY_GRAIN', query.id, 'sources', 'Query dependencies cannot be cyclic.'); return; } if (visited.has(query.id)) return; visiting.add(query.id); for (const s of query.sources) if (s.source.kind === 'query') { const child = p.queries.find(q => q.id === s.source.id); if (child) queryCycle(child); } visiting.delete(query.id); visited.add(query.id); }
  for (const q of p.queries) {
    queryCycle(q);
    unique(q.sources.map(s => s.alias), q.id, 'sources.alias'); unique(q.parameters.map(a => a.name), q.id, 'parameters.name'); unique(q.projections.map(a => a.name), q.id, 'projections.name');
    const ctx: Context = { sources: new Map(q.sources.map(s => [s.alias, sourceFields(s.source, q.id, 'sources')])), parameters: q.parameters, nullableAliases: new Set(q.joins.filter(j => j.kind === 'left').map(j => j.rightAlias)), aggregateAllowed: true };
    for (const param of q.parameters) if (param.default !== undefined && !isLiteralValue(param.default, param.type, param.nullable)) error('TYPE_MISMATCH', param.id, 'default', 'Parameter default does not match declared type.');
    const connected = new Set([q.sources[0]!.alias]);
    for (const join of q.joins) {
      if (!connected.has(join.leftAlias) || connected.has(join.rightAlias) || !ctx.sources.has(join.rightAlias)) error('BROKEN_REFERENCE', q.id, 'joins', 'Join must connect an existing source to a new source alias.');
      connected.add(join.rightAlias); predicate(join.on, { ...ctx, aggregateAllowed: false }, q.id, 'joins.on');
    }
    if (connected.size !== q.sources.length) error('INVALID_QUERY_GRAIN', q.id, 'sources', 'Every source must have an explicit join.');
    predicate(q.where, { ...ctx, aggregateAllowed: false }, q.id, 'where'); predicate(q.having, ctx, q.id, 'having');
    for (const group of q.groupBy) expr(group, { ...ctx, aggregateAllowed: false }, q.id, 'groupBy');
    for (const order of q.orderBy) expr(order.expression, ctx, q.id, 'orderBy');
    const outputs = q.projections.map(output => { const shape = expr(output.expression, ctx, output.id, 'expression'); if (shape && (!sameType(shape.type, output.type) || shape.nullable !== output.nullable)) error('TYPE_MISMATCH', output.id, 'type', 'Result type/nullability must match expression including outer joins.'); return shape; });
    const aggregate = outputs.some(o => o?.aggregate) || !!q.having || q.groupBy.length > 0;
    if (aggregate && q.grain.strategy === 'rows') error('INVALID_QUERY_GRAIN', q.id, 'grain', 'Aggregates require an explicitly declared grain.');
    if (!aggregate && q.grain.strategy !== 'rows') error('INVALID_QUERY_GRAIN', q.id, 'grain', 'Grouped grain requires grouping or aggregates.');
    if (aggregate) {
      const groups = new Set(q.groupBy.map(g => canonicalJson(g)));
      function checkGrouped(e: Expression) { if (e.kind === 'aggregate' || groups.has(canonicalJson(e)) || ['literal', 'parameter'].includes(e.kind)) return; if (e.kind === 'field') error('INVALID_QUERY_GRAIN', q.id, 'groupBy', 'Selected nonaggregate fields must be grouped.'); else if (e.kind === 'binary') { checkGrouped(e.left); checkGrouped(e.right); } else if (e.kind === 'function') e.args.forEach(checkGrouped); }
      q.projections.forEach(o => checkGrouped(o.expression)); if (q.having) checkGrouped(q.having); q.orderBy.forEach(o => checkGrouped(o.expression));
      if (q.joins.filter(j => ['one-to-many', 'many-to-many'].includes(j.cardinality)).length > 1 && q.grain.strategy !== 'preaggregated') error('INVALID_QUERY_GRAIN', q.id, 'grain', 'Multiple child joins require explicit preaggregation to avoid fanout.');
    }
    if (q.grain.strategy !== 'rows') {
      const groupedOutputs = q.groupBy.map(group => q.projections.find(output => canonicalJson(output.expression) === canonicalJson(group))?.id);
      if (groupedOutputs.some(id => !id) || canonicalJson([...q.grain.keys].sort()) !== canonicalJson(groupedOutputs.filter(Boolean).sort())) error('INVALID_QUERY_GRAIN', q.id, 'grain.keys', 'Grain keys must exactly identify the projected grouping expressions.');
    }
    unique(q.grain.keys, q.id, 'grain.keys');
    for (const id of q.grain.keys) ref(q.projections, id, q.id, 'grain.keys');
    if (q.grain.strategy === 'preaggregated') for (const alias of q.grain.sourceAliases) {
      const source = q.sources.find(s => s.alias === alias); if (!source || source.source.kind !== 'query' || p.queries.find(child => child.id === source.source.id)?.grain.strategy === 'rows') error('INVALID_QUERY_GRAIN', q.id, 'grain.sourceAliases', 'Preaggregated sources must reference grouped queries.');
    }
    if (q.grain.strategy === 'preaggregated' && q.joins.some(j => ['one-to-many', 'many-to-many'].includes(j.cardinality))) error('INVALID_QUERY_GRAIN', q.id, 'joins.cardinality', 'Preaggregated joins must preserve one row per grain.');
  }
  const routes = new Set<string>();
  for (const page of p.pages) {
    const route = normalizeRoute(page.route);
    if (!/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(page.route) || routes.has(route)) error('VALIDATION_FAILED', page.id, 'route', 'Route must be unique and use internal static path segments.'); routes.add(route);
    unique(page.formIds, page.id, 'formIds');
    for (const id of page.formIds) { const form = ref(p.forms, id, page.id, 'formIds'); if (form && form.pageId !== page.id) error('BROKEN_REFERENCE', page.id, 'formIds', 'Form belongs to a different page.'); }
    const documentForms: string[] = [];
    const walk = (nodes: DocumentNode[]) => { for (const node of nodes) if (node.kind === 'form') { documentForms.push(node.formId); if (!page.formIds.includes(node.formId)) error('BROKEN_REFERENCE', page.id, 'document.formId', 'Document form must belong to this page.'); } else if (node.kind === 'element') walk(node.children); };
    walk(page.document); unique(documentForms, page.id, 'document');
    if (JSON.stringify([...documentForms].sort()) !== JSON.stringify([...page.formIds].sort())) error('BROKEN_REFERENCE', page.id, 'document', 'Page forms must appear exactly once in its document.');
  }
  for (const form of p.forms) {
    const page = ref(p.pages, form.pageId, form.id, 'pageId'); if (page && !page.formIds.includes(form.id)) error('BROKEN_REFERENCE', form.id, 'pageId', 'Page must include its form.');
    if (form.kind !== 'Login' && !form.sourceRef) error('BROKEN_REFERENCE', form.id, 'sourceRef', 'Data forms require a source.');
    const ctx = sourceContext(form.sourceRef, form.id); const fields = ctx.sources.get('root') ?? [];
    for (const key of form.keyMapping) { const target = ref(fields, key.targetFieldId, form.id, 'keyMapping'); const shape = expr(key.expression, ctx, form.id, 'keyMapping.expression'); if (target && shape && !sameType(target.type, shape.type)) error('TYPE_MISMATCH', form.id, 'keyMapping', 'Key expression type must match target.'); }
    unique(form.keyMapping.map(k => k.targetFieldId), form.id, 'keyMapping');
    if (form.kind === 'Record' && form.sourceRef?.kind === 'table') {
      const table = p.schema.tables.find(t => t.id === form.sourceRef!.id);
      if (table && (table.primaryKey.length === 0 || canonicalJson(form.keyMapping.map(k => k.targetFieldId)) !== canonicalJson(table.primaryKey))) error('VALIDATION_FAILED', form.id, 'keyMapping', 'Record key mapping must match the complete ordered primary key.');
    }
    for (const search of [...form.search, ...form.sorting]) ref(fields, search.fieldId, form.id, 'fieldId');
    for (const [values, entities, field] of [[form.controlIds, p.controls, 'controlIds'], [form.actionIds, p.actions, 'actionIds']] as const) { unique(values, form.id, field); for (const id of values) { const child = ref<{ id: StableId; formId: StableId }>(entities, id, form.id, field); if (child && child.formId !== form.id) error('BROKEN_REFERENCE', form.id, field, 'Child belongs to another form.'); } }
  }
  for (const control of p.controls) {
    const form = ref(p.forms, control.formId, control.id, 'formId'); if (!form) continue;
    if (!form.controlIds.includes(control.id)) error('BROKEN_REFERENCE', control.id, 'formId', 'Form must include its control.');
    const ctx = sourceContext(form.sourceRef, control.id); let shape: Shape | undefined;
    if (control.validation.min !== undefined && control.validation.max !== undefined && control.validation.min > control.validation.max) error('VALIDATION_FAILED', control.id, 'validation', 'Minimum cannot exceed maximum.');
    if (control.binding?.kind === 'stored') { const field = ref(ctx.sources.get('root') ?? [], control.binding.fieldId, control.id, 'binding.fieldId'); if (field) { shape = { ...field, aggregate: false }; const col = p.schema.tables.flatMap(t => t.columns).find(c => c.id === field.id); if ((form.sourceRef?.kind === 'query' || col?.generated) && !control.readOnly) error('VALIDATION_FAILED', control.id, 'readOnly', 'Query results and generated columns are read-only.'); } }
    if (control.binding?.kind === 'derived') {
      shape = expr(control.binding.expression, ctx, control.id, 'binding.expression'); if (!control.readOnly) error('VALIDATION_FAILED', control.id, 'readOnly', 'Derived bindings must be read-only.');
      for (const id of control.binding.sourceDependencies) ref([...p.schema.tables, ...p.queries], id, control.id, 'binding.sourceDependencies');
      if (form.sourceRef && !control.binding.sourceDependencies.includes(form.sourceRef.id)) error('BROKEN_REFERENCE', control.id, 'binding.sourceDependencies', 'Derived binding must declare its source dependency.');
    }
    if (shape && ((control.kind === 'checkbox' && shape.type.kind !== 'boolean') || (control.kind === 'number' && !numeric(shape.type)) || (control.kind === 'date' && !['date', 'datetime'].includes(shape.type.kind)))) error('TYPE_MISMATCH', control.id, 'kind', 'Control kind is incompatible with its field.');
    for (const event of control.events) { const action = ref(p.actions, event.actionId, control.id, 'events.actionId'); if (action && action.formId !== form.id) error('BROKEN_REFERENCE', control.id, 'events', 'Event action must belong to this form.'); }
    if (control.lookup) { const fields = sourceFields(control.lookup.source, control.id, 'lookup.source'); for (const id of [...control.lookup.valueFieldIds, control.lookup.labelFieldId]) ref(fields, id, control.id, 'lookup'); if (shape && control.lookup.valueFieldIds.length === 1) { const field = fields.find(f => f.id === control.lookup!.valueFieldIds[0]); if (field && !sameType(shape.type, field.type)) error('TYPE_MISMATCH', control.id, 'lookup', 'Lookup value type must match binding.'); } }
  }
  const global = ref(p.policies, p.globalPolicyId, p.id, 'globalPolicyId');
  if (global && (global.scope !== 'global' || global.ownerId !== p.id || global.access === 'inherit')) error('VALIDATION_FAILED', global.id, 'scope', 'Global policy must explicitly declare project access.');
  function checkPolicy(policyId: StableId | undefined, ownerId: StableId, scope: 'page' | 'action') { if (!policyId) return; const policy = ref(p.policies, policyId, ownerId, 'policyId'); if (policy && (policy.ownerId !== ownerId || policy.scope !== scope)) error('BROKEN_REFERENCE', ownerId, 'policyId', 'Policy scope and owner must match.'); }
  for (const policy of p.policies) { const owners = policy.scope === 'global' ? [p] : policy.scope === 'page' ? p.pages : p.actions; ref<{ id: StableId }>(owners, policy.ownerId, policy.id, 'ownerId'); if (policy.scope === 'global' && policy.id !== p.globalPolicyId) error('VALIDATION_FAILED', policy.id, 'scope', 'Only one global policy is allowed.'); }
  p.pages.forEach(page => checkPolicy(page.policyId, page.id, 'page'));
  for (const action of p.actions) {
    const form = ref(p.forms, action.formId, action.id, 'formId'); if (!form) continue;
    if (!form.actionIds.includes(action.id)) error('BROKEN_REFERENCE', action.id, 'formId', 'Form must include its action.');
    checkPolicy(action.policyId, action.id, 'action');
    const page = p.pages.find(page => page.id === form.pageId);
    if (global && global.access !== 'inherit' && page) {
      const parent = effectiveAccess(p, page.id); const policy = p.policies.find(policy => policy.id === action.policyId);
      if (parent.access === 'authenticated' && policy?.access === 'public') error('ACCESS_DENIED', action.id, 'policyId', 'An action cannot weaken protected page access.');
    }
    if (action.operation === 'navigate' && !action.destination) error('BROKEN_REFERENCE', action.id, 'destination', 'Navigation requires a destination.');
    if (action.operation === 'extension' && !action.extensionHookRef) error('BROKEN_REFERENCE', action.id, 'extensionHookRef', 'Extension action requires a declared hook.');
    if (action.extensionHookRef) ref(p.extensionContracts, action.extensionHookRef, action.id, 'extensionHookRef');
    if (['insert', 'update', 'delete'].includes(action.operation) && form.sourceRef?.kind !== 'table') error('VALIDATION_FAILED', action.id, 'operation', 'Writes require a table source.');
    for (const destination of [action.destination, action.success, action.cancel]) if (destination) {
      const target = ref(p.pages, destination.pageId, action.id, 'destination.pageId');
      const fields = target ? p.forms.filter(f => f.pageId === target.id && f.sourceRef).flatMap(f => sourceFields(f.sourceRef!, action.id, 'destination')) : [];
      for (const mapping of [...destination.keyMapping, ...destination.filterMapping]) { const field = ref(fields, mapping.targetFieldId, action.id, 'destination.mapping'); const value = expr(mapping.expression, sourceContext(form.sourceRef, action.id), action.id, 'destination.expression'); if (field && value && !sameType(field.type, value.type)) error('TYPE_MISMATCH', action.id, 'destination.mapping', 'Destination mapping must match target field type.'); }
    }
  }
  if (p.identity?.kind === 'mapped') { const table = ref(p.schema.tables, p.identity.tableId, p.id, 'identity.tableId'); if (table) for (const id of [p.identity.userIdColumnId, p.identity.usernameColumnId, p.identity.passwordHashColumnId]) ref(table.columns, id, p.id, 'identity'); }
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, project: p, diagnostics: [] };
}
export class ModelValidationError extends Error { readonly diagnostics: Diagnostic[]; constructor(diagnostics: Diagnostic[]) { super('Project validation failed'); this.name = 'ModelValidationError'; this.diagnostics = diagnostics; } }
export function parseProject(input: unknown): Project { const result = validateProject(input); if (!result.ok) throw new ModelValidationError(result.diagnostics); return result.project; }
/** Stable property order for hashing/serialization; array order (including key tuples) is semantic. */
export function canonicalJson(value: unknown): string { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`; return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`; }
export function serializeProject(input: unknown): string { return canonicalJson(parseProject(input)); }
