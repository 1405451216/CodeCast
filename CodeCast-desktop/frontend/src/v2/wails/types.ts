export type Session = { id: string; title: string; projectId?: string; createdAt: number; updatedAt: number };
export type ModelPreset = { id: string; name: string; apiUrl: string; defaultModel: string; models: string[] };
export type ToolCatalogItem = { name: string; category: string; description: string };
export type APMetricsSnapshot = { llmTotalCalls: number; llmTotalErrors: number; toolTotalCalls: number; toolTotalErrors: number; totalTurns: number; totalEpisodes: number; activeAgents: number; poolQueueLength: number; memorySizeBytes: number; tokenUsageByModel: Record<string, { prompt: number; completion: number; total: number }> };
export type Message = { id: string; role: 'user' | 'assistant' | 'system'; content: string; reasoning?: string };
export type ToolCall = { id: string; name: string; args: string; result?: string };

export interface MCPServerStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: string[];
  error?: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  dirty: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  at: number;
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
  mcp_servers: MCPServerStatus[]; model_configs: any[]; env_vars: any[]; slash_commands: any[];
}

export type Project = { id: string; name: string; path: string };
