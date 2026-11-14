import { test, expect } from 'vitest';
import { idSchema } from '@schema-baron/model';
import type { OperationResult } from '@schema-baron/model';
import { parametersForContext } from './context.js';
const context: OperationResult<'runtime.context'> = {
  generatedRevision: 2,
  modelRevision: 4,
  pageId: idSchema.parse('page'),
  title: 'Generated page',
  route: '/page',
  fields: [{
    parameter: 'record:key:code',
    label: 'Item · Code',
    kind: 'key',
    type: {
      kind: 'text'
    },
    nullable: false,
    required: true,
    recordId: 'record'
  }, {
    parameter: 'record:mode',
    label: 'Item · record mode',
    kind: 'record-mode',
    nullable: false,
    required: false,
    recordId: 'record'
  }, {
    parameter: 'report:parameter:minimum',
    label: 'Report · Minimum',
    kind: 'query',
    type: {
      kind: 'integer'
    },
    nullable: true,
    required: false,
    modeParameter: 'report:parameter:minimum:mode',
    defaultAvailable: true
  }]
};
test('labeled Record/new/default/null/value choices emit the existing declared wire grammar', () => {
  expect(parametersForContext(context, {
    'record:key:code': 'A'
  }, {})).toEqual({
    'record:key:code': 'A',
    'report:parameter:minimum:mode': 'default'
  });
  expect(parametersForContext(context, {
    'record:mode': 'new',
    'record:key:code': 'stale'
  }, {
    'report:parameter:minimum': 'null'
  })).toEqual({
    'record:mode': 'new',
    'report:parameter:minimum:mode': 'null'
  });
  expect(parametersForContext(context, {
    'report:parameter:minimum': '0'
  }, {
    'report:parameter:minimum': 'value'
  })).toEqual({
    'report:parameter:minimum': '0',
    'report:parameter:minimum:mode': 'value'
  });
});
