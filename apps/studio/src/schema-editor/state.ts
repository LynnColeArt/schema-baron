import { createId } from '@schema-baron/model';
import type { EntityBatchOperation, Table } from '@schema-baron/model';
export interface Draft {
  base: Table | undefined;
  value: Table | null;
  conflicts: string[];
}
export type Drafts = Record<string, Draft>;
/** Numeric buffers belong to visible fields of the desired type, not just a column ID. */
export function applicableSchemaBuffers(buffers: Record<string, string>, tables: Table[]): Record<string, string> {
  const fields = new Set(tables.flatMap(table => table.columns.flatMap(column => [
    column.id,
    ...(column.type.kind === 'decimal' ? [`${column.id}:scale`, `${column.id}:precision`] : []),
  ])));
  return Object.fromEntries(Object.entries(buffers).filter(([key]) => fields.has(key)));
}
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).filter(([, v]) => v !== undefined).map(([key, v]) => [key, canonical(v)])) : value;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function blankTable(): Table {
  return {
    id: createId(),
    physicalName: '',
    columns: [],
    primaryKey: [],
    foreignKeys: [],
    uniqueConstraints: [],
    checks: [],
    indexes: []
  };
}
export function changeTable(drafts: Drafts, tables: Table[], value: Table | null, id = value?.id): Drafts {
  if (!id) return drafts;
  const prior = drafts[id];
  return {
    ...drafts,
    [id]: {
      base: prior ? prior.base : tables.find(t => t.id === id),
      value,
      conflicts: prior?.conflicts ?? []
    }
  };
}
/** Field-level rebase never overwrites a colliding local edit. A table deleted remotely stays a visible conflict. */
export function reconcileDrafts(drafts: Drafts, tables: Table[]): Drafts {
  const result: Drafts = {};
  for (const [id, draft] of Object.entries(drafts)) {
    const remote = tables.find(t => t.id === id);
    if (same(remote, draft.value)) continue;
    if (!draft.base) {
      result[id] = remote ? {
        ...draft,
        conflicts: ['id']
      } : draft;
      continue;
    }
    if (!remote || !draft.value) {
      result[id] = same(remote, draft.base) ? draft : {
        ...draft,
        conflicts: ['table']
      };
      continue;
    }
    const value = {
      ...draft.value
    };
    const conflicts = [...draft.conflicts];
    for (const key of Object.keys(value) as (keyof Table)[]) {
      if (key === 'id') continue;
      if (same(draft.value[key], draft.base[key])) Object.assign(value, {
        [key]: remote[key]
      });else if (!same(remote[key], draft.base[key]) && !same(remote[key], draft.value[key])) conflicts.push(key);
    }
    result[id] = {
      base: remote,
      value,
      conflicts: [...new Set(conflicts)]
    };
  }
  return result;
}
export function tableOperations(drafts: Drafts): EntityBatchOperation[] {
  return Object.entries(drafts).filter(([, d]) => d.value || d.base).map(([id, d]) => d.value ? {
    kind: 'put',
    entity: 'table',
    id: d.value.id,
    value: d.value
  } : {
    kind: 'remove',
    entity: 'table',
    id: createId(() => id)
  });
}
export function visibleTables(tables: Table[], drafts: Drafts): Table[] {
  return [...tables.filter(t => !drafts[t.id]), ...Object.values(drafts).flatMap(d => d.value ? [d.value] : [])];
}

/** Rebase drafts typed during this save against its actual committed tables. */
export function checkpointDrafts(current: Drafts, submitted: Drafts, saved: Table[]): Drafts {
  const next: Drafts = {};
  for (const [id, draft] of Object.entries(current)) {
    const sent = submitted[id];
    if (!sent) {
      next[id] = draft;
      continue;
    }
    if (same(draft.value, sent.value)) continue;
    next[id] = {
      ...draft,
      base: sent.value ?? undefined,
      conflicts: draft.conflicts.filter(c => !sent.conflicts.includes(c))
    };
  }
  return reconcileDrafts(next, saved);
}
