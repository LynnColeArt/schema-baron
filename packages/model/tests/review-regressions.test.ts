import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseProject, validateProject } from '../src/index.js';

const fresh = () => JSON.parse(readFileSync(new URL('../../../fixtures/model/project.json', import.meta.url), 'utf8'));
const count = { kind: 'aggregate', function: 'count' };
const aggregateSorts = [
  { name: 'direct', expression: count },
  { name: 'nested arithmetic', expression: { kind: 'binary', operator: '+', left: count, right: { kind: 'literal', type: { kind: 'integer' }, value: 1 } } },
  { name: 'nested function', expression: { kind: 'function', function: 'abs', args: [count] } },
];

describe('review cycle 1: diagnostic-safe policy validation', () => {
  it.each(['page', 'action', 'inherit', 'owner'])('returns object-linked diagnostics for invalid global policy %s', defect => {
    const input = fresh();
    const policy = input.policies[0];
    if (defect === 'page') { policy.scope = 'page'; policy.ownerId = input.pages[0].id; }
    if (defect === 'action') { policy.scope = 'action'; policy.ownerId = input.actions[0].id; }
    if (defect === 'inherit') policy.access = 'inherit';
    if (defect === 'owner') policy.ownerId = input.pages[0].id;
    const before = JSON.stringify(input);
    expect(() => validateProject(input)).not.toThrow();
    expect(validateProject(input)).toMatchObject({ ok: false, diagnostics: expect.arrayContaining([
      expect.objectContaining({ code: 'VALIDATION_FAILED', objectId: policy.id, field: 'scope' }),
    ]) });
    expect(JSON.stringify(input)).toBe(before);
  });
  it('validates an explicit authenticated global policy with inherited page/action access', () => {
    const input = fresh();
    input.policies[0].access = 'authenticated';
    expect(validateProject(input)).toEqual({ ok: true, project: input, diagnostics: [] });
    expect(parseProject(input)).toEqual(input);
  });
});

describe('review cycle 1: ORDER BY participates in aggregate grain', () => {
  it.each(aggregateSorts)('rejects row-grain sorting by $name aggregate', ({ expression }) => {
    const input = fresh();
    input.queries[0].orderBy = [{ expression, direction: 'asc' }];
    const before = JSON.stringify(input);
    expect(validateProject(input)).toMatchObject({ ok: false, diagnostics: expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_QUERY_GRAIN', objectId: input.queries[0].id, field: 'grain' }),
    ]) });
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each(aggregateSorts)('accepts $name aggregate sorting with explicit grouped projection/grain', ({ expression }) => {
    const input = fresh();
    const query = input.queries[0];
    query.groupBy = [query.projections[0].expression];
    query.grain = { strategy: 'grouped', keys: [query.projections[0].id] };
    query.orderBy = [{ expression, direction: 'desc' }];
    expect(validateProject(input)).toEqual({ ok: true, project: input, diagnostics: [] });
  });
  it('keeps ordinary field ordering valid at row grain', () => {
    const input = fresh();
    input.queries[0].orderBy = [{ expression: input.queries[0].projections[0].expression, direction: 'asc' }];
    expect(validateProject(input).ok).toBe(true);
  });
});

function sequentialJoins() {
  const input = fresh();
  const query = input.queries[0];
  const parentField = input.schema.tables[0].columns[1].id;
  const childField = input.schema.tables[1].columns[1].id;
  query.sources.push(...['child1', 'child2'].map(alias => ({ alias, source: { kind: 'table', id: input.schema.tables[1].id } })));
  query.joins = ['child1', 'child2'].map(alias => ({
    leftAlias: 'root', rightAlias: alias, kind: 'left', cardinality: 'one-to-many',
    on: { kind: 'binary', operator: '=', left: { kind: 'field', alias: 'root', fieldId: parentField }, right: { kind: 'field', alias, fieldId: childField } },
  }));
  return input;
}

describe('review cycle 1: sequential JOIN ON alias scope', () => {
  it('rejects an ON predicate referring to a future alias even though the source exists', () => {
    const input = sequentialJoins();
    input.queries[0].joins[0].on.right.alias = 'child2';
    const before = JSON.stringify(input);
    expect(validateProject(input)).toMatchObject({ ok: false, diagnostics: expect.arrayContaining([
      expect.objectContaining({ code: 'BROKEN_REFERENCE', objectId: input.queries[0].id, field: 'joins.on' }),
    ]) });
    expect(JSON.stringify(input)).toBe(before);
  });
  it('accepts predicates using the current right alias and already joined sources', () => {
    const input = sequentialJoins();
    const second = input.queries[0].joins[1];
    second.leftAlias = 'child1';
    second.on.left = { kind: 'field', alias: 'child1', fieldId: input.schema.tables[1].columns[1].id };
    expect(validateProject(input)).toEqual({ ok: true, project: input, diagnostics: [] });
  });
});
