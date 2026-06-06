// frontend/src/v2/store/slices/orchestrationSlice.ts
import type { StateCreator } from 'zustand';
import type {
  OrchestrationRun, CodeReviewResult, RefactoringResult,
  TestPipelineResult, ParallelAnalysisResult,
} from '../../wails/types';
import { Orchestration } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export type OrchestrationResult =
  | CodeReviewResult
  | RefactoringResult
  | TestPipelineResult
  | ParallelAnalysisResult;

export interface OrchestrationSlice {
  orchestrationRuns: OrchestrationRun[];
  lastResult: OrchestrationResult | null;
  orchestrationLoading: boolean;
  refreshRuns: () => Promise<void>;
  runCodeReview: (sessionID: string, code: string) => Promise<void>;
  runRefactoring: (sessionID: string, code: string) => Promise<void>;
  runTestPipeline: (sessionID: string, code: string) => Promise<void>;
  runParallelAnalysis: (sessionID: string, input: string) => Promise<void>;
  cancelRun: (runID: string) => Promise<void>;
  getStatus: (runID: string) => Promise<OrchestrationRun | null>;
}

export const createOrchestrationSlice: StateCreator<OrchestrationSlice, [], [], OrchestrationSlice> = (set) => ({
  orchestrationRuns: [],
  lastResult: null,
  orchestrationLoading: false,

  refreshRuns: async () => {
    set({ orchestrationLoading: true });
    try {
      const runs = await Orchestration.listRuns();
      set({ orchestrationRuns: runs, orchestrationLoading: false });
    } catch (e) {
      set({ orchestrationLoading: false });
      reportError('orchestration', e);
    }
  },

  runCodeReview: async (sessionID, code) => {
    set({ orchestrationLoading: true });
    try {
      const result = await Orchestration.codeReview(sessionID, code);
      set({ lastResult: result, orchestrationLoading: false });
    } catch (e) {
      set({ orchestrationLoading: false });
      reportError('orchestration', e);
    }
  },

  runRefactoring: async (sessionID, code) => {
    set({ orchestrationLoading: true });
    try {
      const result = await Orchestration.refactoring(sessionID, code);
      set({ lastResult: result, orchestrationLoading: false });
    } catch (e) {
      set({ orchestrationLoading: false });
      reportError('orchestration', e);
    }
  },

  runTestPipeline: async (sessionID, code) => {
    set({ orchestrationLoading: true });
    try {
      const result = await Orchestration.testPipeline(sessionID, code);
      set({ lastResult: result, orchestrationLoading: false });
    } catch (e) {
      set({ orchestrationLoading: false });
      reportError('orchestration', e);
    }
  },

  runParallelAnalysis: async (sessionID, input) => {
    set({ orchestrationLoading: true });
    try {
      const result = await Orchestration.parallelAnalysis(sessionID, input);
      set({ lastResult: result, orchestrationLoading: false });
    } catch (e) {
      set({ orchestrationLoading: false });
      reportError('orchestration', e);
    }
  },

  cancelRun: async (runID) => {
    try {
      await Orchestration.cancelRun(runID);
    } catch (e) {
      reportError('orchestration', e);
    }
  },

  getStatus: async (runID) => {
    try {
      return await Orchestration.getStatus(runID);
    } catch (e) {
      reportError('orchestration', e);
      return null;
    }
  },
});
