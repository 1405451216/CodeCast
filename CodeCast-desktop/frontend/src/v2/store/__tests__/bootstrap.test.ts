// frontend/src/v2/store/__tests__/bootstrap.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../index';
import { bootstrapStore } from '../bootstrap';

describe('bootstrapStore', () => {
  beforeEach(() => {
    // Reset every adapter call that bootstrap may touch.
    [
      App.GetSessions,
      App.GetProviders,
      App.GetModelConfigs,
      App.GetSettings,
      App.GetToolCatalog,
      App.GetGitStatus,
      App.GetCostSummary,
      App.ListPlugins,
      App.GetCurrentVersion,
      App.GetBudgetConfig,
    ].forEach((fn) => vi.mocked(fn).mockReset());
  });

  it('runs every critical loader exactly once', async () => {
    // Backend returns empty payloads for all.
    vi.mocked(App.GetSessions).mockResolvedValueOnce([]);
    vi.mocked(App.GetProviders).mockResolvedValueOnce([]);
    vi.mocked(App.GetModelConfigs).mockResolvedValueOnce([]);
    vi.mocked(App.GetSettings).mockResolvedValueOnce({} as any);
    vi.mocked(App.GetToolCatalog).mockResolvedValueOnce([]);
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce(null);
    vi.mocked(App.GetCostSummary).mockResolvedValueOnce({} as any);
    vi.mocked(App.ListPlugins).mockResolvedValueOnce([]);
    vi.mocked(App.GetCurrentVersion).mockResolvedValueOnce('0.0.0');
    vi.mocked(App.GetBudgetConfig).mockResolvedValueOnce({} as any);

    await bootstrapStore(useAppStore.getState());

    expect(App.GetSessions).toHaveBeenCalledTimes(1);
    expect(App.GetProviders).toHaveBeenCalledTimes(1);
    expect(App.GetModelConfigs).toHaveBeenCalledTimes(1);
    // GetSettings is called twice: once by loadSettings() and once by
    // loadModels() (modelSlice reads llm_model from settings).
    expect(App.GetSettings).toHaveBeenCalledTimes(2);
    expect(App.GetToolCatalog).toHaveBeenCalledTimes(1);
    expect(App.GetGitStatus).toHaveBeenCalledTimes(1);
    expect(App.GetCostSummary).toHaveBeenCalledTimes(1);
    expect(App.ListPlugins).toHaveBeenCalledTimes(1);
    expect(App.GetCurrentVersion).toHaveBeenCalledTimes(1);
    expect(App.GetBudgetConfig).toHaveBeenCalledTimes(1);
  });

  it('does not throw when a loader rejects; continues to the next', async () => {
    vi.mocked(App.GetSessions).mockRejectedValueOnce(new Error('net down'));
    vi.mocked(App.GetProviders).mockResolvedValueOnce([]);
    vi.mocked(App.GetModelConfigs).mockResolvedValueOnce([]);
    vi.mocked(App.GetSettings).mockResolvedValueOnce({} as any);
    vi.mocked(App.GetToolCatalog).mockResolvedValueOnce([]);
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce(null);
    vi.mocked(App.GetCostSummary).mockResolvedValueOnce({} as any);
    vi.mocked(App.ListPlugins).mockResolvedValueOnce([]);
    vi.mocked(App.GetCurrentVersion).mockResolvedValueOnce('0.0.0');
    vi.mocked(App.GetBudgetConfig).mockResolvedValueOnce({} as any);

    // The current bootstrap awaits each loader; if a loader itself throws
    // (it shouldn't, because slices catch via reportError), bootstrap
    // would propagate. Verify that doesn't happen by virtue of slice
    // error handling — sessions error is recorded but bootstrap completes.
    await expect(bootstrapStore(useAppStore.getState())).resolves.toBeUndefined();
    expect(useAppStore.getState().errors.session).toBe('net down');
  });
});
