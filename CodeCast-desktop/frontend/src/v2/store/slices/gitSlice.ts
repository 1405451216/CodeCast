// frontend/src/v2/store/slices/gitSlice.ts
import type { StateCreator } from 'zustand';
import type { GitStatus } from '../../wails/types';
import { Git } from '../../wails/adapter';
import { parseGitStatus } from '../../wails/guards';
import { reportError } from '../../lib/reportError';

export interface GitSlice {
  status: GitStatus | null;
  gitLoading: boolean;
  refreshGit: () => Promise<void>;
  confirmCommit: (filePath: string) => Promise<void>;
}

export const createGitSlice: StateCreator<GitSlice, [], [], GitSlice> = (set) => ({
  status: null,
  gitLoading: false,

  refreshGit: async () => {
    set({ gitLoading: true });
    try {
      const rawStatus = await Git.status();
      set({ status: parseGitStatus(rawStatus), gitLoading: false });
    } catch (e) {
      set({ gitLoading: false });
      reportError('git', e);
    }
  },

  confirmCommit: async (filePath) => {
    try {
      await Git.confirmCommit(filePath);
    } catch (e) {
      reportError('git', e);
    }
  },
});
