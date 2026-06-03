import type { SliceSet } from './storeTypes';
import type { AgentInfo, AgentEvent } from './types';

export interface AgentSlice {
  agents: AgentInfo[];
  addAgent: (agent: AgentInfo) => void;
  updateAgent: (id: string, updates: Partial<AgentInfo>) => void;
  removeAgent: (id: string) => void;
  getAgentsBySession: (sessionId: string) => AgentInfo[];
  handleAgentEvent: (event: AgentEvent) => void;
  handleAPEvent: (eventType: string, payload: any) => void;
}

export const createAgentSlice = (set: SliceSet): AgentSlice => ({
  agents: [],

  addAgent: (agent) =>
    set((state) => ({
      agents: [...(state.agents as AgentInfo[]), agent],
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: (state.agents as AgentInfo[]).map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      ),
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: (state.agents as AgentInfo[]).filter((a) => a.id !== id),
    })),

  getAgentsBySession: (_sessionId: string) => {
    return [];
  },

  handleAgentEvent: (event) =>
    set((state) => {
      const agents = [...(state.agents as AgentInfo[])];
      const idx = agents.findIndex((a) => a.id === event.agent_id);
      if (idx === -1) return {};

      const agent = { ...agents[idx] };

      switch (event.type) {
        case 'status':
          if (event.status) agent.status = event.status;
          break;
        case 'progress':
          if (event.turn !== undefined) agent.turn = event.turn;
          if (event.max_turns !== undefined) agent.maxTurns = event.max_turns;
          break;
        case 'tool_use':
          if (event.tool_name) agent.lastToolName = event.tool_name;
          break;
        case 'result':
          if (event.message) agent.result = event.message;
          agent.status = 'completed';
          break;
      }

      agent.updatedAt = new Date().toISOString();
      agents[idx] = agent;
      return { agents };
    }),

  // AP EventBus event handler — bridges AP event names to agent state updates
  handleAPEvent: (eventType, payload) =>
    set((state) => {
      const agents = [...(state.agents as AgentInfo[])];

      switch (eventType) {
        case 'agent:start': {
          const agentId = payload?.agent_id || payload?.id;
          const idx = agents.findIndex((a) => a.id === agentId);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], status: 'running', updatedAt: new Date().toISOString() };
          } else if (agentId) {
            agents.push({
              id: agentId,
              sessionId: payload?.session_id || '',
              title: payload?.title || 'Agent',
              status: 'running',
              turn: 0,
              maxTurns: payload?.max_turns || 20,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          break;
        }
        case 'agent:stop': {
          const agentId = payload?.agent_id || payload?.id;
          const idx = agents.findIndex((a) => a.id === agentId);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], status: 'completed', result: payload?.content, updatedAt: new Date().toISOString() };
          }
          break;
        }
        case 'agent:error': {
          const agentId = payload?.agent_id || payload?.id;
          const idx = agents.findIndex((a) => a.id === agentId);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], status: 'failed', error: payload?.error || payload?.message, updatedAt: new Date().toISOString() };
          }
          break;
        }
        case 'agent:turn': {
          const agentId = payload?.agent_id || payload?.id;
          const idx = agents.findIndex((a) => a.id === agentId);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], turn: (agents[idx].turn || 0) + 1, updatedAt: new Date().toISOString() };
          }
          break;
        }
        case 'agent:tool': {
          const agentId = payload?.agent_id || payload?.id;
          const idx = agents.findIndex((a) => a.id === agentId);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], lastToolName: payload?.tool_name, updatedAt: new Date().toISOString() };
          }
          break;
        }
        case 'pool:dispatch': {
          const taskIds: string[] = payload?.task_ids || [];
          for (const tid of taskIds) {
            if (!agents.find((a) => a.id === tid)) {
              agents.push({
                id: tid,
                sessionId: payload?.session_id || '',
                title: payload?.title || `Task ${tid.slice(0, 8)}`,
                status: 'idle',
                turn: 0,
                maxTurns: 10,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
          break;
        }
        case 'pool:complete': {
          const taskId = payload?.task_id || payload?.id;
          const idx = agents.findIndex((a) => a.id === taskId);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], status: payload?.error ? 'failed' : 'completed', result: payload?.content, error: payload?.error, updatedAt: new Date().toISOString() };
          }
          break;
        }
      }

      return { agents };
    }),
});
