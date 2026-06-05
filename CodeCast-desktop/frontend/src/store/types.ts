export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp?: number;
}

export interface Session {
  ID: string;
  Name: string;
  CreatedAt: string;
  SkillID: string;
  Mode: 'coding' | 'daily' | '';
  Messages: Message[];
}

export type SessionMode = 'coding' | 'daily';
export const DEFAULT_SESSION_MODE: SessionMode = 'daily';

export interface Attachment {
  name: string;
  path: string;
}

export interface ImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
  file?: File;
  size: number;
  type: string;
}

export interface ContextReference {
  id: string;
  type: 'message' | 'code' | 'file';
  title: string;
  content: string;
  sourceMessageId?: string;
  filePath?: string;
  language?: string;
}

export interface CommandSuggestion {
  type: 'clarity' | 'parameters' | 'format' | 'structure';
  severity: 'info' | 'warning' | 'suggestion';
  title: string;
  description: string;
  originalText: string;
  suggestedText: string;
  applied: boolean;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  created_at?: number;
  last_accessed_at?: number;
  custom_instructions?: string;
}

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  fill_text: string;
  icon?: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ChangedFile {
  name: string;
  status: 'added' | 'modified' | 'deleted';
}

export type View = 'welcome' | 'chat';

export type ActivePanel = null | 'plugins' | 'automation' | 'projects' | 'agents' | 'tools';

export type PreviewTab = 'browser' | 'editor';

export type ActiveMenu = null | 'file' | 'edit' | 'view';

export interface AgentInfo {
  id: string;
  sessionId: string;
  title: string;
  status: 'idle' | 'running' | 'paused' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled';
  turn: number;
  maxTurns: number;
  result?: string;
  error?: string;
  lastToolName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentEvent {
  agent_id: string;
  type: 'status' | 'progress' | 'tool_use' | 'result';
  status?: AgentInfo['status'];
  turn?: number;
  max_turns?: number;
  tool_name?: string;
  message?: string;
}

// ProviderPreset 接口已移至 api.ts（单一数据源，从后端动态加载）

export type AvailableModel = string;
export const DEFAULT_MODEL: AvailableModel = 'deepseek-v4-flash';
