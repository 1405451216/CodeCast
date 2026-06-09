import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store';
import type { ToolCatalogItem, CastInvocation } from '../wails/types';
import { OrchestrationRunner } from '../components/orchestration/OrchestrationRunner';
import { useDraft } from '../lib/useDraft';
import { useResultHistory } from '../lib/useResultHistory';
import { TopBar } from '../layout/TopBar';

/* ====================================================================
 *  Styles
 * ==================================================================== */

const S = {
  wrap: {
    padding: 32,
    maxWidth: 'var(--page-max-width)',
    margin: '0 auto',
  } as React.CSSProperties,
  title: {
    fontFamily: 'var(--font-serif, serif)',
    fontSize: 20,
    color: 'var(--c-text)',
    margin: 0,
    marginBottom: 20,
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--c-text)',
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    outline: 'none',
    transition: 'border-color var(--dur-fast) var(--ease)',
    marginBottom: 16,
  } as React.CSSProperties,
  chipRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
    marginBottom: 20,
  } as React.CSSProperties,
  chip: (active: boolean) =>
    ({
      display: 'inline-block',
      padding: '5px 14px',
      fontSize: 13,
      fontWeight: 500,
      color: active ? 'var(--c-accentText)' : 'var(--c-textSub)',
      background: active ? 'var(--c-accentSoft)' : 'var(--c-surface)',
      border: `1px solid ${active ? 'var(--c-accent)' : 'var(--c-border)'}`,
      borderRadius: 'var(--r-pill, 999px)',
      cursor: 'pointer',
      transition: 'all var(--dur-fast) var(--ease)',
      userSelect: 'none' as const,
    }) as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
    marginBottom: 28,
  } as React.CSSProperties,
  card: (selected: boolean) =>
    ({
      padding: 14,
      background: 'var(--c-surface)',
      border: `1px solid ${selected ? 'var(--c-accent)' : 'var(--c-border)'}`,
      borderRadius: 'var(--r-lg)',
      cursor: 'pointer',
      transition: 'all var(--dur-fast) var(--ease)',
    }) as React.CSSProperties,
  cardName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--c-text)',
    marginBottom: 4,
  } as React.CSSProperties,
  cardDesc: {
    fontSize: 12,
    color: 'var(--c-textSub)',
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--c-textMute)',
    background: 'var(--c-bg, #faf9f5)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-sm, 4px)',
    marginRight: 6,
    marginBottom: 4,
  } as React.CSSProperties,
  detailPanel: {
    padding: 20,
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-lg)',
    marginBottom: 28,
  } as React.CSSProperties,
  detailTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--c-text)',
    marginBottom: 4,
  } as React.CSSProperties,
  detailDesc: {
    fontSize: 13,
    color: 'var(--c-textSub)',
    lineHeight: 1.6,
    marginBottom: 16,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--c-textSub)',
    marginBottom: 6,
    letterSpacing: 0.3,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 13,
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--c-text)',
    background: 'var(--c-bg, #faf9f5)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    outline: 'none',
    resize: 'vertical' as const,
    lineHeight: 1.6,
    minHeight: 100,
  } as React.CSSProperties,
  primaryBtn: (disabled: boolean) =>
    ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '9px 20px',
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'inherit',
      color: '#fff',
      background: disabled ? 'var(--c-border)' : 'var(--c-accent)',
      border: 'none',
      borderRadius: 'var(--r-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background var(--dur-fast) var(--ease)',
      marginTop: 12,
    }) as React.CSSProperties,
  resultBox: {
    marginTop: 12,
    padding: 14,
    background: 'var(--c-bg, #faf9f5)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--c-text)',
    whiteSpace: 'pre-wrap' as const,
    maxHeight: 240,
    overflow: 'auto',
  } as React.CSSProperties,
  historySection: {
    marginTop: 8,
  } as React.CSSProperties,
  historyTitle: {
    fontFamily: 'var(--font-serif, serif)',
    fontSize: 16,
    color: 'var(--c-text)',
    margin: 0,
    marginBottom: 12,
  } as React.CSSProperties,
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    marginBottom: 6,
  } as React.CSSProperties,
  historyToolName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--c-text)',
    minWidth: 100,
    flexShrink: 0,
  } as React.CSSProperties,
  historyDuration: {
    fontSize: 12,
    color: 'var(--c-textMute)',
    flexShrink: 0,
    minWidth: 60,
  } as React.CSSProperties,
  errorBadge: {
    display: 'inline-block',
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--c-danger)',
    borderRadius: 'var(--r-sm, 4px)',
    flexShrink: 0,
  } as React.CSSProperties,
  okBadge: {
    display: 'inline-block',
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--c-success, #3A8266)',
    borderRadius: 'var(--r-sm, 4px)',
    flexShrink: 0,
  } as React.CSSProperties,
  historyResult: {
    fontSize: 12,
    color: 'var(--c-textSub)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    minWidth: 0,
  } as React.CSSProperties,
  emptyState: {
    padding: 24,
    textAlign: 'center' as const,
    color: 'var(--c-textMute)',
    fontSize: 13,
  } as React.CSSProperties,
  spinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  } as React.CSSProperties,
  closeBtn: {
    float: 'right' as const,
    background: 'none',
    border: 'none',
    fontSize: 18,
    color: 'var(--c-textMute)',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    fontFamily: 'inherit',
  } as React.CSSProperties,
} as const;

/* ====================================================================
 *  Helper: truncate text
 * ==================================================================== */

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

/* ====================================================================
 *  Component
 * ==================================================================== */

export function CastToolsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || '';

  const MODE_LABELS: Record<string, string> = {
    review: '代码审查',
    test: '生成测试',
    refactor: '智能重构',
    commit: '提交信息',
  };

  const {
    castTools,
    castToolByCategory,
    castToolHistory,
    castToolInvoking,
    castToolLoading,
    loadCastTools,
    invokeCastTool,
    refreshCastToolHistory,
    currentSessionId,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useDraft('tools:search', '');
  const [activeCategory, setActiveCategory] = useDraft<string>('tools:category', '全部');
  const [selectedTool, setSelectedTool] = useState<ToolCatalogItem | null>(null);
  const [argsInput, setArgsInput] = useDraft('tools:args', '{}');
  const resultHistory = useResultHistory<string>(5);
  const [runResultLocal, setRunResultLocal] = useState<string | null>(null);
  const runResult = resultHistory.current ?? runResultLocal;
  const setRunResult = (v: string | null) => {
    setRunResultLocal(v);
    if (v !== null) resultHistory.push(v);
  };
  const [runError, setRunError] = useState<string | null>(null);

  /* Load data on mount */
  useEffect(() => {
    loadCastTools();
  }, [loadCastTools]);

  /* Load history when session is available */
  useEffect(() => {
    if (currentSessionId) {
      refreshCastToolHistory(currentSessionId, 10);
    }
  }, [currentSessionId, refreshCastToolHistory]);

  /* Derive categories list */
  const categories = useMemo(() => {
    const cats = Object.keys(castToolByCategory);
    return ['全部', ...cats];
  }, [castToolByCategory]);

  /* Filter tools based on search + category */
  const filteredTools = useMemo(() => {
    let tools = castTools;

    if (activeCategory !== '全部') {
      tools = tools.filter((t) => t.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }

    return tools;
  }, [castTools, activeCategory, searchQuery]);

  /* Tool click handler */
  const handleSelectTool = useCallback((tool: ToolCatalogItem) => {
    setSelectedTool(tool);
    setArgsInput('{}');
    setRunResult(null);
    setRunError(null);
  }, []);

  /* Close detail panel */
  const handleCloseDetail = useCallback(() => {
    setSelectedTool(null);
    setRunResult(null);
    setRunError(null);
  }, []);

  /* Run tool handler */
  const handleRun = useCallback(async () => {
    if (!selectedTool) return;

    /* Validate JSON */
    try {
      JSON.parse(argsInput);
    } catch {
      setRunError('无效的 JSON 格式，请检查输入');
      return;
    }

    setRunError(null);
    setRunResult(null);

    try {
      const res = await invokeCastTool(selectedTool.name, argsInput);
      setRunResult(res);
      /* Refresh history after a successful run */
      if (currentSessionId) {
        refreshCastToolHistory(currentSessionId, 10);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '运行失败，请重试';
      setRunError(msg);
    }
  }, [selectedTool, argsInput, invokeCastTool, currentSessionId, refreshCastToolHistory]);

  /* Last 10 history items */
  const recentHistory = useMemo(
    () => castToolHistory.slice(0, 10),
    [castToolHistory],
  );

  const isLoading = castToolLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--c-bg)' }}>
      <TopBar onBack={() => navigate('/')} backLabel={MODE_LABELS[mode] || '工具箱'} />

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '24px 32px', minHeight: 0, overscrollBehavior: 'contain' }}>
      <div style={S.wrap}>

      <h2 style={S.title}>工具箱</h2>

      {/* Search input */}
      <input
        style={S.searchInput}
        placeholder="搜索工具名称或描述..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Category tabs */}
      <div style={S.chipRow}>
        {categories.map((cat) => (
          <span
            key={cat}
            style={S.chip(activeCategory === cat)}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={S.emptyState}>正在加载工具列表...</div>
      )}

      {/* Tool grid */}
      {!isLoading && filteredTools.length === 0 && (
        <div style={S.emptyState}>没有找到匹配的工具</div>
      )}

      {!isLoading && filteredTools.length > 0 && (
        <div style={S.grid}>
          {filteredTools.map((tool) => (
            <div
              key={tool.name}
              style={S.card(selectedTool?.name === tool.name)}
              onClick={() => handleSelectTool(tool)}
            >
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={S.badge}>{tool.category}</span>
              </div>
              <div style={S.cardName}>{tool.name}</div>
              <div style={S.cardDesc}>{tool.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedTool && (
        <div style={S.detailPanel}>
          <button style={S.closeBtn} onClick={handleCloseDetail} title="关闭">
            &times;
          </button>

          <div style={S.detailTitle}>{selectedTool.name}</div>
          <div style={{ marginBottom: 6 }}>
            <span style={S.badge}>{selectedTool.category}</span>
          </div>
          <div style={S.detailDesc}>{selectedTool.description}</div>

          {/* Args input */}
          <div style={{ marginBottom: 4 }}>
            <div style={S.sectionLabel}>参数 (JSON)</div>
            <textarea
              style={S.textarea}
              value={argsInput}
              onChange={(e) => setArgsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleRun();
                }
              }}
              placeholder='{"key": "value"}'
              spellCheck={false}
            />
          </div>

          {/* Run button */}
          <button
            style={S.primaryBtn(castToolInvoking)}
            disabled={castToolInvoking}
            onClick={handleRun}
          >
            {castToolInvoking && <span style={S.spinner} />}
            {castToolInvoking ? '运行中...' : '运行'}
          </button>

          {/* Error */}
          {runError && (
            <div style={{ fontSize: 13, color: 'var(--c-danger)', marginTop: 10 }}>
              {runError}
            </div>
          )}

          {/* Result */}
          {(runResult !== null || castToolInvoking) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={S.sectionLabel}>结果</div>
                {runResult && (
                  <button
                    onClick={async () => {
                      const { copyToClipboard } = await import('../lib/clipboard');
                      await copyToClipboard(runResult);
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
                    复制
                  </button>
                )}
                {runResult && (
                  <button
                    onClick={() => {
                      const blob = new Blob([runResult], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `tool-result-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
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
                    下载
                  </button>
                )}
              </div>
              <div style={S.resultBox}>
                {castToolInvoking && runResult === null
                  ? '正在执行...'
                  : runResult}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History section */}
      <div style={S.historySection}>
        <h3 style={S.historyTitle}>最近调用</h3>

        {recentHistory.length === 0 && (
          <div style={S.emptyState}>暂无调用记录</div>
        )}

        {recentHistory.map((inv: CastInvocation) => (
          <div key={inv.id} style={S.historyItem}>
            <span style={S.historyToolName}>{inv.toolName}</span>
            <span style={S.historyDuration}>{inv.durationMs}ms</span>
            <span style={inv.isError ? S.errorBadge : S.okBadge}>
              {inv.isError ? '失败' : '成功'}
            </span>
            <span style={S.historyResult}>
              {truncate(inv.result, 80)}
            </span>
          </div>
        ))}
      </div>

      {/* Orchestration workflows */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--c-divider)' }}>
        <OrchestrationRunner />
      </div>
      </div>
      </div>
    </div>
  );
}
