// wails/types.ts — 与 Go 后端结构体 1:1 对齐的类型定义

export type Session = {
  id: string;
  name: string;
  createdAt: number;
  skillID: string;
  mode: string;
  messages: Message[];
};

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export type ToolCall = {
  id: string;
  name: string;
  args: string;
  result?: string;
};

export type ToolCatalogItem = {
  name: string;
  category: string;
  description: string;
};

export type CastInvocation = {
  id: string;
  toolName: string;
  category: string;
  args: string;
  result: string;
  isError: boolean;
  sessionId: string;
  durationMs: number;
};

export type APMetricsSnapshot = {
  llmTotalCalls: number;
  llmTotalErrors: number;
  toolTotalCalls: number;
  toolTotalErrors: number;
  totalTurns: number;
  totalEpisodes: number;
  activeAgents: number;
  poolQueueLength: number;
  memorySizeBytes: number;
  llmLatencyP50: number;
  llmLatencyP99: number;
  toolLatencyP50: number;
  toolLatencyP99: number;
  tokenUsageByModel: Record<string, { promptTokens: number; completionTokens: number; totalTokens: number }>;
};

export type ProviderPreset = {
  id: string;
  name: string;
  apiUrl: string;
  defaultModel: string;
  models: string[];
};

export type ModelConfigItem = {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  apiUrl: string;
  enabled: boolean;
  maxContext: number;
  toolRounds: number;
  multimodal: boolean;
};

export interface MCPStatusEntry {
  id: string;
  name: string;
  connected: boolean;
  error?: string;
}

export interface MCPConnectionResult {
  success: boolean;
  message?: string;
  tools?: string[];
}

export interface GitStatus {
  enabled: boolean;
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export type Skill = {
  id: string;
  name: string;
  description: string;
  prompt: string;
};

export type EnvVar = {
  key: string;
  value: string;
};

export type SlashCommand = {
  id: string;
  name: string;
  description: string;
  fillText: string;
};

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  command?: string;
  args?: string[];
  type: string;
  enabled: boolean;
  builtin?: boolean;
}

export interface Settings {
  work_mode: string; default_perm: boolean; auto_review: boolean;
  full_access: boolean; shell: string; open_target: string; language: string;
  hotkey: string; ctrl_enter_send: boolean; followup_mode: string; review_mode: string;
  notify_complete: string; notify_permission: boolean; notify_issue: boolean;
  notification_turn: string; notification_permission: boolean; notification_question: boolean;
  theme: string; font_size: string;
  long_context: boolean; llm_provider: string; llm_api_url: string; llm_model: string;
  personality: string; custom_instructions: string; auto_memory: boolean;
  tool_memory: boolean; message_history_limit: number;
  smtp_host: string; smtp_port: number; smtp_user: string; smtp_pass: string;
  auto_commit: boolean; confirm_before_commit: boolean; use_worktree: boolean;
  allow_browser: boolean; browser_approval: string; browser_history: string;
  browser_clear_data: string; blocked_domains: string[]; allowed_domains: string[];
  browser_plugin: string; selenium_installed: boolean; computer_control: boolean;
  telemetry_enabled: boolean; telemetry_endpoint: string;
  sanitizer_enabled: boolean; sanitizer_strategy: string; topic_constraints: string[];
  mcp_servers: MCPServer[]; model_configs: ModelConfigItem[];
  env_vars: EnvVar[]; slash_commands: SlashCommand[];
  archived_sessions: string[];
}

export type Project = {
  id: string;
  path: string;
  name: string;
  createdAt: number;
  lastAccessedAt: number;
  customInstructions: string;
};

// ---- 通知事件 payload ----

export interface NotificationPayload {
  title: string;
  body: string;
  type: string;
  persistent?: boolean;
  actions?: { label: string; action: string }[];
  session_id?: string;
}

export interface UpdateProgress {
  phase: string;
  percent: number;
  message: string;
  downloadURL?: string;
}

// ---- Agent subsystem ----

export interface AgentInfo {
  id: string;
  sessionId: string;
  title: string;
  status: string;
  turn: number;
  maxTurns: number;
  result?: string;
  error?: string;
  lastToolName?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Checkpoint subsystem ----

export interface CheckpointInfo {
  ID: string;
  SessionID: string;
  Turn: number;
  Status: string;
  ToolName: string;
  CreatedAt: string;
}

// ---- 向后兼容别名（v1 代码可能引用） ----

/** @deprecated Use ProviderPreset */
export type ModelPreset = ProviderPreset;
