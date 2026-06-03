// 插件类型 - 已迁移到 AP Tool（cast_plugin_*）
export type PluginStatus = 'active' | 'inactive' | 'loading';
export type PluginPermission = 'read' | 'write' | 'execute' | 'admin';
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  status: PluginStatus;
}
export interface LoadedPlugin {
  manifest: PluginManifest;
  loadedAt: number;
  status?: PluginStatus;
  config?: Record<string, any>;
}
export type PluginEvent = { type: string; pluginId: string; data?: any };
export const pluginLoader = {
  load: async (_id: string): Promise<LoadedPlugin> => ({
    manifest: { id: _id, name: _id, version: '1.0.0', description: '', author: '', status: 'active' as PluginStatus },
    loadedAt: Date.now(),
  }),
  unload: async (_id: string) => {},
  list: (): LoadedPlugin[] => [],
};
