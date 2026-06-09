# Backend API Usage Report

Generated: 2026-06-06T14:48:57.201Z

Total backend methods: 152

## Summary

| Metric | Count |
|--------|-------|
| Total methods | 152 |
| Used in UI/slice | 152 |
| Test-only usage | 0 |
| Unused | 0 |

## Method Usage

| Method | Usage Count | Files |
|--------|-------------|-------|
| GetSessions | 5 ✅ | src\v2\store\slices\__tests__\sessionSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetSession | 5 ✅ | src\v2\store\slices\__tests__\sessionSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| CreateSession | 5 ✅ | src\v2\layout\Sidebar.tsx, src\v2\store\slices\__tests__\sessionSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| DeleteSession | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| SearchSessions | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RenameSession | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetSessionsByMode | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| BatchDeleteSessions | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetArchivedSessions | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ArchiveSession | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| UnarchiveSession | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| SendMessage | 4 ✅ | src\v2\store\slices\__tests__\chatSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| SendMessageEx | 3 ✅ | src\v2\store\slices\__tests__\chatSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SendMessageWithAttachments | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| CancelRequest | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| CancelSessionRequest | 3 ✅ | src\v2\store\slices\__tests__\chatSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetToolCatalog | 5 ✅ | src\v2\lib\__tests__\useFirstTool.test.ts, src\v2\store\slices\__tests__\castToolSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetToolHistory | 3 ✅ | src\v2\store\slices\__tests__\castToolSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| InvokeCastTool | 3 ✅ | src\v2\store\slices\__tests__\castToolSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ExtractStructured | 3 ✅ | src\v2\store\slices\__tests__\castToolSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetProjects | 3 ✅ | src\v2\store\slices\__tests__\projectSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| AddProject | 3 ✅ | src\v2\store\slices\__tests__\projectSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RemoveProject | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SetCurrentProject | 4 ✅ | src\v2\store\slices\projectSlice.ts, src\v2\store\slices\__tests__\projectSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetCurrentProject | 3 ✅ | src\v2\store\slices\__tests__\projectSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| UpdateProjectInstructions | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SetNoProjectMode | 3 ✅ | src\v2\store\slices\__tests__\projectSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetNoProjectMode | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ListFiles | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ReadFile | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| WriteFile | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetWorkspaceFiles | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ReadFileContent | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SelectFile | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SelectFolder | 4 ✅ | src\v2\pages\PluginsPage.tsx, src\v2\pages\__tests__\PluginsPage.test.tsx, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetSkills | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| CreateSkill | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| DeleteSkill | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| UpdateSkill | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetSettings | 6 ✅ | src\v2\store\slices\__tests__\modelSlice.test.ts, src\v2\store\slices\__tests__\settingsSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| SaveSettings | 4 ✅ | src\v2\store\slices\__tests__\settingsSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| UpdateSetting | 4 ✅ | src\v2\store\slices\__tests__\modelSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetConfig | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetProviders | 4 ✅ | src\v2\store\slices\__tests__\modelSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetProviderModels | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetModelConfigs | 4 ✅ | src\v2\store\slices\__tests__\modelSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| AddModelConfig | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| UpdateModelConfig | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RemoveModelConfig | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ToggleModelConfig | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetEnvVars | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| AddEnvVar | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RemoveEnvVar | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetSlashCommands | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| AddSlashCommand | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| UpdateSlashCommand | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RemoveSlashCommand | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetMCPStatus | 4 ✅ | src\v2\store\slices\__tests__\mcpSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| AddMCPServer | 4 ✅ | src\v2\store\slices\__tests__\mcpSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| AddMCPServerStdio | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RemoveMCPServer | 4 ✅ | src\v2\store\slices\__tests__\mcpSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ToggleMCPServer | 4 ✅ | src\v2\store\slices\__tests__\mcpSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| TestMCPServerConnection | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetMCPServerTools | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetGitStatus | 6 ✅ | src\v2\store\slices\__tests__\gitSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\guards.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ConfirmGitCommit | 4 ✅ | src\v2\store\slices\__tests__\gitSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetAPMetricsSnapshot | 3 ✅ | src\v2\store\slices\__tests__\memorySlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ClearCache | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetLifecycleState | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetAgentLifecycleStates | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetCacheStats | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SetCacheEnabled | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetSessionSummary | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetAgents | 3 ✅ | src\v2\store\slices\__tests__\agentSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetAgentDetail | 3 ✅ | src\v2\store\slices\__tests__\agentSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| CancelAgent | 3 ✅ | src\v2\store\slices\__tests__\agentSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| CancelSessionAgents | 3 ✅ | src\v2\store\slices\__tests__\agentSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| DispatchAgents | 3 ✅ | src\v2\store\slices\__tests__\agentSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SendNotification | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetCheckpoints | 4 ✅ | src\v2\store\slices\checkpointSlice.ts, src\v2\store\slices\__tests__\checkpointSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| LoadCheckpoint | 4 ✅ | src\v2\store\slices\checkpointSlice.ts, src\v2\store\slices\__tests__\checkpointSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| DeleteCheckpoint | 4 ✅ | src\v2\store\slices\checkpointSlice.ts, src\v2\store\slices\__tests__\checkpointSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ResolveCheckpoint | 5 ✅ | src\v2\components\agent\__tests__\CheckpointApproval.test.tsx, src\v2\store\slices\checkpointSlice.ts, src\v2\store\slices\__tests__\checkpointSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| IsDomainBlocked | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetDomainRules | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| AddBlockedDomain | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RemoveBlockedDomain | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| AddAllowedDomain | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RemoveAllowedDomain | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ClearBrowserData | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| CheckSeleniumInstalled | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ListPlugins | 6 ✅ | src\v2\pages\__tests__\PluginsPage.test.tsx, src\v2\store\slices\__tests__\pluginSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| LoadPlugin | 3 ✅ | src\v2\pages\__tests__\PluginsPage.test.tsx, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| UnloadPlugin | 5 ✅ | src\v2\pages\__tests__\PluginsPage.test.tsx, src\v2\store\slices\__tests__\pluginSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetPluginStatus | 4 ✅ | src\v2\pages\__tests__\PluginsPage.test.tsx, src\v2\store\slices\__tests__\pluginSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SendPluginMessage | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| BroadcastMessage | 3 ✅ | src\v2\store\slices\__tests__\pluginSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RunWorkflow | 4 ✅ | src\v2\store\slices\__tests__\workflowSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| PauseWorkflow | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ResumeWorkflow | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| CancelWorkflow | 5 ✅ | src\v2\store\slices\__tests__\orchestrationSlice.test.ts, src\v2\store\slices\__tests__\workflowSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetWorkflowRun | 4 ✅ | src\v2\store\slices\__tests__\workflowSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ListWorkflowExecutions | 4 ✅ | src\v2\store\slices\__tests__\workflowSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ExportWorkflow | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| RunCodeReviewWorkflow | 5 ✅ | src\v2\components\orchestration\__tests__\OrchestrationRunner.test.tsx, src\v2\store\slices\__tests__\orchestrationSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| RunRefactoringWorkflow | 4 ✅ | src\v2\components\orchestration\__tests__\OrchestrationRunner.test.tsx, src\v2\store\slices\__tests__\orchestrationSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RunTestPipelineWorkflow | 3 ✅ | src\v2\components\orchestration\__tests__\OrchestrationRunner.test.tsx, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RunHandoffWorkflow | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| RunParallelAnalysis | 3 ✅ | src\v2\components\orchestration\__tests__\OrchestrationRunner.test.tsx, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetWorkflowStatus | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| ListWorkflowRuns | 4 ✅ | src\v2\store\slices\__tests__\orchestrationSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| CancelWorkflowRun | 3 ✅ | src\v2\store\slices\__tests__\orchestrationSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetCurrentVersion | 5 ✅ | src\v2\store\slices\__tests__\updaterSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| CheckForUpdate | 4 ✅ | src\v2\store\slices\__tests__\updaterSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| DownloadUpdate | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| OpenDownloadedFile | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| OpenReleasePage | 3 ✅ | src\v2\store\slices\__tests__\updaterSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetChangelog | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetUpdateHistory | 4 ✅ | src\v2\store\slices\__tests__\updaterSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| SaveUpdateRecord | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetAllReleases | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SilentDownload | 5 ✅ | src\v2\App.tsx, src\v2\wails\adapter.ts, src\v2\wails\events.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\events.test.ts |
| GetCostSummary | 6 ✅ | src\v2\pages\__tests__\CostPage.test.tsx, src\v2\store\slices\__tests__\costSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ResetCostTracker | 4 ✅ | src\v2\pages\__tests__\CostPage.test.tsx, src\v2\store\slices\__tests__\costSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| CheckBudgetExceeded | 4 ✅ | src\v2\pages\__tests__\CostPage.test.tsx, src\v2\store\slices\__tests__\costSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetBudgetConfig | 5 ✅ | src\v2\pages\__tests__\CostPage.test.tsx, src\v2\store\slices\__tests__\costSlice.test.ts, src\v2\store\__tests__\bootstrap.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SetBudgetConfig | 4 ✅ | src\v2\pages\__tests__\CostPage.test.tsx, src\v2\store\slices\__tests__\costSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SetBudgetLimit | 5 ✅ | src\v2\pages\__tests__\CostPage.test.tsx, src\v2\store\slices\__tests__\costSlice.test.ts, src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetSecurityStatus | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| RotateEncryptionKey | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetKeyRotationInfo | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| CheckAntivirusCompatibility | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetTelemetryStatus | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| ToggleTelemetry | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| SetTelemetryEndpoint | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| IngestDirectory | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetIngestionStatus | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| CheckEnvironment | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| FixEnvironmentIssue | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetMultimodalCapabilities | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| AnalyzeImage | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| WindowMinimise | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| WindowMaximise | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| WindowClose | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetPlatform | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetAvailableEditors | 3 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts, src\v2\wails\__tests__\adapter.test.ts |
| GetPreferredEditor | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| SetPreferredEditor | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| OpenInEditor | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| PopoutWindow | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| GetPopoutState | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
| WindowSetAlwaysOnTop | 2 ✅ | src\v2\wails\adapter.ts, src\v2\wails\__mocks__\App.ts |
