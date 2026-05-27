import type { SliceSet } from './storeTypes';
import { logger } from '../utils/logger';

export interface PerformanceConfig {
  mode: 'balanced' | 'performance' | 'battery-saver';
  virtualScrollEnabled: boolean;
  autoRefreshInterval: number;
  cacheEnabled: boolean;
}

interface PerformanceSlice {
  performanceMode: 'balanced' | 'performance' | 'battery-saver';
  setPerformanceMode: (mode: 'balanced' | 'performance' | 'battery-saver') => void;
  
  virtualScrollEnabled: boolean;
  toggleVirtualScroll: () => void;
  setVirtualScrollEnabled: (enabled: boolean) => void;
  
  performanceHistory: Array<{
    timestamp: number;
    fps: number;
    memoryUsage: number;
    renderTime: number;
  }>;
  addPerformanceSnapshot: (snapshot: {
    timestamp: number;
    fps: number;
    memoryUsage: number;
    renderTime: number;
  }) => void;
  clearPerformanceHistory: () => void;

  performanceConfig: PerformanceConfig;
  updatePerformanceConfig: (config: Partial<PerformanceConfig>) => void;
  resetPerformanceConfig: () => void;
}

const defaultPerformanceConfig: PerformanceConfig = {
  mode: 'balanced',
  virtualScrollEnabled: true,
  autoRefreshInterval: 2000,
  cacheEnabled: true
};

const createPerformanceSlice = (set: SliceSet): PerformanceSlice => {
  logger.info('PerformanceStore', '📊 Creating performance slice...');

  return {
    performanceMode: 'balanced',
    setPerformanceMode: (mode) => {
      set((state) => {
        const previousMode = state.performanceMode;
        logger.info('PerformanceStore', `⚡ Performance mode changed: ${previousMode} → ${mode}`, {
          mode,
          timestamp: Date.now()
        });
        return { performanceMode: mode };
      });
    },

    virtualScrollEnabled: true,
    toggleVirtualScroll: () => set((state: any) => { 
      const newValue = !state.virtualScrollEnabled;
      logger.info('PerformanceStore', `🔄 Virtual scroll toggled: ${state.virtualScrollEnabled} → ${newValue}`);
      return { virtualScrollEnabled: newValue };
    }),
    setVirtualScrollEnabled: (enabled) => {
      logger.info('PerformanceStore', `🎯 Virtual scroll set to: ${enabled}`);
      set({ virtualScrollEnabled: enabled });
    },

    performanceHistory: [] as Array<{
      timestamp: number;
      fps: number;
      memoryUsage: number;
      renderTime: number;
    }>,
    addPerformanceSnapshot: (snapshot) => set((state: any) => {
      const newHistory = [...(state.performanceHistory || []).slice(-59), snapshot];
      
      if (snapshot.fps < 30 || snapshot.memoryUsage > 500) {
        logger.warn('PerformanceStore', '⚠️  Performance degradation detected', {
          fps: snapshot.fps,
          memoryUsage: `${snapshot.memoryUsage}MB`,
          renderTime: `${snapshot.renderTime}ms`,
          historyLength: newHistory.length
        });
      } else if (snapshot.fps < 50) {
        logger.info('PerformanceStore', '📉 Performance below optimal', {
          fps: snapshot.fps,
          memoryUsage: `${snapshot.memoryUsage}MB`
        });
      }
      
      return { performanceHistory: newHistory };
    }),
    clearPerformanceHistory: () => {
      logger.info('PerformanceStore', '🗑️  Performance history cleared');
      set({ performanceHistory: [] });
    },

    performanceConfig: { ...defaultPerformanceConfig },
    updatePerformanceConfig: (config) => set((state: any) => {
      const newConfig = { ...(state.performanceConfig || {}), ...config };
      logger.info('PerformanceStore', '⚙️  Performance config updated', {
        changes: config,
        fullConfig: newConfig
      });
      return { performanceConfig: newConfig };
    }),
    resetPerformanceConfig: () => {
      logger.info('PerformanceStore', '↩️  Performance config reset to defaults');
      set({ performanceConfig: { ...defaultPerformanceConfig } });
    }
  };
};

export { type PerformanceSlice, createPerformanceSlice };