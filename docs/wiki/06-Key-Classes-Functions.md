# 06 · 关键类与函数

> 收录跨文件被引用的核心结构体、方法、常量、API 契约。
> 配合 [03-Backend-Modules](03-Backend-Modules.md) 查阅。

---

## 1. 后端核心结构体

### 1.1 `App`（`main.go`）

> 整个后端的唯一状态容器。完整字段见 [03-Backend-Modules §1.1](03-Backend-Modules.md#11-app-struct)

**保留字段（不能删除）**：

```go
llmConfig            LLMProviderConfig   // syncSettingsToConfig() 依赖
cachedProvider       ap.Provider          // castLLM 缓存
cachedProviderConfigHash string           // 缓存命中检测
mu                   sync.RWMutex         // 全局读写锁
```

**AP 子系统字段**：见 [04-AP-Framework-Integration §3](04-AP-Framework-Integration.md#3-ap-子系统对照表)

### 1.2 `Session` / `Message` / `Skill` / `Task`（`session.go`）

| 类型 | 用途 |
|------|------|
| `type Session struct { ID, Title, Messages, ProjectID, Skills, CreatedAt, UpdatedAt, ... }` | 会话 |
| `type Message struct { Role, Content, Reasoning, ToolCalls, ToolCallID }` | 单条消息 |
| `type Skill struct { ID, Name, Description, Prompt, Type, CreatedAt }` | 技能 |
| `type Task struct { ID, Name, Description, Command, Schedule, Enabled, LastRun, NextRun, Status, LastError }` | 定时任务 |
| `type ToolCall struct { ID, Name, Args }` | LLM 工具调用 |

### 1.3 `Config` / `Settings` / `LLMProviderConfig` / `ProviderPreset`（`config.go`）

```go
type Config struct { App AppConfig; Model ModelConfig }
type AppConfig struct { Name, Version, DataDir string }
type ModelConfig struct { Provider, APIKey, BaseURL, Model string }
type LLMProviderConfig struct {
    APIURL string `json:"api_url"`
    Model  string `json:"model"`
    APIKey string `json:"-"`   // 故意不进 JSON
}
type ProviderPreset struct { ID, Name, APIURL, DefaultModel string; Models []string }
var BuiltinProviders []ProviderPreset  // 9+1 预设
```

### 1.4 `castTool` / `castToolRegistry` / `CastToolInvocation`（`cast_tools.go`）

```go
type castTool struct {
    app         *App
    name        string
    category    string
    description string
    parameters  json.RawMessage
    execute     func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error)
}
type castToolRegistry struct { mu sync.RWMutex; history []CastToolInvocation }
type CastToolInvocation struct {
    ID, ToolName, Category, Args, Result string
    IsError bool
    SessionID string
    DurationMs int64
}
type ToolCatalogItem struct { Name, Category, Description string }
```

### 1.5 `APMetricsSnapshotData` / `TokenUsageData`（`main.go`）

> 前端直接消费的指标快照。

```go
type APMetricsSnapshotData struct {
    LLM/Tool TotalCalls/Errors int64
    TotalTurns, TotalEpisodes, ActiveAgents, PoolQueueLength, MemorySizeBytes int64
    LLM/Tool LatencyP50/P99 float64
    TokenUsageByModel map[string]TokenUsageData
}
type TokenUsageData struct { Prompt, Completion, Total int64 }
```

---

## 2. 核心方法契约

### 2.1 `chat.go` 公开

```go
func (a *App) SendMessage(sessionID, input string) ([]Message, error)
func (a *App) SendMessageEx(sessionID, input, model, thinking string) ([]Message, error)
```

- 通过 `wailsRuntime.EventsEmit(a.ctx, "stream:"+sessionID, …)` 推流
- 流结束自动 `a.memory.Add`（User + Assistant 各一条 Episode）
- 同步 `session.Messages` 并 `persistSession`

### 2.2 `config.go` 关键私有 / 公开

```go
func (a *App) initSettings()                              // 从 settings.json 加载（含解密）
func (a *App) saveSettingsToFile() error                  // 加密后落盘
func (a *App) syncSettingsToConfig()                       // settings → a.llmConfig（必须保留）
func (a *App) resolveCredentialsLocked(model string) (*APICredentials, error)  // 持锁
func guessProviderForModel(model string) string             // 派生 providerID
func setupSecurityACL(projects []string) *ap.ACL
func setupSecuritySandbox(acl *ap.ACL) *ap.Sandbox
func (a *App) setGlobalValidateCommand()
```

### 2.3 `provider_factory.go`

```go
func (a *App) createProviderLocked(modelOverride string) (ap.Provider, error)            // 持锁
func (a *App) createCachedProviderLocked(modelOverride string) (ap.Provider, error)      // 持锁
```

支持的 provider（通过 `guessProviderForModel` 派生）：

| providerID | AP 构造器 |
|------------|-----------|
| `openai` | `ap.NewOpenAIProvider` |
| `anthropic` | `ap.NewAnthropicProvider` |
| `gemini` | `ap.NewGeminiProvider` |
| `ollama` | `ap.NewOllamaProvider` |
| `azure` | `ap.NewAzureOpenAIProvider` |
| `mistral` | `ap.NewMistralProvider` |
| `cohere` | `ap.NewCohereProvider` |
| `deepseek` | `ap.NewOpenAIProvider` (兼容模式) |
| `qwen` | `ap.NewOpenAIProvider` (DashScope) |
| `glm` | `ap.NewOpenAIProvider` (智谱) |

### 2.4 `cast_tools.go` 公开

```go
func (a *App) RegisterCastTools(toolkit *ap.ToolRegistry) error
func (a *App) ExtractStructured(text, schemaName string) (string, error)
func (a *App) ExtractStructuredCustom(text, schemaJSON string) (string, error)
func (a *App) GetToolHistory(sessionID string, limit int) []CastToolInvocation
func (a *App) InvokeCastTool(name, argsJSON string) (string, error)
func (a *App) GetToolCatalog() []ToolCatalogItem
func (a *App) castLLM(ctx context.Context, systemPrompt, userPrompt string) (string, error)
```

### 2.5 `main.go` 公开（指标/缓存/上下文窗口）

```go
func (a *App) GetAPMetricsSnapshot() APMetricsSnapshotData
func (a *App) GetMetricsExportPrometheus() string
func (a *App) GetSessionSummary(sessionID string) *ap.SummaryResult
func (a *App) GetLifecycleState() string
func (a *App) GetAgentLifecycleStates() map[string]string
func (a *App) GetCacheStats() ap.CacheStats
func (a *App) ClearCache() error
func (a *App) SetCacheEnabled(bool)
func (a *App) InvalidateCacheKey(key string) error
func (a *App) GetContextWindowConfig() map[string]any
func (a *App) SetContextWindowKeepLast(int)
```

### 2.6 `session.go` 关键

```go
func (a *App) initDefaultSkills()                          // 注入内置技能
func (a *App) getSessionByID(id string) *Session           // 读锁下遍历
func (a *App) getOrCreateAgent(sessionID, model string) (ap.Agent, context.CancelFunc, error)
func (a *App) persistSession(s *Session) error             // → persistence.go
func (a *App) loadPersistedSessions() error                // 启动恢复
```

---

## 3. 关键工具函数

| 函数 | 位置 | 用途 |
|------|------|------|
| `formatFileSize(int64) string` | config.go | 字节→人类可读 |
| `orDefault(s, d string) string` | cast_tools.go | 默认值 |
| `nowMs() int64` | cast_tools.go | 当前毫秒时间戳 |
| `parseNumberedList(text) []string` | cast_tools.go | 提取有序列表 |
| `isAllDigit(s) bool` | cast_tools.go | 数字判断 |
| `histogramPercentile(snap, p) float64` | main.go | 估算分位数 |

---

## 4. 关键常量

```go
// config.go
MaxReadFileSize    = 4MB
MaxPreviewFileSize = 2MB
MaxWriteFileSize   = 10MB
MaxResponseSize    = 10MB
DefaultMaxTokensNormal  = 8192
DefaultMaxTokensLongCtx = 65536
MessageHistoryLimit = 20

// cast_tools.go
castRegHistoryCap = 200   // 工具历史最大条数
```

---

## 5. 关键适配器（AP ↔ Wails）

| 适配 | 位置 |
|------|------|
| EventBus → Wails Events | `event_bridge.go` |
| MCPRegistry → Wails 绑定 | `mcp_bridge.go` |
| Metrics → Wails 绑定 | `metrics_bridge.go` |
| MultimodalProvider → Wails 绑定 | `multimodal_bridge.go` |
| Orchestration → Wails 绑定 | `orchestration_bridge.go` |
| PluginLoader → Wails 绑定 | `plugin_bridge.go` |
| ACL/Sandbox → Wails 绑定 | `security_bridge.go` |
| Telemetry → Wails 绑定 | `telemetry_bridge.go` |
| Workflow → Wails 绑定 | `workflow_bridge.go` |

---

## 6. 前端（package.json）核心依赖

> 详见 [07-Dependencies](07-Dependencies.md)

- `react` 18.3.1
- `zustand` 4.5（slice pattern，15 个分片）
- `@tanstack/react-virtual` 3.13（虚拟滚动）
- `mermaid` 11 / `katex` / `highlight.js` / `dompurify` / `marked`
- `@sentry/react` 10（前端错误监控）
- `@agentprimordia/sdk`（本地 file 引用 → `../../../agentprimordia/agentprimordia/sdk/typescript`）
- 测试：`vitest` 2.1 / `@playwright/test` / `@testing-library/react`
- 构建：`vite` 5.4 / `typescript` 5.5
- 质量：`eslint` 8 / `prettier` 3 / `rollup-plugin-visualizer`

> 前端源码 `src/` 不在本仓库，以 Wails 嵌入式 `frontend/dist` 形式存在。
> 前端架构详见 [`frontend/ARCHITECTURE.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/ARCHITECTURE.md)。
