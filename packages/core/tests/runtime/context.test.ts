import { test, expect } from 'vitest';
import { authored } from './fixture.js';
test('generated context labels/types stay bound to generated snapshot after later saved model edits', async () => {
  const f = await authored();
  try {
    const before = await f.run('runtime.context', {
      generatedRevision: 1,
      pageId: f.record
    });
    const field = before.fields.find((field: any) => field.kind === 'key');
    expect(field).toMatchObject({
      label: 'Record · code',
      type: {
        kind: 'text'
      },
      required: true
    });
    expect(before.fields.find((field: any) => field.kind === 'record-mode').choices).toEqual([{
      value: 'existing',
      label: 'Existing record'
    }, {
      value: 'new',
      label: 'New record'
    }]);
    const project = f.core.snapshot('owner', f.id),
      control = project.controls.find(c => c.binding?.kind === 'stored' && c.binding.fieldId === project.schema.tables[0]!.primaryKey[0])!;
    await f.run('project.batch', {
      operations: [{
        kind: 'put',
        entity: 'control',
        id: control.id,
        value: {
          ...control,
          appearance: {
            ...control.appearance,
            label: 'New saved caption'
          }
        }
      }]
    });
    expect(await f.run('runtime.context', {
      generatedRevision: 1,
      pageId: f.record
    })).toEqual(before);
  } finally {
    await f.core.close();
  }
});
