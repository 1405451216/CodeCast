import { useState, type ReactNode } from 'react';
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <span style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    {children}
    {open && <span role="tooltip" style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, padding: '2px 8px', fontSize: 11, background: 'var(--c-text)', color: 'var(--c-bg)', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 100 }}>{text}</span>}
  </span>;
}
