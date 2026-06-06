// frontend/src/v2/wails/__tests__/adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { MCP, Git, Settings as SettingsAdapter, Sessions, Browser, Plugin, Workflow, Orchestration, Updater, Cost, Security, Telemetry, Environment, Multimodal, Window, Document } from '../adapter';

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

  // ---- Browser adapter ----
  it('Browser.isDomainBlocked → App.IsDomainBlocked', async () => {
    vi.mocked(App.IsDomainBlocked).mockResolvedValueOnce(false);
    const result = await Browser.isDomainBlocked('https://example.com');
    expect(App.IsDomainBlocked).toHaveBeenCalledWith('https://example.com');
    expect(result).toBe(false);
  });

  it('Browser.clearBrowserData → App.ClearBrowserData', async () => {
    await Browser.clearBrowserData();
    expect(App.ClearBrowserData).toHaveBeenCalled();
  });

  // ---- Plugin adapter ----
  it('Plugin.list → App.ListPlugins', async () => {
    vi.mocked(App.ListPlugins).mockResolvedValueOnce([{ id: 'p1', name: 'Test Plugin' }] as any);
    const result = await Plugin.list();
    expect(App.ListPlugins).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('Plugin.unload → App.UnloadPlugin', async () => {
    await Plugin.unload('p1');
    expect(App.UnloadPlugin).toHaveBeenCalledWith('p1');
  });

  // ---- Workflow adapter ----
  it('Workflow.run → App.RunWorkflow', async () => {
    vi.mocked(App.RunWorkflow).mockResolvedValueOnce('run-123');
    const result = await Workflow.run('{"name":"test"}');
    expect(App.RunWorkflow).toHaveBeenCalledWith('{"name":"test"}');
    expect(result).toBe('run-123');
  });

  it('Workflow.cancel → App.CancelWorkflow', async () => {
    await Workflow.cancel('run-123');
    expect(App.CancelWorkflow).toHaveBeenCalledWith('run-123');
  });

  // ---- Orchestration adapter ----
  it('Orchestration.codeReview → App.RunCodeReviewWorkflow', async () => {
    vi.mocked(App.RunCodeReviewWorkflow).mockResolvedValueOnce({ issues: [], summary: 'ok', score: 9 } as any);
    const result = await Orchestration.codeReview('sess-1', 'code');
    expect(App.RunCodeReviewWorkflow).toHaveBeenCalledWith('sess-1', 'code');
    expect(result.score).toBe(9);
  });

  it('Orchestration.listRuns → App.ListWorkflowRuns', async () => {
    vi.mocked(App.ListWorkflowRuns).mockResolvedValueOnce([]);
    await Orchestration.listRuns();
    expect(App.ListWorkflowRuns).toHaveBeenCalled();
  });

  // ---- Updater adapter ----
  it('Updater.currentVersion → App.GetCurrentVersion', async () => {
    vi.mocked(App.GetCurrentVersion).mockResolvedValueOnce('2.0.0');
    const result = await Updater.currentVersion();
    expect(result).toBe('2.0.0');
  });

  it('Updater.check → App.CheckForUpdate', async () => {
    vi.mocked(App.CheckForUpdate).mockResolvedValueOnce(null);
    const result = await Updater.check();
    expect(result).toBeNull();
  });

  // ---- Cost adapter ----
  it('Cost.summary → App.GetCostSummary', async () => {
    vi.mocked(App.GetCostSummary).mockResolvedValueOnce({ totalCostUSD: 1.5 } as any);
    const result = await Cost.summary();
    expect(result.totalCostUSD).toBe(1.5);
  });

  it('Cost.setLimit → App.SetBudgetLimit', () => {
    Cost.setLimit(100);
    expect(App.SetBudgetLimit).toHaveBeenCalledWith(100);
  });

  // ---- Security adapter ----
  it('Security.status → App.GetSecurityStatus', async () => {
    vi.mocked(App.GetSecurityStatus).mockResolvedValueOnce({ encryptionEnabled: true } as any);
    const result = await Security.status();
    expect(result.encryptionEnabled).toBe(true);
  });

  // ---- Telemetry adapter ----
  it('Telemetry.toggle → App.ToggleTelemetry', async () => {
    await Telemetry.toggle(true);
    expect(App.ToggleTelemetry).toHaveBeenCalledWith(true);
  });

  // ---- Environment adapter ----
  it('Environment.check → App.CheckEnvironment', async () => {
    vi.mocked(App.CheckEnvironment).mockResolvedValueOnce({ OverallStatus: 'ok' } as any);
    const result = await Environment.check();
    expect(result.OverallStatus).toBe('ok');
  });

  // ---- Multimodal adapter ----
  it('Multimodal.analyzeImage → App.AnalyzeImage', async () => {
    vi.mocked(App.AnalyzeImage).mockResolvedValueOnce({ description: 'a cat' } as any);
    const result = await Multimodal.analyzeImage('/path/to/img.png', 'What is this?');
    expect(App.AnalyzeImage).toHaveBeenCalledWith('/path/to/img.png', 'What is this?');
    expect(result.description).toBe('a cat');
  });

  // ---- Window adapter ----
  it('Window.platform → App.GetPlatform', async () => {
    vi.mocked(App.GetPlatform).mockResolvedValueOnce('windows');
    const result = await Window.platform();
    expect(result).toBe('windows');
  });

  it('Window.editors → App.GetAvailableEditors', async () => {
    vi.mocked(App.GetAvailableEditors).mockResolvedValueOnce([{ id: 'vscode', name: 'VS Code' }] as any);
    const result = await Window.editors();
    expect(result).toHaveLength(1);
  });

  // ---- Document adapter ----
  it('Document.status → App.GetIngestionStatus', async () => {
    vi.mocked(App.GetIngestionStatus).mockResolvedValueOnce({ running: false } as any);
    const result = await Document.status();
    expect(result.running).toBe(false);
  });
});
