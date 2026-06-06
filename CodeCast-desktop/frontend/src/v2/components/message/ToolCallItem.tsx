import { useState } from 'react';
import { StatusDot, type StatusKind } from './StatusDot';
export interface ToolCall { id: string; name: string; args: string; result?: string; status: StatusKind; durationMs?: number; risk?: 'low' | 'medium' | 'high' }
interface Props { call: ToolCall }
export function ToolCallItem({ call }: Props) {
  const [open, setOpen] = useState(false);
  const argsObj = (() => { try { return JSON.parse(call.args); } catch { return {}; } })();
  const target = argsObj.path || argsObj.target || argsObj.command || '';
  return <div style={{ margin: '6px 0', fontSize: 13 }}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 4, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--c-textSub)', fontFamily: 'var(--font-mono, monospace)' }}>
      <span>{open ? '▼' : '▶'}</span>
      <StatusDot status={call.status} />
      <span>{call.name}</span>
      {target && <span style={{ color: 'var(--c-textMute)' }}>{target}</span>}
      <div style={{ flex: 1 }} />
      {call.durationMs != null && <span style={{ color: 'var(--c-textMute)' }}>{call.durationMs}ms</span>}
    </button>
    {open && <pre style={{ margin: '4px 0 0', padding: 8, fontSize: 12, background: 'var(--c-bgSub)', border: '1px solid var(--c-border)', borderRadius: 4, overflow: 'auto' }}>{JSON.stringify(argsObj, null, 2)}</pre>}
  </div>;
}
