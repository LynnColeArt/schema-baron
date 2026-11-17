import { z } from 'zod';
import { idSchema } from './identifiers.js';

/** Navigation metadata only. Runtime authorization must independently filter it. */
const label = z.string().min(1).max(120).refine(value => value.trim() === value && !/[<>\u0000-\u001f\u007f]/u.test(value), 'Use a plain-text label without markup or control characters.');
export function isNavigationHttpsUrl(value: string): boolean {
  if (value.length > 2048 || !value.startsWith('https://') || /[\s\\\u0000-\u001f\u007f]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0 && !url.username && !url.password;
  } catch { return false; }
}
const pageEntry = z.strictObject({ id: idSchema, label, kind: z.literal('page'), pageId: idSchema });
const externalEntry = z.strictObject({ id: idSchema, label, kind: z.literal('external'), url: z.string().refine(isNavigationHttpsUrl, 'Use an absolute HTTPS URL without credentials.'), visibility: z.enum(['public', 'authenticated']).default('authenticated') });
export const navigationMenuSchema = z.strictObject({ entries: z.array(z.discriminatedUnion('kind', [pageEntry, externalEntry])).max(200) }).superRefine((menu, context) => {
  const seen = new Set<string>();
  menu.entries.forEach((entry, index) => {
    if (seen.has(entry.id)) context.addIssue({ code: 'custom', path: ['entries', index, 'id'], message: 'Navigation entry IDs must be unique.' });
    seen.add(entry.id);
  });
});
export type NavigationMenu = z.infer<typeof navigationMenuSchema>;
export type NavigationMenuDiagnostic = { code: 'MISSING_PAGE'; entryId: string; pageId: string; message: string };

/** Deleted or unknown destinations are explicit errors, never guessed URLs. */
export function navigationMenuDiagnostics(menu: NavigationMenu, pages: readonly { id: string }[]): NavigationMenuDiagnostic[] {
  const parsed = navigationMenuSchema.parse(menu), known = new Set(pages.map(page => page.id));
  return parsed.entries.flatMap(entry => entry.kind === 'page' && !known.has(entry.pageId)
    ? [{ code: 'MISSING_PAGE' as const, entryId: entry.id, pageId: entry.pageId, message: 'Navigation destination page is missing; choose a page or remove this entry.' }]
    : []);
}

/** Exact permutation only: no insert/delete, ID regeneration, or page-array edit. */
export function reorderNavigationMenu(menu: NavigationMenu, orderedIds: readonly string[]): NavigationMenu {
  const parsed = navigationMenuSchema.parse(menu), entries = new Map(parsed.entries.map(entry => [entry.id as string, entry]));
  if (orderedIds.length !== entries.size || new Set(orderedIds).size !== entries.size || orderedIds.some(id => !entries.has(id))) throw new Error('Navigation order must contain every existing entry ID exactly once.');
  return { entries: orderedIds.map(id => entries.get(id)!) };
}

/** Shared kernel for keyboard buttons and drag/drop; edge moves are no-ops. */
export function moveNavigationEntry(menu: NavigationMenu, entryId: string, direction: -1 | 1): NavigationMenu {
  if (direction !== -1 && direction !== 1) throw new Error('Navigation move direction must be -1 or 1.');
  const parsed = navigationMenuSchema.parse(menu), ids = parsed.entries.map(entry => entry.id as string), index = ids.indexOf(entryId);
  if (index < 0) throw new Error('Unknown navigation entry ID.');
  const target = index + direction;
  if (target >= 0 && target < ids.length) [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  return reorderNavigationMenu(parsed, ids);
}
