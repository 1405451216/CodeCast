import type { LoadedPlugin } from '../plugins/PluginTypes';
import type { SliceSet } from './storeTypes';
import { logger } from '../utils/logger';

interface PluginConfig {
  [pluginId: string]: {
    enabled: boolean;
    settings: Record<string, any>;
  };
}

interface PluginEvent {
  id: string;
  type: 'load' | 'unload' | 'activate' | 'deactivate' | 'error';
  pluginId: string;
  timestamp: number;
  message: string;
}

interface PluginSlice {
  enabledPlugins: string[];
  setEnabledPlugins: (plugins: string[]) => void;
  
  loadedPlugins: LoadedPlugin[];
  setLoadedPlugins: (plugins: LoadedPlugin[]) => void;
  addLoadedPlugin: (plugin: LoadedPlugin) => void;
  removeLoadedPlugin: (pluginId: string) => void;
  updateLoadedPlugin: (pluginId: string, updates: Partial<LoadedPlugin>) => void;

  pluginConfigs: PluginConfig;
  updatePluginConfig: (pluginId: string, config: Partial<{ enabled: boolean; settings: Record<string, any> }>) => void;
  removePluginConfig: (pluginId: string) => void;

  pluginEvents: PluginEvent[];
  addPluginEvent: (event: Omit<PluginEvent, 'id' | 'timestamp'>) => void;
  clearPluginEvents: () => void;

  selectedPluginId: string | null;
  setSelectedPluginId: (id: string | null) => void;

  isInstalling: boolean;
  setIsInstalling: (installing: boolean) => void;

  installProgress: number;
  setInstallProgress: (progress: number) => void;

  resetPluginState: () => void;
}

const createPluginSlice = (set: SliceSet): PluginSlice => {
  logger.info('PluginStore', '🔌 Creating plugin slice...');

  return {
    enabledPlugins: [],
    setEnabledPlugins: (plugins) => {
      logger.info('PluginStore', `✅ Enabled plugins updated`, {
        count: plugins.length,
        plugins
      });
      set({ enabledPlugins: plugins });
    },

    loadedPlugins: [] as LoadedPlugin[],
    setLoadedPlugins: (plugins) => {
      logger.info('PluginStore', `📦 Loaded plugins initialized`, {
        count: plugins.length,
        pluginIds: plugins.map(p => p.manifest.id)
      });
      set({ loadedPlugins: plugins });
    },
    addLoadedPlugin: (plugin) => set((state: any) => {
      const newPlugins = [...(state.loadedPlugins || []), plugin];
      logger.info('PluginStore', `➕ Plugin loaded`, {
        pluginId: plugin.manifest.id,
        pluginName: plugin.manifest.name,
        version: plugin.manifest.version,
        status: plugin.status,
        totalPlugins: newPlugins.length
      });
      return { loadedPlugins: newPlugins };
    }),
    removeLoadedPlugin: (pluginId) => set((state: any) => {
      const removedPlugin = (state.loadedPlugins || []).find((p: LoadedPlugin) => p.manifest.id === pluginId);
      const newPlugins = (state.loadedPlugins || []).filter((p: LoadedPlugin) => p.manifest.id !== pluginId);
      
      if (removedPlugin) {
        logger.info('PluginStore', `➖ Plugin unloaded`, {
          pluginId: removedPlugin.manifest.id,
          pluginName: removedPlugin.manifest.name,
          remainingPlugins: newPlugins.length
        });
      } else {
        logger.warn('PluginStore', `⚠️  Attempted to unload non-existent plugin`, { pluginId });
      }
      
      return { loadedPlugins: newPlugins };
    }),
    updateLoadedPlugin: (pluginId, updates) => set((state: any) => {
      const existingPlugin = (state.loadedPlugins || []).find((p: LoadedPlugin) => p.manifest.id === pluginId);
      const newPlugins = (state.loadedPlugins || []).map((p: LoadedPlugin) =>
        p.manifest.id === pluginId ? { ...p, ...updates } : p
      );
      
      logger.info('PluginStore', `🔄 Plugin status updated`, {
        pluginId,
        pluginName: existingPlugin?.manifest.name || 'Unknown',
        changes: Object.keys(updates),
        newStatus: updates.status
      });
      
      return { loadedPlugins: newPlugins };
    }),

    pluginConfigs: {} as PluginConfig,
    updatePluginConfig: (pluginId, config) => set((state: any) => {
      const oldConfig = (state.pluginConfigs || {})[pluginId];
      const newConfig = { ...((state.pluginConfigs || {})[pluginId] || { enabled: true, settings: {} }), ...config };
      
      logger.info('PluginStore', `⚙️  Plugin config updated`, {
        pluginId,
        oldConfig,
        newConfig,
        changes: config
      });
      
      return {
        pluginConfigs: {
          ...(state.pluginConfigs || {}),
          [pluginId]: newConfig
        }
      };
    }),
    removePluginConfig: (pluginId) => set((state: any) => {
      const newConfigs = { ...(state.pluginConfigs || {}) };
      delete newConfigs[pluginId];
      
      logger.info('PluginStore', `🗑️  Plugin config removed`, {
        pluginId,
        remainingConfigs: Object.keys(newConfigs).length
      });
      
      return { pluginConfigs: newConfigs };
    }),

    pluginEvents: [] as PluginEvent[],
    addPluginEvent: (event) => set((state: any) => {
      const newEvent = {
        ...event,
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };
      
      const level = event.type === 'error' ? 'error' : 
                   event.type === 'load' || event.type === 'activate' ? 'info' : 'debug';
      
      logger[level]('PluginStore', `📋 Plugin event: ${event.type}`, {
        eventId: newEvent.id,
        pluginId: event.pluginId,
        type: event.type,
        message: event.message
      });
      
      return {
        pluginEvents: [newEvent, ...(state.pluginEvents || [])].slice(0, 100)
      };
    }),
    clearPluginEvents: () => {
      logger.info('PluginStore', '🗑️  Plugin events cleared');
      set({ pluginEvents: [] });
    },

    selectedPluginId: null,
    setSelectedPluginId: (id) => {
      logger.debug('PluginStore', `🎯 Selected plugin changed`, {
        previousId: null,
        newId: id
      });
      set({ selectedPluginId: id });
    },

    isInstalling: false,
    setIsInstalling: (installing) => {
      logger.info('PluginStore', installing ? '🔄 Plugin installation started' : '✅ Plugin installation completed');
      set({ isInstalling: installing });
    },

    installProgress: 0,
    setInstallProgress: (progress) => {
      if (progress % 25 === 0 || progress === 100) {
        logger.info('PluginStore', `📊 Installation progress: ${progress}%`);
      }
      set({ installProgress: progress });
    },

    resetPluginState: () => {
      logger.warn('PluginStore', '↩️  All plugin state reset to defaults');
      set({
        enabledPlugins: [],
        loadedPlugins: [],
        pluginConfigs: {},
        pluginEvents: [],
        selectedPluginId: null,
        isInstalling: false,
        installProgress: 0
      });
    }
  };
};

export { type PluginSlice, createPluginSlice };