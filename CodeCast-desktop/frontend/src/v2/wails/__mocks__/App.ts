// frontend/src/v2/wails/__mocks__/App.ts
// vitest 测试用的 Wails App mock
import { vi } from 'vitest';

export const GetSessions         = vi.fn(async () => []);
export const CreateSession       = vi.fn(async () => ({ id: 'mock-sess-1', title: 'Mock', projectId: '', createdAt: Date.now(), updatedAt: Date.now() }));
export const SwitchSession       = vi.fn(() => undefined);
export const DeleteSession       = vi.fn(() => undefined);
export const SendMessageEx       = vi.fn(async () => []);
export const CancelMessage       = vi.fn(() => undefined);
export const GetModels           = vi.fn(async () => [{ id: 'mock', name: 'Mock', apiUrl: '', defaultModel: 'mock', models: ['mock'] }]);
export const SetModel            = vi.fn(() => undefined);
export const GetCurrentModel     = vi.fn(async () => 'mock');
export const GetToolCatalog      = vi.fn(async () => []);
export const GetToolHistory      = vi.fn(async () => []);
export const InvokeCastTool      = vi.fn(async () => '{}');
export const GetProjects         = vi.fn(async () => []);
export const SwitchProject       = vi.fn(() => undefined);
export const GetAPMetricsSnapshot= vi.fn(async () => ({ llmTotalCalls: 0, llmTotalErrors: 0, toolTotalCalls: 0, toolTotalErrors: 0, totalTurns: 0, totalEpisodes: 0, activeAgents: 0, poolQueueLength: 0, memorySizeBytes: 0, tokenUsageByModel: {} }));
export const ClearCache          = vi.fn(() => undefined);
export const GetSettings         = vi.fn(async () => ({}));
export const SaveSettings        = vi.fn(() => undefined);
export const ListMCPServers      = vi.fn(async () => []);
export const ConnectMCP          = vi.fn(() => undefined);
export const DisconnectMCP       = vi.fn(() => undefined);
export const GetGitStatus        = vi.fn(async () => null);
export const GetGitBranches      = vi.fn(async () => []);
