import type { ReactNode } from 'react';
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd style={{ padding: '1px 6px', fontSize: 11, border: '1px solid var(--c-border)', borderRadius: 4, background: 'var(--c-bgSub)', color: 'var(--c-textSub)', fontFamily: 'var(--font-mono, monospace)' }}>{children}</kbd>;
}
