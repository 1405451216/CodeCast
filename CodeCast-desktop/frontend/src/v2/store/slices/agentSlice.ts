// frontend/src/v2/store/slices/agentSlice.ts
import type { StateCreator } from 'zustand';
import type { AgentInfo, AgentEventPayload } from '../../wails/types';
import { Agent } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

/** A single agent event in the log. We enrich the raw payload with a
 * local timestamp and a discriminator (`_type`) for fast UI filtering. */
export interface AgentEventLogEntry extends AgentEventPayload {
  _type: 'agent:start' | 'agent:stop' | 'agent:error' | 'agent:turn' | 'agent:turn_end' | 'agent:tool' | 'agent:tool_result';
  _ts: number;
}

/** Capacity for the in-memory event log. Oldest entries are dropped when
 * the log exceeds this size. Keeps the UI responsive even on long
 * sessions with thousands of tool calls. */
const EVENT_LOG_CAPACITY = 200;

export interface AgentSlice {
  agents: AgentInfo[];
  agentLoading: boolean;
  agentEventLog: AgentEventLogEntry[];
  agentStates: unknown;
  poolQueue: number;
  refreshAgents: (sessionID: string) => Promise<void>;
  getAgentDetail: (agentID: string) => Promise<AgentInfo | null>;
  cancelAgent: (agentID: string) => Promise<void>;
  cancelSessionAgents: (sessionID: string) => Promise<void>;
  dispatchAgents: (tasksJSON: string) => Promise<string[]>;
  appendAgentEvent: (payload: AgentEventLogEntry) => void;
  clearAgentEventLog: () => void;
  setAgentStates: (states: unknown) => void;
  setPoolQueue: (length: number) => void;
}

export const createAgentSlice: StateCreator<AgentSlice, [], [], AgentSlice> = (set) => ({
  agents: [],
  agentLoading: false,
  agentEventLog: [],
  agentStates: null,
  poolQueue: 0,

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
    set((s) => {
      const next = [...s.agentEventLog, payload];
      // LRU: drop oldest if over capacity.
      if (next.length > EVENT_LOG_CAPACITY) {
        next.splice(0, next.length - EVENT_LOG_CAPACITY);
      }
      return { agentEventLog: next };
    });
  },

  clearAgentEventLog: () => {
    set({ agentEventLog: [] });
  },

  setAgentStates: (states) => {
    set({ agentStates: states });
  },

  setPoolQueue: (length) => {
    set({ poolQueue: length });
  },
});
