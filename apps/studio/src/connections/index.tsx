"use client";
import { useState } from 'react';
import { createId } from '@schema-baron/model';
import type { OperationResult, Project } from '@schema-baron/model';
import type { StudioClient } from '../project-ui/api.js';
export function ConnectionSetup({ project, client, roots, onBound, onClose }: { project: Project; client: StudioClient; roots: string[]; onBound: (snapshot: Project) => void; onClose: () => void }) {
 const [mode, setMode] = useState('existing'); const [root, setRoot] = useState(roots[0] ?? ''); const [path, setPath] = useState(''); const [preview, setPreview] = useState<OperationResult<'connection.inspect'> | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
 const [reconnect, setReconnect] = useState(project.connections[0]?.id ?? '');
 const selected = `${root}:${path}`;
 function reset() { setPreview(null); setError(''); }
 async function inspect() {
  setBusy(true); setError(''); setPreview(null);
  try { setPreview(await client.read(`projects/${encodeURIComponent(project.id)}/commands`, { requestId: createId(), operation: 'connection.inspect', expectedRevision: project.revision, input: { approvedPath: selected, mode: 'read-only', ...(mode === 'empty' ? { createEmpty: true } : {}), ...(reconnect ? { connectionId: reconnect } : {}) } })); }
  catch (error) { setError(error instanceof Error ? error.message : 'Inspection failed. Retry.'); }
  finally { setBusy(false); }
 }
 async function bind() {
  if (!preview) return; setBusy(true); setError('');
  try { await client.read(`projects/${encodeURIComponent(project.id)}/commands`, { requestId: createId(), operation: 'connection.bind', expectedRevision: project.revision, input: { connectionId: preview.connection.id, fingerprint: preview.connection.fingerprint } }); onBound(await client.snapshot(project.id)); }
  catch (error) { setError(error instanceof Error ? error.message : 'Binding failed. Inspect again.'); setPreview(null); }
  finally { setBusy(false); }
 }
 return <div className="connection-setup" style={{ display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', maxHeight: 'calc(100dvh - 130px)', overflowWrap: 'anywhere' }}>
  <div style={{ minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
  <p>Select an owner-approved location. Inspection reads existing objects without running DDL. Binding imports their schema into this project.</p>
  <label className="dialog-field">Database choice<select aria-label="Database choice" value={mode} disabled={busy} onChange={e => { setMode(e.target.value); reset(); }}><option value="existing">Existing SQLite file</option><option value="empty">Create new empty SQLite file</option></select></label>
  {mode === 'empty' && <p>A new empty file is created when you select Inspect. An existing file is never replaced.</p>}
  <label className="dialog-field">Approved database root<select aria-label="Approved database root" value={root} disabled={busy} onChange={e => { setRoot(e.target.value); reset(); }}>{roots.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
  <label className="dialog-field">Relative SQLite file<input aria-label="Relative SQLite file" value={path} disabled={busy} onChange={e => { setPath(e.target.value); reset(); }} placeholder="data/application.sqlite" /></label>
  {project.connections.length > 0 && <label className="dialog-field">Connection identity<select aria-label="Connection identity" disabled={busy} value={reconnect} onChange={e => { setReconnect(e.target.value); reset(); }}>{project.connections.map(c => <option key={c.id} value={c.id}>Reconnect {c.name}</option>)}</select></label>}

  {preview && <section aria-label="Database inspection"><h3>Schema and capabilities</h3><p>SQLite {preview.connection.capabilities.sqliteVersion} · {preview.connection.physical?.encoding} · Foreign keys {preview.connection.capabilities.foreignKeys ? 'enabled' : 'unavailable'} · RETURNING {preview.connection.capabilities.returning ? 'supported' : 'unavailable'} · STRICT {preview.connection.capabilities.strictTables ? 'supported' : 'unavailable'}</p>
   <p>{preview.schema.tables.length} tables · {preview.schema.opaqueObjects.length} read-only unsupported objects</p>
   <details><summary>About imported types</summary><p>Logical types for nonstandard declarations are unconfirmed. Exact declarations, defaults and expressions are retained in original metadata and read-only SQL.</p></details>
   <div style={{ maxHeight: 160, overflow: 'auto' }}><ul>{preview.schema.tables.map(t => <li key={t.id}><strong>{t.physicalName}</strong> · {t.columns.length} columns · {t.primaryKey.length} key columns · {t.foreignKeys.length} foreign keys · {t.indexes.length} indexes<details><summary>Columns and original metadata</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(preview.connection.physical?.tables.find(p => p.name === t.physicalName), null, 2)}</pre></details></li>)}</ul>
   {preview.schema.opaqueObjects.map(o => <details key={o.id}><summary>Read-only {o.kind}: {o.physicalName}</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{o.sql}</pre></details>)}</div>
   <p>Fingerprint: <code>{preview.connection.fingerprint.slice(0,16)}…</code></p>
  </section>}
  </div>
  <div style={{ background: 'white', paddingTop: 4 }}>
   <p>Selected location: <code>{selected}</code></p>
   {preview && preview.schema.opaqueObjects.length > 0 && <p role="status">{preview.schema.opaqueObjects.length} unsupported objects retained as read-only SQL.</p>}
   {error && <p role="alert">{error}</p>}
   <div className="dialog-actions" style={{ marginTop: 8 }}><button disabled={busy} onClick={onClose}>Cancel</button><button disabled={busy || !root || !path} onClick={() => void inspect()}>{busy ? 'Working…' : 'Inspect SQLite file'}</button>{preview && <button className="primary" disabled={busy} onClick={() => void bind()}>Bind inspected database</button>}</div>
  </div>
 </div>;
}
