// frontend/src/v2/store/slices/__tests__/castToolSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('castToolSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetToolCatalog).mockReset();
    vi.mocked(App.GetToolHistory).mockReset();
    vi.mocked(App.InvokeCastTool).mockReset();
    vi.mocked(App.ExtractStructured).mockReset();
    useAppStore.setState({
      castTools: [],
      castToolByCategory: {},
      castToolHistory: [],
      castToolResult: null,
      castToolInvoking: false,
      castToolLoading: false,
      errors: {},
    });
  });

  it('loadCastTools: fetches tool catalog and groups by category', async () => {
    vi.mocked(App.GetToolCatalog).mockResolvedValueOnce([
      { name: 'search', category: 'web', description: 'Search' },
      { name: 'fetch', category: 'web', description: 'Fetch URL' },
      { name: 'calc', category: 'math', description: 'Calculator' },
    ] as any);
    await useAppStore.getState().loadCastTools();
    const s = useAppStore.getState();
    expect(s.castTools).toHaveLength(3);
    expect(s.castToolByCategory.web).toHaveLength(2);
    expect(s.castToolByCategory.math).toHaveLength(1);
  });

  it('loadCastTools: failure sets castTool error', async () => {
    vi.mocked(App.GetToolCatalog).mockRejectedValueOnce(new Error('catalog-fail'));
    await useAppStore.getState().loadCastTools();
    expect(useAppStore.getState().errors.castTool).toBe('catalog-fail');
  });

  it('invokeCastTool: calls backend and stores result', async () => {
    vi.mocked(App.InvokeCastTool).mockResolvedValueOnce('{"ok":true}');
    const result = await useAppStore.getState().invokeCastTool('search', '{"q":"test"}');
    expect(App.InvokeCastTool).toHaveBeenCalledWith('search', '{"q":"test"}');
    expect(result).toBe('{"ok":true}');
    expect(useAppStore.getState().castToolResult).toBe('{"ok":true}');
  });

  it('invokeCastTool: failure throws and sets castTool error', async () => {
    vi.mocked(App.InvokeCastTool).mockRejectedValueOnce(new Error('invoke-err'));
    await expect(useAppStore.getState().invokeCastTool('bad', '{}')).rejects.toThrow('invoke-err');
    expect(useAppStore.getState().errors.castTool).toBe('invoke-err');
  });

  it('refreshCastToolHistory: fetches history for session', async () => {
    vi.mocked(App.GetToolHistory).mockResolvedValueOnce([
      { id: 'h1', toolName: 'search', args: '{}', result: 'ok', isError: false },
    ] as any);
    await useAppStore.getState().refreshCastToolHistory('sess-1', 10);
    expect(App.GetToolHistory).toHaveBeenCalledWith('sess-1', 10);
    expect(useAppStore.getState().castToolHistory).toHaveLength(1);
  });

  it('extractStructured: calls backend extract', async () => {
    vi.mocked(App.ExtractStructured).mockResolvedValueOnce('{"name":"John"}');
    const result = await useAppStore.getState().extractStructured('John is 30', 'person');
    expect(App.ExtractStructured).toHaveBeenCalledWith('John is 30', 'person');
    expect(result).toBe('{"name":"John"}');
  });
});
