# 05 · Cast 工作台

> Cast 工作台是 CodeCast v1.0 推出的非纯代码生产力套件：6 大面板 + 30+ 工具。
> 后端通过 19 个 `cast_tools_*.go` 文件 + 1 个 `cast_tools.go` 注册中心实现。
> 所有 Cast 工具在 `startup()` 阶段注册到 AP `ToolRegistry`，AI 可在对话中调用。

---

## 1. 整体架构

```
┌────────────────────────────────────────────────────────────────┐
│ Frontend Cast UI (React)                                        │
│  ├─ 写作助手  ├─ 翻译工作台  ├─ 日程管理  ├─ 知识库  ├─ 邮件     │
│  └─ 工具箱（12+ 工具：番茄钟/OCR/图表/格式转换/...）              │
└───────────────────▲────────────────────────────────────────────┘
                    │ 1) 手动调用：window.go.<App>.InvokeCastTool(name, argsJSON)
                    │ 2) AI 主动调用：Agent → toolkit.Execute(name, args)
                    │ 3) 后台触发：cast_tools_schedule.go（cron 任务）
                    │
┌───────────────────▼────────────────────────────────────────────┐
│ cast_tools.go  ──  注册中心 + castLLM + 工具调用历史             │
│  ├─ type castTool { name, category, description, parameters,   │
│  │                  app, execute(ctx, args) }                  │
│  ├─ type castToolRegistry { mu, history[200] }                 │
│  └─ func (a *App) RegisterCastTools(toolkit)                   │
│     ├─ registerWritingTools                                     │
│     ├─ registerTranslationTools                                 │
│     ├─ registerKBTools                                          │
│     ├─ registerEmailTools                                       │
│     ├─ registerScheduleTools                                    │
│     ├─ registerTodoTools                                        │
│     ├─ registerMiscTools                                        │
│     ├─ registerProjectTools                                     │
│     ├─ registerPluginTools                                      │
│     ├─ registerSandboxTools                                     │
│     ├─ registerMemoryTools                                      │
│     ├─ registerPerfTools                                        │
│     ├─ registerLearningTools                                    │
│     ├─ registerSecurityTools                                    │
│     ├─ registerChannelTools                                     │
│     ├─ registerCollabTools                                      │
│     ├─ registerSoulTools                                        │
│     ├─ registerMarketplaceTools                                 │
│     └─ registerWorkflowTools                                    │
└───────────────────▲────────────────────────────────────────────┘
                    │
                    ▼
            AP ToolRegistry (a.toolkit)
```

---

## 2. 注册中心：`cast_tools.go`

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools.go)

### 2.1 抽象基类 `castTool`

```go
type castTool struct {
    app         *App
    name        string
    category    string
    description string
    parameters  json.RawMessage
    execute     func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error)
}
```

- `Name()` / `Description()` / `Parameters()` 直接返回声明值
- `Execute(ctx, args)` 调用闭包 `t.execute(ctx, t.app, args)`
- **测试兜底**：若 `t.app == nil`（初始化失败），返回可诊断 JSON 错误而非 panic

### 2.2 构造器 `newCastTool`

- 缺省 `parameters` → `{"type":"object","properties":{}}`
- 闭包签名统一为 `func(ctx, *App, args) (*ap.ToolResult, error)`

### 2.3 工具调用历史

```go
type CastToolInvocation struct {
    ID, ToolName, Category, Args, Result string
    IsError bool
    SessionID string
    DurationMs int64
}
```

- 环形保留最近 **200** 条
- `GetToolHistory(sessionID, limit)` 倒序返回

### 2.4 `castLLM(ctx, systemPrompt, userPrompt)`

> 所有需要 LLM 的 Cast 工具的**统一入口**。

- **缓存**：用 `a.cachedProvider` + `a.cachedProviderConfigHash`（APIURL | Model | APIKey 三者哈希）做命中检测
- **不命中**：`a.createProviderLocked("")` 重建并写回缓存
- **调用**：`provider.Complete(ctx, &CompletionRequest{Messages:[system,user], Temperature:0.7, MaxTokens:4096})`
- **H13 修复**：哈希中包含 APIKey（避免换 key 后命中旧 provider）

### 2.5 辅助

- `recordCastInvocation(...)` — 便捷写历史 + 返回 ToolResult
- `toolToApTools(tools) []ap.Tool` — 转 `ap.Tool` 接口列表
- `orDefault`, `nowMs`, `parseNumberedList`, `isAllDigit` — 工具函数
- `resolvePredefinedSchema(name)` — 7 种内置结构化 schema：sentiment / sentiment_detail / ner / classification / multi_label_classification / summary / extractive_summary

### 2.6 Wails 绑定方法

| 方法 | 用途 |
|------|------|
| `ExtractStructured(text, schemaName) (string, error)` | 用预定义 schema 抽取 |
| `ExtractStructuredCustom(text, schemaJSON) (string, error)` | 用 JSON Schema 自定义 |
| `GetToolHistory(sessionID, limit) []CastToolInvocation` | 工具调用历史 |
| `InvokeCastTool(name, argsJSON) (string, error)` | 手动调用 |
| `GetToolCatalog() []ToolCatalogItem` | 工具目录（前端 ToolList 用） |

---

## 3. 19 类 Cast 工具文件清单

> 每个文件都遵循同一模式：定义一个 `registerXxxTools(a *App, toolkit *ap.ToolRegistry) error` 函数，在 `RegisterCastTools` 中按顺序调用。

| # | 文件 | 类别 | 典型工具名 | 业务 |
|---|------|------|----------|------|
| 1 | [cast_tools_writing.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_writing.go) | writing | `cast_writing_generate` / `cast_writing_polish` | 9 种文档类型 / 6 种风格 / 6 种模式 |
| 2 | [cast_tools_translation.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_translation.go) | translation | `cast_translation_translate` / `cast_translation_glossary_*` | 15+ 语言 / 5 种风格 / 术语表 |
| 3 | [cast_tools_kb.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_kb.go) | kb | `cast_kb_search` / `cast_kb_save` / `cast_kb_link` | 知识库 CRUD / 双向链接 / FTS |
| 4 | [cast_tools_email.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_email.go) | email | `cast_email_draft` / `cast_email_template_*` | 10+ 模板 / 变量 / 语气 |
| 5 | [cast_tools_schedule.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_schedule.go) | schedule | `cast_schedule_create` / `cast_schedule_run` | Cron 表达式 / 后台调度 |
| 6 | [cast_tools_todo.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_todo.go) | todo | `cast_todo_*` | 4 级优先级 / 重复 / 统计 |
| 7 | [cast_tools_misc.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_misc.go) | misc | `cast_misc_timer` / `cast_misc_ocr` / `cast_misc_diagram` / `cast_misc_convert` / ... | 12+ 轻量工具 |
| 8 | [cast_tools_project.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_project.go) | project | `cast_project_*` | 文件读写 / 沙箱 / 多项目切换 |
| 9 | [cast_tools_plugin.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_plugin.go) | plugin | `cast_plugin_*` | 插件安装/卸载/启用 |
| 10 | [cast_tools_sandbox.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_sandbox.go) | sandbox | `cast_sandbox_exec_js` / `cast_sandbox_exec_py` | JS/Python/Shell 沙箱 |
| 11 | [cast_tools_memory.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_memory.go) | memory | `cast_memory_search` / `cast_memory_export` | 记忆系统（基于 AP SQLite） |
| 12 | [cast_tools_perf.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_perf.go) | perf | `cast_perf_*` | 性能监控 / 资源使用 |
| 13 | [cast_tools_learning.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_learning.go) | learning | `cast_learning_*` | Learning Loop（操作模式） |
| 14 | [cast_tools_security.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_security.go) | security | `cast_security_audit` / `cast_security_pii_*` | PII / 敏感词 / 注入扫描 |
| 15 | [cast_tools_channel.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_channel.go) | channel | `cast_channel_send_webhook` / `cast_channel_send_feishu` | Webhook/飞书/钉钉/Slack/邮件 |
| 16 | [cast_tools_collab.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_collab.go) | collab | `cast_collab_*` | 实时协作编辑 |
| 17 | [cast_tools_soul.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_soul.go) | soul | `cast_soul_set_persona` / `cast_soul_get_persona` | AI 人格引擎 |
| 18 | [cast_tools_marketplace.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_marketplace.go) | marketplace | `cast_marketplace_search` / `cast_marketplace_install` | 插件市场 |
| 19 | [cast_tools_workflow.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_workflow.go) | workflow | `cast_workflow_run` / `cast_workflow_pause` | AP Workflow 触发 |
| — | [cast_tools_types.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_types.go) | — | — | 共享类型定义 |
| — | [cast_persistence.go](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_persistence.go) | — | — | Cast 工具状态 JSON 持久化 |

> 工具命名规范：`cast_<category>_<action>`，便于 `GetToolCatalog` 推断 category。

---

## 4. 典型工具实现模板

> 以 [`cast_tools_writing.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools_writing.go) `cast_writing_generate` 为例：

```go
func registerWritingTools(a *App, toolkit *ap.ToolRegistry) error {
    tools := []*castTool{
        newCastTool(a, "cast_writing_generate", "writing",
            "生成结构化文档（周报/方案/文案/...）",
            json.RawMessage(`{
                "type": "object",
                "properties": {
                    "docType": {"type": "string", "enum": ["weekly","plan","copy", ...]},
                    "topic":   {"type": "string"},
                    "style":   {"type": "string", "enum": ["formal","casual", ...]},
                    "length":  {"type": "string", "enum": ["short","medium","long"]},
                    "outline": {"type": "string"}
                },
                "required": ["docType","topic"]
            }`),
            func(ctx context.Context, a *App, args json.RawMessage) (*ap.ToolResult, error) {
                return a.castToolWritingGenerate(ctx, args)
            },
        ),
        // ... 更多工具
    }
    return toolkit.RegisterMultiple(toolToApTools(tools))
}
```

业务方法在同文件（或 cast_tools_types.go）中实现：

```go
func (a *App) castToolWritingGenerate(ctx context.Context, args json.RawMessage) (*ap.ToolResult, error) {
    var p struct {
        DocType string `json:"docType"`
        Topic   string `json:"topic"`
        Style   string `json:"style"`
        Length  string `json:"length"`
        Outline string `json:"outline"`
    }
    if err := json.Unmarshal(args, &p); err != nil { ... }

    // 1) 构造 system prompt
    // 2) 调 a.castLLM(ctx, system, user)
    // 3) a.recordCastInvocation(...) 记录
    return &ap.ToolResult{Content: result}, nil
}
```

---

## 5. 新增一个 Cast 工具（步骤）

1. **选文件**：新类别 → 新建 `cast_tools_<category>.go`；已有类别 → 在对应文件追加。
2. **写 register 函数**：
   ```go
   func registerXxxTools(a *App, toolkit *ap.ToolRegistry) error {
       tools := []*castTool{
           newCastTool(a, "cast_xxx_yyy", "xxx", "描述", parametersJSON, fn),
       }
       return toolkit.RegisterMultiple(toolToApTools(tools))
   }
   ```
3. **在 [`cast_tools.go`](file:///e:/codecast/CodeCast/CodeCast-desktop/cast_tools.go) `RegisterCastTools`** 的 `for _, r := range []func(...){...}` 列表里加上 `registerXxxTools`。
4. **业务方法** `(a *App) castToolXxxYyy(ctx, args) (*ap.ToolResult, error)`。
5. **L1/L2 缓存**：若用 LLM，统一走 `a.castLLM`。
6. **持久化**：状态需要落盘时，在 `cast_persistence.go` 加 getter/setter，并在 `initCastStores()` 中加载。
7. **测试**：用 `_test.go` 覆盖参数解析、错误分支。
8. **前端 ToolList**：`GetToolCatalog()` 自动从 toolkit 推导，无需后端额外配置。

---

## 6. Cast 工具安全与沙箱

- **写文件类工具**（`cast_project_write_file` 等）：走 AP `Sandbox.ValidatePath()` + Hook `HookBeforeTool` → `checkpointHook` 暂停等待用户确认。
- **Shell 类工具**（`cast_sandbox_exec_shell`）：走 `setGlobalValidateCommand()` 注入的危险命令校验。
- **网络类**（`cast_channel_send_*`）：通过 AP `ACL` 控制出站目标。
- **隐私**（`cast_security_pii_*`）：基于 AP `Guardrail` 内置的 PII / SensitiveWord / PromptInjection 规则。

---

## 7. 调试技巧

- 看 `GetToolHistory(sessionID, 50)` 拿到最近 50 次调用
- 看 `GetToolCatalog()` 确认注册成功
- `toolkit.Count()` 启动日志会打印
- 若 Cast 工具在 AI 主动调用时没出现 → 检查 `RegisterCastTools` 是否被调用、是否注册成功
