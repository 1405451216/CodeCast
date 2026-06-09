// frontend/src/v2/store/slices/memorySlice.ts
//
// IMPORTANT (P1.7): Memory search runs **client-side** over the episodes
// already returned by `Metrics.snapshot()`. The backend does not expose
// a dedicated `SearchMemory` endpoint, so substring filtering happens
// here. This is fine for small/medium episode sets (< few thousand);
// if/when the backend adds a real search endpoint, swap the filter in
// `searchMemory` for an adapter call.
import type { StateCreator } from 'zustand';
import { Metrics } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface MemorySlice {
  episodes: any[];
  recallResults: any[];
  stats: { totalEpisodes: number; sizeBytes: number };
  memoryLoading: boolean;
  /** The current filter query. UI surfaces a "本地搜索" hint so the
   * user understands the search runs over the in-memory episode list. */
  searchQuery: string;
  searchMemory: (q: string) => Promise<void>;
  refreshMemory: () => Promise<void>;
}

/** Client-side substring filter (case-insensitive). Pulled out so the
 * behaviour is identical between `searchMemory` and `refreshMemory`. */
function filterEpisodes(episodes: unknown[], query: string): unknown[] {
  if (!query) return episodes;
  const q = query.toLowerCase();
  return episodes.filter((ep: any) => {
    const text = [ep.title, ep.summary, ep.content, ep.text, JSON.stringify(ep.tags)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(q);
  });
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
      const filtered = filterEpisodes(allEpisodes, q);
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
      const filtered = filterEpisodes(allEpisodes, get().searchQuery);
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
