# 02 · 系统架构

> 描述 CodeCast 1.0 的端到端架构：前端 ↔ Wails ↔ Go 后端 ↔ AP 框架 ↔ LLM/工具链。
> 重点：模块职责、调用关系、事件/数据流、并发模型。

---

## 1. 分层视图

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 0 · 用户界面                                                │
│   React 18 + TS + Vite  (CodeCast-desktop/frontend/)             │
│   ├─ Wails Runtime（Wails 自动生成的 `window.go.runtime.*` 桥）   │
│   └─ 状态管理：Zustand（slice pattern，15 个分片）               │
└─────────────────────────────▲────────────────────────────────────┘
                              │ Wails 绑定（方法直调）
                              │ Wails Events（事件订阅）
┌─────────────────────────────▼────────────────────────────────────┐
│ Layer 1 · Wails 桌面运行时（Go）                                   │
│   Wails v2.12.0  ·  assetserver.Options  ·  embed.FS(frontend)   │
│   生命周期：OnStartup / OnDomReady / OnShutdown                   │
└─────────────────────────────▲────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│ Layer 2 · App 主结构  (CodeCast-desktop/main.go)                 │
│   type App struct  ── 整个后端唯一的状态容器                       │
│   ├─ 配置与会话：config / settings / sessions / skills / projects│
│   ├─ LLM：llmConfig + cachedProvider + cachedProviderConfigHash  │
│   ├─ AP 适配：agent / pool / memory / ragStore / toolkit / ...   │
│   ├─ Cast 工具：castReg (castToolRegistry)                       │
│   └─ 并发：sync.RWMutex (a.mu) + 各子系统自己的锁                  │
└─────────────────────────────▲────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│ Layer 3 · 功能模块（按职责拆分，见 03-Backend-Modules）            │
│   chat / session / config / persistence / shell / security /     │
│   project / git / completor / window / updater / i18n / metrics / │
│   cast_tools_* / *_bridge                                         │
└─────────────────────────────▲────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│ Layer 4 · AP 框架  (本地 module：agentprimordia/pkg)               │
│   Agent (ReAct) · Pool · Memory (SQLite+RAG) · Bus · Hooks ·     │
│   Toolkit (Tool Registry) · Guardrails · Checkpoint · CostTracker│
│   CacheManager (Fingerprint+Vector) · ContextWindowStrategy ·    │
│   MultimodalProvider · TelemetryProvider · PluginLoader · ...     │
└─────────────────────────────▲────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│ Layer 5 · 外部依赖                                                │
│   9+1 LLM Provider · MCP 服务器 (WebSocket/stdio) · Git CLI ·    │
│   OS Shell · SQLite (modernc.org) · Wails WebView2/WKWebView     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. App 启动时序（startup）

[`main.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/main.go#L255-L528) 中的 `(*App).startup(ctx)` 是核心启动入口。**严格按编号顺序**初始化子系统：

| 步骤 | 子系统 | 关键调用 | 失败时行为 |
|------|--------|----------|------------|
| 0 | Cast 持久化存储 | `a.initCastStores()` | 容错继续 |
| 1 | AP Memory（SQLite + FTS5） | `ap.NewSQLiteStore(memoryPath)` | slog.Warn，继续；Agent 启动会被跳过 |
| 2 | AP EventBus（bufferSize=64） | `ap.NewBus(64)` | — |
| 3 | AP Metrics + Exporter | `ap.NewMetrics()` / `ap.NewMetricsExporter(..., 15s)` | — |
| 4 | AP Guardrail + GuardrailHook | `ap.NewGuardrailEngine()` + `setupGuardrails()` | — |
| 4a | AP FileLockManager | `ap.NewFileLockManager()` | — |
| 4b | AP Security（ACL + Sandbox） | `setupSecurityACL(...)` / `setupSecuritySandbox(...)` | — |
| 5 | AP Toolkit（FS/Shell/Web/Search/Utils） | `ap.DefaultToolkit(cfg)` | slog.Warn |
| 5b | Cast Tools 注册到 AP | `a.RegisterCastTools(a.toolkit)` | slog.Warn |
| 6 | AP HookManager | `ap.NewHookManager()` + `Register(HookBeforeTool, ...)` | — |
| 7 | AP MCPRegistry | `ap.NewMCPRegistry()` + `syncMCPServersToRegistry()` + `startMCPRegistry()` | — |
| 8 | AP CheckpointStore | `ap.NewSQLiteCheckpointStore(checkpointPath)` | slog.Warn |
| 9 | AP Lifecycle | `ap.NewLifecycle()` | — |
| 9b | CostTracker | `a.initCostTracker()` | — |
| 9c | CacheManager（Hybrid: Fingerprint + Vector） | `ap.NewHybridCache(fpCache, vecCache)` | slog.Warn |
| 9f | ContextWindowStrategy（Default 80） | `ap.NewDefaultStrategy(80)` | — |
| 10 | Provider（**先 Lock 再创建**） | `a.createProviderLocked("")` | slog.Warn |
| 11 | Default Agent（ReAct + Memory + RAG + Hooks + Cost） | `ap.NewReActAgent(cfg).WithMemory(...).WithRAG(...).WithHooks(...).WithCostTracker(...)` | skip if memory/toolkit nil |
| 12 | AP Pool | `ap.NewPool(PoolConfig{MaxConcurrency:5, Timeout:5min})` | — |
| 9d | Summarizer + SummaryEngine | `ap.NewSummarizer(provider)` + `ap.NewSummaryEngine(strategy, summarizer, memory)` | — |
| 9e | StructuredExtractor | `ap.NewStructuredExtractor(provider, modelName)` | slog.Warn |
| 9g | MultimodalProvider | `a.createMultimodalProviderLocked()` | slog.Warn |
| 13 | Event Bridge | `a.startEventBridge()` | — |
| 13b | OTLP Telemetry | `a.initTelemetry()` | — |
| 13c | PluginLoader + LocalMessageBus | `ap.NewPluginLoader(toolkit)` / `ap.NewLocalMessageBus()` | — |
| 14 | Session 缓存 | `sessionAgents / sessionCancels / checkpointConfirmations` | — |
| 14b | Orchestration + WorkflowRuns | `initWorkflowRuns()` | — |
| 15 | 后台 goroutine | `runScheduleDispatcher` / `autoCheckUpdate` | — |
| — | 持久化恢复 | `loadPersistedSessions()` | — |

> **M3 修复点**：在创建 Agent 之前必须再次校验 `memory != nil && toolkit != nil`，否则首条消息会空指针 panic。

---

## 3. 核心数据流

### 3.1 用户发起对话（流式）

```
Frontend (React)
  └─ window.go.runtime.EventsOn("stream:"+sessionID)        // 订阅
  └─ window.go.<App binding>.SendMessageEx(sessionID, msg, model, thinking)
        │
        ▼
chat.go: (*App).SendMessageEx
  ├─ a.getSessionByID(sessionID)                  // session.go
  ├─ a.getOrCreateAgent(sessionID, model)         // 基于会话缓存 + createProviderLocked
  ├─ reqCancel := WithCancel(a.ctx)
  ├─ streamCh, _ := agent.StreamRun(ctx, ap.UserMessage(input))
  └─ for evt := range streamCh {
        switch evt.Type {
          case ap.StreamEventToken:     EventsEmit("stream:"+sid, {type:"content", ...})
          case ap.StreamEventThought:  EventsEmit(... {type:"reasoning", ...})
          case ap.StreamEventToolCall: EventsEmit(... {type:"tool_call", ...})
          case ap.StreamEventToolResult:EventsEmit(... {type:"tool_result", ...})
          case ap.StreamEventError:     EventsEmit(... {type:"error", ...})
          case ap.StreamEventComplete:  EventsEmit(... {type:"done"})
        }
     }
  └─ a.memory.Add(Episode{UserMsg})
  └─ a.memory.Add(Episode{AssistantMsg})
  └─ s.Messages = append(s.Messages, ...)        // session.go (H12 fix)
  └─ persistSession(s)                           // persistence.go
```

### 3.2 Agent 调用工具

AP Agent 通过 `Toolkit.Execute(name, args)` 调用工具 → 路由到 `castTool.Execute` → 闭包 → 业务方法。
- **写文件/删除/推送等高危操作**：`HookBeforeTool` → `checkpointHook`（`checkpoint_hook.go`）暂停等待 `checkpointConfirmations` channel 用户确认。
- **所有 Cast 工具调用**都通过 `recordCastInvocation()` 记录到 `castReg.history`（最多 200 条）。

### 3.3 Cast 工具调 LLM

```
cast_tools_xxx.go
  └─ castLLM(ctx, systemPrompt, userPrompt)
        ├─ a.mu.Lock()
        ├─ 检查 cachedProviderConfigHash 命中
        │    ├─ 命中：复用 a.cachedProvider
        │    └─ 未命中：a.createProviderLocked("") → 缓存
        ├─ a.mu.Unlock()
        └─ provider.Complete(ctx, &CompletionRequest{...})
```

### 3.4 AP 事件 → Wails Events

AP `Bus` 是 channel 模型，每个事件类型 `Subscribe()` 拿到一个 `<-chan Event`。
[`event_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/event_bridge.go) 中：
1. `a.eventBus.Subscribe(ap.EventAgentStart)` 等关键事件
2. 启动 goroutine `for ev := range ch { wailsRuntime.EventsEmit(a.ctx, "ap:agent.start", ev) }`
3. 前端 `EventsOn("ap:agent.start", handler)`

---

## 4. 并发模型

| 锁 | 持有方 | 保护对象 | 不可重入 |
|----|--------|----------|----------|
| `a.mu` (`sync.RWMutex`) | 几乎所有 `*App` 方法 | sessions / skills / projects / llmConfig / cachedProvider / castReg / … | **是**（关键约束） |
| `a.orchestrationMu` | orchestration_bridge.go | orchestrationRuns | 是 |
| `a.workflowMu` | workflow_bridge.go | workflowRuns | 是 |
| `a.costTracker` 内部 | AP | 内部聚合 | — |
| `a.cacheManager` 内部 | AP | 内部 | — |
| `castReg.mu` | cast_tools.go | history | 是 |
| AP 各子系统 | AP | 内部 | 各自约束 |

**严禁**：在 `createProviderLocked` / `createCachedProviderLocked` / `resolveCredentialsLocked` 内部再次 `a.mu.RLock()`，否则死锁。
（详见 [04-AP-Framework-Integration](04-AP-Framework-Integration.md)）

---

## 5. 事件 / 流类型一览

| 来源 | 类型 | 含义 |
|------|------|------|
| AP Agent | `ap.StreamEventToken` | 模型输出 token |
| AP Agent | `ap.StreamEventThought` | 思考/推理 |
| AP Agent | `ap.StreamEventToolCall` | 工具调用 |
| AP Agent | `ap.StreamEventToolResult` | 工具结果 |
| AP Agent | `ap.StreamEventError` | 错误 |
| AP Agent | `ap.StreamEventComplete` | 完成 |
| AP Bus | `ap.EventAgentStart/Stop/Error` | Agent 生命周期 |
| AP Bus | `ap.EventTurnStart/End` | 回合 |
| AP Bus | `ap.EventToolCall/ToolResult` | 工具 |
| AP Bus | `ap.EventLLMCall/LLMResponse` | LLM |
| AP Bus | `ap.EventPoolDispatch/PoolComplete` | Pool |
| Wails 业务 | `stream:<sessionID>` | 推流到前端 |
| Wails 业务 | `ap:agent.start` 等 | AP 事件转发 |
| Cast 工具 | `castReg.history` 内存历史 | 工具调用面板 |

---

## 6. 物理部署

- **本地单进程**：Wails App 进程（Go）+ 内嵌 WebView（Chromium/WebView2）
- **本地数据目录**（Windows 典型 `%APPDATA%\CodeCast\`）：
  - `settings.json`（加密配置 / API Key）
  - `memory.db`（AP SQLite + FTS5 记忆）
  - `checkpoints.db`（AP CheckpointStore）
  - `sessions/*.json`（会话持久化）
  - `cast_*.json`（Cast 工具状态）
- **网络出站**：仅在调用 LLM Provider / 用户配置的 MCP 服务器时
