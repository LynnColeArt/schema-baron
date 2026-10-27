"use client";
import { ScalarInput, scalarText } from "./scalar.js";
import { useEffect, useRef, useState } from "react";
import {
  createId,
  querySchema,
  validateProject,
  ModelValidationError,
  diagnosticSchema,
} from "@schema-baron/model";
import type {
  Diagnostic,
  Project,
  Query,
  LiteralValue,
} from "@schema-baron/model";
import type { StudioClient } from "../project-ui/api.js";
import { OwnerError } from "../project-ui/api.js";
import {
  blankQuery,
  checkpoint,
  rebase,
  same,
  recoverDraft,
  changeDraft,
  undoDraft,
  redoDraft,
} from "./state.js";
import type { Draft } from "./state.js";
import { TypeEditor } from "./expression.js";
import "./styles.css";
import { QuerySources } from "./sources.js";
import { QueryFields } from "./fields.js";
type Preview = {
  fields: Array<Omit<Query["projections"][number], "expression">>;
  rows: Record<string, unknown>[];
  sql: string;
  truncated: boolean;
};
export function QueryDesigner({
  project,
  client,
  active,
  request,
  onChanged,
  onClose,
  onSelectObject,
}: {
  project: Project;
  client: StudioClient;
  active: boolean;
  request: {
    id: string;
    serial: number;
    parameters?: Record<string, LiteralValue>;
  };
  onChanged: (p: Project) => void;
  onClose: () => void;
  onSelectObject: (id: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [selected, setSelected] = useState(""),
    [views, setViews] = useState<
      Record<
        string,
        {
          tab?: string;
          diagnostics?: Diagnostic[];
          focus?: { label: string; start: number | null; end: number | null };
        }
      >
    >({}),
    [status, setStatus] = useState("Ready"),
    [saving, setSaving] = useState(false),
    [running, setRunning] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [previewInput, setPreviewInput] = useState(""),
    [values, setValues] = useState<Record<string, string>>({}),
    [inputModes, setInputModes] = useState<
      Record<string, "default" | "value" | "null">
    >({}),
    [limits, setLimits] = useState({ rows: 200, timeout: 5000, cost: 100000 });
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const current = useRef({ drafts, selected, project });
  current.current = { drafts, selected, project };
  const tab = views[selected]?.tab ?? "Sources",
    diagnostics = views[selected]?.diagnostics ?? [];
  function setTab(tab: string) {
    setViews((v) => ({
      ...v,
      [current.current.selected]: { ...v[current.current.selected], tab },
    }));
  }
  function setDiagnostics(diagnostics: Diagnostic[]) {
    setViews((v) => ({
      ...v,
      [current.current.selected]: {
        ...v[current.current.selected],
        diagnostics,
      },
    }));
  }
  const saveLock = useRef(false),
    generation = useRef(0);
  const q =
      drafts[selected]?.value ?? project.queries.find((q) => q.id === selected),
    dirty =
      q &&
      !same(
        q,
        project.queries.find((x) => x.id === q.id),
      );
  const previewStale =
    !!preview &&
    previewInput !==
      JSON.stringify({ q, values, inputModes, revision: project.revision });
  const key = `studio.query.${project.id}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        const recovered: Record<string, Draft> = {};
        for (const [id, d] of Object.entries(saved.drafts ?? {})) {
          const issues: string[] = [];
          const item = recoverDraft(d, issues);
          if (issues.length) {
            sessionStorage.setItem(`${key}.unreadable`, raw);
            setStatus(issues.join(" "));
          }
          if (item?.value.id === id)
            recovered[id] = rebase(
              item,
              project.queries.find((q) => q.id === id),
            );
          else {
            sessionStorage.setItem(`${key}.unreadable`, raw);
            setStatus(
              "Some recovery entries are invalid. Their original data is retained separately; valid drafts were recovered.",
            );
          }
        }
        setDrafts(recovered);
        const restoredViews: typeof views = {};
        for (const [id, entry] of Object.entries(saved.views ?? {})) {
          if (!entry || typeof entry !== "object") continue;
          const meta = entry as (typeof views)[string];
          restoredViews[id] = {
            ...(meta.tab &&
            ["Sources", "Fields", "Parameters", "Review"].includes(meta.tab)
              ? { tab: meta.tab }
              : {}),
            ...(Array.isArray(meta.diagnostics)
              ? {
                  diagnostics: meta.diagnostics.flatMap((d) => {
                    const parsed = diagnosticSchema.safeParse(d);
                    return parsed.success ? [parsed.data] : [];
                  }),
                }
              : {}),
            ...(meta.focus &&
            typeof meta.focus.label === "string" &&
            [meta.focus.start, meta.focus.end].every(
              (n) => n === null || Number.isSafeInteger(n),
            )
              ? { focus: meta.focus }
              : {}),
          };
        }
        setViews(restoredViews);
        setPositions(
          Object.fromEntries(
            Object.entries(saved.positions ?? {}).filter(
              ([, v]) =>
                !!v &&
                typeof v === "object" &&
                Number.isFinite((v as { x: number }).x) &&
                Number.isFinite((v as { y: number }).y),
            ),
          ) as Record<string, { x: number; y: number }>,
        );
        setSelected(typeof saved.selected === "string" ? saved.selected : "");
      }
    } catch {
      try {
        const original = sessionStorage.getItem(key);
        if (original) sessionStorage.setItem(`${key}.unreadable`, original);
      } catch {
        /* Storage itself may be unavailable. */
      }
      setStatus(
        "Draft recovery data could not be read. Keep this tab open and save.",
      );
    }
  }, [key]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ drafts, positions, selected, views }),
      );
    } catch {
      setStatus(
        "Draft recovery storage unavailable. Keep this tab open until saved.",
      );
    }
  }, [drafts, positions, selected, views, key]);
  useEffect(() => {
    setDrafts((ds) =>
      Object.fromEntries(
        Object.entries(ds).map(([id, d]) => [
          id,
          rebase(
            d,
            project.queries.find((q) => q.id === id),
          ),
        ]),
      ),
    );
  }, [project]);
  useEffect(() => {
    if (!request.serial) return;
    if (request.id) setSelected(request.id);
    else add();
    setValues(
      Object.fromEntries(
        Object.entries(request.parameters ?? {}).map(([id, value]) => [
          id,
          value === null ? "null" : String(value),
        ]),
      ),
    );
    setInputModes(
      Object.fromEntries(
        Object.entries(request.parameters ?? {}).map(([id, value]) => [
          id,
          value === null ? "null" : "value",
        ]),
      ),
    );
    setPreview(null);
  }, [request.serial]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        Object.values(current.current.drafts).some(
          (d) => !same(d.value, d.base),
        )
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function add() {
    const value = blankQuery();
    setDrafts((ds) => ({ ...ds, [value.id]: { value, conflicts: [] } }));
    setSelected(value.id);
    setPreview(null);
    setViews((v) => ({ ...v, [value.id]: { tab: "Sources" } }));
  }
  useEffect(() => {
    if (!active) return;
    const focus = views[selected]?.focus;
    if (!focus) return;
    const element = Array.from(
      document.querySelectorAll<HTMLElement>(".qd [aria-label]"),
    ).find(
      (e) =>
        e.getAttribute("aria-label") === focus.label &&
        e.getClientRects().length,
    );
    if (!element) return;
    element.focus();
    if (
      element instanceof HTMLInputElement &&
      focus.start !== null &&
      focus.end !== null &&
      element.selectionStart !== null
    )
      element.setSelectionRange(focus.start, focus.end);
  }, [active, selected, tab]);
  function retainFocus(element: EventTarget) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
    )
      return;
    const label = element.getAttribute("aria-label");
    if (!label) return;
    const focus = {
      label,
      start:
        element instanceof HTMLSelectElement ? null : element.selectionStart,
      end: element instanceof HTMLSelectElement ? null : element.selectionEnd,
    };
    setViews((v) => ({
      ...v,
      [current.current.selected]: { ...v[current.current.selected], focus },
    }));
  }
  function update(value: Query) {
    setDrafts((ds) => ({
      ...ds,
      [value.id]: changeDraft(
        ds[value.id],
        project.queries.find((q) => q.id === value.id),
        value,
      ),
    }));
  }
  function history(direction: "undo" | "redo") {
    const available = current.current.drafts[current.current.selected];
    if (
      !available ||
      !(direction === "undo"
        ? available.past?.length
        : available.future?.length)
    )
      return;
    setDrafts((ds) => {
      const id = current.current.selected,
        d = ds[id];
      if (!d) return ds;
      return {
        ...ds,
        [id]: direction === "undo" ? undoDraft(d) : redoDraft(d),
      };
    });
    setStatus(
      direction === "undo"
        ? "Query model edit undone · Draft only until Save"
        : "Query model edit redone · Draft only until Save",
    );
  }
  function fail(e: unknown) {
    setDiagnostics(
      (e instanceof ModelValidationError || e instanceof OwnerError) &&
        e.diagnostics.length
        ? e.diagnostics
        : [
            {
              code: e instanceof OwnerError ? e.code : "VALIDATION_FAILED",
              severity: "error",
              message: e instanceof Error ? e.message : "Request failed",
              objectId: q?.id,
            } as Diagnostic,
          ],
    );
    setStatus("Review the query diagnostics; your draft is retained.");
  }
  async function save() {
    if (saveLock.current) return;
    const state = current.current,
      submitted =
        state.drafts[state.selected]?.value ??
        state.project.queries.find((q) => q.id === state.selected);
    if (!submitted) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const snapshot = await client.snapshot(state.project.id),
        d = rebase(
          state.drafts[state.selected] ?? {
            base: submitted,
            value: submitted,
            conflicts: [],
          },
          snapshot.queries.find((q) => q.id === submitted.id),
        );
      setDrafts((ds) => ({
        ...ds,
        [submitted.id]: rebase(
          ds[submitted.id] ?? d,
          snapshot.queries.find((q) => q.id === submitted.id),
        ),
      }));
      if (d.conflicts.length)
        throw new Error("Resolve conflicting query fields before saving.");
      const parsed = querySchema.safeParse(d.value);
      if (!parsed.success)
        throw new OwnerError(
          "INVALID_INPUT",
          "Complete the query sources, projected fields and expression inputs before saving.",
        );
      const candidate = {
        ...snapshot,
        queries: [
          ...snapshot.queries.filter((q) => q.id !== submitted.id),
          d.value,
        ],
      };
      const checked = validateProject(candidate);
      if (!checked.ok) throw new ModelValidationError(checked.diagnostics);
      await client.batch(
        snapshot,
        [{ kind: "put", entity: "query", id: submitted.id, value: d.value }],
        createId(),
      );
      const saved = await client.snapshot(snapshot.id),
        actual = saved.queries.find((q) => q.id === submitted.id)!;
      setDrafts((ds) => ({
        ...ds,
        [submitted.id]: checkpoint(ds[submitted.id] ?? d, d.value, actual),
      }));
      onChanged(saved);
      setDiagnostics([]);
      setStatus(
        "Query saved. Stable field IDs and dependent bindings retained.",
      );
    } catch (e) {
      fail(e);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!active || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("[contenteditable=true],textarea") ||
          (target instanceof HTMLInputElement &&
            !["checkbox", "radio", "button", "submit", "range"].includes(
              target.type,
            )))
      )
        return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        history(e.shiftKey ? "redo" : "undo");
      }
      if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        history("redo");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active]);
  async function command<T>(
    operation: string,
    input: unknown,
    requestId = createId(),
  ) {
    return client.read<T>(`projects/${project.id}/commands`, {
      requestId,
      operation,
      expectedRevision: current.current.project.revision,
      input,
    });
  }
  async function run() {
    if (!q || running) return;
    const id = createId(),
      token = ++generation.current;
    setRunning(id);
    setPreview(null);
    setDiagnostics([]);
    try {
      const parameters: Record<string, string | number | boolean | null> = {};
      for (const p of q.parameters) {
        const mode = inputModes[p.id] ?? "default";
        if (mode === "default") continue;
        parameters[p.id] =
          mode === "null" ? null : scalarText(values[p.id] ?? "", p.type);
      }
      const result = await command<Preview>(
        "query.preview",
        {
          draft: q,
          parameters,
          rowLimit: limits.rows,
          timeoutMs: limits.timeout,
          maxScannedRows: limits.cost,
        },
        id,
      );
      if (token === generation.current) {
        setPreview(result);
        setPreviewInput(
          JSON.stringify({ q, values, inputModes, revision: project.revision }),
        );
        setStatus(
          result.rows.length
            ? `Preview complete · ${result.rows.length} rows${result.truncated ? " · row limit reached" : ""}`
            : "Preview complete · no matching rows",
        );
      }
    } catch (e) {
      if (token === generation.current) fail(e);
    } finally {
      if (token === generation.current) setRunning("");
    }
  }
  async function cancel() {
    if (!running) return;
    try {
      const job = await command<{ status: string }>("job.cancel", {
        jobId: running,
      });
      setStatus(`Preview job ${job.status}; worker exit confirmed by service.`);
    } catch (e) {
      fail(e);
    }
  }
  return (
    <section
      className="qd"
      aria-label="Data Source query designer"
      onFocusCapture={(e) => retainFocus(e.target)}
      onSelectCapture={(e) => retainFocus(e.target)}
      style={{ display: active ? "grid" : "none" }}
    >
      <header>
        <strong>Data Source</strong>
        <span>{q?.name ?? "Named queries"}</span>
        <button onClick={onClose}>Return to page</button>
      </header>
      <div className="qd-toolbar">
        <button onClick={add}>New query</button>
        <button disabled={!q || saving || !dirty} onClick={() => void save()}>
          Save query
        </button>
        <button
          disabled={!drafts[selected]?.past?.length}
          onClick={() => history("undo")}
          title="Undo query model edit (Ctrl+Z outside text inputs)"
        >
          Undo query
        </button>
        <button
          disabled={!drafts[selected]?.future?.length}
          onClick={() => history("redo")}
          title="Redo query model edit (Ctrl+Shift+Z or Ctrl+Y)"
        >
          Redo query
        </button>
        <button disabled={!q || !!running} onClick={() => void run()}>
          Run preview
        </button>
        <button disabled={!running} onClick={() => void cancel()}>
          Cancel preview
        </button>
        <span role="status">
          {previewStale
            ? status.startsWith("Preview complete")
              ? "Preview out of date · Run preview again"
              : `${status} · Preview out of date · Run preview again`
            : status}
          {dirty ? " · Unsaved query" : ""}
        </span>
      </div>
      <div className="qd-body">
        <aside aria-label="Named queries">
          <h2>Named queries</h2>
          {[
            ...project.queries.filter((q) => !drafts[q.id]),
            ...Object.values(drafts).map((d) => d.value),
          ].map((v) => (
            <button
              key={v.id}
              aria-pressed={selected === v.id}
              onClick={() => {
                setSelected(v.id);
                setPreview(null);
              }}
            >
              {v.name || "Unnamed query"}
              {!same(
                v,
                project.queries.find((q) => q.id === v.id),
              )
                ? " *"
                : ""}
            </button>
          ))}
        </aside>
        <div className="qd-document">
          {q ? (
            <>
              <label>
                Query name
                <input
                  aria-label="Query name"
                  value={q.name}
                  onChange={(e) => update({ ...q, name: e.target.value })}
                />
              </label>
              {drafts[q.id]?.conflicts.length ? (
                <div role="alert">
                  Query changed elsewhere: {drafts[q.id]!.conflicts.join(", ")}
                  <p>
                    Choosing a resolution starts a new query history, so older
                    conflicting snapshots cannot silently reappear.
                  </p>
                  <button
                    onClick={() =>
                      setDrafts((ds) => ({
                        ...ds,
                        [q.id]: {
                          value: q,
                          base: project.queries.find((x) => x.id === q.id),
                          conflicts: [],
                        },
                      }))
                    }
                  >
                    Keep my query
                  </button>
                  <button
                    onClick={() =>
                      setDrafts((ds) => {
                        const next = { ...ds };
                        delete next[q.id];
                        return next;
                      })
                    }
                  >
                    Use service query
                  </button>
                </div>
              ) : null}
              <nav aria-label="Query sections">
                {["Sources", "Fields", "Parameters", "Review"].map((t) => (
                  <button
                    key={t}
                    aria-pressed={tab === t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </nav>
              {tab === "Sources" && (
                <QuerySources
                  q={q}
                  project={project}
                  update={update}
                  positions={positions}
                  setPositions={setPositions}
                />
              )}
              {tab === "Fields" && (
                <QueryFields q={q} project={project} update={update} />
              )}
              {tab === "Parameters" && (
                <>
                  <h2>Typed parameters</h2>
                  <p>
                    No default means required. A nullable parameter may receive
                    an explicit null. Decimal values are exact strings, never
                    floating point conversions.
                  </p>
                  <button
                    onClick={() =>
                      update({
                        ...q,
                        parameters: [
                          ...q.parameters,
                          {
                            id: createId(),
                            name: `parameter${q.parameters.length + 1}`,
                            type: { kind: "integer" },
                            nullable: false,
                          },
                        ],
                      })
                    }
                  >
                    Add parameter
                  </button>
                  {q.parameters.map((p, i) => (
                    <fieldset key={p.id}>
                      <legend>Parameter {i + 1}</legend>
                      <label>
                        Name
                        <input
                          aria-label={`Parameter ${i + 1} name`}
                          value={p.name}
                          onChange={(e) =>
                            update({
                              ...q,
                              parameters: q.parameters.map((x) =>
                                x.id === p.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <TypeEditor
                        label={`Parameter ${i + 1} type`}
                        value={p.type}
                        onChange={(type) =>
                          update({
                            ...q,
                            parameters: q.parameters.map((x) =>
                              x.id === p.id ? { ...x, type } : x,
                            ),
                          })
                        }
                      />
                      <label>
                        <input
                          type="checkbox"
                          checked={p.nullable}
                          onChange={(e) =>
                            update({
                              ...q,
                              parameters: q.parameters.map((x) =>
                                x.id === p.id
                                  ? { ...x, nullable: e.target.checked }
                                  : x,
                              ),
                            })
                          }
                        />
                        Nullable parameter
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={p.default !== undefined}
                          onChange={(e) =>
                            update({
                              ...q,
                              parameters: q.parameters.map((x) => {
                                if (x.id !== p.id) return x;
                                const next = { ...x };
                                if (e.target.checked)
                                  next.default =
                                    p.type.kind === "boolean"
                                      ? false
                                      : ["integer", "real"].includes(
                                            p.type.kind,
                                          )
                                        ? 0
                                        : "";
                                else delete next.default;
                                return next;
                              }),
                            })
                          }
                        />
                        Has default
                      </label>
                      {p.default !== undefined && (
                        <>
                          <label>
                            Default value
                            <ScalarInput
                              label={`Parameter ${i + 1} default`}
                              value={p.default}
                              type={p.type}
                              onChange={(value) =>
                                update({
                                  ...q,
                                  parameters: q.parameters.map((x) =>
                                    x.id === p.id
                                      ? { ...x, default: value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={p.default === null}
                              onChange={(e) =>
                                update({
                                  ...q,
                                  parameters: q.parameters.map((x) =>
                                    x.id === p.id
                                      ? {
                                          ...x,
                                          default: e.target.checked ? null : "",
                                        }
                                      : x,
                                  ),
                                })
                              }
                            />
                            Null default
                          </label>
                        </>
                      )}
                      <label>
                        Preview value (
                        {p.default === undefined
                          ? "required unless nullable explicit null"
                          : "default available"}
                        )
                        <input
                          aria-label={`Parameter ${i + 1} preview value`}
                          value={values[p.id] ?? ""}
                          onChange={(e) => {
                            setValues((v) => ({
                              ...v,
                              [p.id]: e.target.value,
                            }));
                            setInputModes((m) => ({ ...m, [p.id]: "value" }));
                          }}
                        />
                      </label>
                      <label>
                        Preview input mode
                        <select
                          aria-label={`Parameter ${i + 1} preview mode`}
                          value={inputModes[p.id] ?? "default"}
                          onChange={(e) =>
                            setInputModes((m) => ({
                              ...m,
                              [p.id]: e.target.value as
                                | "default"
                                | "value"
                                | "null",
                            }))
                          }
                        >
                          <option value="default">
                            Omit · use default or required error
                          </option>
                          <option value="value">
                            Explicit value (empty text permitted)
                          </option>
                          <option value="null">Explicit null</option>
                        </select>
                      </label>
                      <button
                        onClick={() =>
                          update({
                            ...q,
                            parameters: q.parameters.filter(
                              (x) => x.id !== p.id,
                            ),
                          })
                        }
                      >
                        Remove parameter {i + 1}
                      </button>
                    </fieldset>
                  ))}
                </>
              )}
              {tab === "Review" && (
                <>
                  <h2>Read-only SQL and bounded data</h2>
                  {previewStale && (
                    <p role="status">
                      Preview is from earlier query inputs or revision. Run
                      preview again for current results.
                    </p>
                  )}
                  <label>
                    Row limit
                    <input
                      type="number"
                      min="1"
                      max="200"
                      aria-label="Row limit"
                      value={limits.rows}
                      onChange={(e) =>
                        setLimits((l) => ({
                          ...l,
                          rows: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Timeout ms
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      aria-label="Timeout ms"
                      value={limits.timeout}
                      onChange={(e) =>
                        setLimits((l) => ({
                          ...l,
                          timeout: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <label>
                    Scan cost budget
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      aria-label="Scan cost budget"
                      value={limits.cost}
                      onChange={(e) =>
                        setLimits((l) => ({
                          ...l,
                          cost: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                  <p>
                    SQL is a compiled read-only view; only typed expressions and
                    bound parameters execute. Preview uses at most 200 rows, 5
                    seconds and the configured scan budget.
                  </p>
                  <pre aria-label="Compiled SQL">
                    {preview?.sql ?? "Run preview to inspect compiled SQL."}
                  </pre>
                  {preview && (
                    <>
                      <p>
                        {preview.truncated
                          ? "Result truncated at the row limit."
                          : preview.rows.length
                            ? "All matching rows within limits."
                            : "No matching rows."}
                      </p>
                      <table aria-label="Preview results">
                        <thead>
                          <tr>
                            {preview.fields.map((f) => (
                              <th key={f.id}>
                                {f.name}
                                <small>
                                  {f.type.kind}
                                  {f.nullable ? " · nullable" : ""}
                                </small>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((r, i) => (
                            <tr key={i}>
                              {preview.fields.map((f) => (
                                <td key={f.id}>
                                  {r[f.id] === null
                                    ? "NULL"
                                    : String(r[f.id] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  <h3>Dependent forms</h3>
                  {project.forms
                    .filter(
                      (f) =>
                        f.sourceRef?.kind === "query" &&
                        f.sourceRef.id === q.id,
                    )
                    .map((f) => (
                      <p key={f.id}>
                        {f.appearance.label ?? f.kind} · stable query binding;
                        formatting and key mappings retained.
                      </p>
                    ))}
                  <p>
                    Save validates the whole candidate project. Removing or
                    changing fields used by a control, sort or link is refused
                    with a dependency diagnostic. Bind the saved query to a Grid and configure its typed runtime inputs in Data properties to generate a report.
                  </p>
                </>
              )}
            </>
          ) : (
            <p>
              Select a named query or create one. Add sources, then fields and
              parameters.
            </p>
          )}
        </div>
        <aside aria-label="Query properties">
          <h2>Properties</h2>
          <p>{q?.name ?? "No query selected"}</p>
          <dl>
            <dt>Sources</dt>
            <dd>{q?.sources.length ?? 0}</dd>
            <dt>Result columns</dt>
            <dd>{q?.projections.length ?? 0}</dd>
            <dt>Grain</dt>
            <dd>{q?.grain.strategy ?? "—"}</dd>
          </dl>
          <h2>Messages</h2>
          {diagnostics.length > 0 && (
            <p role="alert">
              This draft needs correction before it can be saved or used for
              dependent output. The committed query remains intact.
            </p>
          )}
          {diagnostics.map((d, i) => (
            <button
              key={i}
              className="qd-diagnostic"
              onClick={() => {
                if (
                  d.objectId &&
                  [
                    ...project.pages,
                    ...project.forms,
                    ...project.controls,
                  ].some((o) => o.id === d.objectId)
                ) {
                  onSelectObject(d.objectId);
                  return;
                }
                setTab(
                  d.field?.includes("source") || d.field?.includes("join")
                    ? "Sources"
                    : d.field?.includes("parameter")
                      ? "Parameters"
                      : "Fields",
                );
                setTimeout(() => {
                  const exact = document.getElementById(
                    `query-field-${d.objectId}`,
                  );
                  const section = document.querySelector<HTMLElement>(
                    d.field?.includes("source") || d.field?.includes("join")
                      ? ".qd-canvas"
                      : d.field?.includes("parameter")
                        ? ".qd-document fieldset"
                        : ".qd-document h2",
                  );
                  const target = exact ?? section;
                  if (target) {
                    target.tabIndex = -1;
                    target.scrollIntoView({ block: "center" });
                    target.focus();
                  }
                }, 0);
              }}
            >
              <strong>{d.code}</strong>
              <span>{d.message}</span>
              {d.field && <small>{d.field}</small>}
            </button>
          ))}
          {!diagnostics.length && <p>No query diagnostics.</p>}
        </aside>
      </div>
    </section>
  );
}
