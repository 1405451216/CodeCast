import { create } from 'zustand';

import { logger } from '../utils/logger';
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
import { createPerformanceSlice } from './usePerformanceStore';
import { createPluginSlice } from './usePluginStore';
import { createToolsSlice } from './useToolsStore';
import { createLifecycleSlice } from './useLifecycleStore';
import { createMetricsSlice } from './useMetricsStore';
import { createOrchestrationSlice } from './useOrchestrationStore';
import { createCostSlice } from './useCostStore';

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
import type { PerformanceSlice } from './usePerformanceStore';
import type { PluginSlice } from './usePluginStore';
import type { ToolsSlice } from './useToolsStore';
import type { LifecycleSlice } from './useLifecycleStore';
import type { MetricsSlice } from './useMetricsStore';
import type { OrchestrationSlice } from './useOrchestrationStore';
import type { CostSlice } from './useCostStore';
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
  AgentSlice,
  PerformanceSlice,
  PluginSlice,
  ToolsSlice,
  LifecycleSlice,
  MetricsSlice,
  OrchestrationSlice,
  CostSlice {
  isStreaming: boolean;
  setIsStreaming: (val: boolean) => void;
}

export const useAppStore = create<AppState>((set, _get, _api) => {
  logger.info('Store', '🏗️  Initializing AppState with all slices...');
  
  const startTime = performance.now();
  
  const sliceSet = set as unknown as SliceSet;
  const store = {
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
    ...createPerformanceSlice(sliceSet),
    ...createPluginSlice(sliceSet),
    ...createToolsSlice(sliceSet),
    ...createLifecycleSlice(sliceSet),
    ...createMetricsSlice(sliceSet),
    ...createOrchestrationSlice(sliceSet),
    ...createCostSlice(sliceSet),

    isStreaming: false,
    setIsStreaming: (val: boolean) => {
      logger.info('Store', `📡 Streaming state changed: ${val}`, { previousState: useAppStore.getState().isStreaming });
      set({ isStreaming: val });
    },
  };

  const endTime = performance.now();
  logger.info('Store', '✅ AppState initialized successfully', {
    duration: `${(endTime - startTime).toFixed(2)}ms`,
    totalSlices: 19,
    sliceNames: [
      'Session', 'Project', 'UI', 'Model', 'Attachment',
      'Todo', 'ChangedFiles', 'SlashCommands', 'Menu',
      'Platform', 'Messages', 'Agent', 'Performance', 'Plugin',
      'Tools', 'Lifecycle', 'Metrics', 'Orchestration', 'Cost'
    ]
  });

  return store;
});

export * from './types';
