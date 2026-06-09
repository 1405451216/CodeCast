import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAuthSlice } from '../authSlice';

function createMockStore() {
  const state: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  const setState = (updater: any) => {
    const next = typeof updater === 'function' ? updater(state as any) : updater;
    Object.assign(state, next);
    listeners.forEach((l) => l());
  };
  return {
    setState,
    getState: () => state as any,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    getInitialState: () => ({}),
    destroy: () => {},
  } as any;
}

describe('authSlice', () => {
  let store: ReturnType<typeof createMockStore>;
  let slice: ReturnType<typeof createAuthSlice>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockStore();
    slice = createAuthSlice(store.setState.bind(store), store.getState.bind(store));
    // Apply initial state to mock store
    const init = createAuthSlice(
      (fn: any) => { Object.assign(store.getState(), typeof fn === 'function' ? fn(store.getState()) : fn); },
      store.getState.bind(store)
    );
    Object.assign(store.getState(), init);
  });

  describe('initial state', () => {
    it('starts with null github user', () => {
      expect(store.getState().githubUser).toBeNull();
    });

    it('starts with not loading', () => {
      expect(store.getState().githubLoading).toBe(false);
    });
  });

  describe('setGitHubUser', () => {
    it('sets the github user and clears loading', () => {
      const user = {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.png',
        id: 12345,
      };
      slice.setGitHubUser(user);
      expect(store.getState().githubUser).toEqual(user);
      expect(store.getState().githubLoading).toBe(false);
    });

    it('clears the github user', () => {
      slice.setGitHubUser({
        login: 'testuser', name: 'Test', avatar_url: '', id: 1,
      });
      slice.setGitHubUser(null);
      expect(store.getState().githubUser).toBeNull();
    });
  });

  describe('setGitHubLoading', () => {
    it('sets loading state', () => {
      slice.setGitHubLoading(true);
      expect(store.getState().githubLoading).toBe(true);
      slice.setGitHubLoading(false);
      expect(store.getState().githubLoading).toBe(false);
    });
  });

  describe('clearGitHubAuth', () => {
    it('clears user and loading', () => {
      slice.setGitHubUser({ login: 'u', name: 'N', avatar_url: '', id: 1 });
      slice.setGitHubLoading(true);
      slice.clearGitHubAuth();
      expect(store.getState().githubUser).toBeNull();
      expect(store.getState().githubLoading).toBe(false);
    });
  });
});
