import { useEffect, useRef, useCallback } from 'react';
import { castLogger } from './cast-logger';

interface CleanupItem {
  type: 'timer' | 'interval' | 'listener' | 'subscription' | 'custom';
  cleanup: () => void;
  name?: string;
  registeredAt: number;
}

class CleanupRegistryImpl {
  private items: CleanupItem[] = [];

  register(type: CleanupItem['type'], cleanup: () => void, name?: string): () => void {
    const item: CleanupItem = { type, cleanup, name, registeredAt: Date.now() };
    this.items.push(item);
    return () => {
      const idx = this.items.indexOf(item);
      if (idx !== -1) {
        this.items.splice(idx, 1);
        try { item.cleanup(); } catch (e) { console.warn('[CleanupRegistry] Cleanup error:', e); }
      }
    };
  }

  registerTimer(timerId: ReturnType<typeof setTimeout>, name?: string): () => void {
    return this.register('timer', () => clearTimeout(timerId), name ?? `timer-${timerId}`);
  }

  registerInterval(intervalId: ReturnType<typeof setInterval>, name?: string): () => void {
    return this.register('interval', () => clearInterval(intervalId), name ?? `interval-${intervalId}`);
  }

  registerEventListener(target: EventTarget, event: string, handler: EventListener, options?: boolean | AddEventListenerOptions): () => void {
    target.addEventListener(event, handler, options);
    return this.register('listener', () => target.removeEventListener(event, handler, options), `${String((target as any)?.constructor?.name || target)}::${event}`);
  }

  registerAll(cleanups: (() => void)[]): () => void {
    const unsubscribers = cleanups.map(c => this.register('custom', c));
    return () => unsubscribers.forEach(u => u());
  }

  cleanupAll(context?: string): number {
    let count = 0;
    const remaining: CleanupItem[] = [];
    for (const item of this.items) {
      try {
        item.cleanup();
        count++;
      } catch (e) {
        castLogger.log('warn', 'cleanup-registry', `Failed to cleanup ${item.type}:${item.name}`, { error: String(e) });
        remaining.push(item);
      }
    }
    this.items = remaining;
    if (context) castLogger.log('debug', 'cleanup-registry', `Cleaned up ${count} items`, { context });
    return count;
  }

  get size(): number {
    return this.items.length;
  }

  getSummary(): Array<{ type: string; name: string; ageMs: number }> {
    const now = Date.now();
    return this.items.map(i => ({
      type: i.type,
      name: i.name || '(unnamed)',
      ageMs: now - i.registeredAt,
    }));
  }
}

export const globalCleanupRegistry = new CleanupRegistryImpl();

export function useCleanupRegistry() {
  const registryRef = useRef<CleanupRegistryImpl | null>(null);

  if (!registryRef.current) {
    registryRef.current = new CleanupRegistryImpl();
  }

  const registry = registryRef.current;

  useEffect(() => {
    return () => {
      registry.cleanupAll(`useCleanupRegistry unmount`);
    };
  }, []);

  return registry;
}

export function useTimedEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  moduleName: string = 'unknown'
): void {
  const modLog = castLogger.createModule(moduleName);

  useEffect(() => {
    const startMark = `${moduleName}-effect-start`;
    performance.mark(startMark);

    const cleanup = effect();

    if (typeof cleanup === 'function') {
      return () => {
        performance.measure(`${moduleName}-effect-cleanup`, startMark);
        const entries = performance.getEntriesByName(`${moduleName}-effect-cleanup`);
        if (entries.length > 0) {
          modLog.debug('useTimedEffect cleanup', { durationMs: Math.round(entries[0].duration) }, ['perf']);
        }
        performance.clearMarks(startMark);
        performance.clearMeasures(`${moduleName}-effect-cleanup`);
        cleanup();
      };
    }

    performance.clearMarks(startMark);
    return undefined;
  }, deps);
}

export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const stableCb = useCallback((...args: Parameters<T>): ReturnType<T> => {
    return callbackRef.current(...args);
  }, []);

  useEffect(() => stableCb, [stableCb]);

  return stableCb as unknown as T;
}

export class TimerPool {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  setTimeout(id: string, fn: () => void, delay: number): void {
    this.clearTimeout(id);
    this.timers.set(id, setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, delay));
  }

  clearTimeout(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  setInterval(id: string, fn: () => void, interval: number): void {
    this.clearInterval(id);
    this.intervals.set(id, setInterval(fn, interval));
  }

  clearInterval(id: string): void {
    const iv = this.intervals.get(id);
    if (iv) {
      clearInterval(iv);
      this.intervals.delete(id);
    }
  }

  hasTimer(id: string): boolean { return this.timers.has(id); }
  hasInterval(id: string): boolean { return this.intervals.has(id); }

  clearAll(): void {
    for (const [id] of this.timers) this.clearTimeout(id);
    for (const [id] of this.intervals) this.clearInterval(id);
  }

  get size(): number { return this.timers.size + this.intervals.size; }
}
