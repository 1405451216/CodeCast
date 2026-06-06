// frontend/src/v2/store/slices/memorySlice.ts
import type { StateCreator } from 'zustand';
import { Metrics } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface MemorySlice {
  episodes: any[];
  recallResults: any[];
  stats: { totalEpisodes: number; sizeBytes: number };
  memoryLoading: boolean;
  searchQuery: string;
  searchMemory: (q: string) => Promise<void>;
  refreshMemory: () => Promise<void>;
}

export const createMemorySlice: StateCreator<MemorySlice, [], [], MemorySlice> = (set, get) => ({
  episodes: [],
  recallResults: [],
  stats: { totalEpisodes: 0, sizeBytes: 0 },
  memoryLoading: false,
  searchQuery: '',

  searchMemory: async (q) => {
    set({ memoryLoading: true, searchQuery: q });
    try {
      const snap: any = await Metrics.snapshot();
      const allEpisodes: any[] = snap.episodes || [];

      // If query is provided, filter episodes client-side
      const filtered = q
        ? allEpisodes.filter((ep: any) => {
            const text = [ep.title, ep.summary, ep.content, ep.text, JSON.stringify(ep.tags)]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return text.includes(q.toLowerCase());
          })
        : allEpisodes;

      set({
        episodes: allEpisodes,
        recallResults: filtered,
        stats: { totalEpisodes: snap.totalEpisodes || 0, sizeBytes: snap.memorySizeBytes || 0 },
        memoryLoading: false,
      });
    } catch (e) {
      set({ memoryLoading: false });
      reportError('memory', e);
    }
  },

  refreshMemory: async () => {
    set({ memoryLoading: true });
    try {
      const snap: any = await Metrics.snapshot();
      const allEpisodes: any[] = snap.episodes || [];
      const currentQuery = get().searchQuery;

      // Re-apply current filter if a search is active
      const filtered = currentQuery
        ? allEpisodes.filter((ep: any) => {
            const text = [ep.title, ep.summary, ep.content, ep.text, JSON.stringify(ep.tags)]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return text.includes(currentQuery.toLowerCase());
          })
        : allEpisodes;

      set({
        episodes: allEpisodes,
        recallResults: filtered,
        stats: { totalEpisodes: snap.totalEpisodes || 0, sizeBytes: snap.memorySizeBytes || 0 },
        memoryLoading: false,
      });
    } catch (e) {
      set({ memoryLoading: false });
      reportError('memory', e);
    }
  },
});
