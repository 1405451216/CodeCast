import { create } from 'zustand';
import * as api from '../api';
import type { WorkflowRunData, WorkflowEvent } from '../api/types';
import { logger } from '../utils/logger';

interface WorkflowSlice {
  runs: WorkflowRunData[];
  activeRunId: string | null;
  events: WorkflowEvent[];
  isLoading: boolean;
  error: string | null;

  loadRuns: () => Promise<void>;
  submitWorkflow: (json: string) => Promise<string | null>;
  pauseRun: (runId: string) => Promise<void>;
  resumeRun: (runId: string) => Promise<void>;
  cancelRun: (runId: string) => Promise<void>;
  appendEvent: (evt: WorkflowEvent) => void;
  clearEvents: () => void;
}

export const useWorkflowStore = create<WorkflowSlice>((set, get) => ({
  runs: [],
  activeRunId: null,
  events: [],
  isLoading: false,
  error: null,

  loadRuns: async () => {
    set({ isLoading: true, error: null });
    try {
      const runs = await api.listWorkflowExecutions();
      set({ runs, isLoading: false });
    } catch (e) {
      logger.error('WorkflowStore', 'Failed to load workflow runs', { error: e });
      set({ error: String(e), isLoading: false });
    }
  },

  submitWorkflow: async (json: string) => {
    set({ isLoading: true, error: null });
    try {
      const runId = await api.runWorkflow(json);
      set({ activeRunId: runId, isLoading: false });
      logger.info('WorkflowStore', 'Workflow submitted', { runId });
      // Refresh run list to include the new run
      await get().loadRuns();
      return runId;
    } catch (e) {
      logger.error('WorkflowStore', 'Failed to submit workflow', { error: e });
      set({ error: String(e), isLoading: false });
      return null;
    }
  },

  pauseRun: async (runId: string) => {
    try {
      await api.pauseWorkflow(runId);
      await get().loadRuns();
    } catch (e) {
      logger.error('WorkflowStore', 'Failed to pause workflow', { runId, error: e });
    }
  },

  resumeRun: async (runId: string) => {
    try {
      await api.resumeWorkflow(runId);
      await get().loadRuns();
    } catch (e) {
      logger.error('WorkflowStore', 'Failed to resume workflow', { runId, error: e });
    }
  },

  cancelRun: async (runId: string) => {
    try {
      await api.cancelWorkflow(runId);
      await get().loadRuns();
    } catch (e) {
      logger.error('WorkflowStore', 'Failed to cancel workflow', { runId, error: e });
    }
  },

  appendEvent: (evt) => {
    set((s) => ({ events: [evt, ...s.events].slice(0, 200) }));
  },

  clearEvents: () => set({ events: [] }),
}));
