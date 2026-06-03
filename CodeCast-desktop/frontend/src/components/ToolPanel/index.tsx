import React, { useState, useMemo } from 'react';
import ToolList from './ToolList';
import EmptyState from './EmptyState';
import CastToolCall from '../MessagesView/CastToolCall';
import { useAppStore, AppState } from '../../store';
import type { ToolInvocation } from '../../store/useToolsStore';

type Tab = 'catalog' | 'history';

/**
 * ToolPanel 3 栏布局右侧的动态工具面板。
 *
 * - 工具目录：列出所有可调用的 Cast AP Tool（按类别分组 + 搜索）
 * - 调用历史：按时间倒序显示 CastToolCall 卡片
 * - 顶栏显示当前 Tab 标题 + 总数徽章
 * - 移动端可折叠（< 768px）
 */
export const ToolPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('catalog');
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

  return (
    <aside className="tool-panel" role="complementary" aria-label="工具面板">
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
    </aside>
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
