import type { SliceSet } from './storeTypes';
import type { OrchestrationRun } from '../api/types';

export interface OrchestrationSlice {
  workflowRuns: OrchestrationRun[];
  setWorkflowRuns: (runs: OrchestrationRun[]) => void;
  addWorkflowRun: (run: OrchestrationRun) => void;
  updateWorkflowRun: (runId: string, updates: Partial<OrchestrationRun>) => void;
  handleOrchestrationEvent: (eventType: string, payload: any) => void;
}

export const createOrchestrationSlice = (set: SliceSet): OrchestrationSlice => ({
  workflowRuns: [],

  setWorkflowRuns: (runs) => set({ workflowRuns: runs }),

  addWorkflowRun: (run) =>
    set((state) => ({
      workflowRuns: [...(state.workflowRuns as OrchestrationRun[]), run],
    })),

  updateWorkflowRun: (runId, updates) =>
    set((state) => ({
      workflowRuns: (state.workflowRuns as OrchestrationRun[]).map((r) =>
        r.id === runId ? { ...r, ...updates } : r
      ),
    })),

  handleOrchestrationEvent: (eventType, payload) =>
    set((state) => {
      const runs = [...(state.workflowRuns as OrchestrationRun[])];
      const runId = payload?.runId;

      switch (eventType) {
        case 'orchestration:start': {
          if (runId && !runs.find((r) => r.id === runId)) {
            runs.push({
              id: runId,
              type: payload?.type || 'code_review',
              status: 'running',
              sessionId: payload?.sessionId || '',
              input: '',
              startedAt: new Date().toISOString(),
            });
          } else if (runId) {
            const idx = runs.findIndex((r) => r.id === runId);
            if (idx !== -1) {
              runs[idx] = { ...runs[idx], status: 'running' };
            }
          }
          break;
        }
        case 'orchestration:complete': {
          if (runId) {
            const idx = runs.findIndex((r) => r.id === runId);
            if (idx !== -1) {
              runs[idx] = { ...runs[idx], status: 'completed', endedAt: new Date().toISOString() };
            }
          }
          break;
        }
        case 'orchestration:error': {
          if (runId) {
            const idx = runs.findIndex((r) => r.id === runId);
            if (idx !== -1) {
              runs[idx] = {
                ...runs[idx],
                status: 'failed',
                error: payload?.error || 'Unknown error',
                endedAt: new Date().toISOString(),
              };
            }
          }
          break;
        }
      }

      return { workflowRuns: runs };
    }),
});
