// Stub for wailsjs/go/main/App — dev-mode shim (Wails generates real bindings at build time)
// Session
export function GetSessions() { return Promise.resolve([]); }
export function GetSession() { return Promise.resolve(null); }
export function CreateSession() { return Promise.resolve({ id: 'dev', name: 'Dev Session', createdAt: Date.now(), skillID: '', mode: '', messages: [] }); }
export function DeleteSession() { return Promise.resolve(); }
export function SearchSessions() { return Promise.resolve([]); }
export function RenameSession() { return Promise.resolve(); }
export function GetSessionsByMode() { return Promise.resolve([]); }
export function BatchDeleteSessions() { return Promise.resolve([]); }
export function GetArchivedSessions() { return Promise.resolve([]); }
export function ArchiveSession() { return Promise.resolve(); }
export function UnarchiveSession() { return Promise.resolve(); }
// Chat
export function SendMessage() { return Promise.resolve([]); }
export function SendMessageEx() { return Promise.resolve([]); }
export function SendMessageWithAttachments() { return Promise.resolve([]); }
export function CancelRequest() {}
export function CancelSessionRequest() {}
// Cast tools
export function GetToolCatalog() { return Promise.resolve([]); }
export function GetToolHistory() { return Promise.resolve([]); }
export function InvokeCastTool() { return Promise.resolve('{}'); }
export function ExtractStructured() { return Promise.resolve('{}'); }
// Project
export function GetProjects() { return Promise.resolve([]); }
export function AddProject() { return Promise.resolve({}); }
export function RemoveProject() { return Promise.resolve(); }
export function SetCurrentProject() {}
export function GetCurrentProject() { return Promise.resolve(null); }
export function UpdateProjectInstructions() { return Promise.resolve(); }
export function SetNoProjectMode() {}
export function GetNoProjectMode() { return Promise.resolve(false); }
// Files
export function ListFiles() { return Promise.resolve([]); }
export function ReadFile() { return Promise.resolve(''); }
export function WriteFile() { return Promise.resolve(); }
export function GetWorkspaceFiles() { return Promise.resolve([]); }
export function ReadFileContent() { return Promise.resolve(''); }
export function SelectFile() { return Promise.resolve(''); }
export function SelectFolder() { return Promise.resolve(''); }
// Skills
export function GetSkills() { return Promise.resolve([]); }
export function CreateSkill() { return Promise.resolve({}); }
export function DeleteSkill() { return Promise.resolve(); }
export function UpdateSkill() { return Promise.resolve(); }
// Settings / Config
export function GetSettings() { return Promise.resolve({}); }
export function SaveSettings() { return Promise.resolve(); }
export function UpdateSetting() { return Promise.resolve(); }
export function GetConfig() { return Promise.resolve({}); }
export function GetProviders() { return Promise.resolve([]); }
export function GetProviderModels() { return Promise.resolve([]); }
export function GetModelConfigs() { return Promise.resolve([]); }
export function AddModelConfig() { return Promise.resolve({}); }
export function UpdateModelConfig() { return Promise.resolve(); }
export function RemoveModelConfig() { return Promise.resolve(); }
export function ToggleModelConfig() { return Promise.resolve(); }
export function GetEnvVars() { return Promise.resolve([]); }
export function AddEnvVar() { return Promise.resolve(); }
export function RemoveEnvVar() { return Promise.resolve(); }
export function GetSlashCommands() { return Promise.resolve([]); }
export function AddSlashCommand() { return Promise.resolve({}); }
export function UpdateSlashCommand() { return Promise.resolve(); }
export function RemoveSlashCommand() { return Promise.resolve(); }
// MCP
export function GetMCPStatus() { return Promise.resolve([]); }
export function AddMCPServer() { return Promise.resolve(); }
export function AddMCPServerStdio() { return Promise.resolve(); }
export function RemoveMCPServer() { return Promise.resolve(); }
export function ToggleMCPServer() { return Promise.resolve(); }
export function TestMCPServerConnection() { return Promise.resolve({}); }
export function GetMCPServerTools() { return Promise.resolve([]); }
// Git
export function GetGitStatus() { return Promise.resolve(null); }
export function ConfirmGitCommit() { return Promise.resolve(); }
// Metrics / Cache / Lifecycle
export function GetAPMetricsSnapshot() { return Promise.resolve({}); }
export function ClearCache() { return Promise.resolve(); }
export function GetLifecycleState() { return Promise.resolve(''); }
export function GetAgentLifecycleStates() { return Promise.resolve({}); }
export function GetCacheStats() { return Promise.resolve({}); }
export function SetCacheEnabled() {}
export function GetSessionSummary() { return Promise.resolve(null); }
// Agent
export function GetAgents() { return Promise.resolve([]); }
export function GetAgentDetail() { return Promise.resolve(null); }
export function CancelAgent() { return Promise.resolve(); }
export function CancelSessionAgents() { return Promise.resolve(); }
export function DispatchAgents() { return Promise.resolve([]); }
// Notification
export function SendNotification() {}
// Checkpoint
export function GetCheckpoints() { return Promise.resolve([]); }
export function LoadCheckpoint() { return Promise.resolve(); }
export function DeleteCheckpoint() { return Promise.resolve(); }
export function ResolveCheckpoint() {}
// Browser
export function IsDomainBlocked() { return Promise.resolve(false); }
export function GetDomainRules() { return Promise.resolve({}); }
export function AddBlockedDomain() { return Promise.resolve(); }
export function RemoveBlockedDomain() { return Promise.resolve(); }
export function AddAllowedDomain() { return Promise.resolve(); }
export function RemoveAllowedDomain() { return Promise.resolve(); }
export function ClearBrowserData() { return Promise.resolve(); }
export function CheckSeleniumInstalled() { return Promise.resolve({}); }
// Plugin
export function ListPlugins() { return Promise.resolve([]); }
export function LoadPlugin() { return Promise.resolve({}); }
export function UnloadPlugin() { return Promise.resolve(); }
export function GetPluginStatus() { return Promise.resolve({}); }
export function SendPluginMessage() { return Promise.resolve(); }
export function BroadcastMessage() { return Promise.resolve(); }
// Workflow
export function RunWorkflow() { return Promise.resolve(''); }
export function PauseWorkflow() { return Promise.resolve(); }
export function ResumeWorkflow() { return Promise.resolve(); }
export function CancelWorkflow() { return Promise.resolve(); }
export function GetWorkflowRun() { return Promise.resolve(null); }
export function ListWorkflowExecutions() { return Promise.resolve([]); }
export function ExportWorkflow() { return Promise.resolve(''); }
// Orchestration
export function RunCodeReviewWorkflow() { return Promise.resolve({}); }
export function RunRefactoringWorkflow() { return Promise.resolve({}); }
export function RunTestPipelineWorkflow() { return Promise.resolve({}); }
export function RunHandoffWorkflow() { return Promise.resolve(''); }
export function RunParallelAnalysis() { return Promise.resolve({}); }
export function GetWorkflowStatus() { return Promise.resolve(null); }
export function ListWorkflowRuns() { return Promise.resolve([]); }
export function CancelWorkflowRun() { return Promise.resolve(); }
// Updater
export function GetCurrentVersion() { return Promise.resolve('0.0.0'); }
export function CheckForUpdate() { return Promise.resolve(null); }
export function DownloadUpdate() { return Promise.resolve(''); }
export function OpenDownloadedFile() { return Promise.resolve(); }
export function OpenReleasePage() {}
export function GetChangelog() { return Promise.resolve({}); }
export function GetUpdateHistory() { return Promise.resolve([]); }
export function SaveUpdateRecord() { return Promise.resolve(); }
export function GetAllReleases() { return Promise.resolve([]); }
export function SilentDownload() {}
// Cost
export function GetCostSummary() { return Promise.resolve({}); }
export function ResetCostTracker() {}
export function CheckBudgetExceeded() { return Promise.resolve(false); }
export function GetBudgetConfig() { return Promise.resolve({}); }
export function SetBudgetConfig() {}
export function SetBudgetLimit() {}
// Security
export function GetSecurityStatus() { return Promise.resolve({}); }
export function RotateEncryptionKey() { return Promise.resolve(); }
export function GetKeyRotationInfo() { return Promise.resolve({}); }
export function CheckAntivirusCompatibility() { return Promise.resolve({}); }
// Telemetry
export function GetTelemetryStatus() { return Promise.resolve({}); }
export function ToggleTelemetry() { return Promise.resolve(); }
export function SetTelemetryEndpoint() { return Promise.resolve(); }
// Document
export function IngestDirectory() { return Promise.resolve({}); }
export function GetIngestionStatus() { return Promise.resolve({}); }
// Environment
export function CheckEnvironment() { return Promise.resolve({}); }
export function FixEnvironmentIssue() { return Promise.resolve(''); }
// Multimodal
export function GetMultimodalCapabilities() { return Promise.resolve({}); }
export function AnalyzeImage() { return Promise.resolve({}); }
// Window
export function WindowMinimise() {}
export function WindowMaximise() {}
export function WindowClose() {}
export function GetPlatform() { return Promise.resolve('windows'); }
export function GetAvailableEditors() { return Promise.resolve([]); }
export function GetPreferredEditor() { return Promise.resolve(''); }
export function SetPreferredEditor() { return Promise.resolve(); }
export function OpenInEditor() { return Promise.resolve(); }
export function PopoutWindow() { return Promise.resolve(); }
export function GetPopoutState() { return Promise.resolve({}); }
export function WindowSetAlwaysOnTop() {}
