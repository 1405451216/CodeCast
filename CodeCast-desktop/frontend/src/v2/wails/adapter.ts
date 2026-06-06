// wails/adapter.ts — Wails Go binding adapter · 与 Go 后端方法签名 1:1 对齐
import * as App from '@wailsjs/go/main/App';
import type {
  Session, Message, ProviderPreset, ModelConfigItem,
  ToolCatalogItem, CastInvocation, Project, Skill,
  MCPStatusEntry, MCPConnectionResult, GitStatus,
  Settings as SettingsType, APMetricsSnapshot,
  AgentInfo, CheckpointInfo,
} from './types';

// ---- Session ----
export const Sessions = {
  list:          (): Promise<Session[]> => App.GetSessions() as Promise<Session[]>,
  get:           (id: string): Promise<Session | null> => App.GetSession(id) as Promise<Session | null>,
  create:        (name: string, skillID = '', mode = ''): Promise<Session> =>
                   App.CreateSession(name, skillID, mode) as Promise<Session>,
  delete:        (id: string) => App.DeleteSession(id),
  search:        (keyword: string): Promise<Session[]> => App.SearchSessions(keyword) as Promise<Session[]>,
  rename:        (id: string, newName: string) => App.RenameSession(id, newName),
  archive:       (id: string) => App.ArchiveSession(id),
  unarchive:     (id: string) => App.UnarchiveSession(id),
  listArchived:  (): Promise<Session[]> => App.GetArchivedSessions() as Promise<Session[]>,
};

// ---- Chat ----
export const Chat = {
  send:   (sessionId: string, text: string, model = '', thinking = ''): Promise<Message[]> =>
            App.SendMessageEx(sessionId, text, model, thinking) as Promise<Message[]>,
  cancel: (sessionId: string) => App.CancelSessionRequest(sessionId),
  sendWithAttachments: (sessionId: string, text: string, attachmentsJSON: string): Promise<Message[]> =>
            App.SendMessageWithAttachments(sessionId, text, attachmentsJSON) as Promise<Message[]>,
  cancelAll: () => App.CancelRequest(),
};

// ---- Models (通过 Settings + Config 管理，Go 无独立 SetModel) ----
export const Models = {
  providers:      (): Promise<ProviderPreset[]> => App.GetProviders() as Promise<ProviderPreset[]>,
  providerModels: (providerID: string): Promise<string[]> => App.GetProviderModels(providerID),
  configs:        (): Promise<ModelConfigItem[]> => App.GetModelConfigs() as Promise<ModelConfigItem[]>,
  addConfig:      (name: string, provider: string, model: string, apiKey: string, apiURL: string,
                   maxContext: number, toolRounds: number, multimodal: boolean): Promise<ModelConfigItem> =>
                    App.AddModelConfig(name, provider, model, apiKey, apiURL, maxContext, toolRounds, multimodal) as Promise<ModelConfigItem>,
  updateConfig:   (id: string, name: string, provider: string, model: string, apiKey: string, apiURL: string,
                   maxContext: number, toolRounds: number, multimodal: boolean) =>
                    App.UpdateModelConfig(id, name, provider, model, apiKey, apiURL, maxContext, toolRounds, multimodal),
  removeConfig:   (id: string) => App.RemoveModelConfig(id),
  toggleConfig:   (id: string, enabled: boolean) => App.ToggleModelConfig(id, enabled),
  setCurrent:     (model: string) => App.UpdateSetting('llm_model', model),
};

// ---- Cast Tools ----
export const Cast = {
  catalog: (): Promise<ToolCatalogItem[]> => App.GetToolCatalog() as Promise<ToolCatalogItem[]>,
  history: (sessionId: string, limit: number): Promise<CastInvocation[]> =>
             App.GetToolHistory(sessionId, limit) as Promise<CastInvocation[]>,
  invoke:  (name: string, argsJSON: string): Promise<string> => App.InvokeCastTool(name, argsJSON),
  extract: (text: string, schemaName: string): Promise<string> => App.ExtractStructured(text, schemaName),
};

// ---- Projects ----
export const Projects = {
  list:       (): Promise<Project[]> => App.GetProjects() as Promise<Project[]>,
  current:    (): Promise<Project | null> => App.GetCurrentProject() as Promise<Project | null>,
  switch:     (id: string) => { App.SetCurrentProject(id); },
  add:        (path: string): Promise<Project> => App.AddProject(path) as Promise<Project>,
  remove:     (path: string) => App.RemoveProject(path),
  updateInstructions: (id: string, instructions: string) => App.UpdateProjectInstructions(id, instructions),
  setNoProject: (enabled: boolean) => App.SetNoProjectMode(enabled),
  getNoProject: (): Promise<boolean> => App.GetNoProjectMode(),
};

// ---- Metrics ----
export const Metrics = {
  snapshot:   (): Promise<APMetricsSnapshot> => App.GetAPMetricsSnapshot() as Promise<APMetricsSnapshot>,
  clearCache: () => App.ClearCache(),
  summary:    (sessionID: string) => App.GetSessionSummary(sessionID),
  cacheStats: () => App.GetCacheStats(),
  setCacheEnabled: (enabled: boolean) => App.SetCacheEnabled(enabled),
};

// ---- Settings ----
export const Settings = {
  get:        (): Promise<SettingsType> => App.GetSettings() as Promise<SettingsType>,
  save:       (s: SettingsType): Promise<void> => App.SaveSettings(s) as Promise<void>,
  updateKey:  (key: string, value: unknown) => App.UpdateSetting(key, value),
  config:     () => App.GetConfig(),
};

// ---- MCP ----
export const MCP = {
  status:     (): Promise<MCPStatusEntry[]> => App.GetMCPStatus() as Promise<MCPStatusEntry[]>,
  add:        (name: string, url: string) => App.AddMCPServer(name, url),
  addStdio:   (name: string, command: string, args: string[]) => App.AddMCPServerStdio(name, command, args),
  remove:     (id: string) => App.RemoveMCPServer(id),
  toggle:     (id: string, enabled: boolean) => App.ToggleMCPServer(id, enabled),
  test:       (id: string): Promise<MCPConnectionResult> => App.TestMCPServerConnection(id) as Promise<MCPConnectionResult>,
  tools:      (id: string): Promise<string[]> => App.GetMCPServerTools(id),
};

// ---- Git ----
export const Git = {
  status:        (): Promise<GitStatus | null> => App.GetGitStatus() as Promise<GitStatus | null>,
  confirmCommit: (filePath: string) => App.ConfirmGitCommit(filePath),
};

// ---- Skills ----
export const Skills = {
  list:   (): Promise<Skill[]> => App.GetSkills() as Promise<Skill[]>,
  create: (name: string, description: string, prompt: string): Promise<Skill> =>
            App.CreateSkill(name, description, prompt) as Promise<Skill>,
  delete: (id: string) => App.DeleteSkill(id),
  update: (id: string, name: string, description: string, prompt: string) =>
            App.UpdateSkill(id, name, description, prompt),
};

// ---- Files ----
export const Files = {
  list:      (path: string): Promise<string[]> => App.ListFiles(path),
  read:      (path: string): Promise<string> => App.ReadFile(path),
  write:     (path: string, content: string) => App.WriteFile(path, content),
  workspace: (dirPath: string): Promise<string[]> => App.GetWorkspaceFiles(dirPath),
  readContent: (filePath: string): Promise<string> => App.ReadFileContent(filePath),
  selectFile: (): Promise<string> => App.SelectFile(),
  selectFolder: (): Promise<string> => App.SelectFolder(),
};

// ---- Env / Slash Commands ----
export const EnvVars = {
  list:   () => App.GetEnvVars(),
  add:    (key: string, value: string) => App.AddEnvVar(key, value),
  remove: (key: string) => App.RemoveEnvVar(key),
};

export const SlashCommands = {
  list:   () => App.GetSlashCommands(),
  add:    (name: string, description: string, fillText: string) => App.AddSlashCommand(name, description, fillText),
  update: (id: string, name: string, description: string, fillText: string) => App.UpdateSlashCommand(id, name, description, fillText),
  remove: (id: string) => App.RemoveSlashCommand(id),
};

// ---- Agent ----
export const Agent = {
  list:             (sessionID: string): Promise<AgentInfo[]> => App.GetAgents(sessionID) as Promise<AgentInfo[]>,
  detail:           (agentID: string): Promise<AgentInfo | null> => App.GetAgentDetail(agentID) as Promise<AgentInfo | null>,
  cancel:           (agentID: string) => App.CancelAgent(agentID),
  cancelSession:    (sessionID: string) => App.CancelSessionAgents(sessionID),
  dispatch:         (tasksJSON: string): Promise<string[]> => App.DispatchAgents(tasksJSON) as Promise<string[]>,
};

// ---- Checkpoint ----
export const Checkpoint = {
  list:    (sessionID: string, limit: number): Promise<CheckpointInfo[]> =>
             App.GetCheckpoints(sessionID, limit) as Promise<CheckpointInfo[]>,
  load:    (checkpointID: string) => App.LoadCheckpoint(checkpointID),
  remove:  (checkpointID: string) => App.DeleteCheckpoint(checkpointID),
  resolve: (checkpointID: string, approved: boolean) => App.ResolveCheckpoint(checkpointID, approved),
};
