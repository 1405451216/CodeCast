// frontend/src/v2/store/slices/castToolSlice.ts
// Note: replaces the old castSlice. This is the single source of truth for
// Cast tool catalog / history / invocation state.
import type { StateCreator } from 'zustand';
import type { ToolCatalogItem, CastInvocation } from '../../wails/types';
import { Cast } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface CastToolSlice {
  /** Available tools from backend catalog */
  castTools: ToolCatalogItem[];
  /** Tools grouped by category (derived from castTools on each load) */
  castToolByCategory: Record<string, ToolCatalogItem[]>;
  /** Recent tool invocation history */
  castToolHistory: CastInvocation[];
  /** Last invocation result (JSON string) */
  castToolResult: string | null;
  /** Whether a tool invocation is in progress */
  castToolInvoking: boolean;
  castToolLoading: boolean;
  /** Load tool catalog from backend */
  loadCastTools: () => Promise<void>;
  /** Invoke a cast tool by name with JSON args */
  invokeCastTool: (name: string, argsJSON: string) => Promise<string>;
  /** Refresh tool invocation history for a session */
  refreshCastToolHistory: (sessionId: string, limit?: number) => Promise<void>;
  /** Extract structured data from text */
  extractStructured: (text: string, schemaName: string) => Promise<string>;
}

/** Group a flat tool list by category. */
function groupByCategory(tools: ToolCatalogItem[]): Record<string, ToolCatalogItem[]> {
  const out: Record<string, ToolCatalogItem[]> = {};
  tools.forEach((t) => {
    (out[t.category] ||= []).push(t);
  });
  return out;
}

export const createCastToolSlice: StateCreator<CastToolSlice, [], [], CastToolSlice> = (set) => ({
  castTools: [],
  castToolByCategory: {},
  castToolHistory: [],
  castToolResult: null,
  castToolInvoking: false,
  castToolLoading: false,

  loadCastTools: async () => {
    set({ castToolLoading: true });
    try {
      const castTools = await Cast.catalog();
      set({ castTools, castToolByCategory: groupByCategory(castTools), castToolLoading: false });
    } catch (e) {
      set({ castToolLoading: false });
      reportError('castTool', e);
    }
  },

  invokeCastTool: async (name, argsJSON) => {
    set({ castToolInvoking: true });
    try {
      const result = await Cast.invoke(name, argsJSON);
      set({ castToolResult: result, castToolInvoking: false });
      return result;
    } catch (e) {
      set({ castToolInvoking: false });
      reportError('castTool', e);
      throw e;
    }
  },

  refreshCastToolHistory: async (sessionId, limit = 50) => {
    try {
      const castToolHistory = await Cast.history(sessionId, limit);
      set({ castToolHistory });
    } catch (e) {
      reportError('castTool', e);
    }
  },

  extractStructured: async (text, schemaName) => {
    try {
      return await Cast.extract(text, schemaName);
    } catch (e) {
      reportError('castTool', e);
      throw e;
    }
  },
});
