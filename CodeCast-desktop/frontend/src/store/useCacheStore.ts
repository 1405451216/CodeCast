import type { SliceSet } from './storeTypes';
import type { CacheStats } from '../api/types';

export interface CacheSlice {
  cacheStats: CacheStats | null;
  cacheEnabled: boolean;
  setCacheStats: (stats: CacheStats) => void;
  setCacheEnabled: (enabled: boolean) => void;
  handleCacheEvent: (stats: CacheStats) => void;
}

export const createCacheSlice = (set: SliceSet): CacheSlice => ({
  cacheStats: null,
  cacheEnabled: true,

  setCacheStats: (stats) => set({ cacheStats: stats }),
  setCacheEnabled: (enabled) => set({ cacheEnabled: enabled }),

  handleCacheEvent: (stats) => set({ cacheStats: stats }),
});
