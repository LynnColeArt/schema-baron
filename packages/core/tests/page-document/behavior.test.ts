import { describe, expect, it } from 'vitest';
import { createId } from '@schema-baron/model';
import type { Form, Page } from '@schema-baron/model';
import { parseDocument, serializeDocument, previewDocument, moveForm } from '../../src/page-document/index.js';
const id = (v: string) => createId(() => v);
const page: Page = { id: id('page'), title: 'Page', route: '/', document: [{ kind: 'form', formId: id('a') }, { kind: 'form', formId: id('b') }], formIds: [id('a'), id('b')] };
const forms = [{ id: id('a'), pageId: page.id, controlIds: [id('one'), id('two')] }, { id: id('b'), pageId: page.id, controlIds: [] }] as Form[];
describe('supported document codec', () => {
  it.each(['<p>&#123;literal&#125;</p>', '<p>&#x7b;literal&#x7d;</p>'])('roundtrips supported encoded literal braces: %s', source => {
    const emptyPage = { ...page, document: [], formIds: [] };
    const parsed = parseDocument(source, emptyPage, []);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document).toEqual([{ kind: 'element', tag: 'p', children: [{ kind: 'text', text: '{literal}' }] }]);
    const serialized = serializeDocument({ ...emptyPage, document: parsed.document }, []);
    expect(serialized).toBe('<p>&#123;literal&#125;</p>');
    const roundtrip = parseDocument(serialized, emptyPage, []);
    expect(roundtrip.ok && roundtrip.document).toEqual(parsed.document);
  });
  it('serializes directly authored static model text without turning it into dynamic source', () => {
    const authored: Page = { ...page, formIds: [], document: [{ kind: 'element', tag: 'p', children: [{ kind: 'text', text: 'Literal {brace} & &#123;quoted&#125;' }] }] };
    const source = serializeDocument(authored, []);
    expect(source).toBe('<p>Literal &#123;brace&#125; &amp; &amp;#123;quoted&amp;#125;</p>');
    const parsed = parseDocument(source, authored, []);
    expect(parsed.ok && parsed.document).toEqual(authored.document);
    expect(parseDocument('<p>{serverHook()}</p>', authored, []).ok).toBe(false);
  });
  it('roundtrips nested static content and typed reference order without copying metadata', () => {
    const source = '<header><h1>A &amp; B</h1></header>\n<section><sb-form id="b"></sb-form><sb-form id="a">\n<sb-control id="two" /><sb-control id="one" />\n</sb-form></section>';
    const result = parseDocument(source, page, forms);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.controlOrders.a).toEqual(['two', 'one']);
    expect(result.document[2]).toMatchObject({ tag: 'section', children: [{ formId: 'b' }, { formId: 'a' }] });
    const updated = forms.map(f => ({ ...f, controlIds: result.controlOrders[f.id] ?? f.controlIds }));
    const again = parseDocument(serializeDocument({ ...page, document: result.document }, updated), page, updated);
    expect(again.ok && again.document).toEqual(result.document);
    expect(result.positions.find(p => p.objectId === 'two')?.start).toBe(source.indexOf('<sb-control'));
  });
  it.each(['<script>alert(1)</script>', '<div onclick="run()">x</div>', '<img src="/api">', '<% execute %>', '<div>', '<p>&unknown;</p>', '<p>&constructor;</p>', '<p>&toString;</p>', '<p>&__proto__;</p>', '<div>{...source}</div>'])('explicitly rejects unsupported or invalid source without rewriting it: %s', source => {
    const result = parseDocument(source, { ...page, formIds: [] }, []);
    expect(result.ok).toBe(false);
    expect(result.source).toBe(source);
    expect(result.diagnostics[0]).toMatchObject({ objectId: 'page', line: 1 });
  });
  it('rejects missing, duplicate, foreign and reparented objects', () => {
    for (const source of ['<sb-form id="a"></sb-form>', '<sb-form id="alien"></sb-form>', '<sb-form id="a"><sb-control id="one"/><sb-control id="one"/></sb-form><sb-form id="b"/>', '<sb-form id="a"/><sb-form id="b"><sb-control id="one"/></sb-form>'])
      expect(parseDocument(source, page, forms).ok).toBe(false);
  });
  it('moves forms structurally while preserving IDs and surrounding content', () => {
    const document = [{ kind: 'element', tag: 'section', children: [{ kind: 'text', text: 'before' }, ...page.document] }] as Page['document'];
    expect(moveForm(document, 'b', -1)).toEqual([{ kind: 'element', tag: 'section', children: [{ kind: 'text', text: 'before' }, page.document[1], page.document[0]] }]);
    expect(document[0]).toMatchObject({ children: [{ text: 'before' }, { formId: 'a' }, { formId: 'b' }] });
  });
  it('emits a restrictive preview with escaped model labels, no source execution', () => {
    const html = previewDocument([{ kind: 'text', text: '<script>fetch("/api")</script>' }], [], []);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('bounds depth and size without throwing', () => {
    expect(parseDocument('<div>'.repeat(100), { ...page, formIds: [] }, []).ok).toBe(false);
    expect(parseDocument('x'.repeat(250001), { ...page, formIds: [] }, []).ok).toBe(false);
  });
});
