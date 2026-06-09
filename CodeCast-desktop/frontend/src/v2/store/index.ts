import { create } from 'zustand';
import { createUISlice, type UISlice, type AppMode } from './slices/uiSlice';
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice';
import { createChatSlice, type ChatSlice } from './slices/chatSlice';
import { createModelSlice, type ModelSlice } from './slices/modelSlice';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
import { createCastToolSlice, type CastToolSlice } from './slices/castToolSlice';
import { createMemorySlice, type MemorySlice } from './slices/memorySlice';
import { createMCPSlice, type MCPSlice } from './slices/mcpSlice';
import { createGitSlice, type GitSlice } from './slices/gitSlice';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';
import { createErrorsSlice, type ErrorsSlice } from './slices/errorsSlice';
import { createNotificationSlice, type NotificationSlice } from './slices/notificationSlice';
import { createAgentSlice, type AgentSlice } from './slices/agentSlice';
import { createCostSlice, type CostSlice } from './slices/costSlice';
import { createWorkflowSlice, type WorkflowSlice } from './slices/workflowSlice';
import { createPluginSlice, type PluginSlice } from './slices/pluginSlice';
import { createUpdaterSlice, type UpdaterSlice } from './slices/updaterSlice';
import { createOrchestrationSlice, type OrchestrationSlice } from './slices/orchestrationSlice';
import { createRuntimeSlice, type RuntimeSlice } from './slices/runtimeSlice';
import { createCheckpointSlice, type CheckpointSlice } from './slices/checkpointSlice';
import { createSecuritySlice, type SecuritySlice } from './slices/securitySlice';
import { createTelemetrySlice, type TelemetrySlice } from './slices/telemetrySlice';
import { createAuthSlice, type AuthSlice } from './slices/authSlice';

export type AppState = & UISlice & SessionSlice & ChatSlice & ModelSlice & ProjectSlice & CastToolSlice & MemorySlice & MCPSlice & GitSlice & SettingsSlice & ErrorsSlice & NotificationSlice & AgentSlice & CostSlice & WorkflowSlice & PluginSlice & UpdaterSlice & OrchestrationSlice & RuntimeSlice & CheckpointSlice & SecuritySlice & TelemetrySlice & AuthSlice;
export type { AppMode };

export const useAppStore = create<AppState>()((...a) => ({
  ...createUISlice(...a),
  ...createSessionSlice(...a),
  ...createChatSlice(...a),
  ...createModelSlice(...a),
  ...createProjectSlice(...a),
  ...createCastToolSlice(...a),
  ...createMemorySlice(...a),
  ...createMCPSlice(...a),
  ...createGitSlice(...a),
  ...createSettingsSlice(...a),
  ...createErrorsSlice(...a),
  ...createNotificationSlice(...a),
  ...createAgentSlice(...a),
  ...createCostSlice(...a),
  ...createWorkflowSlice(...a),
  ...createPluginSlice(...a),
  ...createUpdaterSlice(...a),
  ...createOrchestrationSlice(...a),
  ...createRuntimeSlice(...a),
  ...createCheckpointSlice(...a),
  ...createSecuritySlice(...a),
  ...createTelemetrySlice(...a),
  ...createAuthSlice(...a),
}));
