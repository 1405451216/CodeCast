import { useEffect } from 'react';
import { useAppStore } from '../../store';
import { useError } from '../../lib/useError';

export function MemoryPanel() {
  useError('memory');
  const { stats, memoryLoading, refreshMemory } = useAppStore();

  useEffect(() => { refreshMemory(); }, [refreshMemory]);

  const sizeStr = stats.sizeBytes < 1024
    ? `${stats.sizeBytes} B`
    : stats.sizeBytes < 1024 * 1024
      ? `${(stats.sizeBytes / 1024).toFixed(1)} KB`
      : `${(stats.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>
      <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--c-text)' }}>
        Memory {memoryLoading && <span style={{ color: 'var(--c-textMute)', fontWeight: 400 }}>(loading…)</span>}
      </div>
      <div>Episodes: {stats.totalEpisodes}</div>
      <div>Size: {sizeStr}</div>
      <button
        onClick={refreshMemory}
        style={{
          marginTop: 6, padding: '3px 8px',
          background: 'var(--c-surface-hover)', border: '1px solid var(--c-border)',
          borderRadius: 'var(--r-sm)', color: 'var(--c-textSub)', fontSize: 11, cursor: 'pointer',
        }}
      >
        Refresh
      </button>
    </div>
  );
}
