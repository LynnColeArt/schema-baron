import { createId, canonicalJson } from "@schema-baron/model";
import type { Query } from "@schema-baron/model";
export interface Snapshot {
  value: Query;
  conflicts: string[];
}
export interface Draft extends Snapshot {
  base?: Query | undefined;
  past?: Snapshot[];
  future?: Snapshot[];
}
export { recoverDraft } from "./recovery.js";
export const same = (a: unknown, b: unknown) =>
  canonicalJson(a) === canonicalJson(b);
export function blankQuery(): Query {
  return {
    id: createId(),
    name: "Untitled query",
    sources: [],
    joins: [],
    projections: [],
    parameters: [],
    groupBy: [],
    orderBy: [],
    grain: { strategy: "rows", keys: [] },
  };
}
function mergeSnapshot(
  snapshot: Snapshot,
  base: Query | undefined,
  remote: Query | undefined,
): Snapshot {
  if (same(remote, base)) return snapshot;
  if (!base)
    return remote
      ? { ...snapshot, conflicts: [...new Set([...snapshot.conflicts, "id"])] }
      : snapshot;
  if (!remote)
    return {
      ...snapshot,
      conflicts: [...new Set([...snapshot.conflicts, "deleted query"])],
    };
  const value = { ...snapshot.value },
    conflicts = [...snapshot.conflicts];
  for (const key of Object.keys({
    ...base,
    ...value,
    ...remote,
  }) as (keyof Query)[]) {
    if (same(value[key], base[key])) {
      if (remote[key] === undefined) delete value[key];
      else Object.assign(value, { [key]: remote[key] });
    } else if (!same(remote[key], base[key]) && !same(value[key], remote[key]))
      conflicts.push(key);
  }
  return { value, conflicts: [...new Set(conflicts)] };
}
export function rebase(draft: Draft, remote: Query | undefined): Draft {
  if (same(remote, draft.base)) return draft;
  return {
    ...draft,
    ...mergeSnapshot(draft, draft.base, remote),
    base: remote ?? draft.base,
    ...(draft.past
      ? { past: draft.past.map((s) => mergeSnapshot(s, draft.base, remote)) }
      : {}),
    ...(draft.future
      ? {
          future: draft.future.map((s) => mergeSnapshot(s, draft.base, remote)),
        }
      : {}),
  };
}
const snapshot = (d: Snapshot): Snapshot => ({
  value: d.value,
  conflicts: d.conflicts,
});
export function changeDraft(
  prior: Draft | undefined,
  base: Query | undefined,
  value: Query,
): Draft {
  const current = prior ?? { base, value: base ?? value, conflicts: [] };
  if (same(current.value, value)) return current;
  return {
    ...current,
    value,
    past: [...(current.past ?? []).slice(-99), snapshot(current)],
    future: [],
  };
}
export function undoDraft(draft: Draft): Draft {
  const past = draft.past ?? [],
    previous = past.at(-1);
  if (!previous) return draft;
  return {
    ...draft,
    ...previous,
    past: past.slice(0, -1),
    future: [...(draft.future ?? []).slice(-99), snapshot(draft)],
  };
}
export function redoDraft(draft: Draft): Draft {
  const future = draft.future ?? [],
    next = future.at(-1);
  if (!next) return draft;
  return {
    ...draft,
    ...next,
    past: [...(draft.past ?? []).slice(-99), snapshot(draft)],
    future: future.slice(0, -1),
  };
}
export function checkpoint(
  current: Draft,
  submitted: Query,
  saved: Query,
): Draft {
  return rebase({ ...current, base: submitted, conflicts: [] }, saved);
}

/** Alias renames update the one semantic AST, preserving stable source/output identities. */
export function renameAlias(query: Query, index: number, alias: string): Query {
  const old = query.sources[index]?.alias;
  if (old === undefined) return query;
  const expression = (
    e: import("@schema-baron/model").Expression,
  ): import("@schema-baron/model").Expression => {
    if (e.kind === "field") return e.alias === old ? { ...e, alias } : e;
    if (e.kind === "binary")
      return { ...e, left: expression(e.left), right: expression(e.right) };
    if (e.kind === "function") return { ...e, args: e.args.map(expression) };
    if (e.kind === "aggregate" && e.argument)
      return { ...e, argument: expression(e.argument) };
    return e;
  };
  return {
    ...query,
    sources: query.sources.map((s, i) => (i === index ? { ...s, alias } : s)),
    joins: query.joins.map((j) => ({
      ...j,
      leftAlias: j.leftAlias === old ? alias : j.leftAlias,
      rightAlias: j.rightAlias === old ? alias : j.rightAlias,
      on: expression(j.on),
    })),
    projections: query.projections.map((p) => ({
      ...p,
      expression: expression(p.expression),
    })),
    ...(query.where ? { where: expression(query.where) } : {}),
    ...(query.having ? { having: expression(query.having) } : {}),
    groupBy: query.groupBy.map(expression),
    orderBy: query.orderBy.map((o) => ({
      ...o,
      expression: expression(o.expression),
    })),
    grain:
      query.grain.strategy === "preaggregated"
        ? {
            ...query.grain,
            sourceAliases: query.grain.sourceAliases.map((a) =>
              a === old ? alias : a,
            ),
          }
        : query.grain,
  };
}
