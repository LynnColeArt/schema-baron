import { useEffect, useRef } from 'react';
import type { SyntheticEvent } from 'react';

type Selection = { label: string; start: number | null; end: number | null };
type TextControl = HTMLInputElement | HTMLTextAreaElement;
const textControl = (value: EventTarget | null): value is TextControl =>
  value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement;

/** Recovery belongs to the project and selected object, never the last DOM position. */
export function useDraftFocus(projectId: string, scope: string, active: boolean, documentId = scope) {
  const root = useRef<HTMLDivElement>(null);
  const restoring = useRef(false);
  const key = `studio.focus.${projectId}`;
  function remember(event: SyntheticEvent) {
    const element = event.target;
    if (!active || restoring.current || !textControl(element) || element.type === 'password') return;
    const label = element.getAttribute('aria-label');
    if (!label) return;
    try {
      const selections = JSON.parse(sessionStorage.getItem(key) ?? '{}') as Record<string, Selection>;
      selections[scope] = { label, start: element.selectionStart, end: element.selectionEnd };
      if (Object.keys(selections).length <= 1000) sessionStorage.setItem(key, JSON.stringify(selections));
    } catch { /* Text recovery remains independent when selection storage is unavailable. */ }
  }
  useEffect(() => {
    if (!active) return;
    try {
      const selection: unknown = JSON.parse(sessionStorage.getItem(key) ?? '{}')[scope];
      if (!selection || typeof selection !== 'object') return;
      const { label, start, end } = selection as Selection;
      if (typeof label !== 'string' || label.length > 512 ||
          ![start, end].every(n => n === null || (Number.isSafeInteger(n) && n! >= 0))) return;
      const element = Array.from(root.current?.querySelectorAll('input[aria-label], textarea[aria-label]') ?? [])
        .find(e => e.getAttribute('aria-label') === label && e.getClientRects().length);
      if (!textControl(element ?? null)) return;
      const control = element as TextControl;
      restoring.current = true;
      control.focus();
      if (control.selectionStart !== null && start !== null && end !== null) control.setSelectionRange(start, end);
    } catch { /* Malformed selection metadata cannot prevent draft recovery. */ }
    finally { restoring.current = false; }
  }, [key, scope, active, documentId]);
  return { ref: root, onFocusCapture: remember, onSelectCapture: remember, onKeyUpCapture: remember, onMouseUpCapture: remember };
}
