// frontend/src/v2/wails/__tests__/adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { MCP, Git, Settings as SettingsAdapter, Sessions, Browser, Plugin, Workflow, Orchestration, Updater, Cost, Security, Telemetry, Environment, Multimodal, Window, Document, Chat, Agent, Notification, Files } from '../adapter';

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
    expect(App.RunWorkflow).toHaveBeenCalledWith('{"name":"test"}', undefined);
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

  // ---- Newly added adapters (P1.1) ----

  it('Sessions.listByMode → App.GetSessionsByMode', async () => {
    vi.mocked(App.GetSessionsByMode).mockResolvedValueOnce([{ id: 's1' }] as any);
    const result = await Sessions.listByMode('code');
    expect(App.GetSessionsByMode).toHaveBeenCalledWith('code');
    expect(result).toHaveLength(1);
  });

  it('Sessions.batchDelete → App.BatchDeleteSessions (returns failed IDs)', async () => {
    vi.mocked(App.BatchDeleteSessions).mockResolvedValueOnce([]);
    const result = await Sessions.batchDelete(['a', 'b']);
    expect(App.BatchDeleteSessions).toHaveBeenCalledWith(['a', 'b']);
    expect(result).toEqual([]);
  });

  it('Chat.sendRaw → App.SendMessage (low-level wrapper)', async () => {
    vi.mocked(App.SendMessage).mockResolvedValueOnce([{ role: 'assistant', content: 'hi' }] as any);
    const result = await Chat.sendRaw('s1', 'hello');
    expect(App.SendMessage).toHaveBeenCalledWith('s1', 'hello');
    expect(result[0].content).toBe('hi');
  });

  it('Agent.lifecycleStates → App.GetAgentLifecycleStates', async () => {
    vi.mocked(App.GetAgentLifecycleStates).mockResolvedValueOnce({ a1: 'running' } as any);
    const result = await Agent.lifecycleStates();
    expect(result).toEqual({ a1: 'running' });
  });

  it('Agent.lifecycleState → App.GetLifecycleState() (no arg)', async () => {
    vi.mocked(App.GetLifecycleState).mockResolvedValueOnce('completed');
    const result = await Agent.lifecycleState();
    expect(App.GetLifecycleState).toHaveBeenCalledWith();
    expect(result).toBe('completed');
  });

  it('Notification.send → App.SendNotification(title, body, type)', () => {
    Notification.send('title', 'body', 'info');
    expect(App.SendNotification).toHaveBeenCalledWith('title', 'body', 'info');
  });

  // ---- Additional adapter tests (P2.5.1) ----

  it('Sessions.archive → App.ArchiveSession', async () => {
    await Sessions.archive('s1');
    expect(App.ArchiveSession).toHaveBeenCalledWith('s1');
  });

  it('Sessions.unarchive → App.UnarchiveSession', async () => {
    await Sessions.unarchive('s1');
    expect(App.UnarchiveSession).toHaveBeenCalledWith('s1');
  });

  it('Sessions.listArchived → App.GetArchivedSessions', async () => {
    vi.mocked(App.GetArchivedSessions).mockResolvedValueOnce([{ id: 's1' }] as any);
    const result = await Sessions.listArchived();
    expect(App.GetArchivedSessions).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('Chat.sendWithAttachments → App.SendMessageWithAttachments', async () => {
    vi.mocked(App.SendMessageWithAttachments).mockResolvedValueOnce([{ role: 'assistant', content: 'ok' }] as any);
    const result = await Chat.sendWithAttachments('s1', 'text', '[]');
    expect(App.SendMessageWithAttachments).toHaveBeenCalledWith('s1', 'text', '[]');
    expect(result).toHaveLength(1);
  });

  it('Chat.cancelAll → App.CancelRequest', async () => {
    await Chat.cancelAll();
    expect(App.CancelRequest).toHaveBeenCalled();
  });

  it('Files.read → App.ReadFile', async () => {
    vi.mocked(App.ReadFile).mockResolvedValueOnce('file content');
    const result = await Files.read('/path/to/file');
    expect(App.ReadFile).toHaveBeenCalledWith('/path/to/file');
    expect(result).toBe('file content');
  });

  it('Files.write → App.WriteFile', async () => {
    await Files.write('/path/to/file', 'new content');
    expect(App.WriteFile).toHaveBeenCalledWith('/path/to/file', 'new content');
  });

  it('Files.workspace → App.GetWorkspaceFiles', async () => {
    vi.mocked(App.GetWorkspaceFiles).mockResolvedValueOnce(['file1.ts', 'file2.ts']);
    const result = await Files.workspace('/project');
    expect(App.GetWorkspaceFiles).toHaveBeenCalledWith('/project');
    expect(result).toHaveLength(2);
  });

  it('Workflow.list → App.ListWorkflowExecutions', async () => {
    vi.mocked(App.ListWorkflowExecutions).mockResolvedValueOnce([]);
    await Workflow.list();
    expect(App.ListWorkflowExecutions).toHaveBeenCalled();
  });

  it('Workflow.getRun → App.GetWorkflowRun', async () => {
    vi.mocked(App.GetWorkflowRun).mockResolvedValueOnce(null);
    const result = await Workflow.getRun('run-1');
    expect(App.GetWorkflowRun).toHaveBeenCalledWith('run-1');
    expect(result).toBeNull();
  });

  it('Workflow.pause → App.PauseWorkflow', async () => {
    await Workflow.pause('run-1');
    expect(App.PauseWorkflow).toHaveBeenCalledWith('run-1');
  });

  it('Workflow.resume → App.ResumeWorkflow', async () => {
    await Workflow.resume('run-1');
    expect(App.ResumeWorkflow).toHaveBeenCalledWith('run-1');
  });

  it('Workflow.export → App.ExportWorkflow', async () => {
    // Workflow.export decodes byte array via TextDecoder, so mock must return Uint8Array-compatible data.
    const encoded = new TextEncoder().encode('{"data":1}');
    vi.mocked(App.ExportWorkflow).mockResolvedValueOnce(Array.from(encoded) as any);
    const result = await Workflow.export('run-1');
    expect(App.ExportWorkflow).toHaveBeenCalledWith('run-1');
    expect(result).toBe('{"data":1}');
  });

  it('Updater.download → App.DownloadUpdate', async () => {
    vi.mocked(App.DownloadUpdate).mockResolvedValueOnce('/path/to/download');
    const result = await Updater.download('http://example.com/update');
    expect(App.DownloadUpdate).toHaveBeenCalledWith('http://example.com/update');
    expect(result).toBe('/path/to/download');
  });

  it('Updater.openDownloaded → App.OpenDownloadedFile', () => {
    Updater.openDownloaded('/path/to/file');
    expect(App.OpenDownloadedFile).toHaveBeenCalledWith('/path/to/file');
  });

  it('Updater.history → App.GetUpdateHistory', async () => {
    vi.mocked(App.GetUpdateHistory).mockResolvedValueOnce([]);
    await Updater.history();
    expect(App.GetUpdateHistory).toHaveBeenCalled();
  });

  it('Multimodal.capabilities → App.GetMultimodalCapabilities', async () => {
    vi.mocked(App.GetMultimodalCapabilities).mockResolvedValueOnce({ vision: true } as any);
    const result = await Multimodal.capabilities();
    expect(App.GetMultimodalCapabilities).toHaveBeenCalled();
    expect(result.vision).toBe(true);
  });

  it('Security.rotateKey → App.RotateEncryptionKey', async () => {
    await Security.rotateKey();
    expect(App.RotateEncryptionKey).toHaveBeenCalled();
  });

  it('Security.checkAntivirus → App.CheckAntivirusCompatibility', async () => {
    vi.mocked(App.CheckAntivirusCompatibility).mockResolvedValueOnce({ compatible: true } as any);
    const result = await Security.checkAntivirus();
    expect(App.CheckAntivirusCompatibility).toHaveBeenCalled();
    expect(result.compatible).toBe(true);
  });

  it('Telemetry.status → App.GetTelemetryStatus', async () => {
    vi.mocked(App.GetTelemetryStatus).mockResolvedValueOnce({ enabled: true, endpoint: 'http://example.com' } as any);
    const result = await Telemetry.status();
    expect(App.GetTelemetryStatus).toHaveBeenCalled();
    expect(result.enabled).toBe(true);
  });

  it('Telemetry.setEndpoint → App.SetTelemetryEndpoint', async () => {
    await Telemetry.setEndpoint('http://new-endpoint.com');
    expect(App.SetTelemetryEndpoint).toHaveBeenCalledWith('http://new-endpoint.com');
  });
});
