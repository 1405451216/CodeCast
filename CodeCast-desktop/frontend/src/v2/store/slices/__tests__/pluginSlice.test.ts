// frontend/src/v2/store/slices/__tests__/pluginSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('pluginSlice', () => {
  beforeEach(() => {
    vi.mocked(App.ListPlugins).mockReset();
    vi.mocked(App.UnloadPlugin).mockReset();
    vi.mocked(App.GetPluginStatus).mockReset();
    vi.mocked(App.BroadcastMessage).mockReset();
    useAppStore.setState({
      plugins: [],
      pluginStatus: null,
      pluginLoading: false,
      errors: {},
    });
  });

  it('refreshPlugins: success sets plugins', async () => {
    vi.mocked(App.ListPlugins).mockResolvedValueOnce([
      { id: 'p1', name: 'plugin-a', version: '1.0.0', description: 'A', author: 'dev', loaded: true, path: '/a' },
    ] as any);

    await useAppStore.getState().refreshPlugins();

    expect(useAppStore.getState().plugins).toHaveLength(1);
    expect(useAppStore.getState().plugins[0].id).toBe('p1');
  });

  it('refreshPlugins: failure sets plugin error', async () => {
    vi.mocked(App.ListPlugins).mockRejectedValueOnce(new Error('plug-list-err'));

    await useAppStore.getState().refreshPlugins();

    expect(useAppStore.getState().errors.plugin).toBe('plug-list-err');
  });

  it('unloadPlugin: calls App.UnloadPlugin then refreshes via App.ListPlugins', async () => {
    vi.mocked(App.UnloadPlugin).mockResolvedValueOnce(undefined);
    vi.mocked(App.ListPlugins).mockResolvedValue([]);

    await useAppStore.getState().unloadPlugin('p1');

    expect(App.UnloadPlugin).toHaveBeenCalledWith('p1');
    expect(App.ListPlugins).toHaveBeenCalled();
  });

  it('refreshPluginStatus: sets pluginStatus', async () => {
    vi.mocked(App.GetPluginStatus).mockResolvedValueOnce({
      loadedPlugins: 3,
      totalPlugins: 5,
      httpTransportRunning: true,
    } as any);

    await useAppStore.getState().refreshPluginStatus();

    const status = useAppStore.getState().pluginStatus;
    expect(status).not.toBeNull();
    expect(status!.loadedPlugins).toBe(3);
    expect(status!.httpTransportRunning).toBe(true);
  });

  it('broadcast: calls App.BroadcastMessage with correct content', async () => {
    vi.mocked(App.BroadcastMessage).mockResolvedValueOnce(undefined);

    await useAppStore.getState().broadcast('hello all');

    expect(App.BroadcastMessage).toHaveBeenCalledWith('hello all');
  });
});
