// frontend/src/v2/store/slices/gitSlice.ts
import type { StateCreator } from 'zustand';
import type { GitStatus, GitCommit } from '../../wails/types';
import { Git } from '../../wails/adapter';
import { parseGitStatus } from '../../wails/guards';
import { reportError } from '../../lib/reportError';

export interface GitSlice {
  status: GitStatus | null;
  branches: string[];
  commits: GitCommit[];
  diff: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const createGitSlice: StateCreator<GitSlice, [], [], GitSlice> = (set) => ({
  status: null,
  branches: [],
  commits: [],
  diff: '',
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const [rawStatus, branches] = await Promise.all([Git.status(), Git.branches()]);
      set({ status: parseGitStatus(rawStatus), branches, loading: false });
    } catch (e) {
      set({ loading: false });
      reportError('git', e);
    }
  },
});
