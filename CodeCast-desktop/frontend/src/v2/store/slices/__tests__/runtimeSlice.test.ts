import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRuntimeSlice } from '../runtimeSlice';

function createMockStore() {
  const state: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  const setState = (updater: any) => {
    const next = typeof updater === 'function' ? updater(state as any) : updater;
    Object.assign(state, next);
    listeners.forEach((l) => l());
  };
  return {
    setState,
    getState: () => state as any,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    getInitialState: () => ({}),
    destroy: () => {},
  } as any;
}

describe('runtimeSlice', () => {
  let store: ReturnType<typeof createMockStore>;
  let slice: ReturnType<typeof createRuntimeSlice>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockStore();
    // Apply initial state first
    const init = createRuntimeSlice(
      (fn: any) => { Object.assign(store.getState(), typeof fn === 'function' ? fn(store.getState()) : fn); },
      store.getState.bind(store)
    );
    Object.assign(store.getState(), init);
    slice = createRuntimeSlice(store.setState.bind(store), store.getState.bind(store));
  });

  describe('initial state', () => {
    it('has null metrics snapshot', () => {
      expect(store.getState().metricsSnap).toBeNull();
    });

    it('has setMetricsSnap function', () => {
      expect(typeof slice.setMetricsSnap).toBe('function');
    });
  });

  describe('setMetricsSnap', () => {
    it('updates metrics snapshot', () => {
      const snap = {
        llmTotalCalls: 10,
        llmTotalErrors: 1,
        toolTotalCalls: 5,
        toolTotalErrors: 0,
        totalTurns: 3,
        totalEpisodes: 6,
        activeAgents: 1,
        poolQueueLength: 0,
        memorySizeBytes: 1024,
        llmLatencyP50: 100.0,
        llmLatencyP99: 500.0,
        toolLatencyP50: 50.0,
        toolLatencyP99: 200.0,
        tokenUsageByModel: {},
      };
      slice.setMetricsSnap(snap);
      expect(store.getState().metricsSnap).toEqual(snap);
      expect(store.getState().metricsSnap!.llmTotalCalls).toBe(10);
    });

    it('can set to null', () => {
      slice.setMetricsSnap({
        llmTotalCalls: 1, llmTotalErrors: 0, toolTotalCalls: 0, toolTotalErrors: 0,
        totalTurns: 0, totalEpisodes: 0, activeAgents: 0, poolQueueLength: 0,
        memorySizeBytes: 0, llmLatencyP50: 0, llmLatencyP99: 0,
        toolLatencyP50: 0, toolLatencyP99: 0, tokenUsageByModel: {},
      });
      slice.setMetricsSnap(null);
      expect(store.getState().metricsSnap).toBeNull();
    });
  });
});
