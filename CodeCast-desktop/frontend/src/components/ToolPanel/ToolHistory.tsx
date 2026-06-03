import React from 'react';
import CastToolCall from '../MessagesView/CastToolCall';
import EmptyState from './EmptyState';
import { useAppStore, AppState } from '../../store';
import type { ToolInvocation } from '../../store/useToolsStore';

interface ToolHistoryProps {
  limit?: number;
}

/**
 * ToolHistory 列出最近 N 次 Cast Tool 调用。
 * 每条记录是 CastToolCall 卡片（可展开看 args/result）。
 */
export const ToolHistory: React.FC<ToolHistoryProps> = ({ limit = 30 }) => {
  const invocations = useAppStore((s: AppState) => (s as any).invocations) as ToolInvocation[];
  const clearHistory = useAppStore((s: AppState) => (s as any).clearHistory) as () => void;

  if (!invocations || invocations.length === 0) {
    return <EmptyState title="暂无工具调用" hint="在对话中让 AI 调用任意 Cast 工具" />;
  }

  return (
    <div className="tool-history">
      <div className="tool-history-header">
        <span>共 {invocations.length} 次调用（最近 {Math.min(limit, invocations.length)} 条）</span>
        <button className="tool-history-clear" onClick={clearHistory}>清空</button>
      </div>
      <div className="tool-history-list">
        {invocations.slice().reverse().slice(0, limit).map((inv) => (
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
  );
};

export default ToolHistory;
