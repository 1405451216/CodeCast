// CodeCast model types — compatible with AP framework
// AP SDK types are available via @agentprimordia/sdk but not re-exported here
// to avoid build dependency issues. Import directly from the SDK where needed.

export interface ModelProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  authType: 'api_key' | 'oauth' | 'local' | 'none';
  baseUrl?: string;
  documentationUrl?: string;
  models: ModelConfig[];
  enabled: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  displayName?: string;
  contextWindow: number;
  maxTokens: number;
  pricing?: {
    input: number;
    output: number;
    currency: string;
    unit: 'per_million_tokens';
  };
  capabilities: ModelCapabilities;
  recommendedUse: ModelUseCase;
  tags?: string[];
}

export interface ModelCapabilities {
  coding: boolean;
  reasoning: boolean;
  vision: boolean;
  functionCalling: boolean;
  streaming: boolean;
  jsonMode: boolean;
  systemPrompt: boolean;
}

export type ModelUseCase =
  | 'daily_chat'
  | 'coding_assistant'
  | 'deep_reasoning'
  | 'fast_completion'
  | 'creative_writing'
  | 'data_analysis';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; tool: string };
  responseFormat?: { type: 'json_object' } | { type: 'text' };
  stream?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface StreamChunk {
  id: string;
  delta: {
    content?: string;
    role?: string;
    toolCalls?: Array<{
      index: number;
      id?: string;
      type?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  finishReason?: string;
  usage?: Partial<TokenUsage>;
}

export interface ProviderConfig {
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  extraHeaders?: Record<string, string>;
  models?: string[];
  defaultModel?: string;
}

export interface MultiModelSettings {
  providers: ProviderConfig[];
  defaultProviderId: string;
  fallbackProviderIds: string[];
  autoSelectModel: boolean;
  costBudget?: {
    dailyLimit: number;
    monthlyLimit: number;
    currentDailySpend: number;
    currentMonthlySpend: number;
  };
}
