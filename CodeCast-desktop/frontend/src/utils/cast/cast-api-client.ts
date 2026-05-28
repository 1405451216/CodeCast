import type { ApiResponse } from '../../types/cast-api';
import { castApiServer } from './cast-api-server';

interface CastApiClientOptions {
  port?: number;
  apiKey?: string;
}

class CastApiClientImpl {
  private serverPort: number;
  private defaultApiKey?: string;
  private broadcastChannel: BroadcastChannel | null = null;
  private connected = false;
  private pendingRequests: Map<string, { resolve: (value: ApiResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  private eventSubscriptions: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(options?: CastApiClientOptions) {
    this.serverPort = options?.port ?? 18790;
    this.defaultApiKey = options?.apiKey;
  }

  async get(path: string, query?: Record<string, string>): Promise<ApiResponse> {
    return this.request({ method: 'GET', path, query });
  }

  async post(path: string, body?: unknown): Promise<ApiResponse> {
    return this.request({ method: 'POST', path, body });
  }

  async put(path: string, body?: unknown): Promise<ApiResponse> {
    return this.request({ method: 'PUT', path, body });
  }

  async del(path: string): Promise<ApiResponse> {
    return this.request({ method: 'DELETE', path });
  }

  async request(config: {
    method: string;
    path: string;
    body?: unknown;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
  }): Promise<ApiResponse> {
    const requestId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const timeout = config.timeout ?? 30000;

    return new Promise<ApiResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout after ${timeout}ms: ${config.method} ${config.path}`));
      }, timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      const message = {
        requestId,
        method: config.method,
        path: config.path,
        body: config.body,
        query: config.query,
        headers: {
          ...config.headers,
          'x-api-key': this.defaultApiKey
        },
        apiKey: this.defaultApiKey
      };

      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage(message);
        } catch {
          this.pendingRequests.delete(requestId);
          clearTimeout(timer);
          reject(new Error('Failed to send request via BroadcastChannel'));
        }
      } else {
        castApiServer.handleRequest({
          method: config.method,
          path: config.path,
          body: config.body,
          query: config.query,
          headers: config.headers,
          apiKey: this.defaultApiKey
        }).then(result => {
          this.pendingRequests.delete(requestId);
          clearTimeout(timer);
          resolve(result);
        }).catch(error => {
          this.pendingRequests.delete(requestId);
          clearTimeout(timer);
          reject(error);
        });
      }
    });
  }

  subscribe(eventName: string, callback: (data: unknown) => void): () => void {
    if (!this.eventSubscriptions.has(eventName)) {
      this.eventSubscriptions.set(eventName, new Set());
    }

    this.eventSubscriptions.get(eventName)!.add(callback);

    if (!this.broadcastChannel) {
      this.ensureBroadcastChannel();
    }

    return () => {
      const subs = this.eventSubscriptions.get(eventName);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.eventSubscriptions.delete(eventName);
        }
      }
    };
  }

  emit(eventName: string, data: unknown): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'event', event: eventName, data });
    }
  }

  async getMemories(params?: { type?: string; limit?: number; search?: string }): Promise<ApiResponse> {
    return this.get('/api/v1/memory', params as Record<string, string>);
  }

  async addMemory(memory: { content: string; tags?: string[]; source?: string; type?: string; importance?: number }): Promise<ApiResponse> {
    return this.post('/api/v1/memory', memory);
  }

  async getSchedulerTasks(): Promise<ApiResponse> {
    return this.get('/api/v1/scheduler');
  }

  async createSchedulerTask(task: { name: string; type?: string; cron?: string; description?: string; enabled?: boolean }): Promise<ApiResponse> {
    return this.post('/api/v1/scheduler', task);
  }

  async submitAgentGoal(goal: string, templateKey?: string): Promise<ApiResponse> {
    return this.post('/api/v1/agent/submit', { goal, templateKey });
  }

  async getTools(): Promise<ApiResponse> {
    return this.get('/api/v1/tools');
  }

  async getHealth(): Promise<ApiResponse> {
    return this.get('/api/v1/health');
  }

  async getStatus(): Promise<ApiResponse> {
    return this.get('/api/v1/status');
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.broadcastChannel) {
        this.ensureBroadcastChannel();
      }

      const healthResult = await this.getHealth();
      this.connected = healthResult.success;

      if (this.connected) {
        console.log('[CastApiClient] Connected to API server successfully');
      }

      return this.connected;
    } catch (error) {
      console.error('[CastApiClient] Connection failed:', error);
      this.connected = false;
      return false;
    }
  }

  disconnect(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.connected = false;
    this.pendingRequests.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new Error('Client disconnected'));
    });
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected || castApiServer.isRunning();
  }

  async getServerInfo(): Promise<{ port: number; version: string; uptime: number; routeCount: number }> {
    const result = await this.getStatus();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get server info');
    }
    const data = result.data as Record<string, unknown>;
    return {
      port: data.port as number,
      version: data.version as string,
      uptime: data.uptime as number,
      routeCount: data.routeCount as number
    };
  }

  setApiKey(key: string): void {
    this.defaultApiKey = key;
  }

  getApiKey(): string | undefined {
    return this.defaultApiKey;
  }

  private ensureBroadcastChannel(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('cast-api-server');
      this.broadcastChannel.onmessage = (event) => {
        const { requestId, ...response } = event.data;
        if (requestId && this.pendingRequests.has(requestId)) {
          const { resolve, timer } = this.pendingRequests.get(requestId)!;
          clearTimeout(timer);
          this.pendingRequests.delete(requestId);
          resolve(response as ApiResponse);
        }

        if (event.data.type === 'event' && event.data.event) {
          const subs = this.eventSubscriptions.get(event.data.event);
          if (subs) {
            subs.forEach(cb => {
              try { cb(event.data.data); } catch (e) { console.error('[CastApiClient] Event callback error:', e); }
            });
          }
        }
      };
    } catch (e) {
      console.warn('[CastApiClient] BroadcastChannel not available:', e);
    }
  }
}

export const castApiClient = new CastApiClientImpl();
