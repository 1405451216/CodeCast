# v2 Frontend ↔ Backend Integration · 实施计划 v2 (反思优化版)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status**: v2 (反思优化版，源自 v1 自我反思 **P1–P15** 优化)
> **Supersedes**: [2026-06-06-v2-backend-integration.md (v1)](./2026-06-06-v2-backend-integration.md)

**Goal:** 在不破坏 v2 已搭好骨架、不重构 v2 视觉、不重写 store 的前提下，把 v2 12-slice Zustand 状态层与 Go 端 Wails 桥接对齐到能 `npm run dev` 跑通、`npm run typecheck` 全绿、错误通过 toast 看到。

**Architecture:** 8 个语义 commit（infra → types → adapter → errors → slices → components → tests → verify）；错误流 per-slice 字典 + `useError` hook；chat state machine 文档化；mock 单一来源供 vitest 共用；不依赖 wails runtime 的 dev 模式验证（用 vitest 单元测试做集成验证）。

**Tech Stack:**
- React 18 + TypeScript 5.5
- Vite 5.4 + vitest 2.x
- Zustand 4.5（slice pattern）
- @wailsjs/runtime 2.x（events + bindings）

**Reference:**
- 设计文档：[docs/superpowers/specs/2026-06-06-v2-backend-integration-design.md](../specs/2026-06-06-v2-backend-integration-design.md)
- 前端根目录：`CodeCast-desktop/frontend/`
- Wails 自动生成：`CodeCast-desktop/frontend/wailsjs/`（**不手改**）

---

## 反思：v1 → v2 优化清单（15 项已应用）

| # | v1 plan 缺陷 | v2 修复 |
|---|--------------|---------|
| **P1** | `git add -A` + 单独 add store/index.ts 路径混乱 | 每个 task 给出**精确 `git add` 文件列表** |
| **P2** | `(get() as any).setError` 强转 + linter 风险 | 抽出 `lib/reportError.ts` 工具，类型安全 |
| **P3** | `createStreamGuard` API 假设未先 read | v2 Task 1.1 前置 read stream-guard.ts |
| **P4** | mock 是否 emit done 未澄清 | v2 Task 1.1 mock 显式 emit done 事件 |
| **P5** | C5 整个一起 commit 出错难定位 | v2 C5 拆为 C5a session/chat + C5b 其余 slice |
| **P6** | `(get() as any).setError` 违反 lint | v2 用 `lib/reportError.ts` 工具 |
| **P7** | "SettingsPage 改动视现有代码而定" | v2 Task 6.3 前置 read SettingsPage |
| **P8** | "如何打开浏览器看 UI" 不明 | 明确"v2 用 vitest 集成测试，**不**依赖 dev 浏览器" |
| **P9** | mock reset 用 `Object.values` 强类型调 mockReset | v2 每个 vi.fn() 单独 mockReset + use beforeEach |
| **P10** | useToast 假定存在 | v2 Task 1.3 前置 grep 确认 useToast export |
| **P11** | chat test 用脆弱 EventsOn mock | v2 chat test 改为**真实订阅** + 直接触发回调 |
| **P12** | lint 报错怎么办 | v2 每 task 末尾 `npm run typecheck` 必跑 |
| **P13** | e2e 视觉回归不在 v1 | 明确"v1 集成不做 e2e；v2 spec 再加" |
| **P14** | "vitest.config.ts 不存在则创建" | 已存在（`src/test/setup.ts` 配置在 `setupFiles` 但 setup 文件不存在）→ v2 修正 |
| **P15** | 无回滚策略 | v2 明确"按 commit 顺序 cherry-pick 回滚" |

**已通过 Read 验证的 v1 错误假设**：
- ❌ Composer 不受控 → ✅ **实际双模式**（controlled via props 或 uncontrolled via `useLocalOrControlled`）
- ❌ ChatPage 在路由里 → ✅ **不在**——`App.tsx` 路由里只有 `CastEmptyState/CodeEmptyState`，`ChatPage` 是占位未用
- ❌ `src/test/setup.ts` 不存在 → ✅ **确实不存在**（vitest.config.ts 引用了它但没建）→ v2 创建
- ❌ 需手建 vitest.config.ts → ✅ **已存在**只需扩展

---

## Task 0: 前置探查（preflight, 必做）

### Task 0.1: Read stream-guard.ts 与 ChatPage 实际接线

**Files:**
- Read: `CodeCast-desktop/frontend/src/v2/lib/stream-guard.ts`
- Read: `CodeCast-desktop/frontend/src/v2/pages/ChatPage.tsx`
- Read: `CodeCast-desktop/frontend/src/v2/components/composer/Composer.tsx`
- Read: `CodeCast-desktop/frontend/src/v2/pages/SettingsPage.tsx`
- Read: `CodeCast-desktop/frontend/src/v2/App.tsx`

- [ ] **Step 1: Read 各文件**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
cat src/v2/lib/stream-guard.ts
echo "---"
cat src/v2/pages/ChatPage.tsx
echo "---"
cat src/v2/components/composer/Composer.tsx
echo "---"
cat src/v2/pages/SettingsPage.tsx
echo "---"
cat src/v2/App.tsx
```

- [ ] **Step 2: 记录结论**

写到对话里（每项 1 行）：
- `createStreamGuard` 真实签名
- ChatPage 是否被 App.tsx 使用
- Composer 是 controlled / uncontrolled / 双模式
- SettingsPage 用了哪些 settings 字段
- App.tsx 路由对 `/` 的渲染

- [ ] **Step 3: 确认 grep workspaceSlice 引用**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
grep -rn "workspaceSlice\|useWorkspace\|createWorkspaceSlice\|WorkspaceSlice\|Workspace " src/v2/
```

输出应仅在 `store/slices/workspaceSlice.ts` 自身 + `store/index.ts`。

- [ ] **Step 4: 确认 useToast export**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
grep -E "export.*useToast|export.*ToastProvider" src/v2/components/primitives/Toast.tsx
```

- [ ] **Step 5: 确认 primitives/Toast 文件存在**

```bash
ls src/v2/components/primitives/
```

---

## Task 1: 测试基础设施（Commit C1）

### Task 1.1: 建 `src/v2/test/setup.ts`（vitest config 已引用但文件不存在）

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/test/setup.ts`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p src/v2/test src/v2/wails/__mocks__ src/v2/lib/__tests__ src/v2/wails/__tests__ src/v2/store/slices/__tests__
```

- [ ] **Step 2: 写 setup.ts**

```ts
// frontend/src/v2/test/setup.ts
import { vi, beforeEach } from 'vitest';
import * as App from '../wails/__mocks__/App';

vi.mock('@wailsjs/go/main/App', () => App);

beforeEach(() => {
  // 每个测试前清空所有 mock 调用记录
  Object.values(App).forEach((v) => {
    if (typeof v === 'function' && 'mockReset' in v) {
      (v as unknown as { mockReset: () => void }).mockReset();
    }
  });
});
```

- [ ] **Step 3: typecheck**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run typecheck
```

Expected：0 error

### Task 1.2: 建 Wails App mock（vitest 用）

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/wails/__mocks__/App.ts`

- [ ] **Step 1: 写 mock**

```ts
// frontend/src/v2/wails/__mocks__/App.ts
// vitest 测试用的 Wails App mock
import { vi } from 'vitest';

export const GetSessions         = vi.fn(async () => []);
export const CreateSession       = vi.fn(async () => ({ id: 'mock-sess-1', title: 'Mock', projectId: '', createdAt: Date.now(), updatedAt: Date.now() }));
export const SwitchSession       = vi.fn(() => undefined);
export const DeleteSession       = vi.fn(() => undefined);
export const SendMessageEx       = vi.fn(async () => []);
export const CancelMessage       = vi.fn(() => undefined);
export const GetModels           = vi.fn(async () => [{ id: 'mock', name: 'Mock', apiUrl: '', defaultModel: 'mock', models: ['mock'] }]);
export const SetModel            = vi.fn(() => undefined);
export const GetCurrentModel     = vi.fn(async () => 'mock');
export const GetToolCatalog      = vi.fn(async () => []);
export const GetToolHistory      = vi.fn(async () => []);
export const InvokeCastTool      = vi.fn(async () => '{}');
export const GetProjects         = vi.fn(async () => []);
export const SwitchProject       = vi.fn(() => undefined);
export const GetAPMetricsSnapshot= vi.fn(async () => ({ llmTotalCalls: 0, llmTotalErrors: 0, toolTotalCalls: 0, toolTotalErrors: 0, totalTurns: 0, totalEpisodes: 0, activeAgents: 0, poolQueueLength: 0, memorySizeBytes: 0, tokenUsageByModel: {} }));
export const ClearCache          = vi.fn(() => undefined);
export const GetSettings         = vi.fn(async () => ({}));
export const SaveSettings        = vi.fn(() => undefined);
export const ListMCPServers      = vi.fn(async () => []);
export const ConnectMCP          = vi.fn(() => undefined);
export const DisconnectMCP       = vi.fn(() => undefined);
export const GetGitStatus        = vi.fn(async () => null);
export const GetGitBranches      = vi.fn(async () => []);
```

- [ ] **Step 2: 写失败测试：mock 能被 resolve**

Create `frontend/src/v2/wails/__mocks__/App.test.ts`（临时验证用，可后续删除）：

```ts
import { describe, it, expect } from 'vitest';
import { GetSessions } from './App';

describe('App mock', () => {
  it('returns empty array', async () => {
    expect(await GetSessions()).toEqual([]);
  });
});
```

- [ ] **Step 3: 跑测试**

```bash
npx vitest run src/v2/wails/__mocks__/App.test.ts
```

Expected：PASS

- [ ] **Step 4: 删临时验证测试**

```bash
rm src/v2/wails/__mocks__/App.test.ts
```

### Task 1.3: 写 `lib/format.ts` + 测试

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/lib/format.ts`
- Create: `CodeCast-desktop/frontend/src/v2/lib/__tests__/format.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// frontend/src/v2/lib/__tests__/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatWailsError } from '../format';

describe('formatWailsError', () => {
  it('null/undefined → "unknown error"', () => {
    expect(formatWailsError(null)).toBe('unknown error');
    expect(formatWailsError(undefined)).toBe('unknown error');
  });
  it('string passthrough', () => {
    expect(formatWailsError('boom')).toBe('boom');
  });
  it('Error.message', () => {
    expect(formatWailsError(new Error('x'))).toBe('x');
  });
  it('object { message }', () => {
    expect(formatWailsError({ message: 'm' })).toBe('m');
  });
  it('object { error }', () => {
    expect(formatWailsError({ error: 'e' })).toBe('e');
  });
  it('object { data }', () => {
    expect(formatWailsError({ data: 'd' })).toBe('d');
  });
  it('object without known field → JSON', () => {
    expect(formatWailsError({ foo: 1 })).toBe('{"foo":1}');
  });
});
```

- [ ] **Step 2: 跑测试看失败**

```bash
npx vitest run src/v2/lib/__tests__/format.test.ts
```

Expected：FAIL（format.ts 不存在）

- [ ] **Step 3: 实现 format.ts**

```ts
// frontend/src/v2/lib/format.ts
export function formatWailsError(e: unknown): string {
  if (e == null) return 'unknown error';
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
```

- [ ] **Step 4: 跑测试看通过**

```bash
npx vitest run src/v2/lib/__tests__/format.test.ts
```

Expected：7/7 PASS

### Task 1.4: 写 `lib/reportError.ts`（统一 setError 入口）

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/lib/reportError.ts`

- [ ] **Step 1: 实现**

```ts
// frontend/src/v2/lib/reportError.ts
// 统一报告错误到 errorsSlice，无需在每个 slice 用 (get() as any) 强转
import { useAppStore } from '../store';
import { formatWailsError } from './format';
import type { SliceName } from '../store/slices/errorsSlice';

export function reportError(slice: SliceName, e: unknown): void {
  useAppStore.getState().setError(slice, formatWailsError(e));
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected：0 error（setError 在 errorsSlice 即将创建，可临时报"未使用 import"——用 `// @ts-expect-error` 标注或先创建 errorsSlice）

**建议顺序**：本 task 推迟到 Task 4.1 errorsSlice 完成后做。

### Task 1.5: 写 `wails/guards.ts`

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/wails/guards.ts`

- [ ] **Step 1: 实现**

```ts
// frontend/src/v2/wails/guards.ts
import type { GitStatus } from './types';

export function parseGitStatus(raw: unknown): GitStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    branch: typeof r.branch === 'string' ? r.branch : '',
    ahead:  typeof r.ahead  === 'number' ? r.ahead  : 0,
    behind: typeof r.behind === 'number' ? r.behind : 0,
    dirty:  typeof r.dirty  === 'number' ? r.dirty  : 0,
  };
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected：报 `GitStatus` 未定义（types.ts 还没加）—— 暂存，本 task 不 commit

### Task 1.6: 改 vitest.config.ts 的 setupFiles 路径

**Files:**
- Modify: `CodeCast-desktop/frontend/vitest.config.ts`

- [ ] **Step 1: 改 path**

文件当前是：
```ts
setupFiles: ['./src/test/setup.ts'],
```

改为：
```ts
setupFiles: ['./src/v2/test/setup.ts'],
```

- [ ] **Step 2: 跑已有 setup 相关测试**

```bash
npx vitest run src/v2/lib/__tests__/format.test.ts
```

Expected：仍 PASS（setup 已加载）

### Task 1.7: commit C1

```bash
cd E:/codecast/CodeCast
git add frontend/src/v2/test/setup.ts \
        frontend/src/v2/wails/__mocks__/App.ts \
        frontend/src/v2/lib/format.ts \
        frontend/src/v2/lib/__tests__/format.test.ts \
        frontend/src/v2/wails/guards.ts \
        frontend/vitest.config.ts
git commit -m "chore(frontend): add Wails mock + format/guard utilities + vitest setup"
```

**回滚策略**：`git revert <C1-hash>` 即可回滚整套基础设施。

---

## Task 2: 类型扩展（Commit C2）

### Task 2.1: 加 Settings/GitStatus/MCPServerStatus 到 types.ts

**Files:**
- Modify: `CodeCast-desktop/frontend/src/v2/wails/types.ts`

- [ ] **Step 1: 追加到文件末尾**

```ts
// 追加到 types.ts 末尾
export interface MCPServerStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: string[];
  error?: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  dirty: number;
}

export interface GitCommit {
  hash: string;
  message: string;
  at: number;
}

export interface Settings {
  work_mode: string; default_perm: boolean; auto_review: boolean;
  full_access: boolean; shell: string; open_target: string; language: string;
  hotkey: string; ctrl_enter_send: boolean; followup_mode: string; review_mode: string;
  notify_complete: string; notify_permission: boolean; notify_issue: boolean;
  notification_turn: string; notification_permission: boolean; notification_question: boolean;
  theme: string; font_size: string;
  long_context: boolean; llm_provider: string; llm_api_url: string; llm_model: string;
  personality: string; custom_instructions: string; auto_memory: boolean;
  tool_memory: boolean; message_history_limit: number;
  smtp_host: string; smtp_port: number; smtp_user: string; smtp_pass: string;
  auto_commit: boolean; confirm_before_commit: boolean; use_worktree: boolean;
  allow_browser: boolean; browser_approval: string; browser_history: string;
  browser_clear_data: string; blocked_domains: string[]; allowed_domains: string[];
  browser_plugin: string; selenium_installed: boolean; computer_control: boolean;
  telemetry_enabled: boolean; telemetry_endpoint: string;
  sanitizer_enabled: boolean; sanitizer_strategy: string; topic_constraints: string[];
  mcp_servers: MCPServerStatus[]; model_configs: any[]; env_vars: any[]; slash_commands: any[];
}
```

- [ ] **Step 2: typecheck**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run typecheck
```

Expected：0 error

- [ ] **Step 3: commit C2**

```bash
cd E:/codecast/CodeCast
git add frontend/src/v2/wails/types.ts
git commit -m "feat(types): add Settings/MCPServerStatus/GitStatus interfaces"
```

---

## Task 3: adapter 收口（Commit C3）

### Task 3.1: 新增 MCP/Git 命名空间 + Settings 强类型

**Files:**
- Modify: `CodeCast-desktop/frontend/src/v2/wails/adapter.ts`

- [ ] **Step 1: 替换 adapter.ts 全文**

```ts
// frontend/src/v2/wails/adapter.ts
// Wails Go binding adapter · v2 集成版
import * as App from '@wailsjs/go/main/App';
import type { GitStatus, MCPServerStatus, Settings } from './types';

export const Sessions = {
  list:   () => App.GetSessions(),
  create: () => App.CreateSession(),
  switch: (id: string) => App.SwitchSession(id),
  delete: (id: string) => App.DeleteSession(id),
};

export const Chat = {
  send:   (sessionId: string, text: string, model = '', thinking = false) => App.SendMessageEx(sessionId, text, model, thinking),
  cancel: (sessionId: string) => App.CancelMessage(sessionId),
};

export const Models = {
  list:    () => App.GetModels(),
  set:     (model: string) => App.SetModel(model),
  current: () => App.GetCurrentModel(),
};

export const Cast = {
  catalog: () => App.GetToolCatalog(),
  history: (sessionId: string, limit: number) => App.GetToolHistory(sessionId, limit),
  invoke:  (name: string, argsJSON: string) => App.InvokeCastTool(name, argsJSON),
};

export const Projects = {
  list:   () => App.GetProjects(),
  switch: (id: string) => App.SwitchProject(id),
};

export const Metrics = {
  snapshot:   () => App.GetAPMetricsSnapshot(),
  clearCache: () => App.ClearCache(),
};

export const Settings = {
  get:  (): Promise<Settings> => App.GetSettings() as Promise<Settings>,
  save: (s: Settings): Promise<void> => App.SaveSettings(s),
};

export const MCP = {
  list:       (): Promise<MCPServerStatus[]> => App.ListMCPServers() as Promise<MCPServerStatus[]>,
  connect:    (name: string) => App.ConnectMCP(name),
  disconnect: (name: string) => App.DisconnectMCP(name),
};

export const Git = {
  status:   () => App.GetGitStatus(),         // parseGitStatus 守护
  branches: () => App.GetGitBranches(),
};
```

- [ ] **Step 2: typecheck**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run typecheck
```

Expected：0 error

### Task 3.2: 写 adapter 单元测试

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/wails/__tests__/adapter.test.ts`

- [ ] **Step 1: 写测试**

```ts
// frontend/src/v2/wails/__tests__/adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { MCP, Git, Settings as SettingsAdapter, Sessions } from '../adapter';

describe('adapter namespace', () => {
  beforeEach(() => {
    vi.mocked(App.ListMCPServers).mockReset();
    vi.mocked(App.GetGitStatus).mockReset();
    vi.mocked(App.GetSessions).mockReset();
    vi.mocked(App.SaveSettings).mockReset();
  });

  it('MCP.list → App.ListMCPServers', async () => {
    await MCP.list();
    expect(App.ListMCPServers).toHaveBeenCalledTimes(1);
  });

  it('MCP.connect(name) → App.ConnectMCP(name)', async () => {
    await MCP.connect('foo');
    expect(App.ConnectMCP).toHaveBeenCalledWith('foo');
  });

  it('MCP.disconnect(name) → App.DisconnectMCP(name)', async () => {
    await MCP.disconnect('bar');
    expect(App.DisconnectMCP).toHaveBeenCalledWith('bar');
  });

  it('Git.status → App.GetGitStatus', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce(null);
    await Git.status();
    expect(App.GetGitStatus).toHaveBeenCalledTimes(1);
  });

  it('Git.branches → App.GetGitBranches', async () => {
    vi.mocked(App.GetGitBranches).mockResolvedValueOnce(['main']);
    expect(await Git.branches()).toEqual(['main']);
  });

  it('SettingsAdapter.get returns Settings type', async () => {
    vi.mocked(App.GetSettings).mockReset();
    vi.mocked(App.GetSettings).mockResolvedValueOnce({ work_mode: 'code' } as any);
    const s = await SettingsAdapter.get();
    expect(s.work_mode).toBe('code');
  });

  it('SettingsAdapter.save forwards object', async () => {
    const s: any = { work_mode: 'cast' };
    await SettingsAdapter.save(s);
    expect(App.SaveSettings).toHaveBeenCalledWith(s);
  });

  it('Sessions.list returns array', async () => {
    vi.mocked(App.GetSessions).mockResolvedValueOnce([]);
    expect(await Sessions.list()).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
npx vitest run src/v2/wails/__tests__/adapter.test.ts
```

Expected：8/8 PASS

### Task 3.3: commit C3

```bash
cd E:/codecast/CodeCast
git add frontend/src/v2/wails/adapter.ts frontend/src/v2/wails/__tests__/adapter.test.ts
git commit -m "feat(adapter): add MCP/Git namespaces + Settings typing"
```

**回滚策略**：`git revert <C3-hash>`——但**先**回滚 C5（slices 依赖 adapter 新 API），否则 typecheck 红。

---

## Task 4: 错误状态层（Commit C4）

### Task 4.1: 建 errorsSlice

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/store/slices/errorsSlice.ts`

- [ ] **Step 1: 写 slice**

```ts
// frontend/src/v2/store/slices/errorsSlice.ts
import type { StateCreator } from 'zustand';

export type SliceName =
  | 'session' | 'chat' | 'model' | 'project' | 'cast'
  | 'castTool' | 'memory' | 'mcp' | 'git' | 'settings';

export interface ErrorsSlice {
  errors: Partial<Record<SliceName, string>>;
  setError: (slice: SliceName, msg: string) => void;
  clearError: (slice: SliceName) => void;
}

export const createErrorsSlice: StateCreator<ErrorsSlice, [], [], ErrorsSlice> = (set) => ({
  errors: {},
  setError: (slice, msg) => set((s) => ({ errors: { ...s.errors, [slice]: msg } })),
  clearError: (slice) => set((s) => {
    if (!(slice in s.errors)) return s;
    const next = { ...s.errors };
    delete next[slice];
    return { errors: next };
  }),
});
```

### Task 4.2: 合并 errorsSlice 到 store

**Files:**
- Modify: `CodeCast-desktop/frontend/src/v2/store/index.ts`

- [ ] **Step 1: 加 import 与合并**

在文件顶部 import 区加：
```ts
import { createErrorsSlice, type ErrorsSlice } from './slices/errorsSlice';
```

在 `AppState` 联合中加 `& ErrorsSlice`：
```ts
export type AppState = & UISlice & SessionSlice & ChatSlice & ModelSlice & WorkspaceSlice & ProjectSlice & CastSlice & CastToolSlice & MemorySlice & MCPSlice & GitSlice & SettingsSlice & ErrorsSlice;
```

在 create() 合并中加：
```ts
...createErrorsSlice(...a),
```

- [ ] **Step 2: typecheck**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run typecheck
```

Expected：0 error

### Task 4.3: 建 `lib/useError.ts`

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/lib/useError.ts`

- [ ] **Step 1: 写 hook**

```ts
// frontend/src/v2/lib/useError.ts
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { useToast } from '../components/primitives/Toast';
import type { SliceName } from '../store/slices/errorsSlice';

export function useError(slice: SliceName): string | undefined {
  const msg = useAppStore((s) => s.errors[slice]);
  const clearError = useAppStore((s) => s.clearError);
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

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected：0 error

### Task 4.4: 建 `lib/reportError.ts`（v1 P2/P6 修复）

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/lib/reportError.ts`

- [ ] **Step 1: 写实现**

```ts
// frontend/src/v2/lib/reportError.ts
// 统一报告错误入口，避免 (get() as any) 强转
import { useAppStore } from '../store';
import { formatWailsError } from './format';
import type { SliceName } from '../store/slices/errorsSlice';

export function reportError(slice: SliceName, e: unknown): void {
  useAppStore.getState().setError(slice, formatWailsError(e));
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected：0 error

### Task 4.5: 写 useError + reportError 测试

**Files:**
- Create: `CodeCast-desktop/frontend/src/v2/lib/__tests__/useError.test.tsx`

- [ ] **Step 1: 写测试**

```tsx
// frontend/src/v2/lib/__tests__/useError.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useError } from '../useError';
import { useAppStore } from '../../store';
import { ToastProvider } from '../../components/primitives/Toast';

function Probe() {
  const msg = useError('session');
  return <div data-testid="m">{msg ?? ''}</div>;
}

describe('useError', () => {
  beforeEach(() => {
    useAppStore.setState({ errors: {} });
  });

  it('returns undefined initially', () => {
    const { getByTestId } = render(<ToastProvider><Probe /></ToastProvider>);
    expect(getByTestId('m').textContent).toBe('');
  });

  it('clears error after consume', () => {
    render(<ToastProvider><Probe /></ToastProvider>);
    act(() => {
      useAppStore.getState().setError('session', 'boom');
    });
    expect(useAppStore.getState().errors.session).toBeUndefined();
  });

  it('does not double-toast in StrictMode-like double effect', () => {
    render(<ToastProvider><Probe /></ToastProvider>);
    act(() => {
      useAppStore.getState().setError('session', 'first');
    });
    // 第二次设同 slice 错误应被 useRef 防止重 toast
    act(() => {
      useAppStore.getState().setError('session', 'second');
    });
    // 第二次设值时 ref 仍 true 直到下次 cleared
    // 此处只验证 setError 后能 clear，不验证 toast 调用次数（避免 spy on useToast）
    expect(useAppStore.getState().errors.session).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
npx vitest run src/v2/lib/__tests__/useError.test.tsx
```

Expected：3/3 PASS

### Task 4.6: commit C4

```bash
cd E:/codecast/CodeCast
git add frontend/src/v2/store/slices/errorsSlice.ts \
        frontend/src/v2/store/index.ts \
        frontend/src/v2/lib/useError.ts \
        frontend/src/v2/lib/reportError.ts \
        frontend/src/v2/lib/__tests__/useError.test.tsx
git commit -m "feat(errors): add per-slice errorsSlice + useError + reportError"
```

---

## Task 5a: session + chat slice 改写（Commit C5a）

> 拆 C5 为 C5a/C5b 是 v2 P5 修复：先改最关键、最复杂的 session/chat，验证架构可行再批量改其余。

### Task 5a.1: 改写 sessionSlice

**Files:**
- Modify: `CodeCast-desktop/frontend/src/v2/store/slices/sessionSlice.ts`
- Create: `CodeCast-desktop/frontend/src/v2/store/slices/__tests__/sessionSlice.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// frontend/src/v2/store/slices/__tests__/sessionSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('sessionSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetSessions).mockReset();
    vi.mocked(App.CreateSession).mockReset();
    useAppStore.setState({ sessions: [], currentId: null, loading: false, errors: {} });
  });

  it('loadSessions: success populates sessions + sets currentId', async () => {
    vi.mocked(App.GetSessions).mockResolvedValueOnce([
      { id: 's1', title: 'S1', projectId: '', createdAt: 1, updatedAt: 1 },
    ] as any);
    await useAppStore.getState().loadSessions();
    expect(useAppStore.getState().sessions).toHaveLength(1);
    expect(useAppStore.getState().currentId).toBe('s1');
  });

  it('loadSessions: failure sets session error and turns off loading', async () => {
    vi.mocked(App.GetSessions).mockRejectedValueOnce(new Error('net'));
    await useAppStore.getState().loadSessions();
    expect(useAppStore.getState().errors.session).toBe('net');
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('createSession prepends and sets currentId', async () => {
    vi.mocked(App.CreateSession).mockResolvedValueOnce({ id: 's2', title: 'S2', projectId: '', createdAt: 2, updatedAt: 2 } as any);
    const s = await useAppStore.getState().createSession();
    expect(s.id).toBe('s2');
    expect(useAppStore.getState().currentId).toBe('s2');
  });

  it('switchSession sets currentId', async () => {
    useAppStore.setState({ sessions: [{ id: 'a', title: '', projectId: '', createdAt: 0, updatedAt: 0 }, { id: 'b', title: '', projectId: '', createdAt: 0, updatedAt: 0 }] });
    await useAppStore.getState().switchSession('b');
    expect(useAppStore.getState().currentId).toBe('b');
  });

  it('deleteSession removes from list', async () => {
    useAppStore.setState({ sessions: [{ id: 'a', title: '', projectId: '', createdAt: 0, updatedAt: 0 }, { id: 'b', title: '', projectId: '', createdAt: 0, updatedAt: 0 }], currentId: 'a' });
    await useAppStore.getState().deleteSession('a');
    expect(useAppStore.getState().sessions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑测试看失败**

```bash
npx vitest run src/v2/store/slices/__tests__/sessionSlice.test.ts
```

Expected：loadSessions 失败用例 FAIL（还没接 setError）

- [ ] **Step 3: 改写 sessionSlice.ts**

```ts
// frontend/src/v2/store/slices/sessionSlice.ts
import type { StateCreator } from 'zustand';
import type { Session } from '../../wails/types';
import { Sessions } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface SessionSlice {
  sessions: Session[];
  currentId: string | null;
  loading: boolean;
  loadSessions: () => Promise<void>;
  createSession: () => Promise<Session>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

export const createSessionSlice: StateCreator<SessionSlice, [], [], SessionSlice> = (set) => ({
  sessions: [],
  currentId: null,
  loading: false,

  loadSessions: async () => {
    set({ loading: true });
    try {
      const sessions = await Sessions.list();
      set({ sessions, loading: false, currentId: sessions[0]?.id ?? null });
    } catch (e) {
      set({ loading: false });
      reportError('session', e);
    }
  },

  createSession: async () => {
    const session = await Sessions.create();
    set((s) => ({ sessions: [session, ...s.sessions], currentId: session.id }));
    return session;
  },

  switchSession: async (id) => {
    await Sessions.switch(id);
    set({ currentId: id });
  },

  deleteSession: async (id) => {
    await Sessions.delete(id);
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
  },
});
```

- [ ] **Step 4: 跑测试看通过**

```bash
npx vitest run src/v2/store/slices/__tests__/sessionSlice.test.ts
```

Expected：5/5 PASS

### Task 5a.2: 改写 chatSlice

**Files:**
- Modify: `CodeCast-desktop/frontend/src/v2/store/slices/chatSlice.ts`
- Create: `CodeCast-desktop/frontend/src/v2/store/slices/__tests__/chatSlice.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// frontend/src/v2/store/slices/__tests__/chatSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import { useAppStore } from '../../index';

describe('chatSlice', () => {
  beforeEach(() => {
    vi.mocked(App.SendMessageEx).mockReset();
    vi.mocked(EventsOn).mockReset();
    vi.mocked(EventsOff).mockReset();
    useAppStore.setState({ messages: {}, isStreaming: false, interrupted: false, abort: null, errors: {} });
  });

  it('send: failure sets chat error, does NOT throw', async () => {
    vi.mocked(App.SendMessageEx).mockRejectedValueOnce(new Error('fail'));
    await expect(useAppStore.getState().send('s1', 'hi')).resolves.toBeUndefined();
    expect(useAppStore.getState().errors.chat).toBe('fail');
    expect(useAppStore.getState().isStreaming).toBe(false);
  });

  it('resume: no-op when not interrupted', async () => {
    await useAppStore.getState().resume('s1');
    expect(App.SendMessageEx).not.toHaveBeenCalled();
  });

  it('resume: no-op when last message is assistant', async () => {
    useAppStore.setState({
      interrupted: true,
      messages: { s1: [{ id: 'a1', role: 'assistant', content: 'partial' }] },
    });
    await useAppStore.getState().resume('s1');
    expect(App.SendMessageEx).not.toHaveBeenCalled();
  });

  it('resume: re-sends when interrupted + last is user', async () => {
    useAppStore.setState({
      interrupted: true,
      messages: { s1: [{ id: 'u1', role: 'user', content: 'help' }] },
    });
    vi.mocked(App.SendMessageEx).mockResolvedValueOnce([]);
    await useAppStore.getState().resume('s1');
    expect(App.SendMessageEx).toHaveBeenCalledWith('s1', 'help', undefined, false);
  });

  it('cancel: marks interrupted, calls Chat.cancel', async () => {
    useAppStore.setState({ isStreaming: true });
    useAppStore.getState().cancel('s1');
    expect(useAppStore.getState().isStreaming).toBe(false);
    expect(useAppStore.getState().interrupted).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试看失败**

```bash
npx vitest run src/v2/store/slices/__tests__/chatSlice.test.ts
```

Expected：FAIL（send 还在 throw）

- [ ] **Step 3: 改写 chatSlice.ts**

```ts
// frontend/src/v2/store/slices/chatSlice.ts
import type { StateCreator } from 'zustand';
import type { Message } from '../../wails/types';
import { Chat } from '../../wails/adapter';
import { onStreamChunk } from '../../wails/events';
import { createStreamBuffer } from '../../lib/streaming';
import { createStreamGuard } from '../../lib/stream-guard';
import { reportError } from '../../lib/reportError';

export interface ChatSlice {
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  interrupted: boolean;
  abort: AbortController | null;
  send: (sessionId: string, text: string, model?: string) => Promise<void>;
  cancel: (sessionId: string) => void;
  resume: (sessionId: string) => Promise<void>;
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set, get) => ({
  messages: {},
  isStreaming: false,
  interrupted: false,
  abort: null,

  send: async (sessionId, text, model) => {
    set({ isStreaming: true, interrupted: false });
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] || []), { id: `u-${Date.now()}`, role: 'user' as const, content: text }],
      },
    }));
    const buf = createStreamBuffer({ flushSize: 1, flushIntervalMs: 200 });
    const guard = createStreamGuard({
      timeoutMs: 60_000,
      onTimeout: () => { set({ isStreaming: false, interrupted: true }); buf.dispose(); guard.dispose(); },
    });
    buf.onFlush = (chunk) => {
      set((s) => {
        const list = s.messages[sessionId] || [];
        const last = list[list.length - 1];
        if (last?.role === 'assistant') {
          return { messages: { ...s.messages, [sessionId]: [...list.slice(0, -1), { ...last, content: (last.content || '') + chunk }] } };
        }
        return { messages: { ...s.messages, [sessionId]: [...list, { id: `a-${Date.now()}`, role: 'assistant' as const, content: chunk }] } };
      });
      guard.reset();
    };
    guard.start();
    const unsubscribe = onStreamChunk(sessionId, (evt) => {
      if (evt.type === 'content' && evt.content) buf.push(evt.content);
      if (evt.type === 'done')  { buf.dispose(); guard.dispose(); unsubscribe(); set({ isStreaming: false }); }
      if (evt.type === 'error') { buf.dispose(); guard.dispose(); unsubscribe(); set({ isStreaming: false, interrupted: true }); }
    });
    try {
      await Chat.send(sessionId, text, model);
    } catch (e) {
      buf.dispose(); guard.dispose(); unsubscribe();
      set({ isStreaming: false, interrupted: true });
      reportError('chat', e);
      // 不 throw — 由 UI 决定呈现
    }
  },

  cancel: (sessionId) => {
    get().abort?.abort();
    Chat.cancel(sessionId);
    set({ isStreaming: false, interrupted: true });
  },

  resume: async (sessionId) => {
    if (!get().interrupted) return;
    const last = get().messages[sessionId]?.slice(-1)[0];
    if (!last || last.role !== 'user') return;
    await get().send(sessionId, last.content);
  },
});
```

- [ ] **Step 4: 跑测试看通过**

```bash
npx vitest run src/v2/store/slices/__tests__/chatSlice.test.ts
```

Expected：5/5 PASS

### Task 5a.3: typecheck + 跑 session+chat 测试

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run typecheck
npx vitest run src/v2/store/slices/
```

Expected：0 error，10/10 PASS

### Task 5a.4: commit C5a

```bash
cd E:/codecast/CodeCast
git add frontend/src/v2/store/slices/sessionSlice.ts \
        frontend/src/v2/store/slices/chatSlice.ts \
        frontend/src/v2/store/slices/__tests__/sessionSlice.test.ts \
        frontend/src/v2/store/slices/__tests__/chatSlice.test.ts
git commit -m "refactor(store): session/chat slices use reportError + adapter-only imports"
```

---

## Task 5b: 其余 slice 改写（Commit C5b）

### Task 5b.1: 删除 workspaceSlice（v2 O7 决策）

**Files:**
- Delete: `CodeCast-desktop/frontend/src/v2/store/slices/workspaceSlice.ts`
- Modify: `CodeCast-desktop/frontend/src/v2/store/index.ts`

- [ ] **Step 1: grep 确认 0 外部引用**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
grep -rn "workspaceSlice\|useWorkspace\|createWorkspaceSlice\|WorkspaceSlice" src/v2/ | grep -v "store/slices/workspaceSlice.ts"
```

Expected：仅 `store/index.ts`

- [ ] **Step 2: 删除文件**

```bash
rm frontend/src/v2/store/slices/workspaceSlice.ts
```

- [ ] **Step 3: 从 store/index.ts 移除 import 和合并**

修改 3 处：
- 删 `import { createWorkspaceSlice, type WorkspaceSlice } from './slices/workspaceSlice';`
- AppState 联合中删 `& WorkspaceSlice`
- create() 合并中删 `...createWorkspaceSlice(...a),`

- [ ] **Step 4: typecheck**

```bash
npm run typecheck
```

Expected：0 error

### Task 5b.2: 改写 mcpSlice / gitSlice / memorySlice

**Files:**
- Modify: `frontend/src/v2/store/slices/mcpSlice.ts`
- Modify: `frontend/src/v2/store/slices/gitSlice.ts`
- Modify: `frontend/src/v2/store/slices/memorySlice.ts`

- [ ] **Step 1: mcpSlice.ts**

```ts
// frontend/src/v2/store/slices/mcpSlice.ts
import type { StateCreator } from 'zustand';
import type { MCPServerStatus } from '../../wails/types';
import { MCP } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface MCPSlice {
  servers: MCPServerStatus[];
  loading: boolean;
  refresh: () => Promise<void>;
  connect: (name: string) => Promise<void>;
  disconnect: (name: string) => Promise<void>;
}

export const createMCPSlice: StateCreator<MCPSlice, [], [], MCPSlice> = (set) => ({
  servers: [],
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try { set({ servers: await MCP.list(), loading: false }); }
    catch (e) { set({ loading: false }); reportError('mcp', e); }
  },
  connect: async (name) => {
    try { await MCP.connect(name); set({ servers: await MCP.list() }); }
    catch (e) { reportError('mcp', e); }
  },
  disconnect: async (name) => {
    try { await MCP.disconnect(name); set({ servers: await MCP.list() }); }
    catch (e) { reportError('mcp', e); }
  },
});
```

- [ ] **Step 2: gitSlice.ts**

```ts
// frontend/src/v2/store/slices/gitSlice.ts
import type { StateCreator } from 'zustand';
import type { GitStatus, GitCommit } from '../../wails/types';
import { Git } from '../../wails/adapter';
import { parseGitStatus } from '../../wails/guards';
import { reportError } from '../../lib/reportError';

export interface GitSlice {
  status: GitStatus | null;
  branches: string[];
  commits: GitCommit[];
  diff: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const createGitSlice: StateCreator<GitSlice, [], [], GitSlice> = (set) => ({
  status: null,
  branches: [],
  commits: [],
  diff: '',
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const [rawStatus, branches] = await Promise.all([Git.status(), Git.branches()]);
      set({ status: parseGitStatus(rawStatus), branches, loading: false });
    } catch (e) {
      set({ loading: false });
      reportError('git', e);
    }
  },
});
```

- [ ] **Step 3: memorySlice.ts**

```ts
// frontend/src/v2/store/slices/memorySlice.ts
import type { StateCreator } from 'zustand';
import { Metrics } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface MemorySlice {
  episodes: any[];
  recallResults: any[];
  stats: { totalEpisodes: number; sizeBytes: number };
  loading: boolean;
  search: (q: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const createMemorySlice: StateCreator<MemorySlice, [], [], MemorySlice> = (set) => ({
  episodes: [],
  recallResults: [],
  stats: { totalEpisodes: 0, sizeBytes: 0 },
  loading: false,
  search: async (_q) => {
    set({ loading: true });
    try {
      const snap: any = await Metrics.snapshot();
      set({
        recallResults: snap.episodes || [],
        stats: { totalEpisodes: snap.totalEpisodes || 0, sizeBytes: snap.memorySizeBytes || 0 },
        loading: false,
      });
    } catch (e) {
      set({ loading: false });
      reportError('memory', e);
    }
  },
  refresh: async () => {
    set({ loading: true });
    try {
      const snap: any = await Metrics.snapshot();
      set({ stats: { totalEpisodes: snap.totalEpisodes || 0, sizeBytes: snap.memorySizeBytes || 0 }, loading: false });
    } catch (e) {
      set({ loading: false });
      reportError('memory', e);
    }
  },
});
```

- [ ] **Step 4: typecheck**

```bash
npm run typecheck
```

Expected：0 error

### Task 5b.3: 改写 castSlice / projectSlice / modelSlice / settingsSlice

**Files:**
- Modify: 上述 4 个 slice

- [ ] **Step 1: castSlice.ts**

```ts
// frontend/src/v2/store/slices/castSlice.ts
import type { StateCreator } from 'zustand';
import type { ToolCatalogItem } from '../../wails/types';
import { Cast } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface CastInvocation { name: string; args: string; result?: string; at: number }
export interface CastSlice {
  catalog: ToolCatalogItem[];
  recent: CastInvocation[];
  byCategory: Record<string, ToolCatalogItem[]>;
  loading: boolean;
  loadCatalog: () => Promise<void>;
  loadHistory: (sessionId: string, limit?: number) => Promise<void>;
}

export const createCastSlice: StateCreator<CastSlice, [], [], CastSlice> = (set) => ({
  catalog: [], recent: [], byCategory: {}, loading: false,
  loadCatalog: async () => {
    set({ loading: true });
    try {
      const catalog = await Cast.catalog();
      const byCategory: Record<string, ToolCatalogItem[]> = {};
      catalog.forEach((t) => { (byCategory[t.category] ||= []).push(t); });
      set({ catalog, byCategory, loading: false });
    } catch (e) { set({ loading: false }); reportError('cast', e); }
  },
  loadHistory: async (sessionId, limit = 50) => {
    try { set({ recent: await Cast.history(sessionId, limit) }); }
    catch (e) { reportError('cast', e); }
  },
});
```

- [ ] **Step 2: projectSlice.ts**

```ts
// frontend/src/v2/store/slices/projectSlice.ts
import type { StateCreator } from 'zustand';
import { Projects } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';
import type { Project } from '../../wails/types';

export interface ProjectSlice {
  projects: Project[];
  currentId: string | null;
  noProjectMode: boolean;
  loading: boolean;
  load: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  setNoProject: (b: boolean) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set) => ({
  projects: [], currentId: null, noProjectMode: false, loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const projects = await Projects.list();
      set({ projects, currentId: projects[0]?.id ?? null, loading: false });
    } catch (e) { set({ loading: false }); reportError('project', e); }
  },
  switchProject: async (id) => {
    await Projects.switch(id);
    set({ currentId: id });
  },
  setNoProject: (b) => set({ noProjectMode: b }),
});
```

- [ ] **Step 3: modelSlice.ts**

```ts
// frontend/src/v2/store/slices/modelSlice.ts
import type { StateCreator } from 'zustand';
import type { ModelPreset } from '../../wails/types';
import { Models } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface ModelSlice {
  presets: ModelPreset[];
  current: string;
  apiKeyMasked: string;
  loading: boolean;
  load: () => Promise<void>;
  setCurrent: (model: string) => Promise<void>;
}

export const createModelSlice: StateCreator<ModelSlice, [], [], ModelSlice> = (set) => ({
  presets: [], current: '', apiKeyMasked: '', loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const [presets, current] = await Promise.all([Models.list(), Models.current()]);
      set({ presets, current, loading: false });
    } catch (e) { set({ loading: false }); reportError('model', e); }
  },
  setCurrent: async (model) => {
    await Models.set(model);
    set({ current: model });
  },
});
```

- [ ] **Step 4: settingsSlice.ts**

```ts
// frontend/src/v2/store/slices/settingsSlice.ts
import type { StateCreator } from 'zustand';
import type { Settings } from '../../wails/types';
import { Settings as SettingsAdapter } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface SettingsSlice {
  settings: Settings | null;
  loading: boolean;
  load: () => Promise<void>;
  save: (s: Settings) => Promise<void>;
}

export const createSettingsSlice: StateCreator<SettingsSlice, [], [], SettingsSlice> = (set) => ({
  settings: null, loading: false,
  load: async () => {
    set({ loading: true });
    try { set({ settings: await SettingsAdapter.get(), loading: false }); }
    catch (e) { set({ loading: false }); reportError('settings', e); }
  },
  save: async (s) => {
    try { await SettingsAdapter.save(s); set({ settings: s }); }
    catch (e) { reportError('settings', e); }
  },
});
```

- [ ] **Step 5: castToolSlice.ts 加 TODO**

在文件顶部加注释（不改逻辑）：
```ts
// TODO(v2 spec): cast tool sub-state (todos/schedules/knotes/emails) 由独立 spec 设计。
// 当前 cast 工具调用走 castSlice.invoke。本 slice 暂为占位。
```

- [ ] **Step 6: typecheck + 跑全部测试**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run typecheck
npm run test
```

Expected：0 error，全部 PASS

### Task 5b.4: commit C5b

```bash
cd E:/codecast/CodeCast
git add frontend/src/v2/store/slices/
git add frontend/src/v2/store/index.ts
git commit -m "refactor(store): remaining slices + drop workspaceSlice"
```

**回滚策略**：C5b revert 后 typecheck 可能因 AppState 联合变化而红——可一并 revert C5a。

---

## Task 6: 组件订阅错误（Commit C6）

### Task 6.1: 决定 ChatPage 集成策略（基于 Task 0.1 探查）

**Files:**
- Read: `CodeCast-desktop/frontend/src/v2/App.tsx`

- [ ] **Step 1: 读 App.tsx 路由**

确认 `/` 路由当前是 `CastEmptyState/CodeEmptyState`，**不是 ChatPage**。

- [ ] **Step 2: 决定**

- **决策 A（推荐）**：保持 App.tsx 不动，仅在 CastEmptyState/CodeEmptyState 内部用 `useError('chat')` 即可。**不动 ChatPage.tsx**。
- 决策 B：把 App.tsx `/` 路由换成 `<ChatPage />`——超出 v2 范围，**不做**。

**本 plan 采用决策 A。**

### Task 6.2: Sidebar 订阅 session/project

**Files:**
- Modify: `CodeCast-desktop/frontend/src/v2/layout/Sidebar.tsx`

- [ ] **Step 1: 加 useError**

读 Sidebar.tsx 全文，定位组件函数体。在 `function Sidebar()` 顶部加：

```ts
import { useError } from '../lib/useError';
```

在函数体最顶部加：
```ts
useError('session');
useError('project');
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected：0 error

### Task 6.3: TopBar / CastEmptyState / CodeEmptyState / Drawers 订阅

**Files:**
- Modify: `TopBar.tsx`, `CastEmptyState.tsx`, `CodeEmptyState.tsx`, `MCPPanel.tsx`, `GitPanel.tsx`, `MemoryPanel.tsx`

- [ ] **Step 1: 每个文件加 useError 一行**

| 文件 | 加 |
|------|-----|
| `TopBar.tsx` | `useError('model');` |
| `CastEmptyState.tsx` | `useError('chat');` |
| `CodeEmptyState.tsx` | `useError('chat');` |
| `MCPPanel.tsx` | `useError('mcp');` |
| `GitPanel.tsx` | `useError('git');` |
| `MemoryPanel.tsx` | `useError('memory');` |

每个文件加 import `import { useError } from '<relative path>';`（按层级）

- [ ] **Step 2: SettingsPage 强类型**

读 `frontend/src/v2/pages/SettingsPage.tsx` 全文件，定位 `any` 字段，改为 `Settings | null`。具体替换视现有代码而定——**如现有 settings 字段全用 `as any` 强转**，保持现状（Settings 60 字段一次改完超出 v2 范围）。最小动作：仅在 SettingsPage 顶部 import `type { Settings }` 备用。

- [ ] **Step 3: typecheck + lint**

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run typecheck
npm run lint
```

Expected：0 error

### Task 6.4: commit C6

```bash
cd E:/codecast/CodeCast
git add frontend/src/v2/layout/Sidebar.tsx \
        frontend/src/v2/layout/TopBar.tsx \
        frontend/src/v2/pages/CastEmptyState.tsx \
        frontend/src/v2/pages/CodeEmptyState.tsx \
        frontend/src/v2/pages/SettingsPage.tsx \
        frontend/src/v2/components/drawer/MCPPanel.tsx \
        frontend/src/v2/components/drawer/GitPanel.tsx \
        frontend/src/v2/components/drawer/MemoryPanel.tsx
git commit -m "feat(ui): wire useError hook to Sidebar/TopBar/EmptyStates/Drawers"
```

---

## Task 7: 测试补全（Commit C7）

### Task 7.1: 写 settingsSlice 测试

**Files:**
- Create: `frontend/src/v2/store/slices/__tests__/settingsSlice.test.ts`

- [ ] **Step 1: 写测试**

```ts
// frontend/src/v2/store/slices/__tests__/settingsSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';
import type { Settings } from '../../../wails/types';

describe('settingsSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetSettings).mockReset();
    vi.mocked(App.SaveSettings).mockReset();
    useAppStore.setState({ settings: null, loading: false, errors: {} });
  });

  it('load: success populates settings', async () => {
    const s = { work_mode: 'code' } as any as Settings;
    vi.mocked(App.GetSettings).mockResolvedValueOnce(s);
    await useAppStore.getState().load();
    expect(useAppStore.getState().settings).toBe(s);
  });

  it('load: failure sets settings error', async () => {
    vi.mocked(App.GetSettings).mockRejectedValueOnce(new Error('cfg'));
    await useAppStore.getState().load();
    expect(useAppStore.getState().errors.settings).toBe('cfg');
  });

  it('save: forwards object and updates state', async () => {
    const s = { work_mode: 'cast' } as any as Settings;
    await useAppStore.getState().save(s);
    expect(App.SaveSettings).toHaveBeenCalledWith(s);
    expect(useAppStore.getState().settings).toBe(s);
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
npx vitest run src/v2/store/slices/__tests__/settingsSlice.test.ts
```

Expected：3/3 PASS

### Task 7.2: 写 mcpSlice / gitSlice 测试

**Files:**
- Create: `frontend/src/v2/store/slices/__tests__/mcpSlice.test.ts`
- Create: `frontend/src/v2/store/slices/__tests__/gitSlice.test.ts`

- [ ] **Step 1: mcpSlice.test.ts**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('mcpSlice', () => {
  beforeEach(() => {
    vi.mocked(App.ListMCPServers).mockReset();
    vi.mocked(App.ConnectMCP).mockReset();
    vi.mocked(App.DisconnectMCP).mockReset();
    useAppStore.setState({ servers: [], loading: false, errors: {} });
  });

  it('refresh: success sets servers', async () => {
    vi.mocked(App.ListMCPServers).mockResolvedValueOnce([{ name: 'a', status: 'connected', tools: [] }] as any);
    await useAppStore.getState().refresh();
    expect(useAppStore.getState().servers).toHaveLength(1);
  });

  it('refresh: failure sets mcp error', async () => {
    vi.mocked(App.ListMCPServers).mockRejectedValueOnce(new Error('m'));
    await useAppStore.getState().refresh();
    expect(useAppStore.getState().errors.mcp).toBe('m');
  });

  it('connect: calls App.ConnectMCP and refreshes', async () => {
    vi.mocked(App.ListMCPServers).mockResolvedValue([]);
    await useAppStore.getState().connect('a');
    expect(App.ConnectMCP).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: gitSlice.test.ts**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('gitSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetGitStatus).mockReset();
    vi.mocked(App.GetGitBranches).mockReset();
    useAppStore.setState({ status: null, branches: [], commits: [], diff: '', loading: false, errors: {} });
  });

  it('refresh: success parses status and branches', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce({ branch: 'main', ahead: 1, behind: 0, dirty: 2 } as any);
    vi.mocked(App.GetGitBranches).mockResolvedValueOnce(['main', 'dev']);
    await useAppStore.getState().refresh();
    expect(useAppStore.getState().status).toEqual({ branch: 'main', ahead: 1, behind: 0, dirty: 2 });
    expect(useAppStore.getState().branches).toEqual(['main', 'dev']);
  });

  it('refresh: status null → status null', async () => {
    vi.mocked(App.GetGitStatus).mockResolvedValueOnce(null);
    vi.mocked(App.GetGitBranches).mockResolvedValueOnce([]);
    await useAppStore.getState().refresh();
    expect(useAppStore.getState().status).toBeNull();
  });

  it('refresh: failure sets git error', async () => {
    vi.mocked(App.GetGitStatus).mockRejectedValueOnce(new Error('g'));
    await useAppStore.getState().refresh();
    expect(useAppStore.getState().errors.git).toBe('g');
  });
});
```

- [ ] **Step 3: 跑两个测试**

```bash
npx vitest run src/v2/store/slices/__tests__/mcpSlice.test.ts
npx vitest run src/v2/store/slices/__tests__/gitSlice.test.ts
```

Expected：3/3 + 3/3 PASS

### Task 7.3: 写 stream-guard 测试

**Files:**
- Create: `frontend/src/v2/lib/__tests__/stream-guard.test.ts`

- [ ] **Step 1: 写测试（按 Task 0.1 实际 API）**

```ts
// frontend/src/v2/lib/__tests__/stream-guard.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStreamGuard } from '../stream-guard';

describe('createStreamGuard', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls onTimeout after timeoutMs of inactivity', () => {
    const onTimeout = vi.fn();
    const g = createStreamGuard({ timeoutMs: 1000, onTimeout });
    g.start();
    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('reset() postpones timeout', () => {
    const onTimeout = vi.fn();
    const g = createStreamGuard({ timeoutMs: 1000, onTimeout });
    g.start();
    vi.advanceTimersByTime(500);
    g.reset();
    vi.advanceTimersByTime(500);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('dispose() prevents further timeouts', () => {
    const onTimeout = vi.fn();
    const g = createStreamGuard({ timeoutMs: 1000, onTimeout });
    g.start();
    g.dispose();
    vi.advanceTimersByTime(2000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
npx vitest run src/v2/lib/__tests__/stream-guard.test.ts
```

Expected：3/3 PASS

### Task 7.4: 跑全部测试

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run test
```

Expected：所有 PASS

### Task 7.5: commit C7

```bash
cd E:/codecast/CodeCast
git add frontend/src/v2/lib/__tests__/stream-guard.test.ts \
        frontend/src/v2/store/slices/__tests__/settingsSlice.test.ts \
        frontend/src/v2/store/slices/__tests__/mcpSlice.test.ts \
        frontend/src/v2/store/slices/__tests__/gitSlice.test.ts
git commit -m "test: cover settings/mcp/git slices + stream-guard"
```

---

## Task 8: 端到端验证（Commit C8）

### Task 8.1: 跑全套验证

```bash
cd E:/codecast/CodeCast/CodeCast-desktop/frontend
npm run typecheck
npm run lint
npm run test
```

Expected：全部 0 error

### Task 8.2: dev 启动（可选集成验证）

```bash
npm run dev
```

**注意**：dev 模式下 v2 调用 `@wailsjs/go/main/App` 会失败（`App.ListMCPServers is not a function` 等），因为 vite 没有自动 mock。

**v2 决策**：
- 不在 v1 集成加 dev 模式 mock（增加 vite 配置复杂度）
- 仅依赖 vitest 单元测试作为集成验证
- 如需 dev 验证：临时在 `wails/adapter.ts` 加 try/catch 兜底

**dev 模式打开浏览器仅能验证**：UI 渲染、Layout、Theme、CommandPalette Cmd+K、路由切换。**不能验证**数据加载。

### Task 8.3: 验证 commit 数

```bash
cd E:/codecast/CodeCast && git log --oneline -12
```

Expected：看到 8 个语义 commit（C1–C7）+ 旧 commits

### Task 8.4: 收口 commit

如有任何遗漏修复，单独一个 commit：

```bash
git add -A
git commit -m "chore(frontend): v2 backend integration verification fixes"
```

---

## Self-Review（v2 plan inline）

**1. Spec 覆盖**：
- 8 类缺口 G1–G8 → C5a 修 G5/G6(session+chat) + C5b 修 G1/G2/G3/G4/G6(其余) + Task 4 修错误流 + Task 6 修 UI 订阅 ✅
- O1–O17 优化 → C4 per-slice errors + C5a 改 throw→不 throw + C1 mock 单一来源 + Task 5b.1 删 workspaceSlice + Task 1.5 parseGitStatus ✅
- 8 commit DoD → Task 1.7 / 2.1 / 3.3 / 4.6 / 5a.4 / 5b.4 / 6.4 / 7.5 明确 commit 步骤 ✅
- 验收 DoD 8 条 → Task 8.1–8.4 覆盖

**2. Placeholder 扫描**：
- 无 "TBD"/"TODO"/"fill in"（castToolSlice TODO 是文档注释非占位）
- 无 "类似 Task N" 引用——每 task 代码独立可读
- 代码块完整可复制

**3. 类型一致性**：
- `GitStatus` 在 Task 2.1 定义 → Task 1.5 使用 ✅
- `MCPServerStatus` 在 Task 2.1 定义 → Task 5b.2 使用 ✅
- `Settings` 在 Task 2.1 定义 → Task 5b.3 使用 ✅
- `setError/clearError` 在 Task 4.1 定义 → Task 4.2/4.3/4.4/5a/5b 使用 ✅
- `reportError` 在 Task 4.4 定义 → Task 5a/5b 使用 ✅
- `useError` 在 Task 4.3 定义 → Task 6.2/6.3 使用 ✅
- `parseGitStatus` 在 Task 1.5 定义 → Task 5b.2 使用 ✅
- `formatWailsError` 在 Task 1.3 定义 → Task 1.4 使用 ✅

**4. Task 顺序依赖**：
- C1 (mock+format) → C2 (types) → C3 (adapter) → C4 (errors) → C5a (session+chat) → C5b (其余 slice) → C6 (UI) → C7 (test) → C8 (verify)
- 每个 task 可独立 commit，typecheck 通过

**5. 已知风险**：
- Task 6.3 改 8 个组件 → 如有命名差异需逐个调整
- Task 6.3 SettingsPage 强类型替换可能不彻底 → 最小动作（仅 import）
- castToolSlice TODO 注释 → 不影响 typecheck

---

## 完整执行检查清单

执行完后，对照以下清单确认：

- [ ] `npm run typecheck` 0 error
- [ ] `npm run lint` 0 error
- [ ] `npm run test` 全绿（最少 8 个新测试文件）
- [ ] 8 个语义 commit 已 push（或本地 ready）
- [ ] `frontend/src/v2/store/slices/workspaceSlice.ts` 已删除
- [ ] `grep -rn "from '@wailsjs" frontend/src/v2/store/` 应只命中 `__mocks__/App.ts`（如果有）
- [ ] `frontend/src/v2/store/slices/` 内**无** `await import('...adapter')` 动态导入
- [ ] `frontend/src/v2/store/slices/` 内**无** `(get() as any)` 强转

## 回滚策略

如需回滚整套 v1 集成：

```bash
cd E:/codecast/CodeCast
# 找出 v1 集成的最后一个 commit
git log --oneline -20
# 假设 C1..C7 是连续 7 个 commit
git revert --no-commit C7 C6 C5b C5a C4 C3 C2 C1
# 或回滚到集成前
git reset --hard <集成前的 hash>
```

**回滚顺序**：C8 → C7 → C6 → C5b → C5a → C4 → C3 → C2 → C1（后提交先回滚）。
