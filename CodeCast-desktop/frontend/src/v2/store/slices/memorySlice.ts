// frontend/src/v2/store/slices/memorySlice.ts
import type { StateCreator } from 'zustand';
import { Metrics } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface MemorySlice {
  episodes: any[];
  recallResults: any[];
  stats: { totalEpisodes: number; sizeBytes: number };
  loading: boolean;
  search: (q: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const createMemorySlice: StateCreator<MemorySlice, [], [], MemorySlice> = (set) => ({
  episodes: [],
  recallResults: [],
  stats: { totalEpisodes: 0, sizeBytes: 0 },
  loading: false,
  search: async (_q) => {
    set({ loading: true });
    try {
      const snap: any = await Metrics.snapshot();
      set({
        recallResults: snap.episodes || [],
        stats: { totalEpisodes: snap.totalEpisodes || 0, sizeBytes: snap.memorySizeBytes || 0 },
        loading: false,
      });
    } catch (e) {
      set({ loading: false });
      reportError('memory', e);
    }
  },
  refresh: async () => {
    set({ loading: true });
    try {
      const snap: any = await Metrics.snapshot();
      set({ stats: { totalEpisodes: snap.totalEpisodes || 0, sizeBytes: snap.memorySizeBytes || 0 }, loading: false });
    } catch (e) {
      set({ loading: false });
      reportError('memory', e);
    }
  },
});
