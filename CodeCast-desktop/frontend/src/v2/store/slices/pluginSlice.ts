// frontend/src/v2/store/slices/pluginSlice.ts
import type { StateCreator } from 'zustand';
import type { PluginInfoData, PluginStatusData } from '../../wails/types';
import { Plugin } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface PluginSlice {
  plugins: PluginInfoData[];
  pluginStatus: PluginStatusData | null;
  pluginLoading: boolean;
  refreshPlugins: () => Promise<void>;
  loadPlugin: (path: string) => Promise<void>;
  unloadPlugin: (id: string) => Promise<void>;
  refreshPluginStatus: () => Promise<void>;
  sendMessage: (agentID: string, content: string) => Promise<void>;
  broadcast: (content: string) => Promise<void>;
}

export const createPluginSlice: StateCreator<PluginSlice, [], [], PluginSlice> = (set, get) => ({
  plugins: [],
  pluginStatus: null,
  pluginLoading: false,

  refreshPlugins: async () => {
    set({ pluginLoading: true });
    try {
      set({ plugins: await Plugin.list(), pluginLoading: false });
    } catch (e) {
      set({ pluginLoading: false });
      reportError('plugin', e);
    }
  },

  loadPlugin: async (path) => {
    try {
      await Plugin.load(path);
      await get().refreshPlugins();
    } catch (e) {
      reportError('plugin', e);
    }
  },

  unloadPlugin: async (id) => {
    try {
      await Plugin.unload(id);
      await get().refreshPlugins();
    } catch (e) {
      reportError('plugin', e);
    }
  },

  refreshPluginStatus: async () => {
    try {
      set({ pluginStatus: await Plugin.status() });
    } catch (e) {
      reportError('plugin', e);
    }
  },

  sendMessage: async (agentID, content) => {
    try {
      await Plugin.sendMessage(agentID, content);
    } catch (e) {
      reportError('plugin', e);
    }
  },

  broadcast: async (content) => {
    try {
      await Plugin.broadcast(content);
    } catch (e) {
      reportError('plugin', e);
    }
  },
});
