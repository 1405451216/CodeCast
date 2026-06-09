// frontend/src/v2/store/slices/authSlice.ts
import type { StateCreator } from 'zustand';

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  id: number;
}

export interface AuthSlice {
  githubUser: GitHubUser | null;
  githubLoading: boolean;
  setGitHubUser: (user: GitHubUser | null) => void;
  setGitHubLoading: (loading: boolean) => void;
  clearGitHubAuth: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  githubUser: null,
  githubLoading: false,

  setGitHubUser: (user) => set({ githubUser: user, githubLoading: false }),

  setGitHubLoading: (loading) => set({ githubLoading: loading }),

  clearGitHubAuth: () => set({ githubUser: null, githubLoading: false }),
});
