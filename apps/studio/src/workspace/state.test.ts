import { expect, test } from "vitest";
import { createId, parseProject } from "@schema-baron/model";
import {
  edit,
  reconcile,
  visible,
  undo,
  redo,
  resolveDraft,
  operations,
  initialEditor,
  checkpoint,
} from "./state.js";
const id = createId(() => "page");
function project() {
  return parseProject({
    id: "p",
    formatVersion: 1,
    revision: 1,
    name: "Blank",
    target: "next-typescript-sqlite",
    targetVersion: "1",
    connectionRefs: [],
    connections: [],
    schema: { id: "s", revision: 1, tables: [], opaqueObjects: [] },
    queries: [],
    pages: [
      { id, title: "Original", route: "/original", document: [], formIds: [] },
    ],
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
test("two object drafts and model history survive unrelated revisions without overwriting remote fields", () => {
  const base = project();
  base.pages.push({
    ...base.pages[0]!,
    id: createId(() => "two"),
    title: "Second",
    route: "/two",
  });
  let editor = edit(initialEditor(), base, [
    { entity: "page", value: { ...base.pages[0]!, title: "Draft one" } },
  ]);
  editor = edit(editor, base, [
    { entity: "page", value: { ...base.pages[1]!, title: "Draft two" } },
  ]);
  const remote = structuredClone(base);
  remote.revision = 2;
  remote.pages[0]!.route = "/agent";
  editor = reconcile(editor, remote);
  expect(visible(remote, editor).pages.map((p) => p.title)).toEqual([
    "Draft one",
    "Draft two",
  ]);
  expect(visible(remote, editor).pages[0]!.route).toBe("/agent");
  expect(editor.drafts.page!.conflicts).toEqual([]);
  editor = undo(editor);
  expect(visible(remote, editor).pages[1]!.title).toBe("Second");
  editor = redo(editor);
  expect(visible(remote, editor).pages[1]!.title).toBe("Draft two");
  expect(operations(editor)).toHaveLength(2);
});
test("same-field and remote deletion conflicts preserve draft and require explicit resolution", () => {
  const base = project();
  let editor = edit(initialEditor(), base, [
    { entity: "page", value: { ...base.pages[0]!, title: "Mine" } },
  ]);
  const remote = structuredClone(base);
  remote.revision++;
  remote.pages[0]!.title = "Agent";
  editor = reconcile(editor, remote);
  expect(editor.drafts.page!.conflicts).toContain("title");
  expect(() => operations(editor)).toThrow("Resolve");
  editor = resolveDraft(editor, remote, "page", "mine");
  expect(operations(editor)[0]).toMatchObject({ value: { title: "Mine" } });
  remote.pages = [];
  remote.revision++;
  editor = reconcile(editor, remote);
  expect(editor.drafts.page!.conflicts).toContain("$object");
  editor = resolveDraft(editor, remote, "page", "remote");
  expect(operations(editor)).toEqual([]);
});
test("undo does not restore a stale remote value after a remote edit matching a draft", () => {
  const base = project();
  let editor = edit(initialEditor(), base, [
    { entity: "page", value: { ...base.pages[0]!, title: "Mine" } },
  ]);
  const remote = structuredClone(base);
  remote.revision++;
  remote.pages[0]!.route = "/new";
  editor = reconcile(editor, remote);
  editor = undo(editor);
  expect(visible(remote, editor).pages[0]).toMatchObject({
    title: "Original",
    route: "/new",
  });
});

test("undo a saved batch stages the inverse, including newly created entities, and redo restores it", () => {
  const base = project();
  let editor = edit(initialEditor(), base, [
    { entity: "page", value: { ...base.pages[0]!, title: "Saved title" } },
    {
      entity: "page",
      value: {
        ...base.pages[0]!,
        id: createId(() => "new"),
        title: "New",
        route: "/new",
      },
    },
  ]);
  const saved = visible(base, editor);
  saved.revision++;
  editor = checkpoint(editor, base, saved);
  expect(operations(editor)).toEqual([]);
  editor = undo(editor);
  expect(visible(saved, editor).pages).toEqual(base.pages);
  expect(operations(editor)).toContainEqual({
    kind: "remove",
    entity: "page",
    id: "new",
  });
  editor = redo(editor);
  expect(visible(saved, editor).pages).toEqual(saved.pages);
});
