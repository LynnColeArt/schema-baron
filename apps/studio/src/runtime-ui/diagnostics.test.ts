import { test, expect } from 'vitest';
import { idSchema } from '@schema-baron/model';
import type { Diagnostic } from '@schema-baron/model';
import { reconcileRuntimeMessages } from './diagnostics.js';
test('runtime recovery retires only its obsolete status diagnostic, including delayed replay', () => {
  const stale: Diagnostic = {
    code: 'NOT_FOUND',
    severity: 'error',
    objectId: idSchema.parse('project'),
    field: 'runtime',
    path: 'runtime.status',
    message: 'Generate the application before building, running or exporting output.'
  };
  const draft: Diagnostic = {
    code: 'VALIDATION_FAILED',
    severity: 'error',
    objectId: idSchema.parse('page'),
    field: 'route',
    message: 'Duplicate route; current draft retained.'
  };
  expect(reconcileRuntimeMessages([draft, stale], [], 'project', true)).toEqual([draft]);
  expect(reconcileRuntimeMessages([draft], [stale], 'project', true)).toEqual([draft]);
  expect(reconcileRuntimeMessages([draft], [stale], 'project', false)).toEqual([draft, stale]);
});
