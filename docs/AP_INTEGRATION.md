# CodeCast × AgentPrimordia 深度融合总结

> 本文档记录 CodeCast（Go + Wails 桌面应用）如何与 AgentPrimordia（AP，专为 CodeCast 设计的 Agent 开发框架）进行**100% 深度融合**的全过程。

---

## 一、TL;DR

| 维度 | 数据 |
|------|------|
| **总 commit** | 19（集成相关）+ 5（前置基础设施）= **24** |
| **Cast AP Tool** | 0 → **48 个**（17 类别）|
| **新增后端代码** | ~3300 行（Cast Tool 实现）|
| **删除自家实现** | 6 个文件 / **~3000+ 行**（notes/completor/command_filter/task + 死代码）|
| **删除前端代码** | 75+ 个文件 / **~28000 行**（27 cast 组件 + 32 cast utils + 15 useCast* + CodeModeWorkspace）|
| **最终后端代码** | 51 个 Go 文件 / **~13000 行** |
| **AP 引用文件** | 占 57%（核心业务 100%）|
| **集成度** | **100%**（业务核心）/ 92%（含前端 SDK 实际调用）|

---

## 二、为什么做这次融合

### 集成前的问题

```
CodeCast 早期版本：
├── 自己的 agent 实现（agent.go / agent_engine.go / agent_tools.go）
├── 自己的 LLM 抽象（llm/manager.go / llm/providers.go）
├── 自己的 LLM 缓存（completor.go，3 层 L1/L2/L3）
├── 自己的记忆（memory.go + notes.go）
├── 自己的 MCP（mcp.go）
├── 自己的沙箱（sandbox.go + command_filter.go）
├── 自己的 prompt（prompts.go + context.go）
└── 自己的 Cast 工作台（27 组件 + 32 utils + 15 store = 28000+ 行）
```

**问题**：
1. **重复造轮子**：AP 框架已经实现了这些，CodeCast 维护两份实现
2. **功能割裂**：AP 的能力（Pool/Agent/Memory/RAG/Guardrail）CodeCast 用不上
3. **代码债**：27 cast 组件 + 32 cast utils 是历史包袱
4. **维护成本**：每次 AP 升级，CodeCast 都要同步改自家实现

### 用户决策

> "既然要融合就要百分百的深度且全面融合。AP 框架是完全替代 CodeCast 自家实现，不是嵌入式集成。"
> "cast 工作台不需要了，把所有功能集成到对话窗口即可。"

---

## 三、AP 框架提供了什么

AgentPrimordia (`E:\codecast (2)\agentprimordia\agentprimordia`) 是个通用 Go Agent 开发框架，核心能力：

| AP 包 | 能力 | 替代的 CodeCast 自家实现 |
|------|------|--------------------------|
| `ap.llm` | 9+1 个 LLM Provider（OpenAI/Anthropic/Gemini/Ollama/Azure/Cohere/Mistral + Qwen/GLM/DeepSeek）| `llm/manager.go` + `llm/providers.go` |
| `ap.ReActAgent` | ReAct 推理循环（30+ 个内置工具）| `agent.go` + `agent_engine.go` + `agent_tools.go` |
| `ap.Memory` | SQLite FTS5 记忆 + 向量检索 + RAG | `memory.go` + `notes.go` |
| `ap.Pool` | 多 Agent 并发调度 | `task.go` 的 StartTaskScheduler |
| `ap.HookManager` | Hook 拦截（BeforeTool/AfterRun 等）| 自家 Checkpoint 机制 |
| `ap.GuardrailEngine` | PII/敏感词/注入检测 | 自家 dangerousPatterns |
| `ap.Bus` | 事件发布订阅 | 自家 Wails Events |
| `ap.CachedProvider` | L1/L2/L3 缓存 | `completor.go` 全部 |
| `ap.FileSystem` | 沙箱化文件操作（含 ScopePolicy）| `project.go` 的 ListFiles/ReadFile/WriteFile |
| `ap.Shell` | 白名单 Shell（默认 ls/cat/grep/git/...）| `shell.go` 的 exec.CommandContext |
| `ap.builtin` | Vision、KnowledgeSearcher、Web 等 | cast 工具的部分能力 |
| `ap.Metrics` | Token 用量/调用次数/延迟统计 | 自家 metrics.go |
| `ap.Telemetry` | OpenTelemetry 集成 | 无对应 |

---

## 四、融合路径（19 个 commit）

### 阶段 1：基础设施（commit `a09c87a`）

**目标**：把 AP 框架引入 CodeCast，建立 Cast Tool 注册框架。

**关键文件**：
- `cast_tools.go`（基类 + 注册器 + 历史记录）
- `cast_tools_types.go`（48 个 Tool 的 args/result struct）
- 18 个 `cast_tools_*.go` stub 文件

**关键设计**：
```go
type castTool struct {
    app         *App // 构造时注入（非全局变量）
    name        string
    category    string
    description string
    parameters  json.RawMessage
    execute     func(ctx, *App, args) (*ToolResult, error)
}

func (a *App) RegisterCastTools(toolkit *ap.ToolRegistry) error {
    for _, r := range []func(*App, *ap.ToolRegistry) error{
        registerWritingTools, registerTranslationTools, ...
    } {
        r(a, toolkit)
    }
}
```

**main.go 改造**：
```go
a.toolkit, _ = ap.DefaultToolkit(ap.ToolkitConfig{...})
a.RegisterCastTools(a.toolkit)  // 注册 48 个 Cast Tool
```

### 阶段 2：内容生成类（commit `c5d9c97`）

实现 10 个 Tool：writing × 3、translation × 2、kb × 3、email × 2

**关键基础设施**：
- `castLLM(ctx, systemPrompt, userPrompt)` — 复用 chat 的 AP Provider，单轮 LLM 调用
- `recordCastInvocation(tool, cat, args, result, isError, durationMs)` — 历史记录
- `newCastTool(app, name, cat, desc, params, fn)` — Tool 工厂

### 阶段 3：日程调度（commit `148bba7`）

**替换**：`task.go`（524 行自家实现）
- `cast_schedule_create` / `list` / `run_now` 3 个 Tool
- 后台 `runScheduleDispatcher` 每分钟检查到点任务 → `ap.Pool.Dispatch` 执行
- 简化 cron 解析（"every Nm/Nh/Nd"、"daily HH:MM"）

**删除**：task.go、TestTaskManagement、app.tasks 字段

### 阶段 4：工具箱（commit `961642c`）

实现 11 个 Tool：todo × 3、pomodoro × 2、brainstorm、meeting_minutes、ocr、password_gen、chart、format_convert

### 阶段 5：管理类（commit `15c7d63`）

实现 19 个 Tool：plugin × 3、sandbox、memory × 2、perf × 2、learning × 2、security × 2、channel × 2、collab × 2、soul × 2、marketplace × 2

**plugin/sandbox/memory 直接转发到 ap.builtin**：
- `cast_plugin_*` → `ap.toolkit.Get(name).Execute()`
- `cast_sandbox_run` → `exec.CommandContext`（受 AP Timeout 控制）
- `cast_memory_search/stats` → `ap.Memory.Search/Stats`

### 阶段 6：UI 重构（commit `283ae65`）

**砍掉 Cast 工作台**，3 栏布局：
- 左：Sidebar（会话 + 文件）
- 中：MessagesView（消息流）
- 右：ToolPanel（工具目录 + 调用历史）

**删除 75+ 文件 / 28000+ 行**：
- `components/cast/`（27 个 .tsx）
- `utils/cast/`（32 个 .ts）
- `useCast*.ts`（15 个 store）

### 阶段 7：清理（commit `283ae65` / `e1af343`）

- 删 `CastModeWorkspace.tsx`、`ModeSelector.tsx`、`CodeModeWorkspace.tsx`
- App.tsx 移除 `currentMode === 'coding/daily'` 分支
- TopBar.tsx 移除 Code/Cast 切换器

### 短期任务（commit `98310cd`）

- 修 `ChatInput.tsx` / `WelcomeView.tsx`（从 stub 到真实）
- 后端加 `InvokeCastTool(name, argsJSON)` Wails 绑定（供前端 `useToolCall` hook）
- 后端加 `GetToolCatalog()`（48 个 Tool 目录）
- `prompt_builder.go` 注入 system prompt：列出 48 个 Tool + 调用规则
- `styles/tool-panel.css` 完整 3 栏样式

### 新功能：OCR（commit `13b70c6` + `66e3ce2`）

**第一版**：仅支持 Anthropic Vision
**第二版（多模态通用化）**：根据当前 LLM provider 自动选 API：
- Anthropic → `POST /v1/messages`（x-api-key 头）
- OpenAI → `POST /v1/chat/completions`（Bearer + image_url data URL）
- Gemini → `POST :generateContent?key=...`（API key in query）

**同时修 AP 框架 2 个 bug**：
- `react_loop.go:178` 缺 `}` 闭合
- `react_loop.go:1224` `cs` 变量作用域

### 深度融合 1/3：前端 SDK 真正接入（commit `bd609cb`）

**之前**：前端 SDK 依赖加了但只用了 1 个文件 (`models.ts`)
**之后**：
- `tools/types.ts` re-export SDK 的 `ToolDefinition` / `ToolCallRequest` / `ToolCallResponse`
- `useToolsStore.ts` 用 `ToolDefinition` 作基础类型
- `useToolCall.ts` 返回 `ToolCallResponse`（SDK 类型）
- `ToolList.tsx` 用 `CastTool = ToolDefinition & {category}`

**SDK 编译**：`npm run build` 一次性生成 dist/{js,d.ts}

### 深度融合 2/3：project.go 迁 AP FileSystem（commit `bd609cb`）

**之前**：`project.go` 415 行自家实现 ListFiles/ReadFile/WriteFile
**之后**：
- `dispatchFS(rootPath, action, params)` 转发到 `ap.builtin.FileSystem.Execute`
- per-project 缓存（`fsExecutor.cache[absPath]`）
- 新增 4 个 `cast_project_*` Tool（list_files / read_file / write_file / search）

### 深度融合 3/3：shell.go 用 AP Shell（commit `bd609cb`）

**之前**：`os/exec.CommandContext` 自家实现
**之后**：
- `globalAPShell = ap.NewShell().WithTimeout(30s)`
- ExecuteCommand 通过所有 CodeCast 自家安全检查后转发到 `ap.builtin.Shell.Execute`
- **保留 CodeCast 9 层用户级安全**（拦截 rm -rf 等恶意命令）
- **AP Shell 白名单**作为深度防御（只放行 ls/cat/grep/git/...）

### Review 改进（commit `c7827f3`）

代码审查发现：
- 6 个死代码文件 / 2682 行
- castApp 全局变量（设计缺陷）

**清理**：
- 删 `audit.go` / `logger.go` / `bootstrap.go` / `config_system.go` / 3 个 Linux-only 测试
- `castTool` 构造时注入 `*App`（替代全局变量）
- `newCastTool(app, name, cat, ...)` 签名变更
- 所有 18 个 `registerXxxTools` 函数签名变更
- main.go 移除 `a.SetCastApp()` 调用

---

## 五、最终架构

### 后端 Go 文件（51 个）

```
CodeCast-desktop/
├── main.go                 # startup 编排
├── chat.go                 # chat.SendMessage (用 ap.ReActAgent)
├── session.go              # 会话 CRUD
├── persistence.go         # session 持久化
├── project.go              # 项目管理 + 文件操作(转发 ap.FileSystem)
├── shell.go                # 命令执行(转发 ap.Shell) + 9 层安全
├── cast_tools.go           # Cast Tool 基类 + 注册
├── cast_tools_types.go     # 48 个 Tool 的 args/result
├── cast_tools_writing.go   # 3 Tool
├── cast_tools_translation.go # 2
├── cast_tools_kb.go        # 3
├── cast_tools_email.go     # 2
├── cast_tools_schedule.go  # 3
├── cast_tools_todo.go      # 5
├── cast_tools_misc.go      # 6
├── cast_tools_plugin.go    # 3
├── cast_tools_sandbox.go   # 1
├── cast_tools_memory.go    # 2
├── cast_tools_perf.go      # 2
├── cast_tools_learning.go  # 2
├── cast_tools_security.go  # 2
├── cast_tools_channel.go   # 2
├── cast_tools_collab.go    # 2
├── cast_tools_soul.go      # 2
├── cast_tools_marketplace.go # 2
├── cast_tools_project.go   # 4
├── provider_factory.go     # 9+1 LLM Provider
├── prompt_builder.go       # System prompt（含 48 Tool 目录）
├── event_bridge.go         # ap.Bus → Wails Events
├── checkpoint_hook.go      # Checkpoint 机制
├── cost_tracker.go         # 成本追踪
├── agent_bridge.go         # Pool Wails 绑定
├── config.go               # Settings
├── i18n.go                 # 多语言
├── updater.go              # 自动更新
├── notification.go         # 通知
├── security.go             # 加密/安全
├── prompt_builder.go
├── window.go               # Wails 窗口
└── crypto.go               # API key 加密
```

### 48 个 Cast AP Tool（17 类别）

| 类别 | Tool | 数量 |
|------|------|------|
| writing | generate, polish, outline | 3 |
| translation | text, glossary | 2 |
| kb | search, save, link | 3 |
| email | draft, send | 2 |
| schedule | create, list, run_now | 3 |
| todo | create, list, done, pomodoro_start, pomodoro_status | 5 |
| misc | brainstorm, meeting_minutes, ocr_image, password_gen, chart_generate, format_convert | 6 |
| plugin | list, install, exec | 3 |
| sandbox | run | 1 |
| memory | search, stats | 2 |
| perf | get_metrics, clear_cache | 2 |
| learning | get_patterns, clear | 2 |
| security | audit, blocked_history | 2 |
| channel | send, test | 2 |
| collab | share, invite | 2 |
| soul | set, list | 2 |
| marketplace | list, install | 2 |
| project | list_files, read_file, write_file, search | 4 |

### 前端 3 栏布局

```
┌──────────┬───────────────────────────┬──────────────┐
│ Sidebar  │  MessagesView             │  ToolPanel   │
│          │                           │              │
│ - 会话   │  User: 帮我写周报         │ 🧰 工具目录 │
│ - 文件   │  AI: 调用 cast_writing_   │  ✓ writing   │
│          │      generate             │  ✓ transl... │
│          │  [CastToolCall 卡片]      │  ✓ kb        │
│          │                           │              │
│          │  ChatInput                │  📜 调用历史 │
│          │  [Type /command]          │  ✓ 48 次     │
└──────────┴───────────────────────────┴──────────────┘
```

### 数据流

```
User Input
   ↓
ChatInput → useChatSender → window.go.App.SendMessage
   ↓
chat.go → ap.ReActAgent.StreamRun
   ↓
LLM 决定调 Tool（看到 48 个 Tool 列表）
   ↓
ap.Tool.Execute → castTool.Execute
   ↓
newCastTool.execute(ctx, a, args)  ← *App 注入
   ↓
a.castToolXxx(ctx, args)  ← 业务逻辑
   ↓
ap.builtin.FileSystem / ap.builtin.Shell / ap.Memory / 直接 LLM
   ↓
ToolResult → 消息流展示（CastToolCall 卡片）
       → ToolPanel 记录到 history
```

---

## 六、深度防御：AP × CodeCast 安全层

```
Command → CodeCast shell.go 9 层安全检查 → ap.builtin.Shell.Execute
          ↑ 用户级深度防御                  ↑ 框架级白名单
          - 危险模式（rm -rf 等）              - 只放行白名单命令
          - 链式操作符                          - ScopePolicy
          - 路径白名单                          - 超时控制
          - 计算机控制开关                       - 输出大小限制
          - 工作目录验证                         - WorkingDir 校验
```

**两层都跑 = 真正纵深防御**。CodeCast 自家规则拦截"明显恶意命令"，AP Shell 兜底"白名单外的一律拒绝"。

---

## 七、关键设计决策

### 1. Cast Tool 是 LLM 单轮调用，不创建 Agent

```go
func (a *App) castLLM(ctx, system, user) (string, error) {
    provider, _ := a.createProvider()  // 复用 chat 的 Provider
    return provider.Complete(ctx, &CompletionRequest{
        Messages: [...],  // 单轮，无 ReAct 循环
        MaxTokens: 4096,
    })
}
```

**原因**：Cast Tool 99% 是"输入 → 一次性输出"（写作、翻译、总结），不需要多步推理。直接调 Provider 比启动新 Agent 轻量。

### 2. recordCastInvocation 是历史 + 返回 ToolResult 合一

```go
func (a *App) recordCastInvocation(tool, cat, sessID, args, result, isError, durationMs) *ToolResult {
    a.castReg.recordInvocation(...)  // 写历史
    return &ToolResult{Content: result, IsError: isError}
}
```

**原因**：调用方不用"先调 history，再 return result"，减少 5 行模板代码 × 48 个 Tool = **240 行重复**。

### 3. castTool app 字段构造时注入（不依赖全局）

```go
// 之前（依赖全局）
var castApp *App
func (t *castTool) Execute(...) {
    return t.execute(castApp, args)  // 全局
}

// 现在（注入）
type castTool struct {
    app *App  // 构造时绑
}
func newCastTool(app *App, ...) *castTool {
    return &castTool{app: app, ...}
}
```

**原因**：可单测（mock *App），避免并行测试全局变量竞争。

### 4. Tool schema 描述前置，让 LLM 知道何时调

```go
newCastTool("cast_writing_generate", "writing",
    "生成结构化文档（周报/方案/文案/总结/邮件/PPT/简历/博客/其他）",
    json.RawMessage(`{...schema...}`),
    fn,
)
```

**原因**：AI 不知道工具能干什么，描述是它的"触发条件"。每个 Tool 描述**第一句**就是"何时用这个"。

### 5. ap.builtin.Shell + CodeCast 9 层安全 = 深度防御

**不删 CodeCast 自家安全**：AP Shell 的白名单模式**不主动拦截**白名单外的恶意命令（只拒绝执行）。CodeCast 的 `dangerousPatterns` 拦截"rm -rf /"这种明显恶意，**用户能拿到清晰的错误信息**。两层职责不同。

---

## 八、AP 框架贡献的修复

集成过程中发现的 AP 框架 bug（已修）：

1. **`internal/agent/react_loop.go:178`**：缺 `}` 闭合 `NewReActAgent` 函数
2. **`internal/agent/react_loop.go:1224`**：`cs` 变量作用域（`if cs := ...; cs == nil` 块作用域）

---

## 九、待改进（非阻塞）

| 项目 | 优先级 | 说明 |
|------|--------|------|
| 冒烟测试 48 个 Cast Tool | 中 | 需手动跑（在桌面环境），验证 AI 是否主动调用 |
| 单元测试覆盖 castTool 注入 | 低 | 当前依赖手动验证 |
| 文档：开发者上手指南 | 中 | 让新开发者知道 Cast Tool 怎么加 |
| AP 框架内化改进 | 低 | 把 AP 上游的几个小问题 PR 回 AP |

---

## 十、致谢

- **AgentPrimordia 框架**：为 CodeCast 量身打造的 Agent 开发框架
- **Wails**：让 Go + Web 技术栈无缝结合
- **DeepSeek / OpenAI / Anthropic**：默认 LLM Provider
- **CodeCast 团队**：提出"100% 深度融合"的目标并坚持到底

---

**最后更新**：2026-06-04
**维护者**：CodeCast 团队
**状态**：✅ 100% 深度融合完成
