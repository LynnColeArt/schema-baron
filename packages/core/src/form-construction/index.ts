import {
  createId,
  ModelValidationError,
  operationInputSchemas,
} from "@schema-baron/model";
import type {
  Action,
  Command,
  Control,
  EntityBatchOperation,
  Form,
  Project,
  StableId,
} from "@schema-baron/model";
import { applyBatch, stageBatch } from "../project/index.js";
export type FormConstruction = Extract<
  Command,
  { operation: "form.construct" }
>["input"];
/** Materialize only ordinary entities, then use the same all-or-nothing path as project.batch. */
export function constructForm(original: Project, input: FormConstruction) {
  const spec = operationInputSchemas["form.construct"].parse(input);
  const project = stageBatch(
    original,
    (spec.pendingOperations ?? []) as EntityBatchOperation[],
  );
  const ops: EntityBatchOperation[] = [];
  const pages = new Map(project.pages.map((p) => [p.id, structuredClone(p)]));
  const fail = (objectId: StableId, field: string, message: string): never => {
    throw new ModelValidationError([
      {
        code: "VALIDATION_FAILED",
        severity: "error",
        objectId,
        field,
        message,
      },
    ]);
  };
  const put = <K extends "form" | "control" | "action">(
    entity: K,
    value: K extends "form" ? Form : K extends "control" ? Control : Action,
  ) =>
    ops.push({
      kind: "put",
      entity,
      id: value.id,
      value,
    } as EntityBatchOperation);
  function build(
    pageId: StableId,
    kind: Form["kind"],
    fieldIds: StableId[],
    keyIds: StableId[],
    label: string,
    definitions: Omit<Action, "id" | "formId">[],
  ) {
    const page = pages.get(pageId);
    if (!page) fail(pageId, "pageId", "Choose an existing page.");
    const table =
      spec.source?.kind === "table"
        ? project.schema.tables.find((t) => t.id === spec.source!.id)
        : undefined;
    const query =
      spec.source?.kind === "query"
        ? project.queries.find((q) => q.id === spec.source!.id)
        : undefined;
    if (kind !== "Login" && !table && !query)
      fail(pageId, "source", "Choose an available table or query source.");
    if (kind === "Record" && (!table || !table.primaryKey.length))
      fail(
        pageId,
        "source",
        "Record authoring requires a table with an ordered primary key. Query results are read-only.",
      );
    if (kind !== "Login" && !fieldIds.length)
      fail(pageId, "fieldIds", "Select at least one field.");
    if (new Set(fieldIds).size !== fieldIds.length)
      fail(pageId, "fieldIds", "Select each field once.");
    const fields =
      table?.columns.map((c) => ({ ...c, name: c.physicalName })) ??
      query?.projections ??
      [];
    if (
      fieldIds.some((id) => !fields.some((f) => f.id === id)) ||
      keyIds.some((id) => !fields.some((f) => f.id === id))
    )
      fail(
        pageId,
        "fieldIds",
        "Selected fields and keys must belong to the source.",
      );
    if (
      kind === "Record" &&
      JSON.stringify(keyIds) !== JSON.stringify(table!.primaryKey)
    )
      fail(
        pageId,
        "keyIds",
        "Choose the complete primary key in its declared order.",
      );
    if (
      fieldIds.some(
        (id) => fields.find((f) => f.id === id)?.type.kind === "blob",
      )
    )
      fail(
        pageId,
        "fieldIds",
        "Binary fields have no supported form control. Choose other fields.",
      );
    const form: Form = {
      id: createId(),
      pageId,
      kind,
      ...(kind !== "Login" && spec.source ? { sourceRef: spec.source } : {}),
      keyMapping: keyIds.map((id) => ({
        targetFieldId: id,
        expression: { kind: "field", alias: "root", fieldId: id },
      })),
      controlIds: [],
      actionIds: [],
      search:
        kind === "Search"
          ? (spec.search ??
            fieldIds.map((fieldId) => ({ fieldId, operator: "eq" as const })))
          : (spec.search ?? []),
      sorting: spec.sorting ?? [],
      paging: { pageSize: 20 },
      appearance: { ...spec.style, label },
    };
    for (const id of fieldIds) {
      const field = fields.find((f) => f.id === id)!;
      const generated = table?.columns.find((c) => c.id === id)?.generated;
      const control: Control = {
        id: createId(),
        formId: form.id,
        kind:
          kind === "Grid"
            ? "label"
            : field.type.kind === "boolean"
              ? "checkbox"
              : ["integer", "real", "decimal"].includes(field.type.kind)
                ? "number"
                : ["date", "datetime"].includes(field.type.kind)
                  ? "date"
                  : "text",
        binding: { kind: "stored", fieldId: id },
        readOnly: kind === "Grid" || !!query || !!generated,
        appearance: { label: field.name },
        validation: {
          required:
            kind === "Record" &&
            !field.nullable &&
            !generated &&
            !table?.columns.find((c) => c.id === id)?.default,
        },
        events: [],
      };
      form.controlIds.push(control.id);
      put("control", control);
    }
    if (kind === "Login")
      for (const label of ["Username", "Password"]) {
        const control: Control = {
          id: createId(),
          formId: form.id,
          kind: label === "Username" ? "identity" : "text",
          readOnly: false,
          appearance: { label },
          validation: { required: true },
          events: [],
        };
        form.controlIds.push(control.id);
        put("control", control);
      }
    for (const definition of definitions) {
      const action: Action = { ...definition, id: createId(), formId: form.id };
      form.actionIds.push(action.id);
      put("action", action);
      const control: Control = {
        id: createId(),
        formId: form.id,
        kind: action.operation === "navigate" ? "link" : "button",
        readOnly: false,
        appearance: { label: action.operation },
        validation: { required: false },
        events: [{ event: "click", actionId: action.id }],
      };
      form.controlIds.push(control.id);
      put("control", control);
    }
    page!.formIds.push(form.id);
    page!.document.push({ kind: "form", formId: form.id });
    put("form", form);
    return form;
  }
  const definitions =
    spec.actionDefinitions ??
    spec.actions.map((operation, i) => ({
      operation,
      ...(spec.links[i] ? { destination: spec.links[i] } : {}),
    }));
  const form = build(
    spec.pageId,
    spec.kind,
    spec.fieldIds,
    spec.keyIds,
    spec.style.label ?? spec.kind,
    definitions,
  );
  if (spec.linkedRecord) {
    if (spec.kind !== "Grid")
      fail(
        spec.pageId,
        "linkedRecord",
        "Linked Record construction starts from a Grid.",
      );
    const linked = spec.linkedRecord;
    const record = build(
      linked.pageId,
      "Record",
      linked.fieldIds,
      linked.keyIds,
      linked.label,
      [
        ...(["insert", "update", "delete"] as const).map(operation => ({ operation, success: { pageId: spec.pageId, keyMapping: [], filterMapping: [] } })),
        {
          operation: "cancel",
          destination: {
            pageId: spec.pageId,
            keyMapping: [],
            filterMapping: [],
          },
        },
      ],
    );
    const action: Action = {
      id: createId(),
      formId: form.id,
      operation: "navigate",
      destination: {
        pageId: record.pageId,
        keyMapping: record.keyMapping,
        filterMapping: [],
      },
    };
    form.actionIds.push(action.id);
    put("action", action);
    const control: Control = {
      id: createId(),
      formId: form.id,
      kind: "link",
      readOnly: true,
      appearance: { label: "Edit record" },
      validation: { required: false },
      events: [{ event: "click", actionId: action.id }],
    };
    form.controlIds.push(control.id);
    put("control", control);
    // The linked-record wizard declares an explicit new-record destination too.
    const createAction: Action = { id: createId(), formId: form.id, operation: "navigate", destination: { pageId: record.pageId, keyMapping: [], filterMapping: [] } };
    form.actionIds.push(createAction.id);
    put("action", createAction);
    put("form", form);
  }
  for (const page of pages.values())
    if (
      ops.some(
        (op) =>
          op.entity === "form" &&
          op.kind === "put" &&
          (op.value as Form).pageId === page.id,
      )
    )
      ops.push({ kind: "put", entity: "page", id: page.id, value: page });
  const candidate = applyBatch(original, [
    ...((spec.pendingOperations ?? []) as EntityBatchOperation[]),
    ...ops,
  ]);
  return {
    candidate,
    result: {
      changedIds: [
        form.id,
        ...ops.map((op) => op.id).filter((id) => id !== form.id),
      ],
    },
    changedIds: ops.map((op) => op.id),
  };
}
