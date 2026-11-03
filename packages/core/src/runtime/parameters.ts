import { isLiteralValue } from '@schema-baron/model';
import type { ContextIR, GenerationIR, RouteIR } from '@schema-baron/generator';
import { StorageError } from '@schema-baron/storage';
export function routeFields(ir: GenerationIR, route: RouteIR): ContextIR[] {
  return [...ir.contexts, ...route.records.flatMap(r => [...(r.config.keyParameters as string[]).map((parameter, i) => ({
    parameter,
    kind: 'key' as const,
    field: r.source.fields.find(f => f.id === r.source.keys[i])!
  })), {
    parameter: r.id + ':mode',
    kind: 'mode' as const
  }])];
}
export function routeParameters(ir: GenerationIR, route: RouteIR, parameters: Record<string, string | number | boolean | null>) {
  const fields = routeFields(ir, route);
  const fail = () => {
    throw new StorageError('INVALID_INPUT', 'Live Page context must match the declared typed key/filter inputs.');
  };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    const item = fields.find(f => f.parameter === key);
    if (!item) fail();
    const field = item!;
    const text = value === null ? '' : String(value);
    if (text.length > 1000) fail();
    if (field.field) {
      const scalar = field.field;
      if (text === '' && field.kind === 'search') continue;
      const type = scalar.type;
      if (value === null) {
        if (!scalar.nullable || field.kind === 'key') fail();
      } else if (field.kind === 'query') {
        const parsed = ['integer', 'real'].includes(type.kind) ? /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ? Number(text) : undefined : type.kind === 'boolean' ? text === 'true' ? true : text === 'false' ? false : undefined : text;
        if (!isLiteralValue(parsed, type, scalar.nullable)) fail();
      } else if (type.kind === 'integer') {
        if (!/^-?\d+$/.test(text)) fail();
        const n = BigInt(text);
        if (n < -9223372036854775808n || n > 9223372036854775807n) fail();
      } else if (type.kind === 'real') {
        if (!text.trim() || !Number.isFinite(Number(text))) fail();
      } else if (type.kind === 'boolean') {
        if (!['0', '1'].includes(text)) fail();
      } else if (!isLiteralValue(text, type, scalar.nullable) || type.kind === 'blob') fail();
    }
    if (field.kind === 'mode') {
      const base = fields.find(f => f.parameter === key.slice(0, -5));
      if (base?.kind === 'query') {
        if (!['default', 'value', 'null'].includes(text) || text === 'null' && !base.field?.nullable || text === 'value' && !(base.parameter in parameters)) fail();
      } else if (text !== 'new') fail();
    }
    if (field.kind === 'direction' && !['asc', 'desc'].includes(text) || field.kind === 'page' && !/^[1-9]\d{0,4}$/.test(text) || field.kind === 'sort' && text !== '' && !field.allowed?.includes(text)) fail();
    query.set(key, text);
  }
  for (const record of route.records) {
    if (parameters[record.id + ':mode'] === 'new') continue;
    const missing = (record.config.keyParameters as string[]).filter(key => !(key in parameters) || parameters[key] === null);
    if (missing.length) throw new StorageError('INVALID_INPUT', `Enter the complete declared Record key (${missing.join(', ')}) or use ${record.id}:mode=new for a new record.`);
  }
  return query;
}
