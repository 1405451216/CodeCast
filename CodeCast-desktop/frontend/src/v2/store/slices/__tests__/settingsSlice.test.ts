// frontend/src/v2/store/slices/__tests__/settingsSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';
import type { Settings } from '../../../wails/types';

describe('settingsSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetSettings).mockReset();
    vi.mocked(App.SaveSettings).mockReset();
    useAppStore.setState({ settings: null, loading: false, errors: {} });
  });

  it('load: success populates settings', async () => {
    const s = { work_mode: 'code' } as any as Settings;
    vi.mocked(App.GetSettings).mockResolvedValueOnce(s);
    await useAppStore.getState().loadSettings();
    expect(useAppStore.getState().settings).toBe(s);
  });

  it('load: failure sets settings error', async () => {
    vi.mocked(App.GetSettings).mockRejectedValueOnce(new Error('cfg'));
    await useAppStore.getState().loadSettings();
    expect(useAppStore.getState().errors.settings).toBe('cfg');
  });

  it('save: forwards object and updates state', async () => {
    const s = { work_mode: 'cast' } as any as Settings;
    await useAppStore.getState().save(s);
    expect(App.SaveSettings).toHaveBeenCalledWith(s);
    expect(useAppStore.getState().settings).toBe(s);
  });
});
