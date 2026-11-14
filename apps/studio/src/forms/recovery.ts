import { z } from "zod";
import {
  actionSchema,
  appearanceSchema,
  controlSchema,
  formSchema,
} from "@schema-baron/model";
import type { Expression } from "@schema-baron/model";
// Editing buffers admit unfinished tuples/expressions and finite out-of-range settings.
// They never bypass the strict committed schemas at the command boundary.
const id = z.string().max(256).brand<"StableId">();
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
const expression: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("literal"),
      value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
      type: scalar,
    }),
    z.strictObject({
      kind: z.literal("field"),
      alias: z.string(),
      fieldId: id,
    }),
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
      args: z.array(expression).max(16),
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
const mapping = z.strictObject({ targetFieldId: id, expression });
const source = z.strictObject({ kind: z.enum(["table", "query"]), id });
const destination = z.strictObject({
  pageId: id,
  keyMapping: z.array(mapping).max(1000),
  filterMapping: z.array(mapping).max(1000),
});
const appearance = appearanceSchema.extend({
  width: z.number().finite().optional(),
});
export const editingForm = formSchema.extend({
  appearance,
  sourceRef: source.optional(),
  keyMapping: z.array(mapping).max(1000),
  paging: z.strictObject({ pageSize: z.number().finite() }),
});
export const editingControl = controlSchema.extend({
  appearance,
  binding: z
    .discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("stored"), fieldId: id }),
      z.strictObject({
        kind: z.literal("derived"),
        expression,
        sourceDependencies: z.array(id).max(1000),
      }),
    ])
    .optional(),
  validation: controlSchema.shape.validation.extend({
    maxLength: z.number().finite().optional(),
  }),
  lookup: z
    .strictObject({
      source,
      valueFieldIds: z.array(id).max(1000),
      labelFieldId: id,
    })
    .optional(),
});
export const editingAction = actionSchema.extend({
  destination: destination.optional(),
  success: destination.optional(),
  cancel: destination.optional(),
  extensionHookRef: id.optional(),
});
export function boundedEditing(input: unknown): boolean {
  const pending: [unknown, number][] = [[input, 0]];
  let nodes = 0;
  while (pending.length) {
    const [value, depth] = pending.pop()!;
    if (++nodes > 200000 || depth > 64) return false;
    if (value && typeof value === "object")
      for (const child of Object.values(value))
        pending.push([child, depth + 1]);
  }
  return true;
}
