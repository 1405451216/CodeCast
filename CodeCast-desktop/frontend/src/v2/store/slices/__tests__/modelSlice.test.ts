// frontend/src/v2/store/slices/__tests__/modelSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('modelSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetProviders).mockReset();
    vi.mocked(App.GetModelConfigs).mockReset();
    vi.mocked(App.GetSettings).mockReset();
    vi.mocked(App.UpdateSetting).mockReset();
    useAppStore.setState({ providers: [], configs: [], current: '', loading: false, errors: {} });
  });

  it('loadModels: fetches providers, configs, and current from settings', async () => {
    vi.mocked(App.GetProviders).mockResolvedValueOnce([{ id: 'p1', name: 'OpenAI', apiUrl: '', defaultModel: 'gpt-4', models: ['gpt-4'] }] as any);
    vi.mocked(App.GetModelConfigs).mockResolvedValueOnce([{ id: 'c1', name: 'GPT-4', provider: 'openai', model: 'gpt-4', apiKey: '', apiUrl: '', enabled: true, maxContext: 8000, toolRounds: 3, multimodal: false }] as any);
    vi.mocked(App.GetSettings).mockResolvedValueOnce({ llm_model: 'gpt-4' } as any);

    await useAppStore.getState().loadModels();

    expect(App.GetProviders).toHaveBeenCalled();
    expect(App.GetModelConfigs).toHaveBeenCalled();
    expect(App.GetSettings).toHaveBeenCalled();
    const state = useAppStore.getState();
    expect(state.providers).toHaveLength(1);
    expect(state.configs).toHaveLength(1);
    expect(state.current).toBe('gpt-4');
  });

  it('loadModels: failure sets model error', async () => {
    vi.mocked(App.GetProviders).mockRejectedValueOnce(new Error('net'));
    vi.mocked(App.GetModelConfigs).mockResolvedValueOnce([]);
    vi.mocked(App.GetSettings).mockResolvedValueOnce({});

    await useAppStore.getState().loadModels();
    expect(useAppStore.getState().errors.model).toBe('net');
  });

  it('setCurrent: calls UpdateSetting and updates current', async () => {
    await useAppStore.getState().setCurrent('claude-3-opus');
    expect(App.UpdateSetting).toHaveBeenCalledWith('llm_model', 'claude-3-opus');
    expect(useAppStore.getState().current).toBe('claude-3-opus');
  });

  it('setCurrent: failure sets model error', async () => {
    vi.mocked(App.UpdateSetting).mockRejectedValueOnce(new Error('fail'));
    await useAppStore.getState().setCurrent('bad-model');
    expect(useAppStore.getState().errors.model).toBe('fail');
  });
});
