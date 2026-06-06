import { useError } from '../../lib/useError';

export function MemoryPanel() {
  useError('memory');
  return <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>
    <div style={{ marginBottom: 4, fontWeight: 500 }}>Memory</div>
    <div>Episodes: 0</div>
    <div>Size: 0 B</div>
  </div>;
}
