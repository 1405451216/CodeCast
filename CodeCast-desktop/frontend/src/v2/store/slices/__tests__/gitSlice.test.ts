// frontend/src/v2/store/slices/__tests__/gitSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('gitSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetGitStatus).mockReset();
    vi.mocked(App.GetGitBranches).mockReset();
    useAppStore.setState({ status: null, branches: [], commits: [], diff: '', loading: false, errors: {} });
  });

  it('refresh: success parses status and branches', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce({ branch: 'main', ahead: 1, behind: 0, dirty: 2 } as any);
    vi.mocked(App.GetGitBranches).mockResolvedValueOnce(['main', 'dev']);
    await useAppStore.getState().refreshGit();
    expect(useAppStore.getState().status).toEqual({ branch: 'main', ahead: 1, behind: 0, dirty: 2 });
    expect(useAppStore.getState().branches).toEqual(['main', 'dev']);
  });

  it('refresh: status null → status null', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce(null);
    vi.mocked(App.GetGitBranches).mockResolvedValueOnce([]);
    await useAppStore.getState().refreshGit();
    expect(useAppStore.getState().status).toBeNull();
  });

  it('refresh: failure sets git error', async () => {
    vi.mocked(App.GetGitStatus).mockRejectedValueOnce(new Error('g'));
    await useAppStore.getState().refreshGit();
    expect(useAppStore.getState().errors.git).toBe('g');
  });
});
