import { describe, it, expect } from "vitest";
import {
  blankQuery,
  recoverDraft,
  changeDraft,
  undoDraft,
  redoDraft,
  rebase,
  checkpoint,
} from "./state.js";
import type { Draft } from "./state.js";
const unfinished = () => {
  const value = blankQuery();
  value.projections = [
    {
      id: value.id,
      name: "",
      type: {
        kind: "decimal",
        scale: 3,
        precision: 1,
        encoding: "text",
        rounding: "half-even",
      },
      nullable: false,
      expression: { kind: "function", function: "coalesce", args: [] },
    },
  ];
  value.grain = { strategy: "preaggregated", keys: [], sourceAliases: [] };
  return value;
};
describe("unfinished query editing and history", () => {
  it("recovers recursive editing shapes without saved minima or numeric semantic bounds", () => {
    const value = unfinished();
    expect(recoverDraft({ value, conflicts: [] })?.value).toEqual(value);
  });
  it("roundtrips invalid current and history through recovery and undo/redo preserving IDs", () => {
    const value = unfinished(),
      first: Draft = { value, conflicts: [] };
    const changed = changeDraft(first, undefined, {
      ...value,
      projections: [],
    });
    const restored = recoverDraft(JSON.parse(JSON.stringify(changed)))!;
    expect(undoDraft(restored).value).toEqual(value);
    expect(redoDraft(undoDraft(restored)).value.projections).toEqual([]);
  });
  it("quarantines malformed history without removing valid current or other history entries", () => {
    const value = unfinished(),
      issues: string[] = [];
    const recovered = recoverDraft(
      {
        value,
        conflicts: [],
        past: [
          { value, conflicts: [] },
          {
            value: {
              ...value,
              projections: [
                { ...value.projections[0], expression: { kind: "sql" } },
              ],
            },
            conflicts: [],
          },
        ],
      },
      issues,
    )!;
    expect(recovered.value).toEqual(value);
    expect(recovered.past).toHaveLength(1);
    expect(issues.length).toBeGreaterThan(0);
  });
  it("rebases unrelated remote fields across current/past/future while retaining collision diagnostics", () => {
    const base = { ...blankQuery(), name: "Base" },
      value = { ...base, name: "Mine" };
    const edited = changeDraft(
      { base, value: base, conflicts: [] },
      base,
      value,
    );
    const remote = {
      ...base,
      orderBy: [
        {
          expression: {
            kind: "literal" as const,
            value: 1,
            type: { kind: "integer" as const },
          },
          direction: "asc" as const,
        },
      ],
    };
    const result = rebase(edited, remote);
    expect(undoDraft(result).value.orderBy).toEqual(remote.orderBy);
    expect(redoDraft(undoDraft(result)).value.name).toBe("Mine");
    const collided = rebase(result, { ...remote, name: "Agent" });
    expect(collided.conflicts).toContain("name");
  });
  it("undo after saving stages the previous model without persistence and keeps unsent typing", () => {
    const base = blankQuery(),
      sent = { ...base, name: "Sent" },
      edited = changeDraft({ value: base, conflicts: [] }, undefined, sent);
    const newer = changeDraft(edited, undefined, { ...sent, name: "Newer" });
    const saved = checkpoint(newer, sent, sent);
    expect(saved.value.name).toBe("Newer");
    expect(undoDraft(saved).value.name).toBe("Sent");
    expect(undoDraft(undoDraft(saved)).value.name).toBe(base.name);
  });
  it("navigation-equivalent updates create no history entries", () => {
    const value = blankQuery(),
      d: Draft = { value, conflicts: [] };
    expect(changeDraft(d, undefined, structuredClone(value))).toBe(d);
  });
});
it("retains explicit collision diagnostics when undo reaches a conflicting historical edit", () => {
  const base = { ...blankQuery(), name: "Base" };
  const older = changeDraft({ base, value: base, conflicts: [] }, base, {
    ...base,
    name: "Earlier local",
  });
  const current = changeDraft(older, base, base);
  const remote = { ...base, name: "Remote" };
  const rebased = rebase(current, remote);
  expect(rebased.value.name).toBe("Remote");
  const historical = undoDraft(rebased);
  expect(historical.value.name).toBe("Earlier local");
  expect(historical.conflicts).toContain("name");
});
it("bounds semantic history without adding entries for equivalent model values", () => {
  let draft: Draft = { value: blankQuery(), conflicts: [] };
  for (let i = 0; i < 130; i++)
    draft = changeDraft(draft, undefined, {
      ...draft.value,
      name: `Edit ${i}`,
    });
  expect(draft.past).toHaveLength(100);
  expect(recoverDraft(JSON.parse(JSON.stringify(draft)))?.past).toHaveLength(
    100,
  );
});
