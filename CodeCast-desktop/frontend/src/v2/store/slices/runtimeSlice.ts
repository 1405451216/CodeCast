// frontend/src/v2/store/slices/runtimeSlice.ts
import type { StateCreator } from 'zustand';
import type { APMetricsSnapshot, CacheStatsPayload, EnvCheckReportData } from '../../wails/types';

/**
 * Runtime slice — holds event-driven data that doesn't belong to a domain slice.
 * Populated by Go backend events (metrics:snapshot, cache:stats, env-check-report).
 */
export interface RuntimeSlice {
  metricsSnap: APMetricsSnapshot | null;
  cacheStats: CacheStatsPayload | null;
  envCheckReport: EnvCheckReportData | null;
  setMetricsSnap: (snap: APMetricsSnapshot) => void;
  setCacheStats: (stats: CacheStatsPayload) => void;
  setEnvCheckReport: (report: EnvCheckReportData) => void;
}

export const createRuntimeSlice: StateCreator<RuntimeSlice, [], [], RuntimeSlice> = (set) => ({
  metricsSnap: null,
  cacheStats: null,
  envCheckReport: null,

  setMetricsSnap: (snap) => set({ metricsSnap: snap }),
  setCacheStats: (stats) => set({ cacheStats: stats }),
  setEnvCheckReport: (report) => set({ envCheckReport: report }),
});
