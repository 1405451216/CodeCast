import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../store';
import { useError } from '../../lib/useError';

export function MemoryPanel() {
  useError('memory');
  const { stats, memoryLoading, recallResults, searchQuery, refreshMemory, searchMemory } = useAppStore();
  const [query, setQuery] = useState('');

  useEffect(() => { refreshMemory(); }, [refreshMemory]);

  const handleSearch = useCallback(() => {
    searchMemory(query);
  }, [query, searchMemory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') searchMemory(query);
    if (e.key === 'Escape') { setQuery(''); searchMemory(''); }
  }, [query, searchMemory]);

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

      {/* Search input */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索 memory…"
          style={{
            flex: 1, padding: '3px 8px',
            background: 'var(--c-bgSub)', border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-sm)', color: 'var(--c-text)', fontSize: 11,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '3px 8px',
            background: 'var(--c-surface-hover)', border: '1px solid var(--c-border)',
            borderRadius: 'var(--r-sm)', color: 'var(--c-textSub)', fontSize: 11, cursor: 'pointer',
          }}
        >
          搜索
        </button>
        {searchQuery && (
          <button
            onClick={() => { setQuery(''); searchMemory(''); }}
            style={{
              padding: '3px 6px',
              background: 'transparent', border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-sm)', color: 'var(--c-textMute)', fontSize: 11, cursor: 'pointer',
            }}
            title="清除搜索"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results summary */}
      {searchQuery && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--c-textMute)' }}>
          匹配 {recallResults.length} / {stats.totalEpisodes} 条
        </div>
      )}

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
