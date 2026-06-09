import { describe, it, expect, beforeEach } from 'vitest';
import { createErrorsSlice } from '../errorsSlice';

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

describe('errorsSlice', () => {
  let store: ReturnType<typeof createMockStore>;
  let slice: ReturnType<typeof createErrorsSlice>;

  beforeEach(() => {
    store = createMockStore();
    slice = createErrorsSlice(store.setState.bind(store), store.getState.bind(store));
    // Apply initial state
    const init = createErrorsSlice(
      (fn: any) => { Object.assign(store.getState(), typeof fn === 'function' ? fn(store.getState()) : fn); },
      store.getState.bind(store)
    );
    Object.assign(store.getState(), init);
  });

  describe('initial state', () => {
    it('has empty errors object', () => {
      expect(store.getState().errors).toEqual({});
    });
  });

  describe('setError', () => {
    it('sets an error for a slice', () => {
      slice.setError('chat', 'Chat failed to connect');
      expect(store.getState().errors.chat).toBe('Chat failed to connect');
    });

    it('supports multiple slices', () => {
      slice.setError('chat', 'Chat error');
      slice.setError('model', 'Model error');
      slice.setError('git', 'Git error');
      expect(store.getState().errors.chat).toBe('Chat error');
      expect(store.getState().errors.model).toBe('Model error');
      expect(store.getState().errors.git).toBe('Git error');
    });

    it('overwrites existing error for same slice', () => {
      slice.setError('chat', 'First error');
      slice.setError('chat', 'Second error');
      expect(store.getState().errors.chat).toBe('Second error');
    });
  });

  describe('clearError', () => {
    it('removes error for a slice', () => {
      slice.setError('chat', 'Error');
      slice.setError('model', 'Keep this');
      slice.clearError('chat');
      expect(store.getState().errors.chat).toBeUndefined();
      expect(store.getState().errors.model).toBe('Keep this');
    });

    it('no-ops for unknown slice', () => {
      slice.setError('chat', 'Error');
      slice.clearError('nonexistent' as any);
      expect(store.getState().errors.chat).toBe('Error');
    });
  });
});
