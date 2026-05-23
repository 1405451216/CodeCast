import type {
  GoProject,
  GoSession,
  GoMessage,
  GoSkill,
  GoTask,
  GoMCPServer,
  GoEnvVar,
  GoSlashCommand,
  GoEditorInfo,
  GoFileEntry,
  GoSettings,
} from './api/types';

export class WailsBridgeError extends Error {
  constructor(method: string) {
    super(`请在桌面应用中使用 (${method})`);
    this.name = 'WailsBridgeError';
  }
}

function isBrowserEnv(): boolean {
  return typeof window !== 'undefined' && !(window as any).go;
}

// ---------------------------------------------------------------------------
// Typed Go/Wails bridge interface
// ---------------------------------------------------------------------------

/**
 * Exhaustive interface describing every method exposed by the Go backend via
 * the Wails bridge (`window.go.main.App`). This replaces the previous
 * `[method: string]: (...args: unknown[]) => Promise<unknown>` dynamic shape.
 */
interface GoAppMethods {
  // Settings
  GetSettings(): Promise<GoSettings>;
  SaveSettings(settings: GoSettings): Promise<void>;
  UpdateSetting(key: string, value: string | boolean | string[]): Promise<void>;

  // Sessions
  GetSessions(): Promise<GoSession[]>;
  CreateSession(name: string, skillId: string): Promise<GoSession>;
  GetSession(id: string): Promise<GoSession>;
  DeleteSession(id: string): Promise<void>;

  // Messages
  SendMessage(sessionId: string, input: string): Promise<void>;
  SendMessageEx(sessionId: string, input: string, model: string, thinking: boolean): Promise<GoMessage[]>;
  CancelRequest(): Promise<void>;
  CancelSessionRequest(sessionId: string): Promise<void>;

  // Projects
  GetProjects(): Promise<GoProject[]>;
  AddProject(path: string): Promise<GoProject>;
  RemoveProject(path: string): Promise<void>;
  SelectFolder(): Promise<string>;
  OpenInEditor(dirPath: string): Promise<void>;
  SetNoProjectMode(enabled: boolean): Promise<void>;
  GetNoProjectMode(): Promise<boolean>;
  SetCurrentProject(id: string): Promise<void>;
  GetCurrentProject(): Promise<GoProject>;

  // Files
  ListFiles(path: string): Promise<GoFileEntry[]>;
  ReadFile(path: string): Promise<string>;
  WriteFile(path: string, content: string): Promise<void>;
  GetWorkspaceFiles(dirPath: string): Promise<string[]>;
  ReadFileContent(filePath: string): Promise<string>;

  // Config
  GetConfig(): Promise<Record<string, string>>;
  SetAPIKey(key: string): Promise<void>;

  // Platform
  GetPlatform(): Promise<string>;

  // Editors
  GetAvailableEditors(): Promise<GoEditorInfo[]>;
  SetPreferredEditor(editorId: string): Promise<void>;

  // Skills
  GetSkills(): Promise<GoSkill[]>;
  CreateSkill(name: string, description: string, prompt: string): Promise<GoSkill>;
  DeleteSkill(id: string): Promise<void>;

  // Tasks
  GetTasks(): Promise<GoTask[]>;
  CreateTask(name: string, description: string, command: string, schedule: string): Promise<GoTask>;
  RunTaskNow(id: string): Promise<void>;
  ToggleTask(id: string, enabled: boolean): Promise<void>;
  DeleteTask(id: string): Promise<void>;

  // Archive
  ArchiveSession(id: string): Promise<void>;
  GetArchivedSessions(): Promise<GoSession[]>;
  ResetMemory(): Promise<void>;

  // Memory
  GetMemoryStats(): Promise<Record<string, number>>;
  ClearMemory(): Promise<void>;

  // Environment
  GetEnvVars(): Promise<GoEnvVar[]>;
  AddEnvVar(key: string, value: string): Promise<void>;
  RemoveEnvVar(key: string): Promise<void>;

  // Slash Commands
  GetSlashCommands(): Promise<GoSlashCommand[]>;
  AddSlashCommand(name: string, description: string, fillText: string): Promise<void>;
  UpdateSlashCommand(id: string, name: string, description: string, fillText: string): Promise<void>;
  RemoveSlashCommand(id: string): Promise<void>;

  // MCP Servers
  AddMCPServer(name: string, url: string): Promise<void>;
  AddMCPServerStdio(name: string, command: string, args: string[]): Promise<void>;
  RemoveMCPServer(id: string): Promise<void>;
  ToggleMCPServer(id: string, enabled: boolean): Promise<void>;
  TestMCPServerConnection(id: string): Promise<MCPConnectionResult>;
  GetMCPStatus(): Promise<MCPStatusEntry[]>;

  // Browser domains
  AddBlockedDomain(domain: string): Promise<void>;
  RemoveBlockedDomain(domain: string): Promise<void>;
  AddAllowedDomain(domain: string): Promise<void>;
  RemoveAllowedDomain(domain: string): Promise<void>;
  IsDomainBlocked(url: string): Promise<boolean>;
  GetDomainRules(): Promise<DomainRules>;

  // Window controls
  WindowMinimise(): Promise<void>;
  WindowMaximise(): Promise<void>;
  WindowClose(): Promise<void>;
  PopoutWindow(): Promise<void>;
  WindowSetAlwaysOnTop(onTop: boolean): Promise<void>;

  // File selection
  SelectFile(): Promise<string>;
  SelectMultipleFiles(): Promise<string[]>;

  // Git
  ConfirmGitCommit(filePath: string): Promise<void>;
  GetGitStatus(): Promise<GitStatusResult>;

  // Computer Control
  ExecuteCommand(command: string, timeoutSeconds: number): Promise<string>;

  // Selenium
  CheckSeleniumInstalled(): Promise<SeleniumStatus>;

  // Browser
  ClearBrowserData(): Promise<void>;

  // Popout
  GetPopoutState(): Promise<PopoutState>;
}

// Auxiliary result interfaces for complex return types
interface MCPConnectionResult {
  success: boolean;
  message?: string;
  tools?: string[];
}

interface MCPStatusEntry {
  id: string;
  name: string;
  connected: boolean;
  error?: string;
}

interface DomainRules {
  blocked: string[];
  allowed: string[];
}

interface GitStatusResult {
  branch: string;
  files: Array<{ path: string; status: string }>;
  clean: boolean;
}

interface SeleniumStatus {
  installed: boolean;
  version?: string;
  driver?: string;
}

interface PopoutState {
  active: boolean;
  windowId?: string;
}

// ---------------------------------------------------------------------------
// Typed window augmentation
// ---------------------------------------------------------------------------

interface WailsWindow {
  go?: {
    main?: {
      App?: GoAppMethods;
    };
  };
}

function getGo(): GoAppMethods | null {
  const w = window as unknown as WailsWindow;
  const app = w.go?.main?.App;
  if (!app && isBrowserEnv()) {
    console.warn('[dev] 检测到浏览器环境，Wails bridge 不可用');
  }
  return app ?? null;
}

// ---------------------------------------------------------------------------
// Type-safe callGo helper
// ---------------------------------------------------------------------------

/**
 * Calls a method on the Go backend. The method name must be a valid key of
 * GoAppMethods, and the return type is inferred from the interface.
 */
function callGo<M extends keyof GoAppMethods>(
  method: M,
  ...args: Parameters<GoAppMethods[M]>
): ReturnType<GoAppMethods[M]> {
  const go = getGo();
  if (go && go[method]) {
    return (go[method] as (...a: Parameters<GoAppMethods[M]>) => ReturnType<GoAppMethods[M]>)(...args);
  }
  console.warn(`[dev] go.main.App.${method} not available`);
  throw new WailsBridgeError(method);
}

// ---------------------------------------------------------------------------
// Exported API functions
// ---------------------------------------------------------------------------

// Settings
export const getSettings = () => callGo('GetSettings');
export const saveSettings = (settings: GoSettings) => callGo('SaveSettings', settings);
export const updateSetting = (key: string, value: string | boolean | string[]) =>
  callGo('UpdateSetting', key, value);

// Sessions
export const getSessions = () => callGo('GetSessions');
export const createSession = (name: string, skillId: string) => callGo('CreateSession', name, skillId);
export const getSession = (id: string) => callGo('GetSession', id);
export const deleteSession = (id: string) => callGo('DeleteSession', id);

// Messages
export const sendMessage = (sessionId: string, input: string) => callGo('SendMessage', sessionId, input);
export const sendMessageEx = (sessionId: string, input: string, model: string, thinking: boolean) =>
  callGo('SendMessageEx', sessionId, input, model, thinking);
export const cancelRequest = () => callGo('CancelRequest');
export const cancelSessionRequest = (sessionId: string) => callGo('CancelSessionRequest', sessionId);

// Projects
export const getProjects = () => callGo('GetProjects');
export const addProject = (path: string) => callGo('AddProject', path);
export const removeProject = (path: string) => callGo('RemoveProject', path);
export const selectFolder = () => callGo('SelectFolder');
export const openInEditor = (dirPath: string) => callGo('OpenInEditor', dirPath);
export const setNoProjectMode = (enabled: boolean) => callGo('SetNoProjectMode', enabled);
export const getNoProjectMode = () => callGo('GetNoProjectMode');
export const setCurrentProject = (id: string) => callGo('SetCurrentProject', id);
export const getCurrentProject = () => callGo('GetCurrentProject');

// Files
export const listFiles = (path: string) => callGo('ListFiles', path);
export const readFile = (path: string) => callGo('ReadFile', path);
export const writeFile = (path: string, content: string) => callGo('WriteFile', path, content);
export const getWorkspaceFiles = (dirPath: string) => callGo('GetWorkspaceFiles', dirPath);
export const readFileContent = (filePath: string) => callGo('ReadFileContent', filePath);

// Config
export const getConfig = () => callGo('GetConfig');
export const setApiKey = (key: string) => callGo('SetAPIKey', key);

// Platform
export const getPlatform = () => callGo('GetPlatform');

// Editors
export const getAvailableEditors = () => callGo('GetAvailableEditors');
export const setPreferredEditor = (editorId: string) => callGo('SetPreferredEditor', editorId);

// Skills
export const getSkills = () => callGo('GetSkills');
export const createSkill = (name: string, description: string, prompt: string) =>
  callGo('CreateSkill', name, description, prompt);
export const deleteSkill = (id: string) => callGo('DeleteSkill', id);

// Tasks
export const getTasks = () => callGo('GetTasks');
export const createTask = (name: string, description: string, command: string, schedule: string) =>
  callGo('CreateTask', name, description, command, schedule);
export const runTaskNow = (id: string) => callGo('RunTaskNow', id);
export const toggleTask = (id: string, enabled: boolean) => callGo('ToggleTask', id, enabled);
export const deleteTask = (id: string) => callGo('DeleteTask', id);

// Archive
export const archiveSession = (id: string) => callGo('ArchiveSession', id);
export const getArchivedSessions = () => callGo('GetArchivedSessions');
export const resetMemory = () => callGo('ResetMemory');

// Memory
export const getMemoryStats = () => callGo('GetMemoryStats');
export const clearMemory = () => callGo('ClearMemory');

// Environment
export const getEnvVars = () => callGo('GetEnvVars');
export const addEnvVar = (key: string, value: string) => callGo('AddEnvVar', key, value);
export const removeEnvVar = (key: string) => callGo('RemoveEnvVar', key);

// Slash Commands
export const getSlashCommands = () => callGo('GetSlashCommands');
export const addSlashCommand = (name: string, description: string, fillText: string) =>
  callGo('AddSlashCommand', name, description, fillText);
export const updateSlashCommand = (id: string, name: string, description: string, fillText: string) =>
  callGo('UpdateSlashCommand', id, name, description, fillText);
export const removeSlashCommand = (id: string) => callGo('RemoveSlashCommand', id);

// MCP Servers
export const addMCPServer = (name: string, url: string) => callGo('AddMCPServer', name, url);
export const addMCPServerStdio = (name: string, command: string, args: string[]) =>
  callGo('AddMCPServerStdio', name, command, args);
export const removeMCPServer = (id: string) => callGo('RemoveMCPServer', id);
export const toggleMCPServer = (id: string, enabled: boolean) => callGo('ToggleMCPServer', id, enabled);

// Browser domains
export const addBlockedDomain = (domain: string) => callGo('AddBlockedDomain', domain);
export const removeBlockedDomain = (domain: string) => callGo('RemoveBlockedDomain', domain);
export const addAllowedDomain = (domain: string) => callGo('AddAllowedDomain', domain);
export const removeAllowedDomain = (domain: string) => callGo('RemoveAllowedDomain', domain);

// Window controls
export const windowMinimise = () => callGo('WindowMinimise');
export const windowMaximise = () => callGo('WindowMaximise');
export const windowClose = () => callGo('WindowClose');
export const popoutWindow = () => callGo('PopoutWindow');
export const windowSetAlwaysOnTop = (onTop: boolean) => callGo('WindowSetAlwaysOnTop', onTop);

// File selection
export const selectFile = () => callGo('SelectFile');
export const selectMultipleFiles = () => callGo('SelectMultipleFiles');

// Git
export const confirmGitCommit = (filePath: string) => callGo('ConfirmGitCommit', filePath);
export const getGitStatus = () => callGo('GetGitStatus');

// Computer Control
export const executeCommand = (command: string, timeoutSeconds?: number) =>
  callGo('ExecuteCommand', command, timeoutSeconds ?? 30);

// Selenium
export const checkSeleniumInstalled = () => callGo('CheckSeleniumInstalled');

// Browser
export const clearBrowserData = () => callGo('ClearBrowserData');

// MCP Servers - status
export const testMCPConnection = (id: string) => callGo('TestMCPServerConnection', id);
export const getMCPStatus = () => callGo('GetMCPStatus');

// Domain
export const isDomainBlocked = (url: string) => callGo('IsDomainBlocked', url);
export const getDomainRules = () => callGo('GetDomainRules');

// Popout
export const getPopoutState = () => callGo('GetPopoutState');
