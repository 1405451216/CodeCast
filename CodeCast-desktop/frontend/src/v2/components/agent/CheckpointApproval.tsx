// frontend/src/v2/components/agent/CheckpointApproval.tsx
//
// Inline card shown in the chat thread when an agent reaches a
// checkpoint. Two buttons: Approve / Deny. Resolution clears the
// pending entry in the store, which the parent reads to hide the card.

import { useAppStore } from '../../store';
import { Button } from '../primitives/Button';
import type { PendingCheckpoint } from '../../store/slices/checkpointSlice';

export function CheckpointApproval({ checkpoint }: { checkpoint: PendingCheckpoint }) {
  const resolve = useAppStore((s) => s.resolve);

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 14px',
        margin: '8px 0',
        background: 'var(--c-bgSub)',
        border: '1px solid var(--c-borderStrong)',
        borderLeft: '3px solid var(--c-accent)',
        borderRadius: 'var(--r-md)',
        fontSize: 13,
        color: 'var(--c-text)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--c-accent)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          ⏸
        </span>
        <span style={{ fontWeight: 500 }}>Agent 已暂停 · 等待你确认</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--c-textSub)' }}>
        <div>
          <span style={{ color: 'var(--c-textMute)' }}>工具：</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>{checkpoint.ToolName || '—'}</span>
        </div>
        <div>
          <span style={{ color: 'var(--c-textMute)' }}>Turn：</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>#{checkpoint.Turn}</span>
        </div>
        {checkpoint.reason && (
          <div>
            <span style={{ color: 'var(--c-textMute)' }}>原因：</span>
            <span>{checkpoint.reason}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" onClick={() => void resolve(checkpoint.ID, true)} style={{ flex: 1 }}>
          继续
        </Button>
        <Button variant="danger" onClick={() => void resolve(checkpoint.ID, false)} style={{ flex: 1 }}>
          拒绝
        </Button>
      </div>
    </div>
  );
}
