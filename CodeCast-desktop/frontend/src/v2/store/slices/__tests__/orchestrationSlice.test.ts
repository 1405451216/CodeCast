// frontend/src/v2/store/slices/__tests__/orchestrationSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('orchestrationSlice', () => {
  beforeEach(() => {
    vi.mocked(App.ListWorkflowRuns).mockReset();
    vi.mocked(App.RunCodeReviewWorkflow).mockReset();
    vi.mocked(App.RunRefactoringWorkflow).mockReset();
    vi.mocked(App.CancelWorkflowRun).mockReset();
    useAppStore.setState({
      orchestrationRuns: [],
      lastResult: null,
      orchestrationLoading: false,
      errors: {},
    });
  });

  it('refreshRuns: success sets orchestrationRuns', async () => {
    const runs = [
      {
        runId: 'run-1',
        type: 'codeReview',
        sessionId: 'sess-1',
        status: 'completed',
        createdAt: '2026-06-01T10:00:00Z',
      },
    ];
    vi.mocked(App.ListWorkflowRuns).mockResolvedValueOnce(runs as any);
    await useAppStore.getState().refreshRuns();
    expect(useAppStore.getState().orchestrationRuns).toHaveLength(1);
    expect(useAppStore.getState().orchestrationRuns[0].runId).toBe('run-1');
    expect(useAppStore.getState().orchestrationLoading).toBe(false);
  });

  it('refreshRuns: failure sets errors.orchestration', async () => {
    vi.mocked(App.ListWorkflowRuns).mockRejectedValueOnce(new Error('list failed'));
    await useAppStore.getState().refreshRuns();
    expect(useAppStore.getState().errors.orchestration).toBe('list failed');
    expect(useAppStore.getState().orchestrationLoading).toBe(false);
  });

  it('runCodeReview: sets lastResult with score', async () => {
    const result = {
      issues: [{ severity: 'high', line: 10, message: 'Unused variable' }],
      summary: '1 issue found',
      score: 75,
    };
    vi.mocked(App.RunCodeReviewWorkflow).mockResolvedValueOnce(result as any);
    await useAppStore.getState().runCodeReview('sess-1', 'const x = 1;');
    const state = useAppStore.getState();
    expect(state.lastResult).toEqual(result);
    expect((state.lastResult as any).score).toBe(75);
    expect(state.orchestrationLoading).toBe(false);
  });

  it('cancelRun: calls App.CancelWorkflowRun with correct runID', async () => {
    vi.mocked(App.CancelWorkflowRun).mockResolvedValueOnce(undefined as any);
    await useAppStore.getState().cancelRun('run-42');
    expect(App.CancelWorkflowRun).toHaveBeenCalledWith('run-42');
  });

  it('runRefactoring: sets lastResult', async () => {
    const result = {
      refactoredCode: 'const y = 2;',
      changes: [{ description: 'Renamed variable', line: 1 }],
      summary: '1 change applied',
    };
    vi.mocked(App.RunRefactoringWorkflow).mockResolvedValueOnce(result as any);
    await useAppStore.getState().runRefactoring('sess-1', 'const x = 1;');
    expect(useAppStore.getState().lastResult).toEqual(result);
    expect(useAppStore.getState().orchestrationLoading).toBe(false);
  });
});
