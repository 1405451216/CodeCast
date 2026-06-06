# 2026-06-06 后端集成对齐实施计划

> 目标：将 v2 前端 adapter/slice/component 层与 Go Wails 后端真实方法签名完全对齐，使消息能真正发出去、数据能从后端加载、事件能从后端推送到前端。

## 现状摘要

adapter 封装了 22 个函数，但仅 10 个能正确匹配 Go 方法；12 个存在签名错误或方法名不存在。前端只订阅了 1 个事件（`stream:{sessionId}`），Go 发出 18+ 种事件。App.tsx 无启动初始化，所有 send/cancel 回调都是 noop。

---

## Task 0 — 预检（Preflight）

**目标**：确认 Go 后端当前实际暴露的 Wails binding 列表，建立可信的"真值源"。

0a. 读取 `frontend/wailsjs/go/main/App.js` 中所有导出的 stub 函数名。
0b. 在 Go 源码中逐一确认每个 stub 是否对应真实 `func (a *App) Xxx()` 方法。
0c. 标记三类：**OK**（签名匹配）、**MISMATCH**（方法存在但签名不符）、**PHANTOM**（Go 中不存在）。
0d. 产出 `adapter-audit.md`（本文档附录 A），作为后续所有改动的参照。

验证：audit 表与下文 Task 1 的改动清单一一对应。

---

## Task 1 — Adapter 签名对齐（Commit C1）

**目标**：adapter.ts + App.js + App.d.ts 三文件同步，与 Go 真实签名 1:1 对齐。

### 1a. wailsjs 桩文件更新

更新 `frontend/wailsjs/go/main/App.js` 和 `App.d.ts`，使桩函数名和签名与 Go 一致：

| 当前桩 | Go 真实方法 | 操作 |
|---|---|---|
| `CreateSession()` (0 参) | `CreateSession(name, skillID, mode string) *Session` | 加 3 参数 |
| `SwitchSession(id)` | 不存在 | **删除** |
| `CancelMessage(sessionId)` | `CancelSessionRequest(sessionID string)` | 重命名 |
| `GetModels()` | 不存在 | **删除**，替换为 `GetProviders()` + `GetProviderModels(providerID)` |
| `SetModel(model)` | 不存在 | **删除**，替换为 `UpdateSetting("llm_model", model)` |
| `GetCurrentModel()` | 不存在 | **删除**，从 Settings.LLMModel 读取 |
| `SwitchProject(id)` | `SetCurrentProject(id string)` (无返回值) | 重命名 |
| `ListMCPServers()` | `GetMCPStatus() []MCPStatusEntry` | 重命名 |
| `ConnectMCP(name)` | `ToggleMCPServer(id string, enabled bool)` | 重命名 + 改签名 |
| `DisconnectMCP(name)` | `ToggleMCPServer(id string, enabled bool)` | 重命名 + 改签名 |
| `GetGitBranches()` | 不存在 | **删除** |

新增桩函数（Go 有但桩缺失）：

| Go 方法 | 签名 |
|---|---|
| `GetSession(id)` | `GetSession(id: string): Session` |
| `SearchSessions(keyword)` | `SearchSessions(keyword: string): Session[]` |
| `RenameSession(id, newName)` | `RenameSession(id: string, newName: string): void` |
| `GetArchivedSessions()` | `GetArchivedSessions(): Session[]` |
| `ArchiveSession(id)` | `ArchiveSession(id: string): void` |
| `UnarchiveSession(id)` | `UnarchiveSession(id: string): void` |
| `AddMCPServer(name, url)` | `AddMCPServer(name: string, url: string): void` |
| `RemoveMCPServer(id)` | `RemoveMCPServer(id: string): void` |
| `GetMCPServerTools(id)` | `GetMCPServerTools(id: string): string[]` |
| `ConfirmGitCommit(filePath)` | `ConfirmGitCommit(filePath: string): void` |
| `GetCurrentProject()` | `GetCurrentProject(): Project \| null` |
| `AddProject(path)` | `AddProject(path: string): Project` |
| `RemoveProject(path)` | `RemoveProject(path: string): void` |
| `GetModelConfigs()` | `GetModelConfigs(): ModelConfigItem[]` |
| `GetProviders()` | `GetProviders(): ProviderPreset[]` |
| `GetProviderModels(providerID)` | `GetProviderModels(providerID: string): string[]` |
| `UpdateSetting(key, value)` | `UpdateSetting(key: string, value: any): void` |
| `SendMessageWithAttachments(sessionID, input, attachmentsJSON)` | 返回 `Message[]` |
| `GetSkills()` | `GetSkills(): Skill[]` |
| `ListFiles(path)` | `ListFiles(path: string): string[]` |
| `GetWorkspaceFiles(dirPath)` | `GetWorkspaceFiles(dirPath: string): string[]` |

### 1b. adapter.ts 重写

将 adapter 从 9 个 namespace 扩展为覆盖所有实际 Go 方法，每个函数有显式参数类型和返回类型：

```typescript
// Sessions namespace
list:     () => App.GetSessions() as Promise<Session[]>
get:      (id: string) => App.GetSession(id) as Promise<Session | null>
create:   (name: string, skillID = '', mode = '') =>
            App.CreateSession(name, skillID, mode) as Promise<Session>
delete:   (id: string) => App.DeleteSession(id)
search:   (keyword: string) => App.SearchSessions(keyword) as Promise<Session[]>
rename:   (id: string, newName: string) => App.RenameSession(id, newName)
archive:  (id: string) => App.ArchiveSession(id)
unarchive:(id: string) => App.UnarchiveSession(id)
listArchived: () => App.GetArchivedSessions() as Promise<Session[]>

// Chat namespace
send:   (sessionId: string, text: string, model = '', thinking = '') =>
          App.SendMessageEx(sessionId, text, model, thinking) as Promise<Message[]>
cancel: (sessionId: string) => App.CancelSessionRequest(sessionId)
sendWithAttachments: (sessionId: string, text: string, attachmentsJSON: string) =>
          App.SendMessageWithAttachments(sessionId, text, attachmentsJSON) as Promise<Message[]>

// Models namespace（完全重写）
providers:     () => App.GetProviders() as Promise<ProviderPreset[]>
providerModels:(providerID: string) => App.GetProviderModels(providerID) as Promise<string[]>
configs:       () => App.GetModelConfigs() as Promise<ModelConfigItem[]>
setCurrent:    (model: string) => App.UpdateSetting('llm_model', model)
  // 注：Go 没有独立 SetModel，通过 UpdateSetting 设置

// Projects namespace
list:    () => App.GetProjects() as Promise<Project[]>
current: () => App.GetCurrentProject() as Promise<Project | null>
switch:  (id: string) => { App.SetCurrentProject(id); }  // void 返回
add:     (path: string) => App.AddProject(path) as Promise<Project>
remove:  (path: string) => App.RemoveProject(path)

// MCP namespace（完全重写）
status:     () => App.GetMCPStatus() as Promise<MCPStatusEntry[]>
add:        (name: string, url: string) => App.AddMCPServer(name, url)
remove:     (id: string) => App.RemoveMCPServer(id)
toggle:     (id: string, enabled: boolean) => App.ToggleMCPServer(id, enabled)
tools:      (id: string) => App.GetMCPServerTools(id) as Promise<string[]>

// Git namespace（缩减）
status:  () => App.GetGitStatus() as Promise<RawGitStatus>
  // 返回 map[string]interface{}，dirty 是 boolean 不是 int
confirmCommit: (filePath: string) => App.ConfirmGitCommit(filePath)
  // 删除 branches（Go 不存在此方法）

// Cast / Settings / Metrics namespace — 签名已正确，保持不变
// 新增：
// Settings.updateKey: (key, value) => App.UpdateSetting(key, value)
// Files.list: (path) => App.ListFiles(path) as Promise<string[]>
// Files.workspace: (dirPath) => App.GetWorkspaceFiles(dirPath) as Promise<string[]>
// Skills.list: () => App.GetSkills() as Promise<Skill[]>
```

### 1c. types.ts 更新

新增/修改类型以匹配 Go 结构体：

```typescript
// 新增
interface ProviderPreset { id: string; name: string; apiUrl: string; defaultModel: string; models: string[] }
interface ModelConfigItem { id: string; name: string; provider: string; model: string; apiKey: string; apiUrl: string; enabled: boolean; maxContext: number; toolRounds: number; multimodal: boolean }
interface MCPStatusEntry { id: string; name: string; connected: boolean; error?: string }
interface Skill { id: string; name: string; description: string; prompt: string }
interface CastInvocation { id: string; toolName: string; category: string; args: string; result: string; isError: boolean; sessionId: string; durationMs: number }

// 修改
interface Session { id: string; name: string; createdAt: number; skillID: string; mode: string; messages: Message[] }
  // 原 title → name, 新增 skillID/mode/messages
interface GitStatus { enabled: boolean; branch: string; dirty: boolean; ahead: number; behind: number }
  // 新增 enabled, dirty 从 number 改为 boolean
interface Project { id: string; path: string; name: string; createdAt: number; lastAccessedAt: number; customInstructions: string }
  // 扩展字段

// 删除
// GitCommit（Go 无对应方法，暂不需要）
```

### 1d. guards.ts 更新

`parseGitStatus` 需处理 Go 返回的 `map[string]interface{}`：
- `dirty` 现在是 `boolean`（不是 `number`）
- 新增 `enabled` 字段
- 返回 `GitStatus | null`

验证：`npm run typecheck` 0 错误，`npm test` adapter 测试全部更新并通过。

---

## Task 2 — Slice 对齐（Commit C2）

**目标**：所有 slice 使用正确的 adapter 函数，状态字段与 Go 返回值对齐。

### 2a. sessionSlice

| 当前 | 改为 | 原因 |
|---|---|---|
| `Sessions.create()` (0 参) | `Sessions.create(name, skillID, mode)` | Go 需要 3 参 |
| `switchSession(id)` 调用 `Sessions.switch(id)` | **删除** switchSession 的 adapter 调用，改为纯本地状态切换 `set({ currentId: id })` | Go 没有 SwitchSession 方法 |
| — | 新增 `searchSessions(keyword)` | 暴露 `Sessions.search()` |
| — | 新增 `renameSession(id, name)` | 暴露 `Sessions.rename()` |

### 2b. chatSlice

| 当前 | 改为 | 原因 |
|---|---|---|
| `Chat.send(sessionId, text, model)` 第 4 参 thinking 传 `boolean` | 第 4 参改为 `string`（默认 `''`） | Go 签名 `thinking string` |
| `Chat.cancel(sessionId)` 调用 `CancelMessage` | 改为 `Chat.cancel(sessionId)` 调用 `CancelSessionRequest` | 方法名修正 |
| stream 事件只处理 `content/done/error` | 增加 `tool_call`、`tool_result`、`reasoning` 处理分支 | Go 会发出这三种事件 |

stream 事件处理扩展：
```typescript
case 'tool_call':
  buffer.push({ type: 'tool_call', content: e.content });
  break;
case 'tool_result':
  buffer.push({ type: 'tool_result', content: e.content });
  break;
case 'reasoning':
  reasoning += e.content ?? '';
  break;
```

### 2c. modelSlice（重写）

彻底重写，不再依赖幻影方法：

```typescript
// 状态
providers: ProviderPreset[]      // 来自 GetProviders()
configs:   ModelConfigItem[]     // 来自 GetModelConfigs()
current:   string                // 来自 Settings.LLMModel

// 动作
load()      → Promise.all([Models.providers(), Models.configs(), SettingsAdapter.get()])
              → 从 settings.llm_model 读取 current
setCurrent(model: string) → Models.setCurrent(model) → 更新本地 current
```

### 2d. projectSlice

| 当前 | 改为 | 原因 |
|---|---|---|
| `Projects.switch(id)` 调用 `SwitchProject` | 改为调用 `SetCurrentProject(id)` | 方法名修正 |
| — | 新增 `loadCurrent()` 调用 `Projects.current()` | 获取当前项目 |
| — | 新增 `addProject(path)` 调用 `Projects.add(path)` | 暴露添加项目 |
| `setNoProject(b)` 仅本地 | 改为调用 `App.SetNoProjectMode(b)` | 已有 Go 方法 |

### 2e. mcpSlice（重写）

```typescript
// 状态
servers: MCPStatusEntry[]    // 来自 GetMCPStatus()

// 动作
refreshMCP()  → MCP.status() → set({ servers })
toggle(id, enabled) → MCP.toggle(id, enabled) → refreshMCP()
add(name, url)      → MCP.add(name, url) → refreshMCP()
remove(id)          → MCP.remove(id) → refreshMCP()
```

### 2f. gitSlice

| 当前 | 改为 | 原因 |
|---|---|---|
| `Promise.all([Git.status(), Git.branches()])` | 仅调用 `Git.status()` | `GetGitBranches` 不存在 |
| `branches: string[]` 状态 | **删除** branches 字段 | Go 无此功能 |
| `commits: GitCommit[]` 状态 | **删除** commits 字段 | Go 无此功能 |
| `diff: string` 状态 | **删除** diff 字段 | Go 无此功能 |
| `parseGitStatus` 期望 `dirty: number` | 改为处理 `dirty: boolean` | Go 返回 bool |
| — | 新增 `enabled: boolean` 字段 | Go 返回 enabled |

### 2g. memorySlice — 保持现状

当前使用 `Metrics.snapshot()` 读取 `totalEpisodes` 和 `memorySizeBytes` 作为临时方案。Go 暂时没有独立的 memory 查询 API，保持不变。

### 2h. settingsSlice — 微调

新增 `updateKey(key, value)` action，调用 `SettingsAdapter.updateKey(key, value)`，用于单字段快速更新（如切换主题、修改模型名），不需要整体 save。

验证：`npm run typecheck` 0 错误，所有现有 slice 测试更新并通过。

---

## Task 3 — 事件桥接扩展（Commit C3）

**目标**：让前端能接收 Go 后端发出的关键事件，驱动 UI 实时更新。

### 3a. events.ts 扩展

新增事件订阅函数：

```typescript
// 通知
onNotification(cb: (n: NotificationPayload) => void): () => void
  → EventsOn('notification', cb)

// Git 提交确认
onGitCommitConfirm(cb: (p: { file: string; directory: string }) => void): () => void
  → EventsOn('git-commit-confirm', cb)

// 会话摘要
onSummaryReady(cb: (p: { sessionID: string; summary: string; topics: string }) => void): () => void
  → EventsOn('summary:ready', cb)

// Agent 生命周期（合并为一个通用订阅）
onAgentEvent(type: string, cb: (payload: any) => void): () => void
  → EventsOn(type, cb)   // type: 'agent:start' | 'agent:stop' | 'agent:error' | ...

// 周期广播
onMetricsSnapshot(cb: (snap: APMetricsSnapshot) => void): () => void
  → EventsOn('metrics:snapshot', cb)

onCostSummary(cb: (cost: any) => void): () => void
  → EventsOn('cost:summary', cb)

onLifecycleStates(cb: (states: Record<string, string>) => void): () => void
  → EventsOn('lifecycle:states', cb)

// 更新器
onUpdateProgress(cb: (p: UpdateProgress) => void): () => void
  → EventsOn('update-progress', cb)

// 编排
onOrchestrationEvent(type: 'start' | 'complete' | 'error', cb: (p: any) => void): () => void
  → EventsOn(`orchestration:${type}`, cb)
```

新增类型：
```typescript
interface NotificationPayload { title: string; body: string; type: string; persistent?: boolean; actions?: { label: string; action: string }[]; session_id?: string }
interface UpdateProgress { phase: string; percent: number; message: string; downloadURL?: string }
```

### 3b. 通知 slice（新增 notificationSlice）

```typescript
// 状态
notifications: NotificationPayload[]
unreadCount: number

// 动作
pushNotification(n)   → 添加到 notifications, unreadCount++
dismissNotification(i) → 移除
clearAll()            → 清空
```

### 3c. App.tsx 中注册全局事件监听

在 App.tsx 的 bootstrap useEffect 中注册以下长期监听：

```typescript
const unsubs = [
  onNotification((n) => {
    useAppStore.getState().pushNotification(n);
    toast.show(n.body, n.type === 'error' ? 'danger' : 'info');
  }),
  onMetricsSnapshot((snap) => useAppStore.setState({ metricsSnap: snap })),
  onLifecycleStates((states) => useAppStore.setState({ agentStates: states })),
  onSummaryReady(({ sessionID, summary }) => {
    // 更新 session 的摘要字段
  }),
  onGitCommitConfirm(({ file, directory }) => {
    // 弹出确认对话框
  }),
];
return () => unsubs.forEach(fn => fn());
```

验证：新增 events 测试覆盖 subscribe/unsubscribe 生命周期。

---

## Task 4 — 启动初始化 + 组件接线（Commit C4）

**目标**：App.tsx 启动时加载所有数据；核心组件从 store 读取真实数据。

### 4a. App.tsx bootstrap useEffect

```typescript
useEffect(() => {
  const { loadSessions } = useAppStore.getState();
  const { load: loadModels } = useAppStore.getState();  // modelSlice
  const { load: loadProjects } = useAppStore.getState(); // projectSlice
  const { load: loadSettings } = useAppStore.getState(); // settingsSlice
  const { loadCatalog } = useAppStore.getState();        // castSlice
  const { refreshGit } = useAppStore.getState();         // gitSlice
  const { refreshMCP } = useAppStore.getState();         // mcpSlice
  const { refreshMemory } = useAppStore.getState();      // memorySlice

  loadSessions();
  loadModels();
  loadProjects();
  loadSettings();
  loadCatalog();
  refreshGit();
  // MCP/Memory 延迟到 Drawer 打开时再加载
}, []);
```

### 4b. 消息发送接通

App.tsx 中将 noop 回调替换为真实 dispatch：

```typescript
const send = useAppStore((s) => s.send);
const cancel = useAppStore((s) => s.cancel);
const currentId = useAppStore((s) => s.currentId);

const handleSend = useCallback((text: string, opts?: { model?: string; thinking?: string }) => {
  if (currentId) send(currentId, text, opts?.model, opts?.thinking);
}, [currentId, send]);

const handleCancel = useCallback(() => {
  if (currentId) cancel(currentId);
}, [currentId, cancel]);
```

传给 `CastEmptyState` / `CodeEmptyState` 的 `onSend` 和 `onCancel` 从 `() => {}` 改为 `handleSend` / `handleCancel`。

### 4c. Sidebar 接入 store

```typescript
// 替换硬编码的 sessions/projects 数组
const sessions = useAppStore((s) => s.sessions);
const projects = useAppStore((s) => s.projects);
const currentId = useAppStore((s) => s.currentId);
const switchSession = useAppStore((s) => s.switchSession);
const createSession = useAppStore((s) => s.createSession);
```

NavGroup 中的静态 session/project 列表改为从 `sessions` 和 `projects` 动态渲染。`onSelect` 回调调用 `switchSession(id)`。

### 4d. Drawer 面板接入 store

**GitPanel**：
```typescript
const status = useAppStore((s) => s.status);  // gitSlice
const refreshGit = useAppStore((s) => s.refreshGit);
useEffect(() => { refreshGit(); }, []);
// 显示 status.branch, status.ahead, status.behind, status.dirty
```

**MCPPanel**：
```typescript
const servers = useAppStore((s) => s.servers);  // mcpSlice
const refreshMCP = useAppStore((s) => s.refreshMCP);
const toggle = useAppStore((s) => s.toggle);
useEffect(() => { refreshMCP(); }, []);
// 遍历 servers 显示每个 MCP 服务器状态
```

**MemoryPanel**：
```typescript
const stats = useAppStore((s) => s.stats);  // memorySlice
const refreshMemory = useAppStore((s) => s.refreshMemory);
useEffect(() => { refreshMemory(); }, []);
// 显示 stats.totalEpisodes, stats.sizeBytes
```

### 4e. SettingsPage 接入 store

```typescript
const settings = useAppStore((s) => s.settings);
const save = useAppStore((s) => s.save);
const load = useAppStore((s) => s.load);  // settingsSlice

useEffect(() => { load(); }, []);
// 将本地 useState 替换为从 settings 读取
// onChange 时调用 save(updatedSettings) 或 updateKey(key, value)
```

### 4f. BottomBar 接入 store

```typescript
// 已有 const model = useAppStore(s => s.current)，但 current 现在从 settings.llm_model 读取
// 新增：
const configs = useAppStore((s) => s.configs);  // modelSlice
// ModelSelector 下拉改为从 configs 列表中选择，选中后调用 setCurrent(model)
```

验证：手动确认启动后 Sidebar 显示真实 session 列表、BottomBar 显示真实模型名、Drawer 面板显示真实数据。

---

## Task 5 — 测试更新（Commit C5）

**目标**：所有改动都有对应测试，保持 100% 通过率。

### 5a. 更新 mock 文件

`frontend/src/v2/wails/__mocks__/App.ts`：
- 删除 `SwitchSession`, `CancelMessage`, `GetModels`, `SetModel`, `GetCurrentModel`, `SwitchProject`, `ListMCPServers`, `ConnectMCP`, `DisconnectMCP`, `GetGitBranches`
- 新增 `GetSession`, `SearchSessions`, `RenameSession`, `CancelSessionRequest`, `SetCurrentProject`, `GetCurrentProject`, `AddProject`, `GetMCPStatus`, `ToggleMCPServer`, `AddMCPServer`, `RemoveMCPServer`, `GetModelConfigs`, `GetProviders`, `GetProviderModels`, `UpdateSetting`, `GetSkills`, `ConfirmGitCommit`, `GetArchivedSessions`, `ArchiveSession`, `UnarchiveSession`, `ListFiles`, `GetWorkspaceFiles`, `SendMessageWithAttachments`

### 5b. 更新 adapter 测试

`wails/__tests__/adapter.test.ts`：
- 所有 22 个原有函数的测试用例更新参数和返回值断言
- 新增函数的测试用例

### 5c. 更新 slice 测试

- `sessionSlice.test.ts`：create 传 3 参、switchSession 为纯本地切换
- `chatSlice.test.ts`：thinking 为 string、cancel 调用 `CancelSessionRequest`、tool_call/reasoning 事件处理
- `modelSlice.test.ts`：重写，测 load（providers + configs + settings）和 setCurrent（UpdateSetting）
- `projectSlice.test.ts`：switch 调用 `SetCurrentProject`
- `mcpSlice.test.ts`：重写，测 status/toggle/add/remove
- `gitSlice.test.ts`：dirty 为 boolean、无 branches 调用、enabled 字段

### 5d. 新增事件测试

- `events.test.ts`：测试 `onNotification`、`onMetricsSnapshot`、`onSummaryReady` 等的 subscribe/unsubscribe

验证：`npm test` 全部通过，`npm run typecheck` 0 错误，`npm run lint` 0 warnings。

---

## Task 6 — 端到端验证（Commit C6）

**目标**：在真实 Wails 环境下验证全链路。

6a. `wails build` 编译成功（确认 App.js 桩与 Go 绑定匹配）。
6b. 启动应用，确认：
  - Sidebar 显示真实 session/project 列表
  - BottomBar 显示真实模型名
  - 在 Composer 输入消息后能发送，收到 streaming 响应
  - 取消消息正常工作
  - 切换 session 后消息列表更新
  - Git/MCP/Memory Drawer 面板显示真实数据
  - Settings 页面加载并保存设置
  - notification 事件触发 toast 显示
6c. 修复发现的运行时问题。

验证：所有核心功能可在真实 Wails 应用中操作。

---

## 附录 A — Adapter Audit 总表

| # | adapter 函数 | Go 方法 | 状态 | Task 1 操作 |
|---|---|---|---|---|
| 1 | Sessions.list → GetSessions | GetSessions() []*Session | OK | 加类型断言 |
| 2 | Sessions.create → CreateSession | CreateSession(name, skillID, mode) *Session | MISMATCH | 加 3 参数 |
| 3 | Sessions.switch → SwitchSession | 不存在 | PHANTOM | 删除，改为纯本地切换 |
| 4 | Sessions.delete → DeleteSession | DeleteSession(id) error | OK | 加类型断言 |
| 5 | Chat.send → SendMessageEx | SendMessageEx(sessionID, input, model, thinking string) | MISMATCH | thinking: boolean→string |
| 6 | Chat.cancel → CancelMessage | 不存在 | PHANTOM | 改为 CancelSessionRequest |
| 7 | Models.list → GetModels | 不存在 | PHANTOM | 改为 GetProviders+GetModelConfigs |
| 8 | Models.set → SetModel | 不存在 | PHANTOM | 改为 UpdateSetting |
| 9 | Models.current → GetCurrentModel | 不存在 | PHANTOM | 从 Settings.LLMModel 读 |
| 10 | Cast.catalog → GetToolCatalog | GetToolCatalog() []ToolCatalogItem | OK | 无变更 |
| 11 | Cast.history → GetToolHistory | GetToolHistory(sessionID, limit) | OK | 无变更 |
| 12 | Cast.invoke → InvokeCastTool | InvokeCastTool(name, argsJSON) | OK | 无变更 |
| 13 | Projects.list → GetProjects | GetProjects() []Project | OK | 无变更 |
| 14 | Projects.switch → SwitchProject | 不存在 | PHANTOM | 改为 SetCurrentProject |
| 15 | Metrics.snapshot → GetAPMetricsSnapshot | GetAPMetricsSnapshot() | OK | 无变更 |
| 16 | Metrics.clearCache → ClearCache | ClearCache() error | OK | 无变更 |
| 17 | Settings.get → GetSettings | GetSettings() Settings | OK | 无变更 |
| 18 | Settings.save → SaveSettings | SaveSettings(s) error | OK | 无变更 |
| 19 | MCP.list → ListMCPServers | 不存在 | PHANTOM | 改为 GetMCPStatus |
| 20 | MCP.connect → ConnectMCP | 不存在 | PHANTOM | 改为 ToggleMCPServer(id, true) |
| 21 | MCP.disconnect → DisconnectMCP | 不存在 | PHANTOM | 改为 ToggleMCPServer(id, false) |
| 22 | Git.status → GetGitStatus | GetGitStatus() map[string]interface{} | MISMATCH | dirty: number→boolean, 新增 enabled |
| 23 | Git.branches → GetGitBranches | 不存在 | PHANTOM | 删除 |

---

## 附录 B — Go 事件 → 前端订阅映射

| Go 事件 Topic | 前端订阅函数 | 优先级 |
|---|---|---|
| `stream:{sessionId}` | onStreamChunk (已有) | — |
| `notification` | onNotification (Task 3) | P0 |
| `summary:ready` | onSummaryReady (Task 3) | P1 |
| `git-commit-confirm` | onGitCommitConfirm (Task 3) | P1 |
| `metrics:snapshot` | onMetricsSnapshot (Task 3) | P1 |
| `lifecycle:states` | onLifecycleStates (Task 3) | P1 |
| `agent:start/stop/error/turn/tool` | onAgentEvent (Task 3) | P2 |
| `cost:summary` | onCostSummary (Task 3) | P2 |
| `cache:stats` | 暂不订阅 | P3 |
| `update-progress` | onUpdateProgress (Task 3) | P2 |
| `orchestration:*` | onOrchestrationEvent (Task 3) | P2 |
| `env-check-report` | 暂不订阅 | P3 |
| `popout-requested` | 暂不订阅 | P3 |
| `silent-download-*` | 暂不订阅 | P3 |

---

## 附录 C — 提交序列

| Commit | 内容 | 依赖 |
|---|---|---|
| C1 | Task 1: adapter + wailsjs + types + guards 对齐 | Task 0 |
| C2 | Task 2: 所有 slice 对齐 + 新增 notificationSlice | C1 |
| C3 | Task 3: events.ts 扩展 + App.tsx 事件注册 | C2 |
| C4 | Task 4: bootstrap + 组件接线（Sidebar/BottomBar/Drawer/Settings） | C3 |
| C5 | Task 5: 测试全量更新 | C4 |
| C6 | Task 6: Wails 环境端到端验证 | C5 |

---

## 附录 D — 不在本期范围

以下 Go 子系统在前端完全没有对接，留待后续专项计划：

- Agent 编排（DispatchAgents, GetAgents 等 5 方法）
- 编排工作流（RunCodeReviewWorkflow 等 8 方法）
- Workflow 引擎（RunWorkflow, PauseWorkflow 等 7 方法）
- Checkpoint 系统（GetCheckpoints, ResolveCheckpoint 等 5 方法）
- 浏览器管理（browser.go 8 方法）
- 安全/遥测/更新器（security.go + telemetry_bridge.go + updater.go 约 20 方法）
- 插件系统（plugin_bridge.go 8 方法）
- Shell 执行（shell.go 1 方法）
- 文档流水线（document_pipeline.go 2 方法）
- CastTool 页面（Writing/Translation/Knote/Schedule/Email）— 依赖 castToolSlice 设计
- FileTree 组件 — 需要 `ListFiles` / `GetWorkspaceFiles` adapter + 组件实现
