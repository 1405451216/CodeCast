// wails/adapter.ts — Wails Go binding adapter · v2 集成版
import * as App from '@wailsjs/go/main/App';
import type { GitStatus, MCPServerStatus, Settings as SettingsType } from './types';

export const Sessions = {
  list:   () => App.GetSessions(),
  create: () => App.CreateSession(),
  switch: (id: string) => App.SwitchSession(id),
  delete: (id: string) => App.DeleteSession(id),
};

export const Chat = {
  send:   (sessionId: string, text: string, model = '', thinking = false) => App.SendMessageEx(sessionId, text, model, thinking),
  cancel: (sessionId: string) => App.CancelMessage(sessionId),
};

export const Models = {
  list:    () => App.GetModels(),
  set:     (model: string) => App.SetModel(model),
  current: () => App.GetCurrentModel(),
};

export const Cast = {
  catalog: () => App.GetToolCatalog(),
  history: (sessionId: string, limit: number) => App.GetToolHistory(sessionId, limit),
  invoke:  (name: string, argsJSON: string) => App.InvokeCastTool(name, argsJSON),
};

export const Projects = {
  list:   () => App.GetProjects(),
  switch: (id: string) => App.SwitchProject(id),
};

export const Metrics = {
  snapshot:   () => App.GetAPMetricsSnapshot(),
  clearCache: () => App.ClearCache(),
};

export const Settings = {
  get:  (): Promise<SettingsType> => App.GetSettings() as Promise<SettingsType>,
  save: (s: SettingsType): Promise<void> => Promise.resolve(App.SaveSettings(s)),
};

export const MCP = {
  list:       (): Promise<MCPServerStatus[]> => App.ListMCPServers() as Promise<MCPServerStatus[]>,
  connect:    (name: string) => App.ConnectMCP(name),
  disconnect: (name: string) => App.DisconnectMCP(name),
};

export const Git = {
  status:   (): Promise<GitStatus | null> => App.GetGitStatus() as Promise<GitStatus | null>,
  branches: (): Promise<string[]> => App.GetGitBranches(),
};
