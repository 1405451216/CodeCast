// frontend/src/v2/store/slices/__tests__/updaterSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('updaterSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetCurrentVersion).mockReset();
    vi.mocked(App.CheckForUpdate).mockReset();
    vi.mocked(App.GetUpdateHistory).mockReset();
    vi.mocked(App.OpenReleasePage).mockReset();
    useAppStore.setState({
      currentVersion: '',
      updateInfo: null,
      updateHistory: [],
      updaterLoading: false,
      errors: {},
    });
  });

  it('refreshVersion: success sets currentVersion', async () => {
    vi.mocked(App.GetCurrentVersion).mockResolvedValueOnce('2.0.0');
    await useAppStore.getState().refreshVersion();
    expect(useAppStore.getState().currentVersion).toBe('2.0.0');
    expect(useAppStore.getState().updaterLoading).toBe(false);
  });

  it('checkUpdate: success sets updateInfo', async () => {
    const info = {
      version: '3.0.0',
      title: 'New Release',
      releaseNotes: 'Bug fixes',
      publishedAt: '2026-06-01',
      downloadURL: 'https://example.com/update',
      platform: 'windows',
      size: 50_000_000,
    };
    vi.mocked(App.CheckForUpdate).mockResolvedValueOnce(info as any);
    await useAppStore.getState().checkUpdate();
    expect(useAppStore.getState().updateInfo).toEqual(info);
    expect(useAppStore.getState().updaterLoading).toBe(false);
  });

  it('checkUpdate: failure sets errors.updater', async () => {
    vi.mocked(App.CheckForUpdate).mockRejectedValueOnce(new Error('network error'));
    await useAppStore.getState().checkUpdate();
    expect(useAppStore.getState().errors.updater).toBe('network error');
    expect(useAppStore.getState().updaterLoading).toBe(false);
  });

  it('refreshHistory: sets updateHistory', async () => {
    const history = [
      {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        success: true,
        notes: 'Initial update',
        updatedAt: '2026-05-01',
      },
    ];
    vi.mocked(App.GetUpdateHistory).mockResolvedValueOnce(history as any);
    await useAppStore.getState().refreshHistory();
    expect(useAppStore.getState().updateHistory).toHaveLength(1);
    expect(useAppStore.getState().updateHistory[0].toVersion).toBe('1.1.0');
  });

  it('openReleasePage: calls App.OpenReleasePage', () => {
    useAppStore.getState().openReleasePage();
    expect(App.OpenReleasePage).toHaveBeenCalledOnce();
  });
});
