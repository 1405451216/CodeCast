import type { SliceSet } from './storeTypes';

// 从 @agentprimordia/sdk 导入基础类型
import type { ToolCallResponse, ToolDefinition } from '@agentprimordia/sdk';

export type { ToolCallResponse, ToolDefinition } from '@agentprimordia/sdk';
export type CastTool = ToolDefinition & { category: string };

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

export interface ToolsSlice {
  invocations: ToolInvocation[];
  addInvocation: (inv: ToolInvocation) => void;
  clearHistory: () => void;
  getHistoryBySession: (sessionId: string, limit?: number) => ToolInvocation[];

  catalog: CastTool[];
  setCatalog: (catalog: CastTool[]) => void;
  getTool: (name: string) => CastTool | undefined;
  getToolsByCategory: (category: string) => CastTool[];

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
    const catalog = (state.catalog as CastTool[]) || [];
    return catalog.find((t) => t.name === name);
  },

  getToolsByCategory: (category) => {
    const state = (set as any).getState?.() || {};
    const catalog = (state.catalog as CastTool[]) || [];
    return catalog.filter((t) => t.category === category);
  },

  activeToolId: null,
  setActiveTool: (id) => set({ activeToolId: id }),
});
