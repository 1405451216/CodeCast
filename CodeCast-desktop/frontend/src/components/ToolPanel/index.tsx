import React, { useState } from 'react';
import ToolList from './ToolList';
import EmptyState from './EmptyState';
import { useAppStore, AppState } from '../../store';
import CastToolCall from '../MessagesView/CastToolCall';
import type { ToolInvocation } from '../../store/useToolsStore';

type Tab = 'catalog' | 'history';

/**
 * ToolPanel 3 栏布局右侧的动态工具面板。
 * - 工具目录：列出所有可调用的 Cast AP Tool
 * - 调用历史：最近 20 次工具调用记录
 */
export const ToolPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('catalog');
  const invocations = useAppStore((s: AppState) => (s as any).invocations) as ToolInvocation[];

  return (
    <aside className="tool-panel" role="complementary" aria-label="工具面板">
      <div className="tool-panel-tabs">
        <button
          className={`tool-panel-tab ${tab === 'catalog' ? 'active' : ''}`}
          onClick={() => setTab('catalog')}
        >
          工具目录
        </button>
        <button
          className={`tool-panel-tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          调用历史 {invocations?.length ? `(${invocations.length})` : ''}
        </button>
      </div>
      <div className="tool-panel-body">
        {tab === 'catalog' && <ToolList />}
        {tab === 'history' && (
          invocations && invocations.length > 0 ? (
            <div className="tool-panel-history">
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
          ) : (
            <EmptyState title="暂无工具调用" hint="在对话中让 AI 调用任意 Cast 工具，调用记录会显示在这里" />
          )
        )}
      </div>
    </aside>
  );
};

export default ToolPanel;
