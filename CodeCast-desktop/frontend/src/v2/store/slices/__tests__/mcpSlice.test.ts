// frontend/src/v2/store/slices/__tests__/mcpSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('mcpSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetMCPStatus).mockReset();
    vi.mocked(App.ToggleMCPServer).mockReset();
    vi.mocked(App.AddMCPServer).mockReset();
    vi.mocked(App.RemoveMCPServer).mockReset();
    useAppStore.setState({ servers: [], loading: false, errors: {} });
  });

  it('refreshMCP: success sets servers', async () => {
    vi.mocked(App.GetMCPStatus).mockResolvedValueOnce([{ id: 'a', name: 'srv-a', connected: true }] as any);
    await useAppStore.getState().refreshMCP();
    expect(useAppStore.getState().servers).toHaveLength(1);
    expect(useAppStore.getState().servers[0].id).toBe('a');
  });

  it('refreshMCP: failure sets mcp error', async () => {
    vi.mocked(App.GetMCPStatus).mockRejectedValueOnce(new Error('m'));
    await useAppStore.getState().refreshMCP();
    expect(useAppStore.getState().errors.mcp).toBe('m');
  });

  it('toggle: calls App.ToggleMCPServer and refreshes', async () => {
    vi.mocked(App.GetMCPStatus).mockResolvedValue([{ id: 'a', name: 'srv-a', connected: true }] as any);
    await useAppStore.getState().toggle('a', true);
    expect(App.ToggleMCPServer).toHaveBeenCalledWith('a', true);
    expect(App.GetMCPStatus).toHaveBeenCalled();
  });

  it('add: calls App.AddMCPServer and refreshes', async () => {
    vi.mocked(App.GetMCPStatus).mockResolvedValue([]);
    await useAppStore.getState().add('newserver', 'http://localhost:9090');
    expect(App.AddMCPServer).toHaveBeenCalledWith('newserver', 'http://localhost:9090');
  });

  it('remove: calls App.RemoveMCPServer and refreshes', async () => {
    vi.mocked(App.GetMCPStatus).mockResolvedValue([]);
    await useAppStore.getState().remove('a');
    expect(App.RemoveMCPServer).toHaveBeenCalledWith('a');
  });
});
