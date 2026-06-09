import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

type Kind = 'info' | 'success' | 'warn' | 'danger';
interface TItem { id: number; text: string; kind: Kind }

const MAX_VISIBLE = 3;

const Ctx = createContext<{ show: (text: string, kind?: Kind) => void }>({ show: () => {} });
export function useToast() { return useContext(Ctx); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TItem[]>([]);
  const queueRef = useRef<TItem[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
    setItems(s => {
      const next = s.filter(x => x.id !== id);
      // Drain queue if we have room
      if (queueRef.current.length > 0) {
        const queued = queueRef.current.shift()!;
        const duration = queued.kind === 'danger' ? 7000 : 3000;
        const t = setTimeout(() => dismiss(queued.id), duration);
        timersRef.current.set(queued.id, t);
        return [...next, queued];
      }
      return next;
    });
  }, []);

  const show = useCallback((text: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random();
    const item: TItem = { id, text, kind };
    const duration = kind === 'danger' ? 7000 : 3000;

    setItems(s => {
      if (s.length >= MAX_VISIBLE) {
        // Queue instead of showing immediately
        queueRef.current.push(item);
        // Cap queue at 10 to avoid unbounded growth
        if (queueRef.current.length > 10) queueRef.current.shift();
        return s;
      }
      const t = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, t);
      return [...s, item];
    });
  }, [dismiss]);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}>
        {items.map(t => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 13,
              background: 'var(--c-surface)',
              color: 'var(--c-text)',
              border: '1px solid var(--c-border)',
              borderLeft: `3px solid var(--c-${t.kind === 'info' ? 'accent' : t.kind})`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              animation: 'toast-in 0.2s ease-out',
            }}
          >
            <span style={{ flex: 1, lineHeight: 1.4 }}>{t.text}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="关闭通知"
              style={{
                flexShrink: 0,
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                color: 'var(--c-textMute)',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
