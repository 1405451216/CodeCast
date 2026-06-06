// frontend/src/v2/store/slices/__tests__/castSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('castSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetToolCatalog).mockReset();
    vi.mocked(App.GetToolHistory).mockReset();
    vi.mocked(App.InvokeCastTool).mockReset();
    useAppStore.setState({ catalog: [], recent: [], byCategory: {}, castLoading: false, errors: {} });
  });

  it('loadCatalog: fetches and groups by category', async () => {
    vi.mocked(App.GetToolCatalog).mockResolvedValueOnce([
      { name: 'search', category: 'web', description: 'Search the web' },
      { name: 'calc', category: 'math', description: 'Calculator' },
      { name: 'fetch', category: 'web', description: 'Fetch URL' },
    ] as any);

    await useAppStore.getState().loadCatalog();

    const state = useAppStore.getState();
    expect(state.catalog).toHaveLength(3);
    expect(state.byCategory.web).toHaveLength(2);
    expect(state.byCategory.math).toHaveLength(1);
  });

  it('loadCatalog: failure sets cast error', async () => {
    vi.mocked(App.GetToolCatalog).mockRejectedValueOnce(new Error('catalog-err'));
    await useAppStore.getState().loadCatalog();
    expect(useAppStore.getState().errors.cast).toBe('catalog-err');
  });

  it('loadHistory: fetches tool history for session', async () => {
    vi.mocked(App.GetToolHistory).mockResolvedValueOnce([
      { id: 'h1', toolName: 'search', args: '{}', result: 'ok', isError: false },
    ] as any);

    await useAppStore.getState().loadHistory('sess-1', 10);

    expect(App.GetToolHistory).toHaveBeenCalledWith('sess-1', 10);
    expect(useAppStore.getState().recent).toHaveLength(1);
  });

  it('invokeTool: calls InvokeCastTool and returns result', async () => {
    vi.mocked(App.InvokeCastTool).mockResolvedValueOnce('{"answer": 42}');
    const result = await useAppStore.getState().invokeTool('calc', '{"expr":"1+1"}');
    expect(App.InvokeCastTool).toHaveBeenCalledWith('calc', '{"expr":"1+1"}');
    expect(result).toBe('{"answer": 42}');
  });

  it('invokeTool: failure throws and sets cast error', async () => {
    vi.mocked(App.InvokeCastTool).mockRejectedValueOnce(new Error('invoke-err'));
    await expect(useAppStore.getState().invokeTool('bad', '{}')).rejects.toThrow('invoke-err');
    expect(useAppStore.getState().errors.cast).toBe('invoke-err');
  });
});
