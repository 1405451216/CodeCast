// frontend/src/v2/store/slices/memorySlice.ts
import type { StateCreator } from 'zustand';
import { Metrics } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface MemorySlice {
  episodes: any[];
  recallResults: any[];
  stats: { totalEpisodes: number; sizeBytes: number };
  memoryLoading: boolean;
  searchMemory: (q: string) => Promise<void>;
  refreshMemory: () => Promise<void>;
}

export const createMemorySlice: StateCreator<MemorySlice, [], [], MemorySlice> = (set) => ({
  episodes: [],
  recallResults: [],
  stats: { totalEpisodes: 0, sizeBytes: 0 },
  memoryLoading: false,
  searchMemory: async (_q) => {
    set({ memoryLoading: true });
    try {
      const snap: any = await Metrics.snapshot();
      set({
        recallResults: snap.episodes || [],
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
      set({ stats: { totalEpisodes: snap.totalEpisodes || 0, sizeBytes: snap.memorySizeBytes || 0 }, memoryLoading: false });
    } catch (e) {
      set({ memoryLoading: false });
      reportError('memory', e);
    }
  },
});
