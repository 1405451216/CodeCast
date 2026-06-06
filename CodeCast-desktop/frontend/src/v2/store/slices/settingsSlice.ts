// frontend/src/v2/store/slices/settingsSlice.ts
import type { StateCreator } from 'zustand';
import type { Settings } from '../../wails/types';
import { Settings as SettingsAdapter } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface SettingsSlice {
  settings: Settings | null;
  loading: boolean;
  loadSettings: () => Promise<void>;
  save: (s: Settings) => Promise<void>;
  updateKey: (key: string, value: unknown) => Promise<void>;
}

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set) => ({
  settings: null, loading: false,

  loadSettings: async () => {
    set({ loading: true });
    try { set({ settings: await SettingsAdapter.get(), loading: false }); }
    catch (e) { set({ loading: false }); reportError('settings', e); }
  },

  save: async (s) => {
    try { await SettingsAdapter.save(s); set({ settings: s }); }
    catch (e) { reportError('settings', e); }
  },

  updateKey: async (key, value) => {
    try {
      await SettingsAdapter.updateKey(key, value);
      set((s) => s.settings ? { settings: { ...s.settings, [key]: value } as Settings } : s);
    } catch (e) {
      reportError('settings', e);
    }
  },
});
