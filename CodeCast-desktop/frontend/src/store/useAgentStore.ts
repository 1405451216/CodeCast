import type { SliceSet } from './storeTypes';
import type { SubAgent, AgentEvent } from './types';

export interface AgentSlice {
  agents: SubAgent[];
  addAgent: (agent: SubAgent) => void;
  updateAgent: (id: string, updates: Partial<SubAgent>) => void;
  removeAgent: (id: string) => void;
  getAgentsBySession: (sessionId: string) => SubAgent[];
  handleAgentEvent: (event: AgentEvent) => void;
}

export const createAgentSlice = (set: SliceSet): AgentSlice => ({
  agents: [],

  addAgent: (agent) =>
    set((state) => ({
      agents: [...(state.agents as SubAgent[]), agent],
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: (state.agents as SubAgent[]).map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      ),
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: (state.agents as SubAgent[]).filter((a) => a.id !== id),
    })),

  getAgentsBySession: (_sessionId: string) => {
    // This is a selector — will be used via useAppStore directly
    return [];
  },

  handleAgentEvent: (event) =>
    set((state) => {
      const agents = [...(state.agents as SubAgent[])];
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
});
