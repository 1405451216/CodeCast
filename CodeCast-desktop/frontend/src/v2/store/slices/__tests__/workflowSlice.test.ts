// frontend/src/v2/store/slices/__tests__/workflowSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('workflowSlice', () => {
  beforeEach(() => {
    vi.mocked(App.ListWorkflowExecutions).mockReset();
    vi.mocked(App.RunWorkflow).mockReset();
    vi.mocked(App.CancelWorkflow).mockReset();
    vi.mocked(App.GetWorkflowRun).mockReset();
    useAppStore.setState({
      workflowRuns: [],
      currentRun: null,
      workflowLoading: false,
      errors: {},
    });
  });

  it('refreshWorkflows: success sets workflowRuns', async () => {
    vi.mocked(App.ListWorkflowExecutions).mockResolvedValueOnce([
      { id: 'r1', name: 'wf-1', type: 'standard', status: 'completed', createdAt: '', updatedAt: '' },
      { id: 'r2', name: 'wf-2', type: 'standard', status: 'running', createdAt: '', updatedAt: '' },
    ] as any);

    await useAppStore.getState().refreshWorkflows();

    expect(useAppStore.getState().workflowRuns).toHaveLength(2);
    expect(useAppStore.getState().workflowRuns[0].id).toBe('r1');
  });

  it('refreshWorkflows: failure sets workflow error', async () => {
    vi.mocked(App.ListWorkflowExecutions).mockRejectedValueOnce(new Error('wf-list-err'));

    await useAppStore.getState().refreshWorkflows();

    expect(useAppStore.getState().errors.workflow).toBe('wf-list-err');
  });

  it('runWorkflow: calls App.RunWorkflow with json and returns id', async () => {
    vi.mocked(App.RunWorkflow).mockResolvedValueOnce('run-id-123');

    const result = await useAppStore.getState().runWorkflow('{"nodes":[]}');

    expect(App.RunWorkflow).toHaveBeenCalledWith('{"nodes":[]}');
    expect(result).toBe('run-id-123');
  });

  it('cancelWorkflow: calls App.CancelWorkflow with correct runID', async () => {
    vi.mocked(App.CancelWorkflow).mockResolvedValueOnce(undefined);

    await useAppStore.getState().cancelWorkflow('run-42');

    expect(App.CancelWorkflow).toHaveBeenCalledWith('run-42');
  });

  it('getRun: success sets currentRun', async () => {
    vi.mocked(App.GetWorkflowRun).mockResolvedValueOnce({
      id: 'run-1',
      name: 'my-workflow',
      type: 'standard',
      status: 'running',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any);

    await useAppStore.getState().getRun('run-1');

    expect(useAppStore.getState().currentRun).not.toBeNull();
    expect(useAppStore.getState().currentRun!.id).toBe('run-1');
    expect(useAppStore.getState().currentRun!.name).toBe('my-workflow');
  });
});
