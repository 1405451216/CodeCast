import type { SliceSet } from './storeTypes';

export interface ToolInvocation {
  id: string;
  toolName: string;
  category: string;
  args: string;
  result: string;
  isError: boolean;
  sessionId: string;
  durationMs: number;
  timestamp: number;
}

export interface ToolDefinition {
  name: string;
  category: string;
  description: string;
}

export interface ToolsSlice {
  invocations: ToolInvocation[];
  addInvocation: (inv: ToolInvocation) => void;
  clearHistory: () => void;
  getHistoryBySession: (sessionId: string, limit?: number) => ToolInvocation[];

  catalog: ToolDefinition[];
  setCatalog: (catalog: ToolDefinition[]) => void;
  getTool: (name: string) => ToolDefinition | undefined;
  getToolsByCategory: (category: string) => ToolDefinition[];

  activeToolId: string | null;
  setActiveTool: (id: string | null) => void;
}

export const createToolsSlice = (set: SliceSet): ToolsSlice => ({
  invocations: [],

  addInvocation: (inv) =>
    set((state) => ({
      invocations: [...(state.invocations as ToolInvocation[]), inv].slice(-200),
    })),

  clearHistory: () => set({ invocations: [] }),

  getHistoryBySession: (sessionId, limit = 50) => {
    const state = (set as any).getState?.() || {};
    const list = (state.invocations as ToolInvocation[]) || [];
    return list
      .filter((i) => i.sessionId === sessionId || i.sessionId === '')
      .slice(-limit)
      .reverse();
  },

  catalog: [],

  setCatalog: (catalog) => set({ catalog }),

  getTool: (name) => {
    const state = (set as any).getState?.() || {};
    const catalog = (state.catalog as ToolDefinition[]) || [];
    return catalog.find((t) => t.name === name);
  },

  getToolsByCategory: (category) => {
    const state = (set as any).getState?.() || {};
    const catalog = (state.catalog as ToolDefinition[]) || [];
    return catalog.filter((t) => t.category === category);
  },

  activeToolId: null,
  setActiveTool: (id) => set({ activeToolId: id }),
});
