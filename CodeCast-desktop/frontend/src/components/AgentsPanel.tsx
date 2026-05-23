import React from 'react';
import { useAppStore } from '../store';
import type { SubAgent } from '../store/types';
import { shallow } from 'zustand/shallow';

const statusIcons: Record<SubAgent['status'], string> = {
  queued: '⏳',
  running: '🔄',
  completed: '✅',
  failed: '❌',
  cancelled: '⛔',
};

const AgentsPanel: React.FC = () => {
  const agents = useAppStore((s) => s.agents, shallow);
  const currentSessionId = useAppStore((s) => s.currentSessionId);

  const sessionAgents = agents.filter((a) => a.sessionId === currentSessionId);
  const activeAgents = sessionAgents.filter((a) => a.status === 'running' || a.status === 'queued');
  const completedAgents = sessionAgents.filter((a) => a.status === 'completed' || a.status === 'failed' || a.status === 'cancelled');

  const handleCancel = async (agentId: string) => {
    try {
      const { CancelAgent } = await import('../../wailsjs/go/main/App');
      await CancelAgent(agentId);
    } catch (e) {
      console.error('Cancel agent failed:', e);
    }
  };

  return (
    <div className="agents-panel">
      <div className="agents-panel-header">子任务</div>

      {sessionAgents.length === 0 ? (
        <div className="agents-panel-empty">
          当前会话没有子任务
        </div>
      ) : (
        <>
          {activeAgents.length > 0 && (
            <div className="agents-panel-group">
              <div className="agents-panel-group-title">活跃</div>
              {activeAgents.map((agent) => (
                <div key={agent.id} className="agents-panel-item">
                  <span>{statusIcons[agent.status]}</span>
                  <span className="agents-panel-item-title">{agent.title}</span>
                  <span className="agents-panel-item-status">
                    {agent.status === 'running' ? `${agent.turn}/${agent.maxTurns}` : '等待中'}
                  </span>
                  <button
                    className="agent-cancel-btn"
                    onClick={() => handleCancel(agent.id)}
                    title="取消"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {completedAgents.length > 0 && (
            <div className="agents-panel-group">
              <div className="agents-panel-group-title">已完成</div>
              {completedAgents.map((agent) => (
                <div key={agent.id} className="agents-panel-item">
                  <span>{statusIcons[agent.status]}</span>
                  <span className="agents-panel-item-title">{agent.title}</span>
                  <span className="agents-panel-item-status">
                    {agent.status === 'completed' ? '完成' : agent.status === 'failed' ? '失败' : '取消'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default React.memo(AgentsPanel);
