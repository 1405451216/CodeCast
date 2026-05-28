type NetworkStatus = 'online' | 'offline' | 'unknown';
type ConnectionQuality = 'high' | 'medium' | 'low' | 'none';

interface OfflineState {
  status: NetworkStatus;
  quality: ConnectionQuality;
  lastOnlineAt: number | null;
  offlineDuration: number;
  wasOnline: boolean;
}

interface OfflineListener {
  (state: OfflineState): void;
}

class CastOfflineDetector {
  private state: OfflineState = {
    status: 'unknown',
    quality: 'none',
    lastOnlineAt: null,
    offlineDuration: 0,
    wasOnline: false,
  };
  private listeners: Set<OfflineListener> = new Set();
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private _isOnline: boolean = navigator.onLine;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
    this.detectInitialStatus();
    this.startPolling();
  }

  private detectInitialStatus(): void {
    this._isOnline = navigator.onLine;
    if (navigator.onLine) {
      this.state = { status: 'online', quality: 'high', lastOnlineAt: Date.now(), offlineDuration: 0, wasOnline: true };
    } else {
      this.state = { status: 'offline', quality: 'none', lastOnlineAt: null, offlineDuration: 0, wasOnline: false };
    }
  }

  private handleOnline(): void {
    this._isOnline = true;
    this.updateState({
      status: 'online',
      quality: this.estimateQuality(),
      lastOnlineAt: Date.now(),
      offlineDuration: 0,
      wasOnline: true,
    });
    console.log('[CastOfflineDetector] Back online');
  }

  private handleOffline(): void {
    this._isOnline = false;
    this.updateState({
      status: 'offline',
      quality: 'none',
      offlineDuration: 0,
      wasOnline: this.state.status === 'online',
    });
    console.log('[CastOfflineDetector] Went offline');
  }

  private startPolling(): void {
    this.checkTimer = setInterval(() => {
      const wasOnline = this._isOnline;
      this._isOnline = navigator.onLine;

      if (wasOnline !== this._isOnline) {
        if (this._isOnline) {
          this.handleOnline();
        } else {
          this.handleOffline();
        }
      }

      if (this.state.status === 'offline') {
        this.state.offlineDuration = Date.now() - (this.state.lastOnlineAt || Date.now());
        this.notifyListeners();
      }

      if (this.state.status === 'online') {
        const newQuality = this.estimateQuality();
        if (newQuality !== this.state.quality) {
          this.state.quality = newQuality;
          this.notifyListeners();
        }
      }
    }, 5000);
  }

  private estimateQuality(): ConnectionQuality {
    const conn = (navigator as any).connection;
    if (!conn) return 'high';

    const rtt = conn.rtt ?? 0;
    const downlink = conn.downlink ?? 10;

    if (rtt > 1000 || downlink < 0.5) return 'low';
    if (rtt > 300 || downlink < 2) return 'medium';
    return 'high';
  }

  private updateState(newState: Partial<OfflineState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener({ ...this.state }); } catch {}
    }
  }

  getState(): OfflineState {
    if (this.state.status === 'offline') {
      return { ...this.state, offlineDuration: Date.now() - (this.state.lastOnlineAt || Date.now()) };
    }
    return { ...this.state };
  }

  isOnline(): boolean {
    return this._isOnline;
  }

  getConnectionInfo(): { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } {
    const conn = (navigator as any).connection;
    if (!conn) return {};
    return {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
      saveData: conn.saveData,
    };
  }

  onStateChange(listener: OfflineListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  onceOnline(): Promise<void> {
    if (this._isOnline) return Promise.resolve();
    return new Promise(resolve => {
      const cleanup = this.onStateChange((state) => {
        if (state.status === 'online') {
          cleanup();
          resolve();
        }
      });
      setTimeout(() => { cleanup(); resolve(); }, 30000);
    });
  }

  destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }
    this.listeners.clear();
  }

  static formatDuration(ms: number): string {
    if (ms < 60000) return `${Math.floor(ms / 1000)}秒`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}分钟`;
    return `${Math.floor(ms / 3600000)}小时${Math.floor((ms % 3600000) / 60000)}分`;
  }
}

export const castOfflineDetector = new CastOfflineDetector();

export function withOfflineFallback<T>(
  onlineFn: () => T | Promise<T>,
  offlineFallback: T,
  contextName?: string
): T | Promise<T> {
  if (castOfflineDetector.isOnline()) {
    const result = onlineFn();
    if (result instanceof Promise) {
      return result.catch((err) => {
        console.warn(`[OfflineFallback:${contextName || '?'}] Request failed while online:`, err);
        return offlineFallback;
      });
    }
    return result;
  }

  console.warn(`[OfflineFallback:${contextName || '?'}] Operating in offline mode, using fallback`);
  return offlineFallback;
}
