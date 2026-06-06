// frontend/src/v2/store/slices/mcpSlice.ts
import type { StateCreator } from 'zustand';
import type { MCPStatusEntry } from '../../wails/types';
import { MCP } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface MCPSlice {
  servers: MCPStatusEntry[];
  loading: boolean;
  refreshMCP: () => Promise<void>;
  toggle: (id: string, enabled: boolean) => Promise<void>;
  add: (name: string, url: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const createMCPSlice: StateCreator<MCPSlice, [], [], MCPSlice> = (set) => ({
  servers: [],
  loading: false,

  refreshMCP: async () => {
    set({ loading: true });
    try {
      set({ servers: await MCP.status(), loading: false });
    } catch (e) {
      set({ loading: false });
      reportError('mcp', e);
    }
  },

  toggle: async (id, enabled) => {
    try {
      await MCP.toggle(id, enabled);
      set({ servers: await MCP.status() });
    } catch (e) {
      reportError('mcp', e);
    }
  },

  add: async (name, url) => {
    try {
      await MCP.add(name, url);
      set({ servers: await MCP.status() });
    } catch (e) {
      reportError('mcp', e);
    }
  },

  remove: async (id) => {
    try {
      await MCP.remove(id);
      set({ servers: await MCP.status() });
    } catch (e) {
      reportError('mcp', e);
    }
  },
});
