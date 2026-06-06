// frontend/src/v2/wails/__mocks__/App.ts
// vitest 测试用的 Wails App mock — 与 Go 后端 1:1 对齐
import { vi } from 'vitest';

// Session
export const GetSessions          = vi.fn(async () => []);
export const GetSession           = vi.fn(async () => null);
export const CreateSession        = vi.fn(async () => ({ id: 'mock-sess-1', name: 'Mock', createdAt: Date.now(), skillID: '', mode: '', messages: [] }));
export const DeleteSession        = vi.fn(async () => undefined);
export const SearchSessions       = vi.fn(async () => []);
export const RenameSession        = vi.fn(async () => undefined);
export const GetSessionsByMode    = vi.fn(async () => []);
export const BatchDeleteSessions  = vi.fn(async () => []);
export const GetArchivedSessions  = vi.fn(async () => []);
export const ArchiveSession       = vi.fn(async () => undefined);
export const UnarchiveSession     = vi.fn(async () => undefined);
// Chat
export const SendMessage          = vi.fn(async () => []);
export const SendMessageEx        = vi.fn(async () => []);
export const SendMessageWithAttachments = vi.fn(async () => []);
export const CancelRequest        = vi.fn(() => undefined);
export const CancelSessionRequest = vi.fn(() => undefined);
// Cast tools
export const GetToolCatalog       = vi.fn(async () => []);
export const GetToolHistory       = vi.fn(async () => []);
export const InvokeCastTool       = vi.fn(async () => '{}');
export const ExtractStructured    = vi.fn(async () => '{}');
// Project
export const GetProjects          = vi.fn(async () => []);
export const AddProject           = vi.fn(async () => ({}));
export const RemoveProject        = vi.fn(async () => undefined);
export const SetCurrentProject    = vi.fn(() => undefined);
export const GetCurrentProject    = vi.fn(async () => null);
export const UpdateProjectInstructions = vi.fn(async () => undefined);
export const SetNoProjectMode     = vi.fn(() => undefined);
export const GetNoProjectMode     = vi.fn(async () => false);
// Files
export const ListFiles            = vi.fn(async () => []);
export const ReadFile             = vi.fn(async () => '');
export const WriteFile            = vi.fn(async () => undefined);
export const GetWorkspaceFiles    = vi.fn(async () => []);
export const ReadFileContent      = vi.fn(async () => '');
export const SelectFile           = vi.fn(async () => '');
export const SelectFolder         = vi.fn(async () => '');
// Skills
export const GetSkills            = vi.fn(async () => []);
export const CreateSkill          = vi.fn(async () => ({}));
export const DeleteSkill          = vi.fn(async () => undefined);
export const UpdateSkill          = vi.fn(async () => undefined);
// Settings / Config
export const GetSettings          = vi.fn(async () => ({}));
export const SaveSettings         = vi.fn(async () => undefined);
export const UpdateSetting        = vi.fn(async () => undefined);
export const GetConfig            = vi.fn(async () => ({}));
export const GetProviders         = vi.fn(async () => []);
export const GetProviderModels    = vi.fn(async () => []);
export const GetModelConfigs      = vi.fn(async () => []);
export const AddModelConfig       = vi.fn(async () => ({}));
export const UpdateModelConfig    = vi.fn(async () => undefined);
export const RemoveModelConfig    = vi.fn(async () => undefined);
export const ToggleModelConfig    = vi.fn(async () => undefined);
export const GetEnvVars           = vi.fn(async () => []);
export const AddEnvVar            = vi.fn(async () => undefined);
export const RemoveEnvVar         = vi.fn(async () => undefined);
export const GetSlashCommands     = vi.fn(async () => []);
export const AddSlashCommand      = vi.fn(async () => ({}));
export const UpdateSlashCommand   = vi.fn(async () => undefined);
export const RemoveSlashCommand   = vi.fn(async () => undefined);
// MCP
export const GetMCPStatus         = vi.fn(async () => []);
export const AddMCPServer         = vi.fn(async () => undefined);
export const AddMCPServerStdio    = vi.fn(async () => undefined);
export const RemoveMCPServer      = vi.fn(async () => undefined);
export const ToggleMCPServer      = vi.fn(async () => undefined);
export const TestMCPServerConnection = vi.fn(async () => ({ success: true }));
export const GetMCPServerTools    = vi.fn(async () => []);
// Git
export const GetGitStatus         = vi.fn(async () => null);
export const ConfirmGitCommit     = vi.fn(async () => undefined);
// Metrics / Cache / Lifecycle
export const GetAPMetricsSnapshot = vi.fn(async () => ({ llmTotalCalls: 0, llmTotalErrors: 0, toolTotalCalls: 0, toolTotalErrors: 0, totalTurns: 0, totalEpisodes: 0, activeAgents: 0, poolQueueLength: 0, memorySizeBytes: 0, llmLatencyP50: 0, llmLatencyP99: 0, toolLatencyP50: 0, toolLatencyP99: 0, tokenUsageByModel: {} }));
export const ClearCache           = vi.fn(async () => undefined);
export const GetLifecycleState    = vi.fn(async () => '');
export const GetAgentLifecycleStates = vi.fn(async () => ({}));
export const GetCacheStats        = vi.fn(async () => ({}));
export const SetCacheEnabled      = vi.fn(() => undefined);
export const GetSessionSummary    = vi.fn(async () => null);
// Agent
export const GetAgents            = vi.fn(async () => []);
export const GetAgentDetail       = vi.fn(async () => null);
export const CancelAgent          = vi.fn(async () => undefined);
export const CancelSessionAgents  = vi.fn(async () => undefined);
export const DispatchAgents       = vi.fn(async () => []);
// Notification
export const SendNotification     = vi.fn(() => undefined);
// Checkpoint
export const GetCheckpoints       = vi.fn(async () => []);
export const LoadCheckpoint       = vi.fn(async () => undefined);
export const DeleteCheckpoint     = vi.fn(async () => undefined);
export const ResolveCheckpoint    = vi.fn(() => undefined);
