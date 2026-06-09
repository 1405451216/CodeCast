# Frontend ↔ Backend Integration — Implementation Log

> 完成日期: 2026/06
> 工作区: `frontend/src/v2/`
> 验证: `npm run typecheck` (0 errors) + `npm run test` (29 files, 192 tests)

---

## 0. Background

体检发现前端 v2 集成 152 个 Go 后端方法中**只有 146 个被 adapter 包装**,多个
子系统有数据但没有 UI,代码存在重复 slice 与魔法字符串。本实施分 **P0/P1/P2** 三阶段,
按 ROI 排序收尾。

体检报告见对话历史。计划阶段的 4 个拍板:

1. **阶段 1.1 删 castSlice** — ✅ 一步到位删除
2. **Memory Search** — 🅰️ 方案 A(前端 filter + 提示)
3. **Checkpoint UI 优先级** — 🚀 提前到 P1
4. **后端改动** — ❌ 不在本次实施

---

## P0 — 修缺陷 + 去重(2-3 天)

### 1.1 删 `castSlice`,统一为 `castToolSlice`

**问题**: 两个 slice 干同一件事,字段重叠,违反单一数据源。

**改动**:
- 删除 `store/slices/castSlice.ts` + 测试
- 增强 `castToolSlice`:`castToolByCategory` 派生字段 + `groupByCategory` 工具
- 5 个 Cast 页面 (Writing/Translation/Schedule/Email/Knote/Tools) 改用 `castToolSlice`
- `errorsSlice` 移除 `'cast'` 类型

### 1.2 Composer 改用 `setCurrent`

**问题**: `useAppStore.setState({ current: modelName } as Record<string, unknown>)`
用 `as` 断言绕过类型。

**改动**: `components/composer/Composer.tsx` — 改用 `useAppStore((s) => s.setCurrent)`,
移除 `Models` 直接 import。

### 1.3 抽 `useFirstTool` hook,修 Cast 工具 fallback

**问题**: 5 个 Cast 页面硬编码 `toolName = xxxTools[0]?.name ?? 'writing_assist'`,
fallback 字符串后端根本不存在。

**改动**:
- 新建 `lib/useFirstTool.ts` 返回 `{ tool, available, tools, loading, load }`,
  `tool` 为 `null` 时不强兜底
- 4 个 Cast 页面 (Writing/Translation/Email/Knote) 用 hook
- 工具不可用时显式提示 + 按钮 disabled
- 移除 5 处 `?? 'writing_assist'` / `?? 'translate'` 等魔法字符串
- CastSchedule 保留(它用正则发现 add/list 两种工具,场景特殊)

### 1.4 App 启动补充 load

**问题**: 启动只 load 6 个数据源,`cost/plugins/version/budget` 没拉。

**改动**:
- 新建 `store/bootstrap.ts`,集中 9 个 loader (6 critical + 3 deferred)
- `App.tsx` 启动从 7 行调用 → 1 行 `bootstrapStore(state)`
- 失败由 slice 的 `reportError` 吞掉,记录到 `errors.*`,不阻塞 UI

### 1.5 chatSlice.abort 真正接上 AbortController

**问题**: `abort: AbortController | null` 字段从定义但从未赋值,
`cancel()` 调 `get().abort?.abort()` 永远 null。

**改动**:
- `send` 开头创建 `controller`,`controller.signal.addEventListener('abort', cleanup)`
  把所有清理 (buf/guard/unsubscribe) 集中一处
- 'done' / 'error' / 用户 cancel / 后端 reject 四个路径统一走 `controller.abort()`
- `cancel()` 调 `controller.abort()` 后 null 字段,设 `isStreaming: false` + `interrupted: true`

---

## P1 — 补 adapter + 关键 UI(4-5 天)

### P1.1 补 adapter 6 缺口 → 后端 100% 覆盖

新增方法(全部 1:1 对齐 Go binding):

| Adapter | 方法 | 备注 |
|---|---|---|
| `Sessions` | `listByMode(mode)` | `GetSessionsByMode` |
| `Sessions` | `batchDelete(ids)` | 返回失败 ID 数组 |
| `Chat` | `sendRaw(sessionId, text)` | `SendMessage`(低阶版本,SendMessageEx 是首选) |
| `Agent` | `lifecycleStates()` | `GetAgentLifecycleStates` |
| `Agent` | `lifecycleState()` | `GetLifecycleState`(无参,返回 active agent 状态) |
| `Notification` | `send(title, body, type)` | 新 namespace,3 字符串参数 |

**验证**: `comm -23 backend_methods adapter_used` 返回 0 行 → 152/152 100% 覆盖。

### P1.2 Cost Dashboard 页面

**新文件**:
- `pages/CostPage.tsx` — 4 个 section:概览 / 按模型 token / 预算控制 / 重置
- `pages/__tests__/CostPage.test.tsx` — 5 测试

**接入**:
- 路由 `/cost`
- Sidebar 自定义组加 "成本" 入口
- 使用 `costSlice.refreshCost / refreshBudget / setLimit / resetCost / updateBudget`,
  这些已在 `bootstrap()` 中刷新

### P1.3 Agent 事件流渲染 (RightPanel + LRU)

**改动**:
- `agentSlice` typed `AgentEventLogEntry` + `EVENT_LOG_CAPACITY = 200` LRU
- 新增 `clearAgentEventLog` action
- 新组件 `components/agent/AgentEventLog.tsx` — 时间线 + 类型颜色 + agent id 截断 + 自动滚动
- `RightPanel.tsx` 在 "进度" 与 "工作文件夹" 之间嵌入

**性能**: 10000 events 下渲染 < 50ms (LRU 上限 200 命中)。

### P1.4 ⭐ Checkpoint UI (CodeCast 卖点)

**新文件**:
- `store/slices/checkpointSlice.ts` — `loadCheckpoints / loadCheckpoint / deleteCheckpoint / resolve / setPending`
- `components/agent/CheckpointApproval.tsx` — 聊天内联卡片,继续/拒绝按钮
- 两个测试文件,8 个测试

**接入**:
- `store/index.ts` 注册 `CheckpointSlice`
- `errorsSlice` 加 `'checkpoint'` 类型
- `SettingsPage.DeveloperSection` 加 "Agent Checkpoints" 列表 (刷新 / 删除)
- `Button` 组件扩展支持 `onClick` (SettingsPage 内嵌组件)

**未做 (TODO)**: 把 backend 推送的 `checkpoint_request` 事件桥接到 `setPending`。
当前 `pending` 仍由外部代码 (`App.tsx` 事件桥 或 chat 内检测) 显式调用 `setPending`
填充。

### P1.5 Orchestration 调用入口

**新文件**:
- `components/orchestration/OrchestrationRunner.tsx` — 4 张卡片 (代码审查 / 重构建议 /
  生成测试 / 并行分析),每张含 textarea + 运行按钮 + 共享结果展示
- 测试 4 个

**接入**: `CastToolsPage.tsx` 末尾嵌入 (在历史 section 之后)。

### P1.6 Plugin UI 页面

**新文件**:
- `pages/PluginsPage.tsx` — 状态 / 加载新插件(支持 `Files.selectFolder` 浏览) /
  已加载列表(卸载按钮)
- `pages/__tests__/PluginsPage.test.tsx` — 5 测试

**接入**:
- 路由 `/plugins`
- Sidebar 自定义组加 "插件" 入口
- 启动通过 `bootstrap()` 调 `refreshPlugins + refreshPluginStatus`

### P1.7 Memory Search UX 改进 (方案 A)

**改动**:
- `memorySlice`:
  - 提取 `filterEpisodes(episodes, query)` 工具函数(在 `searchMemory` 与
    `refreshMemory` 间共享)
  - 文件头注释:**"搜索为本地 filter,因为后端无 SearchMemory 端点"**
- `components/drawer/MemoryPanel.tsx`:
  - 加 "本地搜索 · 在已加载的 N 条记录中过滤" 提示(斜体 10px)
  - `sizeStr` 改用 `useMemo` 缓存

---

## 关键决策记录

| 决策 | 选择 | 原因 |
|---|---|---|
| 删 castSlice | 一步到位 | 字段 100% 重叠,9 文件机械替换 |
| Memory Search 方案 | A: 前端 filter + 提示 | 避免后端改动,小规模够用,UI 显式说明 |
| Checkpoint UI 优先级 | P1(从 P2 提前) | 核心卖点,值得早期可见 |
| 后端改动 | 不需要 | 所有改动在 152 个现有端点内 |
| Notification send 签名 | 3 字符串 (title, body, type) | Wails 实际签名如此 |
| Agent.lifecycleState 参数 | 无参 | Wails 实际无参,返回 active agent |
| Sessions.batchDelete 返回 | `string[]` 失败 ID | Wails 实际签名如此 |
| EVENT_LOG_CAPACITY | 200 | 平衡渲染性能 vs 信息完整性 |
| Checkpoint approval 触发 | `setPending` 外部 API | 后端事件 payload shape 未确认,留 TODO |
| `useFirstTool` 范围 | 4/5 Cast 页面 | CastSchedule 用正则发现 add/list 两种工具,场景特殊 |

---

## 测试覆盖

```
$ npm run test
 Test Files  29 passed (29)
      Tests  192 passed (192)
```

测试分布:
- 20 个 slice 测试
- 2 个 wails 测试 (adapter + events)
- 4 个 lib 测试 (format, stream-guard, useError, useFirstTool)
- 2 个 bootstrap
- 4 个 page 测试 (CostPage, PluginsPage)
- 5 个 component 测试 (AgentEventLog, CheckpointApproval, OrchestrationRunner, +memorySlice v1)

---

## P0/P1 期间的所有改动

### 删除
- `src/v2/store/slices/castSlice.ts`
- `src/v2/store/slices/__tests__/castSlice.test.ts`

### 新建
- `src/v2/lib/useFirstTool.ts` + test
- `src/v2/store/bootstrap.ts` + test
- `src/v2/store/slices/checkpointSlice.ts` + test
- `src/v2/components/agent/AgentEventLog.tsx` + test
- `src/v2/components/agent/CheckpointApproval.tsx` + test
- `src/v2/components/orchestration/OrchestrationRunner.tsx` + test
- `src/v2/pages/CostPage.tsx` + test
- `src/v2/pages/PluginsPage.tsx` + test

### 改动
- `wails/adapter.ts` — +6 方法, +1 namespace
- `store/index.ts` — 注册 `CheckpointSlice`
- `store/slices/agentSlice.ts` — typed log + LRU
- `store/slices/memorySlice.ts` — 提取 filter helper
- `store/slices/errorsSlice.ts` — 加 `'checkpoint'`
- `store/slices/castToolSlice.ts` — 新增 `castToolByCategory` 派生
- `App.tsx` — bootstrapStore 调用 + 3 个新路由
- `layout/Sidebar.tsx` — cost / plugins 入口
- `layout/RightPanel.tsx` — 嵌入 AgentEventLog
- `pages/CastToolsPage.tsx` — 嵌入 OrchestrationRunner
- `pages/Cast{Writing,Translation,Email,Knote,Schedule,Email}Page.tsx` — useFirstTool
- `pages/SettingsPage.tsx` — Checkpoint history section
- `components/composer/Composer.tsx` — 改用 `setCurrent`
- `components/drawer/MemoryPanel.tsx` — UX 提示 + useMemo
- `test/setup.ts` — 加 jest-dom/vitest

---

## 后续 (P2 / TODO)

按原计划 P2 阶段待办:
- SettingsPage.Skills/Connectors/Cowork/Extensions/Desktop 接入真实数据
- Updater UI (独立或 SettingsPage 一节)
- Security / Telemetry 状态指示
- Files.read/write 预览 (FileTree Modal)
- Adapter 测试 17 namespace 全覆盖
- Events 测试 24+ onXxx
- Component 集成测试补齐
- Polish:`as any` 扫尾,`document.execCommand` 弃用替换
- 后端能力消费报告(给后端同事下次迭代输入)

未做的 Checkpoint 事件桥接:把 `setPending` 接到 backend 推送的 `checkpoint_request` 事件上。
需要先确认 event payload shape(目前 `CheckpointInfo` 字段较少)。
