import type {
  Control,
  EntityBatchOperation,
  Form,
  Page,
  Project,
} from "@schema-baron/model";
export type Kind = "page" | "form" | "control";
export type ObjectValue = Page | Form | Control;
export type Change = { entity: Kind; value: ObjectValue };
export interface Draft {
  entity: Kind;
  value: ObjectValue;
  base?: ObjectValue | undefined;
  baseRevision: number;
  conflicts: string[];
  removed?: boolean;
}
export type Drafts = Record<string, Draft>;
interface Step {
  before: Drafts;
  after: Drafts;
}
export interface Editor {
  drafts: Drafts;
  past: Step[];
  future: Step[];
}
export const initialEditor = (): Editor => ({
  drafts: {},
  past: [],
  future: [],
});
const collections = {
  page: "pages",
  form: "forms",
  control: "controls",
} as const;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function object(
  project: Project,
  entity: Kind,
  id: string,
): ObjectValue | undefined {
  return project[collections[entity]].find((value) => value.id === id);
}
export function visible(project: Project, editor: Editor): Project {
  const result = structuredClone(project);
  for (const draft of Object.values(editor.drafts)) {
    const list = result[collections[draft.entity]] as ObjectValue[];
    const index = list.findIndex((v) => v.id === draft.value.id);
    if (draft.removed) {
      if (index >= 0) list.splice(index, 1);
    } else if (index < 0) list.push(draft.value);
    else list[index] = draft.value;
  }
  return result;
}
export function edit(
  editor: Editor,
  project: Project,
  changes: Change[],
): Editor {
  const drafts = structuredClone(editor.drafts);
  for (const { entity, value } of changes) {
    const prior = drafts[value.id];
    const base = prior?.base ?? object(project, entity, value.id);
    if (same(value, base)) delete drafts[value.id];
    else
      drafts[value.id] = {
        entity,
        value,
        base,
        baseRevision: prior?.baseRevision ?? project.revision,
        conflicts: prior?.conflicts ?? [],
      };
  }
  if (same(drafts, editor.drafts)) return editor;
  return {
    drafts,
    past: [...editor.past.slice(-99), { before: editor.drafts, after: drafts }],
    future: [],
  };
}
// Recursive three-way merge; ordered collections are atomic to avoid guessing model semantics.
function merge(
  base: unknown,
  mine: unknown,
  remote: unknown,
  path: string,
  conflicts: string[],
): unknown {
  if (same(mine, base)) return remote;
  if (same(remote, base) || same(mine, remote)) return mine;
  if (
    base &&
    mine &&
    remote &&
    typeof base === "object" &&
    typeof mine === "object" &&
    typeof remote === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(mine) &&
    !Array.isArray(remote)
  ) {
    const b = base as Record<string, unknown>,
      m = mine as Record<string, unknown>,
      r = remote as Record<string, unknown>;
    return Object.fromEntries(
      [...new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(r)])]
        .map((key) => [
          key,
          merge(
            b[key],
            m[key],
            r[key],
            path ? `${path}.${key}` : key,
            conflicts,
          ),
        ])
        .filter(([, value]) => value !== undefined),
    );
  }
  conflicts.push(path || "$object");
  return mine;
}
function rebase(drafts: Drafts, project: Project): Drafts {
  const next: Drafts = {};
  for (const [id, draft] of Object.entries(drafts)) {
    const remote = object(project, draft.entity, id);
    const conflicts = [...draft.conflicts];
    if (draft.removed) {
      if (remote)
        next[id] = {
          ...draft,
          base: remote,
          baseRevision: project.revision,
          conflicts: same(draft.base, remote)
            ? conflicts
            : [...new Set([...conflicts, "$object"])],
        };
      continue;
    }
    const value = merge(
      draft.base,
      draft.value,
      remote,
      "",
      conflicts,
    ) as ObjectValue;
    if (!same(value, remote))
      next[id] = {
        ...draft,
        value,
        base: remote,
        baseRevision: project.revision,
        conflicts: [...new Set(conflicts)],
      };
  }
  return next;
}
export function reconcile(editor: Editor, project: Project): Editor {
  return {
    drafts: rebase(editor.drafts, project),
    past: editor.past.map((s) => ({
      before: rebase(s.before, project),
      after: rebase(s.after, project),
    })),
    future: editor.future.map((s) => ({
      before: rebase(s.before, project),
      after: rebase(s.after, project),
    })),
  };
}
export function undo(editor: Editor): Editor {
  const step = editor.past.at(-1);
  return step
    ? {
        drafts: step.before,
        past: editor.past.slice(0, -1),
        future: [...editor.future, step],
      }
    : editor;
}
export function redo(editor: Editor): Editor {
  const step = editor.future.at(-1);
  return step
    ? {
        drafts: step.after,
        past: [...editor.past, step],
        future: editor.future.slice(0, -1),
      }
    : editor;
}
export function resolveDraft(
  editor: Editor,
  project: Project,
  id: string,
  choice: "mine" | "remote",
): Editor {
  const drafts = { ...editor.drafts };
  const draft = drafts[id];
  if (!draft) return editor;
  if (choice === "remote") delete drafts[id];
  else
    drafts[id] = {
      ...draft,
      base: object(project, draft.entity, id),
      baseRevision: project.revision,
      conflicts: [],
    };
  // Resolution is an explicit boundary: undo cannot silently resurrect an unresolved comparison.
  return { drafts, past: [], future: [] };
}
export function operations(editor: Editor): EntityBatchOperation[] {
  if (Object.values(editor.drafts).some((d) => d.conflicts.length))
    throw new Error("Resolve conflicting drafts before saving.");
  return Object.values(editor.drafts).map(
    (d) =>
      (d.removed
        ? { kind: "remove", entity: d.entity, id: d.value.id }
        : {
            kind: "put",
            entity: d.entity,
            id: d.value.id,
            value: d.value,
          }) as EntityBatchOperation,
  );
}

export interface View {
  selected: string;
  open: string[];
  activePage: string;
  propertyTab: string;
  toolboxTab: string;
  collapsed: string[];
}
export const initialView = (): View => ({
  selected: "",
  open: [],
  activePage: "",
  propertyTab: "Format",
  toolboxTab: "Forms",
  collapsed: [],
});

/** Save is one model-history checkpoint; undoing it stages its inverse, never writes implicitly. */
export function checkpoint(
  editor: Editor,
  before: Project,
  saved: Project,
): Editor {
  const inverse: Drafts = {};
  for (const [id, draft] of Object.entries(editor.drafts)) {
    const previous = object(before, draft.entity, id),
      current = object(saved, draft.entity, id);
    if (previous && !same(previous, current))
      inverse[id] = {
        entity: draft.entity,
        value: previous,
        base: current,
        baseRevision: saved.revision,
        conflicts: [],
      };
    else if (!previous && current)
      inverse[id] = {
        entity: draft.entity,
        value: current,
        base: current,
        baseRevision: saved.revision,
        conflicts: [],
        removed: true,
      };
  }
  return {
    drafts: {},
    past: Object.keys(inverse).length ? [{ before: inverse, after: {} }] : [],
    future: [],
  };
}
