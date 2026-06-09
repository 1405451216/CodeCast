import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { useFirstTool } from '../lib/useFirstTool';
import { copyToClipboard } from '../lib/clipboard';
import { useDraft } from '../lib/useDraft';
import { useResultHistory } from '../lib/useResultHistory';
import { useI18n } from '../lib/useI18n';

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
  const t = useI18n();
  const knowledge = useFirstTool('knowledge');
  const {
    invokeCastTool,
    castToolInvoking,
    episodes,
    recallResults,
    memoryLoading,
    refreshMemory,
    searchMemory,
    searchQuery,
  } = useAppStore();

  const [query, setQuery] = useDraft('knote:query', '');
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [inputHistory, setInputHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('codecast-input-history:knote') || '[]'); } catch { return []; }
  });
  const pushInputHistory = useCallback((val: string) => {
    if (!val.trim()) return;
    setInputHistory(prev => {
      const next = [val, ...prev.filter(v => v !== val)].slice(0, 10);
      try { localStorage.setItem('codecast-input-history:knote', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const resultHistory = useResultHistory<string>(5);
  const [retrieveResultLocal, setRetrieveResultLocal] = useState<string | null>(null);
  const retrieveResult = resultHistory.current ?? retrieveResultLocal;
  const setRetrieveResult = (v: string | null) => {
    setRetrieveResultLocal(v);
    if (v !== null) resultHistory.push(v);
  };
  const [retrieveError, setRetrieveError] = useState<string | null>(null);
  const [localInvoking, setLocalInvoking] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [copied, setCopied] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntryContent, setNewEntryContent] = useState('');
  const [localEntries, setLocalEntries] = useState<Array<{title: string; content: string; ts: number}>>(() => {
    try { return JSON.parse(localStorage.getItem('codecast-kb-entries') || '[]'); } catch { return []; }
  });

  // Load catalog + memory on mount
  useEffect(() => {
    knowledge.load();
    refreshMemory();
  }, [knowledge.load, refreshMemory]);

  const displayItems: Episode[] = searchQuery
    ? (recallResults as Episode[])
    : [
        ...localEntries.map((e, i) => ({ id: `local-${i}`, content: `${e.title}\n${e.content}`, createdAt: e.ts } as any)),
        ...(episodes as Episode[]),
      ];

  /* ---------- Handlers ---------- */

  const handleSearch = useCallback(() => {
    pushInputHistory(query);
    searchMemory(query);
  }, [query, searchMemory, pushInputHistory]);

  const handleRetrieve = useCallback(async () => {
    if (!knowledge.tool) return;
    setRetrieveError(null);
    setLocalInvoking(true);
    try {
      const args = JSON.stringify({ query: query || '' });
      const result = await invokeCastTool(knowledge.tool.name, args);
      setRetrieveResult(result);
    } catch (err: unknown) {
      setRetrieveError(err instanceof Error ? err.message : String(err));
    } finally {
      setLocalInvoking(false);
    }
  }, [knowledge.tool, query, invokeCastTool]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        if (e.ctrlKey || e.metaKey) {
          handleRetrieve();
        } else {
          searchMemory(query);
        }
      }
      if (e.key === 'Escape') {
        setQuery('');
        searchMemory('');
      }
    },
    [query, searchMemory, handleRetrieve],
  );

  const getEpisodeTitle = (ep: Episode): string =>
    ep.title || (ep.summary ? ep.summary.slice(0, 60) : 'Untitled');

  const getEpisodeSummary = (ep: Episode): string =>
    ep.summary || ep.content || ep.text || '';

  const handleCopyEpisode = useCallback(async () => {
    if (!selectedEpisode) return;
    const text = selectedEpisode.content || selectedEpisode.text || selectedEpisode.summary || '';
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedEpisode]);

  const visibleItems = displayItems.slice(0, pageSize);
  const hasMore = displayItems.length > pageSize;

  /* ---------- Render ---------- */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      {/* Header */}
      <div style={{ padding: '24px 32px 0', maxWidth: 'var(--page-max-width)', width: '100%', margin: '0 auto' }}>
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
          {t.knote.title}
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
              placeholder={t.knote.searchPlaceholder}
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
            {t.knote.search}
          </button>
          <button
            onClick={handleRetrieve}
            disabled={localInvoking || !knowledge.available}
            style={{
              padding: '9px 16px',
              background: 'var(--c-accent)',
              border: '1px solid var(--c-accent)',
              borderRadius: 'var(--r-md)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: localInvoking || !knowledge.available ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: localInvoking || !knowledge.available ? 0.6 : 1,
              transition: 'all var(--dur-fast) var(--ease)',
            }}
          >
            {localInvoking ? t.knote.retrieving : t.knote.retrieve}
          </button>
          <button
            onClick={() => setShowNewEntry(!showNewEntry)}
            style={{
              padding: '9px 16px',
              background: showNewEntry ? 'var(--c-accent)' : 'transparent',
              border: '1px solid var(--c-border)',
              borderRadius: 'var(--r-md)',
              color: showNewEntry ? '#fff' : 'var(--c-textSub)',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.knote.newEntry}
          </button>
        </div>

        {/* New entry form */}
        {showNewEntry && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-md)' }}>
            <input
              value={newEntryTitle}
              onChange={(e) => setNewEntryTitle(e.target.value)}
              placeholder={t.knote.entryTitle}
              style={{ width: '100%', padding: '6px 10px', marginBottom: 8, border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', fontSize: 13, background: 'var(--c-bg)', color: 'var(--c-text)', outline: 'none' }}
            />
            <textarea
              value={newEntryContent}
              onChange={(e) => setNewEntryContent(e.target.value)}
              placeholder={t.knote.entryContent}
              rows={4}
              style={{ width: '100%', padding: '6px 10px', marginBottom: 8, border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', fontSize: 13, background: 'var(--c-bg)', color: 'var(--c-text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (!newEntryTitle.trim()) return;
                  const entry = { title: newEntryTitle.trim(), content: newEntryContent.trim(), ts: Date.now() };
                  const updated = [entry, ...localEntries];
                  setLocalEntries(updated);
                  try { localStorage.setItem('codecast-kb-entries', JSON.stringify(updated)); } catch { /* ignore */ }
                  setNewEntryTitle('');
                  setNewEntryContent('');
                  setShowNewEntry(false);
                }}
                style={{ padding: '6px 14px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-sm)', fontSize: 12, cursor: 'pointer' }}
              >
                {t.knote.save}
              </button>
              <button
                onClick={() => { setShowNewEntry(false); setNewEntryTitle(''); setNewEntryContent(''); }}
                style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 'var(--r-sm)', fontSize: 12, cursor: 'pointer', color: 'var(--c-textMute)' }}
              >
                {t.knote.cancel}
              </button>
            </div>
          </div>
        )}

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
              搜索 &ldquo;{searchQuery}&rdquo; — {t.knote.searchResults(recallResults.length, episodes.length)}
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
              {t.knote.clear}
            </button>
          </div>
        )}

        {/* Available knowledge tools (small indicator) */}
        {knowledge.tools.length > 0 && (
          <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--c-textMute)' }}>
            {t.knote.availableTools}: {knowledge.tools.map((tool) => tool.name).join(', ')}
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 32px 24px' }}>
        <div style={{ maxWidth: 'var(--page-max-width)', margin: '0 auto' }}>

          {/* Loading state */}
          {(localInvoking || knowledge.loading) && displayItems.length === 0 && (
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
              {t.knote.loading}
            </div>
          )}

          {/* Empty state */}
          {!localInvoking && !knowledge.loading && displayItems.length === 0 && (
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
              <span>{t.knote.noEntries}</span>
              <span style={{ fontSize: 12, marginTop: 4 }}>
                {searchQuery ? t.knote.noEntriesSearchHint : t.knote.noEntriesHint}
              </span>
            </div>
          )}

          {/* Episode cards grid */}
          {visibleItems.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 10,
                marginTop: 4,
              }}
            >
              {visibleItems.map((ep, idx) => {
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

          {/* Load more */}
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <button
                onClick={() => setPageSize((p) => p + 20)}
                style={{
                  padding: '8px 20px',
                  background: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--c-text)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {t.knote.loadMore(displayItems.length - pageSize)}
              </button>
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
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <button
                    onClick={() => void handleCopyEpisode()}
                    style={{
                      padding: '4px 8px',
                      background: 'transparent',
                      border: '1px solid var(--c-border)',
                      borderRadius: 'var(--r-md)',
                      color: copied ? 'var(--c-accent)' : 'var(--c-textMute)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? t.knote.copied : t.knote.copy}
                  </button>
                  <button
                    onClick={() => {
                      const text = selectedEpisode?.content || selectedEpisode?.text || selectedEpisode?.summary || '';
                      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `knowledge-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      padding: '4px 8px',
                      background: 'transparent',
                      border: '1px solid var(--c-border)',
                      borderRadius: 'var(--r-md)',
                      color: 'var(--c-textMute)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {t.knote.download}
                  </button>
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
                    }}
                  >
                    {t.knote.close}
                  </button>
                </div>
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
                  t.knote.noContent}
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
                    {t.knote.rawData}
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
                  {retrieveError ? t.knote.retrieveFailed : t.knote.retrieveResult}
                </span>
                <button
                  onClick={async () => {
                    if (retrieveResult) { await copyToClipboard(retrieveResult); }
                  }}
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
                  {t.knote.copy}
                </button>
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
                  {t.knote.close}
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
