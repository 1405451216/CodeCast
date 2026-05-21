import { create } from 'zustand';

// ─── Domain Types ───────────────────────────────────────────────

export interface Message {
  role: string;
  content: string;
}

export interface Session {
  ID: string;
  Name: string;
  CreatedAt: string;
  SkillID: string;
  Messages: Message[];
}

export interface Attachment {
  name: string;
  path: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  fill_text: string;
  icon?: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ChangedFile {
  name: string;
  status: 'added' | 'modified' | 'deleted';
}

// ─── Union / Literal Types ──────────────────────────────────────

export type View = 'welcome' | 'chat';

export type ActivePanel = null | 'plugins' | 'automation' | 'projects';

export type PreviewTab = 'browser' | 'editor';

export type ActiveMenu = null | 'file' | 'edit' | 'view';

// ─── Available Models ───────────────────────────────────────────

export const AVAILABLE_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
export type AvailableModel = (typeof AVAILABLE_MODELS)[number];
export const DEFAULT_MODEL: AvailableModel = 'deepseek-v4-flash';

// ─── Store Interface ────────────────────────────────────────────

interface AppState {
  // Sessions
  sessions: Session[];
  currentSessionId: string | null;
  setSessions: (sessions: Session[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;

  // Model & Thinking
  selectedModel: AvailableModel;
  setSelectedModel: (model: AvailableModel) => void;
  thinkingMode: boolean;
  toggleThinkingMode: () => void;

  // Streaming
  isStreaming: boolean;
  setIsStreaming: (val: boolean) => void;

  // Attachments
  attachments: Attachment[];
  setAttachments: (attachments: Attachment[]) => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;

  // Sidebar
  sidebarVisible: boolean;
  toggleSidebar: () => void;

  // View state
  view: View;
  setView: (view: View) => void;

  // Active panel
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;

  // Settings
  settingsOpen: boolean;
  toggleSettings: () => void;
  closeSettings: () => void;

  // Preview panel
  previewPanelVisible: boolean;
  togglePreviewPanel: () => void;
  previewTab: PreviewTab;
  setPreviewTab: (tab: PreviewTab) => void;

  // Files panel
  filesPanelVisible: boolean;
  toggleFilesPanel: () => void;

  // Popout mode
  popoutMode: boolean;
  togglePopout: () => void;

  // Projects
  projects: Project[];
  currentProject: string | null;
  noProjectMode: boolean;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (id: string | null) => void;
  setNoProjectMode: (enabled: boolean) => void;

  // Slash commands
  slashCommands: SlashCommand[];
  setSlashCommands: (commands: SlashCommand[]) => void;

  // Title bar menus
  activeMenu: ActiveMenu;
  setActiveMenu: (menu: ActiveMenu) => void;
  closeMenus: () => void;

  // Right panel: TODO tasks
  todoItems: TodoItem[];
  setTodoItems: (items: TodoItem[]) => void;
  addTodoItem: (item: TodoItem) => void;
  updateTodoItem: (id: string, updates: Partial<TodoItem>) => void;

  // Right panel: Context compression
  contextCompression: number; // 0-100 percentage
  setContextCompression: (value: number) => void;

  // Right panel: Changed files
  changedFiles: ChangedFile[];
  setChangedFiles: (files: ChangedFile[]) => void;
}

// ─── Store Implementation ───────────────────────────────────────

export const useAppStore = create<AppState>((set) => ({
  // Sessions
  sessions: [],
  currentSessionId: null,
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.ID !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
    })),

  // Model & Thinking
  selectedModel: DEFAULT_MODEL,
  setSelectedModel: (model) => set({ selectedModel: model }),
  thinkingMode: false,
  toggleThinkingMode: () => set((state) => ({ thinkingMode: !state.thinkingMode })),

  // Streaming
  isStreaming: false,
  setIsStreaming: (val) => set({ isStreaming: val }),

  // Attachments
  attachments: [],
  setAttachments: (attachments) => set({ attachments }),
  addAttachment: (attachment) => set((state) => ({ attachments: [...state.attachments, attachment] })),
  removeAttachment: (index) =>
    set((state) => ({
      attachments: state.attachments.filter((_, i) => i !== index),
    })),
  clearAttachments: () => set({ attachments: [] }),

  // Sidebar
  sidebarVisible: true,
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),

  // View state
  view: 'welcome',
  setView: (view) => set({ view }),

  // Active panel
  activePanel: null,
  setActivePanel: (panel) => set({ activePanel: panel }),

  // Settings
  settingsOpen: false,
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  closeSettings: () => set({ settingsOpen: false }),

  // Preview panel
  previewPanelVisible: false,
  togglePreviewPanel: () => set((state) => ({ previewPanelVisible: !state.previewPanelVisible })),
  previewTab: 'browser',
  setPreviewTab: (tab) => set({ previewTab: tab }),

  // Files panel
  filesPanelVisible: false,
  toggleFilesPanel: () => set((state) => ({ filesPanelVisible: !state.filesPanelVisible })),

  // Popout mode
  popoutMode: false,
  togglePopout: () => set((state) => ({ popoutMode: !state.popoutMode })),

  // Projects
  projects: [],
  currentProject: null,
  noProjectMode: false,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (id) => set({ currentProject: id, noProjectMode: id === null }),
  setNoProjectMode: (enabled) => set({ noProjectMode: enabled, currentProject: null }),

  // Slash commands
  slashCommands: [],
  setSlashCommands: (commands) => set({ slashCommands: commands }),

  // Title bar menus
  activeMenu: null,
  setActiveMenu: (menu) => set({ activeMenu: menu }),
  closeMenus: () => set({ activeMenu: null }),

  // Right panel: TODO tasks
  todoItems: [],
  setTodoItems: (items) => set({ todoItems: items }),
  addTodoItem: (item) => set((state) => ({ todoItems: [...state.todoItems, item] })),
  updateTodoItem: (id, updates) =>
    set((state) => ({
      todoItems: state.todoItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  // Right panel: Context compression
  contextCompression: 0,
  setContextCompression: (value) => set({ contextCompression: value }),

  // Right panel: Changed files
  changedFiles: [],
  setChangedFiles: (files) => set({ changedFiles: files }),
}));
