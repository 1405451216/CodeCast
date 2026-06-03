// 性能监控 - 已迁移到 AP AgentMetrics（ap.llm.cachedProvider 缓存）
// 保留桩实现以兼容现有引用
export interface PerfMetrics {
  fps: number;
  memoryUsage: number;
  memoryMB: number;
  renderTime: number;
  renderTimeMs: number;
  cacheHitRate: number;
  componentCount?: number;
}
export const performanceMonitor: {
  getCurrentMetrics: () => PerfMetrics;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  detectBottlenecks: () => any[];
  clearHistory: () => void;
} = {
  getCurrentMetrics: (): PerfMetrics => ({
    fps: 60, memoryUsage: 0, memoryMB: 0,
    renderTime: 16, renderTimeMs: 16, cacheHitRate: 0, componentCount: 0,
  }),
  startMonitoring: () => {},
  stopMonitoring: () => {},
  detectBottlenecks: (): any[] => [],
  clearHistory: () => {},
};
export const cacheManager = {
  cleanup: async (): Promise<number> => 0,
};
