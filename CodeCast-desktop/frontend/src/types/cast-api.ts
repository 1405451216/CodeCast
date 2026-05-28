export interface ApiKeyInfo {
  key: string;
  name: string;
  createdAt: number;
  lastUsedAt?: number;
  usageCount: number;
  permissions: Array<'read' | 'write' | 'execute' | 'admin'>;
  enabled: boolean;
  rateLimitPerMinute: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: string;
  code: string;
  timestamp: number;
  requestId: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  authRequired: boolean;
  rateLimit?: number;
}

export interface CastApiRoute {
  path: string;
  method: string;
  handler: (params: { query?: Record<string, string>; body?: unknown; headers?: Record<string, string> }) => Promise<unknown>;
  description: string;
  authRequired: boolean;
}

export interface ApiRequestLog {
  id: string;
  method: string;
  path: string;
  requestBody?: unknown;
  queryParams?: Record<string, string>;
  statusCode: number;
  responseType: string;
  responseTime: number;
  clientIp: string;
  apiKey?: string;
  timestamp: number;
  error?: string;
}

export interface RequestContext {
  method: string;
  path: string;
  body?: unknown;
  query: Record<string, string>;
  headers: Record<string, string>;
  apiKey?: string;
  response: { status: number; body: unknown; headers: Record<string, string> };
  abort: AbortSignal;
  startTime: number;
}

export type MiddlewareFn = (ctx: RequestContext, next: () => Promise<void>) => Promise<void>;

export interface ServerStatus {
  running: boolean;
  port: number;
  version: string;
  uptime: number;
  startTime: number | null;
  routeCount: number;
  totalRequests: number;
  totalErrors: number;
}

export interface ServerStats {
  uptime: number;
  requestsPerMinute: number;
  errorRate: number;
  topEndpoints: Array<{ path: string; count: number }>;
  activeApiKeys: number;
  memoryUsage: { routes: number; logs: number; keys: number };
}
