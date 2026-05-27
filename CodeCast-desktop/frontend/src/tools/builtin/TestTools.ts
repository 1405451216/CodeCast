import { AgentTool, ToolCategory, ToolContext, ToolPermission, ToolResult } from '../types';

interface TestResultSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures?: Array<{ name: string; error: string }>;
}

function parseTestOutput(output: string): TestResultSummary {
  const summary: TestResultSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  };

  const jestMatch = output.match(/Tests:\s*(\d+)\s*failed,\s*(\d+)\s*passed,\s*(\d+)\s*total/i);
  if (jestMatch) {
    summary.failed = parseInt(jestMatch[1], 10);
    summary.passed = parseInt(jestMatch[2], 10);
    summary.total = parseInt(jestMatch[3], 10);
  }

  const vitestMatch = output.match(/(\d+)\s*test\s*\((\d+)\s*failed/i);
  if (vitestMatch) {
    summary.total = parseInt(vitestMatch[1], 10);
    summary.failed = parseInt(vitestMatch[2], 10);
    summary.passed = summary.total - summary.failed;
  }

  const timeMatch = output.match(/Time:\s*([\d.]+)\s*s/i);
  if (timeMatch) {
    summary.duration = parseFloat(timeMatch[1]) * 1000;
  }

  return summary;
}

const runTests: AgentTool = {
  id: 'run_tests',
  name: '运行测试',
  description: '执行项目的测试套件并解析测试结果，支持 Jest、Vitest、Mocha 等主流测试框架',
  category: ToolCategory.TEST,
  permission: ToolPermission.EXECUTE,
  requiresPermission: false,
  tags: ['test', 'testing', 'quality'],
  version: '1.0.0',

  parameters: [
    {
      name: 'test_pattern',
      type: 'string',
      description: '要运行的测试文件模式或路径（如 **/*.test.ts, src/utils/__tests__/*）',
      required: false
    },
    {
      name: 'framework',
      type: 'string',
      description: '测试框架类型',
      required: false,
      default: 'auto',
      enum: ['auto', 'jest', 'vitest', 'mocha', 'pytest']
    },
    {
      name: 'watch',
      type: 'boolean',
      description: '是否以 watch 模式运行测试（持续监听文件变化）',
      required: false,
      default: false
    },
    {
      name: 'coverage',
      type: 'boolean',
      description: '是否生成代码覆盖率报告',
      required: false,
      default: false
    },
    {
      name: 'verbose',
      type: 'boolean',
      description: '是否显示详细的测试输出',
      required: false,
      default: true
    }
  ],

  examples: [
    {
      params: {},
      description: '运行所有默认测试'
    },
    {
      params: { test_pattern: '**/*.unit.test.ts', coverage: true },
      description: '运行单元测试并生成覆盖率报告'
    },
    {
      params: { framework: 'vitest', test_pattern: 'src/utils/**/*.test.ts' },
      description: '使用 Vitest 运行 utils 目录的测试'
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

      switch (params.framework) {
        case 'vitest':
          command = 'npx vitest run';
          break;
        case 'mocha':
          command = 'npx mocha';
          break;
        case 'pytest':
          command = 'python -m pytest';
          break;
        case 'jest':
        default:
          command = 'npx jest --no-cache';
          break;
      }

      if (params.test_pattern) {
        command += ` ${params.test_pattern}`;
      }

      if (params.coverage) {
        command += ' --coverage';
      }

      if (params.verbose && params.framework !== 'mocha') {
        command += ' --verbose';
      }

      if (params.watch) {
        command = command.replace(' run', '');
      }

      context.logger?.info(`[TestTool] Running tests with command: ${command}`);

      const result = await context.terminalRef.executeCommand(command);

      const parsedResults = parseTestOutput(result.output);

      return {
        success: parsedResults.failed === 0,
        data: {
          rawOutput: result.output,
          parsed: parsedResults,
          exitCode: result.exitCode,
          framework: params.framework || 'auto'
        },
        output: parsedResults.total > 0
          ? `测试完成: ${parsedResults.passed}/${parsedResults.total} 通过, ${parsedResults.failed} 失败, ${parsedResults.skipped} 跳过`
          : '未找到可执行的测试或输出无法解析',
        metadata: {
          ...parsedResults,
          testPattern: params.test_pattern,
          framework: params.framework || 'auto'
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `运行测试失败: ${message}`,
        metadata: { originalError: message }
      };
    }
  }
};

const lintCode: AgentTool = {
  id: 'lint_code',
  name: '代码检查',
  description: '运行 Linter 检查代码质量和风格问题，支持 ESLint、Prettier、TSLint 等',
  category: ToolCategory.TEST,
  permission: ToolPermission.READ,
  requiresPermission: false,
  tags: ['lint', 'code-quality', 'style'],
  version: '1.0.0',

  parameters: [
    {
      name: 'target',
      type: 'string',
      description: '要检查的文件或目录路径（如 ./src, **/*.ts）',
      required: false,
      default: './src'
    },
    {
      name: 'linter',
      type: 'string',
      description: 'Linter 工具类型',
      required: false,
      default: 'auto',
      enum: ['auto', 'eslint', 'prettier', 'tsc', 'ruff', 'flake8']
    },
    {
      name: 'fix',
      type: 'boolean',
      description: '是否自动修复可以修复的问题',
      required: false,
      default: false
    },
    {
      name: 'rules',
      type: 'array',
      description: '只检查指定的规则列表',
      required: false,
      items: { name: 'rule', type: 'string', description: '规则名称' }
    }
  ],

  examples: [
    {
      params: { target: './src', linter: 'eslint' },
      description: '使用 ESLint 检查 src 目录'
    },
    {
      params: { linter: 'prettier', fix: true },
      description: '使用 Prettier 格式化并自动修复'
    },
    {
      params: { linter: 'tsc' },
      description: '运行 TypeScript 类型检查'
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

      switch (params.linter) {
        case 'eslint':
          command = params.fix ? 'npx eslint --fix' : 'npx eslint';
          break;
        case 'prettier':
          command = params.fix ? 'npx prettier --write' : 'npx prettier --check';
          break;
        case 'tsc':
          command = 'npx tsc --noEmit';
          break;
        case 'ruff':
          command = params.fix ? 'ruff check --fix' : 'ruff check';
          break;
        case 'flake8':
          command = 'flake8';
          break;
        default:
          command = 'npx eslint';
      }

      if (params.target) {
        command += ` ${params.target}`;
      }

      if (params.rules?.length) {
        command += ` --rule '${params.rules.join(',')}'`;
      }

      context.logger?.info(`[LintTool] Running linter: ${command}`);

      const result = await context.terminalRef.executeCommand(command);

      const hasErrors = result.exitCode !== 0;
      const lines = result.output.split('\n').filter(l => l.trim());

      return {
        success: !hasErrors,
        data: {
          rawOutput: result.output,
          issueCount: hasErrors ? lines.length : 0,
          issues: hasErrors ? lines.slice(0, 50) : [],
          linter: params.linter || 'auto'
        },
        output: hasErrors
          ? `发现 ${lines.length} 个问题`
          : '代码检查通过，没有发现问题',
        metadata: {
          target: params.target,
          linter: params.linter || 'auto',
          autoFix: params.fix,
          exitCode: result.exitCode
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `代码检查失败: ${message}`,
        metadata: { originalError: message }
      };
    }
  }
};

export const testTools: AgentTool[] = [runTests, lintCode];

export default testTools;
