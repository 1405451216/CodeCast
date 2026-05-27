import { AgentTool, ToolCategory, ToolContext, ToolPermission, ToolResult } from '../types';

const runCommand: AgentTool = {
  id: 'run_command',
  name: '执行命令',
  description: '在终端中执行 Shell 命令并返回输出结果，支持 PowerShell 和 Bash 命令',
  category: ToolCategory.TERMINAL,
  permission: ToolPermission.EXECUTE,
  requiresPermission: false,
  tags: ['terminal', 'command', 'shell', 'execute'],
  version: '1.0.0',

  parameters: [
    {
      name: 'command',
      type: 'string',
      description: '要执行的 Shell 命令字符串',
      required: true
    },
    {
      name: 'cwd',
      type: 'string',
      description: '命令执行的工作目录，默认为项目根目录',
      required: false
    },
    {
      name: 'timeout',
      type: 'number',
      description: '命令超时时间（毫秒），默认为 30000ms (30秒)',
      required: false,
      default: 30000
    },
    {
      name: 'env',
      type: 'object',
      description: '额外的环境变量',
      required: false,
      properties: {}
    }
  ],

  examples: [
    {
      params: { command: 'npm run build' },
      description: '运行项目构建脚本'
    },
    {
      params: { command: 'git status --short' },
      description: '查看 Git 工作区状态'
    },
    {
      params: { command: 'ls -la', cwd: './src' },
      description: '列出 src 目录的详细内容'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      if (!context.terminalRef?.executeCommand) {
        return {
          success: false,
          error: '终端接口不可用，无法执行命令',
          metadata: { missingInterface: 'terminalRef.executeCommand' }
        };
      }

      context.logger?.info(`[TerminalTool] Executing command: ${params.command}`);

      const result = await Promise.race([
        context.terminalRef.executeCommand(params.command),
        new Promise<{ output: string; exitCode: number }>((_, reject) =>
          setTimeout(() => reject(new Error('Command execution timeout')), params.timeout || 30000)
        )
      ]);

      const duration = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        data: result.output,
        output: `命令执行完成 (退出码: ${result.exitCode}, 耗时: ${duration}ms)`,
        metadata: {
          command: params.command,
          exitCode: result.exitCode,
          executionTime: duration,
          workingDirectory: params.cwd
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `命令执行失败: ${message}`,
        metadata: { originalError: message, command: params.command }
      };
    }
  }
};

const checkCommandExists: AgentTool = {
  id: 'check_command_exists',
  name: '检查命令是否存在',
  description: '检查指定的命令或程序是否在系统 PATH 中可用',
  category: ToolCategory.TERMINAL,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['terminal', 'check', 'system'],
  version: '1.0.0',

  parameters: [
    {
      name: 'command',
      type: 'string',
      description: '要检查的命令名称（如 node, git, python, docker）',
      required: true
    }
  ],

  examples: [
    {
      params: { command: 'node' },
      description: '检查 Node.js 是否已安装'
    },
    {
      params: { command: 'docker' },
      description: '检查 Docker 是否可用'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (!context.terminalRef?.executeCommand) {
        return {
          success: false,
          error: '终端接口不可用',
          metadata: { missingInterface: 'terminalRef.executeCommand' }
        };
      }

      const command = `Get-Command ${params.command} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source`;
      const result = await context.terminalRef.executeCommand(command);

      const exists = result.exitCode === 0 && result.output.trim().length > 0;

      let versionInfo = '';
      if (exists) {
        try {
          const versionResult = await context.terminalRef.executeCommand(`${params.command} --version`);
          versionInfo = versionResult.output.split('\n')[0].trim();
        } catch {
          versionInfo = '(无法获取版本信息)';
        }
      }

      return {
        success: true,
        data: {
          command: params.command,
          exists,
          path: exists ? result.output.trim() : null,
          version: versionInfo
        },
        output: exists
          ? `命令 "${params.command}" 存在于: ${result.output.trim()}`
          : `命令 "${params.command}" 未找到`,
        metadata: { command: params.command, exists }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `检查命令失败: ${message}`,
        metadata: { originalError: message, command: params.command }
      };
    }
  }
};

export const terminalTools: AgentTool[] = [runCommand, checkCommandExists];

export default terminalTools;
