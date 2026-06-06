// wails/adapter.ts — Wails Go binding adapter · 与 Go 后端方法签名 1:1 对齐
import * as App from '@wailsjs/go/main/App';
import type {
  Session, Message, ProviderPreset, ModelConfigItem,
  ToolCatalogItem, CastInvocation, Project, Skill,
  MCPStatusEntry, MCPConnectionResult, GitStatus,
  Settings as SettingsType, APMetricsSnapshot,
  AgentInfo, CheckpointInfo,
  PluginInfoData, PluginStatusData,
  WorkflowRunData,
  OrchestrationRun, CodeReviewResult, RefactoringResult, TestPipelineResult, ParallelAnalysisResult,
  UpdateInfo, UpdateRecord, Changelog,
  CostSummaryData, BudgetConfig,
  SecurityStatus,
  TelemetryStatus,
  IngestionResult, IngestionStatus,
  EnvCheckReportData,
  ImageAnalysisResult, MultimodalCapabilities,
  EditorInfo,
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

// ---- Browser ----
export const Browser = {
  isDomainBlocked:    (url: string): Promise<boolean> => App.IsDomainBlocked(url),
  getDomainRules:     (): Promise<Record<string, unknown>> => App.GetDomainRules() as Promise<Record<string, unknown>>,
  addBlockedDomain:  (domain: string) => App.AddBlockedDomain(domain),
  removeBlockedDomain: (domain: string) => App.RemoveBlockedDomain(domain),
  addAllowedDomain:  (domain: string) => App.AddAllowedDomain(domain),
  removeAllowedDomain: (domain: string) => App.RemoveAllowedDomain(domain),
  clearBrowserData:  () => App.ClearBrowserData(),
  checkSelenium:     (): Promise<Record<string, unknown>> => App.CheckSeleniumInstalled() as Promise<Record<string, unknown>>,
};

// ---- Plugin ----
export const Plugin = {
  list:    (): Promise<PluginInfoData[]> => App.ListPlugins() as Promise<PluginInfoData[]>,
  load:    (path: string): Promise<PluginInfoData> => App.LoadPlugin(path) as Promise<PluginInfoData>,
  unload:  (id: string) => App.UnloadPlugin(id),
  status:  (): Promise<PluginStatusData> => App.GetPluginStatus() as Promise<PluginStatusData>,
  sendMessage: (agentID: string, content: string) => App.SendPluginMessage(agentID, content),
  broadcast: (content: string) => App.BroadcastMessage(content),
};

// ---- Workflow ----
export const Workflow = {
  run:    (json: string): Promise<string> => App.RunWorkflow(json),
  pause:  (runID: string) => App.PauseWorkflow(runID),
  resume: (runID: string) => App.ResumeWorkflow(runID),
  cancel: (runID: string) => App.CancelWorkflow(runID),
  getRun: (runID: string): Promise<WorkflowRunData | null> => App.GetWorkflowRun(runID) as Promise<WorkflowRunData | null>,
  list:   (): Promise<WorkflowRunData[]> => App.ListWorkflowExecutions() as Promise<WorkflowRunData[]>,
  export: (runID: string): Promise<string> => App.ExportWorkflow(runID),
};

// ---- Orchestration ----
export const Orchestration = {
  codeReview:       (sessionID: string, code: string): Promise<CodeReviewResult> =>
                      App.RunCodeReviewWorkflow(sessionID, code) as Promise<CodeReviewResult>,
  refactoring:      (sessionID: string, code: string): Promise<RefactoringResult> =>
                      App.RunRefactoringWorkflow(sessionID, code) as Promise<RefactoringResult>,
  testPipeline:     (sessionID: string, code: string): Promise<TestPipelineResult> =>
                      App.RunTestPipelineWorkflow(sessionID, code) as Promise<TestPipelineResult>,
  handoff:          (sessionID: string, message: string): Promise<string> =>
                      App.RunHandoffWorkflow(sessionID, message),
  parallelAnalysis: (sessionID: string, input: string): Promise<ParallelAnalysisResult> =>
                      App.RunParallelAnalysis(sessionID, input) as Promise<ParallelAnalysisResult>,
  getStatus:        (runID: string): Promise<OrchestrationRun | null> =>
                      App.GetWorkflowStatus(runID) as Promise<OrchestrationRun | null>,
  listRuns:         (): Promise<OrchestrationRun[]> =>
                      App.ListWorkflowRuns() as Promise<OrchestrationRun[]>,
  cancelRun:        (runID: string) => App.CancelWorkflowRun(runID),
};

// ---- Updater ----
export const Updater = {
  currentVersion:  (): Promise<string> => App.GetCurrentVersion(),
  check:           (): Promise<UpdateInfo | null> => App.CheckForUpdate() as Promise<UpdateInfo | null>,
  download:        (url: string): Promise<string> => App.DownloadUpdate(url),
  openDownloaded:  (path: string) => App.OpenDownloadedFile(path),
  openReleasePage: () => { App.OpenReleasePage(); },
  changelog:       (notes: string, version: string, publishedAt: string): Promise<Changelog> =>
                     App.GetChangelog(notes, version, publishedAt) as Promise<Changelog>,
  history:         (): Promise<UpdateRecord[]> => App.GetUpdateHistory() as Promise<UpdateRecord[]>,
  saveRecord:      (from: string, to: string, success: boolean, notes: string) =>
                     App.SaveUpdateRecord(from, to, success, notes),
  allReleases:     (limit: number): Promise<UpdateInfo[]> => App.GetAllReleases(limit) as Promise<UpdateInfo[]>,
  silentDownload:  (url: string) => { App.SilentDownload(url); },
};

// ---- Cost ----
export const Cost = {
  summary:        (): Promise<CostSummaryData> => App.GetCostSummary() as Promise<CostSummaryData>,
  reset:          () => { App.ResetCostTracker(); },
  budgetExceeded: (): Promise<boolean> => App.CheckBudgetExceeded(),
  getBudget:      (): Promise<BudgetConfig> => App.GetBudgetConfig() as Promise<BudgetConfig>,
  setBudget:      (config: BudgetConfig) => { App.SetBudgetConfig(config); },
  setLimit:       (maxUSD: number) => { App.SetBudgetLimit(maxUSD); },
};

// ---- Security ----
export const Security = {
  status:       (): Promise<SecurityStatus> => App.GetSecurityStatus() as Promise<SecurityStatus>,
  rotateKey:    () => App.RotateEncryptionKey(),
  keyInfo:      (): Promise<Record<string, unknown>> => App.GetKeyRotationInfo() as Promise<Record<string, unknown>>,
  checkAntivirus: (): Promise<Record<string, unknown>> => App.CheckAntivirusCompatibility() as Promise<Record<string, unknown>>,
};

// ---- Telemetry ----
export const Telemetry = {
  status:        (): Promise<TelemetryStatus> => App.GetTelemetryStatus() as Promise<TelemetryStatus>,
  toggle:        (enabled: boolean) => App.ToggleTelemetry(enabled),
  setEndpoint:   (endpoint: string) => App.SetTelemetryEndpoint(endpoint),
};

// ---- Document ----
export const Document = {
  ingest:        (dirPath: string, config: Record<string, unknown>): Promise<IngestionResult> =>
                   App.IngestDirectory(dirPath, config) as Promise<IngestionResult>,
  status:        (): Promise<IngestionStatus> => App.GetIngestionStatus() as Promise<IngestionStatus>,
};

// ---- Environment ----
export const Environment = {
  check:    (): Promise<EnvCheckReportData> => App.CheckEnvironment() as Promise<EnvCheckReportData>,
  fixIssue: (name: string): Promise<string> => App.FixEnvironmentIssue(name),
};

// ---- Multimodal ----
export const Multimodal = {
  capabilities: (): Promise<MultimodalCapabilities> => App.GetMultimodalCapabilities() as Promise<MultimodalCapabilities>,
  analyzeImage: (imagePath: string, prompt: string): Promise<ImageAnalysisResult> =>
                  App.AnalyzeImage(imagePath, prompt) as Promise<ImageAnalysisResult>,
};

// ---- Window ----
export const Window = {
  minimise:     () => { App.WindowMinimise(); },
  maximise:     () => { App.WindowMaximise(); },
  close:        () => { App.WindowClose(); },
  platform:     (): Promise<string> => App.GetPlatform(),
  editors:      (): Promise<EditorInfo[]> => App.GetAvailableEditors() as Promise<EditorInfo[]>,
  preferredEditor: (): Promise<string> => App.GetPreferredEditor(),
  setEditor:    (editorID: string) => App.SetPreferredEditor(editorID),
  openInEditor: (dirPath: string) => App.OpenInEditor(dirPath),
  popout:       () => App.PopoutWindow(),
  popoutState:  (): Promise<Record<string, unknown>> => App.GetPopoutState() as Promise<Record<string, unknown>>,
  setAlwaysOnTop: (onTop: boolean) => { App.WindowSetAlwaysOnTop(onTop); },
};
