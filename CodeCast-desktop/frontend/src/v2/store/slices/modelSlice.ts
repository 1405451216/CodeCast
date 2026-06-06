// frontend/src/v2/store/slices/modelSlice.ts
import type { StateCreator } from 'zustand';
import type { ProviderPreset, ModelConfigItem } from '../../wails/types';
import { Models, Settings as SettingsAdapter } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface ModelSlice {
  providers: ProviderPreset[];
  configs: ModelConfigItem[];
  current: string;
  modelLoading: boolean;
  loadModels: () => Promise<void>;
  setCurrent: (model: string) => Promise<void>;
}

export const createModelSlice: StateCreator<ModelSlice, [], [], ModelSlice> = (set) => ({
  providers: [], configs: [], current: '', modelLoading: false,

  loadModels: async () => {
    set({ modelLoading: true });
    try {
      const [providers, configs, settings] = await Promise.all([
        Models.providers(),
        Models.configs(),
        SettingsAdapter.get(),
      ]);
      set({ providers, configs, current: settings?.llm_model ?? '', modelLoading: false });
    } catch (e) {
      set({ modelLoading: false });
      reportError('model', e);
    }
  },

  setCurrent: async (model) => {
    try {
      await Models.setCurrent(model);
      set({ current: model });
    } catch (e) {
      reportError('model', e);
    }
  },
});
