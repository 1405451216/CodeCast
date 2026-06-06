# 01 · 项目概览

## 1. 项目定位

**CodeCast** 是一款**本地优先、跨平台**的 AI 编程助手桌面应用（Windows / macOS，Linux 计划中）。它不是简单的聊天窗口，而是一个"理解你项目、记住你偏好、帮你把想法落到产物"的工作台。

| 维度 | 说明 |
|------|------|
| 形态 | 桌面 App（Wails v2 + WebView） |
| 后端 | Go 1.26，单 `package main` |
| 前端 | React 18 + TypeScript + Vite 5 |
| AI 内核 | 自研 AgentPrimordia（AP）框架（本地模块） |
| 数据 | 完全本地（SQLite FTS5、JSON 文件、AES-256-GCM 加密） |
| 多模型 | DeepSeek / OpenAI / Anthropic / Gemini / Ollama / Azure / Mistral / Cohere / Qwen / GLM 等 9+1 提供商 |
| 协议 | MCP（WebSocket + stdio），内置 Chrome DevTools 集成 |
| 扩展 | Cast 工作台（30+ 模块）、技能（Skill）系统、自定义 Provider |

---

## 2. 核心能力矩阵

| 能力 | 简述 | 后端关键文件 |
|------|------|---------------|
| AI 对话 | 多会话、模型切换、流式响应 | `chat.go` |
| 情景记忆 | SQLite FTS5 跨会话召回 | `main.go`（AP `SQLiteStore`） |
| 项目感知 | 多项目工作区、文件读写、沙箱 | `project.go` / `shell.go` |
| Agent 自主执行 | 任务规划、工具调用、Checkpoint 人工协作 | `chat.go` + `checkpoint_hook.go` + `cast_tools_*.go` |
| 代码补全 | L1/L2/L3 三级缓存 + FIM 模式 | `completor.go` + AP `CachedProvider` |
| MCP 协议 | WebSocket / stdio 客户端 | `mcp_bridge.go` + AP `MCPRegistry` |
| Git 集成 | 状态检测、AI Commit、PR 模板、Rebase | `git.go` |
| 自动化调度 | Cron 任务、回调通知 | `cast_tools_schedule.go` |
| 安全沙箱 | ACL + Sandbox + 危险命令拦截 | `security.go` / `shell.go` |
| Cast 工作台 | 写作、翻译、知识库、邮件、日程、… | `cast_tools_*.go` |
| 技能（Skill） | 内置 + 自定义 Prompt 模板 | `session.go`（`initDefaultSkills`） |
| 自动更新 | GitHub/Gitee Release 检测 | `updater.go` |
| 国际化 | i18n 多语言 | `i18n*.go` |
| 监控 | 指标采集（Prometheus 导出）+ Telemetry | `metrics.go` / `telemetry_bridge.go` |
| 窗口管理 | 无边框、深色/浅色主题、可调字体 | `window.go` |

---

## 3. 目标用户场景

1. **个人开发者**：让 AI 理解项目上下文，跨会话记得住你"昨天讨论过什么"。
2. **写代码的团队成员**：Agent 自动拆解任务、调用工具、写测试、提交 Git。
3. **非纯代码场景**：Cast 工作台覆盖写作、翻译、邮件、知识管理等多任务场景。
4. **隐私敏感用户**：代码与数据完全本地；API Key 加密；可选本地 Ollama 离线运行。

---

## 4. 版本历史

### v1.0.0-beta（2026-05-27）
- **多模型支持**：9+1 提供商，14+ 模型
- **Agent v2.0**：动态任务规划 + 17 内置工具 + Checkpoint
- **三级代码补全**：L1/L2/L3 缓存 + FIM
- **Git 工作流增强**：AI Commit / PR / Rebase / 冲突解决
- **情景记忆可视化**
- **🎬 Cast 工作台**：6 大面板 + 30+ 工具 + 19 类 Cast 工具文件

### 早期
- v0.x 历代：基础对话、记忆、项目感知、MCP 协议、Skill 系统、自动调度。

---

## 5. 用户视角的产品形态

- **主窗口**：左侧会话列表 + 主对话区 + 右侧文件/技能/工具面板
- **斜杠命令（/command）**：快速触发能力
- **Cast 入口**：6 大面板（写作、翻译、日程、知识库、邮件、工具箱）
- **设置**：模型管理、Provider 凭据、安全策略、自动更新
- **主题**：深色 / 浅色 / 字体大小

> 前端细节（含组件结构、Store 分片、Sentry 集成、视觉回归测试）详见 [`CodeCast-desktop/frontend/ARCHITECTURE.md`](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/ARCHITECTURE.md)。
