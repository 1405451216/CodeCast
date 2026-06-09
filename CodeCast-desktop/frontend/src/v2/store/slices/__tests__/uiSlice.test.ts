import { describe, it, expect, beforeEach } from 'vitest';
import { createUISlice } from '../uiSlice';

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
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
    getInitialState: () => ({}),
    destroy: () => {},
  } as any;
}

describe('uiSlice', () => {
  let store: any;
  let slice: any;

  beforeEach(() => {
    store = createMockStore();
    // Initialize the slice — createUISlice returns initial state values
    slice = createUISlice(store.setState.bind(store), store.getState.bind(store));
    // Call setState with the initial slice values so they're in store state
    const init = createUISlice(
      (fn: any) => { Object.assign(store.getState(), typeof fn === 'function' ? fn(store.getState()) : fn); },
      store.getState.bind(store)
    );
    Object.assign(store.getState(), init);
  });

  describe('theme', () => {
    it('defaults to "light"', () => {
      expect(store.getState().theme).toBe('light');
    });

    it('setTheme changes theme', () => {
      slice.setTheme('dark');
      expect(store.getState().theme).toBe('dark');
    });

    it('setTheme to system', () => {
      slice.setTheme('system');
      expect(store.getState().theme).toBe('system');
    });
  });

  describe('sidebar', () => {
    it('defaults sidebar to open', () => {
      expect(store.getState().sidebarOpen).toBe(true);
    });

    it('toggleSidebar changes open state', () => {
      const before = store.getState().sidebarOpen;
      slice.toggleSidebar();
      expect(store.getState().sidebarOpen).toBe(!before);
    });
  });

  describe('drawer', () => {
    it('defaults drawer to open', () => {
      expect(store.getState().drawerOpen).toBe(true);
    });

    it('toggleDrawer changes open state', () => {
      slice.toggleDrawer();
      expect(store.getState().drawerOpen).toBe(false);
    });
  });

  describe('planMode', () => {
    it('defaults planMode to false', () => {
      expect(store.getState().planMode).toBe(false);
    });

    it('togglePlanMode toggles plan mode', () => {
      slice.togglePlanMode();
      expect(store.getState().planMode).toBe(true);
      slice.togglePlanMode();
      expect(store.getState().planMode).toBe(false);
    });
  });

  describe('commandPalette', () => {
    it('defaults closed', () => {
      expect(store.getState().commandPaletteOpen).toBe(false);
    });

    it('setCommandPaletteOpen sets value', () => {
      slice.setCommandPaletteOpen(true);
      expect(store.getState().commandPaletteOpen).toBe(true);
    });
  });

  describe('mode', () => {
    it('defaults to "cast"', () => {
      expect(store.getState().mode).toBe('cast');
    });

    it('setMode changes mode when sessions exist', () => {
      // setMode uses get().sessions to find matching session — mock sessions
      store.getState().sessions = [
        { id: 's1', mode: 'coding' },
        { id: 's2', mode: 'daily' },
      ];
      store.getState().currentSessionId = 's2';
      slice.setMode('code');
      expect(store.getState().mode).toBe('code');
      expect(store.getState().currentSessionId).toBe('s1');
    });

    it('setMode handles missing sessions', () => {
      store.getState().sessions = [];
      slice.setMode('cast');
      expect(store.getState().mode).toBe('cast');
      expect(store.getState().currentSessionId).toBeNull();
    });
  });
});
