import React, { useState, useEffect, useRef, useCallback } from 'react';
import { castLogger } from '../../utils/cast/cast-logger';

const modLog = castLogger.createModule('perf-monitor');

interface PerfSample {
  timestamp: number;
  fps: number;
  memoryMB: number;
  renderMs: number;
  longTasks: number;
}

interface RenderTiming {
  component: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private fpsSamples: number[] = [];
  private frameCallback: number | null = null;
  private lastFrameTime = performance.now();
  private renderTimings: RenderTiming[] = [];
  private longTaskThreshold = 50;
  private isRunning = false;
  private listeners: Set<(sample: PerfSample) => void> = new Set();

  get currentFPS(): number {
    if (this.fpsSamples.length === 0) return 0;
    const recent = this.fpsSamples.slice(-30);
    return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  }

  get memoryUsage(): number {
    try {
      return (performance as any).memory ?
        Math.round((performance as any).memory.usedJSHeapSize / 1048576) :
        0;
    } catch { return 0; }
  }

  get longTaskCount(): number {
    return this.renderTimings.filter(r => r.duration > this.longTaskThreshold).length;
  }

  get avgRenderTime(): number {
    if (this.renderTimings.length === 0) return 0;
    const recent = this.renderTimings.slice(-50);
    return Math.round(recent.reduce((a, r) => a + r.duration, 0) / recent.length);
  }

  get slowestRenders(): RenderTiming[] {
    return [...this.renderTimings]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.frameCallback !== null) {
      cancelAnimationFrame(this.frameCallback);
      this.frameCallback = null;
    }
  }

  recordRender(component: string, duration: number): void {
    this.renderTimings.push({ component, duration, timestamp: Date.now() });
    if (this.renderTimings.length > 500) {
      this.renderTimings = this.renderTimings.slice(-300);
    }
  }

  onSample(listener: (sample: PerfSample) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  clearRenderHistory(): void {
    this.renderTimings = [];
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    const fps = delta > 0 ? Math.round(1000 / delta) : 0;
    this.fpsSamples.push(fps);
    if (this.fpsSamples.length > 120) this.fpsSamples.shift();

    if (this.fpsSamples.length % 10 === 0) {
      const sample: PerfSample = {
        timestamp: Date.now(),
        fps: this.currentFPS,
        memoryMB: this.memoryUsage,
        renderMs: this.avgRenderTime,
        longTasks: this.longTaskCount,
      };
      for (const listener of this.listeners) {
        try { listener(sample); } catch {}
      }
    }

    this.frameCallback = requestAnimationFrame(this.loop);
  };
}

export const perfMonitor = new PerformanceMonitor();

export function usePerfTracker(componentName: string) {
  const renderStart = useRef<number>(0);

  useEffect(() => {
    renderStart.current = performance.now();
    return () => {
      const duration = Math.round(performance.now() - renderStart.current);
      perfMonitor.recordRender(componentName, duration);
      if (duration > 16) {
        modLog.warn(`Slow render: ${componentName}`, { durationMs: duration }, ['perf']);
      }
    };
  });
}

export function PerformanceDashboard() {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(0);
  const [avgRender, setAvgRender] = useState(0);
  const [longTasks, setLongTasks] = useState(0);
  const [history, setHistory] = useState<PerfSample[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const historyRef = useRef<PerfSample[]>([]);

  const toggleMonitor = useCallback(() => {
    if (isMonitoring) {
      perfMonitor.stop();
      setIsMonitoring(false);
    } else {
      perfMonitor.start();
      setIsMonitoring(true);
      perfMonitor.onSample(s => {
        setFps(s.fps);
        setMemory(s.memoryMB);
        setAvgRender(s.renderMs);
        setLongTasks(s.longTasks);
        historyRef.current = [...historyRef.current.slice(-60), s];
        setHistory(historyRef.current);
      });
    }
  }, [isMonitoring]);

  useEffect(() => {
    return () => perfMonitor.stop();
  }, []);

  const slowRenders = perfMonitor.slowestRenders;

  const fpsColor = fps >= 55 ? '#22c55e' : fps >= 30 ? '#f59e0b' : '#ef4444';
  const renderColor = avgRender <= 16 ? '#22c55e' : avgRender <= 33 ? '#f59e0b' : '#ef4444';

  return (
    <div className="perf-dashboard">
      <div className="perf-header">
        <h3>📊 性能监控</h3>
        <button
          className={`perf-toggle-btn ${isMonitoring ? 'active' : ''}`}
          onClick={toggleMonitor}
        >
          {isMonitoring ? '⏹ 停止监控' : '▶ 开始监控'}
        </button>
      </div>

      <div className="perf-metrics-grid">
        <div className="perf-metric-card">
          <div className="metric-value" style={{ color: fpsColor }}>{fps}</div>
          <div className="metric-label">FPS</div>
          <div className="metric-bar">
            <div className="metric-bar-fill" style={{ width: `${Math.min(fps / 6 * 100)}%`, background: fpsColor }} />
          </div>
        </div>

        <div className="perf-metric-card">
          <div className="metric-value">{memory}</div>
          <div className="metric-label">内存 (MB)</div>
          <div className="metric-bar">
            <div className="metric-bar-fill" style={{ width: `${Math.min(memory / 200 * 100)}%`, background: memory > 150 ? '#ef4444' : '#3b82f6' }} />
          </div>
        </div>

        <div className="perf-metric-card">
          <div className="metric-value" style={{ color: renderColor }}>{avgRender}ms</div>
          <div className="metric-label">平均渲染</div>
          <div className="metric-bar">
            <div className="metric-bar-fill" style={{ width: `${Math.min(avgRender / 66 * 100)}%`, background: renderColor }} />
          </div>
        </div>

        <div className="perf-metric-card">
          <div className="metric-value" style={{ color: longTasks > 0 ? '#ef4444' : '#22c55e' }}>{longTasks}</div>
          <div className="metric-label">长任务 (&gt;50ms)</div>
        </div>
      </div>

      {slowRenders.length > 0 && (
        <div className="perf-slow-renders">
          <h4>最慢渲染 TOP 10</h4>
          {slowRenders.map((r, i) => (
            <div key={i} className="slow-render-item">
              <span className="sr-rank">#{i + 1}</span>
              <span className="sr-component">{r.component}</span>
              <span className="sr-duration" style={{ color: r.duration > 50 ? '#ef4444' : r.duration > 16 ? '#f59e0b' : '#22c55e' }}>
                {r.duration}ms
              </span>
            </div>
          ))}
        </div>
      )}

      {!isMonitoring && history.length === 0 && (
        <div className="perf-placeholder">点击「开始监控」查看实时性能数据</div>
      )}
    </div>
  );
}
