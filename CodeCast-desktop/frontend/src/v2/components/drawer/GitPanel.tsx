import { useAppStore } from '../../store';
import { useError } from '../../lib/useError';
import { useI18n } from '../../lib/useI18n';

export function GitPanel() {
  useError('git');
  const t = useI18n();
  const { status, gitLoading, refreshGit } = useAppStore();
  // Show dirty files from status if available
  const changedFiles: Array<{ path: string; status: string }> = (status as any)?.files ?? [];

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
          {t.drawer.git.refresh}
        </button>
      </div>
    );
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case 'modified': return { color: 'var(--c-warn, #e8a835)', label: 'M' };
      case 'added': return { color: 'var(--c-success, #4caf50)', label: 'A' };
      case 'deleted': return { color: 'var(--c-danger, #e74c3c)', label: 'D' };
      case 'renamed': return { color: 'var(--c-accent)', label: 'R' };
      case 'untracked': return { color: 'var(--c-textMute)', label: '?' };
      default: return { color: 'var(--c-textMute)', label: '?' };
    }
  };

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
          {t.drawer.git.refresh}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{t.drawer.git.branch}:</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--c-text)' }}>{status.branch}</span>
      </div>
      <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{t.drawer.git.status}:</span>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: status.dirty ? 'var(--c-warn, #e8a835)' : 'var(--c-success, #4caf50)',
        }} />
        <span>{status.dirty ? t.drawer.git.dirty : t.drawer.git.clean}</span>
      </div>
      {(status.ahead > 0 || status.behind > 0) && (
        <div style={{ marginTop: 2 }}>
          {status.ahead > 0 && <span style={{ color: 'var(--c-accent)' }}>↑{status.ahead} ahead </span>}
          {status.behind > 0 && <span style={{ color: 'var(--c-warn)' }}>↓{status.behind} behind</span>}
        </div>
      )}
      {changedFiles.length > 0 && (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--c-border)', paddingTop: 6 }}>
          <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--c-text)' }}>{t.drawer.git.changedFiles(changedFiles.length)}</div>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {changedFiles.map((f, i) => {
              const si = statusIcon(f.status);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                  <span style={{ color: si.color, fontWeight: 600, fontSize: 10, width: 12, textAlign: 'center' }}>{si.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ marginTop: 2 }}>{t.drawer.git.enabled}: {status.enabled ? t.drawer.git.yes : t.drawer.git.no}</div>
    </div>
  );
}
