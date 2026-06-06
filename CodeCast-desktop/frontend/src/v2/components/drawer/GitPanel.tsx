import { useError } from '../../lib/useError';

export function GitPanel() {
  useError('git');
  return <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>
    <div style={{ marginBottom: 4, fontWeight: 500 }}>Git Status</div>
    <div>Branch: main</div>
    <div>Ahead: 0 | Behind: 0</div>
    <div>Dirty: 0</div>
  </div>;
}
