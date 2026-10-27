import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { commandSchema, effectiveAccess, parseProject, reviewedPlanSchema, validatePlanApplication, serializeProject, validateProject } from '../src/index.js';

const fixture = (name = 'project') => JSON.parse(readFileSync(new URL(`../../../fixtures/model/${name}.json`, import.meta.url), 'utf8'));
const codes = (input: unknown) => validateProject(input).diagnostics.map(d => d.code);
describe('canonical project boundary', () => {
  it.each(['project', 'catalog'])('accepts unrelated %s definitions and roundtrips meanings', name => {
    const input = fixture(name);
    expect(validateProject(input)).toEqual({ ok: true, project: input, diagnostics: [] });
    expect(parseProject(JSON.parse(serializeProject(input)))).toEqual(input);
  });
  it('retains stable references when physical names change', () => {
    const input = fixture();
    const before = structuredClone(input);
    input.schema.tables[0].physicalName = 'renamed "table"';
    input.schema.tables[0].columns[0].physicalName = 'new key';
    expect(validateProject(input).ok).toBe(true);
    expect(input.schema.tables[1].foreignKeys).toEqual(before.schema.tables[1].foreignKeys);
    expect(input.forms).toEqual(before.forms);
  });
  it('refuses unsupported versions and unknown secret fields without mutating input', () => {
    const input = fixture(); input.formatVersion = 999;
    const bytes = JSON.stringify(input);
    expect(codes(input)).toContain('UNSUPPORTED_FORMAT'); expect(JSON.stringify(input)).toBe(bytes);
    input.formatVersion = 1; input.connections[0].password = 'test-only-placeholder';
    expect(codes(input)).toContain('INVALID_INPUT');
    expect(JSON.stringify(validateProject(input))).not.toContain('test-only-placeholder');
  });
  it('rejects unknown nested expression nodes', () => {
    const input = fixture(); input.queries[0].projections[0].expression = { kind: 'sql', sql: 'DROP TABLE anything' };
    expect(codes(input)).toContain('UNSAFE_EXPRESSION');
  });
  it.each(['arity', 'type', 'nonunique', 'nullablePK', 'duplicatePK'])('rejects %s keys', defect => {
    const input = fixture(); const parent = input.schema.tables[0]; const child = input.schema.tables[1];
    if (defect === 'arity') child.foreignKeys[0].columnIds.pop();
    if (defect === 'type') child.columns[0].type = { kind: 'text' };
    if (defect === 'nonunique') child.foreignKeys[0].referencedColumnIds = [parent.columns[1].id, parent.columns[0].id];
    if (defect === 'nullablePK') parent.columns[0].nullable = true;
    if (defect === 'duplicatePK') parent.primaryKey = [parent.columns[0].id, parent.columns[0].id];
    expect(validateProject(input).ok).toBe(false);
  });
  it('diagnoses missing references with object identity and field', () => {
    const input = fixture(); input.controls[0].binding.fieldId = 'missing';
    expect(validateProject(input).diagnostics).toContainEqual(expect.objectContaining({ code: 'BROKEN_REFERENCE', objectId: input.controls[0].id, field: 'binding.fieldId' }));
  });
  it('rejects incompatible controls, derived writes and missing dependencies', () => {
    const input = fixture(); input.controls[0].kind = 'checkbox';
    expect(codes(input)).toContain('TYPE_MISMATCH');
    input.controls[0].kind = 'number'; input.controls[0].binding = { kind: 'derived', expression: { kind: 'literal', value: 1, type: { kind: 'integer' } }, sourceDependencies: ['absent'] };
    expect(codes(input)).toContain('VALIDATION_FAILED'); expect(codes(input)).toContain('BROKEN_REFERENCE');
  });
  it('rejects duplicate routes, global IDs and orphan composition', () => {
    const input = fixture(); input.pages.push({ ...input.pages[0], id: 'other-page', route: input.pages[0].route + '/' });
    expect(codes(input)).toContain('VALIDATION_FAILED');
    input.pages.pop(); input.controls[0].id = input.forms[0].id;
    expect(codes(input)).toContain('VALIDATION_FAILED');
  });
  it('derives inherited policy and prevents action weakening', () => {
    const input = fixture(); input.policies.push({ id: 'protected', scope: 'page', ownerId: input.pages[0].id, access: 'authenticated' }); input.pages[0].policyId = 'protected';
    input.policies.push({ id: 'weak', scope: 'action', ownerId: input.actions[0].id, access: 'public' }); input.actions[0].policyId = 'weak';
    expect(effectiveAccess(parseProject({ ...input, actions: input.actions.map((a: object) => ({ ...a, policyId: undefined })) }), input.pages[0].id).access).toBe('authenticated');
    expect(codes(input)).toContain('ACCESS_DENIED');
  });
});
describe('query contracts', () => {
  it.each(['group', 'duplicate', 'alias', 'grain', 'parameter', 'result'])('rejects invalid %s', defect => {
    const input = fixture(); const q = input.queries[0];
    if (defect === 'group') { q.projections.push({ id: 'aggregate-output', name: 'count', expression: { kind: 'aggregate', function: 'count' }, type: { kind: 'integer' }, nullable: false }); q.grain = { strategy: 'grouped', keys: [] }; }
    if (defect === 'duplicate') q.projections.push(q.projections[0]);
    if (defect === 'alias') q.projections[0].expression.alias = 'absent';
    if (defect === 'grain') q.grain = { strategy: 'grouped', keys: ['missing'] };
    if (defect === 'parameter') q.where = { kind: 'parameter', parameterId: 'absent' };
    if (defect === 'result') q.projections[0].type = { kind: 'text' };
    expect(validateProject(input).ok).toBe(false);
  });
  it('requires explicit fanout protection and validates join predicates', () => {
    const input = fixture(); const q = input.queries[0];
    q.sources.push({ alias: 'child1', source: { kind: 'table', id: input.schema.tables[1].id } }, { alias: 'child2', source: { kind: 'table', id: input.schema.tables[1].id } });
    q.joins = ['child1','child2'].map(alias => ({ leftAlias: 'root', rightAlias: alias, kind: 'left', cardinality: 'one-to-many', on: { kind: 'literal', value: true, type: { kind: 'boolean' } } }));
    q.projections = [{ id: 'count-result', name: 'count', expression: { kind: 'aggregate', function: 'count' }, type: { kind: 'integer' }, nullable: false }];
    q.grain = { strategy: 'grouped', keys: [] };
    expect(codes(input)).toContain('INVALID_QUERY_GRAIN');
  });
});
describe('operation and reviewed-plan runtime contracts', () => {
  const envelope = { requestId: 'request', projectId: 'project', expectedRevision: 1 };
  it('separates preview/apply and rejects arbitrary batches and unknown properties', () => {
    expect(commandSchema.safeParse({ ...envelope, operation: 'schema.preview', input: { desiredSchemaRevision: 1, backfills: [] } }).success).toBe(true);
    expect(commandSchema.safeParse({ ...envelope, operation: 'schema.apply', input: { desiredSchemaRevision: 1 } }).success).toBe(false);
    expect(commandSchema.safeParse({ ...envelope, operation: 'schema.apply', input: { planId: 'p', hash: 'a'.repeat(64), acknowledgedImpactIds: [] } }).success).toBe(true);
    expect(commandSchema.safeParse({ ...envelope, operation: 'project.batch', input: { operations: [{ kind: 'put', entity: 'table', value: { id: 't', sql: 'arbitrary' } }] } }).success).toBe(false);
    expect(commandSchema.safeParse({ ...envelope, operation: 'query.preview', input: { queryId: 'q', parameters: {}, rowLimit: 201 } }).success).toBe(false);
  });
  it('requires exact plan metadata and acknowledgement references', () => {
    expect(reviewedPlanSchema.safeParse({ id: 'p', kind: 'migration', sourceRevision: 1 }).success).toBe(false);
  });
});

describe('expression semantics and broader negative corpus', () => {
  it('accepts a typed grouped aggregate, HAVING and nullable outer join', () => {
    const input = fixture(); const q = input.queries[0]; const child = input.schema.tables[1];
    q.sources.push({ alias: 'child', source: { kind: 'table', id: child.id } });
    q.joins = [{ leftAlias: 'root', rightAlias: 'child', kind: 'left', cardinality: 'one-to-many', on: { kind: 'binary', operator: '=', left: { kind: 'field', alias: 'root', fieldId: input.schema.tables[0].columns[1].id }, right: { kind: 'field', alias: 'child', fieldId: child.columns[1].id } } }];
    q.groupBy = [q.projections[0].expression]; q.grain = { strategy: 'grouped', keys: [q.projections[0].id] };
    q.projections.push({ id: 'count-output', name: 'total', expression: { kind: 'aggregate', function: 'count', argument: { kind: 'field', alias: 'child', fieldId: child.columns[2].id }, zeroChildren: 'zero' }, type: { kind: 'integer' }, nullable: false });
    q.parameters = [{ id: 'minimum-count', name: 'minimum', type: { kind: 'integer' }, nullable: false }];
    q.having = { kind: 'binary', operator: '>=', left: q.projections[1].expression, right: { kind: 'parameter', parameterId: 'minimum-count' } };
    expect(validateProject(input)).toEqual({ ok: true, project: input, diagnostics: [] });
    q.projections.push({ id: 'child-output', name: 'child', expression: { kind: 'field', alias: 'child', fieldId: child.columns[2].id }, type: { kind: 'integer' }, nullable: false });
    expect(codes(input)).toContain('TYPE_MISMATCH'); expect(codes(input)).toContain('INVALID_QUERY_GRAIN');
  });
  it.each(['unsafeFunction', 'nestedAggregate', 'whereAggregate', 'cycle', 'parameterDefault', 'decimalScale', 'missingKey', 'keyOrder', 'destination', 'policyOwner', 'source', 'lookup', 'event'])('rejects %s', defect => {
    const p = fixture(); const q = p.queries[0];
    if (defect === 'unsafeFunction') q.projections[0].expression = { kind: 'function', function: 'eval', args: [] };
    if (defect === 'nestedAggregate') { q.projections[0].expression = { kind: 'aggregate', function: 'sum', argument: { kind: 'aggregate', function: 'count' } }; q.grain = { strategy: 'grouped', keys: [] }; }
    if (defect === 'whereAggregate') q.where = { kind: 'aggregate', function: 'count' };
    if (defect === 'cycle') q.sources[0].source = { kind: 'query', id: q.id };
    if (defect === 'parameterDefault') q.parameters = [{ id: 'p', name: 'p', type: { kind: 'integer' }, nullable: false, default: 'bad' }];
    if (defect === 'decimalScale') p.schema.tables[0].columns[0].type = { kind: 'decimal', scale: 5, precision: 2, encoding: 'text', rounding: 'down' };
    if (defect === 'missingKey') p.forms[0].keyMapping.pop();
    if (defect === 'keyOrder') p.forms[0].keyMapping.reverse();
    if (defect === 'destination') p.actions[0].destination = { pageId: 'absent', keyMapping: [], filterMapping: [] };
    if (defect === 'policyOwner') p.policies[0].ownerId = 'absent';
    if (defect === 'source') p.forms[0].sourceRef.id = 'absent';
    if (defect === 'lookup') p.controls[0].lookup = { source: p.forms[0].sourceRef, valueFieldIds: ['absent'], labelFieldId: 'absent' };
    if (defect === 'event') p.controls[0].events[0].actionId = 'absent';
    expect(validateProject(p).ok).toBe(false);
  });
  it('preserves exact decimal encoding and refuses invalid dates and arithmetic', () => {
    const p = fixture('catalog'); const decimal = p.schema.tables[0].columns[3];
    decimal.default.value = '999999999999.99'; expect(codes(p)).toContain('TYPE_MISMATCH');
    decimal.default.value = '1.001'; expect(codes(p)).toContain('TYPE_MISMATCH');
    const q = p.queries[0]; q.projections[0].expression = { kind: 'literal', value: '2026-02-30', type: { kind: 'date', encoding: 'iso-date' } };
    expect(codes(p)).toContain('TYPE_MISMATCH');
    q.projections[0].expression = { kind: 'binary', operator: '*', left: { kind: 'literal', value: 'a', type: { kind: 'text' } }, right: { kind: 'literal', value: 'b', type: { kind: 'text' } } };
    expect(codes(p)).toContain('TYPE_MISMATCH');
  });
  it('rejects stored plus derived competing definitions and permits read-only derived sources', () => {
    const p = fixture(); p.controls[0].binding = { kind: 'derived', expression: p.queries[0].projections[0].expression, sourceDependencies: [p.schema.tables[0].id] }; p.controls[0].readOnly = true;
    expect(validateProject(p).ok).toBe(true);
    p.controls[0].binding.fieldId = p.schema.tables[0].columns[0].id;
    expect(codes(p)).toContain('INVALID_INPUT');
  });
});

describe('saved negative fixtures', () => {
  const cases = JSON.parse(readFileSync(new URL('../../../fixtures/model/negative-cases.json', import.meta.url), 'utf8')) as { name: string; base: string; changes: { path: (string | number)[]; value: unknown }[]; code: string }[];
  it.each(cases)('$name', entry => {
    const input = fixture(entry.base);
    for (const change of entry.changes) {
      let target = input;
      for (const segment of change.path.slice(0, -1)) target = target[segment];
      target[change.path.at(-1)!] = change.value;
    }
    const before = JSON.stringify(input);
    expect(codes(input)).toContain(entry.code);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('reviewed apply freshness', () => {
  const hash = 'a'.repeat(64);
  const plan = () => reviewedPlanSchema.parse({ id: 'plan', kind: 'migration', sourceRevision: 1, modelHash: hash, hash, createdAt: '2026-10-26T12:00:00Z', expiresAt: '2026-10-26T13:00:00Z', impact: [{ id: 'delete-impact', kind: 'data-loss', description: 'Remove records', requiresAcknowledgement: true, affectedCount: 5 }], requiredAcknowledgementIds: ['delete-impact'], connectionId: 'connection', schemaFingerprint: hash, dataFingerprint: hash, backupPolicy: { required: true, approvedRootId: 'backup-root' }, steps: [{ id: 'step', sql: 'DELETE FROM "archived"', objectIds: [], transactional: true }] });
  it('accepts exactly the reviewed revision/hash/state/impact and rejects every stale dimension', () => {
    const p = plan();
    const input = { planId: p.id, hash, acknowledgedImpactIds: p.requiredAcknowledgementIds };
    const observed = { revision: 1, modelHash: hash, fingerprint: hash, dataFingerprint: hash, now: '2026-10-26T12:30:00Z' };
    expect(validatePlanApplication(p, input, observed)).toEqual([]);
    expect(validatePlanApplication(p, { ...input, acknowledgedImpactIds: [] }, observed)[0]?.code).toBe('IMPACT_NOT_ACKNOWLEDGED');
    expect(validatePlanApplication(p, { ...input, acknowledgedImpactIds: [...input.acknowledgedImpactIds, ...input.acknowledgedImpactIds] }, observed)[0]?.code).toBe('IMPACT_NOT_ACKNOWLEDGED');
    expect(validatePlanApplication(p, { ...input, hash: 'b'.repeat(64) }, observed)[0]?.code).toBe('PLAN_HASH_MISMATCH');
    expect(validatePlanApplication(p, input, { ...observed, revision: 2 })[0]?.code).toBe('REVISION_CONFLICT');
    expect(validatePlanApplication(p, input, { ...observed, now: p.expiresAt })[0]?.code).toBe('PLAN_EXPIRED');
    expect(validatePlanApplication(p, input, { ...observed, fingerprint: 'b'.repeat(64) })[0]?.code).toBe('DATABASE_CHANGED');
    expect(validatePlanApplication(p, input, { ...observed, dataFingerprint: 'b'.repeat(64) })[0]?.code).toBe('DATABASE_CHANGED');
  });
  it('refuses forged acknowledgement lists and invalid expiry at the plan boundary', () => {
    const p = plan();
    expect(reviewedPlanSchema.safeParse({ ...p, requiredAcknowledgementIds: [] }).success).toBe(false);
    expect(reviewedPlanSchema.safeParse({ ...p, expiresAt: p.createdAt }).success).toBe(false);
  });
});
