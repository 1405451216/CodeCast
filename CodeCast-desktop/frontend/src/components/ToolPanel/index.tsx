import React, { useState, useMemo } from 'react';
import ToolList from './ToolList';
import EmptyState from './EmptyState';
import CastToolCall from '../MessagesView/CastToolCall';
import { useAppStore, AppState } from '../../store';
import type { ToolInvocation } from '../../store/useToolsStore';

type Tab = 'catalog' | 'history';

/**
 * ToolPanel — 工具目录与调用历史面板
 *
 * 以 overlay 形式覆盖在 main 区域上，与 PluginsPanel/AutomationPanel 一致。
 * 通过 activePanel === 'tools' 控制显示/隐藏。
 */
export const ToolPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('catalog');
  const activePanel = useAppStore((s: AppState) => s.activePanel);
  const setActivePanel = useAppStore((s: AppState) => s.setActivePanel);
  const invocations = useAppStore((s: AppState) => (s as any).invocations) as ToolInvocation[];
  const catalog = useAppStore((s: AppState) => (s as any).catalog) as any[];

  const stats = useMemo(() => {
    const inv = invocations || [];
    return {
      total: inv.length,
      success: inv.filter((i) => !i.isError).length,
      error: inv.filter((i) => i.isError).length,
    };
  }, [invocations]);

  if (activePanel !== 'tools') return null;

  return (
    <div className="panel-overlay">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">工具面板</span>
        <button
          className="panel-close-btn"
          onClick={() => setActivePanel(null)}
          title="关闭"
          aria-label="关闭工具面板"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="tool-panel-tabs" role="tablist">
        <button
          className={`tool-panel-tab ${tab === 'catalog' ? 'active' : ''}`}
          onClick={() => setTab('catalog')}
          role="tab"
          aria-selected={tab === 'catalog'}
        >
          <span className="tool-panel-tab-icon">🧰</span>
          <span>工具目录</span>
          {catalog?.length > 0 && (
            <span className="tool-panel-tab-badge">{catalog.length}</span>
          )}
        </button>
        <button
          className={`tool-panel-tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
          role="tab"
          aria-selected={tab === 'history'}
        >
          <span className="tool-panel-tab-icon">📜</span>
          <span>调用历史</span>
          {stats.total > 0 && (
            <span className="tool-panel-tab-badge">{stats.total}</span>
          )}
        </button>
      </div>

      <div className="tool-panel-body">
        {tab === 'catalog' && <ToolList />}

        {tab === 'history' && (
          invocations && invocations.length > 0 ? (
            <div className="tool-panel-history">
              <div className="tool-panel-history-header">
                <span className="tool-panel-history-stats">
                  <span className="stat-success">✓ {stats.success}</span>
                  <span className="stat-error">✗ {stats.error}</span>
                </span>
                <ClearHistoryButton />
              </div>
              <div className="tool-panel-history-list">
                {invocations.slice().reverse().map((inv) => (
                  <CastToolCall
                    key={inv.id}
                    toolName={inv.toolName}
                    category={inv.category}
                    args={inv.args}
                    result={inv.result}
                    isError={inv.isError}
                    durationMs={inv.durationMs}
                    timestamp={inv.timestamp}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon="📜"
              title="暂无工具调用"
              hint="在对话中让 AI 调用任意 Cast 工具，调用记录会显示在这里"
            />
          )
        )}
      </div>
    </div>
  );
};

/** 提取清空按钮为子组件，避免重复 useAppStore selector */
const ClearHistoryButton: React.FC = () => {
  const clearHistory = useAppStore((s: AppState) => (s as any).clearHistory) as () => void;
  return (
    <button
      className="tool-panel-history-clear"
      onClick={() => {
        if (confirm('清空所有调用历史？')) clearHistory();
      }}
      title="清空历史"
    >
      🗑️ 清空
    </button>
  );
};

export default ToolPanel;
