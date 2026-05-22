import { create } from 'zustand';

import { createSessionSlice } from './useSessionStore';
import { createProjectSlice } from './useProjectStore';
import { createUISlice } from './useUIStore';
import { createModelSlice } from './useModelStore';
import { createAttachmentSlice } from './useAttachmentStore';
import { createTodoSlice } from './useTodoStore';
import { createChangedFilesSlice } from './useChangedFilesStore';
import { createSlashCommandsSlice } from './useSlashCommandsStore';
import { createMenuSlice } from './useMenuStore';
import { createPlatformSlice } from './usePlatformStore';
import { createMessagesSlice } from './useMessagesStore';
import { createAgentSlice } from './useAgentStore';

import type { SessionSlice } from './useSessionStore';
import type { ProjectSlice } from './useProjectStore';
import type { UISlice } from './useUIStore';
import type { ModelSlice } from './useModelStore';
import type { AttachmentSlice } from './useAttachmentStore';
import type { TodoSlice } from './useTodoStore';
import type { ChangedFilesSlice } from './useChangedFilesStore';
import type { SlashCommandsSlice } from './useSlashCommandsStore';
import type { MenuSlice } from './useMenuStore';
import type { PlatformSlice } from './usePlatformStore';
import type { MessagesSlice } from './useMessagesStore';
import type { AgentSlice } from './useAgentStore';
import type { SliceSet } from './storeTypes';

export interface AppState extends
  SessionSlice,
  ProjectSlice,
  UISlice,
  ModelSlice,
  AttachmentSlice,
  TodoSlice,
  ChangedFilesSlice,
  SlashCommandsSlice,
  MenuSlice,
  PlatformSlice,
  MessagesSlice,
  AgentSlice {
  isStreaming: boolean;
  setIsStreaming: (val: boolean) => void;
}

export const useAppStore = create<AppState>((set, _get, _api) => {
  const sliceSet = set as unknown as SliceSet;
  return {
    ...createSessionSlice(sliceSet),
    ...createProjectSlice(sliceSet),
    ...createUISlice(sliceSet),
    ...createModelSlice(sliceSet),
    ...createAttachmentSlice(sliceSet),
    ...createTodoSlice(sliceSet),
    ...createChangedFilesSlice(sliceSet),
    ...createSlashCommandsSlice(sliceSet),
    ...createMenuSlice(sliceSet),
    ...createPlatformSlice(sliceSet),
    ...createMessagesSlice(sliceSet),
    ...createAgentSlice(sliceSet),

    isStreaming: false,
    setIsStreaming: (val) => set({ isStreaming: val }),
  };
});

export * from './types';
