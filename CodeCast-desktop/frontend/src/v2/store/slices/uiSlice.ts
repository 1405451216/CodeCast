import type { StateCreator } from 'zustand';

export type AppMode = 'code' | 'cast';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface UISlice {
  theme: ThemeMode;
  sidebarOpen: boolean;
  drawerOpen: boolean;
  planMode: boolean;
  commandPaletteOpen: boolean;
  mode: AppMode;
  setTheme: (t: ThemeMode) => void;
  toggleSidebar: () => void;
  toggleDrawer: () => void;
  togglePlanMode: () => void;
  setCommandPaletteOpen: (o: boolean) => void;
  setMode: (m: AppMode) => void;
  toggleMode: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  theme: 'light',
  sidebarOpen: true,
  drawerOpen: true,
  planMode: false,
  commandPaletteOpen: false,
  mode: 'cast',
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  togglePlanMode: () => set((s) => ({ planMode: !s.planMode })),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === 'code' ? 'cast' : 'code' })),
});
