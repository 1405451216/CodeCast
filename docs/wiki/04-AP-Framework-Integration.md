# 04 · AP（AgentPrimordia）框架集成

> **本章是迁移期的硬约束**。所有 PR 在触碰 AP 相关代码前，请读完本节。

---

## 1. 集成目标

把 CodeCast 早期自研的 agent / memory / llm / mcp / sandbox / context 等模块**全部替换**为 [AgentPrimordia (AP)](file:///d:/codecast/agentprimordia/agentprimordia/pkg) 框架的等价物（Big Bang 替换），**保留** 应用层代码（session bookkeeping、notes、skills、completor）。

---

## 2. 关键设计决策

| 维度 | 决策 |
|------|------|
| 模块位置 | `agentprimordia` 是本地 Go module，`go.mod` 通过 `replace` 指向 `../../agentprimordia/agentprimordia` |
| 单进程 | 整个后端仍是单一 `package main`，不引入新包名 |
| 并发 | `App.mu` 单一 `sync.RWMutex` 保护全部应用层共享状态；AP 子系统自带锁 |
| 锁契约 | `createProviderLocked` / `createCachedProviderLocked` / `resolveCredentialsLocked` 内部**禁止**再加锁 |
| 桥接 | AP ↔ Wails 全部通过 `*_bridge.go` 一对一文件桥接 |

---

## 3. AP 子系统对照表

> 来源：[`main.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/main.go#L46-L106) App 字段

| AP 子系统 | App 字段 | 类型 | 关键用途 |
|----------|----------|------|----------|
| Agent（ReAct） | `agent` | `ap.Agent` | 默认对话 Agent |
| Agent Pool | `pool` | `*ap.Pool` | 并发子代理（最大 5） |
| Memory（SQLite + FTS5） | `memory` | `*ap.SQLiteStore` | 情景记忆 |
| RAG Store | `ragStore` | `*ap.RAGStore` | 检索增强 |
| Tool Registry（内置） | `toolkit` | `*ap.ToolRegistry` | FS/Shell/Web/Search/Utils |
| Tool Registry（Cast） | `castReg` | `*castToolRegistry` | CodeCast 扩展工具 |
| MCP Registry | `mcpReg` | `*ap.MCPRegistry` | MCP 服务器 |
| EventBus | `eventBus` | `*ap.Bus` | 事件总线（channel 模型） |
| Metrics | `metricsCollector` | `*ap.AgentMetricsCollector` | 调用/延迟/Token |
| MetricsExporter | `metricsExporter` | `*ap.MetricsExporter` | 15s 周期导出 |
| Guardrail | `guardrail` / `guardrailHook` | `*ap.GuardrailEngine` / `*ap.GuardrailHook` | PII/敏感词/注入防护 |
| FileLockManager | `fileLockMgr` | `*ap.FileLockManager` | 跨 agent 文件互斥 |
| Security | `acl` / `sandbox` | `*ap.ACL` / `*ap.Sandbox` | 路径/命令校验 |
| Hooks | `hooks` | `*ap.HookManager` | Hook 链 |
| Checkpoint | `checkpointStore` | `ap.CheckpointStore` | 高危操作前暂停 |
| Lifecycle | `lifecycle` | `*ap.Lifecycle` | 状态机 |
| CostTracker | `costTracker` | `*ap.CostTracker` | 成本统计 |
| CacheManager | `cacheManager` | `*ap.CacheManager` | HybridCache |
| Summarizer | `summarizer` | `*ap.Summarizer` | 会话总结 |
| SummaryEngine | `summaryEngine` | `*ap.SummaryEngine` | 总结调度 |
| StructuredExtractor | `structuredExtractor` | `*ap.StructuredExtractor` | 结构化抽取 |
| ContextWindow | `contextWindowStrategy` | `ap.ContextWindowStrategy` | 上下文窗口（默认 80） |
| Multimodal | `multimodalProvider` | `ap.MultimodalProvider` | 视觉/音/视频 |
| Telemetry | `telemetryProvider` | `*ap.TelemetryProvider` | OTLP |
| Plugin | `pluginLoader` | `*ap.PluginLoader` | 插件加载 |
| MessageBus | `messageBus` | `*ap.LocalMessageBus` | 进程内消息 |
| HTTPTransport | `httpTransport` | `*ap.HTTPTransport` | 外部 HTTP |

---

## 4. 适配器

> 全部在 `startup()` 中连接 AP ↔ CodeCast。

| 适配器 | 用途 |
|--------|------|
| `ap.NewEventBusAdapter(a.eventBus)` | 接到 `ReActConfig.EventPublisher` |
| `ap.NewMetricsAdapter(a.metricsCollector)` | 接到 `ReActConfig.Metrics` |
| `ap.NewMemoryAdapter(a.memory)` | 接到 Agent 的 Memory |
| `ap.NewEmbeddingAdapter(provider, 1536)` | 给 RAGStore 提供 embedding |
| `ap.NewRAGProviderAdapter(a.ragStore)` | 接到 `RAGConfig.Provider` |
| `ap.NewKnowledgeSearcherAdapter(a.ragStore)` | 知识库检索 |
| `ap.NewRAGStore(memory, embedder)` | RAG 存储 |

> `HybridCache`：FingerprintCache（2000 条 / 30 分钟 TTL）+ InMemoryCache（基于简单 embedding，4096 条 / 阈值 0.9）。

---

## 5. 默认 Agent 构造（ReAct）

```go
a.agent = ap.NewReActAgent(ap.ReActConfig{
    Name:            "CodeCast",
    SystemPrompt:    a.buildSystemPrompt(nil),
    Model:           provider,
    Toolkit:         a.toolkit,
    EventPublisher:  ap.NewEventBusAdapter(a.eventBus),
    Metrics:         ap.NewMetricsAdapter(a.metricsCollector),
    ContextWindow:   a.contextWindowStrategy,
    Lifecycle:       a.lifecycle,
    CheckpointStore: a.checkpointStore,
    MaxTurns:        20,
}).WithMemory(ap.NewMemoryAdapter(a.memory)).
    WithRAG(ap.RAGConfig{
        Provider: ap.NewRAGProviderAdapter(a.ragStore),
        Mode:     ap.RAGModeAuto,
        TopK:     5,
    }).
    WithHooks(a.hooks).
    WithCostTracker(a.costTracker)
```

> 字段名注意：`Model`（不是 `Provider`）、`Toolkit`（不是 `ToolRegistry`）、`Metrics`（不是 `MetricsRecorder`，需要传 `MetricsRecorder` 兼容类型）、`Memory` 类型是 `MemoryStore`（用 `ap.NewMemoryAdapter` 包装）。

---

## 6. 锁契约（核心防死锁）

> 这是迁移期最高频踩坑点。

### 6.1 谁必须持锁

- `createProviderLocked(modelOverride)` — 内部调用 `resolveCredentialsLocked` 和 `ap.New*Provider`
- `createCachedProviderLocked(modelOverride)` — 在 `provider_factory.go`
- `resolveCredentialsLocked(modelOverride)` — `config.go`，读 `a.settings` / `a.llmConfig`

### 6.2 为什么不能内嵌 `a.mu.RLock()`

- `sync.RWMutex` 不可重入
- 在持锁状态再尝试 Lock → 死锁

### 6.3 调用模板

```go
a.mu.Lock()
defer a.mu.Unlock()
provider, err := a.createProviderLocked("")  // OK：持锁
```

### 6.4 Provider ID 派生

`APICredentials` 结构体只有 `APIKey / APIURL / Model`，**没有 ProviderID**。统一：

```go
providerID := guessProviderForModel(creds.Model)  // config.go
switch providerID {
case "openai":    // ap.NewOpenAIProvider
case "anthropic": // ap.NewAnthropicProvider
case "gemini":    // ap.NewGeminiProvider
case "ollama":    // ap.NewOllamaProvider
case "azure":     // ap.NewAzureOpenAIProvider
case "mistral":   // ap.NewMistralProvider
case "cohere":    // ap.NewCohereProvider
case "deepseek":  // ap.NewOpenAIProvider (兼容模式)
case "qwen":      // ap.NewOpenAIProvider (DashScope)
case "glm":       // ap.NewOpenAIProvider (智谱)
}
```

---

## 7. 桥接文件索引（`*_bridge.go`）

| 桥 | 来源 | 目标 |
|----|------|------|
| [`event_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/event_bridge.go) | AP Bus (channel) | Wails `EventsEmit` |
| [`mcp_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/mcp_bridge.go) | AP `MCPRegistry` | Wails 绑定（MCP 服务器增删改查） |
| [`metrics_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/metrics_bridge.go) | AP Metrics | Wails 绑定（前端指标展示） |
| [`multimodal_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/multimodal_bridge.go) | AP MultimodalProvider | Wails 绑定（多模态能力） |
| [`orchestration_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/orchestration_bridge.go) | AP Orchestration | Wails 绑定（DAG / Pipeline） |
| [`plugin_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/plugin_bridge.go) | AP PluginLoader | Wails 绑定 |
| [`security_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/security_bridge.go) | AP ACL / Sandbox | Wails 绑定 |
| [`telemetry_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/telemetry_bridge.go) | AP Telemetry | Wails 绑定（OTLP 开关） |
| [`workflow_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/workflow_bridge.go) | AP Workflow | Wails 绑定（pause/resume/cancel） |

---

## 8. AP 事件常量

```go
ap.EventAgentStart, ap.EventAgentStop, ap.EventAgentError
ap.EventTurnStart, ap.EventTurnEnd
ap.EventToolCall, ap.EventToolResult
ap.EventLLMCall, ap.EventLLMResponse
ap.EventPoolDispatch, ap.EventPoolComplete
```

Stream 事件类型：

```go
ap.StreamEventToken      // 内容
ap.StreamEventThought    // 推理
ap.StreamEventToolCall   // 工具调用
ap.StreamEventToolResult // 工具结果
ap.StreamEventError      // 错误
ap.StreamEventComplete   // 完成
```

Agent 状态：

```go
ap.StatusIdle, StatusRunning, StatusPaused,
StatusWaitingForInput, StatusCompleted, StatusFailed, StatusCancelled
```

---

## 9. Hook 点（30+）

> 注册：`hooks.Register(ap.HookBeforeTool, fn)`，`fn` 签名 `func(ctx context.Context, hctx *ap.HookContext) error`

```
HookBeforeRun, HookAfterRun
HookBeforeTurn, HookAfterTurn
HookBeforeLLM, HookAfterLLM
HookBeforeTool, HookAfterTool          ← checkpointHook 在此
HookOnError, HookOnComplete
HookBeforeRAG, HookAfterRAG
HookBeforePipelineStep, HookAfterPipelineStep
HookBeforeHandoff, HookAfterHandoff
HookBeforeParallelAgent, HookAfterParallelAgent
HookBeforeDAGNode, HookAfterDAGNode
HookOnStream, HookOnStreamStart, HookOnStreamEnd
HookBeforeMemoryRead, HookAfterMemoryRead
HookBeforeMemoryWrite, HookAfterMemoryWrite
HookContextWindowUpdate, HookContextWindowFull
HookBeforeToolParse, HookAfterToolParse
HookOnMetricsCollect
HookBeforeShutdown, HookAfterShutdown
HookOnStateChange
```

---

## 10. 删除 / 保留对照

### 已删除（被 AP 替代）
- `agent.go` / `agent_engine.go` / `agent_tools.go` / `agent_persist.go`
- `memory.go` / `llm/` 整目录
- `mcp.go` / `sandbox.go` / `context.go` / `prompts.go`（常量迁到 `prompt_builder.go`）

### 保留
- `persistence.go`（应用层 JSON 持久化）
- `main.go`（App 容器）
- `session.go`（会话 + skills）
- `config.go`（凭据 + 模型配置）
- `shell.go` / `notes.go`（应用层工具）
- `completor.go`（基于 AP `CachedProvider`）
- `notification.go`（基于 AP EventBus）

---

## 11. 迁移 Checklist（开发用）

> 引用自 `AGENTS.md` Migration Status

- [ ] Backend: Provider Factory (`provider_factory.go`)
- [ ] Backend: Prompt Builder (`prompt_builder.go`)
- [ ] Backend: Checkpoint Hook (`checkpoint_hook.go`)
- [ ] Backend: Event Bridge (`event_bridge.go`)
- [ ] Backend: Chat Entry Point (`chat.go`)
- [ ] Backend: Agent Bridge (`agent_bridge.go`)
- [ ] Backend: App Struct Rewrite (`main.go`)
- [ ] Backend: Session Decomposition (`session.go`)
- [ ] Backend: File Deletions (12 files)
- [ ] Backend: Remaining File Adaptation (5 files)
- [ ] Frontend: TypeScript SDK Installation
- [ ] Frontend: Type Rewrites
- [ ] Frontend: Store Slice Rewrites
- [ ] Frontend: API and Hook Adaptation
- [ ] Frontend: Component Adaptation
- [ ] Integration Testing
- [ ] Cleanup
