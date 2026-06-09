import { useState, useRef, useEffect, type ReactNode } from 'react';
export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [open]);
  return <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
    <span onClick={() => setOpen(o => !o)}>{trigger}</span>
    {open && <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 6, padding: 8, minWidth: 200, zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>{children}</div>}
  </div>;
}
