import type { GenerationIR, RouteIR } from '@schema-baron/generator';
import { queryInputs } from '@schema-baron/model';
import type { OperationResult, Project } from '@schema-baron/model';
import { routeFields } from './parameters.js';
export function describeContext(ir: GenerationIR, route: RouteIR, project: Project): OperationResult<'runtime.context'>['fields'] {
  return routeFields(ir, route).flatMap<OperationResult<'runtime.context'>['fields'][number]>(item => {
    const record = route.records.find(r => (r.config.keyParameters as string[]).includes(item.parameter) || item.parameter === r.id + ':mode');
    const form = project.forms.find(f => item.parameter.startsWith(f.id + ':'));
    if (item.kind === 'mode') {
      if (!record) return [];
      return [{
        parameter: item.parameter,
        label: `${record.label} · record mode`,
        kind: 'record-mode' as const,
        nullable: false,
        required: false,
        choices: [{
          value: 'existing',
          label: 'Existing record'
        }, {
          value: 'new',
          label: 'New record'
        }],
        recordId: record.id
      }];
    }
    const mapping = form?.queryParameters?.find(p => item.parameter === form.id + ':parameter:' + p.runtime?.name),
      input = form?.sourceRef?.kind === 'query' ? queryInputs(project, form.sourceRef.id).find(p => p.id === mapping?.parameterId) : undefined;
    const caption = record?.controls.find(c => c.fieldId === item.field?.id)?.label ?? item.field?.name ?? (item.kind === 'page' ? 'Page' : item.kind === 'sort' ? 'Sort field' : item.kind === 'direction' ? 'Sort direction' : 'Context');
    const label = `${record?.label ?? form?.appearance.label ?? 'Page context'} · ${caption}`;
    return [{
      parameter: item.parameter,
      label,
      kind: item.kind ?? 'search',
      nullable: item.field?.nullable ?? false,
      required: !!record && item.kind === 'key',
      ...(item.field ? {
        type: item.field.type
      } : {}),
      ...(item.kind === 'direction' ? {
        choices: [{
          value: 'asc',
          label: 'Ascending'
        }, {
          value: 'desc',
          label: 'Descending'
        }]
      } : item.allowed ? {
        choices: item.allowed.map((value, index) => ({
          value,
          label: ir.sources.flatMap(s => s.fields).find(f => f.id === value)?.name ?? `Sort choice ${index + 1}`
        }))
      } : {}),
      ...(record ? {
        recordId: record.id
      } : {}),
      ...(item.kind === 'query' ? {
        modeParameter: item.parameter + ':mode',
        defaultAvailable: input?.default !== undefined
      } : {})
    }];
  });
}
