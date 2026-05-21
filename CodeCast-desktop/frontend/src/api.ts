// API layer - communicates with Go backend via Wails bindings

interface GoApp {
  [method: string]: (...args: any[]) => Promise<any>;
}

function getGo(): GoApp | null {
  const w = window as any;
  return w.go?.main?.App ?? null;
}

export async function callGo<T = any>(method: string, ...args: any[]): Promise<T> {
  const go = getGo();
  if (go && go[method]) {
    return await go[method](...args);
  }
  console.warn(`[dev] go.main.App.${method} not available`);
  throw new Error('请在桌面应用中使用');
}

// Settings
export const getSettings = () => callGo('GetSettings');
export const saveSettings = (settings: any) => callGo('SaveSettings', settings);
export const updateSetting = (key: string, value: any) => callGo('UpdateSetting', key, value);

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
export const getNoProjectMode = () => callGo<boolean>('GetNoProjectMode');

// Files
export const listFiles = (path: string) => callGo('ListFiles', path);
export const readFile = (path: string) => callGo('ReadFile', path);
export const writeFile = (path: string, content: string) => callGo('WriteFile', path, content);
export const getWorkspaceFiles = (dirPath: string) => callGo('GetWorkspaceFiles', dirPath);
export const readFileContent = (filePath: string) => callGo('ReadFileContent', filePath);

// Config
export const getConfig = () => callGo('GetConfig');
export const setApiKey = (key: string) => callGo('SetAPIKey', key);

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
export const selectMultipleFiles = () => callGo<string[]>('SelectMultipleFiles');

// Git
export const confirmGitCommit = (filePath: string) => callGo('ConfirmGitCommit', filePath);
export const getGitStatus = () => callGo<Record<string, any>>('GetGitStatus');

// Computer Control
export const executeCommand = (command: string, timeoutSeconds?: number) =>
  callGo<string>('ExecuteCommand', command, timeoutSeconds ?? 30);

// Selenium
export const checkSeleniumInstalled = () => callGo<Record<string, any>>('CheckSeleniumInstalled');

// Browser
export const clearBrowserData = () => callGo('ClearBrowserData');

// MCP Servers
export const testMCPConnection = (id: string) => callGo<Record<string, any>>('TestMCPServerConnection', id);
export const getMCPStatus = () => callGo<Record<string, any>[]>('GetMCPStatus');

// Domain
export const isDomainBlocked = (url: string) => callGo<boolean>('IsDomainBlocked', url);
export const getDomainRules = () => callGo<Record<string, any>>('GetDomainRules');

// Popout
export const getPopoutState = () => callGo<Record<string, any>>('GetPopoutState');
