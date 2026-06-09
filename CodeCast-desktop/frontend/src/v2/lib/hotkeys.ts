type Handler = (e: KeyboardEvent) => void;
const handlers = new Map<string, Handler>();
function parseCombo(combo: string) {
  const p = combo.toLowerCase().split('+');
  return { key: p[p.length - 1], mod: p.includes('mod') || p.includes('cmd') || p.includes('ctrl'), shift: p.includes('shift'), alt: p.includes('alt') };
}
export function registerHotkey(combo: string, fn: Handler) { handlers.set(combo, fn); }
export function unregisterHotkey(combo: string) { handlers.delete(combo); }
export function unregisterAll() { handlers.clear(); }
function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    // Skip hotkeys when focus is in an editable element, except for Escape
    if (isEditableTarget(e.target) && e.key !== 'Escape') return;
    for (const [combo, fn] of handlers) {
      const p = parseCombo(combo);
      const k = e.key.toLowerCase();
      if (k === p.key && (p.mod ? (e.metaKey || e.ctrlKey) : true) && (p.shift ? e.shiftKey : !e.shiftKey) && (p.alt ? e.altKey : !e.altKey)) {
        e.preventDefault();
        fn(e);
      }
    }
  });
}
