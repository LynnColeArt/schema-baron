"use client";
import {DerivedBinding} from "../report-bindings/derived.js";
import { useState } from "react";
import { createId } from "@schema-baron/model";
import type {
  Action,
  Control,
  Form,
  Project,
  StableId,
  ScalarType,
} from "@schema-baron/model";
import type { Command } from "@schema-baron/model";
import "./styles.css";
import { completeScalar } from "./scalars.js";
import type { ScalarBuffers, ScalarBuffer } from "./scalars.js";
type Construction = Extract<Command, { operation: "form.construct" }>["input"];
const sid = (s: string) => createId(() => s);
export function sourceFields(
  project: Project,
  source: Form["sourceRef"],
): {
  id: StableId;
  name: string;
  type: ScalarType;
  nullable: boolean;
  generated?: unknown;
}[] {
  return source?.kind === "table"
    ? (project.schema.tables
        .find((t) => t.id === source.id)
        ?.columns.map((c) => ({ ...c, name: c.physicalName })) ?? [])
    : (project.queries.find((q) => q.id === source?.id)?.projections ?? []);
}
export function FormWizard({
  project,
  pageId,
  onCancel,
  onFinish,
}: {
  project: Project;
  pageId: StableId;
  onCancel: () => void;
  onFinish: (input: Construction) => Promise<void>;
}) {
  const [step, setStep] = useState(0),
    [kind, setKind] = useState<Form["kind"]>("Grid"),
    [name, setName] = useState(""),
    [source, setSource] = useState(""),
    [fields, setFields] = useState<StableId[]>([]),
    [keys, setKeys] = useState<StableId[]>([]),
    [actions, setActions] = useState<Action["operation"][]>([]),
    [success, setSuccess] = useState(""),
    [cancel, setCancel] = useState(""),
    [linked, setLinked] = useState(""),
    [search, setSearch] = useState<Form["search"]>([]),
    [sort, setSort] = useState<Form["sorting"]>([]),
    [className, setClass] = useState(""),
    [format, setFormat] =
      useState<NonNullable<Form["appearance"]["format"]>>("plain"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const sourceRef = source
    ? {
        kind: source.startsWith("table:")
          ? ("table" as const)
          : ("query" as const),
        id: sid(source.slice(source.indexOf(":") + 1)),
      }
    : undefined;
  const available = sourceFields(project, sourceRef),
    table = project.schema.tables.find((t) => t.id === sourceRef?.id);
  const toggle = (list: StableId[], id: StableId) =>
    list.includes(id) ? list.filter((v) => v !== id) : [...list, id];
  const destination = (id: string) => ({
    pageId: sid(id),
    keyMapping: [],
    filterMapping: [],
  });
  const steps = [
    "Source",
    "Fields and ordered keys",
    "Actions and links",
    "Search and sorting",
    "Appearance",
  ];
  async function finish() {
    setBusy(true);
    setError("");
    try {
      await onFinish({
        pageId,
        kind,
        ...(kind !== "Login" && sourceRef ? { source: sourceRef } : {}),
        fieldIds: kind === "Login" ? [] : fields,
        keyIds: kind === "Login" ? [] : keys,
        actions: [],
        links: [],
        style: { label: name, className, format },
        search: kind === "Login" ? [] : search,
        sorting: kind === "Login" ? [] : sort,
        actionDefinitions: actions.map((operation) => ({
          operation,
          ...(operation === "navigate" && success
            ? { destination: destination(success) }
            : {}),
          ...(success ? { success: destination(success) } : {}),
          ...(cancel ? { cancel: destination(cancel) } : {}),
          ...(operation === "cancel" && cancel
            ? { destination: destination(cancel) }
            : {}),
        })),
        ...(linked
          ? {
              linkedRecord: {
                pageId: sid(linked),
                label: `${name} record`,
                fieldIds: fields,
                keyIds: keys,
              },
            }
          : {}),
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? "diagnostics" in e &&
            Array.isArray(e.diagnostics) &&
            e.diagnostics.length
            ? e.diagnostics
                .map(
                  (d: { field?: string; message: string }) =>
                    `${d.field ?? "Form"}: ${d.message}`,
                )
                .join(" ")
            : e.message
          : "Construction failed. Your choices are retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="form-wizard"
      onSubmit={(e) => {
        e.preventDefault();
        if (step < 4) setStep(step + 1);
        else void finish();
      }}
    >
      <nav aria-label="Construction steps">
        {steps.map((label, i) => (
          <button
            type="button"
            key={label}
            aria-current={step === i ? "step" : undefined}
            onClick={() => setStep(i)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </nav>
      <div className="wizard-body">
        <h3 tabIndex={-1}>
          {step + 1}. {steps[step]}
        </h3>
        {step === 0 && (
          <>
            <label className="dialog-field">
              Form label
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="dialog-field">
              Form kind
              <select
                aria-label="Form kind"
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as Form["kind"];
                  setKind(k);
                  setLinked("");
                  setActions(
                    k === "Record"
                      ? ["insert", "update", "delete", "cancel"]
                      : k === "Search"
                        ? ["search"]
                        : k === "Login"
                          ? ["login", "cancel"]
                          : [],
                  );
                }}
              >
                {["Grid", "Record", "Search", "Login"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            {kind !== "Login" ? (
              <label className="dialog-field">
                Data source
                <select
                  aria-label="Data source"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setFields([]);
                    setKeys([]);
                    setSearch([]);
                    setSort([]);
                  }}
                >
                  <option value="">Choose source</option>
                  {project.schema.tables.map((t) => (
                    <option key={t.id} value={`table:${t.id}`}>
                      Table: {t.physicalName}
                    </option>
                  ))}
                  {project.queries.map((q) => (
                    <option key={q.id} value={`query:${q.id}`}>
                      Query: {q.name} (read-only)
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>
                Construct Login actions only. Authentication configuration is
                provided separately. No credentials are requested or retained.
              </p>
            )}
          </>
        )}
        {step === 1 && (
          <>
            {kind === "Login" ? (
              <p>Login has no business-table binding.</p>
            ) : (
              <>
                <fieldset>
                  <legend>Fields, in selection order</legend>
                  {available.map((f) => (
                    <label className="wizard-check" key={f.id}>
                      <input
                        type="checkbox"
                        checked={fields.includes(f.id)}
                        onChange={() => setFields(toggle(fields, f.id))}
                      />
                      {f.name} · {f.type.kind}
                      {"generated" in f && f.generated
                        ? " · derived/read-only"
                        : ""}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Ordered key tuple</legend>
                  <p>
                    Declared primary key:{" "}
                    {table?.primaryKey
                      .map((id) => available.find((f) => f.id === id)?.name)
                      .join(" → ") || "No table key"}
                  </p>
                  {available.map((f) => (
                    <label className="wizard-check" key={f.id}>
                      <input
                        type="checkbox"
                        checked={keys.includes(f.id)}
                        onChange={() => setKeys(toggle(keys, f.id))}
                      />
                      {f.name}
                      {keys.includes(f.id)
                        ? ` (${keys.indexOf(f.id) + 1})`
                        : ""}
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => setKeys([...(table?.primaryKey ?? [])])}
                  >
                    Use complete primary key
                  </button>
                  <span className="form-summary">
                    {keys
                      .map((id) => available.find((f) => f.id === id)?.name)
                      .join(" → ")}
                  </span>
                </fieldset>
              </>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <fieldset>
              <legend>Declared actions</legend>
              {(
                [
                  "insert",
                  "update",
                  "delete",
                  "navigate",
                  "search",
                  "login",
                  "logout",
                  "cancel",
                ] as const
              ).map((op) => (
                <label className="wizard-check" key={op}>
                  <input
                    type="checkbox"
                    checked={actions.includes(op)}
                    onChange={() =>
                      setActions(
                        actions.includes(op)
                          ? actions.filter((a) => a !== op)
                          : [...actions, op],
                      )
                    }
                  />
                  {op}
                </label>
              ))}
            </fieldset>
            {(
              [
                ["Success / navigation destination", success, setSuccess],
                ["Cancel destination", cancel, setCancel],
                ...(kind === "Grid"
                  ? [["Linked Record page", linked, setLinked]]
                  : []),
              ] as [string, string, (s: string) => void][]
            ).map(([label, value, update]) => (
              <label key={label} className="dialog-field">
                {label}
                <select
                  aria-label={label}
                  value={value}
                  onChange={(e) => update(e.target.value)}
                >
                  <option value="">None</option>
                  {project.pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · {p.route}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {linked && (
              <p>
                Creates a Record on the selected page and an Edit link carrying
                the complete ordered key tuple. Record mutations are authored
                declarations; runtime support follows separately.
              </p>
            )}
          </>
        )}
        {step === 3 && (
          <>
            {available
              .filter((f) => fields.includes(f.id))
              .map((f) => (
                <div className="wizard-options" key={f.id}>
                  <span>{f.name}</span>
                  <label>
                    Search operator
                    <select
                      aria-label={`Search ${f.name}`}
                      value={
                        search.find((s) => s.fieldId === f.id)?.operator ?? ""
                      }
                      onChange={(e) =>
                        setSearch([
                          ...search.filter((s) => s.fieldId !== f.id),
                          ...(e.target.value
                            ? [
                                {
                                  fieldId: f.id,
                                  operator: e.target.value as "eq",
                                },
                              ]
                            : []),
                        ])
                      }
                    >
                      <option value="">No filter</option>
                      {["eq", "contains", "gte", "lte"].map((op) => (
                        <option key={op}>{op}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sort
                    <select
                      aria-label={`Sort ${f.name}`}
                      value={
                        sort.find((s) => s.fieldId === f.id)?.direction ?? ""
                      }
                      onChange={(e) =>
                        setSort([
                          ...sort.filter((s) => s.fieldId !== f.id),
                          ...(e.target.value
                            ? [
                                {
                                  fieldId: f.id,
                                  direction: e.target.value as "asc",
                                },
                              ]
                            : []),
                        ])
                      }
                    >
                      <option value="">Unsorted</option>
                      <option>asc</option>
                      <option>desc</option>
                    </select>
                  </label>
                </div>
              ))}
          </>
        )}
        {step === 4 && (
          <>
            <label className="dialog-field">
              CSS class
              <input
                value={className}
                onChange={(e) => setClass(e.target.value)}
              />
            </label>
            <label className="dialog-field">
              Display format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
              >
                {["plain", "decimal", "currency", "date", "datetime"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
            <p>
              {kind} · {name || "(label required)"} · {fields.length} selected
              fields · {actions.length} actions
            </p>
            <p>
              Finish constructs the required page and all form objects
              atomically, closes this wizard and selects the editable form.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="dialog-error">
            {error}
          </p>
        )}
      </div>
      <footer className="dialog-actions">
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || step === 0}
          onClick={() => setStep(step - 1)}
        >
          Back
        </button>
        <button
          className="primary"
          disabled={busy || (step === 4 && !name.trim())}
        >
          {busy ? "Constructing…" : step === 4 ? "Finish" : "Next"}
        </button>
      </footer>
    </form>
  );
}
export function FormProperties({
  project,
  value,
  kind,
  tab,
  onChange,
  buffers,
  onScalar,
}: {
  project: Project;
  value: Form | Control;
  kind: "form" | "control";
  tab: string;
  onChange: (changes: import("../workspace/state.js").Change[]) => void;
  buffers: ScalarBuffers;
  onScalar: (key: string, buffer: ScalarBuffer) => void;
}) {
  const form =
    kind === "form"
      ? (value as Form)
      : project.forms.find((f) => f.id === (value as Control).formId)!;
  const fields = sourceFields(project, form.sourceRef);
  const update = (next: Form | Control) =>
    onChange([{ entity: kind, value: next }]);
  const text = (
    label: string,
    current: string,
    change: (v: string) => void,
  ) => (
    <label className="property-row" key={label}>
      <span>{label}</span>
      <input
        aria-label={label}
        value={current}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
  const numeric = (
    name: string,
    current: number | undefined,
    change: (v: number | undefined) => void,
    optional = true,
  ) => {
    const key = `${value.id}:${name}`;
    const rules = {
      optional,
      ...(name === "Width" || name === "maxLength" ? { positive: true } : {}),
      ...(name === "maxLength" ? { integer: true } : {}),
      ...(name === "Page size" ? { integer: true, min: 1, max: 200 } : {}),
    };
    const stored = buffers[key];
    const buffer =
      stored &&
      (!completeScalar(stored) ||
        (stored.text === "" ? undefined : Number(stored.text)) === current)
        ? stored
        : { text: current === undefined ? "" : String(current), ...rules };
    return (
      <label className="property-row" key={name}>
        <span>{name}</span>
        <span>
          <input
            aria-label={name}
            inputMode="decimal"
            value={buffer.text}
            maxLength={128}
            aria-invalid={!completeScalar(buffer)}
            onChange={(e) => {
              const next = { text: e.target.value, ...rules };
              onScalar(key, next);
              if (completeScalar(next))
                change(next.text === "" ? undefined : Number(next.text));
            }}
          />
          {!completeScalar(buffer) && (
            <span role="alert" className="scalar-error">
              {name}:{" "}
              {rules.positive
                ? "Enter a positive number"
                : rules.min !== undefined
                  ? "Enter a whole number from 1 to 200"
                  : "Complete the numeric value"}
              .
            </span>
          )}
        </span>
      </label>
    );
  };
  const choice = (
    label: string,
    current: string,
    values: { value: string; label: string }[],
    change: (v: string) => void,
  ) => (
    <label className="property-row" key={label}>
      <span>{label}</span>
      <select
        aria-label={label}
        value={current}
        onChange={(e) => change(e.target.value)}
      >
        {values.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
  const destinationEditor = (
    action: Action,
    slot: "destination" | "success" | "cancel",
  ) => {
    const dest = action[slot];
    const targetFields = project.forms
      .filter((f) => f.pageId === dest?.pageId)
      .flatMap((f) => sourceFields(project, f.sourceRef))
      .filter((f, i, all) => all.findIndex((a) => a.id === f.id) === i);
    const put = (next: Action) => onChange([{ entity: "action", value: next }]);
    return (
      <fieldset key={slot}>
        <legend>{slot}</legend>
        {choice(
          `${action.operation} ${slot} page`,
          dest?.pageId ?? "",
          [
            { value: "", label: "None" },
            ...project.pages.map((p) => ({
              value: p.id,
              label: `${p.title} · ${p.route}`,
            })),
          ],
          (id) => {
            const next = { ...action };
            if (id)
              next[slot] = {
                pageId: sid(id),
                keyMapping: [],
                filterMapping: [],
              };
            else delete next[slot];
            put(next);
          },
        )}
        {dest &&
          (["keyMapping", "filterMapping"] as const).map((mapping) => (
            <div className="mapping" key={mapping}>
              <strong>
                {mapping === "keyMapping" ? "Ordered keys" : "Child filters"}
              </strong>
              {dest[mapping].map((m, i) => (
                <div key={i}>
                  {choice(
                    `${action.operation} ${slot} ${mapping} target ${i + 1}`,
                    m.targetFieldId,
                    targetFields.map((f) => ({ value: f.id, label: f.name })),
                    (id) =>
                      put({
                        ...action,
                        [slot]: {
                          ...dest,
                          [mapping]: dest[mapping].map((v, j) =>
                            i === j ? { ...v, targetFieldId: sid(id) } : v,
                          ),
                        },
                      }),
                  )}
                  {choice(
                    `${action.operation} ${slot} ${mapping} source ${i + 1}`,
                    m.expression.kind === "field" ? m.expression.fieldId : "",
                    fields.map((f) => ({
                      value: f.id,
                      label: `${f.name} · ${f.type.kind}`,
                    })),
                    (id) =>
                      put({
                        ...action,
                        [slot]: {
                          ...dest,
                          [mapping]: dest[mapping].map((v, j) =>
                            i === j
                              ? {
                                  ...v,
                                  expression: {
                                    kind: "field",
                                    alias: "root",
                                    fieldId: sid(id),
                                  },
                                }
                              : v,
                          ),
                        },
                      }),
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      put({
                        ...action,
                        [slot]: {
                          ...dest,
                          [mapping]: dest[mapping].filter((_, j) => j !== i),
                        },
                      })
                    }
                  >
                    Remove mapping {i + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={!fields.length || !targetFields.length}
                onClick={() => {
                  if (fields[0] && targetFields[0])
                    put({
                      ...action,
                      [slot]: {
                        ...dest,
                        [mapping]: [
                          ...dest[mapping],
                          {
                            targetFieldId: targetFields[0].id,
                            expression: {
                              kind: "field",
                              alias: "root",
                              fieldId: fields[0].id,
                            },
                          },
                        ],
                      },
                    });
                }}
              >
                Add {mapping === "keyMapping" ? "key" : "filter"} mapping
              </button>
            </div>
          ))}
      </fieldset>
    );
  };
  if (tab === "Format")
    return (
      <div className="form-properties">
        {text("Label", value.appearance.label ?? "", (label) =>
          update({ ...value, appearance: { ...value.appearance, label } }),
        )}
        {text("CSS class", value.appearance.className ?? "", (className) =>
          update({ ...value, appearance: { ...value.appearance, className } }),
        )}
        {numeric("Width", value.appearance.width, (width) => {
          const appearance = { ...value.appearance };
          if (width === undefined) delete appearance.width;
          else appearance.width = width;
          update({ ...value, appearance });
        })}
        {choice(
          "Display format",
          value.appearance.format ?? "plain",
          ["plain", "decimal", "currency", "date", "datetime"].map((v) => ({
            value: v,
            label: v,
          })),
          (format) =>
            update({
              ...value,
              appearance: { ...value.appearance, format: format as "plain" },
            }),
        )}
        <div className="property-row">
          <span>Kind</span>
          <span>{value.kind}</span>
        </div>
        <span className="form-summary">{value.id}</span>
      </div>
    );
  if (kind === "form")
    return (
      <div className="form-properties">
        {form.kind === "Record" && <fieldset><legend>Record name fields for delete confirmation</legend>{sourceFields(project, form.sourceRef).map(field => <label key={field.id}><input type="checkbox" checked={form.displayFieldIds?.includes(field.id) ?? false} onChange={event => update({ ...form, displayFieldIds: event.target.checked ? [...(form.displayFieldIds ?? []), field.id] : (form.displayFieldIds ?? []).filter(id => id !== field.id) })} />{field.name}</label>)}</fieldset>}
        {choice(
          "Data source",
          form.sourceRef ? `${form.sourceRef.kind}:${form.sourceRef.id}` : "",
          [
            { value: "", label: "None" },
            ...project.schema.tables.map((t) => ({
              value: `table:${t.id}`,
              label: `Table: ${t.physicalName}`,
            })),
            ...project.queries.map((q) => ({
              value: `query:${q.id}`,
              label: `Query: ${q.name} (read-only)`,
            })),
          ],
          (v) => {
            const next = { ...form };
            if (v) {
              const [sourceKind, ...idParts] = v.split(":");
              next.sourceRef = {
                kind: sourceKind as "table" | "query",
                id: sid(idParts.join(":")),
              };
            } else delete next.sourceRef;
            update(next);
          },
        )}
        <fieldset>
          <legend>Ordered key tuple</legend>
          <span className="form-summary">
            {form.keyMapping
              .map((m) => fields.find((f) => f.id === m.targetFieldId)?.name)
              .join(" → ") || "None"}
          </span>
          {fields.map((f) => (
            <label className="wizard-check" key={f.id}>
              <input
                type="checkbox"
                checked={form.keyMapping.some((k) => k.targetFieldId === f.id)}
                onChange={() =>
                  update({
                    ...form,
                    keyMapping: form.keyMapping.some(
                      (k) => k.targetFieldId === f.id,
                    )
                      ? form.keyMapping.filter((k) => k.targetFieldId !== f.id)
                      : [
                          ...form.keyMapping,
                          {
                            targetFieldId: f.id,
                            expression: {
                              kind: "field",
                              alias: "root",
                              fieldId: f.id,
                            },
                          },
                        ],
                  })
                }
              />
              {f.name}
            </label>
          ))}
        </fieldset>
        {form.kind === "Grid" &&
          numeric(
            "Page size",
            form.paging.pageSize,
            (n) => update({ ...form, paging: { pageSize: n ?? 0 } }),
            false,
          )}
        <fieldset>
          <legend>Search and sorting</legend>
          {fields.map((f) => (
            <div key={f.id}>
              {choice(
                `Search ${f.name}`,
                form.search.find((s) => s.fieldId === f.id)?.operator ?? "",
                [
                  { value: "", label: "No filter" },
                  ...["eq", "contains", "gte", "lte"].map((v) => ({
                    value: v,
                    label: v,
                  })),
                ],
                (op) =>
                  update({
                    ...form,
                    search: [
                      ...form.search.filter((s) => s.fieldId !== f.id),
                      ...(op ? [{ fieldId: f.id, operator: op as "eq" }] : []),
                    ],
                  }),
              )}
              {choice(
                `Sort ${f.name}`,
                form.sorting.find((s) => s.fieldId === f.id)?.direction ?? "",
                [
                  { value: "", label: "Unsorted" },
                  ...["asc", "desc"].map((v) => ({ value: v, label: v })),
                ],
                (direction) =>
                  update({
                    ...form,
                    sorting: [
                      ...form.sorting.filter((s) => s.fieldId !== f.id),
                      ...(direction
                        ? [{ fieldId: f.id, direction: direction as "asc" }]
                        : []),
                    ],
                  }),
              )}
            </div>
          ))}
        </fieldset>
        {form.actionIds.map((id) => {
          const action = project.actions.find((a) => a.id === id);
          const supportsHook = form.kind === "Record" && action && ["insert", "update", "delete", "extension"].includes(action.operation);
          return action ? (
            <fieldset key={id}>
              <legend>Action: {action.operation}</legend>
              {choice(
                `${action.operation} operation`,
                action.operation,
                [
                  "insert",
                  "update",
                  "delete",
                  "navigate",
                  "search",
                  "login",
                  "logout",
                  "cancel",
                  "extension",
                ].map((v) => ({ value: v, label: v })),
                (operation) =>
                  onChange([
                    {
                      entity: "action",
                      value: {
                        ...action,
                        operation: operation as Action["operation"],
                      },
                    },
                  ]),
              )}
              {choice(
                `${action.operation} source hook`,
                action.extensionHookRef ?? "",
                [
                  { value: "", label: "None" },
                  ...project.extensionContracts
                    .filter(
                      (e) => (supportsHook && e.kind === "action") || e.id === action.extensionHookRef,
                    )
                    .map((e) => ({ value: e.id, label: supportsHook && e.kind === "action" ? e.relativePath : `Unsupported binding: ${e.relativePath}` })),
                ],
                (id) => {
                  const next = { ...action };
                  if (id) next.extensionHookRef = sid(id);
                  else delete next.extensionHookRef;
                  onChange([{ entity: "action", value: next }]);
                },
              )}
              {!supportsHook && <small>Source hooks require a Record write or extension action. Cancel never invokes hooks; select None to remove an unsupported binding.</small>}
              {(["destination", "success", "cancel"] as const).map((slot) =>
                destinationEditor(action, slot),
              )}
            </fieldset>
          ) : null;
        })}
        <button
          type="button"
          onClick={() => {
            const action: Action = {
              id: createId(),
              formId: form.id,
              operation:
                form.kind === "Search"
                  ? "search"
                  : form.kind === "Login"
                    ? "login"
                    : "cancel",
            };
            onChange([
              {
                entity: "form",
                value: { ...form, actionIds: [...form.actionIds, action.id] },
              },
              { entity: "action", value: action },
            ]);
          }}
        >
          Add action
        </button>
        <p>
          Actions are declarations. Record writes and authentication runtime are
          implemented in their separate slices.
        </p>
      </div>
    );
  const control = value as Control;
  if (tab === "Events")
    return (
      <div className="form-properties">
        {!control.events.length && <p>No events assigned.</p>}
        {control.events.map((event, i) => (
          <fieldset key={i}>
            <legend>Event {i + 1}</legend>
            {choice(
              `Event ${i + 1}`,
              event.event,
              ["click", "change", "submit"].map((v) => ({
                value: v,
                label: v,
              })),
              (name) =>
                update({
                  ...control,
                  events: control.events.map((e, j) =>
                    i === j ? { ...e, event: name as "click" } : e,
                  ),
                }),
            )}
            {choice(
              `Event action ${i + 1}`,
              event.actionId,
              project.actions
                .filter((a) => a.formId === form.id)
                .map((a) => ({ value: a.id, label: a.operation })),
              (id) =>
                update({
                  ...control,
                  events: control.events.map((e, j) =>
                    i === j ? { ...e, actionId: sid(id) } : e,
                  ),
                }),
            )}
            <button
              type="button"
              onClick={() =>
                update({
                  ...control,
                  events: control.events.filter((_, j) => j !== i),
                })
              }
            >
              Remove event
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={!form.actionIds[0]}
          onClick={() =>
            form.actionIds[0] &&
            update({
              ...control,
              events: [
                ...control.events,
                { event: "click", actionId: form.actionIds[0] },
              ],
            })
          }
        >
          Add event
        </button>
      </div>
    );
  const bound =
    control.binding?.kind === "stored"
      ? fields.find(
          (f) => f.id === (control.binding as { fieldId: string }).fieldId,
        )
      : undefined;
  const column = project.schema.tables
    .flatMap((t) => t.columns)
    .find((c) => c.id === bound?.id);
  return (
    <div className="form-properties">
      {choice(
        "Control type",
        control.kind,
        [
          "label",
          "text",
          "number",
          "date",
          "checkbox",
          "select",
          "link",
          "button",
        ].map((v) => ({ value: v, label: v })),
        (k) => update({ ...control, kind: k as Control["kind"] }),
      )}
      {choice(
        "Bound field",
        control.binding?.kind === "stored" ? control.binding.fieldId : "",
        [
          {
            value: "",
            label:
              control.binding?.kind === "derived"
                ? "Derived expression (read-only)"
                : "Unbound",
          },
          ...fields.map((f) => ({
            value: f.id,
            label: `${f.name} · ${f.type.kind}`,
          })),
        ],
        (id) => {
          const next = { ...control };
          if (id) {
            next.binding = { kind: "stored", fieldId: sid(id) };
            const col = project.schema.tables
              .flatMap((t) => t.columns)
              .find((c) => c.id === id);
            next.readOnly =
              !!col?.generated ||
              form.sourceRef?.kind === "query" ||
              control.kind === "label";
          } else delete next.binding;
          update(next);
        },
      )}
      <DerivedBinding project={project} form={form} control={control} onChange={update} />
      {bound && (
        <p>
          Type: {bound.type.kind} ·{" "}
          {bound.nullable ? "nullable" : "not nullable"}
          <br />
          Column default:{" "}
          {column?.default ? JSON.stringify(column.default) : "none"}
          {column?.generated ? " · derived, read-only" : ""}
        </p>
      )}
      {control.binding?.kind === "derived" && (
        <p>
          Derived binding · read-only · dependencies{" "}
          {control.binding.sourceDependencies.join(", ")}
        </p>
      )}
      {(["readOnly", "required"] as const).map((prop) => (
        <label className="property-row" key={prop}>
          <span>{prop === "readOnly" ? "Read only" : "Required"}</span>
          <input
            type="checkbox"
            aria-label={prop === "readOnly" ? "Read only" : "Required"}
            checked={
              prop === "readOnly"
                ? control.readOnly
                : control.validation.required
            }
            onChange={(e) =>
              update(
                prop === "readOnly"
                  ? { ...control, readOnly: e.target.checked }
                  : {
                      ...control,
                      validation: {
                        ...control.validation,
                        required: e.target.checked,
                      },
                    },
              )
            }
          />
        </label>
      ))}
      {(["min", "max", "maxLength"] as const).map((prop) =>
        numeric(prop, control.validation[prop], (n) => {
          const validation = { ...control.validation };
          if (n === undefined) delete validation[prop];
          else validation[prop] = n;
          update({ ...control, validation });
        }),
      )}
      {choice(
        "Lookup relationship",
        control.lookup?.source.id ?? "",
        [
          { value: "", label: "None" },
          ...project.schema.tables.flatMap((t) =>
            t.id === form.sourceRef?.id
              ? t.foreignKeys.map((fk) => ({
                  value: fk.referencedTableId,
                  label: `${fk.columnIds.map((id) => fields.find((f) => f.id === id)?.name).join(" + ")} → ${project.schema.tables.find((v) => v.id === fk.referencedTableId)?.physicalName}`,
                }))
              : [],
          ),
        ],
        (id) => {
          const next = { ...control };
          if (!id) delete next.lookup;
          else {
            const fk = project.schema.tables
              .find((t) => t.id === form.sourceRef?.id)
              ?.foreignKeys.find((f) => f.referencedTableId === id);
            const target = project.schema.tables.find((t) => t.id === id);
            if (fk && target?.columns[0]) {
              next.kind = "select";
              next.lookup = {
                source: { kind: "table", id: sid(id) },
                valueFieldIds: fk.referencedColumnIds,
                labelFieldId:
                  target.columns.find((c) => c.type.kind === "text")?.id ??
                  target.columns[0].id,
              };
            }
          }
          update(next);
        },
      )}
      {choice(
        "Lookup source",
        control.lookup
          ? `${control.lookup.source.kind}:${control.lookup.source.id}`
          : "",
        [
          { value: "", label: "None" },
          ...project.schema.tables.map((t) => ({
            value: `table:${t.id}`,
            label: t.physicalName,
          })),
          ...project.queries.map((q) => ({
            value: `query:${q.id}`,
            label: q.name,
          })),
        ],
        (v) => {
          const next = { ...control };
          if (!v) delete next.lookup;
          else {
            const [k, ...parts] = v.split(":");
            const source = {
              kind: k as "table" | "query",
              id: sid(parts.join(":")),
            };
            const target = sourceFields(project, source);
            if (target[0]) {
              next.kind = "select";
              next.lookup = {
                source,
                valueFieldIds: [target[0].id],
                labelFieldId: target[0].id,
              };
            }
          }
          update(next);
        },
      )}
      {control.lookup && (
        <fieldset>
          <legend>Lookup fields</legend>
          <span className="form-summary">
            Ordered value tuple:{" "}
            {control.lookup.valueFieldIds
              .map(
                (id) =>
                  sourceFields(project, control.lookup!.source).find(
                    (f) => f.id === id,
                  )?.name,
              )
              .join(" → ")}
          </span>
          {sourceFields(project, control.lookup.source).map((f) => (
            <label key={f.id} className="wizard-check">
              <input
                type="checkbox"
                checked={control.lookup!.valueFieldIds.includes(f.id)}
                onChange={() =>
                  update({
                    ...control,
                    lookup: {
                      ...control.lookup!,
                      valueFieldIds: control.lookup!.valueFieldIds.includes(
                        f.id,
                      )
                        ? control.lookup!.valueFieldIds.filter(
                            (id) => id !== f.id,
                          )
                        : [...control.lookup!.valueFieldIds, f.id],
                    },
                  })
                }
              />
              {f.name} · {f.type.kind}
            </label>
          ))}
          {choice(
            "Lookup label field",
            control.lookup.labelFieldId,
            sourceFields(project, control.lookup.source).map((f) => ({
              value: f.id,
              label: f.name,
            })),
            (id) =>
              update({
                ...control,
                lookup: { ...control.lookup!, labelFieldId: sid(id) },
              }),
          )}
        </fieldset>
      )}
    </div>
  );
}
