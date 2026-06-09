import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store';
import { useError } from '../../lib/useError';
import { useI18n } from '../../lib/useI18n';

export function MemoryPanel() {
  useError('memory');
  const t = useI18n();
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

  // Memoize the formatted size so the string only changes when bytes do.
  const sizeStr = useMemo(() => {
    if (stats.sizeBytes < 1024) return `${stats.sizeBytes} B`;
    if (stats.sizeBytes < 1024 * 1024) return `${(stats.sizeBytes / 1024).toFixed(1)} KB`;
    return `${(stats.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [stats.sizeBytes]);

  return (
    <div style={{ padding: 8, fontSize: 12, color: 'var(--c-textMute)' }}>
      <div style={{ marginBottom: 4, fontWeight: 500, color: 'var(--c-text)' }}>
        {t.drawer.memory.title} {memoryLoading && <span style={{ color: 'var(--c-textMute)', fontWeight: 400 }}>({t.drawer.memory.loading})</span>}
      </div>
      <div>{t.drawer.memory.episodes}: {stats.totalEpisodes}</div>
      <div>{t.drawer.memory.size}: {sizeStr}</div>
      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--c-textMute)', fontStyle: 'italic' }}>
        {t.drawer.memory.localSearch} · {t.drawer.memory.localSearchDesc(stats.totalEpisodes)}
      </div>

      {/* Search input */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.drawer.memory.search}
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
          {t.drawer.memory.searchBtn}
        </button>
        {searchQuery && (
          <button
            onClick={() => { setQuery(''); searchMemory(''); }}
            style={{
              padding: '3px 6px',
              background: 'transparent', border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-sm)', color: 'var(--c-textMute)', fontSize: 11, cursor: 'pointer',
            }}
            title={t.drawer.memory.clearSearch}
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results summary */}
      {searchQuery && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--c-textMute)' }}>
          {t.drawer.memory.matchCount(recallResults.length, stats.totalEpisodes)}
        </div>
      )}

      {/* Search results list */}
      {searchQuery && recallResults.length > 0 && (
        <div style={{ marginTop: 4, maxHeight: 200, overflow: 'auto', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)' }}>
          {recallResults.slice(0, 20).map((r: any, i: number) => (
            <div
              key={i}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                color: 'var(--c-text)',
                borderBottom: i < Math.min(recallResults.length, 20) - 1 ? '1px solid var(--c-divider)' : 'none',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              {typeof r === 'string' ? r : r.content || r.text || JSON.stringify(r).slice(0, 120)}
            </div>
          ))}
          {recallResults.length > 20 && (
            <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--c-textMute)', textAlign: 'center' }}>
              {t.drawer.memory.moreResults(recallResults.length - 20)}
            </div>
          )}
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
        {t.drawer.memory.refresh}
      </button>
    </div>
  );
}
