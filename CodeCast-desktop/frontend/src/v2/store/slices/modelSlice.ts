// frontend/src/v2/store/slices/modelSlice.ts
import type { StateCreator } from 'zustand';
import type { ModelPreset } from '../../wails/types';
import { Models } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface ModelSlice {
  presets: ModelPreset[];
  current: string;
  apiKeyMasked: string;
  loading: boolean;
  load: () => Promise<void>;
  setCurrent: (model: string) => Promise<void>;
}

export const createModelSlice: StateCreator<ModelSlice, [], [], ModelSlice> = (set) => ({
  presets: [], current: '', apiKeyMasked: '', loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const [presets, current] = await Promise.all([Models.list(), Models.current()]);
      set({ presets, current, loading: false });
    } catch (e) { set({ loading: false }); reportError('model', e); }
  },
  setCurrent: async (model) => {
    await Models.set(model);
    set({ current: model });
  },
});
