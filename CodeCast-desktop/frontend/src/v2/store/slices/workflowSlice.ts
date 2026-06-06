// frontend/src/v2/store/slices/workflowSlice.ts
import type { StateCreator } from 'zustand';
import type { WorkflowRunData } from '../../wails/types';
import { Workflow } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface WorkflowSlice {
  workflowRuns: WorkflowRunData[];
  currentRun: WorkflowRunData | null;
  workflowLoading: boolean;
  refreshWorkflows: () => Promise<void>;
  getRun: (runID: string) => Promise<void>;
  runWorkflow: (json: string) => Promise<string>;
  pauseWorkflow: (runID: string) => Promise<void>;
  resumeWorkflow: (runID: string) => Promise<void>;
  cancelWorkflow: (runID: string) => Promise<void>;
  exportWorkflow: (runID: string) => Promise<string>;
}

export const createWorkflowSlice: StateCreator<WorkflowSlice, [], [], WorkflowSlice> = (set) => ({
  workflowRuns: [],
  currentRun: null,
  workflowLoading: false,

  refreshWorkflows: async () => {
    set({ workflowLoading: true });
    try {
      set({ workflowRuns: await Workflow.list(), workflowLoading: false });
    } catch (e) {
      set({ workflowLoading: false });
      reportError('workflow', e);
    }
  },

  getRun: async (runID) => {
    set({ workflowLoading: true });
    try {
      set({ currentRun: await Workflow.getRun(runID), workflowLoading: false });
    } catch (e) {
      set({ workflowLoading: false });
      reportError('workflow', e);
    }
  },

  runWorkflow: async (json) => {
    try {
      return await Workflow.run(json);
    } catch (e) {
      reportError('workflow', e);
      throw e;
    }
  },

  pauseWorkflow: async (runID) => {
    try {
      await Workflow.pause(runID);
    } catch (e) {
      reportError('workflow', e);
    }
  },

  resumeWorkflow: async (runID) => {
    try {
      await Workflow.resume(runID);
    } catch (e) {
      reportError('workflow', e);
    }
  },

  cancelWorkflow: async (runID) => {
    try {
      await Workflow.cancel(runID);
    } catch (e) {
      reportError('workflow', e);
    }
  },

  exportWorkflow: async (runID) => {
    try {
      return await Workflow.export(runID);
    } catch (e) {
      reportError('workflow', e);
      throw e;
    }
  },
});
