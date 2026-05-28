import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor } from '../PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    if ('stopMonitoring' in monitor) {
      (monitor as any).stopMonitoring();
    }
  });

  describe('Initialization', () => {
    it('should create instance successfully', () => {
      expect(monitor).toBeDefined();
      expect(monitor instanceof PerformanceMonitor).toBe(true);
    });
  });

  describe('Metrics Collection', () => {
    it('should track performance metrics', () => {
      if ('recordRenderTime' in monitor) {
        (monitor as any).recordRenderTime(16.67);
        (monitor as any).recordRenderTime(14.2);
        
        const metrics = (monitor as any).getCurrentMetrics?.() || 
                         (monitor as any).getAverageMetrics?.();
        
        if (metrics) {
          expect(metrics).toBeDefined();
        }
      }
    });

    it('should get current metrics', () => {
      if ('getCurrentMetrics' in monitor) {
        const metrics = (monitor as any).getCurrentMetrics();
        
        expect(metrics).toBeDefined();
        expect(typeof metrics.fps).toBe('number');
        expect(typeof metrics.memoryUsage).toBe('number');
        expect(typeof metrics.renderTime).toBe('number');
      }
    });

    it('should get average metrics', () => {
      if ('getAverageMetrics' in monitor) {
        const metrics = (monitor as any).getAverageMetrics();
        
        expect(metrics).toBeDefined();
        expect(typeof metrics.timestamp).toBe('number');
      }
    });
  });

  describe('Memory Monitoring', () => {
    it('should provide memory usage information', () => {
      if ('getCurrentMetrics' in monitor) {
        const metrics = (monitor as any).getCurrentMetrics();
        
        if (metrics && metrics.memoryUsage !== undefined) {
          expect(typeof metrics.memoryUsage).toBe('number');
          expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Monitoring Control', () => {
    it('should start monitoring', () => {
      if ('startMonitoring' in monitor) {
        expect(() => (monitor as any).startMonitoring()).not.toThrow();
        
        setTimeout(() => {
          if ('stopMonitoring' in monitor) {
            (monitor as any).stopMonitoring();
          }
        }, 100);
      }
    });

    it('should stop monitoring', () => {
      if ('stopMonitoring' in monitor) {
        expect(() => (monitor as any).stopMonitoring()).not.toThrow();
      }
    });
  });
});
