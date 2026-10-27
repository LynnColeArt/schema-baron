import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createId, parseProject, projectSchema } from "@schema-baron/model";
import {
  edit,
  initialEditor,
  initialView,
  undo,
  redo,
  visible,
} from "./state.js";
import { restore, retain } from "./session.js";
const id = (value: string) => createId(() => value);
const orchard = {
  id: id("orchard"),
  title: "Orchard",
  route: "/orchard",
  formIds: [],
  document: [],
};
function project() {
  return parseProject({
    id: "p",
    formatVersion: 1,
    revision: 2,
    name: "Recovery",
    target: "next-typescript-sqlite",
    targetVersion: "1",
    connectionRefs: [],
    connections: [],
    schema: { id: "s", revision: 1, tables: [], opaqueObjects: [] },
    queries: [],
    pages: [orchard],
    forms: [],
    controls: [],
    actions: [],
    policies: [
      { id: "policy", scope: "global", ownerId: "p", access: "public" },
    ],
    globalPolicyId: "policy",
    outputConfig: { approvedRootId: "output", relativePath: "app" },
    extensionContracts: [],
  });
}
let storage: Map<string, string>;
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
function mixed() {
  const p = project();
  return edit(initialEditor(), p, [
    { entity: "page", value: { ...orchard, title: "" } },
    {
      entity: "page",
      value: {
        ...orchard,
        id: id("meadow"),
        title: "Meadow draft",
        route: "/meadow",
      },
    },
  ]);
}
test("recovery preserves mixed invalid and valid drafts, stable navigation and incomplete history without relaxing committed validation", () => {
  const editor = mixed(),
    view = {
      ...initialView(),
      selected: "orchard",
      activePage: "orchard",
      open: ["orchard", "meadow"],
    };
  expect(retain("mixed", editor, view)).toBe(true);
  const recovered = restore("mixed");
  expect(recovered.editor).toEqual(editor);
  expect(recovered.view).toEqual(view);
  expect(recovered.issues).toEqual([]);
  expect(
    projectSchema.safeParse(visible(project(), recovered.editor)).success,
  ).toBe(false);
});
test("correcting a title does not make its invalid undo history unrecoverable, including the redo stack", () => {
  const p = project();
  const corrected = edit(mixed(), p, [
    { entity: "page", value: { ...orchard, title: "Orchard corrected" } },
  ]);
  retain("history", corrected, initialView());
  let recovered = restore("history");
  expect(recovered.editor).toEqual(corrected);
  const undone = undo(recovered.editor);
  expect(undone.drafts.orchard!.value).toMatchObject({ title: "" });
  retain("history", undone, initialView());
  recovered = restore("history");
  expect(recovered.editor).toEqual(undone);
  expect(redo(recovered.editor).drafts.orchard!.value).toMatchObject({
    title: "Orchard corrected",
  });
  expect(recovered.editor.drafts.meadow!.value).toMatchObject({
    title: "Meadow draft",
  });
});
test("supported incomplete page routes and out-of-range numeric properties remain recoverable drafts", () => {
  const p = project();
  const editor = edit(initialEditor(), p, [
    { entity: "page", value: { ...orchard, route: "" } },
    {
      entity: "form",
      value: {
        id: id("form"),
        pageId: orchard.id,
        kind: "Login",
        keyMapping: [],
        controlIds: [],
        actionIds: [],
        search: [],
        sorting: [],
        paging: { pageSize: 0 },
        appearance: { label: "" },
      },
    },
  ]);
  retain("fields", editor, initialView());
  expect(restore("fields").editor).toEqual(editor);
});
test("a malformed stored entry cannot erase unrelated drafts; unsafe history is reported and original recovery data is preserved", () => {
  const editor = mixed();
  const raw = JSON.stringify({
    editor: {
      ...editor,
      drafts: {
        ...editor.drafts,
        broken: { entity: "page", value: { id: "broken" } },
      },
    },
    view: initialView(),
  });
  storage.set("studio.workspace.partial", raw);
  const recovered = restore("partial");
  expect(recovered.editor.drafts).toEqual(editor.drafts);
  expect(recovered.issues.length).toBeGreaterThan(0);
  expect(recovered.editor.past).toEqual([]);
  expect(storage.get("studio.workspace.partial.recovery")).toBe(raw);
  expect(retain("partial", recovered.editor, recovered.view)).toBe(true);
  expect(storage.get("studio.workspace.partial.recovery")).toBe(raw);
});
test("malformed navigation preserves valid draft data and independent view fields with an actionable warning", () => {
  const editor = mixed();
  storage.set(
    "studio.workspace.view",
    JSON.stringify({
      editor,
      view: {
        ...initialView(),
        selected: "orchard",
        open: ["orchard", "meadow"],
        propertyTab: 42,
      },
    }),
  );
  const recovered = restore("view");
  expect(recovered.editor).toEqual(editor);
  expect(recovered.view.selected).toBe("orchard");
  expect(recovered.view.open).toEqual(["orchard", "meadow"]);
  expect(recovered.issues.length).toBeGreaterThan(0);
});
test("unreadable recovery is reported and cannot be overwritten when the original cannot be backed up", () => {
  const raw = "{not JSON";
  storage.set("studio.workspace.unreadable", raw);
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: () => {
      throw new Error("quota");
    },
  });
  expect(restore("unreadable").issues.length).toBeGreaterThan(0);
  expect(retain("unreadable", initialEditor(), initialView())).toBe(false);
  expect(storage.get("studio.workspace.unreadable")).toBe(raw);
});

test("recovery backups are bounded and an existing backup is never overwritten", () => {
  const prior = "earlier recovery source",
    current = "{malformed";
  storage.set("studio.workspace.protected.recovery", prior);
  storage.set("studio.workspace.protected", current);
  const recovered = restore("protected");
  expect(recovered.issues.length).toBeGreaterThan(0);
  expect(retain("protected", initialEditor(), initialView())).toBe(false);
  expect(storage.get("studio.workspace.protected.recovery")).toBe(prior);
  expect(storage.get("studio.workspace.protected")).toBe(current);
  const oversized = "x".repeat(2_000_001);
  storage.set("studio.workspace.large", oversized);
  expect(restore("large").issues.length).toBeGreaterThan(0);
  expect(storage.has("studio.workspace.large.recovery")).toBe(false);
  expect(retain("large", initialEditor(), initialView())).toBe(false);
  expect(storage.get("studio.workspace.large")).toBe(oversized);
});
