import { castApiServer } from './cast-api-server';

function methodToOpenApiMethod(method: string): string {
  const map: Record<string, string> = {
    GET: 'get',
    POST: 'post',
    PUT: 'put',
    DELETE: 'delete',
    PATCH: 'patch'
  };
  return map[method.toUpperCase()] || method.toLowerCase();
}

function pathToOpenApiParams(path: string): Array<{ name: string; in: 'path'; required: boolean; schema: { type: string } }> {
  const params: Array<{ name: string; in: 'path'; required: boolean; schema: { type: string } }> = [];
  const paramRegex = /:([^/]+)/g;
  let match;
  while ((match = paramRegex.exec(path)) !== null) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' }
    });
  }
  return params;
}

export function generateOpenAPISpec(): object {
  const routes = castApiServer.getRoutes();
  const status = castApiServer.getServerStatus();

  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const openApiPath = route.path.replace(/:([^/]+)/g, '{$1}');
    const method = methodToOpenApiMethod(route.method);

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    const pathParams = pathToOpenApiParams(route.path);

    const operation: Record<string, unknown> = {
      summary: route.description,
      operationId: `${route.method.toLowerCase()}${route.path.replace(/[^a-zA-Z0-9]/g, '')}`,
      tags: ['Cast API'],
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiResponse'
              }
            }
          }
        },
        '401': {
          description: 'Unauthorized - API Key required or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiResponse'
              }
            }
          }
        },
        '429': {
          description: 'Too Many Requests - Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiResponse'
              }
            }
          }
        },
        '500': {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ApiResponse'
              }
            }
          }
        }
      }
    };

    if (route.authRequired) {
      (operation as any).security = [{ apiKeyAuth: [] }];
    }

    if (pathParams.length > 0) {
      (operation as any).parameters = pathParams;
    }

    if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
      (operation as any).requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              description: 'Request body varies by endpoint'
            }
          }
        }
      };
    }

    if (['GET', 'DELETE'].includes(route.method)) {
      (operation as any).parameters = [
        ...(operation as any).parameters || [],
        {
          name: 'limit',
          in: 'query',
          required: false,
          description: 'Maximum number of items to return',
          schema: { type: 'integer', default: 50 }
        },
        {
          name: 'type',
          in: 'query',
          required: false,
          description: 'Filter by type (for memory endpoints)',
          schema: { type: 'string' }
        },
        {
          name: 'search',
          in: 'query',
          required: false,
          description: 'Search query string',
          schema: { type: 'string' }
        }
      ];
    }

    paths[openApiPath][method] = operation;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'CodeCast Cast API',
      version: '1.0.0',
      description: `RESTful API for CodeCast Cast workspace. Allows external programs to control all Cast features including memory management, task scheduling, agent execution, tool invocation, and settings configuration.

## Authentication

All endpoints marked with a lock icon require an **API Key** sent via the \`X-API-Key\` header.

\`\`\`
curl -H "X-API-Key: your-key-here" http://localhost:${status.port}/api/v1/memory
\`\`\`

## BroadcastChannel Mode

Since this is a desktop application without a traditional HTTP server, the API uses the **BroadcastChannel** browser API for cross-window/tab communication:

\`\`\`javascript
const channel = new BroadcastChannel('cast-api-server');
channel.postMessage({
  requestId: 'my-request-1',
  method: 'GET',
  path: '/api/v1/status'
});
channel.onmessage = (event) => {
  console.log('Response:', event.data);
};
\`\`\`

## SDK Usage

Use the built-in client SDK for convenience:

\`\`\`javascript
import { castApiClient } from './utils/cast/cast-api-client';
castApiClient.setApiKey('your-key');
const memories = await castApiClient.getMemories({ limit: 20 });
\`\`\`

## Rate Limits

Default rate limit is **120 requests per minute** per API key.`,
      contact: {
        name: 'CodeCast Team',
        url: 'https://github.com/codecast'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${status.port}`,
        description: 'Local development server (in-memory / BroadcastChannel)'
      }
    ],
    tags: [
      {
        name: 'Cast API',
        description: 'Core Cast workspace API endpoints'
      }
    ],
    paths,
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication. Generate one from the API Server panel.'
        }
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          required: ['success', 'data', 'code', 'timestamp', 'requestId'],
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the request was successful',
              example: true
            },
            data: {
              type: 'object',
              description: 'Response payload (varies by endpoint)'
            },
            error: {
              type: 'string',
              description: 'Error message if success is false'
            },
            code: {
              type: 'string',
              description: 'Response code identifier',
              example: 'OK'
            },
            timestamp: {
              type: 'integer',
              description: 'Unix timestamp of response',
              format: 'int64'
            },
            requestId: {
              type: 'string',
              description: 'Unique request identifier for tracing',
              example: 'req-1700000000-abc12345'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          allOf: [
            { $ref: '#/components/schemas/ApiResponse' },
            {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasMore: { type: 'boolean' }
              }
            }
          ]
        },
        ApiKeyInfo: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'The API key value (only shown once on creation)' },
            name: { type: 'string', description: 'Human-readable name for this key' },
            createdAt: { type: 'integer', format: 'int64' },
            lastUsedAt: { type: 'integer', format: 'int64' },
            usageCount: { type: 'integer' },
            permissions: {
              type: 'array',
              items: { type: 'string', enum: ['read', 'write', 'execute', 'admin'] }
            },
            enabled: { type: 'boolean' },
            rateLimitPerMinute: { type: 'integer' }
          }
        },
        ServerStatus: {
          type: 'object',
          properties: {
            running: { type: 'boolean' },
            port: { type: 'integer' },
            version: { type: 'string' },
            uptime: { type: 'integer', format: 'int64' },
            startTime: { type: 'integer', format: 'int64' },
            routeCount: { type: 'integer' },
            totalRequests: { type: 'integer' },
            totalErrors: { type: 'integer' }
          }
        },
        MemoryItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            type: { type: 'string', enum: ['conversation', 'context', 'preference', 'insight', 'decision', 'fact'] },
            source: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            timestamp: { type: 'integer', format: 'int64' },
            importance: { type: 'number' }
          }
        },
        SchedulerTask: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string' },
            enabled: { type: 'boolean' },
            status: { type: 'string' },
            frequency: { type: 'string' },
            cronExpression: { type: 'string' },
            runCount: { type: 'integer' },
            failCount: { type: 'integer' }
          }
        },
        ToolInfo: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            icon: { type: 'string' },
            version: { type: 'string' },
            author: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            permissions: { type: 'array', items: { type: 'string' } }
          }
        },
        AgentTask: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userGoal: { type: 'string' },
            status: { type: 'string' },
            totalSteps: { type: 'integer' },
            completedSteps: { type: 'integer' },
            createdAt: { type: 'integer', format: 'int64' }
          }
        },
        RequestLog: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            method: { type: 'string' },
            path: { type: 'string' },
            statusCode: { type: 'integer' },
            responseTime: { type: 'integer' },
            timestamp: { type: 'integer', format: 'int64' },
            error: { type: 'string' }
          }
        }
      }
    }
  };
}
