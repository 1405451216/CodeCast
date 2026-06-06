// frontend/src/v2/store/slices/mcpSlice.ts
import type { StateCreator } from 'zustand';
import type { MCPServerStatus } from '../../wails/types';
import { MCP } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface MCPSlice {
  servers: MCPServerStatus[];
  loading: boolean;
  refreshMCP: () => Promise<void>;
  connect: (name: string) => Promise<void>;
  disconnect: (name: string) => Promise<void>;
}

export const createMCPSlice: StateCreator<MCPSlice, [], [], MCPSlice> = (set) => ({
  servers: [],
  loading: false,
  refreshMCP: async () => {
    set({ loading: true });
    try { set({ servers: await MCP.list(), loading: false }); }
    catch (e) { set({ loading: false }); reportError('mcp', e); }
  },
  connect: async (name) => {
    try { await MCP.connect(name); set({ servers: await MCP.list() }); }
    catch (e) { reportError('mcp', e); }
  },
  disconnect: async (name) => {
    try { await MCP.disconnect(name); set({ servers: await MCP.list() }); }
    catch (e) { reportError('mcp', e); }
  },
});
