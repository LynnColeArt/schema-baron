import { describe, expect, it } from 'vitest';
import { isNavigationHttpsUrl, moveNavigationEntry, navigationMenuDiagnostics, navigationMenuSchema, reorderNavigationMenu } from './navigation-menu.js';
const fixture = () => navigationMenuSchema.parse({ entries: [{ id: 'home-link', kind: 'page', label: 'Home', pageId: 'home' }, { id: 'help-link', kind: 'external', label: 'Help', url: 'https://example.com/help' }] });
describe('standalone ordered navigation domain', () => {
  it('defaults external disclosure to authenticated without overriding page policy', () => {
    const menu = fixture(); expect(menu.entries[1]).toMatchObject({ visibility: 'authenticated' });
    expect(navigationMenuSchema.safeParse({ entries: [{ ...menu.entries[0], visibility: 'public' }] }).success).toBe(false);
  });
  it('allows explicit public external links and bounded HTTPS paths', () => {
    expect(navigationMenuSchema.parse({ entries: [{ ...fixture().entries[1], visibility: 'public' }] }).entries[0]).toMatchObject({ visibility: 'public' });
    expect(isNavigationHttpsUrl('https://example.com/help?q=topic#part')).toBe(true);
  });
  it('rejects unsafe schemes, credentials, controls, backslashes and ambiguous URLs', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', 'http://example.com', '//example.com', '/admin', 'https://user:pass@example.com', 'https://example.com\\evil', ' https://example.com', 'https://example.com\n', 'https://', 'https://example.com/'+ 'x'.repeat(2048)]) expect(isNavigationHttpsUrl(url), url).toBe(false);
  });
  it('rejects markup/control labels and unrecognized fields', () => {
    for (const label of ['', ' ', ' Title', '<b>Title</b>', 'x\ny', 'x'.repeat(121)]) expect(navigationMenuSchema.safeParse({ entries: [{ ...fixture().entries[0], label }] }).success).toBe(false);
    expect(navigationMenuSchema.safeParse({ entries: [], html: '<nav>' }).success).toBe(false);
    expect(navigationMenuSchema.safeParse({ entries: [{ ...fixture().entries[0], onClick: 'evil()' }] }).success).toBe(false);
  });
  it('rejects duplicate stable IDs and excessive menu size', () => {
    expect(navigationMenuSchema.safeParse({ entries: [fixture().entries[0], fixture().entries[0]] }).success).toBe(false);
    expect(navigationMenuSchema.safeParse({ entries: Array.from({ length: 201 }, (_, i) => ({ ...fixture().entries[0], id: 'entry-'+i })) }).success).toBe(false);
  });
  it('reorders deterministically without changing identities, destinations or input', () => {
    const menu = fixture(), before = JSON.stringify(menu), reversed = reorderNavigationMenu(menu, ['help-link', 'home-link']);
    expect(reversed.entries).toEqual([menu.entries[1], menu.entries[0]]); expect(JSON.stringify(menu)).toBe(before);
    expect(reorderNavigationMenu(reversed, ['home-link', 'help-link'])).toEqual(menu);
    reversed.entries[0]!.label = 'Changed'; expect(menu.entries[1]!.label).toBe('Help');
  });
  it('rejects incomplete, duplicate and invented permutations', () => {
    for (const ids of [[], ['home-link'], ['home-link', 'home-link'], ['home-link', 'unknown'], ['home-link', 'help-link', 'extra']]) expect(() => reorderNavigationMenu(fixture(), ids)).toThrow();
  });
  it('uses same kernel for up/down with stable edge behavior', () => {
    expect(moveNavigationEntry(fixture(), 'home-link', 1)).toEqual(reorderNavigationMenu(fixture(), ['help-link', 'home-link']));
    expect(moveNavigationEntry(fixture(), 'help-link', -1)).toEqual(reorderNavigationMenu(fixture(), ['help-link', 'home-link']));
    expect(moveNavigationEntry(fixture(), 'home-link', -1)).toEqual(fixture());
    expect(moveNavigationEntry(fixture(), 'help-link', 1)).toEqual(fixture());
    expect(() => moveNavigationEntry(fixture(), 'unknown', 1)).toThrow();
    expect(() => moveNavigationEntry(fixture(), 'home-link', 0 as 1)).toThrow();
  });
  it('retains references across page rename and diagnoses deletion without silently removing links', () => {
    const menu = fixture(); expect(navigationMenuDiagnostics(menu, [{ id: 'home' }])).toEqual([]);
    expect(navigationMenuDiagnostics(menu, [])).toEqual([{ code: 'MISSING_PAGE', entryId: 'home-link', pageId: 'home', message: 'Navigation destination page is missing; choose a page or remove this entry.' }]);
    expect(menu.entries).toHaveLength(2);
  });
  it('permits an explicit empty menu', () => { expect(reorderNavigationMenu({ entries: [] }, [])).toEqual({ entries: [] }); });
});
