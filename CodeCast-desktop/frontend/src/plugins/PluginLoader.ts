import {
  PluginManifest,
  LoadedPlugin,
  PluginAPI,
  PluginInstance,
  PluginEvent
} from './PluginTypes';

class PluginLoader {
  private loadedPlugins = new Map<string, LoadedPlugin>();
  private api: PluginAPI | null = null;
  private eventListeners: Map<string, Array<{ handler: (...args: any[]) => void }>> = new Map();

  constructor() {
    this.setupMessageListener();
  }

  setAPI(api: PluginAPI): void {
    this.api = api;
  }

  async loadPlugin(manifestPathOrManifest: string | PluginManifest): Promise<LoadedPlugin> {
    try {
      let manifest: PluginManifest;

      if (typeof manifestPathOrManifest === 'string') {
        const response = await fetch(manifestPathOrManifest);
        manifest = await response.json();
      } else {
        manifest = manifestPathOrManifest;
      }

      this.validateManifest(manifest);

      if (this.loadedPlugins.has(manifest.id)) {
        throw new Error(`Plugin ${manifest.id} is already loaded`);
      }

      const pluginModule = await import(/* @vite-ignore */ manifest.entry);
      const PluginClass = pluginModule.default || pluginModule;

      if (typeof PluginClass !== 'function') {
        throw new Error(`Invalid plugin entry point for ${manifest.id}`);
      }

      const instance: PluginInstance = new PluginClass() as PluginInstance;

      const loadedPlugin: LoadedPlugin = {
        manifest,
        instance,
        status: 'inactive',
        loadedAt: Date.now()
      };

      this.loadedPlugins.set(manifest.id, loadedPlugin);

      this.emitEvent({
        type: 'plugin:loaded',
        pluginId: manifest.id,
        data: { manifest },
        timestamp: Date.now()
      });

      console.log(`[PluginLoader] Loaded plugin: ${manifest.name}@${manifest.version}`);

      return loadedPlugin;
    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin:`, error);
      throw error;
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!this.api) {
      throw new Error('Plugin API not initialized');
    }

    if (plugin.status === 'active') {
      console.warn(`[PluginLoader] Plugin ${pluginId} is already active`);
      return;
    }

    try {
      await plugin.instance.activate(this.api);
      plugin.status = 'active';

      this.emitEvent({
        type: 'plugin:activated',
        pluginId,
        timestamp: Date.now()
      });

      console.log(`[PluginLoader] Activated plugin: ${plugin.manifest.name}`);
    } catch (error) {
      plugin.status = 'error';
      plugin.error = error instanceof Error ? error.message : String(error);

      this.emitEvent({
        type: 'plugin:error',
        pluginId,
        data: { error: plugin.error },
        timestamp: Date.now()
      });

      throw error;
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.status !== 'active') {
      console.warn(`[PluginLoader] Plugin ${pluginId} is not active`);
      return;
    }

    try {
      await plugin.instance.deactivate();
      plugin.status = 'inactive';

      this.emitEvent({
        type: 'plugin:deactivated',
        pluginId,
        timestamp: Date.now()
      });

      console.log(`[PluginLoader] Deactivated plugin: ${plugin.manifest.name}`);
    } catch (error) {
      console.error(`[PluginLoader] Failed to deactivate plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (plugin.status === 'active') {
      await this.deactivatePlugin(pluginId);
    }

    if (typeof plugin.instance.destroy === 'function') {
      try {
        plugin.instance.destroy();
      } catch (error) {
        console.warn(`[PluginLoader] Error destroying plugin ${pluginId}:`, error);
      }
    }

    this.loadedPlugins.delete(pluginId);

    this.emitEvent({
      type: 'plugin:unloaded',
      pluginId,
      timestamp: Date.now()
    });

    console.log(`[PluginLoader] Unloaded plugin: ${plugin.manifest.name}`);
  }

  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  getActivePlugins(): LoadedPlugin[] {
    return this.getAllPlugins().filter(p => p.status === 'active');
  }

  async activateAllPlugins(): Promise<void> {
    const plugins = this.getAllPlugins().filter(p => p.status === 'inactive');

    for (const plugin of plugins) {
      try {
        await this.activatePlugin(plugin.manifest.id);
      } catch (error) {
        console.error(`[PluginLoader] Failed to activate ${plugin.manifest.id}:`, error);
      }
    }
  }

  async deactivateAllPlugins(): Promise<void> {
    const activePlugins = this.getActivePlugins();

    for (const plugin of activePlugins) {
      try {
        await this.deactivatePlugin(plugin.manifest.id);
      } catch (error) {
        console.error(`[PluginLoader] Failed to deactivate ${plugin.manifest.id}:`, error);
      }
    }
  }

  on(eventType: string, handler: (...args: any[]) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    this.eventListeners.get(eventType)!.push({ handler });

    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.findIndex(l => l.handler === handler);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  private emitEvent(event: PluginEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener.handler(event);
        } catch (error) {
          console.error(`[PluginLoader] Event handler error:`, error);
        }
      });
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    const requiredFields = ['id', 'name', 'version', 'description', 'author', 'entry'];

    for (const field of requiredFields) {
      if (!manifest[field as keyof PluginManifest]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!/^[a-z0-9-_]+$/.test(manifest.id)) {
      throw new Error('Invalid plugin ID format. Use lowercase letters, numbers, hyphens, and underscores only.');
    }

    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error('Invalid version format. Use semantic versioning (e.g., 1.0.0).');
    }
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'plugin-message') {
        const { pluginId, action, payload } = event.data;

        switch (action) {
          case 'request-api':
            if (this.api) {
              window.postMessage(
                { type: 'plugin-response', pluginId, action: 'api-response', api: this.api },
                '*'
              );
            }
            break;

          default:
            console.warn(`[PluginLoader] Unknown action: ${action}`);
        }
      }
    });
  }
}

export const pluginLoader = new PluginLoader();
export default PluginLoader;
