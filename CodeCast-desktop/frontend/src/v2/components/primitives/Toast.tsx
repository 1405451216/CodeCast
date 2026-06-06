import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
type Kind = 'info' | 'success' | 'warn' | 'danger';
interface TItem { id: number; text: string; kind: Kind }
const Ctx = createContext<{ show: (text: string, kind?: Kind) => void }>({ show: () => {} });
export function useToast() { return useContext(Ctx); }
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TItem[]>([]);
  const show = useCallback((text: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random();
    setItems(s => [...s, { id, text, kind }]);
    setTimeout(() => setItems(s => s.filter(x => x.id !== id)), 3000);
  }, []);
  return <Ctx.Provider value={{ show }}>
    {children}
    <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(t => <div key={t.id} style={{ padding: '8px 12px', borderRadius: 6, fontSize: 13, background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderLeft: `3px solid var(--c-${t.kind === 'info' ? 'accent' : t.kind})`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>{t.text}</div>)}
    </div>
  </Ctx.Provider>;
}
