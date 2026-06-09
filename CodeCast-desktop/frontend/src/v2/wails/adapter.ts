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
  Note, CompletionRequest, CompletionResult,
  GuardrailStatusData, GitHubUser,
} from './types';

// ---- Session ----
export const Sessions = {
  list:          (): Promise<Session[]> => App.GetSessions() as unknown as Promise<Session[]>,
  get:           (id: string): Promise<Session | null> => App.GetSession(id) as unknown as Promise<Session | null>,
  create:        (name: string, skillID = '', mode = ''): Promise<Session> =>
                   App.CreateSession(name, skillID, mode) as unknown as Promise<Session>,
  delete:        (id: string) => App.DeleteSession(id),
  search:        (keyword: string): Promise<Session[]> => App.SearchSessions(keyword) as unknown as Promise<Session[]>,
  rename:        (id: string, newName: string) => App.RenameSession(id, newName),
  archive:       (id: string) => App.ArchiveSession(id),
  unarchive:     (id: string) => App.UnarchiveSession(id),
  listArchived:  (): Promise<Session[]> => App.GetArchivedSessions() as unknown as Promise<Session[]>,
  listByMode:    (mode: string): Promise<Session[]> => App.GetSessionsByMode(mode) as unknown as Promise<Session[]>,
  /**
   * Returns the IDs that failed to delete (e.g. not found). The empty
   * array signals a fully successful batch.
   */
  batchDelete:   (ids: string[]): Promise<string[]> => App.BatchDeleteSessions(ids) as unknown as Promise<string[]>,
  export:        (id: string, format = ''): Promise<string> => App.ExportSession(id, format),
};

// ---- Chat ----
export const Chat = {
  send:   (sessionId: string, text: string, model = '', thinking = ''): Promise<Message[]> =>
            App.SendMessageEx(sessionId, text, model, thinking) as unknown as Promise<Message[]>,
  cancel: (sessionId: string) => App.CancelSessionRequest(sessionId),
  sendWithAttachments: (sessionId: string, text: string, attachmentsJSON: string): Promise<Message[]> =>
            App.SendMessageWithAttachments(sessionId, text, attachmentsJSON) as unknown as Promise<Message[]>,
  cancelAll: () => App.CancelRequest(),
  /**
   * Lower-level send. Prefer `send` (SendMessageEx) which accepts model +
   * thinking params. This wrapper exists for completeness so all 152
   * backend methods are reachable from the adapter.
   */
  sendRaw: (sessionId: string, text: string): Promise<Message[]> =>
             App.SendMessage(sessionId, text) as unknown as Promise<Message[]>,
};

// ---- Models (通过 Settings + Config 管理，Go 无独立 SetModel) ----
export const Models = {
  providers:      (): Promise<ProviderPreset[]> => App.GetProviders() as unknown as Promise<ProviderPreset[]>,
  providerModels: (providerID: string): Promise<string[]> => App.GetProviderModels(providerID),
  configs:        (): Promise<ModelConfigItem[]> => App.GetModelConfigs() as unknown as Promise<ModelConfigItem[]>,
  addConfig:      (name: string, provider: string, model: string, apiKey: string, apiURL: string,
                   maxContext: number, toolRounds: number, multimodal: boolean): Promise<ModelConfigItem> =>
                    App.AddModelConfig(name, provider, model, apiKey, apiURL, maxContext, toolRounds, multimodal) as unknown as Promise<ModelConfigItem>,
  updateConfig:   (id: string, name: string, provider: string, model: string, apiKey: string, apiURL: string,
                   maxContext: number, toolRounds: number, multimodal: boolean) =>
                    App.UpdateModelConfig(id, name, provider, model, apiKey, apiURL, maxContext, toolRounds, multimodal),
  removeConfig:   (id: string) => App.RemoveModelConfig(id),
  toggleConfig:   (id: string, enabled: boolean) => App.ToggleModelConfig(id, enabled),
  setCurrent:     (model: string) => App.UpdateSetting('llm_model', model),
};

// ---- Cast Tools ----
export const Cast = {
  catalog: (): Promise<ToolCatalogItem[]> => App.GetToolCatalog() as unknown as Promise<ToolCatalogItem[]>,
  history: (sessionId: string, limit: number): Promise<CastInvocation[]> =>
             App.GetToolHistory(sessionId, limit) as unknown as Promise<CastInvocation[]>,
  invoke:  (name: string, argsJSON: string): Promise<string> => App.InvokeCastTool(name, argsJSON),
  extract: (text: string, schemaName: string): Promise<string> => App.ExtractStructured(text, schemaName),
};

// ---- Projects ----
export const Projects = {
  list:       (): Promise<Project[]> => App.GetProjects() as unknown as Promise<Project[]>,
  current:    (): Promise<Project | null> => App.GetCurrentProject() as unknown as Promise<Project | null>,
  switch:     (id: string) => { App.SetCurrentProject(id); },
  add:        (path: string): Promise<Project> => App.AddProject(path) as unknown as Promise<Project>,
  remove:     (path: string) => App.RemoveProject(path),
  updateInstructions: (id: string, instructions: string) => App.UpdateProjectInstructions(id, instructions),
  setNoProject: (enabled: boolean) => App.SetNoProjectMode(enabled),
  getNoProject: (): Promise<boolean> => App.GetNoProjectMode(),
};

// ---- Metrics ----
export const Metrics = {
  snapshot:   (): Promise<APMetricsSnapshot> => App.GetAPMetricsSnapshot() as unknown as Promise<APMetricsSnapshot>,
  clearCache: () => App.ClearCache(),
  summary:    (sessionID: string) => App.GetSessionSummary(sessionID),
  cacheStats: () => App.GetCacheStats(),
  setCacheEnabled: (enabled: boolean) => App.SetCacheEnabled(enabled),
  prometheusExport: (): Promise<string> => App.GetMetricsExportPrometheus(),
  invalidateCache:  (key: string) => App.InvalidateCacheKey(key),
  contextWindowConfig:   () => App.GetContextWindowConfig(),
  setContextWindowKeepLast: (keepLast: number) => App.SetContextWindowKeepLast(keepLast),
};

// ---- Settings ----
export const Settings = {
  get:        (): Promise<SettingsType> => App.GetSettings() as unknown as Promise<SettingsType>,
  save:       (s: SettingsType): Promise<void> => App.SaveSettings(s as any) as unknown as Promise<void>,
  updateKey:  (key: string, value: unknown) => App.UpdateSetting(key, value),
  config:     () => App.GetConfig(),
};

// ---- MCP ----
export const MCP = {
  status:     (): Promise<MCPStatusEntry[]> => App.GetMCPStatus() as unknown as Promise<MCPStatusEntry[]>,
  add:        (name: string, url: string) => App.AddMCPServer(name, url),
  addStdio:   (name: string, command: string, args: string[]) => App.AddMCPServerStdio(name, command, args),
  remove:     (id: string) => App.RemoveMCPServer(id),
  toggle:     (id: string, enabled: boolean) => App.ToggleMCPServer(id, enabled),
  test:       (id: string): Promise<MCPConnectionResult> => App.TestMCPServerConnection(id) as unknown as Promise<MCPConnectionResult>,
  tools:      (id: string): Promise<string[]> => App.GetMCPServerTools(id),
};

// ---- Git ----
export const Git = {
  status:        (): Promise<GitStatus | null> => App.GetGitStatus() as unknown as Promise<GitStatus | null>,
  confirmCommit: (filePath: string) => App.ConfirmGitCommit(filePath),
};

// ---- Skills ----
export const Skills = {
  list:   (): Promise<Skill[]> => App.GetSkills() as unknown as Promise<Skill[]>,
  create: (name: string, description: string, prompt: string): Promise<Skill> =>
            App.CreateSkill(name, description, prompt) as unknown as Promise<Skill>,
  delete: (id: string) => App.DeleteSkill(id),
  update: (id: string, name: string, description: string, prompt: string) =>
            App.UpdateSkill(id, name, description, prompt),
  import: (jsonStr: string): Promise<Skill> =>
            App.ImportSkill(jsonStr) as unknown as Promise<Skill>,
};

// ---- Files ----
export const Files = {
  list:      (path: string): Promise<string[]> => App.ListFiles(path),
  read:      (path: string): Promise<string> => App.ReadFile(path),
  write:     (path: string, content: string) => App.WriteFile(path, content),
  workspace: (dirPath: string): Promise<string[]> => App.GetWorkspaceFiles(dirPath),
  readContent: (filePath: string): Promise<string> => App.ReadFileContent(filePath),
  selectFile: (): Promise<string> => App.SelectFile(),
  selectMultipleFiles: (): Promise<string[]> => App.SelectMultipleFiles(),
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
  list:             (sessionID: string): Promise<AgentInfo[]> => App.GetAgents(sessionID) as unknown as Promise<AgentInfo[]>,
  detail:           (agentID: string): Promise<AgentInfo | null> => App.GetAgentDetail(agentID) as unknown as Promise<AgentInfo | null>,
  cancel:           (agentID: string) => App.CancelAgent(agentID),
  cancelSession:    (sessionID: string) => App.CancelSessionAgents(sessionID),
  dispatch:         (tasksJSON: string): Promise<string[]> => App.DispatchAgents(tasksJSON) as unknown as Promise<string[]>,
  lifecycleStates:  (): Promise<Record<string, string>> => App.GetAgentLifecycleStates() as unknown as Promise<Record<string, string>>,
  /**
   * Returns the current lifecycle state of the *active* agent (no arg).
   * Per-agent breakdown is available via `Agent.list(sessionID)`.
   */
  lifecycleState:   (): Promise<string> => App.GetLifecycleState() as unknown as Promise<string>,
};

// ---- Checkpoint ----
export const Checkpoint = {
  list:    (sessionID: string, limit: number): Promise<CheckpointInfo[]> =>
             App.GetCheckpoints(sessionID, limit) as unknown as Promise<CheckpointInfo[]>,
  load:    (checkpointID: string) => App.LoadCheckpoint(checkpointID),
  remove:  (checkpointID: string) => App.DeleteCheckpoint(checkpointID),
  resolve: (checkpointID: string, approved: boolean) => App.ResolveCheckpoint(checkpointID, approved),
};

// ---- Browser ----
export const Browser = {
  isDomainBlocked:    (url: string): Promise<boolean> => App.IsDomainBlocked(url),
  getDomainRules:     (): Promise<Record<string, unknown>> => App.GetDomainRules() as unknown as Promise<Record<string, unknown>>,
  addBlockedDomain:  (domain: string) => App.AddBlockedDomain(domain),
  removeBlockedDomain: (domain: string) => App.RemoveBlockedDomain(domain),
  addAllowedDomain:  (domain: string) => App.AddAllowedDomain(domain),
  removeAllowedDomain: (domain: string) => App.RemoveAllowedDomain(domain),
  clearBrowserData:  () => App.ClearBrowserData(),
  checkSelenium:     (): Promise<Record<string, unknown>> => App.CheckSeleniumInstalled() as unknown as Promise<Record<string, unknown>>,
};

// ---- Plugin ----
export const Plugin = {
  list:    (): Promise<PluginInfoData[]> => App.ListPlugins() as unknown as Promise<PluginInfoData[]>,
  load:    (path: string): Promise<PluginInfoData> => App.LoadPlugin(path) as unknown as Promise<PluginInfoData>,
  unload:  (id: string) => App.UnloadPlugin(id),
  status:  (): Promise<PluginStatusData> => App.GetPluginStatus() as unknown as Promise<PluginStatusData>,
  sendMessage: (agentID: string, content: string) => App.SendPluginMessage(agentID, content),
  broadcast: (content: string) => App.BroadcastMessage(content),
};

// ---- Workflow ----
export const Workflow = {
  run:    (json: string): Promise<string> => App.RunWorkflow(json, undefined as any),
  pause:  (runID: string) => App.PauseWorkflow(runID),
  resume: (runID: string) => App.ResumeWorkflow(runID),
  cancel: (runID: string) => App.CancelWorkflow(runID),
  getRun: (runID: string): Promise<WorkflowRunData | null> => App.GetWorkflowRun(runID) as unknown as Promise<WorkflowRunData | null>,
  list:   (): Promise<WorkflowRunData[]> => App.ListWorkflowExecutions() as unknown as Promise<WorkflowRunData[]>,
  export: (runID: string): Promise<string> => App.ExportWorkflow(runID).then((arr: number[]) => new TextDecoder().decode(new Uint8Array(arr))),
};

// ---- Orchestration ----
export const Orchestration = {
  codeReview:       (sessionID: string, code: string): Promise<CodeReviewResult> =>
                      App.RunCodeReviewWorkflow(sessionID, code) as unknown as Promise<CodeReviewResult>,
  refactoring:      (sessionID: string, code: string): Promise<RefactoringResult> =>
                      App.RunRefactoringWorkflow(sessionID, code) as unknown as Promise<RefactoringResult>,
  testPipeline:     (sessionID: string, code: string): Promise<TestPipelineResult> =>
                      App.RunTestPipelineWorkflow(sessionID, code) as unknown as Promise<TestPipelineResult>,
  handoff:          (sessionID: string, message: string): Promise<string> =>
                      App.RunHandoffWorkflow(sessionID, message),
  parallelAnalysis: (sessionID: string, input: string): Promise<ParallelAnalysisResult> =>
                      App.RunParallelAnalysis(sessionID, input) as unknown as Promise<ParallelAnalysisResult>,
  getStatus:        (runID: string): Promise<OrchestrationRun | null> =>
                      App.GetWorkflowStatus(runID) as unknown as Promise<OrchestrationRun | null>,
  listRuns:         (): Promise<OrchestrationRun[]> =>
                      App.ListWorkflowRuns() as unknown as Promise<OrchestrationRun[]>,
  cancelRun:        (runID: string) => App.CancelWorkflowRun(runID),
};

// ---- Updater ----
export const Updater = {
  currentVersion:  (): Promise<string> => App.GetCurrentVersion(),
  check:           (): Promise<UpdateInfo | null> => App.CheckForUpdate() as unknown as Promise<UpdateInfo | null>,
  download:        (url: string): Promise<string> => App.DownloadUpdate(url),
  openDownloaded:  (path: string) => App.OpenDownloadedFile(path),
  openReleasePage: () => { App.OpenReleasePage(); },
  changelog:       (notes: string, version: string, publishedAt: string): Promise<Changelog> =>
                     App.GetChangelog(notes, version, publishedAt) as unknown as Promise<Changelog>,
  history:         (): Promise<UpdateRecord[]> => App.GetUpdateHistory() as unknown as Promise<UpdateRecord[]>,
  saveRecord:      (from: string, to: string, success: boolean, notes: string) =>
                     App.SaveUpdateRecord(from, to, success, notes),
  allReleases:     (limit: number): Promise<UpdateInfo[]> => App.GetAllReleases(limit) as unknown as Promise<UpdateInfo[]>,
  silentDownload:  (url: string) => { App.SilentDownload(url); },
};

// ---- Cost ----
export const Cost = {
  summary:        (): Promise<CostSummaryData> => App.GetCostSummary() as unknown as Promise<CostSummaryData>,
  reset:          () => { App.ResetCostTracker(); },
  budgetExceeded: (): Promise<boolean> => App.CheckBudgetExceeded(),
  getBudget:      (): Promise<BudgetConfig> => App.GetBudgetConfig() as unknown as Promise<BudgetConfig>,
  setBudget:      (config: BudgetConfig) => { App.SetBudgetConfig(config as any); },
  setLimit:       (maxUSD: number) => { App.SetBudgetLimit(maxUSD); },
};

// ---- Security ----
export const Security = {
  status:       (): Promise<SecurityStatus> => App.GetSecurityStatus() as unknown as Promise<SecurityStatus>,
  rotateKey:    () => App.RotateEncryptionKey(),
  keyInfo:      (): Promise<Record<string, unknown>> => App.GetKeyRotationInfo() as unknown as Promise<Record<string, unknown>>,
  checkAntivirus: (): Promise<Record<string, unknown>> => App.CheckAntivirusCompatibility() as unknown as Promise<Record<string, unknown>>,
};

// ---- Telemetry ----
export const Telemetry = {
  status:        (): Promise<TelemetryStatus> => App.GetTelemetryStatus() as unknown as Promise<TelemetryStatus>,
  toggle:        (enabled: boolean) => App.ToggleTelemetry(enabled),
  setEndpoint:   (endpoint: string) => App.SetTelemetryEndpoint(endpoint),
};

// ---- Document ----
export const Document = {
  ingest:        (dirPath: string, config: Record<string, unknown>): Promise<IngestionResult> =>
                   App.IngestDirectory(dirPath, config as any) as unknown as Promise<IngestionResult>,
  status:        (): Promise<IngestionStatus> => App.GetIngestionStatus() as unknown as Promise<IngestionStatus>,
};

// ---- Environment ----
export const Environment = {
  check:    (): Promise<EnvCheckReportData> => App.CheckEnvironment() as unknown as Promise<EnvCheckReportData>,
  fixIssue: (name: string): Promise<string> => App.FixEnvironmentIssue(name),
};

// ---- Multimodal ----
export const Multimodal = {
  capabilities: (): Promise<MultimodalCapabilities> => App.GetMultimodalCapabilities() as unknown as Promise<MultimodalCapabilities>,
  analyzeImage: (imagePath: string, prompt: string): Promise<ImageAnalysisResult> =>
                  App.AnalyzeImage(imagePath, prompt) as unknown as Promise<ImageAnalysisResult>,
};

// ---- Window ----
export const Window = {
  minimise:     () => { App.WindowMinimise(); },
  maximise:     () => { App.WindowMaximise(); },
  close:        () => { App.WindowClose(); },
  platform:     (): Promise<string> => App.GetPlatform(),
  editors:      (): Promise<EditorInfo[]> => App.GetAvailableEditors() as unknown as Promise<EditorInfo[]>,
  preferredEditor: (): Promise<string> => App.GetPreferredEditor(),
  setEditor:    (editorID: string) => App.SetPreferredEditor(editorID),
  openInEditor: (dirPath: string) => App.OpenInEditor(dirPath),
  popout:       () => App.PopoutWindow(),
  popoutState:  (): Promise<Record<string, unknown>> => App.GetPopoutState() as unknown as Promise<Record<string, unknown>>,
  setAlwaysOnTop: (onTop: boolean) => { App.WindowSetAlwaysOnTop(onTop); },
};

// ---- Notification ----
// Push a notification to the OS / in-app inbox. Mirrors the backend
// SendNotification Go binding (title, body, notifType) so the frontend
// can trigger its own toasts without relying on backend Wails events.
export const Notification = {
  send: (title: string, body: string, notifType: string) => {
    App.SendNotification(title, body, notifType);
  },
};

// ---- InferenceConfig 推理配置 ----
export const InferenceConfig = {
  get: (): Promise<any> => App.GetInferenceConfig(),
  save: (cfg: any): Promise<void> => App.UpdateInferenceConfig(cfg),
  reset: (): Promise<void> => App.ResetInferenceConfig(),
};

// ---- Notes 笔记 ----
export const Notes = {
  list:   (): Promise<Note[]> => App.GetNotes() as unknown as Promise<Note[]>,
  create: (title: string, content: string, tags: string[]): Promise<Note> =>
            App.CreateNote(title, content, tags) as unknown as Promise<Note>,
  update: (id: string, title: string, content: string, tags: string[]) =>
            App.UpdateNote(id, title, content, tags),
  delete: (id: string) => App.DeleteNote(id),
  search: (keyword: string): Promise<Note[]> => App.SearchNotes(keyword) as unknown as Promise<Note[]>,
};

// ---- Guardrail 安全护栏 ----
export const Guardrail = {
  status:                (): Promise<GuardrailStatusData> => App.GetGuardrailStatus() as unknown as Promise<GuardrailStatusData>,
  updateTopicConstraints: (topics: string[]) => App.UpdateTopicConstraints(topics),
  getTopicConstraints:    (): Promise<string[]> => App.GetTopicConstraints() as unknown as Promise<string[]>,
  toggleSanitizer:        (enabled: boolean) => App.ToggleSanitizer(enabled),
  setSanitizerStrategy:   (strategy: string) => App.SetSanitizerStrategy(strategy),
};

// ---- Completions 代码补全 ----
export const Completions = {
  get: (req: CompletionRequest): Promise<CompletionResult> =>
         App.GetCodeCompletions(req) as unknown as Promise<CompletionResult>,
};

// ---- GitHub Auth ----
export const GitHub = {
  login:      (): Promise<string> => App.StartGitHubLogin(),
  getUser:    (): Promise<GitHubUser | null> => App.GetGitHubUser() as unknown as Promise<GitHubUser | null>,
  logout:     () => App.LogoutGitHub(),
  isLoggedIn: (): Promise<boolean> => App.IsGitHubLoggedIn(),
  /** 配置 OAuth 凭据（无需重启），从设置页面调用 */
  setCredentials: (clientID: string, clientSecret: string) =>
    App.SetGitHubOAuthCredentials(clientID, clientSecret),
  /** 获取 OAuth 配置状态 */
  getOAuthStatus: (): Promise<{client_id_set: boolean; client_secret_set: boolean; client_id_hint: string; logged_in: boolean}> =>
    App.GetGitHubOAuthStatus() as unknown as Promise<any>,
};
