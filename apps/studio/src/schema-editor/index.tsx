"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import type { Connection as FlowConnection, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createId, expressionSchema, idSchema, columnSchema, scalarTypeSchema, tableSchema, validateProject } from '@schema-baron/model';
import type { MutableRefObject } from 'react';
import type { Diagnostic, Expression, Project, ReviewedPlan, ScalarType, StableId, Table } from '@schema-baron/model';
import { z } from 'zod';
import { useDraftFocus } from '../workspace/draft-focus.js';
import { OwnerError } from '../project-ui/api.js';
import type { Capabilities, StudioClient } from '../project-ui/api.js';
import { Dialog, Tabs } from '../workspace/chrome.js';
import { applicableSchemaBuffers, blankTable, changeTable, checkpointDrafts, reconcileDrafts, tableOperations, visibleTables } from './state.js';
import type { Drafts } from './state.js';
import { retainNodeMeasurements } from '../flow-map/state.js';
import type { NodeMeasurements } from '../flow-map/state.js';
import './styles.css';
type Column = Table['columns'][number];
type Migration = Extract<ReviewedPlan, {
  kind: 'migration';
}>;
type Positions = Record<string, {
  x: number;
  y: number;
}>;
type Pair = {
  local: string;
  remote: string;
};
const panelSchema = z.object({
  uniqueIds: z.array(z.string()),
  checkField: z.string(),
  checkOperator: z.enum(['=', '!=', '>', '>=', '<', '<=']),
  checkValue: z.string(),
  indexName: z.string(),
  indexIds: z.array(z.string()),
  indexUnique: z.boolean()
});
type Panel = z.infer<typeof panelSchema>;
const emptyPanel: Panel = {
  uniqueIds: [],
  checkField: '',
  checkOperator: '>=',
  checkValue: '',
  indexName: '',
  indexIds: [],
  indexUnique: false
};
type GraphData = {
  table: Table;
  selected: string;
  select: (table: string, column?: string) => void;
};
function TableNode({
  data
}: NodeProps<Node<GraphData>>) {
  return <div className="schema-node"><button className="schema-node-title" onClick={() => data.select(data.table.id)}>{data.table.physicalName || 'Unnamed table'}</button>{data.table.columns.map(c => <div className={data.selected === c.id ? 'schema-node-column selected' : 'schema-node-column'} key={c.id}><Handle id={c.id} type="target" position={Position.Left} /><button onClick={() => data.select(data.table.id, c.id)}>{data.table.primaryKey.includes(c.id) ? '◆ ' : ''}{c.physicalName || 'Unnamed column'} <small>{c.type.kind}</small></button><Handle id={c.id} type="source" position={Position.Right} /></div>)}</div>;
}
const nodeTypes = {
  table: TableNode
};
const actions = ['restrict', 'cascade', 'set-null', 'set-default', 'no-action'] as const;
const kinds = ['integer', 'real', 'text', 'blob', 'boolean', 'date', 'datetime', 'decimal'] as const;
function typeFor(kind: string): ScalarType {
  return kind === 'decimal' ? {
    kind,
    scale: 2,
    precision: 18,
    encoding: 'text',
    rounding: 'half-even'
  } : kind === 'date' ? {
    kind,
    encoding: 'iso-date'
  } : kind === 'datetime' ? {
    kind,
    encoding: 'iso-utc'
  } : {
    kind: kind as 'integer' | 'real' | 'text' | 'blob' | 'boolean'
  };
}
function storage(type: ScalarType) {
  return type.kind === 'decimal' ? type.encoding === 'text' ? 'TEXT' : 'INTEGER' : ['integer', 'boolean'].includes(type.kind) ? 'INTEGER' : type.kind === 'real' ? 'REAL' : type.kind === 'blob' ? 'BLOB' : 'TEXT';
}
function literal(text: string, type: ScalarType): Expression {
  let value: string | number | boolean | null = text;
  if (text === 'NULL') value = null;else if (type.kind === 'integer' || type.kind === 'real') {
    value = Number(text);
    if (!text.trim() || !Number.isFinite(value) || type.kind === 'integer' && !Number.isInteger(value)) throw new Error('Enter a finite ' + type.kind + ' literal.');
  } else if (type.kind === 'boolean') {
    if (!['true', 'false'].includes(text)) throw new Error('Use true or false.');
    value = text === 'true';
  }
  return {
    kind: 'literal',
    value,
    type
  };
}
const editingTable = tableSchema.extend({
  physicalName: z.string(),
  columns: z.array(columnSchema.extend({
    physicalName: z.string(),
    type: z.union([scalarTypeSchema, z.strictObject({
      kind: z.literal('decimal'),
      scale: z.number().finite(),
      precision: z.number().finite(),
      encoding: z.enum(['text', 'scaled-integer']),
      rounding: z.enum(['half-up', 'half-even', 'down'])
    })])
  }))
});
const singleDraftRecoverySchema = z.object({
  base: tableSchema.optional(),
  value: editingTable.nullable(),
  conflicts: z.array(z.string())
});
const draftRecoverySchema = z.record(z.string(), singleDraftRecoverySchema);
const relationshipRecovery = z.object({
  from: z.string(),
  to: z.string(),
  pairs: z.array(z.object({
    local: z.string(),
    remote: z.string()
  })).min(1),
  onDelete: z.enum(actions),
  onUpdate: z.enum(actions),
  deferred: z.boolean()
});
const recoverySchema = z.object({
  relationship: relationshipRecovery.optional(),
  backfills: z.array(z.object({
    tableId: idSchema,
    columnId: idSchema,
    expression: expressionSchema
  })).default([]),
  backfillColumn: z.string().default(''),
  backfillText: z.string().default(''),
  drafts: draftRecoverySchema,
  past: z.array(draftRecoverySchema).max(50).default([]),
  future: z.array(draftRecoverySchema).max(50).default([]),
  selected: z.string(),
  column: z.string(),
  positions: z.record(z.string(), z.object({
    x: z.number().finite(),
    y: z.number().finite()
  })),
  buffers: z.record(z.string(), z.string()),
  panels: z.record(z.string(), panelSchema).default({})
});
const schemaMemory = new Map<string, ReturnType<typeof recoverFromStorage>>();
function recover(id: string) {
  return schemaMemory.get(id) ?? recoverFromStorage(id);
}
function recoverFromStorage(id: string) {
  const empty = {
    drafts: {} as Drafts,
    selected: '',
    column: '',
    positions: {} as Positions,
    buffers: {} as Record<string, string>,
    panels: {} as Record<string, Panel>,
    past: [] as Drafts[],
    future: [] as Drafts[],
    backfills: [] as {
      tableId: StableId;
      columnId: StableId;
      expression: Expression;
    }[],
    backfillColumn: '',
    backfillText: '',
    relationship: undefined as z.infer<typeof relationshipRecovery> | undefined,
    warning: ''
  };
  try {
    const raw = sessionStorage.getItem('studio.schema.' + id);
    if (!raw) return empty;
    const decoded: unknown = JSON.parse(raw);
    let parsed = recoverySchema.safeParse(decoded);
    let warning = '';
    if (!parsed.success) {
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return {
        ...empty,
        warning: 'Schema recovery is unreadable; original data was retained.'
      };
      const source = decoded as Record<string, unknown>;
      const salvaged: Record<string, unknown> = {
        ...empty
      };
      for (const [field, validator] of Object.entries(recoverySchema.shape)) {
        const result = validator.safeParse(source[field]);
        if (result.success) salvaged[field] = result.data;
      }
      const recovered: Record<string, unknown> = {};
      if (source.drafts && typeof source.drafts === 'object' && !Array.isArray(source.drafts)) for (const [key, value] of Object.entries(source.drafts)) {
        const result = singleDraftRecoverySchema.safeParse(value);
        if (result.success && (!result.data.value || result.data.value.id === key) && (!result.data.base || result.data.base.id === key)) recovered[key] = result.data;
      }
      salvaged.drafts = recovered;
      parsed = recoverySchema.safeParse(salvaged);
      warning = 'Some schema recovery entries were unreadable. Recoverable drafts were restored and original raw recovery data was protected.';
      if (!parsed.success) return {
        ...empty,
        warning
      };
    }
    return {
      ...empty,
      ...parsed.data,
      warning,
      drafts: Object.fromEntries(Object.entries(parsed.data.drafts).map(([id, d]) => [id, {
        ...d,
        base: d.base
      }])),
      past: parsed.data.past.map(d => Object.fromEntries(Object.entries(d).map(([id, v]) => [id, {
        ...v,
        base: v.base
      }]))),
      future: parsed.data.future.map(d => Object.fromEntries(Object.entries(d).map(([id, v]) => [id, {
        ...v,
        base: v.base
      }])))
    };
  } catch {
    return {
      ...empty,
      warning: 'Schema draft recovery storage is unavailable.'
    };
  }
}
export interface SchemaEditorController { save: () => Promise<Project | null>; dirty: boolean }
export function SchemaEditor({
  project,
  client,
  caps,
  onChanged,
  active,
  onConnection,
  draftMode = false,
  controller
}: {
  project: Project;
  draftMode?: boolean;
  controller?: MutableRefObject<SchemaEditorController | null>;
  active: boolean;
  onConnection: () => void;
  client: StudioClient;
  caps: Capabilities;
  onChanged: (p: Project) => void;
}) {
  const [initial] = useState(() => recover(project.id));
  const [measurements, setMeasurements] = useState<NodeMeasurements>({});
  // Draft overlays can reorder visibleTables; default view positions follow stable IDs.
  const defaultPositions = useRef<Positions>({});
  const [drafts, setDrafts] = useState<Drafts>(initial.drafts),
    [selected, setSelected] = useState(initial.selected),
    [column, setColumn] = useState(initial.column),
    [positions, setPositions] = useState<Positions>(initial.positions),
    [buffers, setBuffers] = useState(initial.buffers);
  const [panels, setPanels] = useState(initial.panels);
  const panel = panels[selected] ?? emptyPanel;
  const updatePanel = (patch: Partial<Panel>) => setPanels(p => ({
    ...p,
    [selected]: {
      ...panel,
      ...patch
    }
  }));
  const [past, setPast] = useState<Drafts[]>(initial.past),
    [future, setFuture] = useState<Drafts[]>(initial.future),
    [tab, setTab] = useState('Columns'),
    [mode, setMode] = useState('Diagram'),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState<Diagnostic[]>([]),
    [status, setStatus] = useState(initial.warning || (draftMode ? 'Create tables, add columns and set keys. Next keeps your proposal; Complete creates the database.' : 'Schema drafts edit desired definitions. Save stores the model; only reviewed apply changes SQLite.'));
  const [review, setReview] = useState<Migration | null>(null),
    [reviewOpen, setReviewOpen] = useState(false),
    [ack, setAck] = useState<string[]>([]),
    [clock, setClock] = useState(Date.now());
  const [relationship, setRelationship] = useState(false),
    [from, setFrom] = useState(initial.relationship?.from ?? ''),
    [to, setTo] = useState(initial.relationship?.to ?? ''),
    [pairs, setPairs] = useState<Pair[]>(initial.relationship?.pairs ?? [{
      local: '',
      remote: ''
    }]),
    [onDelete, setOnDelete] = useState<Table['foreignKeys'][number]['onDelete']>(initial.relationship?.onDelete ?? 'restrict'),
    [onUpdate, setOnUpdate] = useState<Table['foreignKeys'][number]['onUpdate']>(initial.relationship?.onUpdate ?? 'restrict'),
    [deferred, setDeferred] = useState(initial.relationship?.deferred ?? false),
    [dialogError, setDialogError] = useState('');
  const [backfills, setBackfills] = useState<{
      tableId: StableId;
      columnId: StableId;
      expression: Expression;
    }[]>(initial.backfills),
    [backfillColumn, setBackfillColumn] = useState(initial.backfillColumn),
    [backfillText, setBackfillText] = useState(initial.backfillText);
  const tables = useMemo(() => visibleTables(project.schema.tables, drafts), [project.schema.tables, drafts]);
  const table = tables.find(t => t.id === selected),
    currentColumn = table?.columns.find(c => c.id === column);
  const bufferedTables = tables.filter(table => Object.keys(applicableSchemaBuffers(buffers, [table])).length);
  const draftCount = new Set([...Object.keys(drafts), ...bufferedTables.map(table => table.id)]).size;
  const dirty = draftCount > 0;
  const draftFocus = useDraftFocus(project.id, `schema:${selected}:${column}:${tab}`, active && !busy);
  const inspectedTable = project.connections[0]?.inspectedSchema?.tables.find(t => t.id === selected);
  const inspectedColumn = inspectedTable?.columns.find(c => c.id === column);
  const physicalDeclaration = project.connections[0]?.physical?.tables.find(t => t.name === inspectedTable?.physicalName)?.columns.find(c => c.name === inspectedColumn?.physicalName)?.type;
  const current = useRef({
    project,
    drafts,
    buffers
  });
  current.current = {
    project,
    drafts,
    buffers
  };
  const saving = useRef(false);
  const recoveryBlocked = useRef(!!initial.warning);
  const send = (operation: string, input: unknown, p = project) => client.read(`projects/${encodeURIComponent(p.id)}/commands`, {
    requestId: createId(),
    operation,
    expectedRevision: p.revision,
    input
  });
  function report(e: unknown) {
    const message = e instanceof Error ? e.message : 'Schema operation failed; drafts retained.';
    setStatus(message);
    setMessages(e instanceof OwnerError && e.diagnostics.length ? e.diagnostics : [{
      code: e instanceof OwnerError ? e.code as Diagnostic['code'] : 'VALIDATION_FAILED',
      severity: 'error',
      message
    }]);
    return message;
  }
  useEffect(() => {
    setDrafts(d => reconcileDrafts(d, project.schema.tables));
  }, [project.revision]);
  useEffect(() => {
    const retained = {
      drafts,
      selected,
      column,
      positions,
      buffers,
      panels,
      past,
      future,
      backfills,
      backfillColumn,
      backfillText,
      relationship: {
        from,
        to,
        pairs,
        onDelete,
        onUpdate,
        deferred
      },
      warning: initial.warning
    };
    schemaMemory.set(project.id, retained);
    if (recoveryBlocked.current) return;
    try {
      sessionStorage.setItem('studio.schema.' + project.id, JSON.stringify({
        drafts,
        selected,
        column,
        positions,
        buffers,
        panels,
        past,
        future,
        backfills,
        backfillColumn,
        backfillText,
        relationship: {
          from,
          to,
          pairs,
          onDelete,
          onUpdate,
          deferred
        }
      }));
    } catch {
      setStatus('Schema recovery storage unavailable. Keep this tab open until drafts are saved.');
    }
  }, [drafts, selected, column, positions, buffers, panels, past, future, from, to, pairs, onDelete, onUpdate, deferred, backfills, backfillColumn, backfillText, project.id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!review) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [review]);
  function update(value: Table | null, id = value?.id) {
    // Explicit schema changes retire fields they remove. View switches and recovery do not.
    const desired = visibleTables(project.schema.tables, changeTable(drafts, project.schema.tables, value, id));
    setBuffers(current => applicableSchemaBuffers(current, desired));
    setPast(p => [...p.slice(-49), drafts]);
    setFuture([]);
    setDrafts(d => changeTable(d, project.schema.tables, value, id));
  }
  function select(tableId: string, columnId?: string) {
    setSelected(tableId);
    setColumn(columnId ?? '');
  }
  function updateColumn(patch: Partial<Column>) {
    if (table && currentColumn) update({
      ...table,
      columns: table.columns.map(c => c.id === column ? {
        ...c,
        ...patch
      } : c)
    });
  }
  const candidate = {
    ...project,
    schema: {
      ...project.schema,
      tables
    }
  };
  const localErrors = useMemo(() => {
    const errors: Diagnostic[] = [];
    for (const t of tables) {
      if (!t.physicalName.trim()) errors.push({
        code: 'VALIDATION_FAILED',
        severity: 'error',
        objectId: t.id,
        field: 'physicalName',
        message: 'Table name is required.'
      });
      if (!t.columns.length) errors.push({
        code: 'VALIDATION_FAILED',
        severity: 'error',
        objectId: t.id,
        field: 'columns',
        message: 'Add at least one column.'
      });
      for (const c of t.columns) if (!c.physicalName.trim()) errors.push({
        code: 'VALIDATION_FAILED',
        severity: 'error',
        objectId: c.id,
        field: 'physicalName',
        message: 'Column name is required.'
      });
    }
    return errors;
  }, [tables]);
  async function save() {
    if (saving.current) return null;
    saving.current = true;
    setBusy(true);
    try {
      const state = current.current;
      const snapshot = draftMode ? state.project : await client.snapshot(state.project.id);
      const merged = reconcileDrafts(current.current.drafts, snapshot.schema.tables);
      setDrafts(d => reconcileDrafts(d, snapshot.schema.tables));
      onChanged(snapshot);
      if (Object.values(merged).some(d => d.conflicts.length)) throw new Error('Service edits conflict with schema drafts. Choose Keep draft or Use service on each conflict.');
      if (Object.keys(applicableSchemaBuffers(current.current.buffers, visibleTables(snapshot.schema.tables, merged))).length) throw new Error('Correct incomplete numeric or default values before saving. Your text is retained.');
      const desired = {
        ...snapshot,
        schema: {
          ...snapshot.schema,
          tables: visibleTables(snapshot.schema.tables, merged)
        }
      };
      const validation = validateProject(desired);
      if (!validation.ok) {
        setMessages(validation.diagnostics);
        throw new OwnerError('VALIDATION_FAILED', 'Correct the highlighted schema diagnostics before saving.', validation.diagnostics);
      }
      const ops = tableOperations(merged);
      if (ops.length && !draftMode) await client.batch(snapshot, ops, createId());
      const saved = draftMode ? { ...desired, revision: snapshot.revision + 1 } : await client.snapshot(snapshot.id);
      onChanged(saved);
      setDrafts(d => checkpointDrafts(d, merged, saved.schema.tables));
      setMessages([]);
      setPast([]);
      setFuture([]);
      setStatus(draftMode ? 'Schema proposal updated. No database has been created or changed.' : 'Schema definition saved. Connected database is unchanged.');
      return saved;
    } catch (e) {
      report(e);
      return null;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  if (controller) controller.current = { save, dirty };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (active && !relationship && !reviewOpen && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!busy) void save();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [active, busy, relationship, reviewOpen]);
  async function preview() {
    setDialogError('');
    const saved = dirty ? await save() : await client.snapshot(project.id);
    if (!saved) return;
    setBusy(true);
    try {
      onChanged(saved);
      const plan = (await send('schema.preview', {
        desiredSchemaRevision: saved.schema.revision,
        backfills
      }, saved)) as Migration;
      setReview(plan);
      setReviewOpen(true);
      setAck([]);
      setClock(Date.now());
      setStatus('Read-only migration proposal recorded. Review SQL and exact impact before applying.');
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  const stale = !!review && (dirty || bufferedTables.length > 0 || review.sourceRevision !== project.revision || clock >= Date.parse(review.expiresAt));
  async function apply() {
    if (!review || stale) return;
    setBusy(true);
    try {
      const live = await client.snapshot(project.id);
      if (live.revision !== review.sourceRevision) {
        onChanged(live);
        throw new Error('Plan is stale. Refresh the preview before applying.');
      }
      const result = (await send('schema.apply', {
        planId: review.id,
        hash: review.hash,
        acknowledgedImpactIds: ack
      }, live)) as {
        committed: boolean;
        recoveryRequired: boolean;
        backupRef?: string;
      };
      onChanged(await client.snapshot(project.id));
      setStatus(result.recoveryRequired?'Migration needs recovery. Inspect migration history before another apply.':result.committed ? `Migration committed. Backup reference: ${result.backupRef ?? 'see migration history'}.` : 'Migration did not commit. Review diagnostics and migration history.');
      setReviewOpen(false);
      setReview(null);
    } catch (e) {
      report(e);
      setDialogError(e instanceof Error ? e.message : 'Apply failed.');
    } finally {
      setBusy(false);
    }
  }
  function propose(connection?: FlowConnection) {
    if (connection || !from) {
      setFrom(connection?.source ?? table?.id ?? tables[0]?.id ?? '');
      setTo(connection?.target ?? tables.find(t => t.id !== table?.id)?.id ?? '');
      setPairs([{
        local: connection?.sourceHandle ?? '',
        remote: connection?.targetHandle ?? ''
      }]);
      setOnDelete('restrict');
      setOnUpdate('restrict');
      setDeferred(false);
    }
    setDialogError('');
    setRelationship(true);
  }
  function addRelationship() {
    const source = tables.find(t => t.id === from),
      target = tables.find(t => t.id === to);
    if (!source || !target || pairs.some(p => !p.local || !p.remote) || new Set(pairs.map(p => p.local)).size !== pairs.length || new Set(pairs.map(p => p.remote)).size !== pairs.length) {
      setDialogError('Choose distinct local and referenced columns for each ordered pair.');
      return;
    }
    const value = {
      ...source,
      foreignKeys: [...source.foreignKeys, {
        id: createId(),
        columnIds: pairs.map(p => createId(() => p.local)),
        referencedTableId: target.id,
        referencedColumnIds: pairs.map(p => createId(() => p.remote)),
        onDelete,
        onUpdate,
        deferrable: deferred
      }]
    };
    const check = validateProject({
      ...candidate,
      schema: {
        ...candidate.schema,
        tables: tables.map(t => t.id === source.id ? value : t)
      }
    });
    if (!check.ok) {
      setDialogError(check.diagnostics.map(d => d.message).join(' '));
      return;
    }
    update(value);
    select(source.id);
    setTab('Relationships');
    setRelationship(false);
    setFrom('');
    setPairs([{
      local: '',
      remote: ''
    }]);
  }
  for (const table of tables) {
    if (!defaultPositions.current[table.id]) {
      const index = Object.keys(defaultPositions.current).length;
      defaultPositions.current[table.id] = { x: index % 4 * 280 + 28, y: Math.floor(index / 4) * 300 + 28 };
    }
  }
  const nodes: Node<GraphData>[] = tables.map(t => ({
    id: t.id,
    type: 'table',
    ...(measurements[t.id] ? { measured: measurements[t.id] } : {}),
    position: positions[t.id] ?? defaultPositions.current[t.id]!,
    selected: t.id === selected,
    data: {
      table: t,
      selected: column,
      select
    }
  }));
  const edges = tables.flatMap(t => t.foreignKeys.map(f => ({
    id: f.id,
    source: t.id,
    target: f.referencedTableId,
    sourceHandle: f.columnIds[0] ?? null,
    targetHandle: f.referencedColumnIds[0] ?? null,
    label: f.columnIds.length + ' column' + (f.columnIds.length === 1 ? '' : 's'),
    ariaLabel: 'Relationship from ' + t.physicalName,
    onClick: () => {
      select(t.id);
      setTab('Relationships');
    }
  })));
  const readOnly = table && project.schema.opaqueObjects.filter(o => o.id === table.id || o.dependencies.includes(table.id));
  const fieldError = (id: string) => [...localErrors, ...messages].filter(d => d.objectId === id).map(d => d.message).join(' ');
  function tuple(ids: StableId[]) {
    return ids.map(id => table?.columns.find(c => c.id === id)?.physicalName ?? id).join(', ');
  }
  const tuplePicker = (ids: StableId[], change: (ids: StableId[]) => void) => <div className="schema-tuple">{table?.columns.map(c => <label key={c.id}><input type="checkbox" checked={ids.includes(c.id)} onChange={e => change(e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))} />{c.physicalName || 'Unnamed'}</label>)}<ol>{ids.map((id, i) => <li key={id}>{table?.columns.find(c => c.id === id)?.physicalName}<button aria-label={'Move key column ' + (i + 1) + ' up'} disabled={!i} onClick={() => {
          const copy = [...ids];
          [copy[i - 1], copy[i]] = [copy[i]!, copy[i - 1]!];
          change(copy);
        }}>↑</button></li>)}</ol></div>;
  return <section className="schema-editor" aria-label="Schema editor" aria-busy={busy}><div className="schema-commandbar"><strong>Database schema</strong><button onClick={() => {
        const t = blankTable();
        update(t);
        select(t.id);
        setTab('Columns');
      }}>＋ Table</button><button disabled={!tables.length} onClick={() => propose()}>＋ Relationship</button><button disabled={busy || !dirty} onClick={() => void save()}>Save schema</button>{!draftMode && <button disabled={busy || !project.connections.length || !caps.operations.some(o => o.operation === 'schema.preview')} onClick={() => void preview()}>Review migration…</button>}<button disabled={!past.length || busy} onClick={() => {
        setFuture(f => [drafts, ...f]);
        setDrafts(past.at(-1)!);
        setPast(p => p.slice(0, -1));
      }}>Undo schema</button><button disabled={!future.length || busy} onClick={() => {
        setPast(p => [...p, drafts]);
        setDrafts(future[0]!);
        setFuture(f => f.slice(1));
      }}>Redo schema</button><span>{draftCount} drafts · r{project.revision}</span></div>
 {draftMode && <p className="schema-connection-note">Design the new database here. Complete will create these tables and keys; Back preserves your proposal.</p>}{!draftMode && !project.connections.length && <p className="schema-connection-note">No SQLite database is bound. Saved definitions remain separate from database tables. <button onClick={onConnection}>Connect SQLite…</button> to review migrations.</p>}<div className="schema-docks" {...draftFocus}><aside className="schema-explorer"><h2>Schema Explorer</h2><label className="schema-search">Find table or column<input aria-label="Find table or column" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="schema-table-list">{tables.filter(t => [t.physicalName, ...t.columns.map(c => c.physicalName)].some(n => n.toLowerCase().includes(search.toLowerCase()))).map(t => <button key={t.id} aria-pressed={selected === t.id} onClick={() => select(t.id)}>{t.physicalName || 'Unnamed table'}{drafts[t.id] ? ' *' : ''}<small>{t.columns.length} columns</small></button>)}</div><p className="pane-note">{tables.length} tables · {tables.reduce((n, t) => n + t.columns.length, 0)} columns</p>{Object.entries(drafts).filter(([, d]) => !d.value).map(([id, d]) => <button key={id} onClick={() => setDrafts(ds => {
          const copy = {
            ...ds
          };
          delete copy[id];
          return copy;
        })}>Undo deletion: {d.base?.physicalName}</button>)}{project.schema.opaqueObjects.length > 0 && <details><summary>Read-only imported objects ({project.schema.opaqueObjects.length})</summary>{project.schema.opaqueObjects.map(o => <p key={o.id}>{o.kind}: {o.physicalName} — unsupported SQL retained. Edits affecting dependencies may be blocked.</p>)}</details>}</aside>
 <div className="schema-center"><div className="schema-canvas-header"><span>Relationships / {table?.physicalName || 'Schema'}</span><Tabs label="Schema view" values={['Diagram', 'Table list']} active={mode} onChange={setMode} /></div><div className="schema-canvas" style={{
          display: mode === 'Diagram' ? 'block' : 'none'
        }}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={changes => {
            const dimensions = changes.flatMap(change => change.type === 'dimensions' && change.dimensions ? [{ id: change.id, dimensions: change.dimensions }] : []);
            if (dimensions.length) setMeasurements(previous => retainNodeMeasurements(previous, dimensions));
          }} onConnect={propose} onNodeDragStop={(_, node) => setPositions(p => ({
            ...p,
            [node.id]: node.position
          }))} onNodeClick={(_, node) => setSelected(node.id)} onEdgeClick={(_, edge) => {
            setSelected(edge.source);
            setTab('Relationships');
          }} minZoom={0.1} maxZoom={2} fitView={false} onlyRenderVisibleElements aria-label="Schema relationship diagram"><Background gap={20} /><Controls /></ReactFlow></div>{mode === 'Table list' && <div className="schema-list-view">{tables.map(t => <section key={t.id}><button onClick={() => select(t.id)}><strong>{t.physicalName || 'Unnamed table'}</strong></button>{t.columns.map(c => <button key={c.id} onClick={() => select(t.id, c.id)}>{c.physicalName} · {c.type.kind} · {c.nullable ? 'NULL' : 'NOT NULL'}</button>)}</section>)}</div>}<div className="schema-messages"><h2>Messages</h2><p role="status">{status}</p>{[...localErrors, ...messages].map((d, i) => <button key={i} onClick={() => {
            const t = tables.find(t => t.id === d.objectId || t.columns.some(c => c.id === d.objectId));
            if (t) select(t.id, d.objectId === t.id ? '' : d.objectId);
          }}><code>{d.code}</code> {d.message}</button>)}</div></div>
 <aside className="schema-properties"><section className="schema-tools"><h2>Schema Toolbox</h2><p>Author stable definitions, then review migration SQL. Drag between column handles or use Relationship for keyboard authoring.</p><p>Layout positions are view preferences and never change database semantics.</p></section><h2>Properties · {currentColumn ? 'Column' : table ? 'Table' : 'Schema'}</h2>{table ? <><label className="schema-field">Table name<input aria-label="Table name" value={table.physicalName} aria-invalid={!!fieldError(table.id)} onChange={e => update({
              ...table,
              physicalName: e.target.value
            })} /></label>{fieldError(table.id) && <p className="schema-error">{fieldError(table.id)}</p>}{readOnly && readOnly.length > 0 && <p className="schema-warning">Imported read-only dependencies: {readOnly.map(o => o.physicalName).join(', ')}. Unsupported semantics are preserved; preview may block this edit.</p>}{drafts[table.id]?.conflicts.length ? <div role="alert" className="schema-warning">Service edits conflict: {drafts[table.id]!.conflicts.join(', ')}<button onClick={() => setDrafts(d => ({
              ...d,
              [table.id]: {
                ...d[table.id]!,
                base: project.schema.tables.find(t => t.id === table.id),
                conflicts: []
              }
            }))}>Keep draft</button><button onClick={() => setDrafts(d => {
              const next = {
                ...d
              };
              delete next[table.id];
              return next;
            })}>Use service</button></div> : null}<Tabs label="Schema properties" values={['Columns', 'Keys', 'Constraints', 'Indexes', 'Relationships']} active={tab} onChange={setTab} />
 <div className="schema-property-body">{tab === 'Columns' && <><div className="schema-column-list">{table.columns.map(c => <button key={c.id} aria-pressed={column === c.id} onClick={() => setColumn(c.id)}>{c.physicalName || 'Unnamed column'} · {c.type.kind}</button>)}</div><button onClick={() => {
                const c: Column = {
                  id: createId(),
                  physicalName: '',
                  type: {
                    kind: 'text'
                  },
                  nullable: true
                };
                update({
                  ...table,
                  columns: [...table.columns, c]
                });
                setColumn(c.id);
              }}>＋ Column</button>{currentColumn && <><label className="schema-field">Column name<input aria-label="Column name" value={currentColumn.physicalName} aria-invalid={!!fieldError(column)} onChange={e => updateColumn({
                    physicalName: e.target.value
                  })} /></label><label className="schema-field">Logical type<select aria-label="Logical type" value={currentColumn.type.kind} onChange={e => updateColumn({
                    type: typeFor(e.target.value)
                  })}>{kinds.map(kind => <option key={kind}>{kind}</option>)}</select></label><label className="schema-field">Physical storage<output>{storage(currentColumn.type)}{physicalDeclaration ? ' · imported ' + physicalDeclaration + ' (preserved when unchanged)' : ''}</output></label>{currentColumn.type.kind === 'decimal' && <><label className="schema-field">Physical encoding<select aria-label="Physical encoding" value={currentColumn.type.encoding} onChange={e => updateColumn({
                      type: {
                        ...(currentColumn.type as Extract<ScalarType, {
                          kind: 'decimal';
                        }>),
                        encoding: e.target.value as 'text' | 'scaled-integer'
                      }
                    })}><option value="text">TEXT exact decimal</option><option value="scaled-integer">INTEGER scaled</option></select></label>{(['scale', 'precision'] as const).map(key => <label className="schema-field" key={key}>{key}<input aria-label={'Decimal ' + key} inputMode="numeric" aria-invalid={buffers[`${column}:${key}`] !== undefined} value={buffers[`${column}:${key}`] ?? (currentColumn.type as Extract<ScalarType, { kind: 'decimal' }>)[key]} onChange={e => {
                      const text = e.target.value, bufferKey = `${column}:${key}`;
                      if (!/^[+-]?\d+$/.test(text) || !Number.isSafeInteger(Number(text))) {
                        setBuffers(b => ({ ...b, [bufferKey]: text }));
                      } else {
                        setBuffers(b => { const next = { ...b }; delete next[bufferKey]; return next; });
                        updateColumn({ type: { ...(currentColumn.type as Extract<ScalarType, { kind: 'decimal' }>), [key]: Number(text) } });
                      }
                    }} /></label>)}<label className="schema-field">Rounding<select aria-label="Decimal rounding" value={currentColumn.type.rounding} onChange={e => updateColumn({
                      type: {
                        ...(currentColumn.type as Extract<ScalarType, {
                          kind: 'decimal';
                        }>),
                        rounding: e.target.value as 'half-up' | 'half-even' | 'down'
                      }
                    })}>{['half-up', 'half-even', 'down'].map(v => <option key={v}>{v}</option>)}</select></label></>}<label><input type="checkbox" checked={currentColumn.nullable} onChange={e => updateColumn({
                    nullable: e.target.checked
                  })} />Allow NULL</label><label><input type="checkbox" checked={currentColumn.default !== undefined || buffers[column] !== undefined} onChange={e => {
                    if (e.target.checked) {
                      updateColumn({
                        default: literal(currentColumn.type.kind === 'integer' || currentColumn.type.kind === 'real' ? '0' : currentColumn.type.kind === 'boolean' ? 'false' : '', currentColumn.type)
                      });
                    } else {
                      const {
                        default: _default,
                        ...rest
                      } = currentColumn;
                      update({
                        ...table,
                        columns: table.columns.map(c => c.id === column ? rest : c)
                      });
                      setBuffers(b => {
                        const next = {
                          ...b
                        };
                        delete next[column];
                        return next;
                      });
                    }
                  }} />Default present</label><label className="schema-field">Default literal<input aria-label="Default literal" value={buffers[column] ?? (currentColumn.default?.kind === 'literal' ? String(currentColumn.default.value) : '')} onChange={e => {
                    const text = e.target.value;
                    try {
                      const {
                        default: _default,
                        ...rest
                      } = currentColumn;
                      const c = {
                        ...rest,
                        default: literal(text, currentColumn.type)
                      };
                      update({
                        ...table,
                        columns: table.columns.map(v => v.id === column ? c : v)
                      });
                      setBuffers(b => {
                        const next = {
                          ...b
                        };
                        delete next[column];
                        return next;
                      });
                    } catch {
                      setBuffers(b => ({
                        ...b,
                        [column]: text
                      }));
                    }
                  }} /></label>{buffers[column] !== undefined && <p className="schema-error" role="alert">Invalid default. Use a finite number, true/false for boolean, or NULL.</p>}<p className="pane-note">Defaults are typed literals; use NULL for null. Clear Default present to remove a default. Arbitrary SQL is unsupported.</p>{fieldError(column) && <p className="schema-error">{fieldError(column)}</p>}<button onClick={() => {
                  update({
                    ...table,
                    columns: table.columns.filter(c => c.id !== column)
                  });
                  setColumn('');
                }}>Delete column</button></>}</>}
 {tab === 'Keys' && <><h3>Ordered primary key</h3>{tuplePicker(table.primaryKey, primaryKey => update({
                ...table,
                primaryKey
              }))}<p className="pane-note">Select columns in order. Move up to reorder composite keys. Unique constraints are in Constraints.</p></>}
 {tab === 'Constraints' && <Constraints table={table} panel={panel} updatePanel={updatePanel} update={update} tuplePicker={tuplePicker} tuple={tuple} />}
 {tab === 'Indexes' && <Indexes table={table} panel={panel} updatePanel={updatePanel} update={update} tuplePicker={tuplePicker} tuple={tuple} />}
 {tab === 'Relationships' && <><button onClick={() => propose()}>Create relationship…</button>{table.foreignKeys.map(f => <section className="schema-item" key={f.id}><strong>{tuple(f.columnIds)} → {tables.find(t => t.id === f.referencedTableId)?.physicalName}</strong><ol>{f.columnIds.map((id, i) => <li key={id}>{table.columns.find(c => c.id === id)?.physicalName} → {tables.find(t => t.id === f.referencedTableId)?.columns.find(c => c.id === f.referencedColumnIds[i])?.physicalName}</li>)}</ol><p>Delete: {f.onDelete} · Update: {f.onUpdate} · {f.deferrable ? 'deferred' : 'immediate'}</p><button onClick={() => update({
                  ...table,
                  foreignKeys: table.foreignKeys.filter(v => v.id !== f.id)
                })}>Remove relationship</button></section>)}</>}
 <button className="schema-danger" onClick={() => {
              update(null, table.id);
              setSelected('');
              setColumn('');
            }}>Delete table draft</button></div></> : <p className="pane-note">Select a table, or add a table to begin. Keyboard authoring is available in the list and relationship dialog.</p>}</aside></div>
 {relationship && <Dialog title="Create relationship" onCancel={() => setRelationship(false)}><div className="schema-dialog-scroll"><p>Choose ordered local → referenced column pairs. The target tuple must be a primary or unique key.</p><label className="dialog-field">Local table<select aria-label="Local table" value={from} onChange={e => {
            setFrom(e.target.value);
            setPairs([{
              local: '',
              remote: ''
            }]);
          }}>{tables.map(t => <option key={t.id} value={t.id}>{t.physicalName}</option>)}</select></label><label className="dialog-field">Referenced table<select aria-label="Referenced table" value={to} onChange={e => {
            setTo(e.target.value);
            setPairs([{
              local: '',
              remote: ''
            }]);
          }}>{tables.map(t => <option key={t.id} value={t.id}>{t.physicalName}</option>)}</select></label>{pairs.map((pair, i) => <div className="schema-pair" key={i}><span>{i + 1}.</span><select aria-label={'Local column ' + (i + 1)} value={pair.local} onChange={e => setPairs(p => p.map((v, n) => n === i ? {
            ...v,
            local: e.target.value
          } : v))}><option value="">Choose column</option>{tables.find(t => t.id === from)?.columns.map(c => <option key={c.id} value={c.id}>{c.physicalName}</option>)}</select><span>→</span><select aria-label={'Referenced column ' + (i + 1)} value={pair.remote} onChange={e => setPairs(p => p.map((v, n) => n === i ? {
            ...v,
            remote: e.target.value
          } : v))}><option value="">Choose column</option>{tables.find(t => t.id === to)?.columns.map(c => <option key={c.id} value={c.id}>{c.physicalName}</option>)}</select><button aria-label={'Remove pair ' + (i + 1)} disabled={pairs.length === 1} onClick={() => setPairs(p => p.filter((_, n) => n !== i))}>×</button></div>)}<button onClick={() => setPairs(p => [...p, {
          local: '',
          remote: ''
        }])}>Add ordered pair</button><label className="dialog-field">On delete<select aria-label="On delete" value={onDelete} onChange={e => setOnDelete(e.target.value as typeof onDelete)}>{actions.map(a => <option key={a}>{a}</option>)}</select></label><label className="dialog-field">On update<select aria-label="On update" value={onUpdate} onChange={e => setOnUpdate(e.target.value as typeof onUpdate)}>{actions.map(a => <option key={a}>{a}</option>)}</select></label><label><input type="checkbox" checked={deferred} onChange={e => setDeferred(e.target.checked)} />Deferrable</label>{dialogError && <p role="alert" className="schema-error">{dialogError}</p>}</div><div className="dialog-actions"><button onClick={() => setRelationship(false)}>Cancel</button><button className="primary" onClick={addRelationship}>Add relationship draft</button></div></Dialog>}
 {reviewOpen && review && <Dialog title="Review migration" onCancel={() => setReviewOpen(false)} busy={busy}><div className="schema-dialog-scroll"><p>{review.steps.length} SQL steps · source revision {review.sourceRevision} · expires {review.expiresAt}</p>{stale && <p role="alert" className="schema-warning">This plan is stale. A schema draft, service revision, or expiry changed. Cancel and request a fresh preview.</p>}<details><summary>Exact proposal identity</summary><p>Plan: <code>{review.id}</code></p><p>Hash: <code>{review.hash}</code></p><p>Schema: <code>{review.schemaFingerprint}</code></p><p>Data: <code>{review.dataFingerprint}</code></p></details><h3>Reviewed SQL</h3>{review.steps.map(step => <pre key={step.id}><code>{step.sql}</code></pre>)}<h3>Impact and dependencies</h3>{review.impact.length ? review.impact.map(i => <div className="schema-item" key={i.id}>{i.requiresAcknowledgement ? <label><input type="checkbox" checked={ack.includes(i.id)} disabled={stale} onChange={e => setAck(a => e.target.checked ? [...a, i.id] : a.filter(id => id !== i.id))} />{i.description}</label> : <p>{i.description}</p>}<small>{i.kind} · {i.affectedCount ?? 'unknown'} affected rows · object {i.objectId ?? 'project'} · impact <code>{i.id}</code></small></div>) : <p>No impact rows.</p>}<h3>Backup and recovery</h3><p>Required SQLite online backup in approved root <code>{review.backupPolicy.approvedRootId}</code>. The executor allocates the exact backup location during apply; no backup has been made by preview.</p>{review.recovery?.instructions.map(s => <p key={s}>{s}</p>)}{dialogError && <p role="alert" className="schema-error">{dialogError}</p>}{!caps.operations.some(o => o.operation === 'schema.apply') && <p className="schema-warning">Migration apply is unavailable in this owner. This review cannot change the database.</p>}</div><div className="dialog-actions"><button disabled={busy} onClick={() => setReviewOpen(false)}>Cancel review</button><button className="primary" disabled={busy || stale || !caps.operations.some(o => o.operation === 'schema.apply') || review.requiredAcknowledgementIds.some(id => !ack.includes(id))} onClick={() => void apply()}>Apply reviewed migration</button></div></Dialog>}
 <details className="schema-backfill"><summary>Backfill rules ({backfills.length})</summary><p>Preview requires a typed value for newly required columns with existing rows. Rules are explicit proposal inputs.</p><select aria-label="Backfill column" value={backfillColumn} onChange={e => setBackfillColumn(e.target.value)}><option value="">Choose target column</option>{tables.flatMap(t => t.columns.map(c => <option key={c.id} value={t.id + ':' + c.id}>{t.physicalName}.{c.physicalName}</option>))}</select><input aria-label="Backfill literal" value={backfillText} onChange={e => setBackfillText(e.target.value)} /><button onClick={() => {
        try {
          const t = tables.find(t => t.id === backfillColumn.split(':')[0]),
            c = t?.columns.find(c => c.id === backfillColumn.split(':')[1]);
          if (!t || !c) throw new Error('Choose a backfill target.');
          setBackfills(b => [...b.filter(v => v.columnId !== c.id), {
            tableId: t.id,
            columnId: c.id,
            expression: literal(backfillText, c.type)
          }]);
          setReview(null);
          setStatus('Backfill rule added; request a fresh preview.');
        } catch (e) {
          report(e);
        }
      }}>Set backfill rule</button>{backfills.map(b => <p key={b.columnId}>{tables.find(t => t.id === b.tableId)?.physicalName}.{tables.find(t => t.id === b.tableId)?.columns.find(c => c.id === b.columnId)?.physicalName} = {b.expression.kind === 'literal' ? String(b.expression.value) : 'expression'}<button onClick={() => {
          setBackfills(v => v.filter(x => x.columnId !== b.columnId));
          setReview(null);
        }}>Remove rule</button></p>)}</details>
 </section>;
}
function Constraints({
  table,
  panel,
  updatePanel,
  update,
  tuplePicker,
  tuple
}: {
  table: Table;
  panel: Panel;
  updatePanel: (p: Partial<Panel>) => void;
  update: (t: Table) => void;
  tuplePicker: (ids: StableId[], change: (ids: StableId[]) => void) => React.ReactNode;
  tuple: (ids: StableId[]) => string;
}) {
  const ids = panel.uniqueIds.map(id => createId(() => id)),
    setIds = (v: StableId[]) => updatePanel({
      uniqueIds: v
    }),
    field = panel.checkField,
    setField = (v: string) => updatePanel({
      checkField: v
    }),
    operator = panel.checkOperator,
    setOperator = (v: Panel['checkOperator']) => updatePanel({
      checkOperator: v
    }),
    value = panel.checkValue,
    setValue = (v: string) => updatePanel({
      checkValue: v
    });
  const [error, setError] = useState('');
  return <><h3>Unique constraints</h3>{table.uniqueConstraints.map(u => <p className="schema-item" key={u.id}>{tuple(u.columnIds)}<button onClick={() => update({
        ...table,
        uniqueConstraints: table.uniqueConstraints.filter(v => v.id !== u.id)
      })}>Remove unique</button></p>)}{tuplePicker(ids, setIds)}<button disabled={!ids.length} onClick={() => {
      update({
        ...table,
        uniqueConstraints: [...table.uniqueConstraints, {
          id: createId(),
          columnIds: ids
        }]
      });
      setIds([]);
    }}>Add unique constraint</button><h3>Check constraints</h3>{table.checks.map(c => <div className="schema-item" key={c.id}><code>{JSON.stringify(c.expression)}</code><button onClick={() => update({
        ...table,
        checks: table.checks.filter(v => v.id !== c.id)
      })}>Remove check</button></div>)}<label className="schema-field">Check column<select aria-label="Check column" value={field} onChange={e => setField(e.target.value)}><option value="">Choose column</option>{table.columns.map(c => <option key={c.id} value={c.id}>{c.physicalName}</option>)}</select></label><label className="schema-field">Comparison<select aria-label="Check comparison" value={operator} onChange={e => setOperator(e.target.value as typeof operator)}>{['=', '!=', '>', '>=', '<', '<='].map(o => <option key={o}>{o}</option>)}</select></label><label className="schema-field">Check literal<input aria-label="Check literal" value={value} onChange={e => setValue(e.target.value)} /></label><button onClick={() => {
      try {
        const c = table.columns.find(c => c.id === field);
        if (!c) throw new Error('Choose a check column.');
        update({
          ...table,
          checks: [...table.checks, {
            id: createId(),
            expression: {
              kind: 'binary',
              operator,
              left: {
                kind: 'field',
                alias: 'self',
                fieldId: c.id
              },
              right: literal(value, c.type)
            }
          }]
        });
        setError('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid check.');
      }
    }}>Add check constraint</button>{error && <p role="alert" className="schema-error">{error}</p>}</>;
}
function Indexes({
  table,
  panel,
  updatePanel,
  update,
  tuplePicker,
  tuple
}: {
  table: Table;
  panel: Panel;
  updatePanel: (p: Partial<Panel>) => void;
  update: (t: Table) => void;
  tuplePicker: (ids: StableId[], change: (ids: StableId[]) => void) => React.ReactNode;
  tuple: (ids: StableId[]) => string;
}) {
  const name = panel.indexName,
    setName = (v: string) => updatePanel({
      indexName: v
    }),
    ids = panel.indexIds.map(id => createId(() => id)),
    setIds = (v: StableId[]) => updatePanel({
      indexIds: v
    }),
    unique = panel.indexUnique,
    setUnique = (v: boolean) => updatePanel({
      indexUnique: v
    });
  return <><h3>Indexes</h3>{table.indexes.map(i => <p className="schema-item" key={i.id}>{i.physicalName} ({tuple(i.columnIds)}) {i.unique ? 'UNIQUE' : ''}<button onClick={() => update({
        ...table,
        indexes: table.indexes.filter(v => v.id !== i.id)
      })}>Remove index</button></p>)}<label className="schema-field">Index name<input aria-label="Index name" value={name} onChange={e => setName(e.target.value)} /></label>{tuplePicker(ids, setIds)}<label><input type="checkbox" checked={unique} onChange={e => setUnique(e.target.checked)} />Unique index</label><button disabled={!name.trim() || !ids.length} onClick={() => {
      update({
        ...table,
        indexes: [...table.indexes, {
          id: createId(),
          physicalName: name,
          columnIds: ids,
          unique
        }]
      });
      setIds([]);
      setName('');
    }}>Add index</button><p className="pane-note">Supported authoring creates full ascending indexes. Imported directions and collations are preserved or preview blocks the edit.</p></>;
}
