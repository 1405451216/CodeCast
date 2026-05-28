export type SandboxSecurityLevel = 'sandboxed' | 'restricted' | 'full_access';

export interface SandboxPolicy {
  level: SandboxSecurityLevel;
  allowNetwork: boolean;
  allowFileRead: boolean;
  allowFileWrite: boolean;
  allowExecute: boolean;
  allowedDomains: string[];
  allowedPaths: string[];
  maxExecutionTime: number;
  maxMemoryMB: number;
  maxOutputSize: number;
  allowEnvAccess: boolean;
  allowClipboard: boolean;
}

export interface SandboxExecutionResult {
  success: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
  executionTime: number;
  memoryUsed?: number;
  timedOut: boolean;
  killed: boolean;
  error?: string;
  warnings?: string[];
}

export interface SandboxedScript {
  id: string;
  name: string;
  language: 'javascript' | 'python' | 'shell' | 'sql' | 'custom';
  code: string;
  permissions: Array<'read' | 'write' | 'execute' | 'network' | 'filesystem' | 'clipboard'>;
  author?: string;
  source?: string;
  createdAt: number;
  lastExecutedAt?: number;
  executionCount: number;
}

export interface ExecutionLog {
  id: string;
  scriptId: string;
  scriptName: string;
  result: SandboxExecutionResult;
  policy: SandboxPolicy;
  timestamp: number;
  triggeredBy: 'user' | 'plugin' | 'scheduler' | 'agent';
}

export interface DangerousPattern {
  type: string;
  line: number;
  severity: 'warning' | 'danger';
  description: string;
}

const DEFAULT_POLICY: SandboxPolicy = {
  level: 'restricted',
  allowNetwork: true,
  allowFileRead: true,
  allowFileWrite: false,
  allowExecute: false,
  allowedDomains: ['github.com', 'npmjs.com', 'cdn.jsdelivr.net'],
  allowedPaths: [],
  maxExecutionTime: 30000,
  maxMemoryMB: 128,
  maxOutputSize: 1048576,
  allowEnvAccess: false,
  allowClipboard: true
};

class CastSandbox {
  private defaultPolicy: SandboxPolicy;
  private activeExecutions: Map<string, AbortController>;
  private executionLogs: ExecutionLog[];
  private bufferedOutput: string;
  private bufferedError: string;
  private warnings: string[];

  constructor(defaultPolicy?: Partial<SandboxPolicy>) {
    this.defaultPolicy = { ...DEFAULT_POLICY, ...defaultPolicy };
    this.activeExecutions = new Map();
    this.executionLogs = [];
    this.bufferedOutput = '';
    this.bufferedError = '';
    this.warnings = [];
  }

  getDefaultPolicy(): SandboxPolicy {
    return { ...this.defaultPolicy };
  }

  updateDefaultPolicy(updates: Partial<SandboxPolicy>): void {
    this.defaultPolicy = { ...this.defaultPolicy, ...updates };
  }

  createCustomPolicy(overrides: Partial<SandboxPolicy>): SandboxPolicy {
    return { ...this.defaultPolicy, ...overrides };
  }

  validatePolicy(policy: SandboxPolicy): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!['sandboxed', 'restricted', 'full_access'].includes(policy.level)) {
      errors.push('Invalid security level');
    }
    if (policy.maxExecutionTime < 1000 || policy.maxExecutionTime > 300000) {
      errors.push('maxExecutionTime must be between 1000ms and 300000ms');
    }
    if (policy.maxMemoryMB < 16 || policy.maxMemoryMB > 2048) {
      errors.push('maxMemoryMB must be between 16 and 2048');
    }
    if (policy.maxOutputSize < 1024 || policy.maxOutputSize > 10485760) {
      errors.push('maxOutputSize must be between 1KB and 10MB');
    }

    return { valid: errors.length === 0, errors };
  }

  async executeJavaScript(
    code: string,
    options: {
      timeout?: number;
      context?: Record<string, unknown>;
      policy?: SandboxPolicy;
    } = {}
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const execId = this.registerExecution(controller);
    const policy = options.policy || this.defaultPolicy;

    this.bufferedOutput = '';
    this.bufferedError = '';
    this.warnings = [];

    try {
      const dangers = this.detectDangerousPatterns(code);
      const dangerWarnings = dangers.filter(d => d.severity === 'warning');
      const dangerErrors = dangers.filter(d => d.severity === 'danger');

      if (dangerWarnings.length > 0) {
        this.warnings = dangerWarnings.map(d => `[${d.type}] ${d.description} (line ${d.line})`);
      }

      if (dangerErrors.length > 0) {
        return {
          success: false,
          stdout: '',
          stderr: `安全拦截: 发现危险代码模式:\n${dangerErrors.map(d => `- ${d.type}: ${d.description} (line ${d.line})`).join('\n')}`,
          executionTime: Date.now() - startTime,
          timedOut: false,
          killed: false,
          error: 'Dangerous code patterns detected',
          warnings: this.warnings.length > 0 ? this.warnings : undefined
        };
      }

      const safeConsole = {
        log: (...args: unknown[]) => {
          this.bufferedOutput += args.map(a => {
            try {
              return typeof a === 'object' ? JSON.stringify(a) : String(a);
            } catch {
              return String(a);
            }
          }).join(' ') + '\n';
        },
        warn: (...args: unknown[]) => {
          this.warnings.push(args.map(String).join(' '));
        },
        error: (...args: unknown[]) => {
          this.bufferedError += args.map(a => {
            try {
              return typeof a === 'object' ? JSON.stringify(a) : String(a);
            } catch {
              return String(a);
            }
          }).join(' ') + '\n';
        },
        info: (...args: unknown[]) => {
          this.bufferedOutput += args.map(a => {
            try {
              return typeof a === 'object' ? JSON.stringify(a) : String(a);
            } catch {
              return String(a);
            }
          }).join(' ') + '\n';
        }
      };

      const sandboxGlobals: Record<string, unknown> = {
        console: safeConsole,
        Math,
        Date,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        Array,
        String,
        Number,
        Boolean,
        Object: {
          keys: Object.keys,
          values: Object.values,
          entries: Object.entries,
          assign: Object.assign,
          fromEntries: Object.fromEntries,
          create: Object.create,
          defineProperty: Object.defineProperty,
          getOwnPropertyNames: Object.getOwnPropertyNames,
          is: Object.is
        },
        Map,
        Set,
        RegExp,
        Error,
        TypeError,
        RangeError,
        SyntaxError,
        ReferenceError,
        atob,
        btoa,
        TextEncoder,
        TextDecoder,
        Intl,
        setTimeout: (fn: () => void, ms: number) => {
          const maxTimeout = Math.min(ms || 0, 10000);
          if (maxTimeout > (options.timeout || policy.maxExecutionTime)) {
            throw new Error(`Timeout too large: requested ${ms}ms, max ${(options.timeout || policy.maxExecutionTime)}ms`);
          }
          return setTimeout(fn, maxTimeout);
        },
        clearTimeout,
        setInterval: (_fn: () => void, ms: number) => {
          const intervalMs = Math.min(ms || 0, 5000);
          if (intervalMs > 5000) throw new Error('setInterval limited to 5000ms in sandbox');
          console.warn('[Sandbox] setInterval used with limited interval');
          return null;
        },
        clearInterval,
        Promise,
        Symbol,
        Proxy,
        Reflect,
        __options_context: options.context || {},
        __result: undefined as unknown
      };

      const globalKeys = Object.keys(sandboxGlobals);

      let fn: (...args: unknown[]) => unknown;
      try {
        const dynamicFn = new Function(
          ...globalKeys,
          `"use strict";\n${code}`
        );
        fn = dynamicFn as (...args: unknown[]) => unknown;
      } catch (syntaxError: any) {
        return {
          success: false,
          stdout: '',
          stderr: `语法错误: ${syntaxError.message}`,
          executionTime: Date.now() - startTime,
          timedOut: false,
          killed: false,
          error: syntaxError.message,
          warnings: this.warnings.length > 0 ? this.warnings : undefined
        };
      }

      const timeoutMs = options.timeout || policy.maxExecutionTime;

      const result = await Promise.race([
        Promise.resolve().then(() => fn(...Object.values(sandboxGlobals))),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), timeoutMs)
        )
      ]);

      return {
        success: true,
        stdout: this.sanitizeOutput(this.bufferedOutput, policy.maxOutputSize),
        stderr: this.sanitizeOutput(this.bufferedError, policy.maxOutputSize),
        executionTime: Date.now() - startTime,
        timedOut: false,
        killed: false,
        warnings: this.warnings.length > 0 ? this.warnings : undefined
      };
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      return {
        success: false,
        stdout: this.sanitizeOutput(this.bufferedOutput, policy.maxOutputSize),
        stderr: this.sanitizeOutput(this.bufferedError || errorMessage, policy.maxOutputSize),
        executionTime: Date.now() - startTime,
        timedOut: errorMessage.includes('timeout') || errorMessage.includes('Timeout'),
        killed: controller.signal.aborted,
        error: errorMessage,
        warnings: this.warnings.length > 0 ? this.warnings : undefined
      };
    } finally {
      this.deregisterExecution(execId);
    }
  }

  async executeShell(
    command: string,
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      policy?: SandboxPolicy;
    } = {}
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const policy = options.policy || this.defaultPolicy;

    if (!policy.allowExecute) {
      return {
        success: false,
        stdout: '',
        stderr: 'Shell 执行被当前安全策略禁止',
        executionTime: Date.now() - startTime,
        timedOut: false,
        killed: false,
        error: 'Shell execution not allowed by current policy'
      };
    }

    const wails = ((window as unknown as Record<string, Record<string, Record<string, unknown>>>)?.go?.main)?.App;
    if (wails && typeof (wails as Record<string, unknown>).ExecuteCommand === 'function') {
      try {
        const controller = new AbortController();
        const execId = this.registerExecution(controller);
        const timeoutMs = options.timeout || policy.maxExecutionTime;
        const wailsObj = wails as Record<string, unknown>;

        const result = await Promise.race([
          (wailsObj.ExecuteCommand as (cmd: string, opts?: Record<string, unknown>) => Promise<Record<string, unknown>>)(
            command,
            { cwd: options.cwd, env: options.env }
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => {
              controller.abort();
              reject(new Error('Shell execution timeout'));
            }, timeoutMs)
          )
        ]) as Record<string, unknown>;

        this.deregisterExecution(execId);

        return {
          success: (result.success as boolean) ?? true,
          exitCode: result.exitCode as number,
          stdout: this.sanitizeOutput((result.stdout as string) || '', policy.maxOutputSize),
          stderr: this.sanitizeOutput((result.stderr as string) || '', policy.maxOutputSize),
          executionTime: Date.now() - startTime,
          timedOut: false,
          killed: false
        };
      } catch (error: any) {
        return {
          success: false,
          stdout: '',
          stderr: error.message || 'Shell execution failed',
          executionTime: Date.now() - startTime,
          timedOut: error.message?.includes('timeout'),
          killed: false,
          error: error.message
        };
      }
    }

    return {
      success: false,
      stdout: '',
      stderr: 'Shell 执行需要 Go 后端支持 (Wails v2)。当前环境不支持原生命令执行。',
      executionTime: Date.now() - startTime,
      timedOut: false,
      killed: false,
      error: 'Shell execution requires Go backend support'
    };
  }

  async executePython(
    code: string,
    options: {
      timeout?: number;
      policy?: SandboxPolicy;
    } = {}
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const policy = options.policy || this.defaultPolicy;

    if (!policy.allowExecute) {
      return {
        success: false,
        stdout: '',
        stderr: 'Python 执行被当前安全策略禁止',
        executionTime: Date.now() - startTime,
        timedOut: false,
        killed: false,
        error: 'Python execution not allowed by current policy'
      };
    }

    const wails = ((window as unknown as Record<string, Record<string, Record<string, unknown>>>)?.go?.main)?.App;
    if (wails && typeof (wails as Record<string, unknown>).ExecutePython === 'function') {
      try {
        const controller = new AbortController();
        const execId = this.registerExecution(controller);
        const timeoutMs = options.timeout || policy.maxExecutionTime;
        const wailsObj = wails as Record<string, unknown>;

        const result = await Promise.race([
          (wailsObj.ExecutePython as (code: string) => Promise<Record<string, unknown>>)(code),
          new Promise<never>((_, reject) =>
            setTimeout(() => {
              controller.abort();
              reject(new Error('Python execution timeout'));
            }, timeoutMs)
          )
        ]) as Record<string, unknown>;

        this.deregisterExecution(execId);

        return {
          success: (result.success as boolean) ?? true,
          exitCode: result.exitCode as number,
          stdout: this.sanitizeOutput((result.stdout as string) || '', policy.maxOutputSize),
          stderr: this.sanitizeOutput((result.stderr as string) || '', policy.maxOutputSize),
          executionTime: Date.now() - startTime,
          timedOut: false,
          killed: false
        };
      } catch (error: any) {
        return {
          success: false,
          stdout: '',
          stderr: error.message || 'Python execution failed',
          executionTime: Date.now() - startTime,
          timedOut: error.message?.includes('timeout'),
          killed: false,
          error: error.message
        };
      }
    }

    return {
      success: false,
      stdout: '',
      stderr: 'Python 执行需要 Go 后端支持 (Wails v2)。当前环境不支持 Python 解释器。',
      executionTime: Date.now() - startTime,
      timedOut: false,
      killed: false,
      error: 'Python execution requires Go backend support'
    };
  }

  async execute(
    script: SandboxedScript,
    options: {
      policy?: SandboxPolicy;
      context?: Record<string, unknown>;
    } = {}
  ): Promise<SandboxExecutionResult> {
    const policy = options.policy || this.defaultPolicy;
    const execId = this.generateExecutionId();

    switch (script.language) {
      case 'javascript':
        return this.executeJavaScript(script.code, {
          timeout: policy.maxExecutionTime,
          context: options.context,
          policy
        });

      case 'shell':
        return this.executeShell(script.code, {
          timeout: policy.maxExecutionTime,
          policy
        });

      case 'python':
        return this.executePython(script.code, {
          timeout: policy.maxExecutionTime,
          policy
        });

      case 'sql':
      case 'custom':
      default:
        return {
          success: false,
          stdout: '',
          stderr: `不支持的脚本语言: ${script.language}。支持的类型: javascript, python, shell`,
          executionTime: 0,
          timedOut: false,
          killed: false,
          error: `Unsupported language: ${script.language}`
        };
    }
  }

  cancelExecution(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (!controller) return false;

    controller.abort();
    this.activeExecutions.delete(executionId);
    return true;
  }

  cancelAllExecutions(): void {
    for (const [id, controller] of this.activeExecutions) {
      controller.abort();
    }
    this.activeExecutions.clear();
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  getExecutionLogs(limit?: number): ExecutionLog[] {
    if (limit && limit > 0) {
      return this.executionLogs.slice(-limit);
    }
    return [...this.executionLogs].reverse();
  }

  getExecutionLogsByScript(scriptId: string): ExecutionLog[] {
    return this.executionLogs.filter(log => log.scriptId === scriptId).reverse();
  }

  clearLogs(): void {
    this.executionLogs = [];
  }

  exportLogs(): string {
    return JSON.stringify({
      exportTime: new Date().toISOString(),
      totalLogs: this.executionLogs.length,
      logs: this.executionLogs
    }, null, 2);
  }

  addExecutionLog(log: ExecutionLog): void {
    this.executionLogs.push(log);
    if (this.executionLogs.length > 1000) {
      this.executionLogs = this.executionLogs.slice(-500);
    }
  }

  sanitizeOutput(output: string, maxSize?: number): string {
    const limit = maxSize || this.defaultPolicy.maxOutputSize;

    if (output.length <= limit) {
      return output;
    }

    const truncated = output.slice(0, limit);
    const overflowInfo = `\n\n[输出已截断: 原始大小 ${output.length} bytes, 显示前 ${limit} bytes]`;
    return truncated + overflowInfo;
  }

  detectDangerousPatterns(code: string): DangerousPattern[] {
    const patterns: DangerousPattern[] = [];
    const lines = code.split('\n');

    const dangerousRegexes: Array<{ pattern: RegExp; type: string; severity: 'warning' | 'danger'; description: string }> = [
      { pattern: /\bwhile\s*\(\s*true\s*\)/g, type: 'infinite_loop', severity: 'danger', description: '检测到可能的无限循环 (while(true))' },
      { pattern: /\bfor\s*\(;;\)/g, type: 'infinite_loop', severity: 'danger', description: '检测到可能的无限循环 (for(;;))' },
      { pattern: /eval\s*\(/g, type: 'eval_usage', severity: 'danger', description: '使用了 eval()，存在代码注入风险' },
      { pattern: /Function\s*\(/g, type: 'dynamic_function', severity: 'warning', description: '使用了 Function 构造器，可能存在动态代码执行风险' },
      { pattern: /new\s+Function\s*\(/g, type: 'dynamic_function', severity: 'danger', description: '使用了 new Function()，存在动态代码执行风险' },
      { pattern: /import\s*\(/g, type: 'dynamic_import', severity: 'warning', description: '使用了动态 import()' },
      { pattern: /require\s*\(/g, type: 'require_call', severity: 'danger', description: '使用了 require()，模块加载在沙箱中不可用' },
      { pattern: /process\b/g, type: 'process_access', severity: 'danger', description: '尝试访问 process 对象' },
      { pattern: /\bglobal(?:This)?\b/g, type: 'global_access', severity: 'danger', description: '尝试访问全局作用域' },
      { pattern: /\bwindow\b/g, type: 'window_access', severity: 'danger', description: '尝试访问 window 对象' },
      { pattern: /\bdocument\b/g, type: 'document_access', severity: 'danger', description: '尝试访问 document 对象' },
      { pattern: /\bfetch\s*\(/g, type: 'fetch_call', severity: 'warning', description: '使用了 fetch() API' },
      { pattern: /XMLHttpRequest/g, type: 'xhr_call', severity: 'warning', description: '使用了 XMLHttpRequest' },
      { pattern: /WebSocket/g, type: 'websocket', severity: 'warning', description: '使用了 WebSocket' },
      { pattern: /Worker\s*\(/g, type: 'web_worker', severity: 'warning', description: '使用了 Web Worker' },
      { pattern: /importScripts\s*\(/g, type: 'import_scripts', severity: 'danger', description: '使用了 importScripts()' },
      { pattern: /localStorage\b/g, type: 'local_storage', severity: 'warning', description: '尝试访问 localStorage' },
      { pattern: /sessionStorage\b/g, type: 'session_storage', severity: 'warning', description: '尝试访问 sessionStorage' },
      { pattern: /IndexedDB|indexedDB/g, type: 'indexed_db', severity: 'warning', description: '尝试访问 IndexedDB' },
      { pattern: /\b__proto__\b/g, type: 'proto_access', severity: 'danger', description: '尝试访问 __proto__' },
      { pattern: /\bconstructor\b/g, type: 'constructor_access', severity: 'warning', description: '尝试访问 constructor 属性' },
      { pattern: /new\s+Array\s*\(\s*(?:\d{5,}|0x[0-9a-fA-F]{4,})/g, type: 'large_allocation', severity: 'warning', description: '检测到大内存分配' },
      { pattern: /\.prototype\b/g, type: 'prototype_pollution', severity: 'warning', description: '原型操作，注意原型污染风险' }
    ];

    lines.forEach((line, index) => {
      for (const regex of dangerousRegexes) {
        if (regex.pattern.test(line)) {
          patterns.push({
            type: regex.type,
            line: index + 1,
            severity: regex.severity,
            description: regex.description
          });
        }
        regex.pattern.lastIndex = 0;
      }
    });

    return patterns;
  }

  generateSandboxContext(safeGlobals: Record<string, unknown>): string {
    const entries = Object.entries(safeGlobals).map(([key, value]) => {
      const typeStr = typeof value;
      let desc = '';

      if (typeStr === 'function') {
        desc = '[Function]';
      } else if (typeStr === 'object' && value !== null) {
        if (Array.isArray(value)) {
          desc = `[Array(${value.length})]`;
        } else {
          desc = '[Object]';
        }
      } else {
        desc = `[${typeStr}: ${String(value).slice(0, 50)}]`;
      }

      return `  ${key}: ${desc}`;
    });

    return `// Available sandbox globals:\n${entries.join('\n')}\n// Use these variables directly in your code.\n`;
  }

  private registerExecution(controller: AbortController): string {
    const id = this.generateExecutionId();
    this.activeExecutions.set(id, controller);
    return id;
  }

  private deregisterExecution(id: string): void {
    this.activeExecutions.delete(id);
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const castSandbox = new CastSandbox();

export const SANDBOX_POLICIES = {
  strict: {
    level: 'sandboxed' as const,
    allowNetwork: false,
    allowFileRead: false,
    allowFileWrite: false,
    allowExecute: false,
    allowedDomains: [] as string[],
    allowedPaths: [] as string[],
    maxExecutionTime: 10000,
    maxMemoryMB: 64,
    maxOutputSize: 512000,
    allowEnvAccess: false,
    allowClipboard: false
  },
  balanced: {
    level: 'restricted' as const,
    allowNetwork: true,
    allowFileRead: true,
    allowFileWrite: false,
    allowExecute: false,
    allowedDomains: ['github.com', 'npmjs.com', 'cdn.jsdelivr.net'],
    allowedPaths: [] as string[],
    maxExecutionTime: 30000,
    maxMemoryMB: 128,
    maxOutputSize: 1048576,
    allowEnvAccess: false,
    allowClipboard: true
  },
  permissive: {
    level: 'full_access' as const,
    allowNetwork: true,
    allowFileRead: true,
    allowFileWrite: true,
    allowExecute: true,
    allowedDomains: [] as string[],
    allowedPaths: [] as string[],
    maxExecutionTime: 60000,
    maxMemoryMB: 256,
    maxOutputSize: 5242880,
    allowEnvAccess: true,
    allowClipboard: true
  }
};
