// frontend/src/v2/store/slices/__tests__/gitSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('gitSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetGitStatus).mockReset();
    vi.mocked(App.ConfirmGitCommit).mockReset();
    useAppStore.setState({ status: null, loading: false, errors: {} });
  });

  it('refreshGit: success parses status', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce({ enabled: true, branch: 'main', ahead: 1, behind: 0, dirty: false } as any);
    await useAppStore.getState().refreshGit();
    expect(useAppStore.getState().status).toEqual({ enabled: true, branch: 'main', ahead: 1, behind: 0, dirty: false });
  });

  it('refreshGit: status null → status null', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce(null);
    await useAppStore.getState().refreshGit();
    expect(useAppStore.getState().status).toBeNull();
  });

  it('refreshGit: failure sets git error', async () => {
    vi.mocked(App.GetGitStatus).mockRejectedValueOnce(new Error('g'));
    await useAppStore.getState().refreshGit();
    expect(useAppStore.getState().errors.git).toBe('g');
  });

  it('confirmCommit: calls App.ConfirmGitCommit', async () => {
    await useAppStore.getState().confirmCommit('/path/to/file');
    expect(App.ConfirmGitCommit).toHaveBeenCalledWith('/path/to/file');
  });

  it('confirmCommit: failure sets git error', async () => {
    vi.mocked(App.ConfirmGitCommit).mockRejectedValueOnce(new Error('commit fail'));
    await useAppStore.getState().confirmCommit('/file');
    expect(useAppStore.getState().errors.git).toBe('commit fail');
  });
});
