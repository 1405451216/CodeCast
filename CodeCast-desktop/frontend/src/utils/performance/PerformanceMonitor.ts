export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  componentCount: number;
  timestamp: number;
}

export interface Bottleneck {
  type: 'render' | 'memory' | 'task';
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private rafId: number | null = null;
  private lastFrameTime: number = performance.now();
  private frameCount: number = 0;
  private lastFpsUpdate: number = performance.now();
  private currentFps: number = 60;
  private renderTimes: number[] = [];
  private maxRenderTimes: number = 60;

  startMonitoring(): void {
    this.rafId = requestAnimationFrame(this.tick.bind(this));
  }

  stopMonitoring(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  recordRenderTime(time: number): void {
    this.renderTimes.push(time);
    if (this.renderTimes.length > this.maxRenderTimes) {
      this.renderTimes.shift();
    }
  }

  getAverageMetrics(): PerformanceMetrics {
    if (this.metrics.length === 0) return this.emptyMetrics();

    const sum = this.metrics.reduce((acc, m) => ({
      fps: acc.fps + m.fps,
      memoryUsage: acc.memoryUsage + m.memoryUsage,
      renderTime: acc.renderTime + m.renderTime,
      componentCount: acc.componentCount + m.componentCount,
      timestamp: 0
    }), this.emptyMetrics());

    const count = this.metrics.length;
    return {
      ...sum,
      fps: Math.round(sum.fps / count),
      memoryUsage: Math.round(sum.memoryUsage / count * 100) / 100,
      renderTime: Math.round(sum.renderTime / count * 100) / 100,
      componentCount: Math.round(sum.componentCount / count),
      timestamp: Date.now()
    };
  }

  getCurrentMetrics(): PerformanceMetrics {
    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0;

    const memory = (performance as any).memory ?
      (performance as any).memory.usedJSHeapSize / 1024 / 1024 : 0;

    return {
      fps: this.currentFps,
      memoryUsage: Math.round(memory * 100) / 100,
      renderTime: Math.round(avgRenderTime * 100) / 100,
      componentCount: document.querySelectorAll('[data-component]').length,
      timestamp: Date.now()
    };
  }

  detectBottlenecks(): Bottleneck[] {
    const avg = this.getAverageMetrics();
    const current = this.getCurrentMetrics();
    const bottlenecks: Bottleneck[] = [];

    if (avg.renderTime > 100 || current.renderTime > 150) {
      bottlenecks.push({
        type: 'render',
        severity: current.renderTime > 150 ? 'high' : 'medium',
        suggestion: `平均渲染时间 ${avg.renderTime}ms（当前 ${current.renderTime}ms），建议启用虚拟滚动或减少组件复杂度`
      });
    }

    if (avg.memoryUsage > 300 || current.memoryUsage > 400) {
      bottlenecks.push({
        type: 'memory',
        severity: current.memoryUsage > 400 ? 'high' : 'medium',
        suggestion: `内存占用 ${current.memoryUsage}MB，建议清理缓存或优化数据结构`
      });
    }

    if (avg.fps < 30 || current.fps < 20) {
      bottlenecks.push({
        type: 'task',
        severity: current.fps < 20 ? 'high' : 'medium',
        suggestion: `FPS 过低 ${current.fps}，建议检查是否有阻塞主线程的任务`
      });
    }

    return bottlenecks;
  }

  getMetricsHistory(seconds: number = 60): PerformanceMetrics[] {
    const targetLength = Math.floor(seconds * 10);
    return this.metrics.slice(-targetLength);
  }

  clearHistory(): void {
    this.metrics = [];
    this.renderTimes = [];
  }

  private tick(): void {
    const now = performance.now();

    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round(
        (this.frameCount * 1000) / (now - this.lastFpsUpdate)
      );
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    const memory = (performance as any).memory ?
      (performance as any).memory.usedJSHeapSize / 1024 / 1024 : 0;

    const frameDelta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0;

    this.metrics.push({
      fps: this.currentFps,
      memoryUsage: Math.round(memory * 100) / 100,
      renderTime: Math.round(avgRenderTime * 100) / 100,
      componentCount: document.querySelectorAll('[data-component]').length,
      timestamp: now
    });

    if (this.metrics.length > 600) {
      this.metrics = this.metrics.slice(-600);
    }

    this.rafId = requestAnimationFrame(this.tick.bind(this));
  }

  private emptyMetrics(): PerformanceMetrics {
    return {
      fps: 60,
      memoryUsage: 0,
      renderTime: 0,
      componentCount: 0,
      timestamp: 0
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default PerformanceMonitor;
