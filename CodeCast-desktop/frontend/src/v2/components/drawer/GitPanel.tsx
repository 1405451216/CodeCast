import { useAppStore } from '../../store';
import { useError } from '../../lib/useError';

export function GitPanel() {
  useError('git');
  const { status, gitLoading, refreshGit } = useAppStore();

  if (gitLoading) {
    return <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>Loading…</div>;
  }

  if (!status) {
    return (
      <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>
        <div style={{ marginBottom: 4, fontWeight: 500 }}>Git Status</div>
        <button
          onClick={refreshGit}
          style={{
            padding: '3px 8px', background: 'var(--c-surface-hover)', border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-sm)', color: 'var(--c-textSub)', fontSize: 11, cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 500, color: 'var(--c-text)' }}>Git Status</span>
        <button
          onClick={refreshGit}
          style={{
            padding: '2px 6px', background: 'transparent', border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-sm)', color: 'var(--c-textMute)', fontSize: 10, cursor: 'pointer',
          }}
        >
          刷新
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>分支:</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>{status.branch}</span>
      </div>
      <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>状态:</span>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: status.dirty ? 'var(--c-warn, #e8a835)' : 'var(--c-success, #4caf50)',
        }} />
        <span>{status.dirty ? '有未提交的更改' : '工作区干净'}</span>
      </div>
      {(status.ahead > 0 || status.behind > 0) && (
        <div style={{ marginTop: 2 }}>
          {status.ahead > 0 && <span style={{ color: 'var(--c-accent)' }}>↑{status.ahead} ahead </span>}
          {status.behind > 0 && <span style={{ color: 'var(--c-warn)' }}>↓{status.behind} behind</span>}
        </div>
      )}
      <div style={{ marginTop: 2 }}>已启用: {status.enabled ? '是' : '否'}</div>
    </div>
  );
}
