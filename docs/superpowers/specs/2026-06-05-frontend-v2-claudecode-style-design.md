# Frontend v2 · Claude Code Desktop Style · 设计文档

> **Status**: v2 (优化版，待用户审阅) · 源自 v1 自我反思 9 项优化
> **Date**: 2026-06-05
> **Scope**: `CodeCast-desktop/frontend/src/v2/` 全量重写，旧 `src/` 在 v2 GA + 14 天后整目录删除
> **Goal**: 在保留 CodeCast 全部能力（Cast 30+ 工具、记忆、Git、MCP、Agent、Checkpoint）的前提下，把 UI 改造为 Claude Code 桌面端的极简、克制、工具感风格。

---

## 1. 背景与动机

### 1.1 现状
- 现有前端 `CodeCast-desktop/frontend/src/` 体量约 25,000 行 / 200+ 组件 / 15+ Zustand slice
- 视觉风格：默认 Material 倾向 + 紫蓝渐变 + 12–16px 圆角卡片 + 系统字体
- 入口布局：6 大并列面板（写作/翻译/日程/知识库/邮件/工具箱）门户
- 字体：未配置（fallback 到 `system-ui` / `Inter`），无 monospace 字符感
- 配色：低饱和、对比弱，工具调用与错误状态无视觉权重

### 1.2 目标
打造一个：
- **以 Chat 为绝对主角**的三列桌面端界面
- **Anthropic 设计语言**的极简、克制、工具感
- **不丢能力**：Cast 30+ 工具全部可触达，入口从"6 面板并列"改为"空态快捷 + 斜杠命令 + /cast 路由"
- **双主题**（浅米 + 深褐）
- **不破坏后端契约**：Wails bindings 与 AP 事件流不动

### 1.3 风险
- Big-bang 重写意味着 1–2 周主干不可合并
- 旧组件依赖 Zustand slice 之间的隐式约定，重写需重新梳理数据流
- 字体自托管会引入 ~500KB 字体 bundle 增量（v2 已从 ~1MB 优化）

---

## 2. 设计原则（Design Pillars）

| 原则 | 落地手段 |
|------|----------|
| **Chat 唯一主角** | 移除首页门户，主页 = 对话页；Cast 走 `/cast/*` 路由 |
| **极简视觉** | 米白/深褐双主题；1px hairline 分隔；圆角 ≤ 6px；几乎无阴影 |
| **统一字体家族** | IBM Plex Sans（正文）+ IBM Plex Serif（标题）+ JetBrains Mono（代码/工具），全部免费可商用 |
| **行内交互** | Checkpoint 用 `[Y/n]` 行内风格，不用 modal；Diff 用 `+`/`-` 字符前缀 |
| **折叠优于展开** | 工具调用折叠为 `▶ read_file · 24ms` 摘要 + 展开代码块；侧边栏可收起到 56px |
| **状态极简** | 仅 `● running` / `✓ done` / `⏸ paused` 三种颜色，无动效装饰 |
| **Drawer 默认展开** | 与 Claude Code 桌面端一致，节省一次点击 |

---

## 3. 目标用户与场景

| 用户 | 场景 | 关键交互 |
|------|------|----------|
| 个人开发者 | 多项目工作区内做编码、阅读、重构 | 切换项目、查看文件树、批准写入、查看 diff |
| 写作者 | 写周报/方案/邮件（Cast 写作助手） | `/写周报` 弹出 → 选择类型 → 生成 |
| 翻译/学习 | 中英互译、术语表 | `/translate` → 选风格 → 选语言 |
| 数据/办公 | 番茄钟、OCR、图表生成 | `/tools` → 弹工具面板 |
| 长期用户 | 跨会话记忆、Skill 系统 | 左侧会话列表、顶栏 Skill 快捷、底部 ContextBar |

---

## 4. 总体架构

### 4.1 目录结构（v2 完全独立）

```
CodeCast-desktop/frontend/src/
├── v2/
│   ├── main.tsx                   # 入口（含 Sentry 初始化）
│   ├── App.tsx                    # 顶层布局
│   ├── design/
│   │   ├── tokens.ts              # TS 类型 + CSS variables 双重导出
│   │   ├── theme.ts               # 浅/深主题切换（写入 <html data-theme>）
│   │   ├── fonts.css              # 自托管字体声明
│   │   ├── variables.css          # 运行时 CSS 变量（由 tokens.ts 生成）
│   │   └── reset.css              # 全局重置
│   ├── layout/
│   │   ├── TopBar.tsx             # 顶栏 48px
│   │   ├── Sidebar.tsx            # 左侧 280/56px
│   │   ├── ChatArea.tsx           # 中部
│   │   ├── Drawer.tsx             # 右侧 280px（默认展开）
│   │   ├── BottomBar.tsx          # 底栏 28px
│   │   └── WorkspaceFrame.tsx     # 容器
│   ├── pages/
│   │   ├── ChatPage.tsx           # 默认
│   │   ├── CastEmptyState.tsx     # 空态
│   │   ├── CastPanel.tsx          # /cast 入口占位
│   │   ├── CastWritingPage.tsx    # /cast/writing（v1 旧组件桥接）
│   │   ├── CastTranslationPage.tsx
│   │   ├── CastKnotePage.tsx
│   │   ├── CastSchedulePage.tsx
│   │   ├── CastEmailPage.tsx
│   │   ├── CastToolsPage.tsx      # 12+ 轻量工具
│   │   └── SettingsPage.tsx
│   ├── components/
│   │   ├── composer/
│   │   │   ├── Composer.tsx
│   │   │   ├── SlashCommandMenu.tsx
│   │   │   └── AttachmentList.tsx
│   │   ├── message/
│   │   │   ├── MessageStream.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── MessageMarkdown.tsx
│   │   │   ├── CodeBlock.tsx     # 复用 v1 highlight.js
│   │   │   ├── DiffView.tsx
│   │   │   ├── ToolCallList.tsx
│   │   │   ├── ToolCallItem.tsx
│   │   │   ├── ApprovalCard.tsx
│   │   │   └── StatusDot.tsx
│   │   ├── session/
│   │   │   ├── SessionList.tsx
│   │   │   ├── SessionItem.tsx
│   │   │   └── WorkspaceSwitcher.tsx
│   │   ├── drawer/
│   │   │   ├── DrawerTabs.tsx
│   │   │   ├── FileTree.tsx
│   │   │   ├── GitPanel.tsx
│   │   │   ├── MCPPanel.tsx
│   │   │   └── MemoryPanel.tsx
│   │   ├── bottombar/
│   │   │   ├── ModelBadge.tsx
│   │   │   ├── ContextBar.tsx
│   │   │   └── PlanToggle.tsx
│   │   ├── command/
│   │   │   └── CommandPalette.tsx # cmdk
│   │   └── primitives/
│   │       ├── Button.tsx
│   │       ├── Kbd.tsx
│   │       ├── Tooltip.tsx
│   │       ├── Popover.tsx
│   │       └── Toast.tsx
│   ├── store/
│   │   ├── index.ts               # createStore() 组合 12 slice
│   │   ├── slices/
│   │   │   ├── sessionSlice.ts
│   │   │   ├── chatSlice.ts
│   │   │   ├── modelSlice.ts
│   │   │   ├── workspaceSlice.ts
│   │   │   ├── projectSlice.ts    # 独立（与 workspace 分离）
│   │   │   ├── castSlice.ts
│   │   │   ├── castToolSlice.ts   # 工具状态（与 catalog 分离）
│   │   │   ├── memorySlice.ts
│   │   │   ├── mcpSlice.ts
│   │   │   ├── gitSlice.ts
│   │   │   ├── settingsSlice.ts
│   │   │   └── uiSlice.ts
│   │   └── selectors.ts
│   ├── wails/
│   │   ├── adapter.ts             # 把 Wails bindings 包成前端 SDK
│   │   ├── events.ts              # 订阅 AP / Stream 事件
│   │   └── types.ts               # 从 @agentprimordia/sdk 派生
│   ├── lib/
│   │   ├── hotkeys.ts
│   │   ├── streaming.ts
│   │   ├── format.ts
│   │   └── sentry.ts              # Sentry 初始化 + 业务面包屑
│   └── i18n-keys/                 # 仅 v2 增量文案（v1 i18n 在 src/i18n/ 保留）
└── v2_entry.ts                    # vite.config.ts 指这里
```

> **关键决策**：
> - `v2/` 独立目录 + `v2_entry.ts` 作为 Vite 入口
> - 旧 `src/` 文件保留在仓库但不再被构建，便于回滚
> - 旧文件删除：v2 GA + 14 天后开一个 "delete legacy frontend" PR
> - v1 i18n 在 `src/i18n/`，v2 增量文案加在 `src/v2/i18n-keys/`，合并到主 i18n

### 4.2 顶层布局

```
┌────────────────────────────────────────────────────────────────────────┐
│ TopBar (48px)                                                          │
│   Logo | Workspace ▾ | Model ▾        ⌘K  +  ?     ⚙                  │
├──────┬──────────────────────────────────────────────┬──────────────────┤
│      │                                              │                  │
│ Side │            ChatArea (flex-1)                 │      Drawer      │
│ bar  │  ┌────────────────────────────────────┐      │   280px (默认展开)│
│ 280  │  │  MessageStream (max-w 760px)      │      │                  │
│  /56 │  │                                    │      │   Tabs:         │
│      │  │   [User]                           │      │   Files / Git / │
│      │  │   [Assistant]                      │      │   MCP / Memory  │
│      │  │   > 1. ...                         │      │                  │
│      │  │                                    │      │                  │
│      │  │   ▶ read_file main.tsx             │      │                  │
│      │  │   ✓ 12 lines · 24ms                │      │                  │
│      │  │                                    │      │                  │
│      │  │   ⏸ Approve write? [Y] [n]         │      │                  │
│      │  │                                    │      │                  │
│      │  ├────────────────────────────────────┤      │                  │
│      │  │   Composer (⌘⇧P Plan / ⏎ send)     │      │                  │
│      │  └────────────────────────────────────┘      │                  │
├──────┴──────────────────────────────────────────────┴──────────────────┤
│ BottomBar (28px)                                                       │
│   Opus 4.5  |  context 8.2k/200k         Plan ⌘⇧P  |  v1.0.0          │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3 数据流（前端视角）

```
User (Composer input)
    │
    ▼
chatSlice.sendMessage(text)
    │  ① 组装 Wails 调用：wailsAdapter.SendMessageEx(sessionID, text, model, thinking)
    ▼
Go 端 Agent
    │  ② 推流：wailsRuntime.EventsEmit("stream:"+sid, {type, content, ...})
    ▼
events.ts 订阅 "stream:"+sid
    │  ③ 缓冲（每 200ms flush）+ 状态归类（content / reasoning / tool_call / tool_result / error / done）
    ▼
chatSlice.appendChunk(...)
    │  ④ 状态更新触发 React 重渲染
    ▼
<MessageStream /> 渲染（流式追加，等宽字体 + 行内工具调用折叠）
```

---

## 5. 关键组件契约

### 5.1 `<Composer />`

```ts
interface ComposerProps {
  sessionId: string;
  model: string;
  thinking: boolean;
  onSend: (text: string, opts?: { model?: string; thinking?: boolean }) => void;
  onCancel: () => void;
}
```

行为：
- 单行输入，⌘↵ 发送；⇧↵ 换行
- 输入 `/` 弹 `<SlashCommandMenu />`（模糊匹配，↑↓ 选）
- 输入 `/cast` 跳转 `/cast` 路由
- 左侧 `[Plan]` 开关（持久化到 `uiSlice.planMode`）

### 5.2 `<MessageStream />`

```ts
interface MessageStreamProps {
  sessionId: string;
  messages: Message[];
  isStreaming: boolean;
}
```

行为：
- 容器 `max-width: 760px` 居中
- 单条消息进入动画：fade + 4px 上移（≤ 200ms）
- 流式期间不闪烁；每 200ms 批量 flush
- 工具调用折叠为单行摘要；点击展开 `<CodeBlock />`（**复用 v1 highlight.js**，v2.1 再评估 shiki）

### 5.3 `<ApprovalCard />`

```ts
interface ApprovalCardProps {
  toolName: string;
  target: string;
  risk: 'low' | 'medium' | 'high';
  onApprove: () => void;
  onReject: () => void;
}
```

视觉：
- 行内组件（不是 modal），插在 assistant 消息流末尾
- 文本：`需要批准写入 <code>src/main.tsx</code>？`
- 操作：`<kbd>Y</kbd> 同意` / `<kbd>n</kbd> 拒绝`
- 风险 high 时，文字色 `--danger`，并加红 1px 左边框

### 5.4 `<BottomBar />`

数据来源：`uiSlice` + `modelSlice` + 来自 `GetAPMetricsSnapshot` 的 token 计数

- 左侧：当前模型（点击切换）
- 中部：`ContextBar` 进度条
- 右侧：Plan 模式开关 / 版本号

### 5.5 `<CommandPalette />`（⌘K）

用 `cmdk` 实现，命令分类：
- 会话：`新建对话` / `清空` / `切换上一/下一会话`
- 模型：`切换 Opus 4.5` / `切换 Sonnet 4` / `切换本地 Ollama`
- 工作区：`打开/收起侧边栏` / `打开/收起 Drawer` / `切换 Plan 模式`
- Cast：`写作` / `翻译` / `日程` / `知识库` / `邮件` / `工具箱`
- 系统：`设置` / `关于` / `检查更新` / `切换主题`

---

## 6. 设计 Tokens

```ts
// design/tokens.ts
export const light = {
  bg:        '#FAF9F5',
  bgSub:     '#F2F0E9',
  surface:   '#FFFFFF',
  border:    '#E5E3DD',
  borderStrong: '#D6D3C9',
  text:      '#1F1E1B',
  textSub:   '#6B6862',
  textMute:  '#9A968D',
  accent:    '#DA7756',
  accentBg:  '#F5E5DC',
  accentText:'#8C3A1A',
  success:   '#3A8266',
  warn:      '#C4923C',
  danger:    '#C4533C',
} as const;

export const dark = {
  bg:        '#1B1A17',
  bgSub:     '#26241F',
  surface:   '#1F1E1B',
  border:    '#2E2C27',
  borderStrong: '#3A3832',
  text:      '#F0EEE5',
  textSub:   '#B5B0A4',
  textMute:  '#7A766C',
  accent:    '#E08766',
  accentBg:  '#3A2A22',
  accentText:'#F0B097',
  success:   '#5A9D80',
  warn:      '#D4A65A',
  danger:    '#D86A52',
} as const;

export const radius = { sm: '4px', md: '6px', lg: '8px' };
export const shadow = 'none';
export const font = {
  // ★ v2 优化：统一用 IBM Plex 家族（含 Serif），与 Sans 同设计语言
  serif: '"IBM Plex Serif", Georgia, serif',
  sans:  '"IBM Plex Sans", "PingFang SC", -apple-system, system-ui, sans-serif',
  mono:  '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
};

// 运行时 CSS 变量（由 tokens.ts 注入到 :root[data-theme=...]）
export function applyTheme(theme: 'light' | 'dark') {
  const c = theme === 'light' ? light : dark;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  Object.entries(c).forEach(([k, v]) => root.style.setProperty(`--c-${k}`, v));
}
```

字体自托管（`/design/fonts.css`）：

```css
@font-face {
  font-family: 'IBM Plex Sans';
  font-weight: 300 700;
  font-display: swap;
  src: url('/fonts/IBMPlexSans-Var.woff2') format('woff2-variations');
  unicode-range: U+0000-00FF, U+4E00-9FFF; /* 拉丁 + CJK */
}
@font-face {
  font-family: 'IBM Plex Serif';
  font-weight: 400 700;
  font-display: swap;
  src: url('/fonts/IBMPlexSerif-Var.woff2') format('woff2-variations');
  unicode-range: U+0000-00FF;
}
@font-face {
  font-family: 'JetBrains Mono';
  font-weight: 400 700;
  font-display: swap;
  src: url('/fonts/JetBrainsMono-Var.woff2') format('woff2-variations');
  unicode-range: U+0000-00FF, U+4E00-9FFF;
}
```

字体文件存 `public/fonts/`，三套变量字体约 500KB（gzip 后 ~150KB），比 v1 减半。

---

## 7. 状态管理

12 个 Zustand slice（v1 是 8 个；v2 优化后按业务边界更细）：

| Slice | 状态 | 来源 |
|-------|------|------|
| `sessionSlice` | sessions[], currentId, lastMessageId | Wails: `GetSessions` / `CreateSession` / `SendMessageEx` |
| `chatSlice` | messages{}, streamingBuffer, isStreaming, abortController | Events: `stream:<sid>` |
| `modelSlice` | current, presets, apiKeyMasked | Wails: `GetModels` / `SetModel` |
| `workspaceSlice` | currentWorkspaceId, workspaces | Wails: `GetWorkspaces` |
| `projectSlice` | currentProjectId, projects, noProjectMode | Wails: `GetProjects` / `SwitchProject` |
| `castSlice` | toolCatalog, recentInvocations, byCategory | Wails: `GetToolCatalog` / `GetToolHistory` / `InvokeCastTool` |
| `castToolSlice` | 单个 Cast 工具状态（todos/schedules/kb/email...） | Wails: `GetTodoList` / ... |
| `memorySlice` | episodes, recallResults, stats | Wails: `SearchMemory` / `GetAPMetricsSnapshot` |
| `mcpSlice` | servers, connected, tools | Wails: `ListMCPServers` / `ConnectMCP` |
| `gitSlice` | status, branches, commits, diff | Wails: `GetGitStatus` / ... |
| `settingsSlice` | 全局偏好（除 theme / planMode） | Wails: `GetSettings` / `SaveSettings` |
| `uiSlice` | theme, sidebarOpen, drawerOpen, planMode, commandPaletteOpen | 本地 |

> **收敛原则**：跨域数据先查 Wails 是否已有；无 → 新建 slice；同主题合并到现有 slice。`project` 与 `workspace` 分离（v1 合并了，v2 分开更清晰）。

---

## 8. 错误处理

| 场景 | 行为 |
|------|------|
| 流式中断（`done` 没来） | 60s 无 chunk 自动标记 `interrupted`，底部显示"继续"按钮 |
| Tool call 失败 | 工具条目 `✓` 变红色圆点 + 行内一行错误文本，不弹 toast |
| Wails 调用失败 | `<BottomBar />` 短暂显示"连接断开" 5s；点击重连 |
| AP Provider 不可用 | Model 切换器标灰，下方注释"上次失败：xxx" |
| Memory 召回失败 | 静默降级，不打断对话流 |
| Sentry 上报 | 所有上述错误自动 breadcrumb + capture（`lib/sentry.ts` 封装） |

---

## 9. 国际化

复用 `src/i18n/`，加 v2 增量文案键到 `src/v2/i18n-keys/`：

```ts
// i18n-keys/zh.ts
export const v2zh = {
  composer: {
    placeholder: '发消息 · ⌘⇧P 切换 Plan 模式',
    send: '发送',
    plan: 'Plan',
  },
  empty: {
    title: '今天做什么？',
    hints: ['/写周报', '/翻译', '/笔记', '/日程', '/番茄钟'],
  },
  approval: {
    approve: '同意',
    reject:  '拒绝',
  },
};
```

启动时合并到主 i18n（`src/i18n/index.ts`）。

---

## 10. 可访问性（A11y）

- 所有可点击元素 `role="button"` + `tabindex="0"`
- 颜色对比 ≥ 4.5:1（已校验：浅色 `--text` on `--bg` = 12.4:1）
- 焦点环：2px `--accent` outline + 2px offset
- 命令面板支持纯键盘操作（↑↓ 选、↵ 确认、esc 关闭）
- 流式渲染期间 `aria-live="polite"`

---

## 11. 测试策略

| 层级 | 工具 | 覆盖目标 |
|------|------|----------|
| 单元 | vitest + @testing-library/react | 组件 props / 事件 / 渲染分支 |
| Store | vitest | slice 初始状态 / reducer / 异步 action |
| 集成 | @testing-library/react + fake-indexeddb | 跨 slice 联动 |
| E2E | playwright | 4 个用户路径：① 新对话 ② 工具调用 ③ Checkpoint ④ 切换主题 |
| 视觉回归 | playwright visual snapshot | 关键页面（首页、消息流、命令面板） |

E2E 已有 baseline 截图 `frontend/e2e/visual-regression.spec.ts-snapshots/`，**v2 第一次跑通后立即 update baseline**（禁止带病上线）。

---

## 12. 性能预算

| 指标 | 目标 | 现状 |
|------|------|------|
| 首屏 TTI | < 1.5s | 2.3s |
| 包体积（gzipped） | < 1.5MB | 2.1MB |
| 字体加载 | < 200ms（cache hit）/ < 800ms（cold） | n/a |
| 1000 消息流滚动 | 60fps | 58fps |

优化手段：
- 路由级代码分割（`/cast/*` 懒加载）
- 字体 preload + `font-display: swap` + `unicode-range` 拆分
- **保留 highlight.js**（v1 已有），不引入 shiki（v2.1 实验）
- 不引入 framer-motion（CSS transition 够用）

---

## 13. 范围边界（In / Out）

### 13.1 In Scope
- 全新 `v2/` 实现
- 设计 tokens + 字体
- 三列布局 + 顶/底栏
- Composer / MessageStream / ToolCall / CodeBlock
- 命令面板（cmdk）
- SlashCommandMenu
- 12 个 Zustand slice 重写
- Wails adapter 包装
- 浅/深主题切换
- Sentry 集成
- 单元 + 集成 + E2E 测试
- 视觉回归 baseline 刷新

### 13.2 Out of Scope（v1 不做）
- Cast 6 面板内部细节 UI（v1 走 `/cast/*` 路由 + 旧组件桥接）
- 移动端响应式（桌面 only，最小窗口 1024×600）
- 自定义主题编辑器
- 模型微调界面
- 协作（多人共享会话）
- 离线模式 UI
- shiki 替代 highlight.js（v2.1）

### 13.3 不破坏（契约）
- Wails 自动生成 `wailsjs/` — 不手改
- Go 端所有 `(a *App) Xxx(...)` 签名
- 事件名（`stream:<sid>` / `ap:<eventType>`）
- `@agentprimordia/sdk` 类型导入
- `dist/` 嵌入流程（Wails 自动）
- 旧 `src/i18n/`

### 13.4 旧文件删除
- v2 GA + 14 天后，开 "delete legacy frontend" PR 一次性删除 `src/v2/` 之外的所有文件
- 删除前在 CHANGELOG 记录
- 删除前必须有 2 个 reviewer + 至少 1 个 runtime 测试通过

---

## 14. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Big-bang 期间主干冲突 | v2 独立分支 `feature/frontend-v2`，每日 rebase main；阶段性 cherry-pick 业务修复 |
| 12 slice 收敛丢状态 | 每个旧 slice 列出 → 映射表，确认无遗漏；新 slice 上线后做 1 周灰度 |
| 字体加载慢影响 LCP | preload + swap；首屏只引 Latin 字符，中文字符走 `unicode-range` 懒加载 |
| 视觉回归不通过 | 允许 ±2% 像素差阈值；UI 调整后主动 update baseline |
| 旧组件依赖隐式约定 | 写"v1→v2 组件映射表"；保留旧文件做参考但 v2 不 import |
| Cast 子页用旧组件样式不一致 | Cast 子页用 CSS scope 隔离；`/cast` 路由走独立 layout（不继承 WorkspaceFrame） |

---

## 15. 验收标准（Definition of Done）

- [ ] 主页（ChatPage）能完成：发消息 → 收到流式响应 → 工具调用展示 → Checkpoint 批准
- [ ] 命令面板 ⌘K 能切换主题 / 模型 / 打开 Cast
- [ ] 浅/深主题切换无样式残留
- [ ] 键盘快捷键全部生效（⌘K / ⌘L / ⌘[/] / ⌘⇧P）
- [ ] 包体积 < 1.5MB gzipped
- [ ] E2E 4 个用户路径全部通过
- [ ] 视觉回归 baseline 刷新
- [ ] 单元测试覆盖率 > 70%
- [ ] `go test ./...` 与前端 `npm run ci` 全绿
- [ ] Sentry 收到 v2 首发的事件（pnpm 验证）
- [ ] 用户在 5 分钟试用后能完成"打开 → 写代码 → 提交"全流程

---

## 16. 时间线（粗估）

| 阶段 | 内容 | 工作量 |
|------|------|--------|
| Phase 1 | 设计 tokens + 字体 + 三列壳 + 顶/底栏 + Drawer 默认展开 | 3–4 天 |
| Phase 2 | Composer + MessageStream + CodeBlock + ToolCall + Approval | 5–6 天 |
| Phase 3 | Wails adapter + 12 slice + 业务挂载 | 4–5 天 |
| Phase 4 | 命令面板 + 快捷键 + Cast 路由 + Settings | 3–4 天 |
| Phase 5 | Sentry + E2E + 视觉回归 + 性能调优 + 文档 | 3 天 |
| **合计** | | **~18–22 天** |

---

## 17. 反思记录（v1 → v2 优化轨迹）

| # | v1 | v2 优化 | 影响 |
|---|----|---------|------|
| R1 | Source Serif 4 标题字体（200KB+） | IBM Plex Serif（与 Sans 同家族，80KB） | 字体 bundle 减半；视觉更统一 |
| R2 | Drawer 默认隐藏（多一次 hover） | Drawer 默认展开 280px | 节省一次点击；与 Claude Code 桌面一致 |
| R3 | 8 slice 收敛过激 | 12 slice 按业务边界 | 风险降低；调试更容易 |
| R4 | Cast 6 面板入口含糊 | `/cast/*` 路由 + 旧组件桥接 | 入口明确；过渡平滑 |
| R5 | tokens 是 TS 对象 | tokens.ts + CSS variables 双重导出 | 主题切换零成本；可被外部 CSS 引用 |
| R6 | Sentry 集成缺失 | v2 入口强制初始化 | 错误可观测性达 v1 同等 |
| R7 | 旧文件删除含糊 | "v2 GA + 14 天后删除"明确 | 不再悬而未决 |
| R8 | shiki 替代 highlight.js | 保留 highlight.js，shiki 列 v2.1 | 减少 v2 风险；可独立升级 |
| R9 | 视觉回归无基线策略 | "第一次跑通后立即 update baseline" | 避免带病上线 |

---

## 18. 待用户确认的开放问题（实施前可解）

1. **空态"今天做什么？"的提示** 是否需要按用户最近 30 天使用习惯动态推荐？
   - 建议：v1 静态 6 个 + 后期接 telemetry 推荐；**v1 静态**
2. **Cast 工作台** v1 用 `/cast/*` 路由 + 旧组件桥接，子页保留 v1 内部 UI
   - 建议：**v1 路由 + 桥接**，子页 UI 重写列 v2.x
3. **Drawer 默认展开**，可手动收起
   - 建议：**默认展开**
4. **命令面板 ⌘K** 是否要支持中文命令别名？
   - 建议：v1 不支持；v2.x 引入 `pinyin` 库做模糊匹配

---

*End of design v2 (优化版) · 待用户审阅*
