import { z } from "zod";
import { createId, querySchema, canonicalJson } from "@schema-baron/model";
import type { Query } from "@schema-baron/model";
export interface Draft {
  base?: Query | undefined;
  value: Query;
  conflicts: string[];
}
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
export function rebase(draft: Draft, remote: Query | undefined): Draft {
  if (same(remote, draft.base)) return draft;
  if (!draft.base) return remote ? { ...draft, conflicts: ["id"] } : draft;
  if (!remote) return { ...draft, conflicts: ["deleted query"] };
  const value = { ...draft.value },
    conflicts = [...draft.conflicts];
  for (const key of Object.keys({
    ...draft.base,
    ...value,
    ...remote,
  }) as (keyof Query)[]) {
    if (same(value[key], draft.base[key])) {
      if (remote[key] === undefined) delete value[key];
      else Object.assign(value, { [key]: remote[key] });
    } else if (
      !same(remote[key], draft.base[key]) &&
      !same(value[key], remote[key])
    )
      conflicts.push(key);
  }
  return { base: remote, value, conflicts: [...new Set(conflicts)] };
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

/** Validate recovery structure without treating an unfinished editor as a saved query. */
export function recoverDraft(input: unknown): Draft | undefined {
  if (!input || typeof input !== "object") return;
  const d = input as Draft;
  if (
    !d.value ||
    !Array.isArray(d.conflicts) ||
    !d.conflicts.every((c) => typeof c === "string")
  )
    return;
  const normalize = (value: unknown): unknown =>
    value === ""
      ? "unfinished"
      : Array.isArray(value)
        ? value.map(normalize)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, normalize(v)]),
            )
          : value;
  const value = d.value;
  const loose = querySchema.extend({
    sources: z.array(querySchema.shape.sources.element),
    projections: z.array(querySchema.shape.projections.element),
  });
  if (
    !loose.safeParse(normalize(value)).success ||
    (d.base && !querySchema.safeParse(d.base).success)
  )
    return;
  return d;
}
