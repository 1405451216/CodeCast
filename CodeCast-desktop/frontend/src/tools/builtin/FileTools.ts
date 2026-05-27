import { AgentTool, ToolCategory, ToolContext, ToolPermission, ToolResult } from '../types';

const readFile: AgentTool = {
  id: 'read_file',
  name: '读取文件',
  description: '读取指定路径的文件内容，支持文本文件的完整内容获取',
  category: ToolCategory.FILE,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['file', 'read', 'io'],
  version: '1.0.0',

  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '要读取的文件绝对或相对路径',
      required: true
    },
    {
      name: 'encoding',
      type: 'string',
      description: '文件编码格式，默认为 utf-8',
      required: false,
      default: 'utf-8'
    },
    {
      name: 'offset',
      type: 'number',
      description: '起始行号（从1开始），用于分页读取大文件',
      required: false
    },
    {
      name: 'limit',
      type: 'number',
      description: '最大读取行数，用于分页读取大文件',
      required: false
    }
  ],

  examples: [
    {
      params: { path: './src/App.tsx' },
      description: '读取 App.tsx 文件的全部内容'
    },
    {
      params: { path: './src/utils/logger.ts', offset: 1, limit: 100 },
      description: '读取 logger.ts 文件的前100行'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      if (context.fileSystem?.readFile) {
        const content = await context.fileSystem.readFile(params.path);

        let resultContent = content;
        if (params.offset || params.limit) {
          const lines = content.split('\n');
          const start = (params.offset || 1) - 1;
          const end = params.limit ? start + params.limit : lines.length;
          resultContent = lines.slice(start, end).join('\n');
        }

        return {
          success: true,
          data: resultContent,
          output: `成功读取文件: ${params.path}`,
          metadata: {
            filePath: params.path,
            size: resultContent.length,
            lines: resultContent.split('\n').length
          }
        };
      }

      return {
        success: false,
        error: '文件系统接口不可用，无法读取文件',
        metadata: { missingInterface: 'fileSystem.readFile' }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `读取文件失败: ${message}`,
        metadata: { originalError: message, path: params.path }
      };
    }
  }
};

const writeFile: AgentTool = {
  id: 'write_file',
  name: '写入文件',
  description: '将内容写入到指定路径的文件，如果文件已存在则覆盖，不存在则创建新文件',
  category: ToolCategory.FILE,
  permission: ToolPermission.WRITE,
  requiresPermission: true,
  tags: ['file', 'write', 'io', 'dangerous'],
  version: '1.0.0',

  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '要写入的文件绝对或相对路径',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: '要写入的文件内容',
      required: true
    },
    {
      name: 'encoding',
      type: 'string',
      description: '文件编码格式，默认为 utf-8',
      required: false,
      default: 'utf-8'
    },
    {
      name: 'createDirectories',
      type: 'boolean',
      description: '是否自动创建不存在的父目录',
      required: false,
      default: false
    }
  ],

  examples: [
    {
      params: { path: './src/utils/helper.ts', content: 'export function helper() {}' },
      description: '创建新的辅助函数文件'
    },
    {
      params: { path: './README.md', content: '# Project Name\n\nDescription here...' },
      description: '更新 README 文档'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (context.fileSystem?.writeFile) {
        await context.fileSystem.writeFile(params.path, params.content);

        context.logger?.info(`[FileTool] Written to ${params.path} (${params.content.length} chars)`);

        return {
          success: true,
          data: null,
          output: `成功写入文件: ${params.path}`,
          metadata: {
            filePath: params.path,
            size: params.content.length,
            lines: params.content.split('\n').length
          }
        };
      }

      return {
        success: false,
        error: '文件系统接口不可用，无法写入文件',
        metadata: { missingInterface: 'fileSystem.writeFile' }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `写入文件失败: ${message}`,
        metadata: { originalError: message, path: params.path }
      };
    }
  }
};

const searchFiles: AgentTool = {
  id: 'search_files',
  name: '搜索文件',
  description: '在项目目录中搜索匹配特定模式的文件和代码内容',
  category: ToolCategory.FILE,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['file', 'search', 'code'],
  version: '1.0.0',

  parameters: [
    {
      name: 'pattern',
      type: 'string',
      description: '搜索模式：支持 glob 模式（如 **/*.ts）或正则表达式',
      required: true
    },
    {
      name: 'path',
      type: 'string',
      description: '搜索根目录，默认为项目根目录',
      required: false
    },
    {
      name: 'type',
      type: 'string',
      description: '搜索类型: "name" 按文件名搜索, "content" 按内容搜索',
      required: false,
      default: 'name',
      enum: ['name', 'content']
    },
    {
      name: 'excludePatterns',
      type: 'array',
      description: '排除模式数组（如 node_modules, dist, .git）',
      required: false,
      items: { name: 'pattern', type: 'string', description: '排除的 glob 模式' }
    }
  ],

  examples: [
    {
      params: { pattern: '**/*.test.ts', type: 'name' },
      description: '查找所有测试文件'
    },
    {
      params: { pattern: 'TODO|FIXME', type: 'content' },
      description: '在代码中搜索 TODO 和 FIXME 标记'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (context.terminalRef?.executeCommand) {
        let command: string;

        if (params.type === 'content') {
          command = `rg --no-heading -n "${params.pattern}" ${params.path || '.'}`;
          if (params.excludePatterns?.length) {
            const exclude = params.excludePatterns.map((p: string) => `--glob '!${p}'`).join(' ');
            command = `rg --no-heading -n ${exclude} "${params.pattern}" ${params.path || '.'}`;
          }
        } else {
          command = params.excludePatterns?.length
            ? `Get-ChildItem -Path "${params.path || '.'}" -Recurse -Filter "${params.pattern}" | Where-Object { $_.FullName -notmatch '${params.excludePatterns.join('|')}' } | Select-Object -ExpandProperty FullName`
            : `Get-ChildItem -Path "${params.path || '.'}" -Recurse -Filter "${params.pattern}" | Select-Object -ExpandProperty FullName`;
        }

        const result = await context.terminalRef.executeCommand(command);

        if (result.exitCode === 0 || result.output.trim()) {
          const matches = result.output.split('\n').filter(line => line.trim());

          return {
            success: true,
            data: matches,
            output: `找到 ${matches.length} 个匹配项`,
            metadata: {
              pattern: params.pattern,
              matchCount: matches.length,
              searchType: params.type
            }
          };
        }

        return {
          success: true,
          data: [],
          output: '未找到匹配项',
          metadata: { pattern: params.pattern, matchCount: 0 }
        };
      }

      return {
        success: false,
        error: '终端接口不可用，无法执行搜索命令',
        metadata: { missingInterface: 'terminalRef.executeCommand' }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `搜索文件失败: ${message}`,
        metadata: { originalError: message, pattern: params.pattern }
      };
    }
  }
};

const listDirectory: AgentTool = {
  id: 'list_directory',
  name: '列出目录',
  description: '列出指定目录下的文件和子目录结构',
  category: ToolCategory.FILE,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['file', 'directory', 'list'],
  version: '1.0.0',

  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '要列出的目录路径，默认为当前工作目录',
      required: false,
      default: '.'
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: '是否递归列出子目录内容',
      required: false,
      default: false
    },
    {
      name: 'showHidden',
      type: 'boolean',
      description: '是否显示隐藏文件（以.开头的文件）',
      required: false,
      default: false
    },
    {
      name: 'ignore',
      type: 'array',
      description: '要忽略的目录或文件模式列表',
      required: false,
      items: { name: 'pattern', type: 'string', description: '忽略的模式' }
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (context.fileSystem?.listDirectory) {
        const entries = await context.fileSystem.listDirectory(params.path);

        let filteredEntries = entries;

        if (!params.showHidden) {
          filteredEntries = filteredEntries.filter(entry => !entry.name.startsWith('.'));
        }

        if (params.ignore?.length) {
          filteredEntries = filteredEntries.filter(
            entry => !params.ignore!.some((pattern: string) =>
              entry.name.includes(pattern) || new RegExp(pattern).test(entry.name)
            )
          );
        }

        return {
          success: true,
          data: filteredEntries.map(entry => ({
            name: entry.name,
            path: entry.path,
            isDirectory: entry.isDirectory,
            size: entry.size
          })),
          output: `列出目录 ${params.path}: ${filteredEntries.length} 项`,
          metadata: {
            directoryPath: params.path,
            itemCount: filteredEntries.length
          }
        };
      }

      if (context.terminalRef?.executeCommand) {
        const recursiveFlag = params.recursive ? '-Recurse' : '';
        const hiddenFlag = params.showHidden ? '-Force' : '';
        const command = `Get-ChildItem -Path "${params.path}" ${recursiveFlag} ${hiddenFlag} | Select-Object Name, FullName, PSIsContainer, Length | Format-Table -AutoSize`;

        const result = await context.terminalRef.executeCommand(command);

        return {
          success: true,
          data: result.output,
          output: `列出目录 ${params.path}`,
          metadata: { rawOutput: result.output, exitCode: result.exitCode }
        };
      }

      return {
        success: false,
        error: '无可用的文件系统或终端接口',
        metadata: {}
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `列出目录失败: ${message}`,
        metadata: { originalError: message, path: params.path }
      };
    }
  }
};

const deleteFile: AgentTool = {
  id: 'delete_file',
  name: '删除文件',
  description: '删除指定的文件或空目录，此操作不可逆请谨慎使用',
  category: ToolCategory.FILE,
  permission: ToolPermission.DANGEROUS,
  requiresPermission: true,
  tags: ['file', 'delete', 'dangerous'],
  version: '1.0.0',

  parameters: [
    {
      name: 'path',
      type: 'string',
      description: '要删除的文件或目录路径',
      required: true
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: '是否递归删除非空目录及其内容',
      required: false,
      default: false
    }
  ],

  examples: [
    {
      params: { path: './temp/old-file.txt' },
      description: '删除临时文件'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (context.fileSystem?.deleteFile) {
        await context.fileSystem.deleteFile(params.path);

        context.logger?.warn(`[FileTool] Deleted file/directory: ${params.path}`);

        return {
          success: true,
          data: null,
          output: `成功删除: ${params.path}`,
          metadata: {
            deletedPath: params.path,
            timestamp: Date.now()
          }
        };
      }

      return {
        success: false,
        error: '文件系统接口不可用，无法删除文件',
        metadata: { missingInterface: 'fileSystem.deleteFile' }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `删除文件失败: ${message}`,
        metadata: { originalError: message, path: params.path }
      };
    }
  }
};

export const fileTools: AgentTool[] = [readFile, writeFile, searchFiles, listDirectory, deleteFile];

export default fileTools;
