import type { ReactNode } from 'react';
export function ChatArea({ children }: { children: ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
