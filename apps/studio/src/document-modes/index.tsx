"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction, ReactNode } from 'react';
import type { DocumentNode, Form, Page, Project } from '@schema-baron/model';
import { moveForm, parseDocument, previewDocument, serializeDocument } from '@schema-baron/core/page-document';
import { edit, visible } from '../workspace/state.js';
import type { Change, Editor } from '../workspace/state.js';
import { freshBuffer } from './state.js';
import type { DocumentBuffer } from './state.js';
import './styles.css';

export const documentModes = ['Design', 'HTML', 'Code', 'Preview', 'Live Page'] as const;
export type DocumentMode = typeof documentModes[number];
/** WP20/21 supply actual approved source/runtime interfaces here. No filesystem
 * path, arbitrary fetch or process-start fallback is provided by document modes. */
export interface ModeCapabilities {
  sourceEditor?:ReactNode;
  runtimeControls?:ReactNode;
  generated?: { content: string; revision: number; path: string };
  openExtensions?: (pageId: string) => void;
  openLivePage?: (pageId: string) => Promise<void>;
}
export function DocumentModes({ project, model, page, editor, setEditor, selected, select, mode, setMode, capabilities = {} }: {
  project: Project; model: Project; page: Page; editor: Editor;
  setEditor: Dispatch<SetStateAction<Editor>>;
  selected: string; select: (id: string) => void;
  mode: string; setMode: (mode: DocumentMode) => void;
  capabilities?: ModeCapabilities;
}) {
  const canonical = serializeDocument(page, model.forms);
  const buffer = editor.documents?.[page.id] ?? freshBuffer(canonical);
  const pending = buffer.text !== buffer.appliedText;
  const changed = buffer.baseline !== canonical;
  const placementPath = (path: string, entity: string) => entity === 'page' ? path === 'document' || path.startsWith('document.') : path === 'controlIds' || path.startsWith('controlIds.');
  const placementConflicts = Object.values(editor.drafts).some(d => (d.value.id === page.id || (d.entity === 'form' && (d.value as Form).pageId === page.id)) && d.conflicts.some(path => placementPath(path, d.entity)));
  const conflict = pending && (changed || placementConflicts);
  const remotePage = project.pages.find(p => p.id === page.id);
  const comparison = placementConflicts && remotePage ? serializeDocument(remotePage, project.forms) : canonical;
  // Clean buffers follow normal add/delete/history/MCP edits. Dirty buffers are
  // retained for explicit reconciliation; no background rewrite of authored text.
  const shown = changed && !pending ? freshBuffer(canonical) : buffer;
  const parsed = useMemo(() => parseDocument(shown.text, page, model.forms), [shown.text, page, model.forms]);
  const input = useRef<HTMLTextAreaElement>(null);
  const switchingByKeyboard = useRef(false);
  const [error, setError] = useState('');
  function updateBuffer(update: Partial<DocumentBuffer>) {
    setEditor(current => ({ ...current, documents: { ...current.documents, [page.id]: { ...(current.documents?.[page.id] ?? freshBuffer(canonical)), ...update } } }));
  }
  useEffect(() => {
    if (!editor.documents?.[page.id] || (changed && !pending))
      updateBuffer(freshBuffer(canonical));
  }, [page.id, canonical, changed, pending]); // retained in the shared, session-recovered editor
  useEffect(() => {
    const restoreFocus = !switchingByKeyboard.current;
    switchingByKeyboard.current = false;
    if (mode === 'HTML' && input.current) {
      const element = input.current;
      if (shown.focus && restoreFocus) element.focus({ preventScroll: true });
      element.setSelectionRange(shown.start, shown.end);
      element.scrollTop = shown.scroll;
      element.scrollLeft = shown.horizontalScroll ?? 0;
    }
  }, [mode, page.id]);
  function applyHTML() {
    if (!parsed.ok) return;
    // Re-read latest drafts inside the state update: no stale closure can overwrite
    // property typing, control metadata, or an unrelated form's pending edits.
    setEditor(current => {
      const currentModel = visible(project, current);
      const currentPage = currentModel.pages.find(p => p.id === page.id);
      if (!currentPage) return current;
      const result = parseDocument(shown.text, currentPage, currentModel.forms);
      if (!result.ok) return current;
      const updated = { ...currentPage, document: result.document };
      const changes: Change[] = [{ entity: 'page', value: updated }];
      const forms = currentModel.forms.map(form => {
        const order = result.controlOrders[form.id];
        if (!order) return form;
        const value = { ...form, controlIds: order };
        changes.push({ entity: 'form', value }); return value;
      });
      // The explicit placement decision resolves only these conflict paths.
      // Unrelated title/metadata conflicts remain visible and continue blocking Save.
      const resolved = { ...current, drafts: { ...current.drafts } };
      if (placementConflicts) {
        resolved.past = []; resolved.future = [];
        for (const change of changes) {
          const draft = resolved.drafts[change.value.id];
          if (draft) resolved.drafts[change.value.id] = { ...draft, conflicts: draft.conflicts.filter(path => !placementPath(path, draft.entity)) };
        }
      }
      const next = edit(resolved, project, changes);
      return { ...next, documents: { ...current.documents, [page.id]: { ...shown, baseline: serializeDocument(updated, forms), appliedText: shown.text } } };
    });
    setError('');
  }
  function useModelHTML() {
    if (!placementConflicts || !remotePage) { updateBuffer(freshBuffer(canonical)); return; }
    setEditor(current => {
      const currentModel = visible(project, current);
      const currentPage = currentModel.pages.find(p => p.id === page.id);
      if (!currentPage) return current;
      const updated = { ...currentPage, document: remotePage.document };
      const forms = currentModel.forms.map(form => {
        const remote = project.forms.find(f => f.id === form.id);
        return form.pageId === page.id && remote ? { ...form, controlIds: remote.controlIds } : form;
      });
      const changes: Change[] = [{ entity: 'page', value: updated }, ...forms.filter(f => f.pageId === page.id).map(value => ({ entity: 'form' as const, value }))];
      const resolved = { ...current, drafts: { ...current.drafts }, past: [], future: [] };
      for (const change of changes) {
        const draft = resolved.drafts[change.value.id];
        if (draft) resolved.drafts[change.value.id] = { ...draft, conflicts: draft.conflicts.filter(path => !placementPath(path, draft.entity)) };
      }
      const next = edit(resolved, project, changes);
      return { ...next, documents: { ...next.documents, [page.id]: freshBuffer(serializeDocument(updated, forms)) } };
    });
  }
  function updatePage(document: DocumentNode[]) {
    setEditor(current => edit(current, project, [{ entity: 'page', value: { ...page, document } }]));
  }
  function updateText(path: number[], text: string) {
    const document = structuredClone(page.document);
    let nodes = document;
    for (const i of path.slice(0, -1)) {
      const node = nodes[i];
      if (node?.kind !== 'element') return;
      nodes = node.children;
    }
    nodes[path.at(-1)!] = { kind: 'text', text };
    updatePage(document);
  }
  function reorderControl(form: Form, id: string, direction: -1 | 1) {
    const ids = [...form.controlIds], index = ids.findIndex(v => v === id), target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setEditor(current => edit(current, project, [{ entity: 'form', value: { ...form, controlIds: ids } }]));
  }
  function render(node: DocumentNode, path: number[]): React.ReactNode {
    if (node.kind === 'text') return node.text.trim() ? <textarea key={path.join('.')} aria-label={`Static text ${path.join('.')}`} className="static-content" value={node.text} onFocus={() => select(page.id)} onChange={event => updateText(path, event.target.value)} /> : node.text;
    if (node.kind === 'element') {
      const Tag = node.tag;
      return <Tag key={path.join('.')}>{node.children.map((child, i) => render(child, [...path, i]))}</Tag>;
    }
    const form = model.forms.find(f => f.id === node.formId);
    if (!form) return <p key={node.formId} role="alert">Missing form {node.formId}</p>;
    return <section className={`form-outline ${selected === form.id ? 'selected-object' : ''}`} key={form.id}>
      <div className="placement-row"><button className="form-caption" onClick={() => select(form.id)}><span className="object-type">{form.kind.toUpperCase()}</span>{form.appearance.label || form.kind}</button>
        <button aria-label={`Move ${form.appearance.label || form.kind} earlier`} disabled={pending} onClick={() => updatePage(moveForm(page.document, form.id, -1))}>↑</button>
        <button aria-label={`Move ${form.appearance.label || form.kind} later`} disabled={pending} onClick={() => updatePage(moveForm(page.document, form.id, 1))}>↓</button></div>
      <div className="control-list">{form.controlIds.map((id, index) => {
        const control = model.controls.find(c => c.id === id);
        if (!control) return null;
        const name = control.appearance.label || control.kind;
        return <div className="placement-row" key={id}><button className={`control-projection ${selected === id ? 'selected-object' : ''}`} onClick={() => select(id)}><span className="control-kind">{control.kind}</span>{name}</button>
          <button aria-label={`Move control ${name} earlier`} disabled={pending || index === 0} onClick={() => reorderControl(form, id, -1)}>↑</button>
          <button aria-label={`Move control ${name} later`} disabled={pending || index === form.controlIds.length - 1} onClick={() => reorderControl(form, id, 1)}>↓</button></div>;
      })}{!form.controlIds.length && <span className="empty-inline">Empty form · insert a control from Toolbox.</span>}</div>
    </section>;
  }
  const previewForms = parsed.ok ? model.forms.map(f => ({ ...f, controlIds: parsed.controlOrders[f.id] ?? f.controlIds })) : model.forms;
  const preview = previewDocument(parsed.ok ? parsed.document : page.document, previewForms, model.controls);
  return <>
    <div className="document-surface document-mode-surface" style={mode==='Live Page'?{flex:'0 0 auto'}:undefined} role="tabpanel" aria-label={`${mode} document`}>
      <div className="document-breadcrumb">Page / {page.title} <span>{page.route}</span></div>
      {pending && mode !== 'HTML' && <p className="mode-notice">{parsed.ok ? 'Pending HTML draft. Preview shows current HTML; apply it in HTML mode to update Design and Save.' : 'Invalid HTML retained. Design and Preview fallback show the last valid model draft.'} <button onClick={() => setMode('HTML')}>Review HTML</button></p>}
      <div hidden={mode !== 'Design'}>
        <div className="document-actions"><button disabled={pending} onClick={() => updatePage([...page.document, { kind: 'element', tag: 'p', children: [{ kind: 'text', text: 'New paragraph' }] }])}>Insert paragraph</button><button disabled={pending} onClick={() => updatePage([...page.document, { kind: 'element', tag: 'h1', children: [{ kind: 'text', text: 'New heading' }] }])}>Insert heading</button></div>
        <div className="page-sheet"><button className={`page-heading ${selected === page.id ? 'selected-object' : ''}`} onClick={() => select(page.id)}><span className="object-type">PAGE</span><strong>{page.title}</strong></button>{page.document.map((node, i) => <Fragment key={i}>{render(node, [i])}</Fragment>)}{!page.document.length && <p className="document-note">Blank page. Insert content or add a form from Toolbox.</p>}</div>
      </div>
      <div hidden={mode !== 'HTML'} className="html-mode">
        <p className="mode-notice">HTML draft · static elements and stable object placement. Apply HTML stages one shared model edit; Save commits it. Native text undo stays in this editor.</p>
        <details><summary>Supported HTML and object ownership</summary><p>div, p, span, h1, h2, header, footer, section; no attributes. Forms use &lt;sb-form id="stable ID"&gt; and direct &lt;sb-control id="stable ID" /&gt; children in control order. Move existing references; create/delete objects with Toolbox/Properties. Nested control wrappers, dynamic templates, scripts, styles, URLs and other constructs are rejected with original source retained. Use entities for literal braces or ampersands. Metadata, labels and bindings remain in Properties.</p></details>
        {conflict && <div role="alert" className="html-conflict"><strong>Layout changed while HTML was pending.</strong><p>Your source is retained. Compare the current model before choosing which placement to keep. New/deleted controls must still be represented exactly once.</p><details><summary>Compare current model HTML</summary><pre>{comparison}</pre></details><button disabled={!parsed.ok} onClick={applyHTML}>Keep HTML placement</button><button onClick={useModelHTML}>Use current model HTML</button></div>}
        <label className="source-label" htmlFor="page-html-source">HTML source</label>
        <textarea id="page-html-source" ref={input} spellCheck={false} value={shown.text} aria-invalid={!parsed.ok} aria-describedby="html-diagnostics" onFocus={() => updateBuffer({ focus: true })} onSelect={event => {
          const element = event.currentTarget;
          updateBuffer({ start: element.selectionStart, end: element.selectionEnd });
          const position = [...parsed.positions].filter(p => p.start <= element.selectionStart && p.end >= element.selectionStart).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
          if (position) select(position.objectId);
        }} onScroll={event => updateBuffer({ scroll: event.currentTarget.scrollTop, horizontalScroll: event.currentTarget.scrollLeft })} onChange={event => { if (event.target.value.length > 1000000) { setError("HTML editing is limited to 1,000,000 characters for recovery. The existing source is retained; this oversized input was rejected."); return; } updateBuffer({ ...shown, text: event.target.value, start: event.target.selectionStart, end: event.target.selectionEnd }); }} />
        {error && <p role="alert">{error}</p>}
        <div id="html-diagnostics" aria-live="polite">{parsed.diagnostics.map((issue, i) => <button className="html-diagnostic" key={i} onClick={() => { select(issue.objectId); input.current?.focus(); input.current?.setSelectionRange(issue.offset, issue.offset); }}><strong>Line {issue.line}, column {issue.column} · {issue.objectId}</strong> {issue.message}</button>)}{parsed.ok && <p className="mode-notice">Supported HTML · {pending ? 'pending apply' : 'same canonical draft'} · {parsed.positions.length} source positions</p>}</div>
        <div className="document-actions"><button disabled={!parsed.ok || !pending || conflict} onClick={applyHTML}>Apply HTML to draft</button><button disabled={!pending} onClick={() => updateBuffer(freshBuffer(canonical))}>Discard pending HTML</button></div>
      </div>
      {mode === 'Preview' && <div className="draft-preview"><p className="mode-notice"><strong>{parsed.ok ? 'Current draft preview' : 'Invalid HTML · last valid model draft fallback'}</strong> · {pending ? 'unsaved HTML' : 'shared model draft'} · no live data, scripts, requests, submissions or server hooks.</p><iframe title="Isolated current draft preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview} /></div>}
      {capabilities.sourceEditor && <div hidden={mode !== 'Code'}>{capabilities.sourceEditor}</div>}
      {mode === 'Code' && !capabilities.sourceEditor && <div className="mode-capability"><h3>Generated source · read-only ownership</h3>{capabilities.generated ? <><p>Last generated content · revision {capabilities.generated.revision} · {capabilities.generated.path}. Current unsaved draft is separate.</p><pre tabIndex={0}>{capabilities.generated.content}</pre></> : <p>Generated source inspection requires the WP20 source editor. Save your draft, review generation, then inspect the owned output there. No generated content is currently available through an approved source interface.</p>}{capabilities.openExtensions ? <button onClick={() => capabilities.openExtensions!(page.id)}>Open authored extensions</button> : <p>Authored extension editing becomes available with WP20. Generated files remain read-only.</p>}</div>}
      {mode === 'Live Page' && <div className="mode-capability"><h3>Live Page · managed generated application</h3><p>This view targets the selected generated application route. Its runtime controls below retain the current draft separately.</p>{capabilities.openLivePage ? <button onClick={() => { void capabilities.openLivePage!(page.id).catch(e => setError(e instanceof Error ? e.message : 'Managed route unavailable.')); }}>Open managed page route</button> : !capabilities.runtimeControls&&<p>Managed route resolution is unavailable. Generate output to use the runtime controls.</p>}<button onClick={() => setMode('Preview')}>Preview current draft</button>{error && <p role="alert">{error}</p>}</div>}
    </div>
    {capabilities.runtimeControls}
    <div className="modebar" role="region" aria-label="Document modes and status" tabIndex={0}><div role="tablist" aria-label="Document modes">{documentModes.map(value => <button key={value} role="tab" aria-selected={mode === value} tabIndex={mode === value ? 0 : -1} onClick={event => { switchingByKeyboard.current = event.detail === 0; setMode(value); }} onKeyDown={event => {
      const index = documentModes.indexOf(value);
      const next = event.key === 'ArrowRight' ? (index + 1) % 5 : event.key === 'ArrowLeft' ? (index + 4) % 5 : event.key === 'Home' ? 0 : event.key === 'End' ? 4 : -1;
      if (next >= 0) { event.preventDefault(); switchingByKeyboard.current = true; setMode(documentModes[next]!); (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus(); }
    }}>{value}</button>)}</div></div>
  </>;
}
