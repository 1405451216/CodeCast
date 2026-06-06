# 2026-06-06 后端子系统全量集成实施计划

> 目标：将剩余 ~85 个 Go 后端方法、~17 个未订阅事件、以及所有硬编码/假数据组件全面接入 v2 前端，同时修复已知的字段命名冲突隐患。

## 现状摘要

| 指标 | 当前值 |
|---|---|
| Adapter 已封装方法 | 76 / ~181 (42%) |
| 事件桥已订阅 | 10 / ~30 (33%) |
| Store slice 有真实 adapter 调用 | 9 / 13 (69%) |
| 组件完全接线 | 5 / 10 |
| 组件部分接线（仍有硬编码） | 5 / 10 |
| TypeScript 错误 | 0 |
| 测试通过 | 73 / 73 |
| Lint 警告 | 2 |

### 已知严重隐患

1. **`currentId` 命名冲突**：`sessionSlice.currentId` 和 `projectSlice.currentId` 在 Zustand 平铺合并中互相覆盖，`projectSlice` 后执行会覆盖 session 的 ID
2. **`loading` 字段冲突**：8 个 slice 共享 `loading` 字段名，组件解构出来的值不一定是目标 slice 的

---

## Task 0 — 修复字段命名冲突（Commit C0）

**目标**：消除 Zustand 平铺合并中的字段覆盖问题。

### 0a. `currentId` 重命名

| Slice | 当前字段 | 改为 |
|---|---|---|
| `sessionSlice` | `currentId` | `currentSessionId` |
| `projectSlice` | `currentId` | `currentProjectId` |

涉及更新的文件：
- `sessionSlice.ts`：接口 + 实现
- `projectSlice.ts`：接口 + 实现
- `App.tsx`：所有 `currentId` 引用（send/cancel/handleSend/handleCancel/hasMessages）
- `Sidebar.tsx`：`currentId` 选择器
- `store/index.ts`：AppState 交叉类型（自动跟随）

### 0b. `loading` 字段前缀化

| Slice | 当前字段 | 改为 |
|---|---|---|
| `sessionSlice` | `loading` | `sessionLoading` |
| `modelSlice` | `loading` | `modelLoading` |
| `projectSlice` | `loading` | `projectLoading` |
| `castSlice` | `loading` | `castLoading` |
| `memorySlice` | `loading` | `memoryLoading` |
| `mcpSlice` | `loading` | `mcpLoading` |
| `gitSlice` | `loading` | `gitLoading` |
| `settingsSlice` | `loading` | `settingsLoading` |

涉及更新：各 slice 接口/实现 + 消费组件（GitPanel、MCPPanel、MemoryPanel、SettingsPage 等）。

### 0c. 修复 lint 警告

- `SettingsPage.tsx:638`：`DesktopGeneralSection` 中 `settings` / `updateKey` 已解构但未使用 → 删除或接入

### 0d. 更新所有测试文件

验证：`tsc --noEmit` 0 错误 + `vitest run` 全通过 + `eslint` 0 警告。

---

## Task 1 — 事件桥扩展（Commit C1）

**目标**：订阅后端剩余 ~17 个事件，建立完整的事件→store/toast 管道。

### 1a. `events.ts` 新增订阅函数

| 事件名 | 新函数 | Payload 类型 |
|---|---|---|
| `agent:start` | `onAgentStart(cb)` | `AgentEventPayload` |
| `agent:stop` | `onAgentStop(cb)` | `AgentEventPayload` |
| `agent:error` | `onAgentError(cb)` | `AgentEventPayload` |
| `agent:turn` | `onAgentTurn(cb)` | `AgentEventPayload` |
| `agent:turn_end` | `onAgentTurnEnd(cb)` | `AgentEventPayload` |
| `agent:tool` | `onAgentTool(cb)` | `AgentEventPayload` |
| `agent:tool_result` | `onAgentToolResult(cb)` | `AgentEventPayload` |
| `llm:call` | `onLLMCall(cb)` | `LLMEventPayload` |
| `llm:response` | `onLLMResponse(cb)` | `LLMEventPayload` |
| `pool:dispatch` | `onPoolDispatch(cb)` | `PoolEventPayload` |
| `pool:complete` | `onPoolComplete(cb)` | `PoolEventPayload` |
| `cache:stats` | `onCacheStats(cb)` | `CacheStatsPayload` |
| `cost:summary` | `onCostSummary(cb)` — 已存在 | 只需在 App.tsx 订阅 |
| `env-check-report` | `onEnvCheckReport(cb)` | `EnvCheckReport` |
| `orchestration:start` | `onOrchestrationStart(cb)` | `OrchestrationPayload` |
| `orchestration:complete` | `onOrchestrationComplete(cb)` | `OrchestrationPayload` |
| `orchestration:error` | `onOrchestrationError(cb)` | `OrchestrationPayload` |
| `popout-requested` | `onPopoutRequested(cb)` | `PopoutPayload` |
| `silent-download-complete` | `onSilentDownloadComplete(cb)` | `DownloadCompletePayload` |
| `silent-download-progress` | `onSilentDownloadProgress(cb)` | `DownloadProgressPayload` |
| `workflow:started` | `onWorkflowStarted(cb)` | `WorkflowEventPayload` |
| `workflow:complete` | `onWorkflowComplete(cb)` | `WorkflowEventPayload` |
| `workflow:paused` | `onWorkflowPaused(cb)` | `WorkflowEventPayload` |
| `workflow:resumed` | `onWorkflowResumed(cb)` | `WorkflowEventPayload` |
| `workflow:cancelled` | `onWorkflowCancelled(cb)` | `WorkflowEventPayload` |
| `workflow_event` | `onWorkflowEvent(cb)` | `WorkflowNodeEventPayload` |

### 1b. `types.ts` 新增 payload 类型

定义上述所有 payload interface。

### 1c. `App.tsx` 事件订阅 useEffect 扩展

在现有 useEffect 中追加订阅（分组：agent 生命周期、缓存、成本、编排、工作流、更新），关键事件推送 toast/notification，其余写入 store。

### 1d. 新增 `agentSlice` 和 `costSlice`

- `agentSlice`：维护 `agents: AgentInfo[]`、`agentEvents: AgentEventPayload[]`、`poolState`
- `costSlice`：维护 `costSummary: CostSummary | null`、`budgetConfig: BudgetConfig | null`、`budgetExceeded: boolean`

验证：events.test.ts 覆盖新增订阅函数 + App.tsx 事件订阅不报类型错误。

---

## Task 2 — Adapter 扩展：核心子系统（Commit C2）

**目标**：封装使用频率最高的 5 个子系统。

### 2a. Browser adapter namespace（8 方法）

```ts
export const Browser = {
  isDomainBlocked:  (url: string) => App.IsDomainBlocked(url),
  getDomainRules:   () => App.GetDomainRules(),
  addBlockedDomain: (domain: string) => App.AddBlockedDomain(domain),
  removeBlockedDomain: (domain: string) => App.RemoveBlockedDomain(domain),
  addAllowedDomain: (domain: string) => App.AddAllowedDomain(domain),
  removeAllowedDomain: (domain: string) => App.RemoveAllowedDomain(domain),
  clearBrowserData: () => App.ClearBrowserData(),
  checkSelenium:    () => App.CheckSeleniumInstalled(),
};
```

### 2b. Plugin adapter namespace（5 方法）

```ts
export const Plugin = {
  list:    () => App.ListPlugins(),
  load:    (path: string) => App.LoadPlugin(path),
  unload:  (id: string) => App.UnloadPlugin(id),
  status:  () => App.GetPluginStatus(),
  sendMessage: (agentID: string, content: string) => App.SendPluginMessage(agentID, content),
};
```

### 2c. Workflow adapter namespace（7 方法）

```ts
export const Workflow = {
  run:    (json: string) => App.RunWorkflow(json),
  pause:  (runID: string) => App.PauseWorkflow(runID),
  resume: (runID: string) => App.ResumeWorkflow(runID),
  cancel: (runID: string) => App.CancelWorkflow(runID),
  getRun: (runID: string) => App.GetWorkflowRun(runID),
  list:   () => App.ListWorkflowExecutions(),
  export: (runID: string) => App.ExportWorkflow(runID),
};
```

### 2d. Orchestration adapter namespace（8 方法）

```ts
export const Orchestration = {
  codeReview:    (sessionID: string, code: string) => App.RunCodeReviewWorkflow(sessionID, code),
  refactoring:   (sessionID: string, code: string) => App.RunRefactoringWorkflow(sessionID, code),
  testPipeline:  (sessionID: string, code: string) => App.RunTestPipelineWorkflow(sessionID, code),
  handoff:       (sessionID: string, message: string) => App.RunHandoffWorkflow(sessionID, message),
  parallelAnalysis: (sessionID: string, input: string) => App.RunParallelAnalysis(sessionID, input),
  getStatus:     (runID: string) => App.GetWorkflowStatus(runID),
  listRuns:      () => App.ListWorkflowRuns(),
  cancelRun:     (runID: string) => App.CancelWorkflowRun(runID),
};
```

### 2e. Updater adapter namespace（8 方法）

```ts
export const Updater = {
  currentVersion: () => App.GetCurrentVersion(),
  check:          () => App.CheckForUpdate(),
  download:       (url: string) => App.DownloadUpdate(url),
  openDownloaded: (path: string) => App.OpenDownloadedFile(path),
  openReleasePage: () => App.OpenReleasePage(),
  changelog:      (notes: string, version: string, publishedAt: string) => App.GetChangelog(notes, version, publishedAt),
  history:        () => App.GetUpdateHistory(),
  allReleases:    (limit: number) => App.GetAllReleases(limit),
};
```

### 2f. `types.ts` 新增类型

- `PluginInfoData`, `PluginStatusData`
- `WorkflowRunData`
- `OrchestrationRun`, `CodeReviewResult`, `RefactoringResult`, `TestPipelineResult`, `ParallelAnalysisResult`
- `UpdateInfo`, `UpdateRecord`, `Changelog`

验证：adapter.test.ts 新增覆盖 + tsc 无错误。

---

## Task 3 — Adapter 扩展：辅助子系统（Commit C3）

**目标**：封装剩余 9 个辅助子系统。

### 3a. Cost adapter（5 方法）

```ts
export const Cost = {
  summary:     () => App.GetCostSummary(),
  budgetExceeded: () => App.CheckBudgetExceeded(),
  getBudget:   () => App.GetBudgetConfig(),
  setBudget:   (config: any) => App.SetBudgetConfig(config),
  setLimit:    (maxUSD: number) => App.SetBudgetLimit(maxUSD),
};
```

### 3b. Security adapter（3+1 方法）

### 3c. Guardrails adapter（5 方法）

### 3d. Telemetry adapter（3 方法）

### 3e. Document adapter（2 方法）

### 3f. Environment adapter（2 方法）

### 3g. Multimodal adapter（2 方法）

### 3h. Window adapter（11 方法）

### 3i. Session 扩展（3 方法追加到 Sessions namespace）

### 3j. Cache 扩展（3 方法追加到 Metrics namespace）

### 3k. `types.ts` 新增类型

- `CostSummary`, `BudgetConfig`
- `SecurityStatus`
- `GuardrailStatusData`
- `TelemetryStatus`
- `IngestionResult`, `IngestionStatus`
- `EnvCheckReport`
- `ImageAnalysisResult`, `MultimodalCapabilities`
- `EditorInfo`

验证：adapter.test.ts 扩展 + tsc 无错误。

---

## Task 4 — 新 Slice 创建（Commit C4）

**目标**：为新接入的子系统创建对应 Zustand slice。

### 4a. `agentSlice`（如果 Task 1 未创建）

- State: `agents: AgentInfo[]`, `agentEvents: AgentEventPayload[]`, `poolQueue: number`
- Actions: `refreshAgents(sessionID)`, `cancelAgent(id)`, `cancelSessionAgents(sessionID)`, `dispatchTasks(json)`
- Adapter: `Agent.*`

### 4b. `costSlice`（如果 Task 1 未创建）

- State: `costSummary`, `budgetConfig`, `budgetExceeded`
- Actions: `refreshCost()`, `setBudgetLimit(amount)`, `updateBudgetConfig(config)`
- Adapter: `Cost.*` + `onCostSummary` 事件

### 4c. `workflowSlice`

- State: `runs: WorkflowRunData[]`, `activeRun: string | null`
- Actions: `refreshRuns()`, `run(json)`, `pause(id)`, `resume(id)`, `cancel(id)`, `exportRun(id)`
- Adapter: `Workflow.*` + workflow 事件

### 4d. `pluginSlice`

- State: `plugins: PluginInfoData[]`, `status: PluginStatusData | null`
- Actions: `refresh()`, `load(path)`, `unload(id)`, `sendMessage(agentID, content)`
- Adapter: `Plugin.*`

### 4e. `updaterSlice`

- State: `currentVersion`, `updateInfo`, `history`, `downloading`
- Actions: `check()`, `download(url)`, `openReleasePage()`, `refreshHistory()`
- Adapter: `Updater.*` + `onUpdateProgress` / `onSilentDownloadComplete` 事件

### 4f. `orchestrationSlice`

- State: `runs: OrchestrationRun[]`, `activeRun`
- Actions: `refreshRuns()`, `cancelRun(id)`, `codeReview(sessionID, code)`, `refactoring(...)`, etc.
- Adapter: `Orchestration.*` + orchestration 事件

### 4g. 更新 `store/index.ts`

将新 slice 加入 AppState 交叉类型 + `create<App>()` 合并。

### 4h. 编写测试

每个新 slice 至少 3-4 个单元测试（mock adapter）。

验证：`vitest run` 全通过 + tsc 无错误。

---

## Task 5 — 组件硬编码清理（Commit C5）

**目标**：消除 Sidebar、RightPanel、SettingsPage、SlashCommandMenu 中的假数据。

### 5a. `Sidebar.tsx` 清理

| 硬编码项 | 替代方案 |
|---|---|
| 项目 fallback (`p-codecast`, `p-blog`) | 无项目时显示空态 + "添加项目"按钮 |
| 计划任务 (`s-standup`, `s-weekly`) | 从 `castToolSlice.schedules` 读取（如果为空显示空态） |
| Artifacts (`a-1`, `a-2`) | 从 `castToolSlice` 或后端 Cast.history 读取 |
| Custom 导航项 | 保留（这些是静态路由，无后端对应） |
| 最近会话 fallback (`r-1`, `r-2`, `r-3`) | 无会话时显示空态 + "新建会话"按钮 |
| Code 模式 custom 项 | 从 Skills.list() 或 Orchestration 能力读取 |

### 5b. `RightPanel.tsx` 清理

| 硬编码项 | 替代方案 |
|---|---|
| `sampleSteps` (6 步) | 从 `agentSlice.agentEvents` 或 `orchestrationSlice.runs` 动态生成 |
| `200k` 窗口大小 | 从 `modelSlice.configs` 中当前模型的 `maxContext` 读取 |
| `'~/'` fallback | 保持（无项目时的合理默认） |

### 5c. `SlashCommandMenu.tsx` 接入

- 从 `SlashCommands.list()` adapter 读取动态命令列表
- 保留内置命令（`/cast` 等）作为 fallback
- 合并去重

### 5d. `SettingsPage.tsx` 补全

| Section | 当前状态 | 改进 |
|---|---|---|
| DesktopGeneralSection | `settings`/`updateKey` 未使用 | 删除或接入（如果有对应 settings 字段） |
| SkillsSection | Artifacts toggle 本地状态 | 接入 settings 或移除 |
| DeveloperSection | 占位 MCP 区域 | 接入 MCP adapter 展示已配置服务器 |
| ExtensionsSection | 纯占位 | 接入 Plugin.list() 展示已加载插件 |

验证：组件不报类型错误 + 视觉检查空态表现。

---

## Task 6 — castToolSlice 真实实现（Commit C6）

**目标**：将 `castToolSlice` 从占位符升级为可工作的 slice。

当前状态：纯占位，`todos/schedules/knotes/emails` 全是空数组，无 adapter 调用。

### 6a. 设计方案

castToolSlice 对应 Cast 工作台的各项功能（写作/翻译/知识库/日程/邮件/工具箱）。目前后端没有专门的 Todos/Schedules/Knotes/Emails adapter 方法，这些功能可能需要：
- 通过 `Cast.invoke()` 调用后端 Cast 工具
- 通过 `Cast.catalog()` 获取可用工具列表
- 通过 `Cast.history()` 查看调用历史

### 6b. 实现

- 将 `castToolSlice` 重构为使用 `Cast.*` adapter
- `loadTools(sessionID)`: 调用 `Cast.catalog()` 获取工具列表
- `invokeTool(name, args)`: 调用 `Cast.invoke()` 并更新结果
- `refreshHistory(sessionID)`: 调用 `Cast.history()` 获取调用记录

### 6c. Cast 子页面接线

将 `CastWritingPage`、`CastTranslationPage`、`CastKnotePage`、`CastSchedulePage`、`CastEmailPage`、`CastToolsPage` 从静态页面升级为调用 castToolSlice 的交互页面。

验证：castToolSlice 测试 + Cast 子页面能调用后端工具。

---

## Task 7 — memorySlice 修复 + SlashCommands adapter 接入（Commit C7）

### 7a. memorySlice 修复

当前 `searchMemory(q)` 完全忽略查询参数，直接调 `Metrics.snapshot()`。修复为：
- 如果有专用的 memory search adapter → 使用之
- 否则在客户端过滤 `episodes` 数组

### 7b. SlashCommandMenu 接入 adapter

- 在组件 mount 时调用 `SlashCommands.list()`
- 合并后端命令与内置命令
- 支持 CRUD 操作（如果 SettingsPage 有管理入口）

---

## Task 8 — 全量验证 + 提交（Commit C8）

### 8a. TypeScript 类型检查

```bash
npx tsc --noEmit  # 期望 0 errors
```

### 8b. ESLint

```bash
npx eslint src/v2  # 期望 0 errors, 0 warnings
```

### 8c. 测试

```bash
npx vitest run  # 期望全部通过
```

### 8d. 最终审计

统计最终的 adapter 覆盖率、事件订阅率、slice 接线率，与本文档开头的"现状摘要"对比。

---

## 依赖关系与执行顺序

```
Task 0 (字段冲突修复)
  ↓
Task 1 (事件桥扩展) ← 无强依赖，可并行
  ↓
Task 2 (核心 Adapter) → Task 4 (新 Slice) → Task 5 (组件清理)
  ↓                                            ↓
Task 3 (辅助 Adapter) → Task 4               Task 6 (castToolSlice)
                                                ↓
                                               Task 7 (memory + slash)
                                                ↓
                                               Task 8 (验证)
```

Task 0 必须先完成（避免后续 slice 字段冲突）。
Task 2 和 Task 3 可在 Task 1 之后或并行执行。
Task 5-7 依赖 Task 4 的新 slice 就位。

## 预期产出

| 指标 | 当前 | 目标 |
|---|---|---|
| Adapter 方法覆盖 | 76 (42%) | ~160 (88%) |
| 事件订阅覆盖 | 10 (33%) | ~30 (100%) |
| Store slice 有 adapter 调用 | 9 (69%) | 13+ (100%) |
| 组件完全接线 | 5 | 9+ |
| 硬编码假数据 | 20+ 项 | 0 |
| 测试 | 73 | 100+ |
