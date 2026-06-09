// wails/adapter.ts — Wails Go binding adapter · 与 Go 后端方法签名 1:1 对齐
import * as App from '@wailsjs/go/main/App';

/**
 * Type-safe cast helper for Go/Wails binding return values.
 * Wraps `as unknown as Promise<T>` into a single function call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cast = <T,>(p: Promise<any>): Promise<T> => p as Promise<T>;
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
  list:          (): Promise<Session[]> => cast<Session[]>(App.GetSessions()),
  get:           (id: string): Promise<Session | null> => cast<Session | null>(App.GetSession(id)),
  create:        (name: string, skillID = '', mode = ''): Promise<Session> =>
                   cast<Session>(App.CreateSession(name, skillID, mode)),
  delete:        (id: string) => App.DeleteSession(id),
  search:        (keyword: string): Promise<Session[]> => cast<Session[]>(App.SearchSessions(keyword)),
  rename:        (id: string, newName: string) => App.RenameSession(id, newName),
  archive:       (id: string) => App.ArchiveSession(id),
  unarchive:     (id: string) => App.UnarchiveSession(id),
  listArchived:  (): Promise<Session[]> => cast<Session[]>(App.GetArchivedSessions()),
  listByMode:    (mode: string): Promise<Session[]> => cast<Session[]>(App.GetSessionsByMode(mode)),
  /**
   * Returns the IDs that failed to delete (e.g. not found). The empty
   * array signals a fully successful batch.
   */
  batchDelete:   (ids: string[]): Promise<string[]> => cast<string[]>(App.BatchDeleteSessions(ids)),
  export:        (id: string, format = ''): Promise<string> => App.ExportSession(id, format),
};

// ---- Chat ----
export const Chat = {
  send:   (sessionId: string, text: string, model = '', thinking = ''): Promise<Message[]> =>
            cast<Message[]>(App.SendMessageEx(sessionId, text, model, thinking)),
  cancel: (sessionId: string) => App.CancelSessionRequest(sessionId),
  sendWithAttachments: (sessionId: string, text: string, attachmentsJSON: string): Promise<Message[]> =>
            cast<Message[]>(App.SendMessageWithAttachments(sessionId, text, attachmentsJSON)),
  cancelAll: () => App.CancelRequest(),
  /**
   * Lower-level send. Prefer `send` (SendMessageEx) which accepts model +
   * thinking params. This wrapper exists for completeness so all 152
   * backend methods are reachable from the adapter.
   */
  sendRaw: (sessionId: string, text: string): Promise<Message[]> =>
             cast<Message[]>(App.SendMessage(sessionId, text)),
};

// ---- Models (通过 Settings + Config 管理，Go 无独立 SetModel) ----
export const Models = {
  providers:      (): Promise<ProviderPreset[]> => cast<ProviderPreset[]>(App.GetProviders()),
  providerModels: (providerID: string): Promise<string[]> => App.GetProviderModels(providerID),
  configs:        (): Promise<ModelConfigItem[]> => cast<ModelConfigItem[]>(App.GetModelConfigs()),
  addConfig:      (name: string, provider: string, model: string, apiKey: string, apiURL: string,
                   maxContext: number, toolRounds: number, multimodal: boolean): Promise<ModelConfigItem> =>
                    cast<ModelConfigItem>(App.AddModelConfig(name, provider, model, apiKey, apiURL, maxContext, toolRounds, multimodal)),
  updateConfig:   (id: string, name: string, provider: string, model: string, apiKey: string, apiURL: string,
                   maxContext: number, toolRounds: number, multimodal: boolean) =>
                    App.UpdateModelConfig(id, name, provider, model, apiKey, apiURL, maxContext, toolRounds, multimodal),
  removeConfig:   (id: string) => App.RemoveModelConfig(id),
  toggleConfig:   (id: string, enabled: boolean) => App.ToggleModelConfig(id, enabled),
  setCurrent:     (model: string) => App.UpdateSetting('llm_model', model),
};

// ---- Cast Tools ----
export const Cast = {
  catalog: (): Promise<ToolCatalogItem[]> => cast<ToolCatalogItem[]>(App.GetToolCatalog()),
  history: (sessionId: string, limit: number): Promise<CastInvocation[]> =>
             cast<CastInvocation[]>(App.GetToolHistory(sessionId, limit)),
  invoke:  (name: string, argsJSON: string): Promise<string> => App.InvokeCastTool(name, argsJSON),
  extract: (text: string, schemaName: string): Promise<string> => App.ExtractStructured(text, schemaName),
};

// ---- Projects ----
export const Projects = {
  list:       (): Promise<Project[]> => cast<Project[]>(App.GetProjects()),
  current:    (): Promise<Project | null> => cast<Project | null>(App.GetCurrentProject()),
  switch:     (id: string) => { App.SetCurrentProject(id); },
  add:        (path: string): Promise<Project> => cast<Project>(App.AddProject(path)),
  remove:     (path: string) => App.RemoveProject(path),
  updateInstructions: (id: string, instructions: string) => App.UpdateProjectInstructions(id, instructions),
  setNoProject: (enabled: boolean) => App.SetNoProjectMode(enabled),
  getNoProject: (): Promise<boolean> => App.GetNoProjectMode(),
};

// ---- Metrics ----
export const Metrics = {
  snapshot:   (): Promise<APMetricsSnapshot> => cast<APMetricsSnapshot>(App.GetAPMetricsSnapshot()),
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
  get:        (): Promise<SettingsType> => cast<SettingsType>(App.GetSettings()),
  save:       (s: SettingsType): Promise<void> => cast<void>(App.SaveSettings(s as any)), // Go Wails type has convertValues method
  updateKey:  (key: string, value: unknown) => App.UpdateSetting(key, value),
  config:     () => App.GetConfig(),
};

// ---- MCP ----
export const MCP = {
  status:     (): Promise<MCPStatusEntry[]> => cast<MCPStatusEntry[]>(App.GetMCPStatus()),
  add:        (name: string, url: string) => App.AddMCPServer(name, url),
  addStdio:   (name: string, command: string, args: string[]) => App.AddMCPServerStdio(name, command, args),
  remove:     (id: string) => App.RemoveMCPServer(id),
  toggle:     (id: string, enabled: boolean) => App.ToggleMCPServer(id, enabled),
  test:       (id: string): Promise<MCPConnectionResult> => cast<MCPConnectionResult>(App.TestMCPServerConnection(id)),
  tools:      (id: string): Promise<string[]> => App.GetMCPServerTools(id),
};

// ---- Git ----
export const Git = {
  status:        (): Promise<GitStatus | null> => cast<GitStatus | null>(App.GetGitStatus()),
  confirmCommit: (filePath: string) => App.ConfirmGitCommit(filePath),
};

// ---- Skills ----
export const Skills = {
  list:   (): Promise<Skill[]> => cast<Skill[]>(App.GetSkills()),
  create: (name: string, description: string, prompt: string): Promise<Skill> =>
            cast<Skill>(App.CreateSkill(name, description, prompt)),
  delete: (id: string) => App.DeleteSkill(id),
  update: (id: string, name: string, description: string, prompt: string) =>
            App.UpdateSkill(id, name, description, prompt),
  import: (jsonStr: string): Promise<Skill> =>
            cast<Skill>(App.ImportSkill(jsonStr)),
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
  list:             (sessionID: string): Promise<AgentInfo[]> => cast<AgentInfo[]>(App.GetAgents(sessionID)),
  detail:           (agentID: string): Promise<AgentInfo | null> => cast<AgentInfo | null>(App.GetAgentDetail(agentID)),
  cancel:           (agentID: string) => App.CancelAgent(agentID),
  cancelSession:    (sessionID: string) => App.CancelSessionAgents(sessionID),
  dispatch:         (tasksJSON: string): Promise<string[]> => cast<string[]>(App.DispatchAgents(tasksJSON)),
  lifecycleStates:  (): Promise<Record<string, string>> => cast<Record<string, string>>(App.GetAgentLifecycleStates()),
  /**
   * Returns the current lifecycle state of the *active* agent (no arg).
   * Per-agent breakdown is available via `Agent.list(sessionID)`.
   */
  lifecycleState:   (): Promise<string> => cast<string>(App.GetLifecycleState()),
};

// ---- Checkpoint ----
export const Checkpoint = {
  list:    (sessionID: string, limit: number): Promise<CheckpointInfo[]> =>
             cast<CheckpointInfo[]>(App.GetCheckpoints(sessionID, limit)),
  load:    (checkpointID: string) => App.LoadCheckpoint(checkpointID),
  remove:  (checkpointID: string) => App.DeleteCheckpoint(checkpointID),
  resolve: (checkpointID: string, approved: boolean) => App.ResolveCheckpoint(checkpointID, approved),
};

// ---- Browser ----
export const Browser = {
  isDomainBlocked:    (url: string): Promise<boolean> => App.IsDomainBlocked(url),
  getDomainRules:     (): Promise<Record<string, unknown>> => cast<Record<string, unknown>>(App.GetDomainRules()),
  addBlockedDomain:  (domain: string) => App.AddBlockedDomain(domain),
  removeBlockedDomain: (domain: string) => App.RemoveBlockedDomain(domain),
  addAllowedDomain:  (domain: string) => App.AddAllowedDomain(domain),
  removeAllowedDomain: (domain: string) => App.RemoveAllowedDomain(domain),
  clearBrowserData:  () => App.ClearBrowserData(),
  checkSelenium:     (): Promise<Record<string, unknown>> => cast<Record<string, unknown>>(App.CheckSeleniumInstalled()),
};

// ---- Plugin ----
export const Plugin = {
  list:    (): Promise<PluginInfoData[]> => cast<PluginInfoData[]>(App.ListPlugins()),
  load:    (path: string): Promise<PluginInfoData> => cast<PluginInfoData>(App.LoadPlugin(path)),
  unload:  (id: string) => App.UnloadPlugin(id),
  status:  (): Promise<PluginStatusData> => cast<PluginStatusData>(App.GetPluginStatus()),
  sendMessage: (agentID: string, content: string) => App.SendPluginMessage(agentID, content),
  broadcast: (content: string) => App.BroadcastMessage(content),
};

// ---- Workflow ----
export const Workflow = {
  run:    (json: string): Promise<string> => App.RunWorkflow(json, undefined as any),
  pause:  (runID: string) => App.PauseWorkflow(runID),
  resume: (runID: string) => App.ResumeWorkflow(runID),
  cancel: (runID: string) => App.CancelWorkflow(runID),
  getRun: (runID: string): Promise<WorkflowRunData | null> => cast<WorkflowRunData | null>(App.GetWorkflowRun(runID)),
  list:   (): Promise<WorkflowRunData[]> => cast<WorkflowRunData[]>(App.ListWorkflowExecutions()),
  export: (runID: string): Promise<string> => App.ExportWorkflow(runID).then((arr: number[]) => new TextDecoder().decode(new Uint8Array(arr))),
};

// ---- Orchestration ----
export const Orchestration = {
  codeReview:       (sessionID: string, code: string): Promise<CodeReviewResult> =>
                      cast<CodeReviewResult>(App.RunCodeReviewWorkflow(sessionID, code)),
  refactoring:      (sessionID: string, code: string): Promise<RefactoringResult> =>
                      cast<RefactoringResult>(App.RunRefactoringWorkflow(sessionID, code)),
  testPipeline:     (sessionID: string, code: string): Promise<TestPipelineResult> =>
                      cast<TestPipelineResult>(App.RunTestPipelineWorkflow(sessionID, code)),
  handoff:          (sessionID: string, message: string): Promise<string> =>
                      App.RunHandoffWorkflow(sessionID, message),
  parallelAnalysis: (sessionID: string, input: string): Promise<ParallelAnalysisResult> =>
                      cast<ParallelAnalysisResult>(App.RunParallelAnalysis(sessionID, input)),
  getStatus:        (runID: string): Promise<OrchestrationRun | null> =>
                      cast<OrchestrationRun | null>(App.GetWorkflowStatus(runID)),
  listRuns:         (): Promise<OrchestrationRun[]> =>
                      cast<OrchestrationRun[]>(App.ListWorkflowRuns()),
  cancelRun:        (runID: string) => App.CancelWorkflowRun(runID),
};

// ---- Updater ----
export const Updater = {
  currentVersion:  (): Promise<string> => App.GetCurrentVersion(),
  check:           (): Promise<UpdateInfo | null> => cast<UpdateInfo | null>(App.CheckForUpdate()),
  download:        (url: string): Promise<string> => App.DownloadUpdate(url),
  openDownloaded:  (path: string) => App.OpenDownloadedFile(path),
  openReleasePage: () => { App.OpenReleasePage(); },
  changelog:       (notes: string, version: string, publishedAt: string): Promise<Changelog> =>
                     cast<Changelog>(App.GetChangelog(notes, version, publishedAt)),
  history:         (): Promise<UpdateRecord[]> => cast<UpdateRecord[]>(App.GetUpdateHistory()),
  saveRecord:      (from: string, to: string, success: boolean, notes: string) =>
                     App.SaveUpdateRecord(from, to, success, notes),
  allReleases:     (limit: number): Promise<UpdateInfo[]> => cast<UpdateInfo[]>(App.GetAllReleases(limit)),
  silentDownload:  (url: string) => { App.SilentDownload(url); },
};

// ---- Cost ----
export const Cost = {
  summary:        (): Promise<CostSummaryData> => cast<CostSummaryData>(App.GetCostSummary()),
  reset:          () => { App.ResetCostTracker(); },
  budgetExceeded: (): Promise<boolean> => App.CheckBudgetExceeded(),
  getBudget:      (): Promise<BudgetConfig> => cast<BudgetConfig>(App.GetBudgetConfig()),
  setBudget:      (config: BudgetConfig) => { App.SetBudgetConfig(config as any); }, // Go Wails type has extra fields
  setLimit:       (maxUSD: number) => { App.SetBudgetLimit(maxUSD); },
};

// ---- Security ----
export const Security = {
  status:       (): Promise<SecurityStatus> => cast<SecurityStatus>(App.GetSecurityStatus()),
  rotateKey:    () => App.RotateEncryptionKey(),
  keyInfo:      (): Promise<Record<string, unknown>> => cast<Record<string, unknown>>(App.GetKeyRotationInfo()),
  checkAntivirus: (): Promise<Record<string, unknown>> => cast<Record<string, unknown>>(App.CheckAntivirusCompatibility()),
};

// ---- Telemetry ----
export const Telemetry = {
  status:        (): Promise<TelemetryStatus> => cast<TelemetryStatus>(App.GetTelemetryStatus()),
  toggle:        (enabled: boolean) => App.ToggleTelemetry(enabled),
  setEndpoint:   (endpoint: string) => App.SetTelemetryEndpoint(endpoint),
};

// ---- Document ----
export const Document = {
  ingest:        (dirPath: string, config: Record<string, unknown>): Promise<IngestionResult> =>
                   cast<IngestionResult>(App.IngestDirectory(dirPath, config as any)),
  status:        (): Promise<IngestionStatus> => cast<IngestionStatus>(App.GetIngestionStatus()),
};

// ---- Environment ----
export const Environment = {
  check:    (): Promise<EnvCheckReportData> => cast<EnvCheckReportData>(App.CheckEnvironment()),
  fixIssue: (name: string): Promise<string> => App.FixEnvironmentIssue(name),
};

// ---- Multimodal ----
export const Multimodal = {
  capabilities: (): Promise<MultimodalCapabilities> => cast<MultimodalCapabilities>(App.GetMultimodalCapabilities()),
  analyzeImage: (imagePath: string, prompt: string): Promise<ImageAnalysisResult> =>
                  cast<ImageAnalysisResult>(App.AnalyzeImage(imagePath, prompt)),
};

// ---- Window ----
export const Window = {
  minimise:     () => { App.WindowMinimise(); },
  maximise:     () => { App.WindowMaximise(); },
  close:        () => { App.WindowClose(); },
  platform:     (): Promise<string> => App.GetPlatform(),
  editors:      (): Promise<EditorInfo[]> => cast<EditorInfo[]>(App.GetAvailableEditors()),
  preferredEditor: (): Promise<string> => App.GetPreferredEditor(),
  setEditor:    (editorID: string) => App.SetPreferredEditor(editorID),
  openInEditor: (dirPath: string) => App.OpenInEditor(dirPath),
  popout:       () => App.PopoutWindow(),
  popoutState:  (): Promise<Record<string, unknown>> => cast<Record<string, unknown>>(App.GetPopoutState()),
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
  list:   (): Promise<Note[]> => cast<Note[]>(App.GetNotes()),
  create: (title: string, content: string, tags: string[]): Promise<Note> =>
            cast<Note>(App.CreateNote(title, content, tags)),
  update: (id: string, title: string, content: string, tags: string[]) =>
            App.UpdateNote(id, title, content, tags),
  delete: (id: string) => App.DeleteNote(id),
  search: (keyword: string): Promise<Note[]> => cast<Note[]>(App.SearchNotes(keyword)),
};

// ---- Guardrail 安全护栏 ----
export const Guardrail = {
  status:                (): Promise<GuardrailStatusData> => cast<GuardrailStatusData>(App.GetGuardrailStatus()),
  updateTopicConstraints: (topics: string[]) => App.UpdateTopicConstraints(topics),
  getTopicConstraints:    (): Promise<string[]> => cast<string[]>(App.GetTopicConstraints()),
  toggleSanitizer:        (enabled: boolean) => App.ToggleSanitizer(enabled),
  setSanitizerStrategy:   (strategy: string) => App.SetSanitizerStrategy(strategy),
};

// ---- Completions 代码补全 ----
export const Completions = {
  get: (req: CompletionRequest): Promise<CompletionResult> =>
         cast<CompletionResult>(App.GetCodeCompletions(req)),
};

// ---- GitHub Auth ----
export const GitHub = {
  login:      (): Promise<string> => App.StartGitHubLogin(),
  getUser:    (): Promise<GitHubUser | null> => cast<GitHubUser | null>(App.GetGitHubUser()),
  logout:     () => App.LogoutGitHub(),
  isLoggedIn: (): Promise<boolean> => App.IsGitHubLoggedIn(),
};
