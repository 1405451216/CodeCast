// Type declarations for wailsjs/go/main/App — 与 Go 后端方法签名 1:1 对齐
// Session
export function GetSessions(): Promise<any[]>;
export function GetSession(id: string): Promise<any>;
export function CreateSession(name: string, skillID: string, mode: string): Promise<any>;
export function DeleteSession(id: string): Promise<void>;
export function SearchSessions(keyword: string): Promise<any[]>;
export function RenameSession(id: string, newName: string): Promise<void>;
export function GetSessionsByMode(mode: string): Promise<any[]>;
export function BatchDeleteSessions(ids: string[]): Promise<string[]>;
export function GetArchivedSessions(): Promise<any[]>;
export function ArchiveSession(id: string): Promise<void>;
export function UnarchiveSession(id: string): Promise<void>;
// Chat
export function SendMessage(sessionID: string, input: string): Promise<any[]>;
export function SendMessageEx(sessionID: string, input: string, model: string, thinking: string): Promise<any[]>;
export function SendMessageWithAttachments(sessionID: string, input: string, attachmentsJSON: string): Promise<any[]>;
export function CancelRequest(): void;
export function CancelSessionRequest(sessionID: string): void;
// Cast tools
export function GetToolCatalog(): Promise<any[]>;
export function GetToolHistory(sessionID: string, limit: number): Promise<any[]>;
export function InvokeCastTool(name: string, argsJSON: string): Promise<string>;
export function ExtractStructured(text: string, schemaName: string): Promise<string>;
// Project
export function GetProjects(): Promise<any[]>;
export function AddProject(path: string): Promise<any>;
export function RemoveProject(path: string): Promise<void>;
export function SetCurrentProject(id: string): void;
export function GetCurrentProject(): Promise<any>;
export function UpdateProjectInstructions(id: string, instructions: string): Promise<void>;
export function SetNoProjectMode(enabled: boolean): void;
export function GetNoProjectMode(): Promise<boolean>;
// Files
export function ListFiles(path: string): Promise<string[]>;
export function ReadFile(path: string): Promise<string>;
export function WriteFile(path: string, content: string): Promise<void>;
export function GetWorkspaceFiles(dirPath: string): Promise<string[]>;
export function ReadFileContent(filePath: string): Promise<string>;
export function SelectFile(): Promise<string>;
export function SelectFolder(): Promise<string>;
// Skills
export function GetSkills(): Promise<any[]>;
export function CreateSkill(name: string, description: string, prompt: string): Promise<any>;
export function DeleteSkill(id: string): Promise<void>;
export function UpdateSkill(id: string, name: string, description: string, prompt: string): Promise<void>;
// Settings / Config
export function GetSettings(): Promise<any>;
export function SaveSettings(s: any): Promise<void>;
export function UpdateSetting(key: string, value: any): Promise<void>;
export function GetConfig(): Promise<any>;
export function GetProviders(): Promise<any[]>;
export function GetProviderModels(providerID: string): Promise<string[]>;
export function GetModelConfigs(): Promise<any[]>;
export function AddModelConfig(name: string, provider: string, model: string, apiKey: string, apiURL: string, maxContext: number, toolRounds: number, multimodal: boolean): Promise<any>;
export function UpdateModelConfig(id: string, name: string, provider: string, model: string, apiKey: string, apiURL: string, maxContext: number, toolRounds: number, multimodal: boolean): Promise<void>;
export function RemoveModelConfig(id: string): Promise<void>;
export function ToggleModelConfig(id: string, enabled: boolean): Promise<void>;
export function GetEnvVars(): Promise<any[]>;
export function AddEnvVar(key: string, value: string): Promise<void>;
export function RemoveEnvVar(key: string): Promise<void>;
export function GetSlashCommands(): Promise<any[]>;
export function AddSlashCommand(name: string, description: string, fillText: string): Promise<any>;
export function UpdateSlashCommand(id: string, name: string, description: string, fillText: string): Promise<void>;
export function RemoveSlashCommand(id: string): Promise<void>;
// MCP
export function GetMCPStatus(): Promise<any[]>;
export function AddMCPServer(name: string, url: string): Promise<void>;
export function AddMCPServerStdio(name: string, command: string, args: string[]): Promise<void>;
export function RemoveMCPServer(id: string): Promise<void>;
export function ToggleMCPServer(id: string, enabled: boolean): Promise<void>;
export function TestMCPServerConnection(id: string): Promise<any>;
export function GetMCPServerTools(id: string): Promise<string[]>;
// Git
export function GetGitStatus(): Promise<any>;
export function ConfirmGitCommit(filePath: string): Promise<void>;
// Metrics / Cache / Lifecycle
export function GetAPMetricsSnapshot(): Promise<any>;
export function ClearCache(): Promise<void>;
export function GetLifecycleState(): Promise<string>;
export function GetAgentLifecycleStates(): Promise<any>;
export function GetCacheStats(): Promise<any>;
export function SetCacheEnabled(enabled: boolean): void;
export function GetSessionSummary(sessionID: string): Promise<any>;
// Agent
export function GetAgents(sessionID: string): Promise<any[]>;
export function GetAgentDetail(agentID: string): Promise<any>;
export function CancelAgent(agentID: string): Promise<void>;
export function CancelSessionAgents(sessionID: string): Promise<void>;
export function DispatchAgents(tasksJSON: string): Promise<string[]>;
// Notification
export function SendNotification(title: string, body: string, notifType: string): void;
// Checkpoint
export function GetCheckpoints(sessionID: string, limit: number): Promise<any[]>;
export function LoadCheckpoint(checkpointID: string): Promise<void>;
export function DeleteCheckpoint(checkpointID: string): Promise<void>;
export function ResolveCheckpoint(checkpointID: string, approved: boolean): void;
// Browser
export function IsDomainBlocked(url: string): Promise<boolean>;
export function GetDomainRules(): Promise<any>;
export function AddBlockedDomain(domain: string): Promise<void>;
export function RemoveBlockedDomain(domain: string): Promise<void>;
export function AddAllowedDomain(domain: string): Promise<void>;
export function RemoveAllowedDomain(domain: string): Promise<void>;
export function ClearBrowserData(): Promise<void>;
export function CheckSeleniumInstalled(): Promise<any>;
// Plugin
export function ListPlugins(): Promise<any[]>;
export function LoadPlugin(path: string): Promise<any>;
export function UnloadPlugin(id: string): Promise<void>;
export function GetPluginStatus(): Promise<any>;
export function SendPluginMessage(targetAgentID: string, content: string): Promise<void>;
export function BroadcastMessage(content: string): Promise<void>;
// Workflow
export function RunWorkflow(workflowJSON: string): Promise<string>;
export function PauseWorkflow(runID: string): Promise<void>;
export function ResumeWorkflow(runID: string): Promise<void>;
export function CancelWorkflow(runID: string): Promise<void>;
export function GetWorkflowRun(runID: string): Promise<any>;
export function ListWorkflowExecutions(): Promise<any[]>;
export function ExportWorkflow(runID: string): Promise<string>;
// Orchestration
export function RunCodeReviewWorkflow(sessionID: string, code: string): Promise<any>;
export function RunRefactoringWorkflow(sessionID: string, code: string): Promise<any>;
export function RunTestPipelineWorkflow(sessionID: string, code: string): Promise<any>;
export function RunHandoffWorkflow(sessionID: string, message: string): Promise<string>;
export function RunParallelAnalysis(sessionID: string, input: string): Promise<any>;
export function GetWorkflowStatus(runID: string): Promise<any>;
export function ListWorkflowRuns(): Promise<any[]>;
export function CancelWorkflowRun(runID: string): Promise<void>;
// Updater
export function GetCurrentVersion(): Promise<string>;
export function CheckForUpdate(): Promise<any>;
export function DownloadUpdate(downloadURL: string): Promise<string>;
export function OpenDownloadedFile(filePath: string): Promise<void>;
export function OpenReleasePage(): void;
export function GetChangelog(releaseNotes: string, version: string, publishedAt: string): Promise<any>;
export function GetUpdateHistory(): Promise<any[]>;
export function SaveUpdateRecord(fromVersion: string, toVersion: string, success: boolean, notes: string): Promise<void>;
export function GetAllReleases(limit: number): Promise<any[]>;
export function SilentDownload(downloadURL: string): void;
// Cost
export function GetCostSummary(): Promise<any>;
export function ResetCostTracker(): void;
export function CheckBudgetExceeded(): Promise<boolean>;
export function GetBudgetConfig(): Promise<any>;
export function SetBudgetConfig(budget: any): void;
export function SetBudgetLimit(maxCostUSD: number): void;
// Security
export function GetSecurityStatus(): Promise<any>;
export function RotateEncryptionKey(): Promise<void>;
export function GetKeyRotationInfo(): Promise<any>;
export function CheckAntivirusCompatibility(): Promise<any>;
// Telemetry
export function GetTelemetryStatus(): Promise<any>;
export function ToggleTelemetry(enabled: boolean): Promise<void>;
export function SetTelemetryEndpoint(endpoint: string): Promise<void>;
// Document
export function IngestDirectory(dirPath: string, cfg: any): Promise<any>;
export function GetIngestionStatus(): Promise<any>;
// Environment
export function CheckEnvironment(): Promise<any>;
export function FixEnvironmentIssue(name: string): Promise<string>;
// Multimodal
export function GetMultimodalCapabilities(): Promise<any>;
export function AnalyzeImage(imagePath: string, prompt: string): Promise<any>;
// Window
export function WindowMinimise(): void;
export function WindowMaximise(): void;
export function WindowClose(): void;
export function GetPlatform(): Promise<string>;
export function GetAvailableEditors(): Promise<any[]>;
export function GetPreferredEditor(): Promise<string>;
export function SetPreferredEditor(editorID: string): Promise<void>;
export function OpenInEditor(dirPath: string): Promise<void>;
export function PopoutWindow(): Promise<void>;
export function GetPopoutState(): Promise<any>;
export function WindowSetAlwaysOnTop(onTop: boolean): void;
