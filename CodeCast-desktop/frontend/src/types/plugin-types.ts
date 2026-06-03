import type { AgentTool } from '../tools/types';

export type CastToolCategory = 'analysis' | 'meeting' | 'management' | 'utility' | 'creative' | 'communication' | 'productivity' | 'custom';

export type Permission = 'none' | 'read' | 'write' | 'execute' | 'network' | 'filesystem';

export interface UISchema {
  type: 'text' | 'textarea' | 'number' | 'select' | 'toggle' | 'json' | 'file' | 'color' | 'slider';
  name: string;
  label: string;
  description?: string;
  defaultValue?: unknown;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  validation?: RegExp | ((value: unknown) => boolean | string);
}

export interface ICastTool {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: CastToolCategory;
  icon: string;
  color: string;
  tags: string[];

  execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;

  uiSchema?: UISchema[];
  streaming?: boolean;
  permissions?: Permission[];
  dependencies?: string[];

  metadata?: {
    homepage?: string;
    repository?: string;
    license?: string;
    minVersion?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface ToolContext {
  sessionId?: string;
  userId?: string;
  workspacePath?: string;
  signal?: AbortSignal;
  sendMessage?: (message: string) => void;
  tools?: Map<string, ICastTool>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  streaming?: boolean;
}

export interface CastPluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  entry: string;
  tools: ICastTool[];
  permissions: Permission[];
  dependencies?: string[];
  castMinVersion?: string;
  keywords?: string[];
}

export interface PluginLoadResult {
  plugin: CastPluginManifest;
  tools: ICastTool[];
  errors: string[];
  loadTime: number;
}

export interface CastToolRegistryState {
  tools: Map<string, ICastTool>;
  plugins: Map<string, CastPluginManifest>;
  categories: Map<CastToolCategory, string[]>;

  register(tool: ICastTool): boolean;
  unregister(toolId: string): boolean;
  get(toolId: string): ICastTool | undefined;
  getByCategory(category: CastToolCategory): ICastTool[];
  getAll(): ICastTool[];
  search(query: string): ICastTool[];
  count(): number;
  has(toolId: string): boolean;
  clear(): void;

  loadPlugin(manifest: CastPluginManifest): PluginLoadResult;
  unloadPlugin(pluginName: string): boolean;
  getPlugins(): CastPluginManifest[];
  getPluginTools(pluginName: string): ICastTool[];
}
