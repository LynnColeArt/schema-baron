import { expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { arithmeticResultType, parseProject, type Expression, type Project, type Query, type ScalarType } from '@schema-baron/model';
import { compileQuery } from '../../src/query/index.js';
import { registerDecimalFunctions } from '../../src/decimal/index.js';
import { shape } from '../../../../apps/studio/src/query-designer/expression.js';
const decimal: ScalarType = {
  kind: 'decimal',
  precision: 38,
  scale: 2,
  rounding: 'half-even',
  encoding: 'text'
};
const integer: ScalarType = {
  kind: 'integer'
};
function setup(reverse: boolean, operator: '*' | '/' = '*') {
  const p = JSON.parse(readFileSync('fixtures/queries/project.json', 'utf8')) as Project;
  const table = p.schema.tables.find(t => t.id === 'lines')!;
  table.columns.find(c => c.id === 'price')!.type = decimal;
  table.columns.find(c => c.id === 'price')!.nullable = true;
  table.columns.find(c => c.id === 'qty')!.type = integer;
  p.queries = [];
  const a: Expression = {
      kind: 'field',
      alias: 'r',
      fieldId: 'price' as never
    },
    b: Expression = {
      kind: 'field',
      alias: 'r',
      fieldId: 'qty' as never
    };
  const expression: Expression = {
    kind: 'binary',
    operator,
    left: reverse ? b : a,
    right: reverse ? a : b
  };
  const q: Query = {
    id: 'numeric' as never,
    name: 'Numeric',
    sources: [{
      alias: 'r',
      source: {
        kind: 'table',
        id: table.id
      }
    }],
    joins: [],
    projections: [{
      id: 'result' as never,
      name: 'Result',
      type: decimal,
      nullable: true,
      expression
    }],
    parameters: [],
    groupBy: [],
    orderBy: [],
    grain: {
      strategy: 'rows',
      keys: []
    }
  };
  q.orderBy = [{
    expression: {
      kind: 'field',
      alias: 'r',
      fieldId: 'lid' as never
    },
    direction: 'asc'
  }];
  p.queries = [q];
  return {
    p,
    q,
    expression
  };
}
test('integer/exact decimal promotion shares full format in either order and leaves comparisons/formats strict', () => {
  expect(arithmeticResultType(integer, decimal)).toEqual(decimal);
  expect(arithmeticResultType(decimal, integer)).toEqual(decimal);
  expect(arithmeticResultType({
    kind: 'real'
  }, decimal)).toBeUndefined();
  expect(arithmeticResultType({
    ...decimal,
    rounding: 'down'
  }, decimal)).toBeUndefined();
  for (const reverse of [false, true]) {
    const {
      p,
      q,
      expression
    } = setup(reverse);
    expect(parseProject(p)).toBeDefined();
    expect(shape(expression, p, q)).toEqual({
      type: decimal,
      nullable: true
    });
    const invalid = structuredClone(p);
    (invalid.queries[0]!.projections[0]!.expression as Extract<Expression, {
      kind: 'binary';
    }>).operator = '=';
    expect(() => parseProject(invalid)).toThrow();
  }
});
test('compiled SQLite executes both orders with exact INTEGER boundaries and null; division rounds and overflow fails', () => {
  const db = new Database(':memory:');
  registerDecimalFunctions(db);
  db.exec('CREATE TABLE detail(id INTEGER PRIMARY KEY,parent_a TEXT,parent_b INTEGER,price TEXT,quantity INTEGER);');
  const put = db.prepare('INSERT INTO detail(id,price,quantity) VALUES(?,?,?)');
  put.run(1, '0.10', 3);
  put.run(2, '0.01', 9007199254740993n);
  put.run(3, '0.01', 9223372036854775807n);
  put.run(4, null, 2);
  put.run(5, '0.01', -9223372036854775808n);
  try {
    for (const reverse of [false, true]) {
      const {
        p,
        q
      } = setup(reverse);
      const compiled = compileQuery(p, q, {}, 200);
      expect(compiled.sql).toContain('sb_multiply');
      expect(db.prepare(compiled.sql).all(compiled.parameters)).toEqual([{
        result: '0.30'
      }, {
        result: '90071992547409.93'
      }, {
        result: '92233720368547758.07'
      }, {
        result: null
      }, {
        result: '-92233720368547758.08'
      }]);
    }
    const {
      p,
      q
    } = setup(false, '/');
    const compiled = compileQuery(p, q, {}, 200);
    expect(db.prepare(compiled.sql).all(compiled.parameters)[0]).toEqual({
      result: '0.03'
    });
    db.prepare('UPDATE detail SET price=?,quantity=2 WHERE id=1').run('0.05');
    expect(db.prepare(compiled.sql).all(compiled.parameters)[0]).toEqual({
      result: '0.02'
    });
    db.prepare('UPDATE detail SET price=?,quantity=3 WHERE id=1').run('999999999999999999999999999999999999.99');
    const overflow = setup(false);
    const c = compileQuery(overflow.p, overflow.q, {}, 200);
    expect(() => db.prepare(c.sql).all(c.parameters)).toThrow(/overflow|precision|Invalid exact/);
  } finally {
    db.close();
  }
});
