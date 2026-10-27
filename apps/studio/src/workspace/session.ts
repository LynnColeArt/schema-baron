import { z } from "zod";
import {
  pageSchema,
  formSchema,
  controlSchema,
  idSchema,
} from "@schema-baron/model";
import { initialEditor, initialView } from "./state.js";
import type { Draft, Drafts, Editor, View } from "./state.js";

// Recovery is a bounded editor envelope, not permission to commit a model. Editable
// fields may be incomplete/out of range here; the owner still validates every Save.
const draftValues = {
  page: pageSchema.extend({ title: z.string(), route: z.string() }),
  form: formSchema.extend({
    paging: z.strictObject({ pageSize: z.number().finite() }),
  }),
  control: controlSchema,
};
const draftEnvelope = z.strictObject({
  entity: z.enum(["page", "form", "control"]),
  value: z.unknown(),
  base: z.unknown().optional(),
  baseRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  conflicts: z.array(z.string().max(1024)).max(1000),
  removed: z.boolean().optional(),
});
const MAX_CHARS = 2_000_000;
const blockedWrites = new Set<string>();
const key = (id: string) => `studio.workspace.${id}`;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export interface Recovery {
  editor: Editor;
  view: View;
  issues: string[];
}

// This store contains only model drafts and view state. Session proof and owner keys never enter it.
export function restore(id: string): Recovery {
  const result: Recovery = {
    editor: initialEditor(),
    view: initialView(),
    issues: [],
  };
  const issues = new Set<string>();
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(key(id));
  } catch {
    blockedWrites.add(id);
    return {
      ...result,
      issues: [
        "Draft recovery storage is unavailable. Keep this tab open and save your drafts before switching projects.",
      ],
    };
  }
  if (raw === null) {
    blockedWrites.delete(id);
    return result;
  }
  function drafts(value: unknown): { values: Drafts; damaged: boolean } {
    const values: Drafts = Object.create(null);
    if (!record(value)) return { values, damaged: true };
    const entries = Object.entries(value);
    let damaged = entries.length > 1000;
    for (const [objectId, input] of entries.slice(0, 1000)) {
      const envelope = draftEnvelope.safeParse(input);
      if (!envelope.success || !idSchema.safeParse(objectId).success) {
        damaged = true;
        continue;
      }
      const draft = envelope.data;
      const value = draftValues[draft.entity].safeParse(draft.value);
      const base =
        draft.base === undefined
          ? undefined
          : draftValues[draft.entity].safeParse(draft.base);
      if (
        !value.success ||
        value.data.id !== objectId ||
        (base && (!base.success || base.data.id !== objectId))
      ) {
        damaged = true;
        continue;
      }
      // Copy only supported fields; malformed or unknown entry data never reaches the editor.
      values[objectId] = {
        entity: draft.entity,
        value: value.data,
        base: base?.success ? base.data : undefined,
        baseRevision: draft.baseRevision,
        conflicts: draft.conflicts,
        ...(draft.removed === undefined ? {} : { removed: draft.removed }),
      } as Draft;
    }
    return { values, damaged };
  }
  function history(value: unknown): {
    steps: Editor["past"];
    damaged: boolean;
  } {
    if (!Array.isArray(value) || value.length > 100)
      return { steps: [], damaged: true };
    const steps: Editor["past"] = [];
    let damaged = false;
    for (const step of value) {
      if (!record(step)) {
        damaged = true;
        continue;
      }
      const before = drafts(step.before),
        after = drafts(step.after);
      if (before.damaged || after.damaged) damaged = true;
      else steps.push({ before: before.values, after: after.values });
    }
    return { steps, damaged };
  }
  try {
    if (raw.length > MAX_CHARS) throw new Error("Recovery limit");
    const data: unknown = JSON.parse(raw);
    if (!record(data)) throw new Error("Recovery shape");
    const editor = record(data.editor) ? data.editor : {};
    const current = drafts(editor.drafts),
      past = history(editor.past),
      future = history(editor.future);
    result.editor.drafts = current.values;
    if (current.damaged)
      issues.add(
        "Some stored draft entries could not be recovered. Unrelated recoverable drafts were kept. Save those drafts before closing this tab.",
      );
    if (current.damaged || past.damaged || future.damaged) {
      // A partially missing snapshot is not a safe undo target: keep current drafts,
      // explicitly reset unsafe history, and preserve the original recovery record.
      issues.add(
        "Stored undo history could not be restored safely. Current recoverable drafts remain editable; start new undo history from here.",
      );
    } else {
      result.editor.past = past.steps;
      result.editor.future = future.steps;
    }
    const view = record(data.view) ? data.view : {};
    const viewFields = {
      selected: z.string().max(256),
      activePage: z.string().max(256),
      open: z.array(idSchema).max(1000),
      collapsed: z.array(idSchema).max(1000),
      propertyTab: z.enum(["Format", "Data", "Events"]),
      toolboxTab: z.enum(["Forms", "Controls", "HTML"]),
    };
    for (const name of Object.keys(viewFields) as (keyof View)[]) {
      const parsed = viewFields[name].safeParse(
        view[name] ?? (name === "collapsed" ? [] : undefined),
      );
      if (parsed.success) Object.assign(result.view, { [name]: parsed.data });
      else
        issues.add(
          "Some stored navigation settings were unreadable. Drafts and other recoverable navigation settings were kept.",
        );
    }
  } catch {
    issues.add(
      "Stored draft recovery data is unreadable or exceeds the recovery limit. The original data is retained in this tab; save any recovered work before closing it.",
    );
  }
  result.issues = [...issues];
  if (result.issues.length) {
    try {
      // Preserve the raw source before the normal retain effect replaces the live key.
      const backupKey = `${key(id)}.recovery`;
      const previous = sessionStorage.getItem(backupKey);
      // One bounded backup per project. Never overwrite an older recovery source;
      // if it differs, preserve this source in the live key and stop automatic writes.
      if (raw.length > MAX_CHARS || (previous !== null && previous !== raw))
        throw new Error("Recovery backup is protected");
      sessionStorage.setItem(backupKey, raw);
      blockedWrites.delete(id);
    } catch {
      blockedWrites.add(id);
      result.issues.push(
        "Recovery data could not be backed up within the storage limit, or an earlier backup is already protected. Automatic replacement is blocked. Keep this tab open, save recovered drafts, and preserve the original recovery data before closing.",
      );
    }
  } else blockedWrites.delete(id);
  return result;
}
export function retain(id: string, editor: Editor, view: View): boolean {
  if (blockedWrites.has(id)) return false;
  try {
    const raw = JSON.stringify({ editor, view });
    if (raw.length > MAX_CHARS) return false;
    sessionStorage.setItem(key(id), raw);
    return true;
  } catch {
    return false;
  }
}
