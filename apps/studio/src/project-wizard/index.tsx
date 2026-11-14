'use client';
import { useRef, useState } from 'react';
import { createId, parseProject } from '@schema-baron/model';
import type { Project, Schema } from '@schema-baron/model';
import type { StudioClient, Capabilities } from '../project-ui/api.js';
import { SchemaEditor } from '../schema-editor/index.js';
import type { SchemaEditorController } from '../schema-editor/index.js';
import { ApplicationFlow } from '../flow-map/preview.js';
import type { ApplicationOptions, SetupPreview } from '../server/setup.js';
import './styles.css';
const steps = ['Project', 'Database', 'Schema', 'Pages', 'Login and access', 'Navigation', 'Review'];
function draftProject(): Project {
 const id = createId(), policy = createId();
 return parseProject({ id, name: 'New application', formatVersion: 1, revision: 1, target: 'next-typescript-sqlite', targetVersion: '1', connectionRefs: [], connections: [], schema: { id: createId(), revision: 1, tables: [], opaqueObjects: [] }, queries: [], pages: [], forms: [], controls: [], actions: [], policies: [{ id: policy, ownerId: id, scope: 'global', access: 'public' }], globalPolicyId: policy, outputConfig: { approvedRootId: 'output', relativePath: 'generated/app' }, extensionContracts: [] });
}
export function ProjectWizard({ client, caps, onFinished, onCancel, onBusy }: { client: StudioClient; caps: Capabilities; onFinished: (project: Project) => Promise<void>; onCancel: () => void; onBusy: (busy: boolean) => void }) {
 const [step, setStep] = useState(0), [mode, setMode] = useState('guided');
 const [project, setProject] = useState(draftProject), [name, setName] = useState(''), [folder, setFolder] = useState(caps.workspace?.projectsFolder ?? '');
 const [database, setDatabase] = useState<'new' | 'existing'>('new'), [file, setFile] = useState('application.sqlite'), [existingPath, setExistingPath] = useState('');
 const [inspection, setInspection] = useState<{ inspectionId: string; schema: Schema; path: string; tableCount: number; unsupportedCount: number } | null>(null);
 const [choices, setChoices] = useState<ApplicationOptions['tables']>([]), [login, setLogin] = useState(false), [protectWrites, setProtectWrites] = useState(true), [menu, setMenu] = useState(true), [startTable, setStartTable] = useState('');
 const [preview, setPreview] = useState<SetupPreview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
 const schemaController = useRef<SchemaEditorController | null>(null);
 const enteredSchema = useRef(false);
 function work(value: boolean) { setBusy(value); onBusy(value); }
 function selectTables(p: Project) {
  setChoices(previous => p.schema.tables.map(table => {
   const prior = previous.find(c => c.tableId === table.id);
   const supported = table.columns.some(c => c.type.kind !== 'blob');
   const editable = !!table.primaryKey.length && table.primaryKey.every(id => table.columns.find(c => c.id === id)?.type.kind !== 'blob') && table.columns.every(c => c.type.kind !== 'blob' || c.nullable || !!c.default || !!c.generated);
   const list = supported && (prior?.list ?? true);
   return { tableId: table.id, list, record: list && editable && (prior?.record ?? true), search: list && (prior?.search ?? true) };
  }));
  setStartTable(previous => p.schema.tables.some(t => t.id === previous) ? previous : p.schema.tables[0]?.id ?? '');
 }
 async function next() {
  setError(''); work(true);
  try {
   if (step === 0) {
    if (!name.trim() || name !== name.trim() || /[\\/\x00-\x1f<>:"|?*]/.test(name) || name.endsWith('.') || ['.', '..'].includes(name)) throw Error('Enter a project name suitable for a folder, without slashes or reserved characters.');
    if (!folder.startsWith('/') && !folder.startsWith('~/')) throw Error('Choose an absolute project location or a ~/ path.');
    setProject(p => ({ ...p, name }));
    if (mode === 'blank') { const result = await client.create(name, '', project.id, folder); await onFinished(result); return; }
   }
   if (step === 1) {
    if (database === 'existing') {
     if (!existingPath.trim()) throw Error('Enter the path to an existing SQLite database.');
     const found = await client.read<NonNullable<typeof inspection>>('setup/inspect', { path: existingPath });
     setInspection(found); setProject(p => ({ ...p, schema: found.schema, revision: p.revision + 1 }));
     setStatus(`Database read successfully: ${found.tableCount} tables, ${found.unsupportedCount} preserved unsupported objects. The database is unchanged.`);
    } else {
     if (/[\\/]/.test(file) || !/\.(sqlite|sqlite3|db)$/i.test(file)) throw Error('Enter a SQLite filename such as application.sqlite.');
     if (inspection) { setProject(p => ({ ...p, schema: { ...p.schema, tables: [], opaqueObjects: [] }, revision: p.revision + 1 })); setInspection(null); }
     setStatus('The database will be created when you complete setup. Define its tables and keys next.');
    }
    enteredSchema.current = true;
   }
   if (step === 2) {
    let proposed = project;
    if (database === 'new' && schemaController.current?.dirty) {
     const saved = await schemaController.current.save();
     if (!saved) throw Error('Correct the schema errors before continuing.');
     proposed = saved; setProject(saved);
    }
    if (!proposed.schema.tables.length) throw Error('Create at least one table, or go back and choose Blank project.');
    selectTables(proposed);
   }
   if (step === 3) {
    const selected = choices.filter(c => c.list);
    if (!selected.length) throw Error('Select at least one list page.');
    if (!selected.some(c => c.tableId === startTable)) setStartTable(selected[0]!.tableId);
   }
   if (step === 5) {
    const result = await client.read<SetupPreview>('setup/preview', { requestId: project.id, name, projectsFolder: folder, schema: project.schema, database: database === 'new' ? { kind: 'new', file } : { kind: 'existing', inspectionId: inspection?.inspectionId }, options: { tables: choices, login, protectWrites: login && protectWrites, menu, startTableId: startTable } });
    setPreview(result);
   }
   if (step === 6) {
    if (!preview) throw Error('Review the application before completing setup.');
    const result = await client.read<Project>('setup/complete', { planId: preview.planId });
    await onFinished(result); return;
   }
   setStep(value => value + 1);
  } catch (failure) { setError(failure instanceof Error ? failure.message : 'Setup could not continue. Your choices are retained.'); }
  finally { work(false); }
 }
 function updateChoice(id: string, patch: Partial<ApplicationOptions['tables'][number]>) { setChoices(items => items.map(c => c.tableId === id ? { ...c, ...patch, ...(patch.list === false ? { record: false, search: false } : {}) } : c)); }
 return <div className="project-wizard">
  <ol className="project-wizard-steps" aria-label="New project steps">{steps.map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}</ol>
  <div className="project-wizard-content">
   {step === 0 && <section><h3>What would you like to create?</h3><fieldset disabled={busy}><legend>Project setup</legend><label><input type="radio" name="setupMode" value="guided" checked={mode === 'guided'} onChange={() => setMode('guided')} /> Guided application — database, schema, pages, login and flow preview</label><label><input type="radio" name="setupMode" value="blank" checked={mode === 'blank'} onChange={() => setMode('blank')} /> Blank project — configure everything yourself</label></fieldset><label className="dialog-field">Project name<input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={120} disabled={busy} /></label><label className="dialog-field">Project location<input value={folder} onChange={e => setFolder(e.target.value)} disabled={busy} /></label><p>Project folder: <code>{folder}/{name || '<project name>'}</code></p><p>Missing folders are created automatically. Existing project folders are never overwritten.</p><p>Output: Next.js · TypeScript · SQLite</p></section>}
   {step === 1 && <section><h3>Choose your database</h3><fieldset disabled={busy}><legend>Database</legend><label><input type="radio" name="databaseChoice" checked={database === 'new'} onChange={() => setDatabase('new')} /> Create a new SQLite database</label><label><input type="radio" name="databaseChoice" checked={database === 'existing'} onChange={() => setDatabase('existing')} /> Use an existing SQLite database</label></fieldset>{database === 'new' ? <><label className="dialog-field">Database filename<input value={file} onChange={e => setFile(e.target.value)} disabled={busy} /></label><p>Location: <code>{folder}/{name}/{file}</code></p><p>Next opens the schema editor. The file and tables are created only when you choose Complete.</p></> : <><label className="dialog-field">SQLite database path<input value={existingPath} onChange={e => setExistingPath(e.target.value)} placeholder="~/databases/my-application.sqlite" disabled={busy} /></label><p>Next reads its tables and keys without changing the database, then shows you what was found.</p></>}</section>}
   {enteredSchema.current && database === 'new' && <section className="wizard-schema" style={{ display: step === 2 ? 'block' : 'none' }}><SchemaEditor key={project.id} project={project} client={client} caps={caps} active={step === 2} draftMode controller={schemaController} onConnection={() => {}} onChanged={setProject} /></section>}
   {step === 2 && database === 'existing' && <section><h3>Review existing database</h3><p role="status">{status}</p><p><code>{inspection?.path}</code></p><table className="wizard-table"><thead><tr><th>Table</th><th>Columns</th><th>Primary key</th><th>Relationships</th></tr></thead><tbody>{project.schema.tables.map(t => <tr key={t.id}><th>{t.physicalName}</th><td>{t.columns.length}</td><td>{t.primaryKey.map(id => t.columns.find(c => c.id === id)?.physicalName).join(', ') || 'None — list only'}</td><td>{t.foreignKeys.length}</td></tr>)}</tbody></table><p>Existing tables and rows will be preserved. The same schema tools remain available after setup for reviewed changes.</p></section>}
   {step === 3 && <section><h3>Choose your application pages</h3><p>Lists are public. Record pages include Add, Edit, Delete, Cancel, and return links. Tables without a supported primary key can have lists.</p><table className="wizard-table"><thead><tr><th>Table</th><th>List</th><th>Add / edit record</th><th>Search</th></tr></thead><tbody>{project.schema.tables.map(t => { const c = choices.find(c => c.tableId === t.id); return <tr key={t.id}><th>{t.physicalName}</th><td><input type="checkbox" aria-label={`List ${t.physicalName}`} checked={c?.list ?? false} onChange={e => updateChoice(t.id, { list: e.target.checked })} /></td><td><input type="checkbox" aria-label={`Record ${t.physicalName}`} checked={c?.record ?? false} disabled={!c?.list || !t.primaryKey.length || t.primaryKey.some(id => t.columns.find(c => c.id === id)?.type.kind === 'blob') || t.columns.some(c => c.type.kind === 'blob' && !c.nullable && !c.default && !c.generated)} onChange={e => updateChoice(t.id, { record: e.target.checked })} /></td><td><input type="checkbox" aria-label={`Search ${t.physicalName}`} checked={c?.search ?? false} disabled={!c?.list} onChange={e => updateChoice(t.id, { search: e.target.checked })} /></td></tr>; })}</tbody></table></section>}
   {step === 4 && <section><h3>Login and access</h3><label><input type="checkbox" checked={login} onChange={e => setLogin(e.target.checked)} /> Enable simple visitor login</label><label><input type="checkbox" checked={protectWrites} disabled={!login} onChange={e => setProtectWrites(e.target.checked)} /> Require login to add, edit or delete records</label><p>Lists stay public. With login enabled, setup creates a public Login page and identity controls. You can create visitor accounts in Login and access after setup.</p></section>}
   {step === 5 && <section><h3>Navigation and appearance</h3><label className="dialog-field">Starting page<select value={startTable} onChange={e => setStartTable(e.target.value)}>{choices.filter(c => c.list).map(c => <option key={c.tableId} value={c.tableId}>{project.schema.tables.find(t => t.id === c.tableId)?.physicalName}</option>)}</select></label><label><input type="checkbox" checked={menu} onChange={e => setMenu(e.target.checked)} /> Add navigation links between lists</label><p>The starting list uses <code>/</code>. Each record page links back to its list after Save or Cancel.</p><label className="dialog-field">Application style<input readOnly value="Standard accessible application layout" /></label><p>Captions, field order and formatting can be edited after setup.</p></section>}
   {step === 6 && preview && <section className="wizard-review"><h3>Review {name}</h3><p><strong>{preview.project.pages.length} pages · {preview.project.forms.length} forms · {project.schema.tables.length} {project.schema.tables.length === 1 ? 'table' : 'tables'}</strong></p><p>Project: <code>{folder}/{name}</code> · Database: <code>{preview.database}</code></p><details><summary>Pages and database changes</summary><ul>{preview.project.pages.map(p => <li key={p.id}>{p.title} · <code>{p.route}</code></li>)}</ul><ul>{preview.changes.map(change => <li key={change}>{change}</li>)}</ul></details><p>Complete creates this project and its pages. Generate will then produce the Next.js application files.</p><div className="wizard-flow"><ApplicationFlow key={preview.planId} project={preview.project} initialView="mermaid" onSelect={() => {}} /></div></section>}
  </div>
  {error && <p role="alert" className="wizard-error">{error}</p>}
  <div className="dialog-actions"><button disabled={busy} onClick={onCancel}>Cancel</button><span className="wizard-progress">Step {step + 1} of {steps.length}{busy ? ' · Working…' : ''}</span>{step > 0 && <button disabled={busy} onClick={() => { setError(''); setStep(s => s - 1); }}>Back</button>}<button className="primary" disabled={busy} onClick={() => void next()}>{busy ? 'Working…' : step === 6 ? 'Complete' : step === 0 && mode === 'blank' ? 'Create blank project' : step === 1 && database === 'existing' ? 'Read database and continue' : 'Next'}</button></div>
 </div>;
}
