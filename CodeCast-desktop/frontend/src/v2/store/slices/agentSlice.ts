// frontend/src/v2/store/slices/agentSlice.ts
import type { StateCreator } from 'zustand';
import type { AgentInfo } from '../../wails/types';
import { Agent } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface AgentSlice {
  agents: AgentInfo[];
  agentLoading: boolean;
  agentEventLog: unknown[];
  refreshAgents: (sessionID: string) => Promise<void>;
  getAgentDetail: (agentID: string) => Promise<AgentInfo | null>;
  cancelAgent: (agentID: string) => Promise<void>;
  cancelSessionAgents: (sessionID: string) => Promise<void>;
  dispatchAgents: (tasksJSON: string) => Promise<string[]>;
  appendAgentEvent: (payload: unknown) => void;
}

export const createAgentSlice: StateCreator<AgentSlice, [], [], AgentSlice> = (set) => ({
  agents: [],
  agentLoading: false,
  agentEventLog: [],

  refreshAgents: async (sessionID) => {
    set({ agentLoading: true });
    try {
      set({ agents: await Agent.list(sessionID), agentLoading: false });
    } catch (e) {
      set({ agentLoading: false });
      reportError('agent', e);
    }
  },

  getAgentDetail: async (agentID) => {
    try {
      return await Agent.detail(agentID);
    } catch (e) {
      reportError('agent', e);
      return null;
    }
  },

  cancelAgent: async (agentID) => {
    try {
      await Agent.cancel(agentID);
    } catch (e) {
      reportError('agent', e);
    }
  },

  cancelSessionAgents: async (sessionID) => {
    try {
      await Agent.cancelSession(sessionID);
    } catch (e) {
      reportError('agent', e);
    }
  },

  dispatchAgents: async (tasksJSON) => {
    try {
      return await Agent.dispatch(tasksJSON);
    } catch (e) {
      reportError('agent', e);
      return [];
    }
  },

  appendAgentEvent: (payload) => {
    set((s) => ({ agentEventLog: [...s.agentEventLog, payload] }));
  },
});
