import { AgentTool, ToolCategory, ToolContext, ToolPermission, ToolResult } from '../types';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function parseSearchResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const divRegex = /<div[^>]*class="[^"]*g[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;

  while ((match = divRegex.exec(html)) !== null && results.length < 10) {
    const block = match[1];

    const titleMatch = block.match(/<h3[^>]*>(.*?)<\/h3>/i);
    const urlMatch = block.match(/href="([^"]*)"/i);
    const snippetMatch = block.match(/<span[^>]*>([\s\S]*?)<\/span>/i);

    if (titleMatch && urlMatch) {
      results.push({
        title: stripHtml(titleMatch[1]),
        url: urlMatch[1],
        snippet: snippetMatch ? stripHtml(snippetMatch[1]).slice(0, 200) : ''
      });
    }
  }

  return results;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<li>/gi, '\n• ');
  text = text.replace(/<h[1-6][^>]*>/gi, '\n\n');
  text = stripHtml(text);

  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const webSearch: AgentTool = {
  id: 'web_search',
  name: '网络搜索',
  description: '搜索互联网获取文档、API 参考、技术文章等信息，用于查找最新的技术资料和解决方案',
  category: ToolCategory.WEB,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['web', 'search', 'internet', 'documentation'],
  version: '1.0.0',

  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索查询关键词或问题',
      required: true
    },
    {
      name: 'num_results',
      type: 'number',
      description: '返回结果数量（1-10），默认为 5',
      required: false,
      default: 5
    },
    {
      name: 'site',
      type: 'string',
      description: '限制搜索的网站域名（如 docs.python.org, github.com）',
      required: false
    },
    {
      name: 'language',
      type: 'string',
      description: '结果语言偏好（如 zh-CN, en）',
      required: false
    }
  ],

  examples: [
    {
      params: { query: 'React useEffect cleanup function best practices' },
      description: '搜索 React useEffect 清理函数的最佳实践'
    },
    {
      params: { query: 'TypeScript generics tutorial', site: 'typescriptlang.org' },
      description: '在 TypeScript 官方文档中搜索泛型教程'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      let searchUrl = `https://www.google.com/search?q=${encodeURIComponent(params.query)}&num=${params.num_results || 5}`;

      if (params.site) {
        searchUrl += `+site:${encodeURIComponent(params.site)}`;
      }

      if (params.language) {
        searchUrl += `&hl=${params.language}`;
      }

      if (context.api?.fetch) {
        const response = await context.api.fetch(searchUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'User-Agent': 'Mozilla/5.0 (compatible; CodeCast/1.0)'
          }
        });

        if (!response.ok) {
          return {
            success: false,
            error: `网络请求失败: ${response.status} ${response.statusText}`,
            metadata: { status: response.status }
          };
        }

        const html = await response.text();
        const results = parseSearchResults(html);

        return {
          success: true,
          data: {
            query: params.query,
            results: results.slice(0, params.num_results || 5),
            totalFound: results.length,
            searchUrl
          },
          output: `找到 ${results.length} 条搜索结果`,
          metadata: {
            query: params.query,
            resultCount: results.length,
            executionTime: Date.now() - startTime
          }
        };
      }

      return {
        success: false,
        error: '网络接口不可用，无法执行搜索',
        metadata: { missingInterface: 'api.fetch' }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `网络搜索失败: ${message}`,
        metadata: { originalError: message, query: params.query }
      };
    }
  }
};

const fetchUrl: AgentTool = {
  id: 'fetch_url',
  name: '获取网页内容',
  description: '获取指定 URL 的网页内容并转换为可读文本，用于读取在线文档、API 响应等',
  category: ToolCategory.WEB,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['web', 'fetch', 'http', 'url'],
  version: '1.0.0',

  parameters: [
    {
      name: 'url',
      type: 'string',
      description: '要获取内容的 URL 地址（支持 http/https）',
      required: true
    },
    {
      name: 'method',
      type: 'string',
      description: 'HTTP 请求方法',
      required: false,
      default: 'GET',
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    {
      name: 'headers',
      type: 'object',
      description: '自定义 HTTP 请求头',
      required: false,
      properties: {}
    },
    {
      name: 'body',
      type: 'string',
      description: '请求体内容（POST/PUT/PATCH 时使用）',
      required: false
    },
    {
      name: 'max_length',
      type: 'number',
      description: '最大返回字符数，防止响应过大（默认 50000）',
      required: false,
      default: 50000
    },
    {
      name: 'extract_text',
      type: 'boolean',
      description: '是否从 HTML 中提取纯文本内容',
      required: false,
      default: true
    }
  ],

  examples: [
    {
      params: { url: 'https://jsonplaceholder.typicode.com/posts/1' },
      description: '获取 JSON API 示例数据'
    },
    {
      params: { url: 'https://example.com/api/data', method: 'POST', body: '{"key":"value"}' },
      description: '发送 POST 请求到 API'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      if (!context.api?.fetch) {
        return {
          success: false,
          error: '网络接口不可用，无法获取 URL 内容',
          metadata: { missingInterface: 'api.fetch' }
        };
      }

      const response = await context.api.fetch(params.url, {
        method: params.method || 'GET',
        headers: {
          'Accept': '*/*',
          'User-Agent': 'CodeCast/1.0',
          ...(params.headers as Record<string, string>)
        },
        body: params.body
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP 请求失败: ${response.status} ${response.statusText}`,
          metadata: { status: response.status, url: params.url }
        };
      }

      const contentType = response.headers.get('content-type') || '';
      let content = await response.text();

      if (params.extract_text !== false && contentType.includes('text/html')) {
        content = htmlToText(content).slice(0, params.max_length || 50000);
      } else if (content.length > (params.max_length || 50000)) {
        content = content.slice(0, params.max_length || 50000) + '\n\n... [内容已截断]';
      }

      return {
        success: true,
        data: {
          url: params.url,
          contentType,
          contentLength: content.length,
          status: response.status,
          content
        },
        output: `成功获取 ${params.url} 的内容 (${content.length} 字符)`,
        metadata: {
          url: params.url,
          contentType,
          contentLength: content.length,
          executionTime: Date.now() - startTime
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `获取 URL 失败: ${message}`,
        metadata: { originalError: message, url: params.url }
      };
    }
  }
};

export const webTools: AgentTool[] = [webSearch, fetchUrl];
