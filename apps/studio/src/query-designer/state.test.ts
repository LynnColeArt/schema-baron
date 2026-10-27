import { describe, it, expect } from "vitest";
import {
  blankQuery,
  rebase,
  checkpoint,
  renameAlias,
  recoverDraft,
  same,
} from "./state.js";
describe("query editing continuity", () => {
  it("retains incomplete drafts and rebases unrelated remote fields", () => {
    const base = blankQuery(),
      mine = { ...base, name: "Typing" },
      remote = {
        ...base,
        parameters: [
          {
            id: base.id,
            name: "minimum",
            type: { kind: "integer" as const },
            nullable: false,
          },
        ],
      };
    const next = rebase({ base, value: mine, conflicts: [] }, remote);
    expect(next.value.name).toBe("Typing");
    expect(next.value.parameters).toEqual(remote.parameters);
    expect(next.conflicts).toEqual([]);
  });
  it("retains explicit colliding edits", () => {
    const base = blankQuery();
    expect(
      rebase(
        { base, value: { ...base, name: "Mine" }, conflicts: [] },
        { ...base, name: "Remote" },
      ).conflicts,
    ).toEqual(["name"]);
  });
  it("checkpoints only submitted text while newer typing stays dirty", () => {
    const base = blankQuery(),
      sent = { ...base, name: "Sent" },
      current = {
        base,
        value: { ...sent, name: "Typing again" },
        conflicts: [],
      };
    const next = checkpoint(current, sent, sent);
    expect(next.value.name).toBe("Typing again");
    expect(next.base?.name).toBe("Sent");
  });
});

it("renames aliases throughout expressions without replacing field IDs", () => {
  const q = blankQuery();
  q.sources = [{ alias: "old", source: { kind: "table", id: q.id } }];
  q.projections = [
    {
      id: q.id,
      name: "name",
      type: { kind: "text" },
      nullable: false,
      expression: { kind: "field", alias: "old", fieldId: q.id },
    },
  ];
  q.groupBy = [q.projections[0]!.expression];
  const renamed = renameAlias(q, 0, "new");
  expect(renamed.projections[0]!.expression).toEqual({
    kind: "field",
    alias: "new",
    fieldId: q.id,
  });
  expect(renamed.groupBy[0]).toEqual(renamed.projections[0]!.expression);
});

import { scalarText } from "./scalar.js";
it("preserves incomplete numbers, explicit empty strings and exact decimal text", () => {
  expect(scalarText("-", { kind: "integer" })).toBe("-");
  expect(scalarText("", { kind: "integer" })).toBe("");
  expect(scalarText("-12", { kind: "integer" })).toBe(-12);
  expect(scalarText("null", { kind: "text" })).toBe("null");
  expect(scalarText("anything", { kind: "boolean" })).toBe("anything");
  expect(scalarText("true", { kind: "boolean" })).toBe(true);
  expect(
    scalarText("0.10", {
      kind: "decimal",
      scale: 2,
      precision: 18,
      encoding: "text",
      rounding: "half-even",
    }),
  ).toBe("0.10");
});

it("recovers unfinished names and empty source lists but refuses malformed expression trees", () => {
  const value = { ...blankQuery(), name: "" };
  expect(recoverDraft({ value, conflicts: [] })).toEqual({
    value,
    conflicts: [],
  });
  value.projections = [
    {
      id: value.id,
      name: "draft",
      type: { kind: "integer" },
      nullable: false,
      expression: { kind: "literal", value: "-", type: { kind: "integer" } },
    },
  ];
  expect(recoverDraft({ value, conflicts: [] })).toBeDefined();
  expect(
    recoverDraft({
      value: {
        ...value,
        projections: [
          {
            ...value.projections[0],
            expression: { kind: "sql", sql: "not supported" },
          },
        ],
      },
      conflicts: [],
    }),
  ).toBeUndefined();
});

it("ignores serialization key order when checkpointing saved semantics", () => {
  const q = blankQuery();
  const reordered = {
    grain: q.grain,
    orderBy: q.orderBy,
    groupBy: q.groupBy,
    parameters: q.parameters,
    projections: q.projections,
    joins: q.joins,
    sources: q.sources,
    name: q.name,
    id: q.id,
  };
  expect(same(q, reordered)).toBe(true);
});
