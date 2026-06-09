// frontend/src/v2/store/slices/__tests__/checkpointSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('checkpointSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetCheckpoints).mockReset();
    vi.mocked(App.LoadCheckpoint).mockReset();
    vi.mocked(App.DeleteCheckpoint).mockReset();
    vi.mocked(App.ResolveCheckpoint).mockReset();
    useAppStore.setState({
      checkpoints: [],
      checkpointLoading: false,
      pending: null,
      errors: {},
    });
  });

  it('loadCheckpoints: fetches and stores', async () => {
    vi.mocked(App.GetCheckpoints).mockResolvedValueOnce([
      { ID: 'c1', SessionID: 's1', Turn: 1, Status: 'pending', ToolName: 'shell', CreatedAt: '2026-01-01' },
    ] as any);
    await useAppStore.getState().loadCheckpoints('s1', 10);
    expect(App.GetCheckpoints).toHaveBeenCalledWith('s1', 10);
    expect(useAppStore.getState().checkpoints).toHaveLength(1);
  });

  it('loadCheckpoints: failure sets checkpoint error', async () => {
    vi.mocked(App.GetCheckpoints).mockRejectedValueOnce(new Error('cp-list-fail'));
    await useAppStore.getState().loadCheckpoints('s1');
    expect(useAppStore.getState().errors.checkpoint).toBe('cp-list-fail');
  });

  it('resolve: clears pending and reflects status in list', async () => {
    useAppStore.setState({
      pending: { ID: 'c1', SessionID: 's1', Turn: 1, Status: 'pending', ToolName: 'shell', CreatedAt: '' },
      checkpoints: [
        { ID: 'c1', SessionID: 's1', Turn: 1, Status: 'pending', ToolName: 'shell', CreatedAt: '' },
      ],
    });
    vi.mocked(App.ResolveCheckpoint).mockResolvedValueOnce(undefined);
    await useAppStore.getState().resolve('c1', true);
    expect(App.ResolveCheckpoint).toHaveBeenCalledWith('c1', true);
    expect(useAppStore.getState().pending).toBeNull();
    expect(useAppStore.getState().checkpoints[0].Status).toBe('approved');
  });

  it('deleteCheckpoint: removes from list and clears pending if matched', async () => {
    useAppStore.setState({
      pending: { ID: 'c1', SessionID: 's1', Turn: 1, Status: 'pending', ToolName: 'shell', CreatedAt: '' },
      checkpoints: [
        { ID: 'c1', SessionID: 's1', Turn: 1, Status: 'pending', ToolName: 'shell', CreatedAt: '' },
        { ID: 'c2', SessionID: 's1', Turn: 2, Status: 'pending', ToolName: 'edit',  CreatedAt: '' },
      ],
    });
    vi.mocked(App.DeleteCheckpoint).mockResolvedValueOnce(undefined);
    await useAppStore.getState().deleteCheckpoint('c1');
    expect(App.DeleteCheckpoint).toHaveBeenCalledWith('c1');
    expect(useAppStore.getState().checkpoints).toHaveLength(1);
    expect(useAppStore.getState().checkpoints[0].ID).toBe('c2');
    expect(useAppStore.getState().pending).toBeNull();
  });

  it('setPending: stores a pending checkpoint', () => {
    useAppStore.getState().setPending({
      ID: 'c1', SessionID: 's1', Turn: 1, Status: 'pending', ToolName: 'shell', CreatedAt: '',
    });
    expect(useAppStore.getState().pending?.ID).toBe('c1');
  });
});
