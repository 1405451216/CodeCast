// frontend/src/v2/store/slices/__tests__/mcpSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('mcpSlice', () => {
  beforeEach(() => {
    vi.mocked(App.ListMCPServers).mockReset();
    vi.mocked(App.ConnectMCP).mockReset();
    vi.mocked(App.DisconnectMCP).mockReset();
    useAppStore.setState({ servers: [], loading: false, errors: {} });
  });

  it('refresh: success sets servers', async () => {
    vi.mocked(App.ListMCPServers).mockResolvedValueOnce([{ name: 'a', status: 'connected', tools: [] }] as any);
    await useAppStore.getState().refreshMCP();
    expect(useAppStore.getState().servers).toHaveLength(1);
  });

  it('refresh: failure sets mcp error', async () => {
    vi.mocked(App.ListMCPServers).mockRejectedValueOnce(new Error('m'));
    await useAppStore.getState().refreshMCP();
    expect(useAppStore.getState().errors.mcp).toBe('m');
  });

  it('connect: calls App.ConnectMCP and refreshes', async () => {
    vi.mocked(App.ListMCPServers).mockResolvedValue([]);
    await useAppStore.getState().connect('a');
    expect(App.ConnectMCP).toHaveBeenCalledWith('a');
  });
});
