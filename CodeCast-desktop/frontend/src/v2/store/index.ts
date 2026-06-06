import { create } from 'zustand';
import { createUISlice, type UISlice, type AppMode } from './slices/uiSlice';
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice';
import { createChatSlice, type ChatSlice } from './slices/chatSlice';
import { createModelSlice, type ModelSlice } from './slices/modelSlice';
import { createWorkspaceSlice, type WorkspaceSlice } from './slices/workspaceSlice';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice';
import { createCastSlice, type CastSlice } from './slices/castSlice';
import { createCastToolSlice, type CastToolSlice } from './slices/castToolSlice';
import { createMemorySlice, type MemorySlice } from './slices/memorySlice';
import { createMCPSlice, type MCPSlice } from './slices/mcpSlice';
import { createGitSlice, type GitSlice } from './slices/gitSlice';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice';
import { createErrorsSlice, type ErrorsSlice } from './slices/errorsSlice';

export type AppState = & UISlice & SessionSlice & ChatSlice & ModelSlice & WorkspaceSlice & ProjectSlice & CastSlice & CastToolSlice & MemorySlice & MCPSlice & GitSlice & SettingsSlice & ErrorsSlice;
export type { AppMode };

export const useAppStore = create<AppState>()((...a) => ({
  ...createUISlice(...a),
  ...createSessionSlice(...a),
  ...createChatSlice(...a),
  ...createModelSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createProjectSlice(...a),
  ...createCastSlice(...a),
  ...createCastToolSlice(...a),
  ...createMemorySlice(...a),
  ...createMCPSlice(...a),
  ...createGitSlice(...a),
  ...createSettingsSlice(...a),
  ...createErrorsSlice(...a),
}));
