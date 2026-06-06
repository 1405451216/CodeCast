# CodeCast Code Wiki · 文档总览

> 适用代码版本：v1.0.0-beta（2026-05-27）· 目标读者：开发者 / 架构师 / 二次维护者
> 仓库根目录：`e:\codecast\CodeCast`
> 后端入口：`CodeCast-desktop/main.go`
> 前端入口：`CodeCast-desktop/frontend/`（package.json 名为 `codecast-frontend`）

---

## 1. 项目一句话

**CodeCast 是一款本地优先、跨平台的 AI 桌面编程助手**，基于 Wails v2（Go + React/TS），以 AgentPrimordia（AP）框架为内核，提供 AI 对话、Agent 自主执行、情景记忆、项目感知、Git 集成、MCP 协议、Cast 工作台等能力。

---

## 2. 文档目录

| # | 文档 | 主要内容 |
|---|------|----------|
| 01 | [项目概览](01-Project-Overview.md) | 定位、特性、版本、用户场景 |
| 02 | [系统架构](02-Architecture.md) | 分层、模块拓扑、请求/事件流、数据流 |
| 03 | [后端核心模块](03-Backend-Modules.md) | `main.go` / `chat.go` / `session.go` / `config.go` / `persistence.go` / `shell.go` 等核心 Go 文件职责 |
| 04 | [AP 框架集成](04-AP-Framework-Integration.md) | AgentPrimordia 集成规则、AP 子系统、关键适配器、并发锁约定 |
| 05 | [Cast 工作台](05-Cast-Toolbox.md) | 19 类 Cast 工具文件、castLLM、注册中心、调用历史 |
| 06 | [关键类与函数](06-Key-Classes-Functions.md) | 跨文件被引用的核心结构体/方法、API 契约 |
| 07 | [依赖关系](07-Dependencies.md) | Go 与 NPM 依赖、AP 框架引用、版本约束 |
| 08 | [运行与构建](08-Running-Building.md) | 开发、构建、跨平台产物、CI/CD |
| 09 | [开发与扩展指南](09-Development-Guide.md) | 新增 Cast Tool、新增 Provider、修改默认 Agent、调试技巧 |

---

## 3. 一张图速览

```
┌────────────────────────────────────────────────────────────┐
│  Frontend (React 18 + TS + Vite)                           │
│  ├─ Agent v2.0 / Task Planner / Checkpoint UI              │
│  ├─ Cast Workbench (30+ tools)                             │
│  ├─ 3-level Code Completion                                │
│  └─ Memory / Git / MCP / Settings                          │
└────────────────────────▲───────────────────────────────────┘
                Wails Bindings | EventsEmit
┌────────────────────────▼───────────────────────────────────┐
│  Backend (Go 1.26) — Wails v2 App                          │
│  ├─ chat.go           主对话入口                           │
│  ├─ session.go        会话/技能 CRUD                       │
│  ├─ config.go         凭据/模型配置                        │
│  ├─ persistence.go    会话 JSON 持久化                     │
│  ├─ shell.go          Shell/沙箱执行                       │
│  ├─ cast_tools_*.go   19 类 Cast 工具（注册到 AP）         │
│  └─ *_bridge.go       Wails ↔ AP 桥接层                    │
└────────────────────────▲───────────────────────────────────┘
                       │
┌────────────────────────▼───────────────────────────────────┐
│  AgentPrimordia (AP) Framework  ──  Local Module           │
│  Agent / Pool / Memory / RAG / Bus / Hooks / Toolkit /     │
│  Guardrails / Checkpoint / CostTracker / Cache / Telemetry │
│  LLM Providers × 9  (OpenAI/Anthropic/Gemini/Ollama/...)   │
└────────────────────────────────────────────────────────────┘
```

---

## 4. 仓库结构

```
CodeCast/
├── README.md                       # 用户向 README（含 Cast 模块清单）
├── LICENSE                         # MIT
├── .github/workflows/              # CI：Linux / macOS / Windows 三平台构建
├── CodeCast-desktop/               # ⭐ 主工程：Wails v2 + Go + React
│   ├── main.go                     # App 入口 / Wails 生命周期 / AP 子系统初始化
│   ├── chat.go                     # 对话主入口（流式响应）
│   ├── config.go                   # 配置 / 凭据 / Provider 预设
│   ├── session.go                  # 会话/技能/任务类型
│   ├── persistence.go              # 会话 JSON 持久化（应用层）
│   ├── shell.go                    # Shell 命令执行
│   ├── cast_tools.go               # Cast 工具注册中心 + castLLM
│   ├── cast_tools_*.go             # 19 类 Cast 工具实现
│   ├── *_bridge.go                 # AP ↔ Wails 桥接（mcp/plugin/...）
│   ├── *_test.go                   # Go 单元测试
│   ├── wails.json                  # Wails 桌面打包配置
│   ├── go.mod / go.sum             # Go 依赖（replace → AP 本地模块）
│   └── frontend/                   # React + TypeScript
│       ├── package.json            # 依赖 + 脚本
│       ├── index.html              # Vite 入口
│       ├── tsconfig.json / vite.config.ts / vitest.config.ts
│       ├── ARCHITECTURE.md         # 前端架构说明
│       ├── docs/                   # FAQ / 性能 / 升级报告 / 用户手册 等
│       └── e2e/                    # Playwright 端到端测试
```

> **前端源码**（`frontend/src/`）未提交到本仓库，由 Wails 流程在 release 之前构建并以 `embed.FS`（`frontend/dist`）形式打入 Go 端。

---

## 5. 阅读建议

- **新加入开发者**：先读 [01-Project-Overview](01-Project-Overview.md) → [02-Architecture](02-Architecture.md) → [03-Backend-Modules](03-Backend-Modules.md) → 走一遍 [08-Running-Building](08-Running-Building.md) 跑起来。
- **改 Agent / Pool / 记忆逻辑**：先看 [04-AP-Framework-Integration](04-AP-Framework-Integration.md)（含死锁规避与锁契约），再读 `main.go` 的 `startup()`。
- **新增 / 修改 Cast 工具**：直接看 [05-Cast-Toolbox](05-Cast-Toolbox.md) 的"新增一个 Cast 工具"模板。
- **依赖 / 升级问题**：看 [07-Dependencies](07-Dependencies.md)。
- **运行/打包**：看 [08-Running-Building](08-Running-Building.md)。

---

## 6. 关键约定（速记）

1. **AP 锁契约**：`createProviderLocked()` / `createCachedProviderLocked()` / `resolveCredentialsLocked()` 的调用方**必须持有 `a.mu`**，且这些方法内部**不要再加锁**（RWMutex 不可重入，会死锁）。
2. **Wails 绑定**：所有 `func (a *App) Xxx(...) ...` 是前端可直接调用的方法；导出名要稳定。
3. **AP 事件桥**：AP `Bus` 是 channel 模型，必须经过 `event_bridge.go` 转发到 `wailsRuntime.EventsEmit`。
4. **Provider 派生**：`APICredentials` 没有 `ProviderID` 字段，统一通过 `guessProviderForModel(creds.Model)` 推断。
5. **Cast 工具入口**：所有 Cast 工具都通过 `castLLM()` 调 LLM，并在 `RegisterCastTools()` 中注册。
6. **持久化**：`persistence.go` 保留（应用层），不要被 AP 替代。
7. **App 必须保留字段**：`llmConfig`（`syncSettingsToConfig()` 依赖）、`cachedProvider` + `cachedProviderConfigHash`（缓存命中检测）。
