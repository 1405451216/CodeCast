// frontend/src/v2/store/slices/updaterSlice.ts
import type { StateCreator } from 'zustand';
import type { UpdateInfo, UpdateRecord } from '../../wails/types';
import { Updater } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface UpdaterSlice {
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  updateHistory: UpdateRecord[];
  updaterLoading: boolean;
  refreshVersion: () => Promise<void>;
  checkUpdate: () => Promise<void>;
  downloadUpdate: (url: string) => Promise<string>;
  refreshHistory: () => Promise<void>;
  openReleasePage: () => void;
  openDownloaded: (path: string) => void;
}

export const createUpdaterSlice: StateCreator<UpdaterSlice, [], [], UpdaterSlice> = (set) => ({
  currentVersion: '',
  updateInfo: null,
  updateHistory: [],
  updaterLoading: false,

  refreshVersion: async () => {
    set({ updaterLoading: true });
    try {
      const version = await Updater.currentVersion();
      set({ currentVersion: version, updaterLoading: false });
    } catch (e) {
      set({ updaterLoading: false });
      reportError('updater', e);
    }
  },

  checkUpdate: async () => {
    set({ updaterLoading: true });
    try {
      const info = await Updater.check();
      set({ updateInfo: info, updaterLoading: false });
    } catch (e) {
      set({ updaterLoading: false });
      reportError('updater', e);
    }
  },

  downloadUpdate: async (url) => {
    set({ updaterLoading: true });
    try {
      const path = await Updater.download(url);
      set({ updaterLoading: false });
      return path;
    } catch (e) {
      set({ updaterLoading: false });
      reportError('updater', e);
      return '';
    }
  },

  refreshHistory: async () => {
    set({ updaterLoading: true });
    try {
      const history = await Updater.history();
      set({ updateHistory: history, updaterLoading: false });
    } catch (e) {
      set({ updaterLoading: false });
      reportError('updater', e);
    }
  },

  openReleasePage: () => {
    Updater.openReleasePage();
  },

  openDownloaded: (path) => {
    Updater.openDownloaded(path);
  },
});
