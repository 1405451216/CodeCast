// frontend/src/v2/store/slices/castSlice.ts
import type { StateCreator } from 'zustand';
import type { ToolCatalogItem } from '../../wails/types';
import { Cast } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface CastInvocation { name: string; args: string; result?: string; at: number }
export interface CastSlice {
  catalog: ToolCatalogItem[];
  recent: CastInvocation[];
  byCategory: Record<string, ToolCatalogItem[]>;
  loading: boolean;
  loadCatalog: () => Promise<void>;
  loadHistory: (sessionId: string, limit?: number) => Promise<void>;
}

export const createCastSlice: StateCreator<CastSlice, [], [], CastSlice> = (set) => ({
  catalog: [], recent: [], byCategory: {}, loading: false,
  loadCatalog: async () => {
    set({ loading: true });
    try {
      const catalog = await Cast.catalog();
      const byCategory: Record<string, ToolCatalogItem[]> = {};
      catalog.forEach((t) => { (byCategory[t.category] ||= []).push(t); });
      set({ catalog, byCategory, loading: false });
    } catch (e) { set({ loading: false }); reportError('cast', e); }
  },
  loadHistory: async (sessionId, limit = 50) => {
    try { set({ recent: await Cast.history(sessionId, limit) }); }
    catch (e) { reportError('cast', e); }
  },
});
