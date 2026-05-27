import { AgentTool, ToolCategory, ToolContext, ToolPermission, ToolResult } from '../types';

const gitStatus: AgentTool = {
  id: 'git_status',
  name: 'Git 状态',
  description: '查看 Git 仓库的工作区状态，包括已修改、已暂存和未跟踪的文件',
  category: ToolCategory.GIT,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['git', 'status', 'version-control'],
  version: '1.0.0',

  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Git 仓库路径，默认为当前目录',
      required: false,
      default: '.'
    },
    {
      name: 'verbose',
      type: 'boolean',
      description: '是否显示详细信息（包含 staged 和 unstaged 的详细差异）',
      required: false,
      default: false
    }
  ],

  examples: [
    {
      params: {},
      description: '查看当前 Git 仓库状态'
    },
    {
      params: { verbose: true },
      description: '查看详细的 Git 状态信息'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (!context.terminalRef?.executeCommand) {
        return {
          success: false,
          error: '终端接口不可用',
          metadata: {}
        };
      }

      const statusCommand = params.verbose
        ? `git -C "${params.path || '.'}" status`
        : `git -C "${params.path || '.'}" status --short`;

      const result = await context.terminalRef.executeCommand(statusCommand);

      if (result.exitCode !== 0 && !result.output.includes('Not a git repository')) {
        return {
          success: false,
          error: `获取 Git 状态失败: ${result.output}`,
          metadata: { exitCode: result.exitCode }
        };
      }

      const lines = result.output.split('\n').filter(line => line.trim());
      const isGitRepo = !result.output.includes('Not a git repository');

      let parsedStatus = null;
      if (isGitRepo && params.verbose) {
        const branchMatch = result.output.match(/On branch (\S+)/);
        const branch = branchMatch ? branchMatch[1] : 'unknown';

        const staged = lines.filter(l => l.startsWith('  (')).length;
        const modified = lines.filter(l => l.includes('modified:')).length;
        const deleted = lines.filter(l => l.includes('deleted:')).length;
        const untracked = lines.filter(l => l.startsWith('\tUntracked')).length;

        parsedStatus = { branch, staged, modified, deleted, untracked, totalChanges: staged + modified + deleted + untracked };
      }

      return {
        success: true,
        data: {
          rawOutput: result.output,
          isGitRepo,
          parsedStatus,
          fileCount: lines.length
        },
        output: isGitRepo
          ? `Git 状态: ${lines.length} 个文件有变更`
          : '当前目录不是 Git 仓库',
        metadata: { path: params.path || '.', isGitRepo }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Git 状态查询失败: ${message}`,
        metadata: { originalError: message }
      };
    }
  }
};

const gitCommit: AgentTool = {
  id: 'git_commit',
  name: 'Git 提交',
  description: '将暂存区的更改提交到 Git 仓库，支持自动添加所有更改后提交',
  category: ToolCategory.GIT,
  permission: ToolPermission.WRITE,
  requiresPermission: true,
  tags: ['git', 'commit', 'version-control'],
  version: '1.0.0',

  parameters: [
    {
      name: 'message',
      type: 'string',
      description: '提交消息，描述本次更改的内容',
      required: true
    },
    {
      name: 'add_all',
      type: 'boolean',
      description: '是否在提交前自动执行 git add . 添加所有更改',
      required: false,
      default: false
    },
    {
      name: 'files',
      type: 'array',
      description: '要提交的特定文件列表（不指定则提交所有暂存的更改）',
      required: false,
      items: { name: 'file', type: 'string', description: '文件路径' }
    },
    {
      name: 'amend',
      type: 'boolean',
      description: '是否修改上一次提交（amend）',
      required: false,
      default: false
    }
  ],

  examples: [
    {
      params: { message: 'feat: add new user authentication module' },
      description: '提交暂存区的更改'
    },
    {
      params: { message: 'fix: resolve login bug', add_all: true },
      description: '自动添加所有更改并提交'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (!context.terminalRef?.executeCommand) {
        return {
          success: false,
          error: '终端接口不可用',
          metadata: {}
        };
      }

      let commands: string[] = [];

      if (params.add_all) {
        commands.push('git add .');
      } else if (params.files?.length) {
        commands.push(`git add ${params.files.join(' ')}`);
      }

      const amendFlag = params.amend ? '--amend' : '';
      commands.push(`git commit ${amendFlag} -m "${params.message.replace(/"/g, '\\"')}"`);

      const results = [];
      for (const cmd of commands) {
        const result = await context.terminalRef.executeCommand(cmd);
        results.push({ command: cmd, ...result });
      }

      const lastResult = results[results.length - 1];
      const success = lastResult.exitCode === 0;

      return {
        success,
        data: {
          commitMessage: params.message,
          results,
          amend: params.amend
        },
        output: success
          ? `成功提交: ${params.message}`
          : `提交失败: ${lastResult.output}`,
        metadata: { exitCode: lastResult.exitCode }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Git 提交失败: ${message}`,
        metadata: { originalError: message }
      };
    }
  }
};

const gitBranch: AgentTool = {
  id: 'git_branch',
  name: 'Git 分支管理',
  description: '查看、创建、切换或删除 Git 分支',
  category: ToolCategory.GIT,
  permission: ToolPermission.WRITE,
  requiresPermission: false,
  tags: ['git', 'branch', 'version-control'],
  version: '1.0.0',

  parameters: [
    {
      name: 'action',
      type: 'string',
      description: '分支操作类型',
      required: false,
      default: 'list',
      enum: ['list', 'create', 'switch', 'delete', 'current']
    },
    {
      name: 'name',
      type: 'string',
      description: '分支名称（用于 create/switch/delete 操作）',
      required: false
    },
    {
      name: 'base_branch',
      type: 'string',
      description: '创建新分支时的基础分支（默认为当前分支）',
      required: false
    },
    {
      name: 'force',
      type: 'boolean',
      description: '强制删除未合并的分支',
      required: false,
      default: false
    }
  ],

  examples: [
    {
      params: { action: 'list' },
      description: '列出所有本地分支'
    },
    {
      params: { action: 'create', name: 'feature/new-feature' },
      description: '创建新分支 feature/new-feature'
    },
    {
      params: { action: 'switch', name: 'develop' },
      description: '切换到 develop 分支'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (!context.terminalRef?.executeCommand) {
        return {
          success: false,
          error: '终端接口不可用',
          metadata: {}
        };
      }

      let command: string;

      switch (params.action) {
        case 'list':
          command = 'git branch --list -v';
          break;
        case 'current':
          command = 'git rev-parse --abbrev-ref HEAD';
          break;
        case 'create':
          command = params.base_branch
            ? `git checkout -b ${params.name} ${params.base_branch}`
            : `git checkout -b ${params.name}`;
          break;
        case 'switch':
          command = `git checkout ${params.name}`;
          break;
        case 'delete':
          command = params.force
            ? `git branch -D ${params.name}`
            : `git branch -d ${params.name}`;
          break;
        default:
          command = 'git branch --list -v';
      }

      const result = await context.terminalRef.executeCommand(command);

      return {
        success: result.exitCode === 0,
        data: {
          action: params.action,
          output: result.output,
          branchName: params.name
        },
        output: result.exitCode === 0
          ? `分支操作完成: ${params.action}${params.name ? ` (${params.name})` : ''}`
          : `操作失败: ${result.output}`,
        metadata: { action: params.action, exitCode: result.exitCode }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Git 分支操作失败: ${message}`,
        metadata: { originalError: message, action: params.action }
      };
    }
  }
};

const gitDiff: AgentTool = {
  id: 'git_diff',
  name: 'Git 差异查看',
  description: '查看文件在工作区与暂存区、或暂存区与最新提交之间的差异',
  category: ToolCategory.GIT,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['git', 'diff', 'version-control'],
  version: '1.0.0',

  parameters: [
    {
      name: 'file_path',
      type: 'string',
      description: '要查看差异的特定文件路径（可选，不指定则显示所有变更）',
      required: false
    },
    {
      name: 'staged',
      type: 'boolean',
      description: '是否查看已暂存的变更（--staged）',
      required: false,
      default: false
    },
    {
      name: 'stat',
      type: 'boolean',
      description: '仅显示统计摘要而不显示完整差异',
      required: false,
      default: false
    },
    {
      name: 'commit_range',
      type: 'string',
      description: '比较两个提交之间的差异（如 HEAD~3..HEAD）',
      required: false
    }
  ],

  examples: [
    {
      params: {},
      description: '查看工作区所有未暂存的变更'
    },
    {
      params: { file_path: './src/App.tsx', staged: true },
      description: '查看 App.tsx 已暂存的变更'
    },
    {
      params: { stat: true },
      description: '查看变更统计摘要'
    }
  ],

  async execute(params, context): Promise<ToolResult> {
    try {
      if (!context.terminalRef?.executeCommand) {
        return {
          success: false,
          error: '终端接口不可用',
          metadata: {}
        };
      }

      let command = 'git diff';

      if (params.staged) {
        command += ' --staged';
      }

      if (params.stat) {
        command += ' --stat';
      }

      if (params.commit_range) {
        command = `git diff ${params.commit_range}`;
      }

      if (params.file_path) {
        command += ` -- "${params.file_path}"`;
      }

      const result = await context.terminalRef.executeCommand(command);

      const hasDiff = result.output.trim().length > 0;

      return {
        success: true,
        data: {
          diffOutput: result.output,
          hasChanges: hasDiff,
          filePath: params.file_path,
          isStaged: params.staged
        },
        output: hasDiff
          ? `发现${params.stat ? '统计' : ''}差异内容`
          : '没有发现差异',
        metadata: {
          filePath: params.file_path,
          staged: params.staged,
          stat: params.stat,
          outputSize: result.output.length
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Git Diff 失败: ${message}`,
        metadata: { originalError: message }
      };
    }
  }
};

export const gitTools: AgentTool[] = [gitStatus, gitCommit, gitBranch, gitDiff];

export default gitTools;
