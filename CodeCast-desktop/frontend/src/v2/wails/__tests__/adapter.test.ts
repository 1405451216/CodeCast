// frontend/src/v2/wails/__tests__/adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { MCP, Git, Settings as SettingsAdapter, Sessions } from '../adapter';

describe('adapter namespace', () => {
  beforeEach(() => {
    vi.mocked(App.GetMCPStatus).mockReset();
    vi.mocked(App.ToggleMCPServer).mockReset();
    vi.mocked(App.AddMCPServer).mockReset();
    vi.mocked(App.RemoveMCPServer).mockReset();
    vi.mocked(App.GetGitStatus).mockReset();
    vi.mocked(App.ConfirmGitCommit).mockReset();
    vi.mocked(App.GetSessions).mockReset();
    vi.mocked(App.SaveSettings).mockReset();
    vi.mocked(App.GetSettings).mockReset();
    vi.mocked(App.UpdateSetting).mockReset();
  });

  it('MCP.status → App.GetMCPStatus', async () => {
    vi.mocked(App.GetMCPStatus).mockResolvedValueOnce([{ id: 'a', name: 'foo', connected: true }] as any);
    const result = await MCP.status();
    expect(App.GetMCPStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'a', name: 'foo', connected: true }]);
  });

  it('MCP.toggle(id, enabled) → App.ToggleMCPServer(id, enabled)', async () => {
    await MCP.toggle('srv1', true);
    expect(App.ToggleMCPServer).toHaveBeenCalledWith('srv1', true);
  });

  it('MCP.add(name, url) → App.AddMCPServer(name, url)', async () => {
    await MCP.add('myserver', 'http://localhost:8080');
    expect(App.AddMCPServer).toHaveBeenCalledWith('myserver', 'http://localhost:8080');
  });

  it('MCP.remove(id) → App.RemoveMCPServer(id)', async () => {
    await MCP.remove('srv1');
    expect(App.RemoveMCPServer).toHaveBeenCalledWith('srv1');
  });

  it('Git.status → App.GetGitStatus', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce(null);
    await Git.status();
    expect(App.GetGitStatus).toHaveBeenCalledTimes(1);
  });

  it('Git.confirmCommit → App.ConfirmGitCommit', async () => {
    await Git.confirmCommit('/path/to/file');
    expect(App.ConfirmGitCommit).toHaveBeenCalledWith('/path/to/file');
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

  it('SettingsAdapter.updateKey → App.UpdateSetting', async () => {
    await SettingsAdapter.updateKey('llm_model', 'gpt-4');
    expect(App.UpdateSetting).toHaveBeenCalledWith('llm_model', 'gpt-4');
  });

  it('Sessions.list returns array', async () => {
    vi.mocked(App.GetSessions).mockResolvedValueOnce([]);
    expect(await Sessions.list()).toEqual([]);
  });

  it('Sessions.create(name, skillID, mode) → App.CreateSession', async () => {
    vi.mocked(App.CreateSession).mockResolvedValueOnce({ id: 's1', name: 'Test' } as any);
    const result = await Sessions.create('Test', 'skill1', 'code');
    expect(App.CreateSession).toHaveBeenCalledWith('Test', 'skill1', 'code');
    expect(result).toEqual({ id: 's1', name: 'Test' });
  });
});
