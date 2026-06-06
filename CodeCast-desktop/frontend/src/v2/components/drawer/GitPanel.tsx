import { useAppStore } from '../../store';
import { useError } from '../../lib/useError';

export function GitPanel() {
  useError('git');
  const { status, loading, refreshGit } = useAppStore();

  if (loading) {
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
      <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--c-text)' }}>Git Status</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>Branch:</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>{status.branch}</span>
      </div>
      <div style={{ marginTop: 2 }}>
        Ahead: {status.ahead} | Behind: {status.behind}
      </div>
      <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>Dirty:</span>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: status.dirty ? 'var(--c-warning, #e8a835)' : 'var(--c-success, #4caf50)',
        }} />
        <span>{status.dirty ? 'Yes' : 'Clean'}</span>
      </div>
      <div style={{ marginTop: 2 }}>Enabled: {status.enabled ? 'Yes' : 'No'}</div>
    </div>
  );
}
