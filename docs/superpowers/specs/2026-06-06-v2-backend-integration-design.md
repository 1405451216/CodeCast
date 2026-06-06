# v2 Frontend ↔ Backend Integration · 设计文档 (v2 · 反思优化版)

> **Status**: v2 (反思优化版，源自 v1 自我反思 17 项优化)
> **Date**: 2026-06-06
> **Author**: Claude (writing-plans + brainstorming 流程)
> **Supersedes**: [2026-06-06-v2-backend-integration-design.md (v1)](./2026-06-06-v2-backend-integration-design.md)
> **Scope**: `CodeCast-desktop/frontend/src/v2/` 12-slice Zustand 状态层与 Go 端 Wails 桥接的集成补全
> **Goal**: 在不破坏 v2 已搭好骨架、不重构 v2 视觉、不重写 store 的前提下，把现有 slice 与 Wails adapter / 事件流 / 后端类型对齐到能 `npm run dev` 跑通、`npm run typecheck` 全绿、空状态发消息能流式返回。

---

## 反思：v1 → v2 优化清单（17 项已应用）

| # | v1 缺陷 | v2 修复 |
|---|---------|---------|
| **O1** | `lastError` 全局共享，多 slice 互相覆盖 | **per-slice 错误字典** `errors: Record<SliceName, string \| null>` |
| **O2** | error 路径同时 `set` + `throw`，双消费 | **二选一：仅 set 状态不 throw** |
| **O3** | lastError 字段位置未定义 | 明确为全局 `errors` 字典 + `useError(slice)` hook |
| **O4** | `clearError` 方法未定义 | `useError()` hook 自带消费即清，并发去重 |
| **O5** | 测试缺 mock 基础设施 | Task 1.1 先建 `wails/__mocks__/App.ts` + vitest setup |
| **O6** | `String(e)` 取 Wails 错误得 `"[object Object]"` | `formatWailsError(unknown): string` 工具 |
| **O7** | workspaceSlice 是死代码（v2 没人 import） | **删除 workspaceSlice**，projectSlice 兼做 |
| **O8** | commit 粒度太细（17 个） | 合并为 8 个语义 commit |
| **O9** | chat 路径未文档化"调用"vs"接收流" | state machine: idle → streaming → done/error/interrupted |
| **O10** | dev 模式 GetSettings 怎么 mock 没说明 | vitest + dev server 用同一份 `wails/__mocks__/App.ts` |
| **O11** | Composer 是否 controlled 未查 | Task 0.1 先做只读探查 |
| **O12** | Settings 60 字段手写漂移 | 写注释 + 占位脚本（v1 不实施 codegen） |
| **O13** | `Git.status` 用 `as` 强转 map 是类型谎言 | `parseGitStatus(unknown): GitStatus` 守卫 |
| **O14** | MCPServer status 字段未核对 | 探查后定 interface（Plan 阶段补） |
| **O15** | 无回滚顺序 | 固定顺序：types → adapter → slice 改写 → 组件订阅 → 测试 |
| **O16** | stream-guard 复位时机未明示 | 在 plan chat task 加代码注释 + 测试 |
| **O17** | useEffect 双跑导致重复 toast | `useError` 用 `useRef` 标记已消费 |

---

## 1. 背景与动机

### 1.1 现状（探查结论）
- v2 12 个 slice 全部建在 `frontend/src/v2/store/slices/`，多数已 import adapter。
- `wails/adapter.ts` 暴露 6 个命名空间（`Sessions/Chat/Models/Cast/Projects/Metrics/Settings`），共 18 个方法。
- wailsjs 绑定（`wailsjs/go/main/App.d.ts`）声明 23 个 method export。
- **adapter 调用 ↔ Go 方法** 全部对得上。
- **8 类缺口**（G1–G8，见 v1 §1.1）

### 1.2 目标
跑通 v2 dev 首屏、补齐 8 类缺口、不重写视觉、不重写后端，2–3 天可完。

### 1.3 非目标
- 不新增 wailsjs method
- 不引入 TanStack Query / SWR
- 不动 v2 视觉/layout/页面
- 不动 Go 端代码
- 不动 Sentry / hotkeys / theme

---

## 2. 设计原则

| 原则 | 落地手段 |
|------|----------|
| **adapter 单一入口** | 所有 slice 必须经 `wails/adapter.ts`，禁止 `import * as App from '@wailsjs/...'` |
| **静态 import** | 删所有 `await import('../../wails/adapter')` |
| **per-slice 错误字典** | 全局 `errors: Record<SliceName, string \| null>`，无互相覆盖 |
| **`useError` hook 消费** | 组件订阅后调 toast，ref 防双跑，消费即清 |
| **错误不 throw** | 仅 `set state`，由 UI 决定呈现 |
| **类型守卫** | 不强转 map/unknown；`parseXxx(unknown): Xxx` 守门 |
| **mock 单一来源** | vitest + dev 模式（vite alias）共用 `wails/__mocks__/App.ts` |
| **chat state machine 文档化** | `idle → streaming → (done \| error \| interrupted)` |
| **零破坏性** | slice 公开方法签名保持；只补内部实现 |
| **8 commit 上限** | 语义单元而非文件粒度 |

---

## 3. 总体架构

### 3.1 全局错误流（per-slice）

```ts
// store/errorsSlice.ts (新增)
export type SliceName = 'session' | 'chat' | 'model' | 'workspace' | 'project'
  | 'cast' | 'castTool' | 'memory' | 'mcp' | 'git' | 'settings' | 'ui';

export interface ErrorsSlice {
  errors: Partial<Record<SliceName, string>>;
  setError: (slice: SliceName, msg: string) => void;
  clearError: (slice: SliceName) => void;
}

// lib/useError.ts (新增)
export function useError(slice: SliceName) {
  const msg = useAppStore(s => s.errors[slice]);
  const clearError = useAppStore(s => s.clearError);
  const toast = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (msg && !shown.current) {
      toast.show(msg, 'error');
      shown.current = true;
      clearError(slice);
    }
    if (!msg) shown.current = false;
  }, [msg, slice, clearError, toast]);
  return msg;
}
```

### 3.2 chatSlice state machine

```
            send()               1st chunk
   idle ───────────► streaming ──────────► streaming (accumulating)
     ▲                  │                        │
     │                  │ 'done'                 │ 'error'
     │                  ▼                        ▼
   done ◄────────── done                  error (lastError)
     ▲                  │                        │
     │                  │ timeout                │ retry
     │                  ▼                        ▼
     │           interrupted              (call send again)
     │
     └────────── user cancel ◄────── cancel()
```

`resume(sessionId)`：仅当 `interrupted === true` 且最后一条为 user 消息时，调 `send` 重发。

### 3.3 adapter 收口

`wails/adapter.ts` 新增 2 个命名空间 + 收紧 Settings：

```ts
export const MCP = {
  list:      () => App.ListMCPServers(),
  connect:   (name: string) => App.ConnectMCP(name),
  disconnect:(name: string) => App.DisconnectMCP(name),
};
export const Git = {
  status:   () => App.GetGitStatus(),                              // → parseGitStatus
  branches: () => App.GetGitBranches(),
};
```

`Settings.get/save` 改用 `wails/types.ts:Settings` 强类型。

### 3.4 类型守卫

`wails/guards.ts` (新增)：
```ts
export function formatWailsError(e: unknown): string {
  if (!e) return 'unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.data === 'string') return obj.data;
    try { return JSON.stringify(e); } catch { return 'unserializable error'; }
  }
  return String(e);
}

export function parseGitStatus(raw: unknown): GitStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    branch:  typeof r.branch === 'string' ? r.branch : '',
    ahead:   typeof r.ahead  === 'number' ? r.ahead  : 0,
    behind:  typeof r.behind === 'number' ? r.behind : 0,
    dirty:   typeof r.dirty  === 'number' ? r.dirty  : 0,
  };
}
```

---

## 4. 组件 / 文件变更清单（17 文件 → 8 commit）

### 4.1 必改文件（按 commit 分组）

| Commit | 路径 | 改动 |
|--------|------|------|
| **C1 infra** | `frontend/src/v2/wails/__mocks__/App.ts` (新) | Wails App mock（vitest + vite alias 共用） |
| | `frontend/src/v2/lib/format.ts` (新) | `formatWailsError` |
| | `frontend/src/v2/wails/guards.ts` (新) | `parseGitStatus` 等 |
| | `frontend/vitest.config.ts` | 加 `resolve.alias['@wailsjs/runtime/runtime']` 等 |
| | `frontend/src/v2/test/setup.ts` (新) | `vi.mock('@wailsjs/go/main/App', () => AppMock)` |
| **C2 types** | `frontend/src/v2/wails/types.ts` | 加 `Settings`, `GitStatus`, `MCPServerStatus` |
| **C3 adapter** | `frontend/src/v2/wails/adapter.ts` | 加 `MCP`, `Git` 命名空间；`Settings` 强类型 |
| **C4 errors** | `frontend/src/v2/store/slices/errorsSlice.ts` (新) | per-slice 错误字典 |
| | `frontend/src/v2/store/index.ts` | 合并 errorsSlice |
| | `frontend/src/v2/lib/useError.ts` (新) | `useError(slice)` hook |
| **C5 slices** | `frontend/src/v2/store/slices/mcpSlice.ts` | 改用 `MCP.*` + setError |
| | `frontend/src/v2/store/slices/gitSlice.ts` | 改用 `Git.*` + parseGitStatus + setError |
| | `frontend/src/v2/store/slices/workspaceSlice.ts` | **删除**（O7 决策反转） |
| | `frontend/src/v2/store/slices/memorySlice.ts` | 改顶层 import + setError |
| | `frontend/src/v2/store/slices/sessionSlice.ts` | 加 loading + setError |
| | `frontend/src/v2/store/slices/chatSlice.ts` | 改 `throw`→不 throw；`resume` 限定条件；加 setError |
| | `frontend/src/v2/store/slices/castSlice.ts` | 加 loading + setError |
| | `frontend/src/v2/store/slices/projectSlice.ts` | 加 loading + setError（兼做 workspace） |
| | `frontend/src/v2/store/slices/modelSlice.ts` | 加 loading + setError |
| | `frontend/src/v2/store/slices/settingsSlice.ts` | `Settings \| null` 强类型；save 强类型 |
| | `frontend/src/v2/store/slices/castToolSlice.ts` | 加 TODO 注释 |
| **C6 components** | `frontend/src/v2/layout/Sidebar.tsx` | `useError('session')`, `useError('project')` |
| | `frontend/src/v2/layout/TopBar.tsx` | `useError('model')` |
| | `frontend/src/v2/pages/SettingsPage.tsx` | 强类型 `Settings` 渲染 |
| | `frontend/src/v2/pages/ChatPage.tsx` | `useError('chat')`；resume 按钮 |
| | `frontend/src/v2/components/composer/Composer.tsx` | send 失败保留文案（O11 探查后） |
| | `frontend/src/v2/components/drawer/MCPPanel.tsx` | `useError('mcp')` |
| | `frontend/src/v2/components/drawer/GitPanel.tsx` | `useError('git')` |
| | `frontend/src/v2/components/drawer/MemoryPanel.tsx` | `useError('memory')` |
| **C7 tests** | `frontend/src/v2/store/slices/__tests__/sessionSlice.test.ts` | load/switch/delete |
| | `frontend/src/v2/store/slices/__tests__/chatSlice.test.ts` | send/done/error/resume |
| | `frontend/src/v2/store/slices/__tests__/settingsSlice.test.ts` | save 后更新 |
| | `frontend/src/v2/wails/__tests__/adapter.test.ts` | MCP/Git/Settings 命名空间 |
| | `frontend/src/v2/lib/__tests__/stream-guard.test.ts` | 60s 超时 |
| | `frontend/src/v2/lib/__tests__/format.test.ts` | formatWailsError 各种入参 |
| **C8 verify** | （无代码） | `npm run typecheck && npm run lint && npm run test && npm run dev` |

### 4.2 不动文件
- `frontend/src/v2/design/*`
- `frontend/src/v2/layout/TopBar/BottomBar/WorkspaceFrame`（除非需订阅错误）
- 所有 pages（除 Settings/Chat）
- 所有 primitives / menu / command / drawer 组件（除 MCPPanel/GitPanel/MemoryPanel）
- 后端 Go 代码

---

## 5. 关键设计决策

### 5.1 错误流（per-slice，**不 throw**）

```ts
} catch (e) {
  set({ loading: false });
  useAppStore.getState().setError('session', formatWailsError(e));
  // 注意：不再 throw
}
```

`useError(slice)` 自动 toast 并清空，**不会**被其他 slice 的错误覆盖。

### 5.2 chatSlice 错误与 resume
- `send` 失败：仅 `set({ isStreaming: false })` + `setError('chat', ...)`，**不 throw**。
- `cancel(sessionId)`：abort + Chat.cancel + `set({ isStreaming: false, interrupted: true })`。
- `resume(sessionId)`：仅当 `interrupted === true && lastMessage?.role === 'user'` 才调 `send` 重发；否则 no-op。

stream-guard 复位时机（O16）：
```ts
buf.onFlush = (chunk) => {
  set(...append chunk);
  guard.reset();          // 每次 flush 复位空闲计时
};
guard.start();            // 在 EventsOn 之后、Chat.send 之前
```

### 5.3 Settings 类型（手写对齐 Go）
同 v1 §5.3，**新增** `MCPServer`/`ModelConfigItem`/`EnvVar`/`SlashCommand` 至少 v1 的 minimal interface（v1 plan 阶段先按 Go 端 `[]MCPServer` 字段定，避免 any）。

### 5.4 workspaceSlice 处理
**删除** `frontend/src/v2/store/slices/workspaceSlice.ts` 与 `store/index.ts` 中的 import。Sidebar/TopBar 改读 `projectSlice`。`Workspace` interface 移到 `types.ts` 仍保留 type alias（`type Workspace = Project`）以备未来 workspace ≠ project 时再恢复。

### 5.5 castToolSlice
加 TODO 注释，**不在 v1 实施**。

### 5.6 测试策略
- 6 个新测试文件（见 C7）
- vitest setup 全局 mock `@wailsjs/go/main/App`
- **E2E 不在 v1 范围**

### 5.7 commit 粒度（8 commit）
C1 infra → C2 types → C3 adapter → C4 errors → C5 slices → C6 components → C7 tests → C8 verify

每个 commit 都应能 `npm run typecheck` 通过（除 C5/C6 中段），CI 可独立跑。

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 类型与 Go 不一致漂移 | Settings 手写，附注释；v1 spec 提议 codegen（O12） |
| `EventsOn/EventsOff` 泄漏 | chatSlice 已 unsubscribe；继续保留；测试覆盖 |
| Wails 错误格式 | `formatWailsError` 工具 + 单元测试 |
| `useError` 双跑 toast | `useRef` 标记已消费 + `useEffect` 依赖 `msg`（O17） |
| workspaceSlice 误删 | git grep 确认无人引用后删（plan Task 5.3） |
| Git.status 强转 map | `parseGitStatus` 守卫 + 单测 |
| StrictMode 下 effect 双跑 | `useRef` 防重 |
| 旧 `src/` 残留 | v2 内无 `../api` 引用（已确认） |
| wailsjs `App.d.ts` 是 M 状态 | v1 不重生成；commit 不含 wailsjs 改动 |

---

## 7. 范围外 / 后续
- 收紧嵌套类型（v2 spec）
- `wails generate module` CI 校验（v2 spec）
- TanStack Query（v3 spec）
- E2E 视觉回归
- Settings codegen 脚本

---

## 8. 验收 DoD

1. `cd CodeCast-desktop/frontend && npm run typecheck` 0 error
2. `npm run lint` 0 error
3. `npm run test` 全绿（6 个新测试 + 已有）
4. `npm run dev` 浏览器开 `http://localhost:5173`，WorkspaceFrame 渲染
5. 切到 Settings 页，**用 mock data** 看到 Settings 表单（dev 模式 vite alias）
6. 切到 Chat，发送消息 → mock 模拟 stream chunks 看到 user+assistant 消息
7. 强制造错（如 mock `App.ListMCPServers` 抛）→ toast 显示
8. 切到 MCP Drawer → 触发 connect 失败 → toast 显示且不阻塞其他 slice
9. workspaceSlice 文件已删除
10. git log 看到 8 个语义 commit
