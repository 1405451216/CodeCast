import { ModelProvider, ModelConfig, ModelUseCase } from './models';

export const BUILTIN_PROVIDERS: ModelProvider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🌊',
    description: '高性价比的中文优化大模型，适合日常对话和编程辅助',
    authType: 'api_key',
    baseUrl: 'https://api.deepseek.com/v1',
    documentationUrl: 'https://platform.deepseek.com/api-docs',
    enabled: true,
    models: [
      {
        id: 'deepseek-v4-flash',
        name: 'deepseek-v4-flash',
        displayName: 'V4 Flash ⚡',
        contextWindow: 64000,
        maxTokens: 8192,
        pricing: { input: 0.14, output: 0.28, currency: 'CNY', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: false,
          vision: false,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'fast_completion',
        tags: ['快速', '经济', '日常']
      },
      {
        id: 'deepseek-v4-pro',
        name: 'deepseek-v4-pro',
        displayName: 'V4 Pro 🧠',
        contextWindow: 128000,
        maxTokens: 8192,
        pricing: { input: 1.4, output: 2.8, currency: 'CNY', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: true,
          vision: false,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'deep_reasoning',
        tags: ['推理', '深度', '专业']
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    description: '业界领先的 GPT 系列模型，全能型选手',
    authType: 'api_key',
    baseUrl: 'https://api.openai.com/v1',
    documentationUrl: 'https://platform.openai.com/docs',
    enabled: false,
    models: [
      {
        id: 'gpt-4o',
        name: 'gpt-4o',
        displayName: 'GPT-4o 🌟',
        contextWindow: 128000,
        maxTokens: 16384,
        pricing: { input: 2.5, output: 10.0, currency: 'USD', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: false,
          vision: true,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'coding_assistant',
        tags: ['全能', '多模态', '主流']
      },
      {
        id: 'gpt-4o-mini',
        name: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini 💚',
        contextWindow: 128000,
        maxTokens: 16384,
        pricing: { input: 0.15, output: 0.6, currency: 'USD', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: false,
          vision: true,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'fast_completion',
        tags: ['经济', '快速', '轻量']
      },
      {
        id: 'o3',
        name: 'o3',
        displayName: 'O3 (推理) 🧠',
        contextWindow: 200000,
        maxTokens: 100000,
        pricing: { input: 10.0, output: 40.0, currency: 'USD', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: true,
          vision: false,
          functionCalling: true,
          streaming: false,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'deep_reasoning',
        tags: ['推理', '复杂任务', '研究']
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🧠',
    description: '最强推理能力，擅长复杂分析和长文本处理',
    authType: 'api_key',
    baseUrl: 'https://api.anthropic.com/v1',
    documentationUrl: 'https://docs.anthropic.com/en/docs',
    enabled: false,
    models: [
      {
        id: 'claude-opus-4-20250514',
        name: 'claude-opus-4-20250514',
        displayName: 'Claude Opus 4 👑',
        contextWindow: 200000,
        maxTokens: 32000,
        pricing: { input: 15.0, output: 75.0, currency: 'USD', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: true,
          vision: true,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'deep_reasoning',
        tags: ['旗舰', '推理', '最强']
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4 ⚡',
        contextWindow: 200000,
        maxTokens: 16000,
        pricing: { input: 3.0, output: 15.0, currency: 'USD', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: true,
          vision: true,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'coding_assistant',
        tags: ['平衡', '编程', '推荐']
      },
      {
        id: 'claude-haiku-3-5-20241022',
        name: 'claude-haiku-3-5-20241022',
        displayName: 'Claude Haiku 3.5 💨',
        contextWindow: 200000,
        maxTokens: 8192,
        pricing: { input: 0.25, output: 1.25, currency: 'USD', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: false,
          vision: true,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'fast_completion',
        tags: ['极速', '经济', '轻量']
      }
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini',
    icon: '💎',
    description: 'Google 最新多模态模型，长上下文窗口优势明显',
    authType: 'api_key',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    documentationUrl: 'https://ai.google.dev/docs',
    enabled: false,
    models: [
      {
        id: 'gemini-2.5-pro',
        name: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro 🔬',
        contextWindow: 1000000,
        maxTokens: 65536,
        pricing: { input: 1.25, output: 10.0, currency: 'USD', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: true,
          vision: true,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'data_analysis',
        tags: ['百万上下文', '分析', '研究']
      },
      {
        id: 'gemini-2.5-flash',
        name: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash ⚡',
        contextWindow: 1000000,
        maxTokens: 65536,
        pricing: { input: 0.10, output: 0.40, currency: 'USD', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: false,
          vision: true,
          functionCalling: true,
          streaming: true,
          jsonMode: true,
          systemPrompt: true
        },
        recommendedUse: 'daily_chat',
        tags: ['快速', '免费额度', '多模态']
      }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    icon: '🏠',
    description: '运行本地开源模型，完全离线、隐私优先、零成本',
    authType: 'local',
    baseUrl: 'http://localhost:11434',
    documentationUrl: 'https://ollama.ai/docs',
    enabled: false,
    models: [
      {
        id: 'qwen2.5-coder:32b',
        name: 'qwen2.5-coder:32b',
        displayName: 'Qwen2.5 Coder 32B 🇨🇳',
        contextWindow: 32768,
        maxTokens: 4096,
        pricing: { input: 0, output: 0, currency: 'FREE', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: false,
          vision: false,
          functionCalling: false,
          streaming: true,
          jsonMode: false,
          systemPrompt: true
        },
        recommendedUse: 'coding_assistant',
        tags: ['本地', '免费', '中文优化', '离线']
      },
      {
        id: 'codellama:13b',
        name: 'codellama:13b',
        displayName: 'Code Llama 13B 🦙',
        contextWindow: 16384,
        maxTokens: 2048,
        pricing: { input: 0, output: 0, currency: 'FREE', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: false,
          vision: false,
          functionCalling: false,
          streaming: true,
          jsonMode: false,
          systemPrompt: true
        },
        recommendedUse: 'fast_completion',
        tags: ['本地', '免费', '轻量', '代码专用']
      },
      {
        id: 'mistral:7b',
        name: 'mistral:7b',
        displayName: 'Mistral 7B 🌪️',
        contextWindow: 32768,
        maxTokens: 4096,
        pricing: { input: 0, output: 0, currency: 'FREE', unit: 'per_million_tokens' },
        capabilities: {
          coding: true,
          reasoning: false,
          vision: false,
          functionCalling: false,
          streaming: true,
          jsonMode: false,
          systemPrompt: true
        },
        recommendedUse: 'daily_chat',
        tags: ['本地', '免费', '通用', '多语言']
      }
    ]
  }
];

export function getProviderById(id: string): ModelProvider | undefined {
  return BUILTIN_PROVIDERS.find(p => p.id === id);
}

export function getModelById(providerId: string, modelId: string): ModelConfig | undefined {
  const provider = getProviderById(providerId);
  return provider?.models.find(m => m.id === modelId);
}

export function getModelsByUseCase(useCase: ModelUseCase): Array<{ provider: ModelProvider; model: ModelConfig }> {
  const results: Array<{ provider: ModelProvider; model: ModelConfig }> = [];
  
  for (const provider of BUILTIN_PROVIDERS) {
    if (!provider.enabled) continue;
    
    for (const model of provider.models) {
      if (model.recommendedUse === useCase) {
        results.push({ provider, model });
      }
    }
  }
  
  return results;
}

export function getEnabledProviders(): ModelProvider[] {
  return BUILTIN_PROVIDERS.filter(p => p.enabled);
}

export function getAllAvailableModels(): Array<{ providerId: string; model: ModelConfig }> {
  const results: Array<{ providerId: string; model: ModelConfig }> = [];
  
  for (const provider of BUILTIN_PROVIDERS) {
    for (const model of provider.models) {
      results.push({
        providerId: provider.id,
        model
      });
    }
  }
  
  return results;
}
