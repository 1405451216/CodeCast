type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  durationMs?: number;
  tags?: string[];
}

type LogFilter = {
  level?: LogLevel;
  module?: string | RegExp;
  search?: string;
  since?: number;
  until?: number;
  tag?: string;
};

type LogListener = (entry: LogEntry) => void;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const LOG_LEVEL_LABELS: Record<LogLevel, { icon: string; color: string }> = {
  debug: { icon: '🔍', color: '#6b7280' },
  info: { icon: 'ℹ️', color: '#3b82f6' },
  warn: { icon: '⚠️', color: '#f59e0b' },
  error: { icon: '❌', color: '#ef4444' },
  silent: { icon: '🚫', color: '#9ca3af' },
};

class CastLogger {
  private entries: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private minLevel: LogLevel = 'debug';
  private maxEntries = 5000;
  private persistKey = 'codecast_cast_log_entries';
  private enabledModules: Set<string> = new Set();
  private disabledModules: Set<string> = new Set();
  private perfMarks: Map<string, number> = new Map();

  configure(options: { minLevel?: LogLevel; maxEntries?: number; enabledModules?: string[]; disabledModules?: string[] }): void {
    if (options.minLevel) this.minLevel = options.minLevel;
    if (options.maxEntries) this.maxEntries = options.maxEntries;
    if (options.enabledModules) options.enabledModules.forEach(m => this.enabledModules.add(m));
    if (options.disabledModules) options.disabledModules.forEach(m => this.disabledModules.add(m));
  }

  createModule(moduleName: string) {
    return {
      debug: (msg: string, data?: unknown, tags?: string[]) => this.log('debug', moduleName, msg, data, undefined, tags),
      info: (msg: string, data?: unknown, tags?: string[]) => this.log('info', moduleName, msg, data, undefined, tags),
      warn: (msg: string, data?: unknown, tags?: string[]) => this.log('warn', moduleName, msg, data, undefined, tags),
      error: (msg: string, data?: unknown, tags?: string[]) => this.log('error', moduleName, msg, data, undefined, tags),
      timeStart: (label: string) => this.startPerf(moduleName, label),
      timeEnd: (label: string) => this.endPerf(moduleName, label),
    };
  }

  log(level: LogLevel, module: string, message: string, data?: unknown, durationMs?: number, tags?: string[]): LogEntry | null {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) return null;
    if (this.disabledModules.has(module)) return null;
    if (this.enabledModules.size > 0 && !this.enabledModules.has(module)) return null;

    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      level,
      module,
      message,
      data,
      durationMs,
      tags,
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    for (const listener of this.listeners) {
      try { listener(entry); } catch {}
    }

    return entry;
  }

  onLog(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getEntries(filter?: LogFilter): LogEntry[] {
    let result = [...this.entries].sort((a, b) => b.timestamp - a.timestamp);

    if (filter) {
      if (filter.level) result = result.filter(e => e.level === filter.level);
      if (filter.module) {
        const pattern = filter.module instanceof RegExp ? filter.module : new RegExp(filter.module, 'i');
        result = result.filter(e => pattern.test(e.module));
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        result = result.filter(e =>
          e.message.toLowerCase().includes(q) || e.module.toLowerCase().includes(q)
        );
      }
      if (filter.since) result = result.filter(e => e.timestamp >= filter.since!);
      if (filter.until) result = result.filter(e => e.timestamp <= filter.until!);
      if (filter.tag) result = result.filter(e => e.tags?.includes(filter.tag!));
    }

    return result;
  }

  getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byModule: Record<string, number>;
    timeRange: { earliest: number | null; latest: number | null };
  } {
    const stats = {
      total: this.entries.length,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0, silent: 0 } as Record<LogLevel, number>,
      byModule: {} as Record<string, number>,
      timeRange: { earliest: null as number | null, latest: null as number | null },
    };

    for (const e of this.entries) {
      stats.byLevel[e.level]++;
      stats.byModule[e.module] = (stats.byModule[e.module] || 0) + 1;
      if (!stats.timeRange.earliest || e.timestamp < stats.timeRange.earliest) stats.timeRange.earliest = e.timestamp;
      if (!stats.timeRange.latest || e.timestamp > stats.timeRange.latest) stats.timeRange.latest = e.timestamp;
    }

    return stats;
  }

  clear(): void {
    this.entries = [];
  }

  export(filter?: LogFilter): string {
    const entries = this.getEntries(filter);
    return JSON.stringify({
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
      entries,
    }, null, 2);
  }

  startPerf(module: string, label: string): void {
    this.perfMarks.set(`${module}:${label}`, performance.now());
  }

  endPerf(module: string, label: string): number | null {
    const key = `${module}:${label}`;
    const start = this.perfMarks.get(key);
    if (!start) return null;
    this.perfMarks.delete(key);
    const duration = Math.round(performance.now() - start);
    this.log('info', module, `[PERF] ${label}`, undefined, duration, ['perf']);
    return duration;
  }

  time<T>(module: string, label: string, fn: () => T): T {
    this.startPerf(module, label);
    try {
      return fn();
    } finally {
      this.endPerf(module, label);
    }
  }

  async timeAsync<T>(module: string, label: string, fn: () => Promise<T>): Promise<T> {
    this.startPerf(module, label);
    try {
      return await fn();
    } finally {
      this.endPerf(module, label);
    }
  }
}

export const castLogger = new CastLogger();

export function createLogModule(name: string) {
  return castLogger.createModule(name);
}

export { LOG_LEVEL_LABELS, LOG_LEVEL_PRIORITY };
export type { LogEntry, LogLevel, LogFilter };
