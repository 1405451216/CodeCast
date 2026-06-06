# 03 · 后端核心模块

> 描述后端（`CodeCast-desktop/`）核心 Go 文件的职责、关键结构体、对外方法。
> 前缀 `cast_*` 的工具文件统一在 [05-Cast-Toolbox](05-Cast-Toolbox.md) 描述；AP 桥接 (`*_bridge.go`) 在 [04-AP-Framework-Integration](04-AP-Framework-Integration.md) 描述。

---

## 1. `main.go` — App 主结构与生命周期

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/main.go)

### 1.1 `type App struct`

后端唯一的状态容器，字段分组：

| 分组 | 字段 |
|------|------|
| 上下文 | `ctx context.Context` |
| 基础配置 | `config *Config` / `settings *Settings` / `settingsPath` / `encryptionKey []byte` |
| 应用层数据 | `sessions []*Session` / `skills []*Skill` / `projects []Project` / `currentProjectID` / `noProjectMode` / `activeSessionID` |
| 后台协程控制 | `taskSchedulerStop chan struct{}` / `updateStop chan struct{}` |
| 一次性迁移 | `migrationPending bool` |
| 并发 | `mu sync.RWMutex` |
| **AP 核心** | `agent ap.Agent` / `pool *ap.Pool` / `memory *ap.SQLiteStore` / `ragStore *ap.RAGStore` / `toolkit *ap.ToolRegistry` / `castReg *castToolRegistry` / `mcpReg *ap.MCPRegistry` / `eventBus *ap.Bus` / `metricsCollector *ap.AgentMetricsCollector` / `metricsExporter *ap.MetricsExporter` / `guardrail *ap.GuardrailEngine` / `guardrailHook *ap.GuardrailHook` / `fileLockMgr *ap.FileLockManager` / `acl *ap.ACL` / `sandbox *ap.Sandbox` / `hooks *ap.HookManager` / `checkpointStore ap.CheckpointStore` / `lifecycle *ap.Lifecycle` |
| 会话-子代理 | `sessionAgents map[string]ap.Agent` / `sessionCancels map[string]context.CancelFunc` / `checkpointConfirmations map[string]chan bool` |
| 编排 | `orchestrationRuns` + `orchestrationMu` / `workflowRuns` + `workflowMu` |
| 成本/缓存/总结 | `costTracker *ap.CostTracker` / `budgetConfig *ap.BudgetConfig` / `cacheManager *ap.CacheManager` / `summarizer *ap.Summarizer` / `summaryEngine *ap.SummaryEngine` / `structuredExtractor *ap.StructuredExtractor` / `contextWindowStrategy ap.ContextWindowStrategy` |
| 文档/多模态/遥测 | `ingestionStatus *IngestionStatus` / `multimodalProvider ap.MultimodalProvider` / `telemetryProvider *ap.TelemetryProvider` |
| 插件 | `pluginLoader *ap.PluginLoader` / `messageBus *ap.LocalMessageBus` / `httpTransport *ap.HTTPTransport` |
| **必须保留** | `llmConfig LLMProviderConfig`（`syncSettingsToConfig` 依赖） / `cachedProvider ap.Provider` / `cachedProviderConfigHash string` |

> 详细字段定义见 [`main.go:27-113`](file:///e:/codecast/CodeCast/CodeCast-desktop/main.go#L27-L113)。

### 1.2 公开方法（被前端 Wails 绑定）

| 方法 | 行号 | 用途 |
|------|------|------|
| `GetAPMetricsSnapshot()` | L162 | 前端展示：LLM/工具调用数、Token、P50/P99 延迟、活跃 Agent、Pool 队列 |
| `GetMetricsExportPrometheus()` | L203 | Prometheus 文本格式导出 |
| `GetSessionSummary(sessionID)` | L211 | 触发会话总结（AP Summarizer + SummaryEngine） |
| `GetLifecycleState()` | L623 | 返回全局 lifecycle 状态字符串 |
| `GetAgentLifecycleStates()` | L631 | 所有 session 子 agent 的 lifecycle |
| `GetCacheStats()` | L643 | 缓存统计（`ap.CacheStats`） |
| `ClearCache()` | L651 | 清空 LLM 缓存 |
| `SetCacheEnabled(bool)` | L659 | 开关缓存 |
| `InvalidateCacheKey(string)` | L667 | 按 key 子串失效缓存 |
| `GetContextWindowConfig()` | L675 | 返回当前 ContextWindowStrategy 配置 |
| `SetContextWindowKeepLast(int)` | L690 | 更新 keep_last（默认 80） |

### 1.3 启动 / 关闭

- `NewApp()`：构造初始 `App`（默认 `Config` / `LLMProviderConfig` / 加载 settings / projects / 默认 skills）
- `(*App).startup(ctx)`：见 [02-Architecture](02-Architecture.md) §2 时序表
- `(*App).domReady(ctx)`：占位（no-op）
- `(*App).shutdown(ctx)`：有序关闭 metricsExporter → pool → bus → memory → mcpReg → scheduler → costTracker → cacheManager → telemetry → httpTransport → checkpointStore → ragStore → messageBus → pluginLoader → summaryEngine
- `func main()`：调用 `wails.Run(...)` 启动 Wails 桌面运行时（Frameless on Windows/Linux，TitleBarHiddenInset on macOS）

---

## 2. `chat.go` — 对话主入口

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/chat.go)

### 2.1 `SendMessage(sessionID, input)` / `SendMessageEx(sessionID, input, model, thinking)`

流式对话入口：
1. 取会话 / `getOrCreateAgent` / 构造带 cancel 的 ctx
2. `agent.StreamRun(ctx, ap.UserMessage(input))` → 循环读 streamCh
3. 按 `ap.StreamEvent*` 类型分别 `wailsRuntime.EventsEmit(a.ctx, "stream:"+sid, …)`
4. 流结束后把 user/assistant 文本写回 `a.memory`（两条 `Episode`）
5. 同步到 `session.Messages` 并 `persistSession`（H12 fix）
6. 触发 `castReg` 记录（如有工具调用）

### 2.2 关键私有方法

- `getOrCreateAgent(sessionID, modelOverride)` — 缓存 `sessionAgents[sessionID]`，缺失时基于会话的 `SystemPrompt` 构造新 ReActAgent 并把 model 通过 `createProviderLocked("")` 派生。
- 流控：每个会话的 `cancel` 注册到 `sessionCancels[requestKey]`，支持前端取消。

---

## 3. `session.go` — 会话 / 技能 / 任务

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/session.go)

### 3.1 核心类型

| 类型 | 用途 |
|------|------|
| `type ToolCall struct { ID, Name, Args string }` | LLM 工具调用 |
| `type Message struct { Role, Content, Reasoning, ToolCalls, ToolCallID }` | 消息 |
| `type Skill struct { ID, Name, Description, Prompt, Type, CreatedAt }` | 技能（JSON 模板） |
| `type Task struct { ID, Name, Description, Command, Schedule, Enabled, LastRun, NextRun, Status, LastError }` | 定时任务 |
| `type Session struct { ID, Title, Messages, ProjectID, Skills, CreatedAt, UpdatedAt, … }` | 会话 |

### 3.2 关键方法

- `initDefaultSkills()` — 注入内置技能（写代码、Code Review、文档生成等）
- `getSessionByID(id)` — 读锁下遍历
- `getOrCreateAgent` / `persistSession` / `loadPersistedSessions` — 会话生命周期

---

## 4. `config.go` — 配置 / 凭据 / Provider 预设

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/config.go)

### 4.1 关键常量（统一文件大小/Token 限制）

```go
MaxReadFileSize    = 4MB
MaxPreviewFileSize = 2MB
MaxWriteFileSize   = 10MB
MaxResponseSize    = 10MB
DefaultMaxTokensNormal  = 8192
DefaultMaxTokensLongCtx = 65536
MessageHistoryLimit = 20
```

### 4.2 类型

- `type Config struct { App, Model }`
- `type AppConfig { Name, Version, DataDir }`
- `type ModelConfig { Provider, APIKey, BaseURL, Model }`
- `type LLMProviderConfig { APIURL, Model, APIKey }`（APIKey 显式 `json:"-"`）
- `type ProviderPreset { ID, Name, APIURL, DefaultModel, Models []string }`
- `var BuiltinProviders []ProviderPreset` — 9+1 预设：deepseek / kimi / glm / openai / anthropic / gemini / ollama / qwen / mistral / cohere / azure

### 4.3 关键方法

- `initSettings()` / `saveSettingsToFile()` / `loadSettingsFromFile()` — JSON + AES-256-GCM 加密 API Key
- `syncSettingsToConfig()` — 把 `settings` 同步到 `llmConfig`（App 字段依赖，**不能删**）
- `resolveCredentialsLocked(modelOverride)` — **必须持锁调用**，返回 `APICredentials{APIKey, APIURL, Model}`（**注意没有 ProviderID**）
- `guessProviderForModel(model)` — 根据 model 名推断 provider（无 ProviderID 字段的解决方案）
- `setupSecurityACL(projects)` / `setupSecuritySandbox(acl)` — 初始化 AP 安全
- `setGlobalValidateCommand()` — 注入 shell 危险命令校验
- `formatFileSize(int64) string` — 工具函数

---

## 5. `persistence.go` — 会话 JSON 持久化

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/persistence.go)

> **应用层代码，必须保留**。AP 框架不替代。
- 持久化粒度：每个 session 一个 JSON 文件（`sessions/<sessionID>.json`）
- `persistSession(*Session) error`
- `loadPersistedSessions() error` — 启动时恢复
- 关联：聊天结束 / 项目切换 / 退出时调用

---

## 6. `shell.go` — Shell 命令执行

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/shell.go)

- 平台适配：Windows PowerShell / macOS zsh / Linux bash（`i18n_windows.go` / `i18n_other.go` 也有相关变体）
- 通过 AP `Sandbox.CanExecute()` 校验（`setGlobalValidateCommand()` 注入）
- 超时控制、危险命令拦截（rm -rf /、format 等）
- 环境变量注入

---

## 7. `project.go` — 项目感知

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/project.go)

- 多项目工作区 CRUD
- 切换 `currentProjectID` / 启用 `noProjectMode`
- 文件浏览 / 读取 / 编辑（受 `MaxReadFileSize` / `MaxWriteFileSize` 约束）
- 调用 AP `Sandbox.ValidatePath()` 防止目录穿越

---

## 8. `git.go` — Git 工作流

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/git.go)

- 状态检测（branch / dirty / ahead-behind）
- AI Commit（`ai_commit` 流程：分析 diff → 生成 Conventional Commits message → 确认 → `git add` + `git commit`）
- PR Template 生成
- Interactive Rebase UI 数据
- 冲突解决辅助（3 种策略）

---

## 9. `security.go` — 安全 / 加密

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/security.go)
> 相关测试：[`security_test.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/security_test.go)

- AES-256-GCM 加密 API Key（与 `crypto.go` 配合）
- 路径沙箱（已被 AP `Sandbox` 接管，但保留应用层入口）
- UI 掩码（API Key 列表展示时）

---

## 10. `crypto.go` — 加密原语

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/crypto.go)

- `generateEncryptionKey()` / `loadOrCreateKey()` / `encrypt(plain)` / `decrypt(cipher)`
- 配合 `persistence.go` 加密 settings.json

---

## 11. `cast_persistence.go` — Cast 工具状态存储

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_persistence.go)

- todos / schedules / plugins / kb / email / … 的 JSON 持久化
- 启动时 `initCastStores()` 加载

---

## 12. 其他 Go 文件速查

| 文件 | 行数 | 职责 |
|------|------|------|
| [`chat.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/chat.go) | ~150 | 聊天入口、流式响应 |
| [`checkpoint_hook.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/checkpoint_hook.go) | ~80 | HookBeforeTool → 高危操作暂停 |
| [`checkpoint_store.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/checkpoint_store.go) | ~120 | Checkpoint 持久化（应用层包装） |
| [`cost_tracker.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/cost_tracker.go) | ~80 | LLM 成本跟踪（包 AP CostTracker） |
| [`document_pipeline.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/document_pipeline.go) | ~200 | 文档导入 → RAG 流水线 |
| [`env_check.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/env_check.go) | ~60 | 启动时环境校验（Node/Python 等） |
| [`event_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/event_bridge.go) | ~150 | AP Bus → Wails Events |
| [`i18n.go` / `i18n_windows.go` / `i18n_other.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/i18n.go) | ~200 | 多语言、平台差异 |
| [`main_test.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/main_test.go) | ~100 | App 主结构测试 |
| [`mcp_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/mcp_bridge.go) | ~150 | MCP 服务器注册/连接 |
| [`metrics.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/metrics.go) | ~80 | 指标收集（包 AP Metrics） |
| [`metrics_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/metrics_bridge.go) | ~80 | 指标 → 前端 |
| [`multimodal_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/multimodal_bridge.go) | ~100 | 多模态（视觉/音/视频） |
| [`notification.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/notification.go) | ~60 | 桌面通知（toast） |
| [`orchestration_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/orchestration_bridge.go) | ~200 | AP 编排（DAG / Pipeline） |
| [`persistence.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/persistence.go) | ~120 | 会话 JSON 持久化 |
| [`plugin_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/plugin_bridge.go) | ~200 | 插件加载/沙箱/权限 |
| [`prompt_builder.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/prompt_builder.go) | ~150 | System Prompt 构建 |
| [`prompts.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/prompts.go) | ~80 | 内置 Prompt 模板 |
| [`provider_factory.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/provider_factory.go) | ~200 | 9+1 Provider 工厂 |
| [`security.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/security.go) | ~150 | ACL/Sandbox/加密 |
| [`session.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/session.go) | ~250 | 会话/技能/任务类型 |
| [`shell.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/shell.go) | ~200 | Shell 执行 + 沙箱 |
| [`telemetry_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/telemetry_bridge.go) | ~100 | OTLP Telemetry |
| [`updater.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/updater.go) | ~200 | 自动更新 |
| [`window.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/window.go) | ~100 | 窗口管理（无边框/主题/字体） |
| [`workflow_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/workflow_bridge.go) | ~200 | 工作流（DAG + 暂停/恢复/取消） |

> 具体行数随版本变化，请以文件实际为准；本表为功能索引。

---

## 13. 测试文件索引

| 测试文件 | 覆盖 |
|----------|------|
| `main_test.go` | App 主结构初始化 |
| `session_test.go` | 会话/技能 |
| `shell_test.go` | Shell 命令 |
| `security_test.go` | ACL/Sandbox/加密 |
| `prompts_test.go` | Prompt 模板 |
| `checkpoint_hook_test.go` | Checkpoint 钩子 |
| `cost_tracker_test.go` | 成本跟踪 |
| `document_pipeline_test.go` | 文档导入 |
| `mcp_bridge_test.go` | MCP |
| `metrics_bridge_test.go` | 指标桥 |
| `multimodal_bridge_test.go` | 多模态 |
| `orchestration_bridge_test.go` | 编排 |
| `plugin_bridge_test.go` | 插件 |
| `security_bridge_test.go` | 安全桥 |
| `telemetry_bridge_test.go` | 遥测 |
| `updater_test.go` | 更新器 |
| `workflow_bridge_test.go` | 工作流 |
| `test_helpers_test.go` | 公共测试工具 |

> 跑全部测试：`cd CodeCast-desktop && go test -v -race ./...`
