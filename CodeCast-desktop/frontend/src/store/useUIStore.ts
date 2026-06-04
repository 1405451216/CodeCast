import { View, ActivePanel, PreviewTab } from '../store/types';
import type { SliceSet } from './storeTypes';

interface UISlice {
  view: View;
  setView: (view: View) => void;
  title: string;
  setTitle: (title: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  settingsOpen: boolean;
  toggleSettings: () => void;
  closeSettings: () => void;
  previewPanelVisible: boolean;
  togglePreviewPanel: () => void;
  previewTab: PreviewTab;
  setPreviewTab: (tab: PreviewTab) => void;
  filesPanelVisible: boolean;
  toggleFilesPanel: () => void;
  popoutMode: boolean;
  togglePopout: () => void;
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  showModeSelector: boolean;
  setShowModeSelector: (show: boolean) => void;
  pendingMode: import('../store/types').SessionMode | null;
  setPendingMode: (mode: import('../store/types').SessionMode | null) => void;
}

const createUISlice = (set: SliceSet): UISlice => ({
  view: 'welcome',
  setView: (view) => set({ view }),
  title: 'CodeCast',
  setTitle: (title) => set({ title }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  activePanel: null,
  setActivePanel: (panel) => set({ activePanel: panel }),
  settingsOpen: false,
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  closeSettings: () => set({ settingsOpen: false }),
  previewPanelVisible: false,
  togglePreviewPanel: () => set((state) => ({ previewPanelVisible: !state.previewPanelVisible })),
  previewTab: 'browser',
  setPreviewTab: (tab) => set({ previewTab: tab }),
  filesPanelVisible: false,
  toggleFilesPanel: () => set((state) => ({ filesPanelVisible: !state.filesPanelVisible })),
  popoutMode: false,
  togglePopout: () => set((state) => ({ popoutMode: !state.popoutMode })),
  sidebarVisible: true,
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  showModeSelector: false,
  setShowModeSelector: (show) => set({ showModeSelector: show }),
  pendingMode: null,
  setPendingMode: (mode) => set({ pendingMode: mode }),
});

export { type UISlice, createUISlice };
