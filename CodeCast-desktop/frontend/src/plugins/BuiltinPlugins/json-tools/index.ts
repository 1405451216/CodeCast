import type { ICastTool, ToolContext, ToolResult, UISchema } from '../../types/cast-plugin';

function formatJson(jsonStr: string, indent: number = 2, sortKeys: boolean = false): string {
  try {
    const parsed = JSON.parse(jsonStr);
    if (sortKeys) {
      const sorted = (obj: Record<string, unknown>): Record<string, unknown> => {
        if (Array.isArray(obj)) return obj.map(item => typeof item === 'object' && item !== null ? sorted(item as Record<string, unknown>) : item);
        if (typeof obj === 'object' && obj !== null) {
          return Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = typeof obj[key] === 'object' && obj[key] !== null ? sorted(obj[key] as Record<string, unknown>) : obj[key];
            return acc;
          }, {} as Record<string, unknown>);
        }
        return obj;
      };
      return JSON.stringify(sorted(parsed), null, indent);
    }
    return JSON.stringify(parsed, null, indent);
  } catch {
    throw new Error('无效的 JSON 格式');
  }
}

function validateJson(jsonStr: string): { valid: boolean; error?: string; position?: number } {
  try {
    JSON.parse(jsonStr);
    return { valid: true };
  } catch (e: any) {
    const match = e.message.match(/position\s+(\d+)/i);
    return { valid: false, error: e.message, position: match ? parseInt(match[1]) : undefined };
  }
}

function getJsonValueByPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/^\$\.?/, '').split('.');
  let current: unknown = obj;

  for (const part of parts) {
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)?.[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index)];
      }
    } else {
      current = (current as Record<string, unknown>)?.[part];
    }
    if (current === undefined) break;
  }

  return current;
}

function jsonToCsv(jsonStr: string, delimiter: string = ','): string {
  try {
    const data = JSON.parse(jsonStr);
    const items = Array.isArray(data) ? data : [data];

    if (items.length === 0) return '';

    const allKeys = new Set<string>();
    items.forEach((item: Record<string, unknown>) => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });
    const keys = Array.from(allKeys);

    const escapeField = (value: unknown): string => {
      const str = String(value ?? '');
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = keys.map(escapeField).join(delimiter);
    const rows = items.map((item: Record<string, unknown>) =>
      keys.map(key => escapeField(item[key])).join(delimiter)
    );

    return [header, ...rows].join('\n');
  } catch {
    throw new Error('JSON 转 CSV 失败：请确保输入是有效的 JSON 数组或对象');
  }
}

function csvToJson(csvStr: string, delimiter: string = ','): string {
  try {
    const lines = csvStr.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV 至少需要表头和一行数据');

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    };

    const headers = parseLine(lines[0]);
    const items = lines.slice(1).map(line => {
      const values = parseLine(line);
      const item: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        item[header] = values[index] || '';
      });
      return item;
    });

    return JSON.stringify(items, null, 2);
  } catch (e: any) {
    throw new Error(`CSV 转 JSON 失败: ${e.message}`);
  }
}

const jsonToolsTool: ICastTool = {
  id: 'json_tools',
  name: 'JSON 工具集',
  description: '提供 JSON 格式化、验证、路径提取、JSON转CSV、CSV转JSON等实用功能',
  version: '1.0.0',
  author: 'CodeCast Official',
  category: 'utility',
  icon: '🔧',
  color: '#8b5cf6',
  tags: ['json', 'format', 'validate', 'csv', 'transform'],

  uiSchema: [
    { type: 'textarea', name: 'input', label: '输入内容', required: true, placeholder: '粘贴 JSON 或 CSV 内容...' },
    { type: 'select', name: 'operation', label: '操作类型', options: [
      { label: '📝 格式化 JSON', value: 'format' },
      { label: '✅ 验证 JSON', value: 'validate' },
      { label: '🔍 提取 JSONPath 值', value: 'path' },
      { label: '📊 JSON 转 CSV', value: 'to_csv' },
      { label: '📋 CSV 转 JSON', value: 'from_csv' }
    ]},
    { type: 'text', name: 'path', label: 'JSONPath（仅 path 操作需要）', placeholder: '$.data.users[0].name' },
    { type: 'number', name: 'indent', label: '缩进空格数', min: 1, max: 8, defaultValue: 2 },
    { type: 'toggle', name: 'sortKeys', label: '排序键名' }
  ] as UISchema[],

  permissions: [],
  streaming: false,

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const input = (params.input as string) || '';
    const operation = (params.operation as string) || 'format';
    const path = (params.path as string) || '';
    const indent = Math.min(Math.max((params.indent as number) || 2, 1), 8);
    const sortKeys = params.sortKeys as boolean || false;

    if (!input.trim()) {
      return {
        success: false,
        output: '❌ 请输入要处理的内容',
        error: 'Missing required parameter: input'
      };
    }

    try {
      let result: string;
      const metadata: Record<string, unknown> = { operation, processedAt: new Date().toISOString() };

      switch (operation) {
        case 'format':
          result = `✅ 格式化结果:\n\n${formatJson(input, indent, sortKeys)}`;
          metadata.indent = indent;
          metadata.sortKeys = sortKeys;
          break;

        case 'validate': {
          const validation = validateJson(input);
          if (validation.valid) {
            const parsed = JSON.parse(input);
            const size = JSON.stringify(parsed).length;
            result = `✅ JSON 格式有效!\n\n` +
              `📊 大小: ${(size / 1024).toFixed(2)} KB\n` +
              `🔢 类型: ${Array.isArray(parsed) ? '数组' : typeof parsed === 'object' ? '对象' : typeof parsed}`;
            if (typeof parsed === 'object' && parsed !== null) {
              result += `\n📑 键/元素数量: ${Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length}`;
            }
          } else {
            result = `❌ JSON 格式错误:\n` +
              `💬 ${validation.error}${validation.position ? `\n📍 位置: ${validation.position}` : ''}`;
          }
          metadata.valid = validation.valid;
          break;
        }

        case 'path':
          if (!path) {
            return {
              success: false,
              output: '❌ 请输入 JSONPath 表达式',
              error: 'Missing required parameter: path'
            };
          }
          try {
            const parsed = JSON.parse(input);
            const value = getJsonValueByPath(parsed, path);
            if (value === undefined) {
              result = `⚠️ 未找到路径 "${path}" 的值`;
            } else {
              result = `🔍 路径 "${path}" 的值:\n\n${typeof value === 'object' ? JSON.stringify(value, null, indent) : String(value)}`;
            }
          } catch {
            return {
              success: false,
              output: '❌ 输入的 JSON 无效，无法提取路径',
              error: 'Invalid JSON input'
            };
          }
          metadata.path = path;
          break;

        case 'to_csv':
          result = `📊 JSON → CSV 转换结果:\n\n${jsonToCsv(input)}`;
          break;

        case 'from_csv':
          result = `📋 CSV → JSON 转换结果:\n\n${csvToJson(input)}`;
          break;

        default:
          return {
            success: false,
            output: `❌ 不支持的操作类型: ${operation}`,
            error: `Unknown operation: ${operation}`
          };
      }

      return {
        success: true,
        output: result,
        metadata
      };
    } catch (error: any) {
      return { success: false, output: `❌ 操作失败: ${error.message}`, error: error.message };
    }
  }
};

export default [jsonToolsTool];
