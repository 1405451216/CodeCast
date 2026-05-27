export enum ToolPermission {
  NONE = 'none',
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DANGEROUS = 'dangerous'
}

export enum ToolCategory {
  FILE = 'file',
  TERMINAL = 'terminal',
  GIT = 'git',
  TEST = 'test',
  WEB = 'web',
  INTERACTION = 'interaction',
  CUSTOM = 'custom'
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: any;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  permission: ToolPermission;
  requiresPermission: boolean;
  execute: (params: Record<string, any>, context: ToolContext) => Promise<ToolResult>;
  examples?: Array<{ params: Record<string, any>; description: string }>;
  tags?: string[];
  version?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  output?: string;
  metadata?: Record<string, any>;
  executionTime?: number;
}

export interface ToolContext {
  terminalRef?: {
    executeCommand: (command: string) => Promise<{ output: string; exitCode: number }>;
    writeInput: (text: string) => void;
    onOutput: (callback: (line: string) => void) => () => void;
  };
  api?: {
    get: <T>(url: string, options?: RequestInit) => Promise<T>;
    post: <T>(url: string, data: any, options?: RequestInit) => Promise<T>;
    fetch: (url: string, options?: RequestInit) => Promise<Response>;
  };
  projectPath?: string;
  sessionId?: string;
  userId?: string;
  signal?: AbortSignal;
  logger?: {
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
  };
  ui?: {
    showMessage: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
    showConfirmation: (message: string, options?: { title?: string }) => Promise<boolean>;
    askUser: (question: string, options?: { placeholder?: string; defaultValue?: string }) => Promise<string>;
  };
  fileSystem?: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    deleteFile: (path: string) => Promise<void>;
    listDirectory: (path: string) => Promise<Array<{ name: string; path: string; isDirectory: boolean; size?: number }>>;
    exists: (path: string) => Promise<boolean>;
  };
}

export interface ToolExecutionLog {
  toolId: string;
  toolName: string;
  params: Record<string, any>;
  result: ToolResult;
  timestamp: number;
  duration: number;
  success: boolean;
  sessionId?: string;
  userId?: string;
}

export interface ToolSchemaForLLM {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface ToolStatistics {
  totalTools: number;
  byCategory: Partial<Record<ToolCategory, number>>;
  byPermission: Partial<Record<ToolPermission, number>>;
  requiresPermissionCount: number;
  deprecatedCount: number;
}
