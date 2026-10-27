"use client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { createId } from "@schema-baron/model";
import type { Control, Form, Page, Project, LiteralValue } from "@schema-baron/model";
import { StudioClient, OwnerError } from "../project-ui/api.js";
import type { Capabilities, Summary } from "../project-ui/api.js";
import {
  incompleteScalars,
  scalarIssues,
  scalarObjectId,
  completeScalar as completeScalarForPage,
} from "../forms/scalars.js";
import { FormWizard, FormProperties } from "../forms/index.js";
import { GenerationReview } from "../generation/index.js";
import { SecurityEditor } from "../security-editor/index.js";
import { MigrationHistory } from "../migration-history/index.js";
import { QueryBinding } from "../query-designer/binding.js";
import { QueryDesigner } from "../query-designer/index.js";
import { SchemaEditor } from "../schema-editor/index.js";
import { ConnectionSetup } from "../connections/index.js";
import { Dialog, Splitter, Tabs } from "./chrome.js";
import {
  afterSave,
  afterConstruction,
  edit,
  initialEditor,
  initialView,
  operations,
  reconcile,
  redo,
  resolveDraft,
  undo,
  visible,
} from "./state.js";
import type { Change, Editor, Kind, ObjectValue, View } from "./state.js";
import { restore, retain } from "./session.js";

type Modal =
  | "connect"
  | "new"
  | "open"
  | "page"
  | "form"
  | "security"
  | "settings"
  | "connection"
  | "generation"
  | "history"
  | "close"
  | null;
type Message = {
  code: string;
  message: string;
  objectId?: string | undefined;
  field?: string | undefined;
};
const label = (kind: Kind, value: ObjectValue) =>
  kind === "page"
    ? (value as Page).title
    : (value as Form | Control).appearance.label ||
      (value as Form | Control).kind;
export default function Workspace() {
  const [schemaActive, setSchemaActive] = useState(false);
  const [queryActive, setQueryActive] = useState(false);
  const [queryRequest, setQueryRequest] = useState<{id:string;serial:number;parameters?:Record<string,LiteralValue>}>({id:"",serial:0});
  function openQuery(id="",parameters?:Record<string,LiteralValue>) { setSchemaActive(false); setQueryActive(true); setQueryRequest(r=>({id,serial:r.serial+1,...(parameters?{parameters}:{})})); }
  const client = useRef(new StudioClient()).current;
  const [caps, setCaps] = useState<Capabilities>({
    operations: [],
    approvedRootIds: [],
  });
  const [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null),
    [editor, setEditor] = useState<Editor>(initialEditor),
    [view, setView] = useState<View>(initialView);
  const [modal, setModal] = useState<Modal>(null),
    [dialogError, setDialogError] = useState(""),
    [summaries, setSummaries] = useState<Summary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]),
    [status, setStatus] = useState("Connecting to Studio service…"),
    [help, setHelp] = useState("Select a property to see its description.");
  const [sizes, setSizes] = useState({
    left: 240,
    right: 340,
    messages: 136,
    toolbox: 190,
  });
  const [hidden, setHidden] = useState({ explorer: false, inspector: false });
  const closing = useRef(""),
    password = useRef<HTMLInputElement>(null),
    createRequest = useRef(createId());
  const state = useRef({ project, editor, view });
  state.current = { project, editor, view };
  const saving = useRef(false);
  const savedFocus = useRef<{
    element: HTMLInputElement;
    objectId: string;
    start: number | null;
    end: number | null;
  } | null>(null);
  const mounted = useRef(true),
    refreshing = useRef(false),
    cursors = useRef<Record<string, number>>({});
  const model = project ? visible(project, editor) : null;
  const selectedKind: Kind | undefined = model?.pages.some(
    (v) => v.id === view.selected,
  )
    ? "page"
    : model?.forms.some((v) => v.id === view.selected)
      ? "form"
      : model?.controls.some((v) => v.id === view.selected)
        ? "control"
        : undefined;
  const selected =
    selectedKind && model
      ? model[
          selectedKind === "page"
            ? "pages"
            : selectedKind === "form"
              ? "forms"
              : "controls"
        ].find((v) => v.id === view.selected)
      : undefined;
  const activePage = model?.pages.find((p) => p.id === view.activePage);
  const dirty =
    Object.keys(editor.drafts).length > 0 || incompleteScalars(editor.buffers);
  const conflicts = Object.values(editor.drafts).filter(
    (d) => d.conflicts.length,
  );
  function notice(message: string) {
    setStatus(message);
  }
  function report(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Studio request failed. Retry after checking the service.";
    setMessages(
      error instanceof OwnerError && error.diagnostics.length
        ? error.diagnostics
        : [
            {
              code:
                error instanceof OwnerError
                  ? error.code
                  : "SERVICE_UNAVAILABLE",
              message,
            },
          ],
    );
    notice(message);
    if (error instanceof OwnerError && error.code === "AUTH_REQUIRED") {
      setConnected(false);
      setModal("connect");
    }
    return message;
  }
  function dialog(next: Modal) {
    setDialogError("");
    createRequest.current = createId();
    setModal(next);
  }
  function acceptSnapshot(snapshot: Project) {
    setEditor((current) => reconcile(current, snapshot));
    setProject(snapshot);
  }
  async function refresh() {
    const current = state.current.project;
    if (!current || refreshing.current) return;
    refreshing.current = true;
    try {
      const replay = await client.events(
        current.id,
        cursors.current[current.id] ?? 0,
      );
      const snapshot = await client.snapshot(current.id);
      if (mounted.current && state.current.project?.id === current.id) {
        cursors.current[current.id] = replay.lastSequence;
        if (replay.diagnostics.length) setMessages(replay.diagnostics);
        if (snapshot.revision > state.current.project.revision) {
          acceptSnapshot(snapshot);
          notice(
            `Service revision ${snapshot.revision} received; drafts retained.`,
          );
        } else if (replay.refetch)
          notice(
            "Event history changed; current snapshot reloaded and drafts retained.",
          );
      }
    } catch (e) {
      if (mounted.current) report(e);
    } finally {
      refreshing.current = false;
    }
  }
  async function openProject(id: string) {
    const snapshot = await client.snapshot(id);
    // Never leave a project's newest drafts behind when recovery storage cannot retain them.
    const prior = state.current;
    if (prior.project && !retain(prior.project.id, prior.editor, prior.view))
      throw new OwnerError(
        "DRAFT_STORAGE_UNAVAILABLE",
        "Cannot switch projects because draft recovery data could not be safely retained. Keep this project open, save your drafts, and review any recovery messages.",
      );
    const saved = restore(id);
    setProject(snapshot);
    setEditor(reconcile(saved.editor, snapshot));
    setView(saved.view);
    sessionStorage.setItem("studio.activeProject", id);
    setMessages(
      saved.issues.map((message) => ({ code: "DRAFT_RECOVERY", message })),
    );
    notice(
      saved.issues.length
        ? "Draft recovery needs attention. Review Messages; recoverable drafts were retained."
        : `Opened ${snapshot.name} · revision ${snapshot.revision}`,
    );
    setModal(null);
  }
  async function ready() {
    const capabilities = await client.capabilities();
    setCaps(capabilities);
    setConnected(true);
    setModal(null);
    notice("Studio service connected");
    const last = sessionStorage.getItem("studio.activeProject");
    if (last && !state.current.project) {
      try {
        await openProject(last);
      } catch (e) {
        report(e);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    void client
      .resume()
      .then(ready)
      .catch((e) => {
        if (e instanceof OwnerError && e.code === "AUTH_REQUIRED")
          setModal("connect");
        else report(e);
      })
      .finally(() => setLoading(false));
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!connected || !project) return;
    const timer = setInterval(() => {
      if (!busy) void refresh();
    }, 1500);
    const focus = () => {
      if (!busy) void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [connected, project?.id, busy]);
  useEffect(() => {
    if (project && !retain(project.id, editor, view))
      notice(
        "Draft recovery storage is unavailable. Keep this tab open until you save.",
      );
  }, [project, editor, view]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const updateView = (patch: Partial<View>) =>
    setView((current) => ({ ...current, ...patch }));
  function select(id: string, open = true) {
    if (!model) return;
    const control = model.controls.find((c) => c.id === id),
      action = model.actions.find((a) => a.id === id),
      form = model.forms.find(
        (f) => f.id === (control?.formId ?? action?.formId ?? id),
      );
    const page = model.pages.find((p) => p.id === (form?.pageId ?? id));
    setView((v) => ({
      ...v,
      selected: action?.formId ?? id,
      ...(open && page
        ? { activePage: page.id, open: [...new Set([...v.open, page.id])] }
        : {}),
      collapsed: v.collapsed.filter(
        (parent) => parent !== page?.id && parent !== form?.id,
      ),
      propertyTab:
        v.propertyTab === "Events" && !control ? "Format" : v.propertyTab,
    }));
  }
  function change(changes: Change[]) {
    if (!project) return;
    setEditor((current) => edit(current, project, changes));
  }
  useEffect(() => {
    if (busy || !savedFocus.current) return;
    const prior = savedFocus.current;
    savedFocus.current = null;
    if (
      prior.objectId !== state.current.view.selected ||
      !prior.element.isConnected
    )
      return;
    if (document.activeElement === document.body) {
      prior.element.focus();
      if (prior.start !== null && prior.end !== null)
        prior.element.setSelectionRange(prior.start, prior.end);
    }
  }, [busy]);
  async function save(): Promise<boolean> {
    if (saving.current) return false;
    const current = state.current;
    if (
      !current.project ||
      (!Object.keys(current.editor.drafts).length &&
        !incompleteScalars(current.editor.buffers))
    )
      return true;
    const scalarErrors = scalarIssues(current.editor.buffers);
    if (scalarErrors.length) {
      report(
        new OwnerError(
          "INVALID_INPUT",
          "Correct the highlighted numeric properties before saving.",
          scalarErrors.map((issue) => ({
            ...issue,
            code: "INVALID_INPUT",
            severity: "error",
            objectId: createId(() => issue.objectId),
          })),
        ),
      );
      return false;
    }
    saving.current = true;
    const focused = document.activeElement;
    if (
      focused instanceof HTMLInputElement &&
      focused.closest(".property-grid")
    )
      savedFocus.current = {
        element: focused,
        objectId: current.view.selected,
        start: focused.selectionStart,
        end: focused.selectionEnd,
      };
    setBusy(true);
    setDialogError("");
    try {
      // Re-read before committing: stale remote fields cannot be silently overwritten.
      const snapshot = await client.snapshot(current.project.id),
        merged = reconcile(current.editor, snapshot);
      setProject(snapshot);

      const ops = operations(merged);
      if (ops.length) await client.batch(snapshot, ops, createId());
      const saved = await client.snapshot(snapshot.id);
      state.current = { ...state.current, project: saved };
      setProject(saved);
      setEditor((latest) => afterSave(latest, merged, snapshot, saved));
      setMessages([]);
      notice(`Saved · revision ${saved.revision}`);
      return true;
    } catch (e) {
      const message = report(e);
      setDialogError(message);
      if (e instanceof OwnerError && e.code === "REVISION_CONFLICT")
        await refresh();
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || modal || schemaActive || queryActive) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!busy && connected) void save();
      }
      if (
        (event.target as HTMLElement).matches(
          "input,textarea,[contenteditable=true]",
        )
      )
        return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (!busy)
          setEditor((current) =>
            event.shiftKey ? redo(current) : undo(current),
          );
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        if (!busy) setEditor(redo);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [modal, busy, connected, schemaActive, queryActive]);
  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setDialogError("");
    // Read from the password field at exchange time only; clear on success AND failure.
    let key = password.current?.value ?? "";
    try {
      const pending = fetch("/api/v1/session", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: "{}",
      });
      key = "";
      if (password.current) password.current.value = "";
      const response = await pending;
      const outcome = await response.json();
      if (!outcome.ok)
        throw new OwnerError(outcome.error.code, outcome.error.message);
      client.csrf = outcome.result.csrfToken;
      await ready();
    } catch {
      setDialogError(
        "Could not connect. Check the private owner key and that the Studio service is running, then enter the key again.",
      );
    } finally {
      key = "";
      if (password.current) password.current.value = "";
      setBusy(false);
    }
  }
  async function listProjects() {
    dialog("open");
    setBusy(true);
    try {
      const lists = await Promise.all(
        caps.approvedRootIds.map((root) => client.list(root)),
      );
      setSummaries(lists.flat());
    } catch (e) {
      setDialogError(report(e));
    } finally {
      setBusy(false);
    }
  }
  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const created = await client.create(
        String(data.get("name")),
        String(data.get("root")),
        createRequest.current,
      );
      await openProject(created.id);
    } catch (e) {
      setDialogError(report(e));
    } finally {
      setBusy(false);
    }
  }
  function addPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = createId();
    const page: Page = {
      id,
      title: String(data.get("title")),
      route: String(data.get("route")),
      formIds: [],
      document: [],
    };
    if (
      model?.pages.some(
        (p) => p.route.replace(/\/$/, "") === page.route.replace(/\/$/, ""),
      )
    ) {
      setDialogError(
        "A page already uses this route. Choose a unique internal route.",
      );
      return;
    }
    change([{ entity: "page", value: page }]);
    updateView({
      selected: id,
      activePage: id,
      open: [...view.open, id],
      propertyTab: "Format",
    });
    setModal(null);
  }
  function selectCreated(id: string, next: Project) {
    const form = next.forms.find((f) => f.id === id);
    if (form)
      updateView({
        selected: id,
        activePage: form.pageId,
        propertyTab: "Data",
        open: [...new Set([...state.current.view.open, form.pageId])],
      });
  }
  function addControl(kind: Control["kind"]) {
    const form =
      selectedKind === "form"
        ? (selected as Form)
        : model?.forms.find(
            (f) => f.id === (selected as Control | undefined)?.formId,
          );
    if (!form) {
      notice(
        "Select a form in Explorer or the document before inserting a control.",
      );
      return;
    }
    const id = createId();
    const control: Control = {
      id,
      formId: form.id,
      kind,
      readOnly: kind === "label",
      appearance: {
        label:
          kind === "label" ? "Label" : kind === "button" ? "Button" : "Text",
      },
      validation: { required: false },
      events: [],
    };
    change([
      {
        entity: "form",
        value: { ...form, controlIds: [...form.controlIds, id] },
      },
      { entity: "control", value: control },
    ]);
    updateView({ selected: id, propertyTab: "Format" });
  }
  function pageDirty(id: string) {
    if (!model) return false;
    const scalarDirty = Object.entries(editor.buffers ?? {}).some(
      ([key, buffer]) =>
        !completeScalarForPage(buffer) &&
        model.forms.some(
          (f) =>
            f.pageId === id &&
            (scalarObjectId(key) === f.id ||
              model.controls.some(
                (c) => c.formId === f.id && scalarObjectId(key) === c.id,
              )),
        ),
    );
    if (scalarDirty) return true;
    return Object.values(editor.drafts).some((d) =>
      d.entity === "page"
        ? d.value.id === id
        : d.entity === "form"
          ? (d.value as Form).pageId === id
          : model.forms.find((f) => f.id === (d.value as Control).formId)
              ?.pageId === id,
    );
  }
  function closePage(id: string) {
    if (pageDirty(id)) {
      closing.current = id;
      dialog("close");
    } else finishClose(id);
  }
  function finishClose(id: string) {
    setView((v) => {
      const open = v.open.filter((p) => p !== id);
      return {
        ...v,
        open,
        activePage: v.activePage === id ? (open.at(-1) ?? "") : v.activePage,
      };
    });
    setModal(null);
  }
  function discardPage(id: string) {
    const current = state.current;
    if (!model || !project) return;
    const ids = new Set([
      id,
      ...model.forms.filter((f) => f.pageId === id).map((f) => f.id),
      ...model.controls
        .filter((c) =>
          model.forms.some((f) => f.id === c.formId && f.pageId === id),
        )
        .map((c) => c.id),
      ...model.actions
        .filter((a) =>
          model.forms.some((f) => f.id === a.formId && f.pageId === id),
        )
        .map((a) => a.id),
    ]);
    setEditor({
      drafts: Object.fromEntries(
        Object.entries(current.editor.drafts).filter(([key]) => !ids.has(key)),
      ),
      buffers: Object.fromEntries(
        Object.entries(current.editor.buffers ?? {}).filter(
          ([key]) => !ids.has(scalarObjectId(key)),
        ),
      ),
      past: [],
      future: [],
    });
    finishClose(id);
  }
  function field(
    name: string,
    value: string | number,
    description: string,
    update: (value: string) => ObjectValue,
    type = "text",
  ) {
    return (
      <label className="property-row" key={name}>
        <span>{name}</span>
        <input
          aria-label={name}
          type={type}
          value={value}
          readOnly={false}
          aria-busy={busy}
          onFocus={() => setHelp(description)}
          onChange={(e) =>
            selectedKind &&
            change([{ entity: selectedKind, value: update(e.target.value) }])
          }
        />
      </label>
    );
  }
  function properties() {
    if (!selected || !selectedKind || !model)
      return (
        <p className="pane-note">
          Select a page, form or control to inspect its properties.
        </p>
      );
    if (selectedKind === "form" || selectedKind === "control")
      return (
        <>
        {selectedKind === "form" && view.propertyTab === "Data" && (() => {
          const form = selected as Form;
          return <>
            <button onClick={() => openQuery(form.sourceRef?.kind === "query" ? form.sourceRef.id : "", Object.fromEntries((form.queryParameters ?? []).flatMap(m => m.value !== undefined ? [[m.parameterId, m.value]] : [])))}>Edit Data Source…</button>
            <QueryBinding form={form} project={model} onChange={value => change([{entity: "form", value}])}/>
          </>;
        })()}
        <FormProperties
          project={model}
          value={selected as Form | Control}
          kind={selectedKind}
          tab={view.propertyTab}
          onChange={change}
          buffers={editor.buffers ?? {}}
          onScalar={(key, buffer) =>
            setEditor((current) => ({
              ...current,
              buffers: { ...current.buffers, [key]: buffer },
            }))
          }
        />
        </>
      );
    if (selectedKind === "page") {
      const page = selected as Page;
      return view.propertyTab === "Format" ? (
        <>
          {field(
            "Title",
            page.title,
            "Document title. This does not change its stable ID.",
            (value) => ({ ...page, title: value }),
          )}
          <div className="property-row">
            <span>Object ID</span>
            <code>{page.id}</code>
          </div>
        </>
      ) : (
        <>
          {field(
            "Route",
            page.route,
            "Unique internal static route, beginning with /. The service validates uniqueness.",
            (value) => ({ ...page, route: value }),
          )}
          <div className="property-row">
            <span>Read access</span>
            <span>
              {model.policies.find((p) => p.id === page.policyId)?.access ??
                "Inherit project policy"}
            </span>
          </div>
        </>
      );
    }
    return null;
  }
  function treeKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[role=treeitem]"),
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const key = event.key;
    if (["ArrowUp", "ArrowDown", "Home", "End"].includes(key)) {
      event.preventDefault();
      items[
        key === "Home"
          ? 0
          : key === "End"
            ? items.length - 1
            : Math.max(
                0,
                Math.min(
                  items.length - 1,
                  index + (key === "ArrowDown" ? 1 : -1),
                ),
              )
      ]?.focus();
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const item = items[index];
      const id = item?.dataset.objectId;
      if (key === "ArrowRight") {
        if (id && item?.getAttribute("aria-expanded") === "false")
          updateView({ collapsed: view.collapsed.filter((v) => v !== id) });
        else items[index + 1]?.focus();
      } else if (id && item?.getAttribute("aria-expanded") === "true")
        updateView({ collapsed: [...view.collapsed, id], selected: id });
      else {
        const level = Number(item?.getAttribute("aria-level"));
        items
          .slice(0, index)
          .reverse()
          .find((parent) => Number(parent.getAttribute("aria-level")) < level)
          ?.focus();
      }
    }
  }
  const treeItem = (kind: Kind, value: ObjectValue, level: number) => (
    <button
      key={value.id}
      data-object-id={value.id}
      role="treeitem"
      aria-expanded={
        kind !== "control" &&
        ((kind === "page" && (value as Page).formIds.length > 0) ||
          (kind === "form" && (value as Form).controlIds.length > 0))
          ? !view.collapsed.includes(value.id)
          : undefined
      }
      aria-level={level}
      aria-selected={view.selected === value.id}
      tabIndex={
        view.selected === value.id ||
        (!view.selected && value.id === model?.pages[0]?.id)
          ? 0
          : -1
      }
      style={{ paddingInlineStart: 10 + (level - 1) * 16 }}
      onClick={() => select(value.id, false)}
      onDoubleClick={() => select(value.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          select(value.id);
        }
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
          e.preventDefault();
          select(value.id, false);
          document.getElementById("properties-heading")?.focus();
        }
      }}
    >
      <span className="object-icon" aria-hidden="true">
        {kind === "page" ? "▤" : kind === "form" ? "▦" : "◇"}
      </span>
      {kind !== "control" && (
        <span
          className="tree-chevron"
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            updateView({
              collapsed: view.collapsed.includes(value.id)
                ? view.collapsed.filter((id) => id !== value.id)
                : [...view.collapsed, value.id],
              selected: value.id,
            });
          }}
        >
          {view.collapsed.includes(value.id) ? "›" : "⌄"}
        </span>
      )}
      {label(kind, value)}
      {editor.drafts[value.id] && <span aria-label="unsaved"> *</span>}
    </button>
  );
  return (
    <main className="studio" aria-busy={loading}>
      <header className="titlebar">
        <span className="brand-mark" aria-hidden="true">
          ▦
        </span>
        <strong>Schema Baron</strong>
        <span className="title-divider">/</span>
        <span>{project?.name ?? "Studio"}</span>
        <span className="connection-state">
          {connected
            ? "● Studio service connected"
            : "○ Studio service disconnected"}
        </span>
      </header>
      <nav className="menubar" aria-label="Studio commands">
        <button onClick={() => dialog("new")} disabled={!connected || busy}>
          New project…
        </button>
        <button
          onClick={() => void listProjects()}
          disabled={!connected || busy}
        >
          Open / Switch…
        </button>
        <button onClick={() => dialog("settings")} disabled={!project}>
          Project settings
        </button>
        <button onClick={() => dialog("security")} disabled={!project || dirty}>Login and access…</button>
        <button onClick={() => dialog("connection")} disabled={!project}>
          Connections…
        </button>
        <button
          onClick={() => dialog("history")}
          disabled={
            !project ||
            !caps.operations.some((c) => c.operation === "schema.history")
          }
        >
          Migration history…
        </button>
        <button
          onClick={() => dialog("generation")}
          disabled={
            !project ||
            !caps.operations.some(
              (c) => c.operation === "generation.preview",
            ) ||
            dirty
          }
        >
          Generate…
        </button>
        <button disabled={!project} aria-pressed={schemaActive} onClick={() => { setQueryActive(false); setSchemaActive(v => !v); }}>Schema</button>
        <button disabled={!project} aria-pressed={queryActive} onClick={() => setQueryActive(v=>!v)}>Queries</button>
        <span className="menu-spacer" />
        <button
          onClick={() => setHidden((h) => ({ ...h, explorer: !h.explorer }))}
          aria-pressed={!hidden.explorer}
        >
          Explorer
        </button>
        <button
          onClick={() => setHidden((h) => ({ ...h, inspector: !h.inspector }))}
          aria-pressed={!hidden.inspector}
        >
          Inspector
        </button>
        <button
          onClick={() => {
            if (connected) {
              setBusy(true);
              void client
                .disconnect()
                .then(() => {
                  setConnected(false);
                  notice(
                    "Studio service disconnected. Drafts are retained in this tab.",
                  );
                })
                .catch(report)
                .finally(() => setBusy(false));
            } else dialog("connect");
          }}
          disabled={busy}
        >
          {connected ? "Disconnect service" : "Connect service…"}
        </button>
      </nav>
      <div className="toolbar" role="toolbar" aria-label="Model editing" style={{display:schemaActive||queryActive?"none":undefined}}>
        <button
          disabled={
            !project || !connected || busy || !dirty || conflicts.length > 0
          }
          onClick={() => void save()}
          title="Save all project drafts (Ctrl+S)"
        >
          ▣ Save
        </button>
        <span className="toolbar-divider" />
        <button
          onClick={() => setEditor(undo)}
          disabled={busy || !editor.past.length}
          title="Undo model edit"
        >
          ↶ Undo
        </button>
        <button
          onClick={() => setEditor(redo)}
          disabled={busy || !editor.future.length}
          title="Redo model edit"
        >
          ↷ Redo
        </button>
        <span className="toolbar-divider" />
        <button disabled={!project || busy} onClick={() => dialog("page")}>
          ＋ Page
        </button>
        <button disabled={!activePage || busy} onClick={() => dialog("form")}>
          ＋ Form
        </button>
        <button
          disabled={!project || !connected || busy}
          onClick={() => {
            setBusy(true);
            void client
              .diagnostics(project!.id)
              .then((result) => {
                setMessages(result.diagnostics);
                notice(
                  result.valid
                    ? "Committed model is valid. Unsaved drafts are validated on Save."
                    : "Validation found issues. Select a message to inspect its object.",
                );
              })
              .catch(report)
              .finally(() => setBusy(false));
          }}
        >
          ✓ Validate
        </button>
        <span className="menu-spacer" />
        <span className="revision">
          {project
            ? `r${project.revision} · ${Object.keys(editor.drafts).length} dirty objects${incompleteScalars(editor.buffers) ? ` · ${scalarIssues(editor.buffers).length} invalid numeric inputs` : ""}`
            : "No project open"}
        </span>
      </div>
      <div className="workspace-scroll">
        {project && <QueryDesigner key={`query-${project.id}`} active={queryActive} request={queryRequest} project={project} client={client} onChanged={acceptSnapshot} onClose={()=>setQueryActive(false)} onSelectObject={id=>{setQueryActive(false);select(id);}}/>}
        {project && <div className="schema-viewport" role="region" aria-label="Schema viewport" tabIndex={0} style={{height:"100%",display:schemaActive?"block":"none"}}><SchemaEditor key={project.id} active={schemaActive} onConnection={()=>dialog("connection")} project={project} client={client} caps={caps} onChanged={acceptSnapshot}/></div>}
        <div
          className="docks"
          style={
            {
              display: schemaActive||queryActive ? "none" : undefined,
              "--explorer": hidden.explorer ? "0px" : `${sizes.left}px`,
              "--inspector": hidden.inspector ? "0px" : `${sizes.right}px`,
              "--messages": `${sizes.messages}px`,
              "--toolbox": `${sizes.toolbox}px`,
            } as CSSProperties
          }
        >
          {!hidden.explorer && (
            <section className="explorer pane" aria-label="Explorer">
              <h2>Project Explorer</h2>
              <div className="explorer-project">
                {project?.name ?? "No project"}
              </div>
              <div
                role="tree"
                aria-label="Pages and objects"
                onKeyDown={treeKey}
              >
                {model?.pages.map((page) => (
                  <div key={page.id}>
                    {treeItem("page", page, 1)}
                    {!view.collapsed.includes(page.id) &&
                      model.forms
                        .filter((form) => form.pageId === page.id)
                        .map((form) => (
                          <div key={form.id}>
                            {treeItem("form", form, 2)}
                            {!view.collapsed.includes(form.id) &&
                              model.controls
                                .filter((control) => control.formId === form.id)
                                .map((control) =>
                                  treeItem("control", control, 3),
                                )}
                          </div>
                        ))}
                  </div>
                ))}
              </div>
              {!model?.pages.length && (
                <p className="pane-note">
                  {project
                    ? "This blank project has no pages. Use + Page to begin."
                    : "Create or open a project to begin."}
                </p>
              )}
              <h2>Named queries</h2>
              {model?.queries.map(q=><button key={q.id} onClick={()=>openQuery(q.id)}>{q.name}</button>)}
              <button disabled={!project} onClick={()=>openQuery()}>New query…</button>
              <div className="explorer-footer">
                <span>Connections · {model?.connections.length ?? 0}</span>
                <span>Schema · {model?.schema.tables.length ?? 0} tables</span>
              </div>
            </section>
          )}
          {!hidden.explorer && (
            <Splitter
              label="Explorer width"
              value={sizes.left}
              min={160}
              max={480}
              onChange={(left) => setSizes((s) => ({ ...s, left }))}
            />
          )}
          <div className="center-dock">
            <section className="document pane" aria-label="Document">
              <div className="document-strip">
                <div
                  className="document-tabs"
                  role="tablist"
                  aria-label="Open documents"
                >
                  {model?.pages
                    .filter((p) => view.open.includes(p.id))
                    .map((p) => (
                      <div
                        key={p.id}
                        className={
                          activePage?.id === p.id
                            ? "document-tab active"
                            : "document-tab"
                        }
                      >
                        <button
                          role="tab"
                          tabIndex={activePage?.id === p.id ? 0 : -1}
                          aria-selected={activePage?.id === p.id}
                          onKeyDown={(e) => {
                            const docs = model.pages.filter((page) =>
                              view.open.includes(page.id),
                            );
                            const index = docs.findIndex(
                              (page) => page.id === p.id,
                            );
                            const offset =
                              e.key === "ArrowRight"
                                ? 1
                                : e.key === "ArrowLeft"
                                  ? -1
                                  : 0;
                            if (offset) {
                              e.preventDefault();
                              const next =
                                docs[
                                  (index + offset + docs.length) % docs.length
                                ];
                              if (next) {
                                select(next.id);
                                (
                                  e.currentTarget
                                    .closest("[role=tablist]")
                                    ?.querySelectorAll("[role=tab]")[
                                    (index + offset + docs.length) % docs.length
                                  ] as HTMLElement
                                )?.focus();
                              }
                            }
                          }}
                          onClick={() => select(p.id)}
                        >
                          {p.title}
                          {pageDirty(p.id) ? " *" : ""}
                        </button>
                      </div>
                    ))}
                </div>
                {activePage && (
                  <button
                    className="close-document"
                    aria-label={`Close ${activePage.title}`}
                    onClick={() => closePage(activePage.id)}
                  >
                    ×
                  </button>
                )}
              </div>
              <div
                className="document-surface"
                role="tabpanel"
                aria-label="Design document"
              >
                {activePage && model ? (
                  <>
                    <div className="document-breadcrumb">
                      Page / {activePage.title} <span>{activePage.route}</span>
                    </div>
                    <div className="page-sheet">
                      <button
                        className={`page-heading ${view.selected === activePage.id ? "selected-object" : ""}`}
                        onClick={() => select(activePage.id)}
                      >
                        <span className="object-type">PAGE</span>
                        <strong>{activePage.title}</strong>
                      </button>
                      {model.forms
                        .filter((f) => f.pageId === activePage.id)
                        .map((form) => (
                          <section
                            className={`form-outline ${view.selected === form.id ? "selected-object" : ""}`}
                            key={form.id}
                          >
                            <button
                              className="form-caption"
                              onClick={() => select(form.id)}
                            >
                              <span className="object-type">
                                {form.kind.toUpperCase()}
                              </span>
                              {form.appearance.label || form.kind}
                            </button>
                            <div className="control-list">
                              {model.controls
                                .filter((c) => c.formId === form.id)
                                .map((control) => (
                                  <button
                                    className={`control-projection ${view.selected === control.id ? "selected-object" : ""}`}
                                    onClick={() => select(control.id)}
                                    key={control.id}
                                  >
                                    <span className="control-kind">
                                      {control.kind}
                                    </span>
                                    {control.appearance.label || control.kind}
                                  </button>
                                ))}
                              {!form.controlIds.length && (
                                <span className="empty-inline">
                                  Empty form · select it, then insert a control
                                  from Toolbox.
                                </span>
                              )}
                            </div>
                          </section>
                        ))}
                      {!activePage.formIds.length && (
                        <p className="document-note">
                          Blank page. Add a form from the toolbar or Toolbox.
                        </p>
                      )}
                      <p className="structure-note">Structure editor</p>
                    </div>
                  </>
                ) : (
                  <div className="empty-document">
                    <span className="empty-glyph" aria-hidden="true">
                      ▤
                    </span>
                    <h1>
                      {project
                        ? "No document open"
                        : "Your local Studio workspace"}
                    </h1>
                    <p>
                      {project
                        ? "Open a page from Explorer with Enter or a double-click, or create a new page."
                        : "Create a blank project or open an existing definition. Pages, forms and properties share the same model with MCP."}
                    </p>
                    <button
                      disabled={!connected || busy}
                      onClick={() => (project ? dialog("page") : dialog("new"))}
                    >
                      {project ? "New page…" : "New blank project…"}
                    </button>
                  </div>
                )}
              </div>
              <div
                className="modebar"
                tabIndex={0}
                role="region"
                aria-label="Document modes and status"
              >
                <span className="mode-active">Design</span>
                {["HTML", "Code", "Preview", "Live Page"].map((mode) => (
                  <span
                    key={mode}
                    title="This document mode is not available in this version."
                    aria-disabled="true"
                  >
                    {mode}
                  </span>
                ))}
                <span className="menu-spacer" />
                <span className="mode-hint">Structure</span>
              </div>
            </section>
            <Splitter
              horizontal
              invert
              label="Messages height"
              value={sizes.messages}
              min={72}
              max={360}
              onChange={(messages) => setSizes((s) => ({ ...s, messages }))}
            />
            <section className="messages pane" aria-label="Messages">
              <h2>
                Messages <span>{messages.length}</span>
              </h2>
              <div
                className="message-table"
                tabIndex={0}
                role="region"
                aria-label="Diagnostic messages"
              >
                <div className="message-columns">
                  <span>Code</span>
                  <span>Description</span>
                </div>
                {messages.length ? (
                  messages.map((message, i) => (
                    <button
                      key={i}
                      className="message-row"
                      onClick={() => {
                        if (message.objectId) select(message.objectId);
                        if (message.field) {
                          updateView({
                            propertyTab: [
                              "route",
                              "Page size",
                              "min",
                              "max",
                              "maxLength",
                            ].includes(message.field ?? "")
                              ? "Data"
                              : "Format",
                          });
                          setTimeout(
                            () =>
                              document
                                .querySelector<HTMLInputElement>(
                                  `input[aria-label="${["Width", "Page size", "min", "max", "maxLength"].includes(message.field ?? "") ? message.field : message.field === "route" ? "Route" : message.field === "title" ? "Title" : "Label"}"]`,
                                )
                                ?.focus(),
                            0,
                          );
                        }
                      }}
                    >
                      <code>{message.code}</code>
                      <span>
                        {message.message}
                        {message.objectId && " · Select object"}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="pane-note">
                    No diagnostics. Save drafts to validate changes against the
                    owner service.
                  </p>
                )}
              </div>
            </section>
          </div>
          {!hidden.inspector && (
            <Splitter
              invert
              label="Inspector width"
              value={sizes.right}
              min={260}
              max={560}
              onChange={(right) => setSizes((s) => ({ ...s, right }))}
            />
          )}
          {!hidden.inspector && (
            <aside className="right-dock" aria-label="Inspector">
              <section className="toolbox pane" aria-label="Toolbox">
                <h2>Toolbox</h2>
                <Tabs
                  label="Toolbox categories"
                  values={["Forms", "Controls", "HTML"]}
                  active={view.toolboxTab}
                  onChange={(toolboxTab) => updateView({ toolboxTab })}
                />
                <div className="toolbox-content">
                  {view.toolboxTab === "Forms" ? (
                    <>
                      <button
                        disabled={!activePage || busy}
                        onClick={() => dialog("form")}
                      >
                        ▦ Insert form…
                      </button>
                      <p>Grid · Record · Search · Login</p>
                      <span className="capability-note">
                        Focused construction creates ordinary editable objects.
                      </span>
                    </>
                  ) : view.toolboxTab === "Controls" ? (
                    <>
                      {(
                        [
                          "label",
                          "text",
                          "number",
                          "date",
                          "checkbox",
                          "select",
                          "link",
                          "button",
                        ] as const
                      ).map((kind) => (
                        <button
                          key={kind}
                          disabled={
                            !["form", "control"].includes(selectedKind ?? "") ||
                            busy
                          }
                          onClick={() => addControl(kind)}
                        >
                          ◇{" "}
                          {
                            {
                              label: "Label",
                              text: "Text input",
                              number: "Number input",
                              date: "Date input",
                              checkbox: "Checkbox",
                              select: "Lookup / select",
                              link: "Link",
                              button: "Button",
                            }[kind]
                          }
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="pane-note">
                      HTML editing is not available in this version.
                    </p>
                  )}
                </div>
              </section>
              <Splitter
                horizontal
                label="Toolbox height"
                value={sizes.toolbox}
                min={120}
                max={360}
                onChange={(toolbox) => setSizes((s) => ({ ...s, toolbox }))}
              />
              <section className="properties pane" aria-label="Properties">
                <h2 id="properties-heading" tabIndex={-1}>
                  Properties
                </h2>
                <Tabs
                  label="Property categories"
                  values={
                    selectedKind === "control"
                      ? ["Format", "Data", "Events"]
                      : ["Format", "Data"]
                  }
                  active={
                    selectedKind !== "control" && view.propertyTab === "Events"
                      ? "Format"
                      : view.propertyTab
                  }
                  onChange={(propertyTab) => updateView({ propertyTab })}
                />
                <div className="selected-caption">
                  {selected && selectedKind ? (
                    <>
                      <span>
                        {selectedKind.toUpperCase()}
                        {selectedKind === "form" || selectedKind === "control"
                          ? ` · ${(selected as Form | Control).kind}`
                          : ""}
                      </span>
                      <strong>{label(selectedKind, selected)}</strong>
                    </>
                  ) : (
                    "No object selected"
                  )}
                </div>
                <div className="property-grid">
                  {properties()}
                  {selected && editor.drafts[selected.id]?.conflicts.length ? (
                    <div className="conflict" role="alert">
                      <strong>Conflicting service revision</strong>
                      <p>
                        Changed fields:{" "}
                        {editor.drafts[selected.id]!.conflicts.join(", ")}. Your
                        draft is retained.
                      </p>
                      <details>
                        <summary>Compare draft and service</summary>
                        <pre>
                          Draft:{" "}
                          {JSON.stringify(
                            editor.drafts[selected.id]!.value,
                            null,
                            2,
                          )}
                        </pre>
                        <pre>
                          Service:{" "}
                          {JSON.stringify(
                            editor.drafts[selected.id]!.base ??
                              "Object removed",
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                      <button
                        onClick={() =>
                          project &&
                          setEditor((e) =>
                            resolveDraft(e, project, selected.id, "mine"),
                          )
                        }
                      >
                        Keep my draft
                      </button>
                      <button
                        onClick={() =>
                          project &&
                          setEditor((e) =>
                            resolveDraft(e, project, selected.id, "remote"),
                          )
                        }
                      >
                        Use service version
                      </button>
                    </div>
                  ) : null}
                </div>
                <footer className="property-help">{help}</footer>
              </section>
            </aside>
          )}
        </div>
      </div>
      <footer className="statusbar">
        <span role="status">{busy ? "Working…" : status}</span>
        {conflicts.length > 0 && (
          <button
            className="conflict-link"
            onClick={() => {
              const id = conflicts[0]?.value.id;
              if (id) select(id);
            }}
          >
            Resolve {conflicts.length} conflict
            {conflicts.length === 1 ? "" : "s"}
          </button>
        )}
        <span className="menu-spacer" />
        <span>Ctrl+S Save · Ctrl+Z Undo</span>
      </footer>
      {modal && (
        <Dialog
          title={
            modal === "connect"
              ? "Connect to Studio service"
              : modal === "new"
                ? "New blank project"
                : modal === "open"
                  ? "Open or switch project"
                  : modal === "page"
                    ? "New page"
                    : modal === "form"
                      ? "Insert form"
                      : modal === "close"
                        ? "Unsaved document changes"
                        : modal === "security"
                          ? "Login and access"
                          : modal === "settings"
                          ? "Project settings"
                          : modal === "generation"
                            ? "Generate application"
                            : modal === "history"
                              ? "Migration history and restore"
                              : "Connection setup"
          }
          busy={busy}
          onCancel={() => setModal(null)}
        >
          {modal === "connect" ? (
            <form onSubmit={connect}>
              <p>
                Enter the private owner key from this Studio service
                configuration. This connects the authoring workspace;
                generated-app user login is separate.
              </p>
              <label className="dialog-field">
                Studio service owner key
                <input
                  autoFocus
                  ref={password}
                  name="studio-owner-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  disabled={busy}
                />
              </label>
              <p className="quiet">
                The key is cleared immediately after each connection attempt.
                The session resumes securely after reload.
              </p>
              <DialogError message={dialogError} />
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  Connect
                </button>
              </div>
            </form>
          ) : modal === "new" ? (
            <form onSubmit={createProject}>
              <p>
                Create an empty definition. No business schema or generated-app
                credentials are added.
              </p>
              <label className="dialog-field">
                Project name
                <input
                  autoFocus
                  name="name"
                  required
                  maxLength={120}
                  disabled={busy}
                />
              </label>
              <label className="dialog-field">
                Approved project root
                <select name="root" disabled={busy}>
                  {caps.approvedRootIds.map((root) => (
                    <option key={root}>{root}</option>
                  ))}
                </select>
              </label>
              <label className="dialog-field">
                Output target
                <input value="Next.js · TypeScript · SQLite" readOnly />
              </label>
              <DialogError message={dialogError} />
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={busy || !caps.approvedRootIds.length}
                >
                  Create project
                </button>
              </div>
            </form>
          ) : modal === "open" ? (
            <>
              <p>
                Switching retains each project's unsaved drafts in this browser
                tab.
              </p>
              <div className="project-list">
                {summaries.map((summary) => (
                  <button
                    key={summary.id}
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void openProject(summary.id)
                        .catch((e) => setDialogError(report(e)))
                        .finally(() => setBusy(false));
                    }}
                  >
                    <strong>{summary.name}</strong>
                    <span>
                      r{summary.revision}
                      {project?.id === summary.id ? " · Current project" : ""}
                    </span>
                  </button>
                ))}
                {!summaries.length && (
                  <p>
                    {busy
                      ? "Loading projects…"
                      : "No registered projects in the approved roots."}
                  </p>
                )}
              </div>
              <DialogError message={dialogError} />
              <div className="dialog-actions">
                <button disabled={busy} onClick={() => setModal(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : modal === "page" ? (
            <form onSubmit={addPage}>
              <label className="dialog-field">
                Page title
                <input autoFocus name="title" required disabled={busy} />
              </label>
              <label className="dialog-field">
                Internal route
                <input
                  name="route"
                  required
                  pattern="/(?:[A-Za-z0-9_-]+/?)*"
                  placeholder="/page"
                  disabled={busy}
                />
              </label>
              <p className="quiet">
                Finish adds a draft. Save commits all dirty objects atomically.
              </p>
              <DialogError message={dialogError} />
              <div className="dialog-actions">
                <button type="button" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button className="primary">Add page</button>
              </div>
            </form>
          ) : modal === "form" ? (
            model && activePage ? (
              <FormWizard
                project={model}
                pageId={activePage.id}
                onCancel={() => setModal(null)}
                onFinish={async (input) => {
                  setBusy(true);
                  try {
                    const current = state.current;
                    const snapshot = current.project;
                    if (!snapshot) throw new Error("Open a project first.");
                    const neededPages = new Set(
                      [input.pageId, input.linkedRecord?.pageId].filter(
                        (id) => id && !snapshot.pages.some((p) => p.id === id),
                      ),
                    );
                    const neededForms = new Set(
                      model?.forms
                        .filter((f) => neededPages.has(f.pageId))
                        .map((f) => f.id),
                    );
                    const needed = new Set([
                      ...neededPages,
                      ...neededForms,
                      ...(model?.controls
                        .filter((c) => neededForms.has(c.formId))
                        .map((c) => c.id) ?? []),
                      ...(model?.actions
                        .filter((a) => neededForms.has(a.formId))
                        .map((a) => a.id) ?? []),
                    ]);
                    const submitted = {
                      ...current.editor,
                      buffers: Object.fromEntries(
                        Object.entries(current.editor.buffers ?? {}).filter(
                          ([key]) => needed.has(scalarObjectId(key)),
                        ),
                      ),
                      drafts: Object.fromEntries(
                        Object.entries(current.editor.drafts).filter(([id]) =>
                          needed.has(id),
                        ),
                      ),
                    };
                    const pendingOperations = operations(submitted);
                    const result = await client.read<{ changedIds: string[] }>(
                      `projects/${encodeURIComponent(snapshot.id)}/commands`,
                      {
                        requestId: createId(),
                        operation: "form.construct",
                        expectedRevision: snapshot.revision,
                        input: { ...input, pendingOperations },
                      },
                    );
                    const next = await client.snapshot(snapshot.id);
                    setEditor((latest) =>
                      afterConstruction(
                        latest,
                        submitted,
                        snapshot,
                        next,
                        result.changedIds,
                      ),
                    );
                    setProject(next);
                    selectCreated(result.changedIds[0] ?? "", next);
                    setModal(null);
                    notice("Form constructed. Edit its normal Properties.");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            ) : (
              <p>Open a page before constructing a form.</p>
            )
          ) : modal === "close" ? (
            <>
              <p>
                This document contains unsaved model edits. Choose what happens
                to its drafts.
              </p>
              <DialogError message={dialogError} />
              <div className="close-actions">
                <button
                  disabled={busy}
                  onClick={() => {
                    void save().then((ok) => {
                      if (ok) finishClose(closing.current);
                    });
                  }}
                >
                  Save project and close
                </button>
                <button
                  disabled={busy}
                  onClick={() => finishClose(closing.current)}
                >
                  Keep draft and close
                </button>
                <button
                  disabled={busy}
                  onClick={() => discardPage(closing.current)}
                >
                  Discard this document's drafts
                </button>
                <button disabled={busy} onClick={() => setModal(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : modal === "security" ? (
            project ? <SecurityEditor project={project} client={client} onChanged={acceptSnapshot} onBusy={setBusy} onClose={() => setModal(null)} /> : <p>Open a project first.</p>
          ) : modal === "settings" ? (
            <>
              <dl className="settings">
                <dt>Project</dt>
                <dd>{project?.name}</dd>
                <dt>ID</dt>
                <dd>{project?.id}</dd>
                <dt>Target</dt>
                <dd>{project?.target}</dd>
                <dt>Revision</dt>
                <dd>{project?.revision}</dd>
                <dt>Global access</dt>
                <dd>
                  {
                    model?.policies.find((p) => p.id === model.globalPolicyId)
                      ?.access
                  }
                </dd>
              </dl>
              <p>
                These project settings are read-only in this workspace slice.
                Page properties are edited separately in the Properties pane.
              </p>
              <div className="dialog-actions">
                <button onClick={() => setModal(null)}>Close</button>
              </div>
            </>
          ) : modal === "generation" ? (
            project ? (
              <GenerationReview
                project={project}
                client={client}
                caps={caps}
                onBusy={setBusy}
                onClose={() => setModal(null)}
              />
            ) : (
              <p>Open a project first.</p>
            )
          ) : modal === "history" ? (
            project ? (
              <MigrationHistory
                project={project}
                client={client}
                onClose={() => setModal(null)}
                onChanged={acceptSnapshot}
              />
            ) : (
              <p>Open a project to view migration history.</p>
            )
          ) : project ? (
            <ConnectionSetup
              project={project}
              client={client}
              roots={caps.approvedRootIds}
              onClose={() => setModal(null)}
              onBound={(snapshot) => {
                acceptSnapshot(snapshot);
                setModal(null);
                notice("SQLite connection bound. Schema refreshed.");
              }}
            />
          ) : (
            <p>Open a project before setting up a database.</p>
          )}
        </Dialog>
      )}
    </main>
  );
}
function DialogError({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="dialog-error">
      {message}
    </p>
  ) : null;
}
