// frontend/src/v2/wails/__tests__/adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { MCP, Git, Settings as SettingsAdapter, Sessions } from '../adapter';

describe('adapter namespace', () => {
  beforeEach(() => {
    vi.mocked(App.ListMCPServers).mockReset();
    vi.mocked(App.ConnectMCP).mockReset();
    vi.mocked(App.DisconnectMCP).mockReset();
    vi.mocked(App.GetGitStatus).mockReset();
    vi.mocked(App.GetGitBranches).mockReset();
    vi.mocked(App.GetSessions).mockReset();
    vi.mocked(App.SaveSettings).mockReset();
    vi.mocked(App.GetSettings).mockReset();
  });

  it('MCP.list → App.ListMCPServers', async () => {
    await MCP.list();
    expect(App.ListMCPServers).toHaveBeenCalledTimes(1);
  });

  it('MCP.connect(name) → App.ConnectMCP(name)', async () => {
    await MCP.connect('foo');
    expect(App.ConnectMCP).toHaveBeenCalledWith('foo');
  });

  it('MCP.disconnect(name) → App.DisconnectMCP(name)', async () => {
    await MCP.disconnect('bar');
    expect(App.DisconnectMCP).toHaveBeenCalledWith('bar');
  });

  it('Git.status → App.GetGitStatus', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce(null);
    await Git.status();
    expect(App.GetGitStatus).toHaveBeenCalledTimes(1);
  });

  it('Git.branches → App.GetGitBranches', async () => {
    vi.mocked(App.GetGitBranches).mockResolvedValueOnce(['main']);
    expect(await Git.branches()).toEqual(['main']);
  });

  it('SettingsAdapter.get returns Settings type', async () => {
    vi.mocked(App.GetSettings).mockResolvedValueOnce({ work_mode: 'code' } as any);
    const s = await SettingsAdapter.get();
    expect(s.work_mode).toBe('code');
  });

  it('SettingsAdapter.save forwards object', async () => {
    const s: any = { work_mode: 'cast' };
    await SettingsAdapter.save(s);
    expect(App.SaveSettings).toHaveBeenCalledWith(s);
  });

  it('Sessions.list returns array', async () => {
    vi.mocked(App.GetSessions).mockResolvedValueOnce([]);
    expect(await Sessions.list()).toEqual([]);
  });
});
