// frontend/src/v2/store/slices/castSlice.ts
import type { StateCreator } from 'zustand';
import type { ToolCatalogItem, CastInvocation } from '../../wails/types';
import { Cast } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface CastSlice {
  catalog: ToolCatalogItem[];
  recent: CastInvocation[];
  byCategory: Record<string, ToolCatalogItem[]>;
  castLoading: boolean;
  loadCatalog: () => Promise<void>;
  loadHistory: (sessionId: string, limit?: number) => Promise<void>;
  invokeTool: (name: string, argsJSON: string) => Promise<string>;
}

export const createCastSlice: StateCreator<CastSlice, [], [], CastSlice> = (set) => ({
  catalog: [], recent: [], byCategory: {}, castLoading: false,

  loadCatalog: async () => {
    set({ castLoading: true });
    try {
      const catalog = await Cast.catalog();
      const byCategory: Record<string, ToolCatalogItem[]> = {};
      catalog.forEach((t) => { (byCategory[t.category] ||= []).push(t); });
      set({ catalog, byCategory, castLoading: false });
    } catch (e) { set({ castLoading: false }); reportError('cast', e); }
  },

  loadHistory: async (sessionId, limit = 50) => {
    try { set({ recent: await Cast.history(sessionId, limit) }); }
    catch (e) { reportError('cast', e); }
  },

  invokeTool: async (name, argsJSON) => {
    try {
      return await Cast.invoke(name, argsJSON);
    } catch (e) {
      reportError('cast', e);
      throw e;
    }
  },
});
