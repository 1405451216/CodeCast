import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';

/* ====================================================================
 *  Types
 * ==================================================================== */

interface Episode {
  title?: string;
  summary?: string;
  content?: string;
  text?: string;
  tags?: string[];
  [key: string]: unknown;
}

/* ====================================================================
 *  CastKnotePage — Knowledge Base
 * ==================================================================== */

export function CastKnotePage() {
  const {
    loadCatalog,
    byCategory,
    castLoading,
    invokeCastTool,
    castToolInvoking,
    castToolResult: _castToolResult,
    episodes,
    recallResults,
    memoryLoading,
    refreshMemory,
    searchMemory,
    searchQuery,
  } = useAppStore();

  // Suppress unused-variable warning for castToolResult;
  // we track our own retrieveResult locally for the retrieve panel.
  void _castToolResult;

  const [query, setQuery] = useState('');
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [retrieveResult, setRetrieveResult] = useState<string | null>(null);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);

  // Load catalog + memory on mount
  useEffect(() => {
    loadCatalog();
    refreshMemory();
  }, [loadCatalog, refreshMemory]);

  const knowledgeTools = byCategory['knowledge'] || [];
  const displayItems: Episode[] = searchQuery ? (recallResults as Episode[]) : (episodes as Episode[]);

  /* ---------- Handlers ---------- */

  const handleSearch = useCallback(() => {
    searchMemory(query);
  }, [query, searchMemory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        searchMemory(query);
      }
      if (e.key === 'Escape') {
        setQuery('');
        searchMemory('');
      }
    },
    [query, searchMemory],
  );

  const handleRetrieve = useCallback(async () => {
    if (!knowledgeTools.length) return;
    setRetrieveError(null);
    try {
      const toolName = knowledgeTools[0].name;
      const args = JSON.stringify({ query: query || '' });
      const result = await invokeCastTool(toolName, args);
      setRetrieveResult(result);
    } catch (err: unknown) {
      setRetrieveError(err instanceof Error ? err.message : String(err));
    }
  }, [knowledgeTools, query, invokeCastTool]);

  const getEpisodeTitle = (ep: Episode): string =>
    ep.title || (ep.summary ? ep.summary.slice(0, 60) : 'Untitled');

  const getEpisodeSummary = (ep: Episode): string =>
    ep.summary || ep.content || ep.text || '';

  /* ---------- Render ---------- */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px 0', maxWidth: 880, width: '100%', margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'var(--font-serif, serif)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--c-text)',
            margin: '0 0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18, opacity: 0.7 }}>&#x1F4DA;</span>
          知识库
        </h2>

        {/* Search bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            {/* Search icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--c-textMute)',
                pointerEvents: 'none',
              }}
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索知识库条目…  Enter 搜索 / Escape 清除"
              style={{
                width: '100%',
                padding: '9px 12px 9px 32px',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--r-md)',
                color: 'var(--c-text)',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color var(--dur-fast) var(--ease)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--c-textSub)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--c-border)')}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{
              padding: '9px 16px',
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-md)',
              color: 'var(--c-text)',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--dur-fast) var(--ease)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--c-surface-hover)';
              e.currentTarget.style.borderColor = 'var(--c-borderStrong)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--c-surface)';
              e.currentTarget.style.borderColor = 'var(--c-border)';
            }}
          >
            搜索
          </button>
          <button
            onClick={handleRetrieve}
            disabled={castToolInvoking || knowledgeTools.length === 0}
            style={{
              padding: '9px 16px',
              background: 'var(--c-accent)',
              border: '1px solid var(--c-accent)',
              borderRadius: 'var(--r-md)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: castToolInvoking || knowledgeTools.length === 0 ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: castToolInvoking || knowledgeTools.length === 0 ? 0.6 : 1,
              transition: 'all var(--dur-fast) var(--ease)',
            }}
          >
            {castToolInvoking ? '检索中…' : '检索'}
          </button>
        </div>

        {/* Active search indicator */}
        {searchQuery && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              fontSize: 12,
              color: 'var(--c-textSub)',
            }}
          >
            <span>
              搜索 &ldquo;{searchQuery}&rdquo; — 匹配 {recallResults.length} / {episodes.length} 条
            </span>
            <button
              onClick={() => { setQuery(''); searchMemory(''); }}
              style={{
                padding: '2px 8px',
                background: 'transparent',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--r-md)',
                color: 'var(--c-textMute)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              清除
            </button>
          </div>
        )}

        {/* Available knowledge tools (small indicator) */}
        {knowledgeTools.length > 0 && (
          <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--c-textMute)' }}>
            可用工具: {knowledgeTools.map((t) => t.name).join(', ')}
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 32px 24px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>

          {/* Loading state */}
          {(memoryLoading || castLoading) && displayItems.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
                color: 'var(--c-textMute)',
                fontSize: 14,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 16,
                  border: '2px solid var(--c-border)',
                  borderTopColor: 'var(--c-accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  marginRight: 8,
                }}
              />
              加载中…
              <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
            </div>
          )}

          {/* Empty state */}
          {!memoryLoading && !castLoading && displayItems.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
                color: 'var(--c-textMute)',
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                style={{ marginBottom: 12, opacity: 0.4 }}
              >
                <rect x="6" y="4" width="28" height="32" rx="3" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 12h16M12 18h12M12 24h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>暂无知识库条目</span>
              <span style={{ fontSize: 12, marginTop: 4 }}>
                {searchQuery ? '尝试不同的搜索关键词' : '知识库为空，请先添加条目'}
              </span>
            </div>
          )}

          {/* Episode cards grid */}
          {displayItems.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 10,
                marginTop: 4,
              }}
            >
              {displayItems.map((ep, idx) => {
                const isSelected = selectedEpisode === ep;
                const title = getEpisodeTitle(ep);
                const summary = getEpisodeSummary(ep);
                const tags = ep.tags || [];

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedEpisode(isSelected ? null : ep)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '14px 16px',
                      background: isSelected ? 'var(--c-accentSoft)' : 'var(--c-surface)',
                      border: `1px solid ${isSelected ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      borderRadius: 'var(--r-lg)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'all var(--dur-fast) var(--ease)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'var(--c-surface-hover)';
                        e.currentTarget.style.borderColor = 'var(--c-borderStrong)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'var(--c-surface)';
                        e.currentTarget.style.borderColor = 'var(--c-border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--c-text)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {title}
                    </div>
                    {summary && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--c-textSub)',
                          lineHeight: 1.5,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {summary}
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                        {tags.slice(0, 4).map((tag, ti) => (
                          <span
                            key={ti}
                            style={{
                              padding: '1px 6px',
                              background: 'var(--c-accentSoft)',
                              borderRadius: 'var(--r-md)',
                              fontSize: 10,
                              color: 'var(--c-accentText)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Detail panel */}
          {selectedEpisode && (
            <div
              style={{
                marginTop: 16,
                padding: '20px 24px',
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                borderRadius: 'var(--r-lg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 12,
                }}
              >
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--c-text)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {getEpisodeTitle(selectedEpisode)}
                </h3>
                <button
                  onClick={() => setSelectedEpisode(null)}
                  style={{
                    padding: '4px 8px',
                    background: 'transparent',
                    border: '1px solid var(--c-border)',
                    borderRadius: 'var(--r-md)',
                    color: 'var(--c-textMute)',
                    fontSize: 12,
                    cursor: 'pointer',
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                >
                  关闭
                </button>
              </div>

              {/* Tags */}
              {selectedEpisode.tags && selectedEpisode.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                  {selectedEpisode.tags.map((tag, ti) => (
                    <span
                      key={ti}
                      style={{
                        padding: '2px 8px',
                        background: 'var(--c-accentSoft)',
                        borderRadius: 'var(--r-md)',
                        fontSize: 11,
                        color: 'var(--c-accentText)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Full content */}
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--c-text)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {selectedEpisode.content ||
                  selectedEpisode.text ||
                  selectedEpisode.summary ||
                  '无详细内容'}
              </div>

              {/* Raw fields (for any extra fields on the episode) */}
              {Object.keys(selectedEpisode).length > 0 && (
                <details
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: '1px solid var(--c-border)',
                  }}
                >
                  <summary
                    style={{
                      fontSize: 11,
                      color: 'var(--c-textMute)',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    原始数据
                  </summary>
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: 'var(--c-bg)',
                      border: '1px solid var(--c-border)',
                      borderRadius: 'var(--r-md)',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--c-textSub)',
                      overflow: 'auto',
                      maxHeight: 200,
                      margin: '8px 0 0',
                    }}
                  >
                    {JSON.stringify(selectedEpisode, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Retrieve result area */}
          {(retrieveResult || retrieveError) && (
            <div
              style={{
                marginTop: 16,
                padding: '16px 20px',
                background: retrieveError ? 'rgba(220, 38, 38, 0.05)' : 'var(--c-surface)',
                border: `1px solid ${retrieveError ? 'var(--c-danger, #dc2626)' : 'var(--c-border)'}`,
                borderRadius: 'var(--r-lg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: retrieveError ? 'var(--c-danger, #dc2626)' : 'var(--c-text)',
                  }}
                >
                  {retrieveError ? '检索失败' : '检索结果'}
                </span>
                <button
                  onClick={() => { setRetrieveResult(null); setRetrieveError(null); }}
                  style={{
                    padding: '2px 8px',
                    background: 'transparent',
                    border: '1px solid var(--c-border)',
                    borderRadius: 'var(--r-md)',
                    color: 'var(--c-textMute)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  关闭
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: retrieveError ? 'var(--c-danger, #dc2626)' : 'var(--c-textSub)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                {retrieveError || retrieveResult}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
