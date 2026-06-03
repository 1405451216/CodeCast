import React from 'react';
import { useAppStore } from '../store';
import type { AgentInfo } from '../store/types';

interface AgentCardProps {
  agentIds: string[];
}

const statusIcons: Record<AgentInfo['status'], string> = {
  idle: '💤',
  running: '🔄',
  paused: '⏸️',
  waiting_for_input: '⏳',
  completed: '✅',
  failed: '❌',
  cancelled: '⛔',
};

const statusLabels: Record<AgentInfo['status'], string> = {
  idle: '空闲',
  running: '执行中',
  paused: '已暂停',
  waiting_for_input: '等待确认',
  completed: '完成',
  failed: '失败',
  cancelled: '已取消',
};

const AgentCardItem: React.FC<{ agent: AgentInfo }> = ({ agent }) => {
  const handleCancel = async () => {
    try {
      const { CancelAgent } = await import('../../wailsjs/go/main/App');
      await CancelAgent(agent.id);
    } catch (e) {
      console.error('Cancel agent failed:', e);
    }
  };

  return (
    <div className={`agent-card-item agent-status-${agent.status}`}>
      <span className="agent-icon">{statusIcons[agent.status]}</span>
      <div className="agent-info">
        <span className="agent-title">{agent.title}</span>
        <span className="agent-detail">
          {agent.status === 'running' && (
            <>Turn {agent.turn}/{agent.maxTurns}{agent.lastToolName && ` · ${agent.lastToolName}`}</>
          )}
          {agent.status === 'completed' && (
            <span className="agent-result">{agent.result?.slice(0, 80)}</span>
          )}
          {agent.status === 'failed' && (
            <span className="agent-error">{agent.error}</span>
          )}
          {agent.status === 'waiting_for_input' && statusLabels.waiting_for_input}
          {agent.status === 'cancelled' && statusLabels.cancelled}
        </span>
      </div>
      {(agent.status === 'running' || agent.status === 'waiting_for_input') && (
        <button className="agent-cancel-btn" onClick={handleCancel} title="取消">×</button>
      )}
    </div>
  );
};

const AgentCard: React.FC<AgentCardProps> = ({ agentIds }) => {
  const agents = useAppStore((s) =>
    s.agents.filter((a) => agentIds.includes(a.id) )
  );

  if (agents.length === 0) return null;

  const completed = agents.filter((a) => a.status === 'completed').length;
  const total = agents.length;

  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <span className="agent-card-title">🚀 并行执行 {total} 个子任务</span>
        <span className="agent-card-progress">{completed}/{total} 完成</span>
      </div>
      <div className="agent-card-list">
        {agents.map((agent) => (
          <AgentCardItem key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
};

export default AgentCard;
