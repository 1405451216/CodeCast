import type { SliceSet } from './storeTypes';
import { logger } from '../utils/logger';
import { BUILTIN_PROVIDERS, getProviderById, getModelById } from '../types/builtin-providers';
import type { ModelProvider, ModelConfig, ProviderConfig, MultiModelSettings, ModelUseCase, TokenUsage } from '../types/models';
import { DEFAULT_MODEL, type AvailableModel } from './types';
import { StorageEncryption } from '../utils/StorageEncryption';

const STORAGE_KEY = 'codecast_multi_model_settings';

interface ProviderConnectionStatus {
  providerId: string;
  connected: boolean;
  lastTested?: number;
  error?: string;
  latencyMs?: number;
}

interface ModelStoreState {
  providers: ModelProvider[];
  providerConfigs: Record<string, ProviderConfig>;
  selectedProviderId: string;
  selectedModel: AvailableModel;
  thinkingMode: boolean;
  connectionStatuses: Record<string, ProviderConnectionStatus>;
  testingConnection: string | null;
  tokenUsage: TokenUsage | null;
  isLoading: boolean;
  initialized: boolean;
}

interface ModelSlice extends ModelStoreState {
  setSelectedModel: (model: AvailableModel) => void;
  setThinkingMode: (mode: boolean) => void;
  toggleThinkingMode: () => void;

  initFromStorage: () => void;

  updateProviderConfig: (providerId: string, config: Partial<ProviderConfig>) => void;
  removeProviderConfig: (providerId: string) => void;
  setDefaultProvider: (providerId: string) => void;

  getActiveProviders: () => ModelProvider[];
  getAvailableModels: () => Array<{ providerId: string; provider: ModelProvider; model: ModelConfig }>;
  getModelByUseCase: (useCase: ModelUseCase) => Array<{ providerId: string; provider: ModelProvider; model: ModelConfig }>;
  getCurrentModelInfo: () => { provider: ModelProvider | null; model: ModelConfig | null };

  testConnection: (providerId: string) => Promise<boolean>;

  setTokenUsage: (usage: TokenUsage | null) => void;
  clearAllConfigs: () => void;
}

async function loadSettingsFromStorage(): Promise<MultiModelSettings | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const decrypted = await StorageEncryption.decrypt(raw);
    return JSON.parse(decrypted);
  } catch (e) {
    logger.warn('ModelStore', 'Failed to load settings from storage', { error: e });
    return null;
  }
}

async function saveSettingsToStorage(settings: MultiModelSettings): Promise<void> {
  try {
    const encrypted = await StorageEncryption.encrypt(JSON.stringify(settings));
    localStorage.setItem(STORAGE_KEY, encrypted);
  } catch (e) {
    logger.error('ModelStore', 'Failed to save settings to storage', { error: e });
  }
}

function encryptApiKey(key: string): Promise<string> {
  if (!key) return Promise.resolve('');
  return StorageEncryption.encrypt(key).catch(() => key);
}

function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted) return Promise.resolve('');
  return StorageEncryption.decrypt(encrypted)
    .then(decrypted => {
      if (decrypted && !decrypted.includes(':')) {
        return decrypted;
      }
      return encrypted;
    })
    .catch(() => encrypted);
}

const createModelSlice = (set: SliceSet): ModelSlice => {
  logger.info('ModelStore', '🤖 Creating multi-model management slice...');

  const initialState: ModelStoreState = {
    providers: BUILTIN_PROVIDERS,
    providerConfigs: {},
    selectedProviderId: 'deepseek',
    selectedModel: DEFAULT_MODEL,
    thinkingMode: false,
    connectionStatuses: {},
    testingConnection: null,
    tokenUsage: null,
    isLoading: false,
    initialized: false,
  };

  let internalState = { ...initialState };

  const get = (): ModelStoreState => internalState;

  const updateState = (updates: Partial<ModelStoreState>) => {
    internalState = { ...internalState, ...updates };
    set(updates as Record<string, unknown>);
  };

  const persistToStorage = () => {
    const settings: MultiModelSettings = {
      providers: Object.values(internalState.providerConfigs).filter(c => c.apiKey || c.baseUrl),
      defaultProviderId: internalState.selectedProviderId,
      fallbackProviderIds: [],
      autoSelectModel: false,
    };
    saveSettingsToStorage(settings);
  };

  return {
    ...initialState,

    setSelectedModel: (model: AvailableModel) => {
      const prev = internalState.selectedModel;
      updateState({ selectedModel: model });

      const currentInfo = getCurrentModelInfoInternal(internalState);
      logger.info('ModelStore', '🔄 Model switched', {
        from: prev,
        to: model,
        provider: currentInfo.provider?.name || 'unknown',
        modelName: currentInfo.model?.displayName || model
      });
    },

    setThinkingMode: (mode: boolean) => {
      updateState({ thinkingMode: mode });
      logger.debug('ModelStore', `💭 Thinking mode ${mode ? 'enabled' : 'disabled'}`);
    },

    toggleThinkingMode: () => {
      const newMode = !internalState.thinkingMode;
      updateState({ thinkingMode: newMode });
      logger.debug('ModelStore', `💭 Thinking mode toggled: ${newMode}`);
    },

    initFromStorage: async () => {
      if (internalState.initialized) return;

      logger.info('ModelStore', '📂 Initializing model settings from storage...');

      const savedSettings = await loadSettingsFromStorage();
      const configs: Record<string, ProviderConfig> = {};

      if (savedSettings?.providers) {
        for (const pc of savedSettings.providers) {
          configs[pc.providerId] = {
            ...pc,
            apiKey: await decryptApiKey(pc.apiKey || ''),
          };
        }

        logger.info('ModelStore', `✅ Loaded ${Object.keys(configs).length} provider config(s) from storage`);
      }

      const defaultProvider = savedSettings?.defaultProviderId || 'deepseek';

      updateState({
        providerConfigs: configs,
        selectedProviderId: defaultProvider,
        initialized: true,
      });
    },

    updateProviderConfig: (providerId: string, config: Partial<ProviderConfig>) => {
      const existing = internalState.providerConfigs[providerId] || { providerId };
      const updatedConfig: ProviderConfig = {
        ...existing,
        ...config,
        apiKey: config.apiKey !== undefined ? config.apiKey : existing.apiKey,
      };

      const newConfigs = {
        ...internalState.providerConfigs,
        [providerId]: updatedConfig,
      };

      updateState({ providerConfigs: newConfigs });
      persistToStorage();

      logger.info('ModelStore', '⚙️ Provider config updated', {
        providerId,
        hasApiKey: !!updatedConfig.apiKey,
        hasCustomUrl: !!updatedConfig.baseUrl,
      });
    },

    removeProviderConfig: (providerId: string) => {
      const newConfigs = { ...internalState.providerConfigs };
      delete newConfigs[providerId];

      updateState({ providerConfigs: newConfigs });

      if (internalState.selectedProviderId === providerId) {
        const remainingKeys = Object.keys(newConfigs);
        const newDefault = remainingKeys.length > 0 ? remainingKeys[0] : 'deepseek';
        updateState({ selectedProviderId: newDefault });
      }

      persistToStorage();
      logger.info('ModelStore', '🗑️ Provider config removed', { providerId });
    },

    setDefaultProvider: (providerId: string) => {
      updateState({ selectedProviderId: providerId });
      persistToStorage();
      logger.info('ModelStore', '🎯 Default provider changed', { providerId });
    },

    getActiveProviders: (): ModelProvider[] => {
      return internalState.providers.filter(p => {
        const cfg = internalState.providerConfigs[p.id];
        if (p.authType === 'local' || p.authType === 'none') return true;
        return cfg && cfg.apiKey && cfg.apiKey.length > 0;
      });
    },

    getAvailableModels: (): Array<{ providerId: string; provider: ModelProvider; model: ModelConfig }> => {
      const results: Array<{ providerId: string; provider: ModelProvider; model: ModelConfig }> = [];

      for (const provider of internalState.providers) {
        const cfg = internalState.providerConfigs[provider.id];
        const isActive = provider.authType === 'local' ||
          provider.authType === 'none' ||
          (cfg && cfg.apiKey && cfg.apiKey.length > 0);

        if (!isActive) continue;

        const enabledModels = cfg?.models && cfg.models.length > 0
          ? cfg.models
          : provider.models.map(m => m.id);

        for (const model of provider.models) {
          if (enabledModels.includes(model.id)) {
            results.push({ providerId: provider.id, provider, model });
          }
        }
      }

      return results;
    },

    getModelByUseCase: (useCase: ModelUseCase): Array<{ providerId: string; provider: ModelProvider; model: ModelConfig }> => {
      const allModels = (get() as ModelSlice).getAvailableModels();
      return allModels.filter((item: { providerId: string; provider: ModelProvider; model: ModelConfig }) => item.model.recommendedUse === useCase);
    },

    getCurrentModelInfo: (): { provider: ModelProvider | null; model: ModelConfig | null } => {
      return getCurrentModelInfoInternal(internalState);
    },

    testConnection: async (providerId: string): Promise<boolean> => {
      const provider = getProviderById(providerId);
      if (!provider) {
        logger.warn('ModelStore', 'Cannot test connection: provider not found', { providerId });
        return false;
      }

      updateState({ testingConnection: providerId });

      const startTime = Date.now();

      try {
        const cfg = internalState.providerConfigs[providerId];
        const baseUrl = cfg?.baseUrl || provider.baseUrl || '';
        const apiKey = cfg?.apiKey || '';

        if (provider.authType === 'api_key' && !apiKey) {
          throw new Error('API Key 未配置');
        }

        const testEndpoint = getTestEndpoint(providerId, baseUrl);
        // Google AI API uses query param for auth; others use Authorization header
        const finalEndpoint = providerId === 'google' && apiKey
          ? `${testEndpoint}?key=${apiKey}`
          : testEndpoint;
        logger.info('ModelStore', '🔌 Testing connection...', { providerId, endpoint: testEndpoint });

        const response = await fetch(finalEndpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && providerId !== 'google' ? { 'Authorization': `Bearer ${apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(10000),
        });

        const latencyMs = Date.now() - startTime;

        if (response.ok || response.status === 401 || response.status === 403) {
          const success = response.status !== 401 && response.status !== 403;
          const status: ProviderConnectionStatus = {
            providerId,
            connected: success,
            lastTested: Date.now(),
            latencyMs,
            error: !success ? 'API Key 无效或已过期' : undefined,
          };

          updateState({
            connectionStatuses: {
              ...internalState.connectionStatuses,
              [providerId]: status,
            },
            testingConnection: null,
          });

          logger.info('ModelStore', success ? '✅ Connection test passed' : '⚠️ Connection test failed', {
            providerId,
            latencyMs,
            status: response.status,
          });

          return success;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        const status: ProviderConnectionStatus = {
          providerId,
          connected: false,
          lastTested: Date.now(),
          latencyMs,
          error: error?.message || '连接失败',
        };

        updateState({
          connectionStatuses: {
            ...internalState.connectionStatuses,
            [providerId]: status,
          },
          testingConnection: null,
        });

        logger.error('ModelStore', '❌ Connection test failed', {
          providerId,
          error: error?.message,
          latencyMs,
        });

        return false;
      }
    },

    setTokenUsage: (usage: TokenUsage | null) => {
      updateState({ tokenUsage: usage });
    },

    clearAllConfigs: () => {
      updateState({
        providerConfigs: {},
        selectedProviderId: 'deepseek',
        selectedModel: DEFAULT_MODEL,
        connectionStatuses: {},
        tokenUsage: null,
      });
      localStorage.removeItem(STORAGE_KEY);
      logger.warn('ModelStore', '🗑️ All model configurations cleared');
    },
  };
};

function getTestEndpoint(providerId: string, baseUrl: string): string {
  switch (providerId) {
    case 'openai':
      return `${baseUrl.replace(/\/v1$/, '')}/v1/models`;
    case 'anthropic':
      return `${baseUrl.replace(/\/v1$/, '')}/v1/models`;
    case 'google':
      // Google AI API requires the key as a query parameter, not in Authorization header.
      // The test endpoint will be called with the API key appended.
      return `${baseUrl}/models`;
    case 'deepseek':
      return `${baseUrl.replace(/\/v1$/, '')}/v1/models`;
    case 'ollama':
      return `${baseUrl}/api/tags`;
    case 'kimi':
      return `${baseUrl.replace(/\/v1$/, '')}/v1/models`;
    case 'glm':
      return `${baseUrl.replace(/\/v4$/, '')}/v4/models`;
    case 'mimo':
      return `${baseUrl.replace(/\/v1$/, '')}/v1/models`;
    default:
      return `${baseUrl}/models`;
  }
}

interface CurrentModelInfo {
  provider: ModelProvider | null;
  model: ModelConfig | null;
}

function getCurrentModelInfoInternal(state: ModelStoreState): CurrentModelInfo {
  const selectedModelId = state.selectedModel;

  for (const provider of state.providers) {
    const foundModel = provider.models.find(m =>
      m.id === selectedModelId || m.name === selectedModelId
    );
    if (foundModel) {
      return { provider, model: foundModel };
    }
  }

  return { provider: null, model: null };
}

export { type ModelSlice, type ModelStoreState, type ProviderConnectionStatus, createModelSlice };
