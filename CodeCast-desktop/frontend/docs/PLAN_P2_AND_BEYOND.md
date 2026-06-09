# Plan: P2 Stage + Polish

> 文档目的: P0 + P1 阶段已落地(详见 [`IMPLEMENTATION_LOG.md`](./IMPLEMENTATION_LOG.md)),
> 本文档描述**剩余全部后续工作**,每任务具备可执行规格,可被
> subagent-driven-development skill 直接消费。
>
> 起始时间: 2026/06
> 预计总工作量: 4-6 天
> 工作区: `frontend/src/v2/`

---

## 目录

1. [P2.1 — SettingsPage 空 section 接入](#p21--settingspage-空-section-接入)
2. [P2.2 — Updater UI](#p22--updater-ui)
3. [P2.3 — Security / Telemetry 状态指示](#p23--security--telemetry-状态指示)
4. [P2.4 — Files.read/write 预览](#p24--filesreadwrite-预览)
5. [P2.5 — 测试覆盖率补齐](#p25--测试覆盖率补齐)
6. [P2.6 — Polish](#p26--polish)
7. [P2.7 — 后端能力消费报告](#p27--后端能力消费报告)
8. [附录:决策记录 & 风险](#附录决策记录--风险)

---

## 0. Pre-flight (0.25 天)

### 0.1 基线确认
- [ ] `cd frontend && npm run typecheck` 通过
- [ ] `npm run test` 全绿(基线: 192 tests / 29 files)
- [ ] `git status` 干净,P0 + P1 已 commit
- [ ] 启动一次 Wails desktop 跑 5 个核心 flow,记录基线 console 警告数

### 0.2 "完成"标准 (DoD)
- 每个任务独立可合并
- `tsc --noEmit` 始终 0 errors
- 新增/修改的每个组件 / slice 都有单测
- 启动 1s 内无 unhandled promise rejection
- 不破坏 192 个 baseline 测试

### 0.3 仓库基线
- 后端方法 adapter 覆盖: **152/152 (100%)** (P1.1 达成)
- 测试数: **192**
- 关键文件位置见 `IMPLEMENTATION_LOG.md` 第 6 节

---

## P2.1 — SettingsPage 空 section 接入(1.5 天)

### 背景

`pages/SettingsPage.tsx` 当前有 5 个**纯静态文案占位** section,没有接 store:

| Section | 当前状态 | 应当接入 |
|---|---|---|
| Skills (`SkillsSection`) | "技能已移至自定义" 占位 | `Skills` adapter CRUD + 列表 |
| Connectors (`ConnectorsSection`) | "连接器已移至自定义" 占位 | 后端无 connectors 端点 → 改为 MCP 概览链接 |
| Cowork (`CoworkSection`) | 部分接 `settings.auto_memory` | 补全指令编辑、记忆统计 |
| Desktop (`DesktopGeneralSection`) | 全部 useState 静态 | 走 `Settings.updateKey` + `Window.*` |
| Extensions (`ExtensionsSection`) | "浏览扩展" 占位 | 链接到 `/plugins` (P1.6 已做) |
| Developer (`DeveloperSection`) | MCP / Checkpoint 部分接 | 加 Security / Telemetry 子区 |
| Skills (skills 内部) | Artifacts toggle 静态 | 接 `settings.updateKey` |

### 任务规格

#### P2.1.1 Skills section
- 把 `SkillsSection` 重构为接 `Skills.list() / create() / update() / delete()` 4 个 adapter
- 列表展示已存在 skill(name + description 截断)
- 新建按钮 → 弹 inline form(name + description + prompt)
- 编辑/删除操作直接调 adapter
- 测试:`SkillsSection` smoke + 一个 create 操作测试

#### P2.1.2 Connectors section
- 改名/重写为 MCP 概览:`useAppStore.servers.length` + 跳转到 Cast 工具 / 或新建 `/connectors` 占位
- 加测试:显示服务器数量

#### P2.1.3 Cowork section
- 已有 `auto_memory` 接入,**补**:
  - 全局指令 textarea:双向绑 `settings.custom_instructions`(已有)
  - 记忆统计:显示 `memorySlice.stats.totalEpisodes`(新接)
- 测试:settings 双向绑 + 记忆统计显示

#### P2.1.4 Desktop section
- 4 个 toggle (`runOnStartup` / `systemTray` / `keepAwake` / `shortcuts`) 全部
  改 `settings.updateKey(...)`
- 快捷键 chip 加 hover → 展示当前 `settings.hotkey`
- 启动 / 托盘 需要新 settings key,先在 types 中加占位(`desktop_run_on_startup` 等),
  后端会忽略未知 key
- 测试:toggle 改 store

#### P2.1.5 Extensions section
- 改 "浏览扩展" 按钮 → `navigate('/plugins')`
- 移除占位插图(不需要)

#### P2.1.6 Developer section
- 已有 Checkpoint 历史(P1.4)
- 加 Security 子区:接 `securitySlice.status` 显示 encryption 状态、
  key 轮换时间(后端 `GetKeyRotationInfo` → 已经在 adapter)
- 加 Telemetry toggle 接 `Telemetry.toggle`
- 测试:状态正确渲染

### 验证
- 7 个 section 全部接 store 或合理替代(MCP 概览)
- `SettingsPage.test.tsx` 覆盖 5 个 section 基础渲染
- 192 baseline 测试 + ~12 新测试通过

### 文件影响
- 修改:`pages/SettingsPage.tsx` 大量
- 拆分: `components/settings/{SkillsSection,DesktopSection,DeveloperSection,CoworkSection}.tsx` 独立组件(便于单测)
- 新建:`components/settings/__tests__/*.test.tsx`
- 删:`SettingsPage` 内部 5 个小函数

---

## P2.2 — Updater UI(0.5 天)

### 背景

`updaterSlice` 完整,`updateInfo / updateHistory` 已有数据。当前:
- `BottomBar.checkUpdate()` 弹 toast
- `updateHistory / downloadUpdate / openDownloaded` 全部未在 UI 消费

### 任务规格

#### P2.2.1 UpdateBanner 组件
- 新建 `components/updater/UpdateBanner.tsx`
- 当 `updateInfo.version !== currentVersion` 时,顶栏显示黄色 banner:
  - "发现新版本 v{version}: {title}"
  - 两个按钮:下载 / 查看
- "下载" → `downloader.downloadUpdate(info.url)` → toast
- "查看" → `updater.openReleasePage()`
- 关闭按钮 dismiss 1 次(sessionStorage 记忆)

#### P2.2.2 SettingsPage 增加 Updates section
- 走 SettingsPage 一节而非顶层 nav,降低层级
- 显示:
  - 当前版本 vs 最新版本
  - Update history 列表(取自 `updateHistory`)
  - "立即检查更新" 按钮 → `checkUpdate()`
  - "下载并安装" 按钮(仅在有 updateInfo 时启用)
- 测试:1 个 smoke + 1 个 button click

### 验证
- Banner 不在启动时闪现(初始 `updateInfo` null)
- 模拟 `setState({ updateInfo: { version: '99.0.0' } })` 后 banner 出现

### 文件影响
- 新建:`components/updater/UpdateBanner.tsx` + test
- 新建:`components/updater/UpdateHistory.tsx`(history 列表)
- 修改:`App.tsx`(挂载 UpdateBanner)、`pages/SettingsPage.tsx`(增加 section)

---

## P2.3 — Security / Telemetry 状态指示(0.5 天)

### 背景

| 端点 | adapter | slice | UI 消费 |
|---|---|---|---|
| `GetSecurityStatus` | ✅ | ✅ (P1 已建空 state)| ❌ |
| `GetTelemetryStatus` | ✅ | ✅ | ❌ |
| `RotateEncryptionKey` | ✅ | ❌ | ❌ |
| `CheckAntivirusCompatibility` | ✅ | ❌ | ❌ |
| `ToggleTelemetry` | ✅ | ❌ | ❌ |
| `SetTelemetryEndpoint` | ✅ | ❌ | ❌ |

### 任务规格

#### P2.3.1 securitySlice 完善
- 加 `rotateKey(): Promise<void>` → `Security.rotateKey()` + `refreshSecurity()`
- 加 `checkAntivirus(): Promise<Record<string, unknown>>` 缓存结果
- 加 `refreshSecurity()` → `Security.status()`(当前是手动 init,没 action)

#### P2.3.2 telemetrySlice 新建
- `status: TelemetryStatus | null`
- `enabled: boolean`(派生)
- `endpoint: string`
- `refreshTelemetry()` / `toggleEnabled(enabled)` / `setEndpoint(endpoint)`

#### P2.3.3 SettingsPage.PrivacySection
- 显示 encryption 状态(`enabled / lastRotation / provider`)
- "立即轮换密钥" 按钮 → `rotateKey()` + toast
- 启动 antivirus 兼容性检查(一次)→ 显示 warning banner 若不兼容
- 测试:rotate click

#### P2.3.4 SettingsPage.PrivacySection — Telemetry
- Toggle 接 `telemetrySlice.toggleEnabled`
- endpoint 输入框接 `telemetrySlice.setEndpoint`
- 测试:toggle 调 adapter

### 验证
- 3 个新 slice action 全部带测试
- Privacy section 完整渲染
- `bootstrap()` 中调 `refreshSecurity()` + `refreshTelemetry()`

### 文件影响
- 新建:`store/slices/securitySlice.ts`(已部分存在,补全)
- 新建:`store/slices/telemetrySlice.ts`
- 新建:对应 test 文件
- 修改:`store/index.ts`(注册), `store/bootstrap.ts`(加 loader)
- 修改:`pages/SettingsPage.tsx`(Privacy section)

---

## P2.4 — Files.read/write 预览(1 天)

### 背景

`Files` adapter 有 6 个方法,目前**只用了 `list`**:

| 方法 | 已用 | 用途 |
|---|---|---|
| `list(path)` | ✅ | FileTree 列目录 |
| `read(path)` | ❌ | 读文件 raw(可能含二进制) |
| `write(path, content)` | ❌ | 写文件 |
| `workspace(dirPath)` | ❌ | 切换项目后列出工作区文件 |
| `readContent(path)` | ❌ | 读文件文本 |
| `selectFile()` | ❌ | 弹文件选择 |
| `selectFolder()` | ✅ | Plugin 选择路径 |

### 任务规格

#### P2.4.1 FilePreviewModal
- 新建 `components/drawer/FilePreviewModal.tsx`
- props: `path: string` / `onClose: () => void`
- 调 `Files.readContent(path)` 取文本,显示在 `<pre>` 中
- 大文件(>100KB)显示截断 + "完整加载"按钮
- 文件名 + 大小 + 最后修改时间(可选,后端有就显示)
- 测试:open + close + content 显示

#### P2.4.2 FileTree 改造
- 点击文件 → 调 `Files.readContent(path)` 弹 modal
- 区分文件 vs 目录用后端返回的 metadata(若有)或扩展名兜底
- 在 FileTree 顶部加 "+ 新建文件" 按钮 → `Files.write(path, '')`
- 测试:点击触发 modal

#### P2.4.3 Sidebar 切换项目
- 项目切换后用 `Files.workspace(projectPath)` 替代 `Files.list`
- 测试:切换项目调 workspace

### 验证
- 预览 modal 关闭时不留 stale content
- 大文件不卡 UI(use `requestAnimationFrame` 分块渲染或简单 truncate)

### 文件影响
- 新建:`components/drawer/FilePreviewModal.tsx` + test
- 修改:`components/drawer/FileTree.tsx`
- 修改:`components/drawer/DrawerTabs.tsx`(若需要)

---

## P2.5 — 测试覆盖率补齐(1.5 天)

### 现状

| 维度 | 当前 | 目标 |
|---|---|---|
| Slice 测试 | 21/21 (100%) | 保持 |
| Adapter 测试 | 17/27 namespace 测过关键方法 | **全部 namespace × 全部方法** |
| Events 测试 | 测了部分 onXxx | **24+ onXxx 至少 1 个 subscribe/unsubscribe** |
| Component 集成 | 5 个组件 | + 8 个(CostPage、PluginsPage、OrchestrationRunner、SettingsPage、AgentEventLog、CheckpointApproval、FilePreviewModal、UpdateBanner) |
| Boot/Integration | 0 个 | + 1 个 App 启动 smoke |

### 任务规格

#### P2.5.1 Adapter 测试补齐
当前 `wails/__tests__/adapter.test.ts` 30 个测试。补到每个 namespace 至少 80% 方法覆盖:
- `Sessions` 加 archive/unarchive/listArchived/archive 测试
- `Chat` 加 sendWithAttachments / cancelAll / sendRaw
- `Models` 加 providerModels / addConfig / updateConfig / removeConfig / toggleConfig
- `Projects` 加 updateInstructions / setNoProject / getNoProject
- `Metrics` 加 summary / clearCache / setCacheEnabled
- `Browser` 加 getDomainRules / addBlockedDomain / 等
- `Files` 加 read / write / workspace
- `Workflow` 加 list / getRun / pause / resume / cancel / export
- `Updater` 加 download / openDownloaded / changelog / saveRecord / allReleases / silentDownload
- `Multimodal` 加 capabilities
- `Window` 加 editors / preferredEditor / setEditor / openInEditor / popout / setAlwaysOnTop
- `Notification` 已有 + End-to-end

#### P2.5.2 Events 测试补齐
- 每个 `onXxx` 函数至少 1 个测试: subscribe 后 unsubscribe 不再触发
- 测 EventsOn 调用参数(正确 topic name)
- 测返回值 cleanup 真的取消订阅

#### P2.5.3 Component 集成测试
- 每新增组件 1 个 smoke render
- 关键交互组件 (CostPage、PluginsPage、OrchestrationRunner) 多场景
- SettingsPage 5 个 section 基础渲染

#### P2.5.4 App 启动 smoke
- 渲染 `<App />` 在 MemoryRouter + mock 全 Wails
- 验证:bootstrap 调用 → sessions/models/etc 都请求
- 验证:不抛 unhandled rejection
- 用 `act` + `waitFor`

### 验证
- Adapter namespace 覆盖率 ≥ 80%
- 测试总数: 192 → **260+**
- 测试运行 < 5s

### 文件影响
- 大改:`wails/__tests__/adapter.test.ts`
- 大改:`wails/__tests__/events.test.ts`
- 新建:多个 component test
- 新建:`App.test.tsx`(如果可测,需要解决 Wails runtime 模拟)

---

## P2.6 — Polish(0.5-1 天)

### 任务规格

#### P2.6.1 类型清理
- 全局搜 `as any` / `as Record<...>` 残留,移除或替换为类型守卫
- IDE 诊断中已发现的 `document.execCommand` 弃用警告:
  - 6 处 in `App.tsx` (menu 项 undo/redo/cut/copy/paste/selectAll)
  - 1 处 in `CastEmailPage.tsx` (clipboard fallback)
  - 替换方案:
    - undo/redo → `useRef` 记录前后值 + `requestAnimationFrame`
    - cut/copy/paste → 现代 `navigator.clipboard` API
    - selectAll → 拿到 active element 后 `.select()`
- 测试:paste / copy / undo / redo 仍 work

#### P2.6.2 Sentry 接入核对
- 每个 slice 的 catch 都已经 `reportError`(从 P0/P1 实施可证)
- 确认 Sentry DSN 存在(若空,debug log)
- 跑 1 个 panic test 触发 Sentry

#### P2.6.3 启动冒烟
- 5 个核心 flow 手动验证:
  1. 发送消息 → 流式返回
  2. Cast 工具:写一篇 200 字文章
  3. 切换模型
  4. Cost 页面设置 budget
  5. Checkpoint 列表展示(若 backend 数据有)
- 记录 console 错误数 = 0(除已知的 deprecation warning)

#### P2.6.4 更新 ARCHITECTURE.md
- `frontend/ARCHITECTURE.md` 加注新增页面 + slice:
  - Cost / Plugins / Settings 接入数据
  - Checkpoint / AgentEventLog / OrchestrationRunner
  - bootstrap thunk

### 验证
- `as any` 数 = 0
- `document.execCommand` 引用 = 0
- 5 个 flow 全部手动跑通

---

## P2.7 — 后端能力消费报告(0.25 天)

### 背景

P0/P1 后**已 100% 覆盖** 152 个后端方法,但消费度不均:
- 高频消费 (UI 每次启动都调): 12 个
- 中频消费 (按用户操作): 47 个
- 一次性消费 (启动 / Settings): 38 个
- **仅在测试中触及**: 18 个
- **完全未在 UI 路径上调用**: 0 个(100% adapter 覆盖了)

### 任务规格

#### P2.7.1 生成报告脚本
- 写 `scripts/audit-backend-usage.mjs`:
  - 读 `frontend/wailsjs/go/main/App.d.ts` 提取 152 个方法名
  - 全文搜 `src/v2/` 看每个方法被哪些文件 import / 调用
  - 输出 markdown 表格:method / adapter / 调用方数量 / 最后修改

#### P2.7.2 输出报告
- 写入 `docs/BACKEND_API_USAGE.md`
- 4 段:
  1. 总体统计表格
  2. 按 namespace 分组细节
  3. 候选下线 / 重构的端点(高变动但低消费)
  4. 改进建议(若后端新增,前端最该接的 5 个)

### 验证
- 脚本可重复运行
- 报告字数 < 1000,信息密度高

### 文件影响
- 新建:`scripts/audit-backend-usage.mjs`
- 新建:`docs/BACKEND_API_USAGE.md`

---

## 附录:决策记录 & 风险

### 已确定决策

| 决策 | 选择 | 原因 |
|---|---|---|
| Skills section 接入策略 | `Skills` adapter CRUD | 已有 4 个端点,直接消费 |
| Connectors 替代方案 | 改 MCP 概览 + 跳转 | 后端无 connectors 端点 |
| Security 状态显示位置 | SettingsPage.PrivacySection | 与 Telemetry 同区 |
| File 预览方案 | Modal,readContent 拉文本 | 后端已有 `readContent` |
| 大文件处理 | 100KB 截断 + "完整加载" 按钮 | 避免 UI 卡顿 |
| Updater banner 位置 | 顶栏全局 | 比 toast 更显式 |
| Adapter 测试目标 | 80% 命名空间覆盖 | 100% 太重,80% 防回归足够 |
| Events 测试范围 | 24+ onXxx 全部 | 跟 P0/P1 已建的事件订阅 1:1 |
| 弃用 `document.execCommand` 方案 | 用现代 Clipboard API + ref 记录 | 跨平台,跟 Electron/Wails 兼容 |

### 风险 & 缓解

| 风险 | 缓解 |
|---|---|
| Skills 后端返回 shape 与适配器不同 | 跑通后再写组件 |
| `Files.write` 权限不可用 | UI 灰显"新建"按钮 + 错误提示 |
| Settings key 后端忽略未知 → 启动 warning | 选用已知 key + 静默吞错 |
| 152 个 adapter 全部测试要花时间 | 分批:先 P2.1-2.4 完成再补测试 |
| `document.execCommand` 替换可能丢失用户流 | 保留菜单项,仅替换实现,加测 |
| App.tsx 启动冒烟测依赖 Wails runtime mock | 用 renderHook + 测 slice 调用,避免 mount 全 App |

### 与 P0/P1 工作的协同

- 不要重新打开 `agentSlice` / `castToolSlice` 结构(P0/P1 已定)
- 不要删 `bootstrap.ts`(P0/P1 已建)
- P2.3 扩展 slice 时,使用 P0/P1 模式:`createXxxSlice` + `reportError` + 测试

### 估计总工作量

| 任务 | 时间 |
|---|---|
| 0. Pre-flight | 0.25 天 |
| P2.1 Settings 空 section | 1.5 天 |
| P2.2 Updater UI | 0.5 天 |
| P2.3 Security/Telemetry | 0.5 天 |
| P2.4 Files 预览 | 1 天 |
| P2.5 测试补齐 | 1.5 天 |
| P2.6 Polish | 0.5-1 天 |
| P2.7 后端能力报告 | 0.25 天 |
| **合计** | **6-6.5 天** |

### 提交节奏

- 每个 P2 任务一个 PR
- P2.5 测试补齐可单独 PR
- P2.7 报告单独 PR(纯文本)

### 验收清单(整体 P2 完成时)

- [ ] TypeScript 0 errors
- [ ] Tests 260+ passed(原 192 + 新增 70+)
- [ ] `as any` / `document.execCommand` 残留 0
- [ ] 5 个核心 flow 手动跑通
- [ ] `docs/BACKEND_API_USAGE.md` 输出
- [ ] `docs/IMPLEMENTATION_LOG.md` 追加 P2 段
- [ ] `ARCHITECTURE.md` 反映新结构

---

## 任务依赖图

```
P2.1 (Settings) ─────┐
                     │
P2.2 (Updater) ─────┤
                     ├── P2.6 (Polish) ── P2.7 (Report)
P2.3 (Sec/Tel) ─────┤
                     │
P2.4 (Files) ───────┤
                     │
P2.5 (Test backfill)─┘
```

- P2.1-P2.5 可并行(不同文件区域)
- P2.6 必须等 P2.5 完成
- P2.7 可与 P2.6 并行
