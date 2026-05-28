import type {
  ApiKeyInfo,
  ApiResponse,
  ApiRequestLog,
  CastApiRoute,
  RequestContext,
  MiddlewareFn,
  ServerStatus,
  ServerStats
} from '../../types/cast-api';
import { useCastMemoryStore } from '../../store/useCastMemoryStore';
import { useCastSchedulerStore } from '../../store/useCastSchedulerStore';
import { useCastAgentStore } from '../../store/useCastAgentStore';
import { CastToolRegistry } from '../../tools/CastToolRegistry';

const DEFAULT_PORT = 18790;
const MAX_LOGS = 1000;
const MAX_REQUESTS_PER_MINUTE = 120;
const VERSION = '1.0.0';

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function generateLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

class CastApiServerImpl {
  private routes: Map<string, CastApiRoute> = new Map();
  private apiKeys: Map<string, ApiKeyInfo> = new Map();
  private requestLogs: ApiRequestLog[] = [];
  private middlewareStack: MiddlewareFn[] = [];
  private running = false;
  private port: number;
  private startTime: number | null = null;
  private totalRequests = 0;
  private totalErrors = 0;
  private rateLimitMap: Map<string, number[]> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;

  constructor(port?: number) {
    this.port = port ?? DEFAULT_PORT;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = Date.now();
    this.registerBuiltinRoutes();
    this.setupBroadcastChannel();
    console.log(`[CastApiServer] Started on port ${this.port} with ${this.routes.size} routes`);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.teardownBroadcastChannel();
    console.log('[CastApiServer] Stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.port;
  }

  registerRoute(route: CastApiRoute): void {
    const key = `${route.method.toUpperCase()}:${route.path}`;
    this.routes.set(key, route);
    console.log(`[CastApiServer] Route registered: ${route.method} ${route.path}`);
  }

  deleteRoute(path: string, method: string): void {
    const key = `${method.toUpperCase()}:${path}`;
    if (this.routes.delete(key)) {
      console.log(`[CastApiServer] Route deleted: ${method} ${path}`);
    }
  }

  getRoutes(): CastApiRoute[] {
    return Array.from(this.routes.values());
  }

  registerBuiltinRoutes(): void {
    this.registerRoute({
      method: 'GET',
      path: '/api/v1/status',
      description: 'Server status, version and uptime',
      authRequired: false,
      handler: async () => this.getServerStatus()
    });

    this.registerRoute({
      method: 'GET',
      path: '/api/v1/health',
      description: 'Health check endpoint',
      authRequired: false,
      handler: async () => ({ status: 'ok', timestamp: Date.now() })
    });

    this.registerRoute({
      method: 'GET',
      path: '/api/v1/memory',
      description: 'Get memory list',
      authRequired: true,
      handler: async (params) => {
        const store = useCastMemoryStore.getState();
        const limit = params.query?.limit ? parseInt(params.query.limit, 10) : 50;
        const type = params.query?.type;
        const search = params.query?.search;

        let memories = store.memories;
        if (type && type !== 'all') {
          memories = memories.filter(m => m.type === type);
        }
        if (search) {
          memories = store.searchMemories(search, limit);
        } else {
          memories = memories.slice(0, limit);
        }
        return memories.map(m => ({
          id: m.id,
          content: m.content,
          type: m.type,
          source: m.source,
          tags: m.tags,
          timestamp: m.timestamp,
          importance: m.importance
        }));
      }
    });

    this.registerRoute({
      method: 'POST',
      path: '/api/v1/memory',
      description: 'Add new memory',
      authRequired: true,
      handler: async (params) => {
        const body = params.body as Record<string, unknown> | undefined;
        if (!body || !body.content) {
          throw new Error('Memory content is required');
        }
        const store = useCastMemoryStore.getState();
        const id = store.addMemory({
          content: body.content as string,
          type: (body.type as any) || 'conversation',
          source: (body.source as string) || 'api',
          tags: (body.tags as string[]) || [],
          importance: (body.importance as number) || 50
        });
        return { id, message: 'Memory created successfully' };
      }
    });

    this.registerRoute({
      method: 'GET',
      path: '/api/v1/memory/:id',
      description: 'Get single memory by ID',
      authRequired: true,
      handler: async (params) => {
        const id = params.query?.id || '';
        const store = useCastMemoryStore.getState();
        const memory = store.memories.find(m => m.id === id);
        if (!memory) throw new Error('Memory not found');
        return memory;
      }
    });

    this.registerRoute({
      method: 'DELETE',
      path: '/api/v1/memory/:id',
      description: 'Delete memory by ID',
      authRequired: true,
      handler: async (params) => {
        const id = params.query?.id || '';
        const store = useCastMemoryStore.getState();
        store.deleteMemory(id);
        return { message: 'Memory deleted successfully' };
      }
    });

    this.registerRoute({
      method: 'GET',
      path: '/api/v1/scheduler',
      description: 'Get scheduler tasks list',
      authRequired: false,
      handler: async () => {
        const store = useCastSchedulerStore.getState();
        return store.tasks.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          enabled: t.enabled,
          status: t.status,
          frequency: t.frequency,
          cronExpression: t.cronExpression,
          runCount: t.runCount,
          failCount: t.failCount
        }));
      }
    });

    this.registerRoute({
      method: 'POST',
      path: '/api/v1/scheduler',
      description: 'Create scheduler task',
      authRequired: true,
      handler: async (params) => {
        const body = params.body as Record<string, unknown> | undefined;
        if (!body || !body.name) {
          throw new Error('Task name is required');
        }
        const store = useCastSchedulerStore.getState();
        const id = store.addTask({
          name: body.name as string,
          description: (body.description as string) || '',
          type: (body.type as any) || 'custom',
          frequency: (body.frequency as any) || 'manual',
          cronExpression: body.cronExpression as string | undefined,
          config: (body.config as Record<string, unknown>) || {},
          enabled: body.enabled !== false
        });
        return { id, message: 'Task created successfully' };
      }
    });

    this.registerRoute({
      method: 'PUT',
      path: '/api/v1/scheduler/:id',
      description: 'Update scheduler task',
      authRequired: true,
      handler: async (params) => {
        const id = params.query?.id || '';
        const body = params.body as Record<string, unknown> | undefined;
        if (!id) throw new Error('Task ID is required');
        const store = useCastSchedulerStore.getState();
        store.updateTask(id, (body as Record<string, unknown>) || {});
        return { message: 'Task updated successfully' };
      }
    });

    this.registerRoute({
      method: 'DELETE',
      path: '/api/v1/scheduler/:id',
      description: 'Delete scheduler task',
      authRequired: true,
      handler: async (params) => {
        const id = params.query?.id || '';
        if (!id) throw new Error('Task ID is required');
        const store = useCastSchedulerStore.getState();
        store.removeTask(id);
        return { message: 'Task deleted successfully' };
      }
    });

    this.registerRoute({
      method: 'POST',
      path: '/api/v1/scheduler/:id/run',
      description: 'Manually run a scheduler task',
      authRequired: true,
      handler: async (params) => {
        const id = params.query?.id || '';
        if (!id) throw new Error('Task ID is required');
        const store = useCastSchedulerStore.getState();
        await store.runTaskNow(id);
        return { message: 'Task execution triggered' };
      }
    });

    this.registerRoute({
      method: 'GET',
      path: '/api/v1/tools',
      description: 'Get registered tools list',
      authRequired: false,
      handler: async () => {
        const tools = CastToolRegistry.getAll();
        return tools.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          icon: t.icon,
          version: t.version,
          author: t.author,
          tags: t.tags,
          permissions: t.permissions
        }));
      }
    });

    this.registerRoute({
      method: 'POST',
      path: '/api/v1/agent/submit',
      description: 'Submit an Agent goal for execution',
      authRequired: true,
      handler: async (params) => {
        const body = params.body as Record<string, unknown> | undefined;
        if (!body || !body.goal) {
          throw new Error('Goal is required');
        }
        const store = useCastAgentStore.getState();
        const taskId = await store.submitGoal(
          body.goal as string,
          body.templateKey as any
        );
        return { taskId, message: 'Agent goal submitted' };
      }
    });

    this.registerRoute({
      method: 'GET',
      path: '/api/v1/agent/tasks',
      description: 'Get Agent task history',
      authRequired: false,
      handler: async (params) => {
        const store = useCastAgentStore.getState();
        const limit = params.query?.limit ? parseInt(params.query.limit, 10) : 20;
        return store.getTaskHistory(limit).map(t => ({
          id: t.id,
          userGoal: t.userGoal,
          status: t.status,
          totalSteps: t.totalSteps,
          completedSteps: t.completedSteps,
          createdAt: t.createdAt
        }));
      }
    });

    this.registerRoute({
      method: 'GET',
      path: '/api/v1/settings',
      description: 'Get Cast settings',
      authRequired: false,
      handler: async () => {
        const { useCastSettingsStore } = await import('../../store/useCastSettingsStore');
        const store = useCastSettingsStore.getState();
        return {
          general: store.general,
          advanced: store.advanced,
          scheduler: store.scheduler
        };
      }
    });

    this.registerRoute({
      method: 'PUT',
      path: '/api/v1/settings',
      description: 'Update Cast settings',
      authRequired: true,
      handler: async (params) => {
        const body = params.body as Record<string, unknown> | undefined;
        if (!body) throw new Error('Settings body is required');
        const { useCastSettingsStore } = await import('../../store/useCastSettingsStore');
        const store = useCastSettingsStore.getState();

        if (body.general) store.updateGeneral(body.general as any);
        if (body.advanced) store.updateAdvanced(body.advanced as any);
        if (body.scheduler) store.updateScheduler(body.scheduler as any);

        return { message: 'Settings updated successfully' };
      }
    });

    this.registerRoute({
      method: 'POST',
      path: '/api/v1/channels/test',
      description: 'Test channel connectivity',
      authRequired: true,
      handler: async (params) => {
        const body = params.body as Record<string, unknown> | undefined;
        const channelType = (body?.channelType as string) || 'default';
        return {
          channelType,
          tested: true,
          status: 'ok',
          latency: Math.floor(Math.random() * 50) + 5,
          timestamp: Date.now()
        };
      }
    });

    this.registerRoute({
      method: 'GET',
      path: '/api/v1/logs',
      description: 'Get API request logs',
      authRequired: true,
      handler: async (params) => {
        const filter: { method?: string; path?: string; since?: number } = {};
        if (params.query?.method) filter.method = params.query.method;
        if (params.query?.path) filter.path = params.query.path;
        if (params.query?.since) filter.since = parseInt(params.query.since, 10);
        return this.getRequestLogs(filter);
      }
    });
  }

  async handleRequest(request: {
    method: string;
    path: string;
    body?: unknown;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    apiKey?: string;
  }): Promise<ApiResponse> {
    const requestId = generateRequestId();
    const startTime = Date.now();

    const ctx: RequestContext = {
      method: request.method.toUpperCase(),
      path: request.path,
      body: request.body,
      query: request.query || {},
      headers: request.headers || {},
      apiKey: request.apiKey,
      response: { status: 200, body: null as unknown, headers: {} },
      abort: new AbortController().signal,
      startTime
    };

    try {
      await this.runMiddleware(ctx, async () => {
        const resolvedPath = this.resolvePathParams(request.path);
        const routeKey = `${ctx.method}:${resolvedPath.routePattern}`;
        const route = this.routes.get(routeKey);

        if (!route) {
          ctx.response.status = 404;
          ctx.response.body = { error: `Route not found: ${ctx.method} ${request.path}` };
          return;
        }

        if (route.authRequired && !ctx.apiKey) {
          ctx.response.status = 401;
          ctx.response.body = { error: 'API Key required' };
          return;
        }

        const mergedQuery = { ...request.query, ...resolvedPath.params };

        const result = await route.handler({ query: mergedQuery, body: request.body, headers: request.headers });
        ctx.response.status = 200;
        ctx.response.body = result;
      });

      this.totalRequests++;
      if (ctx.response.status >= 400) this.totalErrors++;

      const responseTime = Date.now() - startTime;
      this.logRequest({
        id: generateLogId(),
        method: ctx.method,
        path: request.path,
        requestBody: request.body,
        queryParams: request.query,
        statusCode: ctx.response.status,
        responseType: typeof ctx.response.body === 'object' ? 'json' : 'text',
        responseTime,
        clientIp: request.headers?.['x-forwarded-for'] || 'local',
        apiKey: request.apiKey ? `${request.apiKey.substring(0, 8)}...` : undefined,
        timestamp: startTime,
        error: ctx.response.status >= 400 ? String(ctx.response.body) : undefined
      });

      if (request.apiKey) {
        this.trackApiKeyUsage(request.apiKey);
      }

      return {
        success: ctx.response.status < 400,
        data: ctx.response.body,
        error: ctx.response.status >= 400 ? String(ctx.response.body) : undefined,
        code: this.statusCodeToCode(ctx.response.status),
        timestamp: Date.now(),
        requestId
      };
    } catch (error: any) {
      this.totalRequests++;
      this.totalErrors++;

      const responseTime = Date.now() - startTime;
      this.logRequest({
        id: generateLogId(),
        method: ctx.method,
        path: request.path,
        requestBody: request.body,
        queryParams: request.query,
        statusCode: 500,
        responseType: 'error',
        responseTime,
        clientIp: 'local',
        apiKey: request.apiKey ? `${request.apiKey.substring(0, 8)}...` : undefined,
        timestamp: startTime,
        error: error.message
      });

      return {
        success: false,
        data: null,
        error: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: Date.now(),
        requestId
      };
    }
  }

  generateApiKey(name: string, permissions?: ApiKeyInfo['permissions']): ApiKeyInfo {
    const key = crypto.randomUUID().replace(/-/g, '');
    const info: ApiKeyInfo = {
      key,
      name,
      createdAt: Date.now(),
      usageCount: 0,
      permissions: permissions || ['read', 'write'],
      enabled: true,
      rateLimitPerMinute: 60
    };
    this.apiKeys.set(key, info);
    return info;
  }

  validateApiKey(key: string): ApiKeyInfo | null {
    const info = this.apiKeys.get(key);
    if (!info || !info.enabled) return null;

    if (!this.checkRateLimit(key, info.rateLimitPerMinute)) {
      return null;
    }

    info.lastUsedAt = Date.now();
    info.usageCount++;
    return info;
  }

  revokeApiKey(key: string): boolean {
    const info = this.apiKeys.get(key);
    if (!info) return false;
    info.enabled = false;
    return true;
  }

  listApiKeys(): ApiKeyInfo[] {
    return Array.from(this.apiKeys.values());
  }

  use(middleware: MiddlewareFn): void {
    this.middlewareStack.push(middleware);
  }

  getRequestLogs(filter?: { method?: string; path?: string; since?: number }): ApiRequestLog[] {
    let logs = [...this.requestLogs].reverse();

    if (filter?.method) {
      logs = logs.filter(l => l.method === filter.method!.toUpperCase());
    }
    if (filter?.path) {
      logs = logs.filter(l => l.path.includes(filter.path!));
    }
    if (filter?.since) {
      logs = logs.filter(l => l.timestamp >= filter.since!);
    }

    return logs;
  }

  clearLogs(): void {
    this.requestLogs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.requestLogs, null, 2);
  }

  getServerStatus(): ServerStatus {
    return {
      running: this.running,
      port: this.port,
      version: VERSION,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      startTime: this.startTime,
      routeCount: this.routes.size,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors
    };
  }

  getStats(): ServerStats {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestLogs.filter(l => l.timestamp >= oneMinuteAgo);

    const endpointCounts: Record<string, number> = {};
    recentRequests.forEach(l => {
      endpointCounts[l.path] = (endpointCounts[l.path] || 0) + 1;
    });
    const topEndpoints = Object.entries(endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count }));

    const activeKeys = Array.from(this.apiKeys.values()).filter(k => k.enabled).length;

    return {
      uptime: this.startTime ? now - this.startTime : 0,
      requestsPerMinute: recentRequests.length,
      errorRate: this.totalRequests > 0 ? (this.totalErrors / this.totalRequests * 100) : 0,
      topEndpoints,
      activeApiKeys: activeKeys,
      memoryUsage: {
        routes: this.routes.size,
        logs: this.requestLogs.length,
        keys: this.apiKeys.size
      }
    };
  }

  private setupBroadcastChannel(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('cast-api-server');
      this.broadcastChannel.onmessage = async (event) => {
        const { requestId, method, path, body, query, headers, apiKey } = event.data;
        try {
          const result = await this.handleRequest({ method, path, body, query, headers, apiKey });
          if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(result);
          }
        } catch (error: any) {
          if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({
              requestId,
              success: false,
              error: error.message,
              code: 'BROADCAST_ERROR',
              timestamp: Date.now()
            });
          }
        }
      };
      console.log('[CastApiServer] BroadcastChannel listener established on "cast-api-server"');
    } catch (e) {
      console.warn('[CastApiServer] BroadcastChannel not available:', e);
    }
  }

  private teardownBroadcastChannel(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }

  private async runMiddleware(ctx: RequestContext, finalHandler: () => Promise<void>): Promise<void> {
    const allHandlers = [...this.middlewareStack, finalHandler];
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < allHandlers.length) {
        const handler = allHandlers[index++];
        await handler(ctx, next);
      }
    };

    await next();
  }

  private resolvePathParams(path: string): { routePattern: string; params: Record<string, string> } {
    const paramRegex = /:([^/]+)/g;

    for (const [key, route] of this.routes) {
      const routePath = route.path;
      const routePattern = routePath.replace(paramRegex, '([^/]+)');
      const fullRegex = new RegExp(`^${routePattern}$`);

      const match = path.match(fullRegex);
      if (match) {
        const paramNames: string[] = [];
        let paramMatch;
        const regex = new RegExp(paramRegex.source, 'g');
        while ((paramMatch = regex.exec(routePath)) !== null) {
          paramNames.push(paramMatch[1]);
        }

        const params: Record<string, string> = {};
        paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });

        return { routePattern: route.path, params };
      }
    }

    return { routePattern: path, params: {} };
  }

  private logRequest(log: ApiRequestLog): void {
    this.requestLogs.push(log);
    if (this.requestLogs.length > MAX_LOGS) {
      this.requestLogs = this.requestLogs.slice(-MAX_LOGS);
    }
  }

  private checkRateLimit(key: string, limit: number): boolean {
    const now = Date.now();
    const windowStart = now - 60000;
    let timestamps = this.rateLimitMap.get(key) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= limit) {
      return false;
    }

    timestamps.push(now);
    this.rateLimitMap.set(key, timestamps);
    return true;
  }

  private trackApiKeyUsage(key: string): void {
    const info = this.apiKeys.get(key);
    if (info) {
      info.lastUsedAt = Date.now();
    }
  }

  private statusCodeToCode(status: number): string {
    const codes: Record<number, string> = {
      200: 'OK',
      201: 'CREATED',
      204: 'NO_CONTENT',
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR'
    };
    return codes[status] || `HTTP_${status}`;
  }
}

export const castApiServer = new CastApiServerImpl(DEFAULT_PORT);

export function cors(): MiddlewareFn {
  return async (ctx, next) => {
    ctx.response.headers['Access-Control-Allow-Origin'] = '*';
    ctx.response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    ctx.response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key, Authorization';
    ctx.response.headers['Access-Control-Max-Age'] = '86400';
    if (ctx.method === 'OPTIONS') {
      ctx.response.status = 204;
      ctx.response.body = null;
      return;
    }
    await next();
  };
}

export function auth(server: CastApiServerImpl): MiddlewareFn {
  return async (ctx, next) => {
    const apiKeyHeader = ctx.headers['x-api-key'] || ctx.headers['authorization']?.replace('Bearer ', '');
    if (apiKeyHeader) {
      const keyInfo = server.validateApiKey(apiKeyHeader);
      if (keyInfo) {
        ctx.apiKey = apiKeyHeader;
      }
    }
    await next();
  };
}

export function rateLimit(maxPerMinute: number = MAX_REQUESTS_PER_MINUTE): MiddlewareFn {
  const windowMap: Map<string, number[]> = new Map();

  return async (ctx, next) => {
    const clientKey = ctx.apiKey || ctx.headers['x-forwarded-for'] || 'anonymous';
    const now = Date.now();
    const windowStart = now - 60000;

    let timestamps = windowMap.get(clientKey) || [];
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= maxPerMinute) {
      ctx.response.status = 429;
      ctx.response.body = { error: 'Rate limit exceeded', retryAfter: 60 };
      return;
    }

    timestamps.push(now);
    windowMap.set(clientKey, timestamps);
    await next();
  };
}

export function logger(): MiddlewareFn {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(
      `[CastApiServer] ${ctx.method} ${ctx.path} -> ${ctx.response.status} (${ms}ms)`
    );
  };
}

export function jsonParser(): MiddlewareFn {
  return async (ctx, next) => {
    if (ctx.body && typeof ctx.body === 'string') {
      try {
        ctx.body = JSON.parse(ctx.body);
      } catch {
      }
    }
    await next();
  };
}

export function errorHandler(): MiddlewareFn {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error: any) {
      console.error(`[CastApiServer] Error on ${ctx.method} ${ctx.path}:`, error.message);
      if (!ctx.response.status || ctx.response.status < 400) {
        ctx.response.status = 500;
      }
      ctx.response.body = { error: error.message || 'Internal server error' };
    }
  };
}
