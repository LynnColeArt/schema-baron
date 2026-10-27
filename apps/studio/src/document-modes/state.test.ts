import { afterEach, expect, it, vi } from 'vitest';
import { createId, parseProject } from '@schema-baron/model';
import { initialEditor, initialView, edit, reconcile, visible, afterSave, operations, undo } from '../workspace/state.js';
import { retain, restore } from '../workspace/session.js';
import { freshBuffer, pendingDocuments } from './state.js';
const id = (v: string) => createId(() => v);
const page = { id: id('page'), title: 'Page', route: '/', document: [], formIds: [] };
const project = () => parseProject({ id: 'project', formatVersion: 1, revision: 1, name: 'Recovery', target: 'next-typescript-sqlite', targetVersion: '1', connectionRefs: [], connections: [], schema: { id: 'schema', revision: 1, tables: [], opaqueObjects: [] }, queries: [], pages: [page], forms: [], controls: [], actions: [], policies: [{ id: 'policy', scope: 'global', ownerId: 'project', access: 'public' }], globalPolicyId: 'policy', outputConfig: { approvedRootId: 'projects', relativePath: 'output' }, extensionContracts: [] });
afterEach(() => vi.unstubAllGlobals());
it('recovers invalid raw HTML, caret, mode and formatting with other drafts and model undo', () => {
  const map = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value) });
  const p = project();
  const editor = edit(initialEditor(), p, [{ entity: 'page', value: { ...page, title: '' } }]);
  editor.documents = { page: { ...freshBuffer(''), text: '<p> unfinished & invalid\n', start: 7, end: 11, scroll: 18, focus: true } };
  const view = { ...initialView(), selected: 'page', open: ['page'], activePage: 'page', documentModes: { page: 'HTML' } };
  expect(retain('recovery', editor, view)).toBe(true);
  const recovered = restore('recovery');
  expect(recovered.issues).toEqual([]);
  expect(recovered.editor).toEqual(editor);
  expect(recovered.view).toEqual(view);
  expect(() => operations(recovered.editor)).toThrow('pending HTML');
  const undone = undo(editor);
  expect(visible(p, undone).pages[0]?.title).toBe('Page');
  expect(undone.documents).toEqual(editor.documents);
});
it('retains later raw typing while acknowledging a submitted model save and unrelated remote edits', () => {
  const p = project();
  const submitted = edit(initialEditor(), p, [{ entity: 'page', value: { ...page, title: 'Submitted' } }]);
  submitted.documents = { page: freshBuffer('<p>Source</p>') };
  const saved = { ...visible(p, submitted), revision: 2 };
  const latest = { ...submitted, documents: { page: { ...submitted.documents.page!, text: '<p>Typed during request' } } };
  const acknowledged = afterSave(latest, submitted, p, saved);
  expect(pendingDocuments(acknowledged.documents)).toBe(true);
  expect(acknowledged.documents?.page?.text).toBe('<p>Typed during request');
  const remote = { ...saved, revision: 3, name: 'Unrelated remote name' };
  expect(reconcile(acknowledged, remote).documents).toEqual(latest.documents);
  expect(visible(remote, acknowledged).name).toBe('Unrelated remote name');
});

it('retains over-parser-limit raw input so an invalid large paste remains recoverable', () => {
  const map = new Map<string, string>();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value) });
  const editor = { ...initialEditor(), documents: { page: { ...freshBuffer(''), text: '<'.repeat(250001) } } };
  expect(retain('large-raw', editor, initialView())).toBe(true);
  expect(restore('large-raw').editor.documents?.page?.text).toBe(editor.documents.page.text);
});
