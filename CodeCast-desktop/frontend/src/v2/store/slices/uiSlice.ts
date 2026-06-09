import type { StateCreator } from 'zustand';
import type { Session } from '../../wails/types';

export type AppMode = 'code' | 'cast';
export type ThemeMode = 'light' | 'dark' | 'system';

// Minimal cross-slice type for setMode to access sessions
interface CrossSliceState {
  sessions: Session[];
  currentSessionId: string | null;
}

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

export const createUISlice: StateCreator<CrossSliceState & UISlice, [], [], UISlice> = (set, get) => ({
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
  setMode: (mode) => {
    const modeMatch = mode === 'cast' ? 'daily' : 'coding';
    const sessions = get().sessions;
    // 找到该模式下最近的会话
    const targetSession = sessions.find((s) => (s.mode || 'daily') === modeMatch);
    set({ mode, currentSessionId: targetSession?.id ?? null });
  },
  toggleMode: () => {
    const current = get().mode;
    get().setMode(current === 'code' ? 'cast' : 'code');
  },
});
