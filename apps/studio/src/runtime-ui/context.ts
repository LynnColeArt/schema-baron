import type { OperationResult } from '@schema-baron/model';
export function parametersForContext(context: OperationResult<'runtime.context'> | undefined, values: Record<string, string>, modes: Record<string, string>) {
  const result: Record<string, string> = {};
  for (const field of context?.fields ?? []) {
    if (field.kind === 'record-mode') {
      if (values[field.parameter] === 'new') result[field.parameter] = 'new';
      continue;
    }
    if (field.recordId && values[field.recordId + ':mode'] === 'new') continue;
    if (field.modeParameter) {
      const mode = modes[field.parameter] ?? (field.defaultAvailable ? 'default' : 'value');
      result[field.modeParameter] = mode;
      if (mode !== 'value') continue;
    }
    if (Object.hasOwn(values, field.parameter) && (values[field.parameter] !== '' || field.required || field.kind === 'query')) result[field.parameter] = values[field.parameter]!;
  }
  return result;
}
