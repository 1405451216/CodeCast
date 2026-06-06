type Handler = (e: KeyboardEvent) => void;
const handlers = new Map<string, Handler>();
function parseCombo(combo: string) {
  const p = combo.toLowerCase().split('+');
  return { key: p[p.length - 1], mod: p.includes('mod') || p.includes('cmd') || p.includes('ctrl'), shift: p.includes('shift'), alt: p.includes('alt') };
}
export function registerHotkey(combo: string, fn: Handler) { handlers.set(combo, fn); }
export function unregisterHotkey(combo: string) { handlers.delete(combo); }
export function unregisterAll() { handlers.clear(); }
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
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
