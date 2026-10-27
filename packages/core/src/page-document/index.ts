import { idSchema } from '@schema-baron/model';
import type { Control, DocumentNode, Form, Page, StableId } from '@schema-baron/model';

/** This codec owns the supported HTML grammar. It never parses TSX or evaluates source.
 * Form/control tags are placement references; all metadata remains in the shared model.
 * Unsupported syntax is rejected as a whole, with its original source untouched. */
export const MAX_DOCUMENT_SOURCE = 250_000;
const tags = new Set(['div', 'p', 'span', 'h1', 'h2', 'header', 'footer', 'section']);
export interface SourcePosition { start: number; end: number; objectId: string }
export interface DocumentIssue { message: string; objectId: string; offset: number; line: number; column: number }
interface Parsed { source: string; document: DocumentNode[]; controlOrders: Record<string, StableId[]>; positions: SourcePosition[]; diagnostics: DocumentIssue[] }
export type DocumentResult = (Parsed & { ok: true }) | (Omit<Parsed, 'document' | 'controlOrders'> & { ok: false });
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
function decode(s: string): string {
  return s.replace(/&([^;\s]*);|&/g, (match, entity: string | undefined) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (entity && Object.hasOwn(named, entity)) return named[entity]!;
    if (entity && /^#(?:[0-9]+|x[0-9a-f]+)$/i.test(entity)) {
      const code = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) return String.fromCodePoint(code);
    }
    throw new Error(`Unsupported entity ${match}; use &amp; for a literal ampersand.`);
  });
}
export function serializeDocument(page: Page, forms: Form[]): string {
  const render = (node: DocumentNode): string => {
    // Literal model text must stay inside the parser's static text grammar.
    if (node.kind === 'text') return escape(node.text).replaceAll('{', '&#123;').replaceAll('}', '&#125;');
    if (node.kind === 'element') return `<${node.tag}>${node.children.map(render).join('')}</${node.tag}>`;
    const form = forms.find(f => f.id === node.formId);
    return `<sb-form id="${escape(node.formId)}">${(form?.controlIds ?? []).map(id => `<sb-control id="${escape(id)}" />`).join('')}</sb-form>`;
  };
  return page.document.map(render).join('');
}
export function parseDocument(source: string, page: Page, forms: Form[]): DocumentResult {
  const positions: SourcePosition[] = [], diagnostics: DocumentIssue[] = [];
  let offset = 0, count = 0;
  const fail = (message: string, objectId: string = page.id): never => {
    const before = source.slice(0, offset), lines = before.split('\n');
    diagnostics.push({ message, objectId, offset, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 });
    throw new Error(message);
  };
  const document: DocumentNode[] = [], controlOrders: Record<string, StableId[]> = Object.create(null);
  const stack: { tag: string; children: DocumentNode[]; form?: Form; start: number; objectId: string }[] = [{ tag: '', children: document, start: 0, objectId: page.id }];
  try {
    if (source.length > MAX_DOCUMENT_SOURCE) fail('HTML exceeds the 250,000 character editing limit. Source is retained.');
    while (offset < source.length) {
      if (++count > 10000 || stack.length > 64) fail('Document exceeds the 10,000 token / 64 level editing limit.');
      const parent = stack.at(-1)!;
      if (source[offset] !== '<') {
        const end = source.indexOf('<', offset), stop = end < 0 ? source.length : end;
        const text = source.slice(offset, stop);
        if (text.includes('{') || text.includes('}')) fail('Dynamic template / JSX braces are unsupported. Encode literal braces as &#123; and &#125;.');
        if (parent.form) { if (text.trim()) fail('Only sb-control references and whitespace are supported inside sb-form.', parent.form.id); }
        else if (text) { parent.children.push({ kind: 'text', text: decode(text) }); positions.push({ start: offset, end: stop, objectId: parent.objectId }); }
        offset = stop; continue;
      }
      const token = /^<\s*(\/?)\s*([a-z][a-z0-9-]*)([^<>]*?)>/i.exec(source.slice(offset));
      if (!token) fail('Unsupported or incomplete markup. Use the documented static HTML subset; source remains editable.');
      const [raw, closing, name, tail] = token!;
      const tag = name!.toLowerCase(), selfClosing = /\/\s*$/.test(tail!);
      const attributes = tail!.replace(/\/\s*$/, '').trim();
      const start = offset;
      if (closing) {
        if (attributes || selfClosing || stack.length === 1 || parent.tag !== tag) fail(`Unexpected closing tag </${tag}>.`);
        positions.push({ start: parent.start, end: offset + raw.length, objectId: parent.objectId });
        stack.pop();
      } else if (tag === 'sb-control' || tag === 'sb-form') {
        const match = /^id\s*=\s*(?:"([^"]*)"|'([^']*)')$/.exec(attributes);
        if (!match) fail(`${tag} requires only a quoted stable id attribute.`);
        const id = decode(match![1] ?? match![2] ?? '');
        if (!idSchema.safeParse(id).success) fail('Invalid stable reference ID.');
        if (tag === 'sb-form') {
          if (parent.form) fail('Forms cannot be nested.', parent.form.id);
          const form = forms.find(f => f.id === id && f.pageId === page.id && page.formIds.includes(f.id));
          if (!form) fail('Form reference does not belong to this page. Create/delete forms through the normal model commands.');
          if (controlOrders[id]) fail('Each form must appear exactly once.', id);
          controlOrders[id] = [];
          parent.children.push({ kind: 'form', formId: form!.id });
          if (!selfClosing) stack.push({ tag, form: form!, children: [], start, objectId: id });
        } else {
          if (!parent.form) fail('Controls must be direct children of their owning sb-form.');
          if (!selfClosing) fail('Use a self-closing sb-control reference; control markup/metadata belongs in Properties.', parent.form!.id);
          if (!parent.form!.controlIds.includes(id as StableId)) fail('Control reference does not belong to this form.', parent.form!.id);
          const order = controlOrders[parent.form!.id]!;
          if (order.includes(id as StableId)) fail('Each control must appear exactly once.', id);
          order.push(id as StableId);
        }
        positions.push({ start, end: start + raw.length, objectId: id });
      } else {
        if (!tags.has(tag) || attributes || parent.form || selfClosing) fail('Unsupported tag, attribute, wrapper or dynamic markup. Supported static elements have no attributes; controls are direct sb-form children.');
        const node: Extract<DocumentNode, { kind: 'element' }> = { kind: 'element', tag: tag as Extract<DocumentNode, { kind: 'element' }>['tag'], children: [] };
        parent.children.push(node);
        stack.push({ tag, children: node.children, start, objectId: page.id });
      }
      offset += raw.length;
    }
    if (stack.length !== 1) fail(`Missing closing tag </${stack.at(-1)!.tag}>.`);
    for (const id of page.formIds) {
      const form = forms.find(f => f.id === id && f.pageId === page.id);
      if (!form || !controlOrders[id]) fail('Every existing page form must appear exactly once. Use normal commands to add/delete objects.', id);
      if (controlOrders[id]!.length !== form!.controlIds.length) fail('Every existing form control must appear exactly once. Use Toolbox/Properties to add or delete controls.', id);
    }
    return { ok: true, source, document, controlOrders, positions, diagnostics };
  } catch (e) {
    if (!diagnostics.length) {
      const lines = source.slice(0, offset).split('\n');
      diagnostics.push({ message: e instanceof Error ? e.message : 'Unsupported source.', objectId: page.id, offset, line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 });
    }
    return { ok: false, source, positions, diagnostics };
  }
}
/** Structural sibling move, never string-marker surgery. */
export function moveForm(document: DocumentNode[], id: string, direction: -1 | 1): DocumentNode[] {
  const result = structuredClone(document);
  const walk = (nodes: DocumentNode[]): boolean => {
    const index = nodes.findIndex(n => n.kind === 'form' && n.formId === id);
    if (index >= 0) {
      let target = index + direction;
      while (target >= 0 && target < nodes.length && nodes[target]?.kind === "text" && !(nodes[target] as Extract<DocumentNode, { kind: "text" }>).text.trim()) target += direction;
      if (target >= 0 && target < nodes.length) [nodes[index], nodes[target]] = [nodes[target]!, nodes[index]!];
      return true;
    }
    return nodes.some(n => n.kind === 'element' && walk(n.children));
  };
  walk(result); return result;
}
export function previewDocument(document: DocumentNode[], forms: Form[], controls: Control[]): string {
  const render = (node: DocumentNode): string => {
    if (node.kind === 'text') return escape(node.text);
    if (node.kind === 'element') return `<${node.tag}>${node.children.map(render).join('')}</${node.tag}>`;
    const form = forms.find(f => f.id === node.formId);
    return `<section><h2>${escape(form?.appearance.label || form?.kind || 'Form')}</h2>${(form?.controlIds ?? []).map(id => {
      const control = controls.find(c => c.id === id);
      const label = escape(control?.appearance.label || control?.kind || 'Control');
      return `<p><label>${label}${control && ['text', 'textarea', 'select', 'checkbox', 'number', 'date'].includes(control.kind) ? '<input disabled aria-label="Draft control (no data)" />' : ''}</label></p>`;
    }).join('')}</section>`;
  };
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'"><meta name="referrer" content="no-referrer"><style>body{font:14px system-ui;margin:20px;color:#20252b}section{margin:16px 0;padding:12px;border:1px solid #aaa}h1,h2{margin:0 0 12px}input{display:block}</style></head><body>${document.map(render).join('')}</body></html>`;
}
