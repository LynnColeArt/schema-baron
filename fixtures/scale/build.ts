import { createId } from '@schema-baron/model';
import type { Table, Page, Form, Control } from '@schema-baron/model';
export function workspaceFixture(start = 0, end = 50) {
  const pages: Page[] = [],
    forms: Form[] = [],
    controls: Control[] = [];
  for (let p = start; p < end; p++) {
    const page: Page = {
      id: createId(),
      title: `Scale page ${p}`,
      route: `/scale-${p}`,
      document: [],
      formIds: []
    };
    pages.push(page);
    for (let f = 0; f < 4; f++) {
      const form: Form = {
        id: createId(),
        pageId: page.id,
        kind: 'Login',
        keyMapping: [],
        controlIds: [],
        actionIds: [],
        search: [],
        paging: {
          pageSize: 20
        },
        sorting: [],
        appearance: {
          label: `Scale form ${p}-${f}`
        }
      };
      forms.push(form);
      page.formIds.push(form.id);
      page.document.push({
        kind: 'form',
        formId: form.id
      });
      for (let c = 0; c < 5; c++) {
        const control: Control = {
          id: createId(),
          formId: form.id,
          kind: 'label',
          readOnly: true,
          appearance: {
            label: `Scale control ${p}-${f}-${c}`
          },
          validation: {
            required: false
          },
          events: []
        };
        controls.push(control);
        form.controlIds.push(control.id);
      }
    }
  }
  return [...pages.map(value => ({
    kind: 'put',
    entity: 'page',
    id: value.id,
    value
  })), ...forms.map(value => ({
    kind: 'put',
    entity: 'form',
    id: value.id,
    value
  })), ...controls.map(value => ({
    kind: 'put',
    entity: 'control',
    id: value.id,
    value
  }))];
}
export function schemaFixture(): Table[] {
  return Array.from({
    length: 50
  }, (_, t) => ({
    id: createId(),
    physicalName: `scale_table_${t}`,
    columns: Array.from({
      length: 10
    }, (_, c) => ({
      id: createId(),
      physicalName: `column_${c}`,
      type: {
        kind: 'integer' as const
      },
      nullable: true
    })),
    primaryKey: [],
    foreignKeys: [],
    uniqueConstraints: [],
    checks: [],
    indexes: []
  }));
}
export function flowPages(): Page[] {
  return Array.from({
    length: 10
  }, (_, i) => ({
    id: createId(),
    title: `Flow area ${i}`,
    route: `/flow-${i}`,
    document: [],
    formIds: []
  }));
}
