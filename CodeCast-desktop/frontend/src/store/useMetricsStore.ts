import type { SliceSet } from './storeTypes';
import type { APMetricsSnapshot } from '../api/types';

export interface MetricsSlice {
  apMetrics: APMetricsSnapshot | null;
  setAPMetrics: (metrics: APMetricsSnapshot) => void;
  handleMetricsEvent: (snapshot: APMetricsSnapshot) => void;
}

export const createMetricsSlice = (set: SliceSet): MetricsSlice => ({
  apMetrics: null,
  setAPMetrics: (metrics) => set({ apMetrics: metrics }),
  handleMetricsEvent: (snapshot) => set({ apMetrics: snapshot }),
});
