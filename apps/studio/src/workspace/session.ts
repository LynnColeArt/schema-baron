import { pageSchema, formSchema, controlSchema } from "@schema-baron/model";
import { initialEditor, initialView } from "./state.js";
import type { Editor, View } from "./state.js";
// This store contains only model drafts and view state. Session proof and owner keys never enter it.
export function restore(id: string): { editor: Editor; view: View } {
  try {
    const raw = sessionStorage.getItem(`studio.workspace.${id}`);
    if (!raw || raw.length > 2_000_000) throw new Error();
    const data = JSON.parse(raw) as { editor: Editor; view: View };
    const check = (drafts: Editor["drafts"]) => {
      if (
        !drafts ||
        typeof drafts !== "object" ||
        Object.keys(drafts).length > 1000
      )
        throw new Error();
      for (const [id, d] of Object.entries(drafts)) {
        const schema =
          d.entity === "page"
            ? pageSchema
            : d.entity === "form"
              ? formSchema
              : d.entity === "control"
                ? controlSchema
                : undefined;
        if (
          !schema ||
          schema.parse(d.value).id !== id ||
          !Number.isSafeInteger(d.baseRevision) ||
          !Array.isArray(d.conflicts) ||
          d.conflicts.some((v) => typeof v !== "string")
        )
          throw new Error();
        if (d.base) schema.parse(d.base);
      }
    };
    check(data.editor.drafts);
    for (const stack of [data.editor.past, data.editor.future]) {
      if (!Array.isArray(stack) || stack.length > 100) throw new Error();
      for (const step of stack) {
        check(step.before);
        check(step.after);
      }
    }
    const v = data.view;
    if (v && !v.collapsed) v.collapsed = [];
    if (
      !v ||
      [v.selected, v.activePage, v.propertyTab, v.toolboxTab].some(
        (s) => typeof s !== "string",
      ) ||
      !Array.isArray(v.open) ||
      v.open.some((s) => typeof s !== "string") ||
      !Array.isArray(v.collapsed) ||
      v.collapsed.some((s) => typeof s !== "string")
    )
      throw new Error();
    return data;
  } catch {
    return { editor: initialEditor(), view: initialView() };
  }
}
export function retain(id: string, editor: Editor, view: View): boolean {
  try {
    sessionStorage.setItem(
      `studio.workspace.${id}`,
      JSON.stringify({ editor, view }),
    );
    return true;
  } catch {
    return false;
  }
}
