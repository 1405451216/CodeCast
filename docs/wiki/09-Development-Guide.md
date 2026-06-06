# 09 · 开发与扩展指南

> 面向二次开发者的实战指南。读完 [02-Architecture](02-Architecture.md) 和 [04-AP-Framework-Integration](04-AP-Framework-Integration.md) 后再读本文。

---

## 1. 新增 / 修改 Cast 工具

> 完整模板见 [05-Cast-Toolbox §5](05-Cast-Toolbox.md#5-新增一个-cast-工具步骤)。最简示例：

```go
// cast_tools_xxx.go（新增或追加到已有文件）
func registerXxxTools(a *App, toolkit *ap.ToolRegistry) error {
    tools := []*castTool{
        newCastTool(a, "cast_xxx_hello", "xxx",
            "向用户打招呼",
            json.RawMessage(`{
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "用户名"}
                },
                "required": ["name"]
            }`),
            func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
                var p struct{ Name string `json:"name"` }
                _ = json.Unmarshal(args, &p)
                return a.recordCastInvocation("cast_xxx_hello", "xxx", "", args,
                    fmt.Sprintf("hello, %s", p.Name), false, 0), nil
            },
        ),
    }
    return toolkit.RegisterMultiple(toolToApTools(tools))
}
```

并在 [`cast_tools.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools.go) 的 `RegisterCastTools` 列表里加 `registerXxxTools`。

> **必须**：
- 调 `a.recordCastInvocation()`（写历史 + 返回 ToolResult）
- 高危操作走 `HookBeforeTool` → `checkpointHook`
- LLM 调用统一走 `a.castLLM`
- 在 `_test.go` 加测试

---

## 2. 新增一个 LLM Provider

> 仅当你想接入一个 `BuiltinProviders` 之外的协议时。ProviderID 通过 `guessProviderForModel(model)` 派生。

1. 在 [`config.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/config.go) 的 `BuiltinProviders` 加预设：
   ```go
   {ID: "myprov", Name: "MyProvider", APIURL: "https://api.myprov.com", DefaultModel: "myprov-v1", Models: []string{"myprov-v1", "myprov-v2"}}
   ```
2. 在 [`provider_factory.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/provider_factory.go) 的 `createProviderLocked` `switch` 加 `case "myprov":`：
   - 若 AP 内置（OpenAI 兼容）：`ap.NewOpenAIProvider(ap.Config{...})`
   - 否则：包装一个实现 `ap.Provider` 接口的类型（`Complete(ctx, *ap.CompletionRequest) (*ap.CompletionResponse, error)`）
3. 在 [`config.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/config.go) 的 `guessProviderForModel` 加 model 名前缀匹配：
   ```go
   case strings.HasPrefix(m, "myprov-"): return "myprov"
   ```
4. 加测试（`provider_factory_test.go`）。

> **不要**改 `APICredentials` 结构（它故意没 ProviderID 字段）。

---

## 3. 修改默认 Agent

> 默认 Agent 在 `main.go` 的 `startup()` 步骤 11 构造。

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
})
// 注意字段名：Model（不是 Provider）、Toolkit（不是 ToolRegistry）
```

- 改 `MaxTurns` 控制最大回合
- 改 `SystemPrompt` 调 `buildSystemPrompt`（[`prompt_builder.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/prompt_builder.go)）
- 加 `WithMemory` / `WithRAG` / `WithHooks` / `WithCostTracker` 等链式

> 多会话子 Agent 走 `getOrCreateAgent(sessionID, model)`，缓存于 `sessionAgents[sessionID]`。

---

## 4. 修改 Pool

```go
a.pool = ap.NewPool(ap.PoolConfig{
    MaxConcurrency: 5,          // 改成 8 / 16 等
    Timeout:        5 * time.Minute,
    DefaultAgent:   ap.ReActAgentConfig{...},
})
a.pool.SetModel(provider)
a.pool.SetAgentFactory(a.createPoolAgentFactory())
```

- 调度入口：`runScheduleDispatcher`（[`cast_tools_schedule.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_schedule.go)）
- 关闭：`*ap.Pool.Close()`（在 `shutdown()` 调用）

---

## 5. 接入新 MCP 服务器

1. 在设置里填入 MCP 配置（WebSocket URL 或 stdio 命令）
2. `startup()` 步骤 7：`syncMCPServersToRegistry()` → `startMCPRegistry()`
3. 工具自动注册到 `mcpReg`（AP MCPRegistry）
4. 前端可调用 `mcp_bridge.go` 的 Wails 绑定增删服务器

> 详细 API：见 [`mcp_bridge.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/mcp_bridge.go) 公开方法。

---

## 6. 修改 System Prompt

> [`prompt_builder.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/prompt_builder.go) 提供 `buildSystemPrompt(session *Session) string`：
- 注入项目上下文（路径、git status）
- 注入技能列表
- 注入工具清单（从 `toolkit.Definitions()` 推导）
- 注入人格 / 风格

改完跑 `prompts_test.go` 验证输出。

---

## 7. 新增 Wails 绑定（前端可调方法）

后端只要在 `*App` 上加一个 `func (a *App) Xxx(...) ...`（首字母大写）就会自动被 Wails 暴露。

**规范**：

```go
// 简单同步方法
func (a *App) GetCurrentProject() (Project, error) {
    a.mu.RLock()
    defer a.mu.RUnlock()
    // ...
}

// 流式：用 wailsRuntime.EventsEmit 发事件
func (a *App) LongRunningTask(reqID string) error {
    go func() {
        wailsRuntime.EventsEmit(a.ctx, "task:"+reqID, map[string]any{"type":"progress", "value": 50})
        wailsRuntime.EventsEmit(a.ctx, "task:"+reqID, map[string]any{"type":"done"})
    }()
    return nil
}
```

前端订阅：

```ts
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
EventsOn(`task:${reqID}`, (data) => { ... });
EventsOff(`task:${reqID}`);
```

> ⚠️ `wails generate module` 在 `wails dev` / `wails build` 时自动重生成 `frontend/wailsjs/`。

---

## 8. 新增 Hook

```go
// 在 startup() 步骤 6 之后追加
a.hooks.Register(ap.HookAfterTool, func(ctx context.Context, hctx *ap.HookContext) error {
    slog.Info("tool done", "name", hctx.ToolName, "duration_ms", hctx.DurationMs)
    return nil
})
```

> Hook 函数签名：`func(ctx context.Context, hctx *ap.HookContext) error`
> 不要在 Hook 内部**再次**调用 `a.mu.Lock()`（与 Provider 同样的死锁约束）。

---

## 9. 调试清单

| 现象 | 排查 |
|------|------|
| Provider 创建失败 | 看 `createProviderLocked` 错误日志；检查 settings.json 中 APIKey / APIURL |
| Agent 不调工具 | 1) `toolkit.Count()` 日志 2) `GetToolCatalog()` 3) System Prompt 是否包含工具说明 |
| 流式中断 | `wailsRuntime.EventsEmit` 失败 → 检查 `a.ctx` 是否被 cancel |
| Checkpoint 不触发 | 注册顺序：`hooks.Register(HookBeforeTool, a.checkpointHook)` |
| 记忆召回为空 | `memory.db` 路径、检查 `ap.NewSQLiteStore` 是否成功；`RAGModeAuto` + `TopK` 调整 |
| 工具调用 OOM | `MaxWriteFileSize` 10MB / `MaxReadFileSize` 4MB |
| 锁死 | 99% 是 `a.mu` 重入。开启 `pprof`：`go tool pprof http://localhost:6060/debug/pprof/mutex` |
| Wails 绑定缺失 | `wails generate module`；重启 dev |

---

## 10. 提交前自检

```bash
# 后端
cd CodeCast-desktop
go vet ./...
go test -race ./...

# 前端
cd frontend
npm run typecheck
npm run lint
npm run test
```

> 提交规范：使用 conventional commits（`feat: ...` / `fix: ...` / `refactor: ...`）。CI 会跑全量。

---

## 11. 安全 checklist

- API Key 一定走 `crypto.go` 的 AES-GCM（不要在日志里打印 `a.llmConfig.APIKey`）
- 任何文件路径 → `ap.Sandbox.ValidatePath()`
- 任何 Shell → `setGlobalValidateCommand()` 注入的危险命令校验
- 任何出站请求 → 走 `ap.ACL`
- 任何写入超过 10MB → 直接拒绝（`MaxWriteFileSize`）

---

## 12. 进一步阅读

- 前端架构：[`frontend/ARCHITECTURE.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/ARCHITECTURE.md)
- 前端可视化架构：[`frontend/ARCHITECTURE_VISUAL.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/ARCHITECTURE_VISUAL.md)
- 用户手册：[`frontend/docs/USER_GUIDE.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/docs/USER_GUIDE.md)
- FAQ：[`frontend/docs/FAQ.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/docs/FAQ.md)
- 性能：[`frontend/docs/PERFORMANCE.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/docs/PERFORMANCE.md)
- 升级报告：[`frontend/docs/UPGRADE_REPORT.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/docs/UPGRADE_REPORT.md)
- 错误监控：[`frontend/docs/ERROR_MONITORING.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/docs/ERROR_MONITORING.md)
- 隐私强化计划：[`frontend/docs/privacy-hardening-plan.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/docs/privacy-hardening-plan.md)
- E2E 指南：[`frontend/e2e/README.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/e2e/README.md)
- 项目根 README：[`README.md`](file:///e:/codecast/CodeCast/README.md)
