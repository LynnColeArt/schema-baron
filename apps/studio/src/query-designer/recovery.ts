import { z } from "zod";
import { querySchema } from "@schema-baron/model";
import type { Expression } from "@schema-baron/model";
import type { Draft, Snapshot } from "./state.js";
// An editor shape describes renderable buffers, not committed semantic validity.
// In particular, empty arrays/names/IDs and invalid decimal bounds are ordinary edits.
const id = z.string().brand<"StableId">(),
  text = z.string();
const scalar = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.enum(["integer", "real", "text", "blob", "boolean"]),
  }),
  z.strictObject({ kind: z.literal("date"), encoding: z.literal("iso-date") }),
  z.strictObject({
    kind: z.literal("datetime"),
    encoding: z.literal("iso-utc"),
  }),
  z.strictObject({
    kind: z.literal("decimal"),
    scale: z.number().finite(),
    precision: z.number().finite(),
    encoding: z.enum(["text", "scaled-integer"]),
    rounding: z.enum(["half-up", "half-even", "down"]),
  }),
]);
const value = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const expression: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("literal"), value, type: scalar }),
    z.strictObject({ kind: z.literal("field"), alias: text, fieldId: id }),
    z.strictObject({ kind: z.literal("parameter"), parameterId: id }),
    z.strictObject({
      kind: z.literal("binary"),
      operator: z.enum([
        "+",
        "-",
        "*",
        "/",
        "=",
        "!=",
        "<",
        "<=",
        ">",
        ">=",
        "and",
        "or",
      ]),
      left: expression,
      right: expression,
    }),
    z.strictObject({
      kind: z.literal("function"),
      function: z.enum([
        "coalesce",
        "lower",
        "upper",
        "length",
        "abs",
        "date",
        "year",
      ]),
      args: z.array(expression),
    }),
    z.strictObject({
      kind: z.literal("aggregate"),
      function: z.enum(["count", "sum", "min", "max", "avg"]),
      argument: expression.optional(),
      distinct: z.boolean().optional(),
      zeroChildren: z.enum(["null", "zero"]).optional(),
    }),
  ]),
);
const editorQuery = querySchema.extend({
  id,
  name: text,
  sources: z.array(
    z.strictObject({
      alias: text,
      source: z.strictObject({ kind: z.enum(["table", "query"]), id }),
    }),
  ),
  joins: z.array(
    z.strictObject({
      leftAlias: text,
      rightAlias: text,
      kind: z.enum(["inner", "left"]),
      cardinality: z.enum([
        "one-to-one",
        "many-to-one",
        "one-to-many",
        "many-to-many",
      ]),
      on: expression,
    }),
  ),
  projections: z.array(
    z.strictObject({
      id,
      name: text,
      type: scalar,
      nullable: z.boolean(),
      expression,
    }),
  ),
  parameters: z.array(
    z.strictObject({
      id,
      name: text,
      type: scalar,
      nullable: z.boolean(),
      default: value.optional(),
    }),
  ),
  where: expression.optional(),
  having: expression.optional(),
  groupBy: z.array(expression),
  orderBy: z.array(
    z.strictObject({ expression, direction: z.enum(["asc", "desc"]) }),
  ),
  grain: z.discriminatedUnion("strategy", [
    z.strictObject({ strategy: z.literal("rows"), keys: z.array(id) }),
    z.strictObject({ strategy: z.literal("grouped"), keys: z.array(id) }),
    z.strictObject({
      strategy: z.literal("preaggregated"),
      keys: z.array(id),
      sourceAliases: z.array(text),
    }),
  ]),
});
const snapshot = z.strictObject({
  value: editorQuery,
  conflicts: z.array(text),
});
function bounded(input: unknown): boolean {
  const pending: [unknown, number][] = [[input, 0]];
  let nodes = 0,
    characters = 0;
  while (pending.length) {
    const [item, depth] = pending.pop()!;
    if (++nodes > 200000 || depth > 64) return false;
    if (typeof item === "string" && (characters += item.length) > 4_000_000)
      return false;
    if (item && typeof item === "object")
      for (const child of Object.values(item)) pending.push([child, depth + 1]);
  }
  return true;
}
/** Quarantine malformed entries independently; never apply saved-query minima to history. */
export function recoverDraft(
  input: unknown,
  issues: string[] = [],
): Draft | undefined {
  if (!input || typeof input !== "object" || !bounded(input)) return;
  const raw = input as Draft,
    parsed = snapshot.safeParse({ value: raw.value, conflicts: raw.conflicts });
  if (!parsed.success || (raw.base && !querySchema.safeParse(raw.base).success))
    return;
  const history = (entries: unknown, label: string): Snapshot[] => {
    if (!Array.isArray(entries)) {
      issues.push(`Invalid ${label} history quarantined.`);
      return [];
    }
    if (entries.length > 100)
      issues.push(`Older ${label} entries exceed the recovery limit.`);
    return entries.slice(-100).flatMap((entry) => {
      const result = snapshot.safeParse(entry);
      if (!result.success || result.data.value.id !== parsed.data.value.id) {
        issues.push(`Malformed ${label} entry quarantined.`);
        return [];
      }
      return [result.data];
    });
  };
  return {
    ...parsed.data,
    ...(raw.base ? { base: raw.base } : {}),
    ...(raw.past !== undefined ? { past: history(raw.past, "undo") } : {}),
    ...(raw.future !== undefined
      ? { future: history(raw.future, "redo") }
      : {}),
  };
}
