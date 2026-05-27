export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  entry: string;
  permissions: PluginPermission[];
  dependencies?: string[];
  minAppVersion: string;
  icon?: string;
  homepage?: string;
}

export enum PluginPermission {
  READ_FILES = 'read:files',
  WRITE_FILES = 'write:files',
  EXECUTE_COMMANDS = 'execute:commands',
  ACCESS_GIT = 'access:git',
  MODIFY_UI = 'modify:ui',
  NETWORK_ACCESS = 'network:access',
  READ_SETTINGS = 'read:settings',
  WRITE_SETTINGS = 'write:settings'
}

export interface PluginAPI {
  app: {
    getVersion(): string;
    getTheme(): 'light' | 'dark' | 'system';
    setTheme(theme: string): void;
    openFile(path: string): void;
    showMessage(message: string, type: 'info' | 'success' | 'warning' | 'error'): void;
  };

  files: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    listFiles(dir: string): Promise<Array<{ name: string; path: string; isDirectory: boolean }>>;
    watchFile(path: string, callback: (content: string) => void): () => void;
  };

  ui: {
    registerSidebarPanel(config: SidebarPanelConfig): void;
    registerToolbarButton(config: ToolbarButtonConfig): void;
    registerContextMenu(config: ContextMenuConfig): void;
    addStyleSheet(css: string): void;
    removeStyleSheet(id: string): void;
  };

  terminal: {
    executeCommand(command: string): Promise<{ output: string; exitCode: number }>;
    onOutput(callback: (line: string) => void): () => void;
    writeInput(text: string): void;
  };

  events: {
    on(event: string, handler: (...args: any[]) => void): () => void;
    once(event: string, handler: (...args: any[]) => void): () => void;
    emit(event: string, ...args: any[]): void;
    off(event: string, handler: (...args: any[]) => void): void;
  };

  storage: {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
  };

  http: {
    get(url: string, options?: RequestInit): Promise<Response>;
    post(url: string, data: any, options?: RequestInit): Promise<Response>;
  };
}

export interface SidebarPanelConfig {
  id: string;
  title: string;
  icon: string;
  component: React.ComponentType;
  position: 'left' | 'right';
  order?: number;
}

export interface ToolbarButtonConfig {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  tooltip?: string;
  shortcut?: string;
}

export interface ContextMenuConfig {
  id: string;
  label: string;
  icon?: string;
  context: 'editor' | 'file-explorer' | 'terminal' | 'global';
  action: () => void;
  separator?: boolean;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  instance: PluginInstance;
  status: 'active' | 'inactive' | 'error';
  loadedAt: number;
  error?: string;
}

export interface PluginInstance {
  activate(api: PluginAPI): Promise<void>;
  deactivate(): Promise<void>;
  destroy?(): void;
}

export interface PluginEvent {
  type: 'plugin:loaded' | 'plugin:unloaded' | 'plugin:activated' | 'plugin:deactivated' | 'plugin:error';
  pluginId: string;
  data?: any;
  timestamp: number;
}
