import type {
  CastPluginManifest,
  PluginLoadResult,
  ICastTool,
  Permission
} from '../../types/cast-plugin';
import { CastToolRegistry } from '../../tools/CastToolRegistry';

const PLUGIN_STORAGE_KEY = 'codecast_cast_plugins';

export interface PluginSource {
  type: 'local' | 'url' | 'npm' | 'builtin';
  pathOrUrl: string;
  enabled: boolean;
  loadedAt?: number;
  version?: string;
  checksum?: string;
}

class CastPluginLoader {
  private loadedPlugins: Map<string, PluginSource> = new Map();
  private pluginErrors: Map<string, string[]> = new Map();

  async loadFromLocal(path: string): Promise<PluginLoadResult> {
    console.log(`[PluginLoader] Loading plugin from local path: ${path}`);

    try {
      const response = await fetch(`file://${path}/manifest.json`);
      if (!response.ok) {
        throw new Error(`Failed to load manifest.json: ${response.status}`);
      }

      const manifestData = await response.json() as unknown;
      return this.loadFromManifest(manifestData);
    } catch (error: any) {
      console.error(`[PluginLoader] Failed to load local plugin from ${path}:`, error.message);
      return {
        plugin: {} as CastPluginManifest,
        tools: [],
        errors: [error.message],
        loadTime: 0
      };
    }
  }

  async loadFromUrl(url: string): Promise<PluginLoadResult> {
    console.log(`[PluginLoader] Loading plugin from URL: ${url}`);

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.warn(`[PluginLoader] Unexpected content-type: ${contentType}`);
      }

      const manifestData = await response.json() as unknown;
      const result = this.loadFromManifest(manifestData);

      if (result.errors.length === 0) {
        this.loadedPlugins.set(result.plugin.name, {
          type: 'url',
          pathOrUrl: url,
          enabled: true,
          loadedAt: Date.now(),
          version: result.plugin.version
        });
        this.savePluginSources();
      }

      return result;
    } catch (error: any) {
      console.error(`[PluginLoader] Failed to load plugin from URL ${url}:`, error.message);
      return {
        plugin: {} as CastPluginManifest,
        tools: [],
        errors: [error.message],
        loadTime: Date.now() - startTime
      };
    }
  }

  loadFromManifest(manifestData: unknown): PluginLoadResult {
    const startTime = Date.now();

    let manifest: CastPluginManifest;

    if (typeof manifestData === 'string') {
      try {
        manifest = JSON.parse(manifestData) as CastPluginManifest;
      } catch (error: any) {
        return {
          plugin: {} as CastPluginManifest,
          tools: [],
          errors: [`Invalid JSON: ${error.message}`],
          loadTime: Date.now() - startTime
        };
      }
    } else {
      manifest = manifestData as CastPluginManifest;
    }

    const validation = this.validateManifest(manifest);
    if (!validation.valid) {
      return {
        plugin: manifest,
        tools: [],
        errors: validation.errors,
        loadTime: Date.now() - startTime
      };
    }

    const result = CastToolRegistry.loadPlugin(manifest);

    if (result.errors.length > 0) {
      this.pluginErrors.set(manifest.name, result.errors);
    }

    return result;
  }

  async unloadPlugin(name: string): Promise<boolean> {
    console.log(`[PluginLoader] Unloading plugin: ${name}`);

    const success = CastToolRegistry.unloadPlugin(name);

    if (success) {
      this.loadedPlugins.delete(name);
      this.pluginErrors.delete(name);
      this.savePluginSources();
    }

    return success;
  }

  getLoadedPlugins(): Map<string, PluginSource> {
    return new Map(this.loadedPlugins);
  }

  getPluginStatus(name: string): 'loaded' | 'error' | 'not_found' | 'disabled' {
    const source = this.loadedPlugins.get(name);
    if (!source) return 'not_found';
    if (!source.enabled) return 'disabled';
    if (this.pluginErrors.has(name)) return 'error';

    const pluginTools = CastToolRegistry.getPluginTools(name);
    if (pluginTools.length > 0) return 'loaded';

    return 'error';
  }

  async scanLocalPluginsDirectory(): Promise<PluginSource[]> {
    console.log('[PluginLoader] Scanning local plugins directory...');

    const plugins: PluginSource[] = [];

    try {
      const homeDir = typeof window !== 'undefined' && (window as any).process?.env?.HOME || '';
      const pluginsPath = `${homeDir}/.cast/plugins`;

      console.log(`[PluginLoader] Scanning: ${pluginsPath}`);

      const existingPlugins = this.loadPluginSources();
      for (const [name, source] of Object.entries(existingPlugins)) {
        if (source.type === 'local' || source.type === 'builtin') {
          plugins.push(source);
        }
      }

      console.log(`[PluginLoader] Found ${plugins.length} local plugins`);
    } catch (error: any) {
      console.error('[PluginLoader] Failed to scan plugins directory:', error.message);
    }

    return plugins;
  }

  savePluginSources(): void {
    try {
      const data = Object.fromEntries(this.loadedPlugins);
      localStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(data));
      console.log(`[PluginLoader] Saved ${this.loadedPlugins.size} plugin sources to storage`);
    } catch (error: any) {
      console.error('[PluginLoader] Failed to save plugin sources:', error.message);
    }
  }

  loadPluginSources(): Record<string, PluginSource> {
    try {
      const raw = localStorage.getItem(PLUGIN_STORAGE_KEY);
      if (!raw) return {};

      const data = JSON.parse(raw) as Record<string, PluginSource>;
      for (const [key, value] of Object.entries(data)) {
        this.loadedPlugins.set(key, value);
      }

      console.log(`[PluginLoader] Loaded ${this.loadedPlugins.size} plugin sources from storage`);
      return data;
    } catch (error: any) {
      console.error('[PluginLoader] Failed to load plugin sources:', error.message);
      return {};
    }
  }

  validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, errors: ['Manifest must be a non-null object'] };
    }

    const m = manifest as Record<string, unknown>;

    if (!m.name || typeof m.name !== 'string' || !m.name.trim()) {
      errors.push('Missing or invalid "name" field (required string)');
    }

    if (!m.version || typeof m.version !== 'string' || !m.version.trim()) {
      errors.push('Missing or invalid "version" field (required string)');
    } else if (!/^\d+\.\d+\.\d+/.test(m.version as string)) {
      errors.push('Version should follow semver format (e.g., 1.0.0)');
    }

    if (!m.description || typeof m.description !== 'string') {
      errors.push('Missing or invalid "description" field (required string)');
    }

    if (!m.author || typeof m.author !== 'string') {
      errors.push('Missing or invalid "author" field (required string)');
    }

    if (!m.entry || typeof m.entry !== 'string') {
      errors.push('Missing or invalid "entry" field (required string)');
    }

    if (!Array.isArray(m.tools) || (m.tools as unknown[]).length === 0) {
      errors.push('"tools" must be a non-empty array');
    } else {
      const tools = m.tools as unknown[];
      tools.forEach((tool: unknown, index: number) => {
        if (!tool || typeof tool !== 'object') {
          errors.push(`tools[${index}]: must be an object`);
          return;
        }

        const t = tool as Record<string, unknown>;
        const requiredFields = ['id', 'name', 'description', 'version', 'author', 'category', 'icon', 'color'];
        for (const field of requiredFields) {
          if (!t[field] || typeof t[field] !== 'string') {
            errors.push(`tools[${index}]: missing or invalid "${field}" field`);
          }
        }

        if (typeof t.execute !== 'function') {
          errors.push(`tools[${index}]: "execute" must be a function`);
        }

        if (t.category && !['analysis', 'meeting', 'management', 'utility', 'creative', 'communication', 'productivity', 'custom'].includes(t.category as string)) {
          errors.push(`tools[${index}]: invalid category "${t.category}"`);
        }
      });
    }

    if (!Array.isArray(m.permissions)) {
      errors.push('"permissions" must be an array');
    } else {
      const validPermissions: Permission[] = ['none', 'read', 'write', 'execute', 'network', 'filesystem'];
      (m.permissions as unknown[]).forEach((perm: unknown, index: number) => {
        if (!validPermissions.includes(perm as Permission)) {
          errors.push(`permissions[${index}]: invalid permission "${perm}"`);
        }
      });
    }

    if (m.dependencies && !Array.isArray(m.dependencies)) {
      errors.push('"dependencies" must be an array if provided');
    }

    if (m.castMinVersion && typeof m.castMinVersion !== 'string') {
      errors.push('"castMinVersion" must be a string if provided');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  enablePlugin(name: string): boolean {
    const source = this.loadedPlugins.get(name);
    if (!source) return false;

    source.enabled = true;
    this.savePluginSources();
    return true;
  }

  disablePlugin(name: string): boolean {
    const source = this.loadedPlugins.get(name);
    if (!source) return false;

    source.enabled = false;
    this.savePluginSources();
    return true;
  }

  clearAll(): void {
    this.loadedPlugins.clear();
    this.pluginErrors.clear();
    localStorage.removeItem(PLUGIN_STORAGE_KEY);
    console.log('[PluginLoader] All plugin data cleared');
  }
}

export const pluginLoader = new CastPluginLoader();
