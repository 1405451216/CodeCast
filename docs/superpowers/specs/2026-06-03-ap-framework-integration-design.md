# CodeCast 接入 AgentPrimordia (AP) 框架设计

> 日期: 2026-06-03
> 状态: 已批准
> 作者: CodeCast Team

## 1. 概述

将 CodeCast 的 Agent 核心引擎完全替换为 AgentPrimordia (AP) 框架。AP 是从 CodeCast 生产验证的 Agent 架构中提炼出的通用 Go Agent 开发框架，本次接入是框架回归应用的完整闭环。

### 1.1 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 替换策略 | 完全替换（Big Bang） | AP 为 CodeCast 设计，类型映射天然对齐 |
| 接入范围 | 全量接入 | 一次性获得 AP 全部能力 |
| 前端适配 | 完美适配（前端全面重写对接 AP 数据模型） | 前后端类型体系一致，零适配成本 |
| LLM Provider | 9 个 AP Provider 全暴露 + DeepSeek 通过 OpenAIProvider BaseURL 映射 | 最大模型选择范围 |
| CodeCast 特有功能 | 保留但重新设计接口，利用 AP 能力实现 | Checkpoint 用 Hook、Session 用 Memory |

### 1.2 核心优化

1. **AP TypeScript SDK 驱动前端** — 前端引入 `@agentprimordia/sdk`，使用 SDK 类型定义作为数据模型基础
2. **AP EventBus 替代 Wails Events** — 更通用、可测试、可远程访问
3. **session.go 巨石拆分** — 按 AP 组件职责拆分为独立模块

## 2. 替换映射

### 2.1 后端文件替换

| 层级 | CodeCast 现有文件 | AP 替换组件 | 处理方式 |
|------|---|---|---|
| LLM Provider | `llm/manager.go`, `llm/provider.go`, `llm/providers.go` | `ap.NewOpenAIProvider` 等 9 个 + `ResilientProvider` | 删除 `llm/` 子包 |
| Agent Engine | `agent_engine.go`（ReAct Loop + callLLM） | `ap.NewReActAgent` + `ap.ReActConfig` | 删除 |
| Agent Pool | `agent.go`（SubAgent + AgentPool） | `ap.NewPool` + `ap.TaskConfig` | 删除 |
| Tool System | `agent_tools.go`（6 个工具） | `ap.DefaultToolkit`（FS + Shell + Web + Knowledge） | 删除 |
| Tool Persistence | `agent_persist.go` | `ap.SQLiteCheckpointStore` | 删除 |
| Memory | `memory.go`（SQLite FTS5） | `ap.NewSQLiteStore` + `ap.NewRAGStore` | 删除 |
| MCP | `mcp.go` | `ap.NewMCPClient` + `ap.NewMCPRegistry` | 删除 |
| Sandbox | `sandbox.go` | `ap.ScopePolicy` + `ap.FileScopePolicy` + `ap.Sandbox` + `ap.ACL` | 重写 |
| Prompts | `prompts.go` | `ap.NewPromptTemplate` | 重写 |
| Context | `context.go` | AP ContextWindowStrategy + RAG | 重写 |
| Session | `session.go`（1474 行巨石） | 拆分为多个模块，核心由 AP Agent 驱动 | 大幅重构 |
| Main App | `main.go` | `App` 结构体直接持有 AP 实例 | 修改 |

### 2.2 session.go 拆分方案

| 新文件 | 职责 | AP 组件 |
|------|---|---|
| `chat.go` | 主对话入口 `SendMessage`，委托给 AP Agent | `ap.Agent` |
| `provider_factory.go` | LLM Provider 创建工厂（9+1 Provider） | `ap.NewOpenAIProvider` 等 |
| `prompt_builder.go` | 系统提示词构建 | `ap.NewPromptTemplate` |
| `checkpoint_hook.go` | Checkpoint 用 Hook 实现 | `ap.HookBeforeTool` |
| `agent_bridge.go` | Wails binding 桥接方法 | 组合层 |
| `session.go` | 会话簿记（元数据 CRUD） | 应用层 |

## 3. 后端架构

### 3.1 新的 App 结构体

```go
type App struct {
    ctx context.Context

    // ===== AP 框架核心 =====
    agent     ap.Agent                  // 主对话 ReActAgent
    pool      *ap.Pool                  // 多 Agent 并发调度
    memory    *ap.SQLiteStore           // 记忆存储
    ragStore  *ap.RAGStore              // RAG 混合检索
    toolkit   *ap.ToolRegistry          // 工具注册中心
    mcpReg    *ap.MCPRegistry           // MCP Server 注册中心
    eventBus  *ap.Bus                   // 事件总线
    metrics   *ap.AgentMetricsCollector // 指标收集
    guardrail *ap.GuardrailEngine       // 安全护栏
    hooks     *ap.HookManager           // 生命周期钩子
    lifecycle *ap.Lifecycle             // Agent 生命周期
    checkpoint *ap.SQLiteCheckpointStore // 检查点持久化

    // ===== CodeCast 应用层 =====
    config                   *Config
    settings                 *Settings
    sessions                 []*Session            // 会话簿记（元数据）
    projects                 []Project
    skills                   []*Skill              // 技能系统（应用层）
    tasks                    []*Task               // 定时任务（应用层）
    completor                *CodeCompletor        // 代码补全（应用层）
    checkpointConfirmations  map[string]chan bool   // Checkpoint 确认通道

    mu sync.RWMutex
}
```

### 3.2 启动初始化流程

```go
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx

    // 1. 初始化 AP 记忆存储
    a.memory = ap.NewSQLiteStore(memoryPath)
    a.ragStore = ap.NewRAGStore(a.memory, ap.NewEmbeddingAdapter(provider, 1536))

    // 2. 初始化 AP 事件总线
    a.eventBus = ap.NewBus()

    // 3. 初始化 AP 指标收集
    a.metrics = ap.NewMetrics()

    // 4. 初始化 AP 安全系统
    a.guardrail = ap.NewGuardrailEngine()
    acl := ap.NewACL()
    sandbox := ap.NewSandbox()
    scopePolicy := ap.NewFileScopePolicy()

    // 5. 初始化 AP 工具系统
    a.toolkit, _ = ap.DefaultToolkit(ap.ToolkitConfig{
        RootDir:     projectPath,
        EnableFS:    true,
        EnableShell: true,
        EnableWeb:   true,
    })

    // 6. 注册 Checkpoint Hook
    a.hooks = ap.NewHookManager()
    a.hooks.Register(ap.HookBeforeTool, a.checkpointHook, 100)

    // 7. 初始化 AP MCP 注册中心
    a.mcpReg = ap.NewMCPRegistry()

    // 8. 初始化 AP 检查点存储
    a.checkpoint = ap.NewSQLiteCheckpointStore(checkpointPath)

    // 9. 创建主对话 Agent
    provider := a.createProvider() // provider_factory.go
    a.agent = ap.NewReActAgent(ap.ReActConfig{
        Name:         "CodeCast",
        SystemPrompt: a.buildSystemPrompt(session), // prompt_builder.go
        Model:        provider,
        Toolkit:      a.toolkit,
        Memory:       ap.NewMemoryAdapter(a.memory),
        MaxTurns:     20,
        Hooks:        a.hooks,
        EventPublisher: ap.NewEventBusAdapter(a.eventBus),
        Metrics:      ap.NewMetricsAdapter(a.metrics),
        RAG: ap.RAGConfig{
            Provider: ap.NewRAGProviderAdapter(a.ragStore),
            Mode:     ap.RAGModeAuto,
            TopK:     5,
        },
    })

    // 10. 初始化 AP Agent Pool
    a.pool = ap.NewPool(ap.PoolConfig{
        MaxConcurrency: 5,
        DefaultAgent: ap.ReActAgentConfig{
            SystemPrompt: "你是一个代码助手子代理",
            MaxTurns:     10,
        },
    })
    a.pool.SetModel(provider)
}
```

### 3.3 Checkpoint 机制用 Hook 实现

```go
// checkpoint_hook.go
func (a *App) checkpointHook(ctx *ap.HookContext) error {
    toolName := ctx.ToolName

    // 高危工具判断
    highRiskTools := map[string]bool{
        "write_file": true, "edit_file": true, "run_command": true,
    }
    if !highRiskTools[toolName] {
        return nil // 低危工具直接放行
    }

    // 通过 EventBus 通知前端，前端展示 Diff 预览和确认对话框
    // 前端确认后通过 Wails binding 调用 App.ResolveCheckpoint(checkpointID, approved)
    a.eventBus.PublishAsync(string(ap.EventToolCall), "checkpoint", map[string]any{
        "checkpoint_id": ctx.AgentID + "_" + ctx.ToolName,
        "tool_name":     toolName,
        "tool_args":     ctx.ToolArgs,
        "risk_level":    a.assessRiskLevel(toolName, ctx.ToolArgs),
    })

    // 阻塞等待用户确认（channel 机制）
    confirmed := a.waitForCheckpointConfirmation(ctx.AgentID, toolName)
    if !confirmed {
        return fmt.Errorf("用户拒绝了工具调用: %s", toolName)
    }
    return nil
}

// waitForCheckpointConfirmation 阻塞当前 goroutine，等待前端用户确认
// 前端确认后调用 App.ResolveCheckpoint(checkpointID, approved) 写入 confirmChan
func (a *App) waitForCheckpointConfirmation(agentID, toolName string) bool {
    checkpointID := agentID + "_" + toolName
    ch := make(chan bool, 1)
    a.mu.Lock()
    a.checkpointConfirmations[checkpointID] = ch
    a.mu.Unlock()
    defer func() {
        a.mu.Lock()
        delete(a.checkpointConfirmations, checkpointID)
        a.mu.Unlock()
    }()

    select {
    case confirmed := <-ch:
        return confirmed
    case <-time.After(5 * time.Minute):
        return false // 超时自动拒绝
    }
}

// ResolveCheckpoint 前端确认/拒绝后调用的 Wails binding 方法
func (a *App) ResolveCheckpoint(checkpointID string, approved bool) {
    a.mu.Lock()
    ch, ok := a.checkpointConfirmations[checkpointID]
    a.mu.Unlock()
    if ok {
        ch <- approved
    }
}
```

### 3.4 主对话入口

```go
// chat.go
func (a *App) SendMessage(sessionID, userInput string, longContext bool) (string, error) {
    session := a.getSession(sessionID)

    // 构建提示词
    systemPrompt := a.buildSystemPrompt(session) // prompt_builder.go

    // 创建带流式回调的 Agent 运行选项
    opts := ap.WithStreaming(func(chunk string) {
        // 通过 EventBus 发送流式事件到前端
        a.eventBus.PublishAsync(ap.EventAgentStart, "CodeCast", map[string]any{
            "session_id": sessionID,
            "chunk":      chunk,
        })
    })

    // 运行 Agent
    resp, err := a.agent.Run(a.ctx, ap.UserMessage(userInput), opts)
    if err != nil {
        return "", err
    }

    // 保存记忆
    a.memory.Add(a.ctx, &ap.MemoryEpisode{
        SessionID: sessionID,
        Role:      "user",
        Content:   userInput,
    })
    a.memory.Add(a.ctx, &ap.MemoryEpisode{
        SessionID: sessionID,
        Role:      "assistant",
        Content:   resp.Content,
    })

    return resp.Content, nil
}
```

### 3.5 LLM Provider 工厂

```go
// provider_factory.go
func (a *App) createProvider() ap.Provider {
    cfg := a.llmConfig

    var primary ap.Provider
    switch cfg.ActiveProvider {
    case "openai":
        primary = ap.NewOpenAIProvider(ap.Config{APIKey: cfg.OpenAI.APIKey, Model: cfg.OpenAI.Model})
    case "anthropic":
        primary = ap.NewAnthropicProvider(ap.Config{APIKey: cfg.Anthropic.APIKey, Model: cfg.Anthropic.Model})
    case "gemini":
        primary = ap.NewGeminiProvider(ap.Config{APIKey: cfg.Gemini.APIKey, Model: cfg.Gemini.Model})
    case "ollama":
        primary = ap.NewOllamaProvider(ap.Config{BaseURL: cfg.Ollama.BaseURL, Model: cfg.Ollama.Model})
    case "azure":
        primary = ap.NewAzureOpenAIProvider(ap.Config{APIKey: cfg.Azure.APIKey, Model: cfg.Azure.Model})
    case "qwen":
        primary = ap.NewOpenAIProvider(ap.Config{
            APIKey:  cfg.Qwen.APIKey,
            BaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            Model:   cfg.Qwen.Model,
        })
    case "glm":
        primary = ap.NewOpenAIProvider(ap.Config{
            APIKey:  cfg.GLM.APIKey,
            BaseURL: "https://open.bigmodel.cn/api/paas/v4",
            Model:   cfg.GLM.Model,
        })
    case "mistral":
        primary = ap.NewMistralProvider(ap.Config{APIKey: cfg.Mistral.APIKey, Model: cfg.Mistral.Model})
    case "cohere":
        primary = ap.NewCohereProvider(ap.Config{APIKey: cfg.Cohere.APIKey, Model: cfg.Cohere.Model})
    case "deepseek":
        primary = ap.NewOpenAIProvider(ap.Config{
            APIKey:  cfg.DeepSeek.APIKey,
            BaseURL: "https://api.deepseek.com",
            Model:   cfg.DeepSeek.Model,
        })
    default:
        primary = ap.NewOpenAIProvider(ap.Config{APIKey: "dummy", Model: "gpt-4o"})
    }

    // ResilientProvider 包装（重试 + 降级 + 熔断）
    resilient := ap.NewResilientProvider(primary, ap.DefaultResilientConfig())
    return resilient
}
```

### 3.6 EventBus 替代 Wails Events

后端使用 AP EventBus 发布事件，同时通过 SSE 端点暴露给前端：

```go
// event_bridge.go
func (a *App) startEventBridge() {
    // 订阅 AP EventBus，转发到 Wails Events（过渡期兼容）
    a.eventBus.Subscribe(ap.EventAgentStart, func(evt ap.Event) {
        wailsRuntime.EventsEmit(a.ctx, "agent:start", evt.Payload)
    })
    a.eventBus.Subscribe(ap.EventTurnStart, func(evt ap.Event) {
        wailsRuntime.EventsEmit(a.ctx, "agent:turn", evt.Payload)
    })
    a.eventBus.Subscribe(ap.EventToolCall, func(evt ap.Event) {
        wailsRuntime.EventsEmit(a.ctx, "agent:tool", evt.Payload)
    })
    a.eventBus.Subscribe(ap.EventToolResult, func(evt ap.Event) {
        wailsRuntime.EventsEmit(a.ctx, "agent:tool_result", evt.Payload)
    })
    a.eventBus.Subscribe(ap.EventAgentStop, func(evt ap.Event) {
        wailsRuntime.EventsEmit(a.ctx, "agent:stop", evt.Payload)
    })
    a.eventBus.Subscribe(ap.EventAgentError, func(evt ap.Event) {
        wailsRuntime.EventsEmit(a.ctx, "agent:error", evt.Payload)
    })
}
```

## 4. 前端架构

### 4.1 引入 AP TypeScript SDK

```json
// package.json 新增依赖
{
  "dependencies": {
    "@agentprimordia/sdk": "^0.1.0"
  }
}
```

### 4.2 前端类型映射

| CodeCast 现有类型 | AP SDK 类型 | 变更说明 |
|---|---|---|
| `SubAgent` | SDK `AgentStatus` + 自定义扩展 | 使用 SDK AgentStatus 枚举 |
| `AgentEvent` | SDK `Event` | 使用 SDK Event 类型 |
| `Message` (store/types.ts) | SDK `Message` | 角色和内容字段对齐 |
| `ToolCall` (store/types.ts) | SDK `ToolCall` | id/name/arguments 对齐 |
| `ToolResult` | SDK `ToolResult` | toolCallId/content/isError 对齐 |
| `LLMMessage` / `LLMResponse` | SDK `CompletionRequest` / `CompletionResponse` | 对齐 |
| `TokenUsage` | SDK `Usage` | promptTokens/completionTokens/totalTokens |
| `ModelProvider` | SDK `ProviderConfig` | apiKey/baseURL/model/temperature |
| `MemoryItem` | SDK `MemoryEpisode` | id/sessionId/role/content/summary/topics |
| `AgentTask` / `SubTask` | SDK `PoolTask` + 自定义扩展 | 使用 SDK Pool 类型 |
| `AgentMetrics` | SDK `AgentMetrics` | totalTurns/totalTools/duration |

### 4.3 Store 重构

```typescript
// store/useAgentStore.ts — 基于 AP SDK 类型
import type { AgentStatus, Response, Event } from '@agentprimordia/sdk';
import { ErrorCodes } from '@agentprimordia/sdk';

interface AgentSlice {
  agents: Map<string, {
    id: string;
    sessionId: string;
    status: AgentStatus;
    title: string;
    turn: number;
    maxTurns: number;
    lastToolName: string;
    result: string;
    error: string;
  }>;

  handleAgentEvent(event: Event): void;
  // ... 其他方法
}
```

```typescript
// store/useMemoryStore.ts — 基于 AP SDK 类型，连接后端
import type { MemoryEpisode, MemoryStats } from '@agentprimordia/sdk';

interface MemoryState {
  memories: MemoryEpisode[];
  statistics: MemoryStats;
  isLoading: boolean;

  fetchMemories(): Promise<void>;       // 调用 Wails binding
  deleteMemory(id: string): Promise<void>;
  clearExpired(days: number): Promise<void>;
}
```

### 4.4 前端架构图

```
CodeCast Frontend
├── @agentprimordia/sdk              ← AP TypeScript SDK
│   ├── types: Message, ToolCall, Response, AgentStatus, MemoryEpisode...
│   ├── Bus: 事件订阅
│   └── MetricsCollector: 指标收集
├── stores/
│   ├── useAgentStore.ts             ← 基于 SDK AgentStatus/Response/Event
│   ├── useMessagesStore.ts          ← 基于 SDK Message/ToolCall/ToolResult
│   ├── useModelStore.ts             ← 基于 SDK ProviderConfig/ModelInfo/Usage
│   ├── useMemoryStore.ts            ← 基于 SDK MemoryEpisode/MemoryStats
│   ├── useSessionStore.ts           ← 会话簿记（应用层）
│   └── useCastAgentStore.ts         ← Cast Agent 状态（应用层）
├── api.ts                           ← Wails bridge（精简）
├── components/
│   ├── AgentCard.tsx                ← 使用 SDK AgentStatus 渲染
│   ├── MessagesView.tsx             ← 使用 SDK Message 渲染
│   ├── MemoryVisualizer.tsx         ← 使用 SDK MemoryEpisode 渲染
│   └── ...
└── types/
    ├── builtin-providers.ts         ← CodeCast 特有 Provider 配置（UI 层）
    ├── cast-agent.ts                ← Cast Agent 扩展类型（应用层）
    └── cast-types.ts                ← Cast 工作台类型（应用层）
```

## 5. 删除文件清单

以下文件将在接入完成后删除：

### 后端（Go）
- `agent.go` — 替换为 AP Pool + Agent
- `agent_engine.go` — 替换为 AP ReActAgent
- `agent_tools.go` — 替换为 AP Toolkit
- `agent_persist.go` — 替换为 AP CheckpointStore
- `memory.go` — 替换为 AP SQLiteStore + RAGStore
- `llm/manager.go` — 替换为 AP Provider 工厂
- `llm/provider.go` — 替换为 AP Provider 接口
- `llm/providers.go` — 替换为 AP Provider 实现
- `mcp.go` — 替换为 AP MCPRegistry
- `sandbox.go` — 替换为 AP Sandbox + ACL + Guardrails
- `prompts.go` — 替换为 AP PromptTemplate
- `context.go` — 替换为 AP ContextWindowStrategy + RAG

### 前端（TypeScript）
- `types/agent.ts` — 替换为 SDK 类型
- `types/models.ts` — 替换为 SDK 类型（保留 UI 扩展部分）

## 6. 新增文件清单

### 后端（Go）
- `chat.go` — 主对话入口
- `provider_factory.go` — LLM Provider 创建工厂
- `prompt_builder.go` — 系统提示词构建
- `checkpoint_hook.go` — Checkpoint Hook 实现
- `agent_bridge.go` — Wails binding 桥接方法
- `event_bridge.go` — EventBus → Wails Events 桥接

### 前端（TypeScript）
- 无新增文件，现有文件重写

## 7. 重构文件清单

### 后端（Go）
- `main.go` — App 结构体修改（持有 AP 实例）
- `session.go` — 精简为会话簿记
- `agent_test.go` — 适配 AP 类型
- `security_test.go` — 适配 AP 安全类型

### 前端（TypeScript）
- `api.ts` — Wails bridge 方法签名适配 AP 类型
- `store/useAgentStore.ts` — 基于 SDK 类型重写
- `store/useMessagesStore.ts` — 基于 SDK 类型重写
- `store/useModelStore.ts` — 基于 SDK 类型重写
- `store/useMemoryStore.ts` — 基于 SDK 类型重写，连接后端
- `store/useSessionStore.ts` — 精简为簿记
- `store/types.ts` — 替换为 SDK 类型
- 所有使用 Agent/Message/Memory 类型的 Component — 适配 SDK 类型

## 8. go.mod 变更

```go
module github.com/example/codecast

go 1.25.0

require (
    agentprimordia v0.2.0           // 新增：AP 框架
    git.sr.ht/~jackmordaunt/go-toast/v2 v2.0.3
    github.com/google/uuid v1.6.0
    github.com/wailsapp/wails/v2 v2.12.0
    golang.org/x/sync v0.20.0
    gopkg.in/yaml.v3 v3.0.1
    modernc.org/sqlite v1.50.1      // 升级：与 AP 保持一致
)
```

## 9. 成功标准

1. CodeCast 编译通过（`go build ./...` 和 `npm run build`）
2. 主对话功能正常：用户发送消息 → AP Agent ReAct 循环 → 流式返回
3. 工具调用正常：Agent 调用 read_file/write_file/run_command 等
4. Checkpoint 正常：高危操作暂停等待用户确认
5. 多 Agent 调度正常：`dispatch_agents` → AP Pool → 并发执行
6. 记忆系统正常：对话记忆存储、FTS5 搜索、RAG 检索
7. MCP 集成正常：添加/删除/测试 MCP Server
8. 9+1 个 LLM Provider 全部可用
9. 安全护栏正常：PII 检测、路径遍历防护、命令拦截
10. 前端 UI 全部正常渲染，无类型错误
11. Go 测试和前端测试通过
12. 现有 session 数据可迁移

## 10. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| AP module 引入导致依赖冲突 | 中 | 高 | AP 仅依赖 modernc.org/sqlite，与 CodeCast 一致 |
| session.go 拆分引入 bug | 高 | 高 | 逐步拆分，每步编译测试 |
| 前端类型全面重写导致 UI 回归 | 高 | 中 | 使用 SDK 类型确保一致性，逐个 Store 迁移 |
| 流式输出体验下降 | 低 | 高 | AP StreamingFunc 回调与前端 SSE 对齐测试 |
| 检查点持久化数据不兼容 | 低 | 中 | 提供迁移脚本 |
| DeepSeek 通过 OpenAI Provider 映射不完全兼容 | 低 | 低 | DeepSeek API 高度兼容 OpenAI，实测验证 |

## 11. 隐藏依赖与补充设计

以下问题在初审中未覆盖，经全面审计后发现：

### 11.1 凭证解析瓶颈 `resolveCredentialsLocked()`

当前所有 LLM 调用（主对话、子 Agent、Memory 摘要、Context 压缩）都通过 `resolveCredentialsLocked(modelName)` 获取 API Key 和 BaseURL。AP 接入后：

- AP 的 `Provider` 创建需要 API Key，但 CodeCast 的凭证存储在加密的 `Settings` 中
- **设计方案**：保留 `resolveCredentialsLocked()` 作为凭证源，`provider_factory.go` 中的 `createProvider()` 通过它获取凭证后创建 AP Provider
- Memory 摘要和 Context 压缩不再直接调用 LLM API，改为使用 AP 的 `Summarizer` 和 `ContextWindowStrategy`

### 11.2 请求取消机制 `activeCancels`

当前 `session.go` 中有 `activeCancels map[string]cancelEntry` 用于按会话取消 HTTP 请求。AP 接入后：

- AP 的 `Agent` 支持 `context.Cancel`，可通过 `Agent` 的 `ctx` 传播取消信号
- **设计方案**：`CancelRequest()` 和 `CancelSessionRequest()` 改为调用 `context.CancelFunc`，不再需要独立的 `activeCancels` map
- 通过 AP Hook（`HookOnError`）监听取消事件

### 11.3 Notes 系统与对话耦合

当前 `notes.go` 的 `ToContextPrompt()` 在 `SendMessageEx` 中注入，`recordNotesAsync()` 在每次回复后触发。AP 接入后：

- **设计方案**：将 Notes 注入移至 `prompt_builder.go`，作为 `buildSystemPrompt()` 的一部分
- `recordNotesAsync()` 改为通过 AP Hook（`HookAfterRun`）触发，而非硬编码在 `SendMessage` 中

### 11.4 工具定义双轨制

当前主对话只注册 `dispatch_agents` 一个工具，子 Agent 注册 6 个工具（read_file/write_file/edit_file/run_command/search/web_fetch），两套 schema 完全独立。AP 接入后：

- **设计方案**：统一使用 AP 的 `ToolRegistry`
- 主对话 Agent 注册 `dispatch_agents` + 基础工具（read_file/search）→ 允许主对话也能直接调用工具
- 子 Agent 通过 AP Pool 的 `AgentFactory` 创建，继承主 Registry 的工具子集 + 添加 `files_scope` 限制

### 11.5 代码补全 `completor` 自有 LLM 路径

当前 `completor.go` 有独立的 LLM 调用路径（`getOpenAICompletions`/`streamOpenAICompletions`），与主对话和子 Agent 的 Provider 完全独立。AP 接入后：

- **设计方案**：`completor` 保留为 CodeCast 应用层组件，但改为使用 AP Provider（通过 `app.createProvider()` 获取）
- 代码补全的 L3 本地缓存和 L1 符号索引不变，L2 AI 补全改为使用 AP 的 `CachedProvider`

### 11.6 Memory/Context 模块直接调用 LLM

当前 `memory.go` 的 `ExtractSummaryAsync()` 和 `context.go` 的 `generateCompactionSummary()` 各自直接调用 `callAPIEx()`，绕过了任何 Provider 抽象。AP 接入后：

- **设计方案**：使用 AP 的 `ap.NewSummarizer(provider)` 替代 `ExtractSummaryAsync()`
- 使用 AP 的 `ap.DefaultStrategy`（ContextWindowStrategy）替代 `generateCompactionSummary()`
- 这两个模块不再需要直接调用 LLM API

### 11.7 双持久化系统

当前 Session 持久化使用 JSON 文件（`persistence.go`），Memory 持久化使用 SQLite（`memory.go`），两套完全独立。AP 接入后：

- **设计方案**：Memory 统一使用 AP 的 `ap.NewSQLiteStore`，Session 保留 JSON 文件持久化（因为是簿记元数据，不属于 Agent 框架范畴）
- AP 的 `ap.SQLiteCheckpointStore` 用于 Agent 状态持久化（替代 `agent_persist.go`）
- 最终三套持久化：Session（JSON）、Memory（AP SQLite）、Checkpoint（AP SQLite）

## 12. Wails Binding 方法完整性清单

共约 95 个 Wails binding 方法，按 AP 影响分级：

### CRITICAL（必须修改）
| 方法 | 当前返回类型 | AP 适配 |
|------|------------|---------|
| `SendMessage` | `[]Message` | 改为调用 AP Agent，返回 `ap.Response` |
| `SendMessageEx` | `[]Message` | 改为调用 AP Agent，返回 `ap.Response` |
| `DispatchAgents` | `[]string` | 改为调用 AP Pool |
| `GetAgents` | `[]*SubAgent` | 改为从 AP Pool 获取 |
| `GetAgentDetail` | `*SubAgent` | 改为从 AP Pool 获取 |
| `CancelAgent` | `error` | 改为 AP context cancel |
| `CancelSessionAgents` | `error` | 改为 AP Pool cancel |
| `CancelRequest` | `void` | 改为 AP context cancel |

### HIGH（需要适配）
| 方法 | 影响原因 |
|------|---------|
| `GetSessions` | Session 类型变化（Messages 字段移除） |
| `CreateSession` | 需初始化 AP Agent 上下文 |
| `ResetMemory` | 改为调用 AP Memory |
| `GetMemoryStats` | 改为调用 AP Memory Stats |
| `ClearMemory` | 改为调用 AP Memory |
| `GetProviders` | 改为返回 AP Provider 列表 |
| `GetProviderModels` | 改为返回 AP Model 列表 |
| `GetModelConfigs` | 改为 AP Provider 配置 |
| `AddModelConfig` | 改为创建 AP Provider |
| `UpdateModelConfig` | 改为更新 AP Provider |
| `RemoveModelConfig` | 改为移除 AP Provider |
| `ToggleModelConfig` | 改为启用/禁用 AP Provider |
| `AddMCPServer` | 改为调用 AP MCPRegistry |
| `AddMCPServerStdio` | 改为调用 AP MCPRegistry |
| `RemoveMCPServer` | 改为调用 AP MCPRegistry |
| `ToggleMCPServer` | 改为调用 AP MCPRegistry |
| `TestMCPServerConnection` | 改为调用 AP MCPClient |
| `ValidatePath` | 改为调用 AP Sandbox/ACL |
| `ValidateCommand` | 改为调用 AP Guardrail |
| `ExecuteCommand` | 改为调用 AP Shell Tool |
| `GetCodeCompletions` | 改为使用 AP Provider |
| `StreamCodeCompletions` | 改为使用 AP Provider |

### LOW / NONE（无需修改）
所有其他方法（Skill CRUD、Task CRUD、Window 控制、Updater、Git、Notification 等）不直接依赖 Agent/Memory/LLM 类型，无需修改。
