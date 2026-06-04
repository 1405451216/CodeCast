# CodeCast Deferred Medium Issues — 修复实施文档

**编制日期**: 2026-06-05
**项目**: CodeCast Desktop (Go + Wails v2)
**范围**: 7 个 deferred Medium 级别问题 (M4, M6, M8, M13, M16, M18, M19)

---

## 概览

本文档针对代码审查中标记为 deferred 的 7 个 Medium 级别问题，逐一给出现状分析、根因诊断、分步实施方案、工作量估算和风险评估。这些问题因需要架构级重构而被推迟，建议在下一阶段技术债务清理中分批推进。

### 优先级排序

| 优先级 | 编号 | 问题 | 工作量 | 用户影响 |
|--------|------|------|--------|----------|
| P0 | M6 | 全局变量无持久化，重启丢失用户数据 | 3-5 天 | 高 — 定时任务/待办/插件重启即失 |
| P1 | M19 | go.mod replace 本地路径，CI 不可复现 | 1-2 天 | 高 — 构建不可重现，协作受阻 |
| P2 | M18 | 核心文件零测试覆盖 (1760 行) | 3-4 天 | 中 — 回归风险高 |
| P3 | M4 | 锁约定不一致 | 2-3 天 | 中 — 潜在死锁/数据竞争 |
| P4 | M16 | 54 处 catch (e: any) 无类型收窄 | 1-2 天 | 低 — 类型安全隐患 |
| P5 | M8 | Windows %VAR% 转义无效 | 2-3 天 | 低 — 有 Sandbox 层缓解 |
| P6 | M13 | Zustand 巨型 store 无 middleware | 2-3 天 | 低 — 开发体验问题 |

**总估算工作量**: 14-22 人天

---

## M4 — 锁约定不一致

### 现状

项目中 `a.mu` (sync.RWMutex) 存在两种使用模式：

- **自锁模式** (~60+ 方法): 方法内部自行 `a.mu.Lock()` / `a.mu.RLock()`，如 `GetSettings()`, `SendMessageEx()`
- **调用方锁模式** (9 方法): 要求调用方持有锁，方法内部不加锁

调用方锁模式使用了 **三种不同的信号机制**，且不一致：

| 信号方式 | 方法 | 风险 |
|----------|------|------|
| `Locked` 后缀命名 | `findModelConfigLocked()`, `resolveCredentialsLocked()`, `getSessionByIDLocked()`, `getCurrentProjectLocked()`, `cancelSessionRequestsLocked()` | 低 — 命名即约定 |
| 仅靠注释 | `createProvider()`, `createCachedProvider()`, `createMultimodalProvider()` | 高 — 无命名提示 |
| 模糊文档 | `persistSession()` — "caller must either hold a.mu or pass a snapshot" | 高 — OR 条件易误读 |

### 根因

项目快速迭代过程中，`createProvider()` 因为内部调用 `resolveCredentialsLocked()` 而被迫采用调用方锁模式，但没有统一命名规范。`startup()` 中需要 6 次加锁/解锁来适配这些方法的不同约定。

### 已知隐患

1. `persistSession()` 通过 `go a.persistSession(session)` 在 `CreateSession()` 中异步调用，goroutine 执行时锁已释放，但读取的是 live session 指针——存在数据竞争
2. `createProvider()` 无 `Locked` 后缀，新开发者可能不知道需要持锁

### 实施方案

**Phase 1: 命名统一 (0.5 天)**

将所有调用方锁方法统一加 `Locked` 后缀：

```go
// Before
func (a *App) createProvider(modelOverride string) (ap.Provider, error)
func (a *App) createCachedProvider() (ap.Provider, error)
func (a *App) createMultimodalProvider() (ap.Provider, error)

// After
func (a *App) createProviderLocked(modelOverride string) (ap.Provider, error)
func (a *App) createCachedProviderLocked() (ap.Provider, error)
func (a *App) createMultimodalProviderLocked() (ap.Provider, error)
```

更新所有调用点（约 8 处）。

**Phase 2: persistSession 数据竞争修复 (0.5 天)**

将 `persistSession` 的参数改为值拷贝：

```go
// session.go — CreateSession 中
func (a *App) CreateSession(...) *Session {
    // ...
    sessionCopy := *session // 值拷贝
    go a.persistSession(&sessionCopy)
    // ...
}
```

或直接移除 OR 条件注释，改为明确的 `// Caller MUST hold a.mu at call time`。

**Phase 3: 锁约定文档 (0.5 天)**

在 `main.go` 或独立 `CONCURRENCY.md` 中添加锁约定规范：

```markdown
## 锁约定

- **默认**: 所有 public 方法自行获取 `a.mu`，调用方无需持锁
- **`Locked` 后缀**: 方法要求调用方已持有 `a.mu`，方法内部不再加锁
- **`sync.RWMutex` 不可重入**: 持有写锁时不能再 RLock，持有读锁时不能 Lock
```

**Phase 4 (可选): staticcheck 自定义规则 (1 天)**

编写 `synccheck` linter 规则，检测 `Locked` 后缀方法是否在未持锁的上下文中被调用。可参考 `golang.org/x/tools/go/analysis` 框架。

### 工作量: 2-3 天

---

## M6 — 包级全局变量无持久化

### 现状

8 个包级全局变量持有运行时用户数据，其中 6 个无任何持久化机制：

| 变量 | 文件 | 数据 | 重启丢失影响 |
|------|------|------|-------------|
| `todoStore` | `cast_tools_todo.go:30` | `map[string]*castTodoItem` | **高** — 所有待办事项 |
| `globalScheduleStore` | `cast_tools_schedule.go:37` | `*castScheduleStore` | **高** — 所有定时任务 |
| `pluginStore` | `cast_tools_plugin.go:15` | `map[string]*castPluginInfo` | **中** — 已安装插件 |
| `securityEvents` | `cast_tools_security.go:13` | `[]castSecurityEvent` | **中** — 安全审计日志 |
| `securityStats` | `cast_tools_security.go:14` | `castSecurityStats` | **中** — 安全统计计数 |
| `learningPatterns` | `cast_tools_learning.go:14` | `map[string]*castLearningPattern` | **低** — 学习模式 |
| `soulList` | `cast_tools_soul.go:13` | `[]*castSoulPersona` | **低** — IsActive 不同步 |
| `currentPomodoro` | `cast_tools_todo.go:33` | `*castPomodoroSession` | **无** — 临时计时器 |

代码中已有 TODO 注释承认此问题（如 `cast_tools_schedule.go:36`）。

### 根因

这些模块最初作为 demo/prototype 实现，使用内存 map 快速验证功能，未设计持久化层。

### 实施方案

**方案选型**: 推荐 **JSON 文件方案**（与现有 `persistence.go` 的 session 持久化模式一致），而非引入 SQLite 增加复杂度。

**Phase 1: 统一持久化接口 (1 天)**

创建 `cast_persistence.go`，定义统一接口：

```go
package main

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "sync"
)

// castPersistentStore 为 cast 工具提供 JSON 文件持久化
type castPersistentStore[T any] struct {
    mu       sync.RWMutex
    data     T
    filePath string
}

func newCastStore[T any](basePath, name string, initial T) *castPersistentStore[T] {
    s := &castPersistentStore[T]{
        data:     initial,
        filePath: filepath.Join(basePath, name+".json"),
    }
    s.load()
    return s
}

func (s *castPersistentStore[T]) load() {
    b, err := os.ReadFile(s.filePath)
    if err != nil {
        return // 首次启动，使用 initial 值
    }
    _ = json.Unmarshal(b, &s.data)
}

// save 使用原子写入（tmp + rename）防止崩溃损坏
func (s *castPersistentStore[T]) save() {
    b, _ := json.MarshalIndent(s.data, "", "  ")
    tmp := s.filePath + ".tmp"
    _ = os.WriteFile(tmp, b, 0600)
    _ = os.Rename(tmp, s.filePath)
}

func (s *castPersistentStore[T]) Get(fn func(T)) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    fn(s.data)
}

func (s *castPersistentStore[T]) Mutate(fn func(T)) {
    s.mu.Lock()
    defer s.mu.Unlock()
    fn(s.data)
    s.save()
}
```

**Phase 2: 迁移各 store (2 天)**

逐个替换全局变量：

```go
// Before (cast_tools_todo.go)
var todoStore = map[string]*castTodoItem{}

// After
var todoStore *castPersistentStore[map[string]*castTodoItem]

// 在 App.startup() 中初始化
func (a *App) initCastStores() {
    basePath := filepath.Join(a.settingsDir, "cast_data")
    os.MkdirAll(basePath, 0700)
    todoStore = newCastStore(basePath, "todos", map[string]*castTodoItem{})
    globalScheduleStore = newCastStore(basePath, "schedules", &castScheduleStore{Tasks: map[string]*castScheduleTask{}})
    // ... 其余 store
}
```

**Phase 3: soulList 同步修复 (0.5 天)**

在 `initCastStores()` 中，从 `a.settings.Personality` 同步 `soulList` 的 `IsActive` 标记：

```go
for _, p := range soulList {
    p.IsActive = (p.ID == a.settings.Personality)
}
```

### 工作量: 3-5 天

---

## M8 — Windows %VAR% 环境变量转义无效

### 现状

`sanitizeWindowsCommand()` 在 `shell.go:374-428` 中将裸 `%` 转义为 `%%`，但 `cmd.exe` 在不同上下文下对 `%%` 的处理不一致：

| 上下文 | `%%` 行为 | `echo %%USERNAME%%` 结果 |
|--------|-----------|------------------------|
| `cmd /C` (交互模式) | 不缩减 | 输出 `%%USERNAME%%` — 变量未展开（安全但输出错误）|
| 批处理 / FOR 循环 | `%%` → `%` | 展开为 `%USERNAME%` → 泄露变量值 |
| 双重 shell | 外层剥一层 | 内层看到 `%VAR%` → 泄露 |

此外，引号内的 `%` 完全不转义（`echo "%USERNAME%"` 直接泄露）。

`redactSensitiveOutput()` 中也有 `break` 导致同一 secret 前缀只脱敏首次出现。

### 根因

`cmd.exe` 的变量展开是 shell 解析阶段的行为，应用层无法在传递命令字符串时完全阻止。`%%` 转义设计初衷是批处理 FOR 循环语法，不适用于 `cmd /C` 场景。

### 实施方案

**方案选型**: 推荐 **Shell 切换方案** — Windows 上将命令分发从 `cmd.exe` 切换到 `powershell.exe -NoProfile -Command`，避免 cmd.exe 的 `%VAR%` 展开行为。

**Phase 1: 切换 Windows shell 到 PowerShell (1 天)**

```go
// shell.go — 修改命令分发
var shell, flag string
if runtime.GOOS == "windows" {
    shell = "powershell"
    flag = "-NoProfile"
    // 命令需要包装为 -Command 参数
} else {
    // 保持不变
}
```

注意：PowerShell 使用 `$env:VAR` 语法而非 `%VAR%`，`%` 在 PowerShell 中是 `ForEach-Object` 的别名，不会触发环境变量展开。

**Phase 2: 适配命令净化逻辑 (1 天)**

为 PowerShell 编写新的 `sanitizePowerShellCommand()` 函数：
- `$` 变量引用转义（反引号 `` ` `` 前缀）
- 禁止 `Invoke-Expression`、`Start-Process` 等危险 cmdlet
- 更新 Sandbox 命令白名单/黑名单

**Phase 3: 修复 redactSensitiveOutput (0.5 天)**

```go
// 移除 break，使用 strings.ReplaceAll 或正则替换所有匹配
for _, prefix := range keyPrefixes {
    // 使用 ReplaceAllFunc 替换所有出现
    for {
        idx := strings.Index(output, prefix)
        if idx == -1 { break }
        end := idx + len(prefix)
        for end < len(output) && isTokenChar(output[end]) { end++ }
        output = output[:idx] + prefix + "***REDACTED***" + output[end:]
        // 跳过已替换的部分，避免死循环
        break // 改为继续搜索剩余部分
    }
}
```

**Phase 4: 补充测试 (0.5 天)**

添加引号内 `%` 的测试用例，以及 PowerShell 转义的单元测试。

### 工作量: 2-3 天

### 风险

- 部分 Windows 命令语法在 PowerShell 中不兼容（如 `dir` vs `Get-ChildItem`）
- 用户已有的 cmd.exe 特定命令可能需要适配
- 需验证 Sandbox 层在 PowerShell 模式下的有效性

---

## M13 — Zustand 巨型 Store 无 Middleware

### 现状

`store/index.ts` 将 20 个 slice 合并为单一 `useAppStore`，123 行组合代码，无 `devtools` / `persist` / `immer` middleware。同时存在 4 个独立 store（`useKnowledgeStore` 等）使用了 `devtools`，造成不一致。

`ModelSlice` (426 行) 实现了自己的加密 localStorage 持久化，绕过了 Zustand 的 `persist` middleware。

### 根因

项目初期为快速原型将所有状态放入单一 store，后续新增功能时独立 store 成为例外。

### 实施方案

**Phase 1: 为 combined store 添加 devtools (0.5 天)**

```typescript
// index.ts
import { devtools } from 'zustand/middleware'

export const useAppStore = create<AppState>()(
  devtools(
    (set, get, api) => ({
      ...SessionSlice(set, get),
      ...ProjectSlice(set, get),
      // ... 其余 18 个 slice
      isStreaming: false,
      setIsStreaming: (v: boolean) => set({ isStreaming: v }),
    }),
    { name: 'CodeCast-AppStore' }
  )
)
```

这不影响功能，但可以在 React DevTools 中实时查看状态变化。

**Phase 2: 拆分最大 slice (1 天)**

将 `ModelSlice` (426 行) 拆分为：
- `useModelConfigStore` — provider 配置、模型选择
- `useModelConnectionStore` — 连接状态、token 用量

**Phase 3: 统一 middleware 策略 (1 天)**

将 4 个独立 store 也统一 devtools 配置，考虑添加 `persist` middleware 替换 `ModelSlice` 的手动持久化。

### 工作量: 2-3 天

---

## M16 — 54 处 catch (e: any) 无类型收窄

### 现状

全项目 14 个 `.ts/.tsx` 文件中有 54 处 `catch (e: any)`：

| 文件 | 数量 | 占比 |
|------|------|------|
| `GitWorkflow.tsx` | 20 | 37% |
| `AutomationPanel.tsx` | 9 | 17% |
| `AutoFixPipeline.tsx` | 7 | 13% |
| `multiFileOps.ts` | 5 | 9% |
| `AgentLoopEngine.tsx` | 3 | 6% |
| 其余 9 个文件 | 10 | 18% |

### 根因

开发时为快速实现功能使用 `any` 类型，后续未统一重构。

### 实施方案

**Phase 1: 定义统一错误类型 (0.5 天)**

```typescript
// utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function toError(e: unknown): Error {
  if (e instanceof Error) return e
  if (typeof e === 'string') return new Error(e)
  return new Error(String(e))
}
```

**Phase 2: 按文件批量替换 (1 天)**

```typescript
// Before
catch (e: any) {
  console.error(e.message)
}

// After
catch (e: unknown) {
  const err = toError(e)
  console.error(err.message)
}
```

按文件出现频次排序处理：GitWorkflow (20) → AutomationPanel (9) → AutoFixPipeline (7) → multiFileOps (5) → AgentLoopEngine (3) → 其余。

**Phase 3: tsconfig 严格化 (0.5 天)**

在 `tsconfig.json` 中启用：

```json
{
  "compilerOptions": {
    "useUnknownInCatchVariables": true
  }
}
```

这将使 TypeScript 编译器强制 `catch (e)` 中的 `e` 为 `unknown` 类型，从根源防止 `any` 回归。

### 工作量: 1-2 天

---

## M18 — 核心文件零测试覆盖

### 现状

4 个核心文件共 1760 行、50 个函数，无任何 `_test.go` 文件：

| 文件 | 行数 | 函数数 | 导出函数 | 间接覆盖 |
|------|------|--------|----------|----------|
| `updater.go` | 906 | 24 | 10 | 无 |
| `shell.go` | 464 | 12 | 2 | 部分 (via security_test.go) |
| `notification.go` | 202 | 11 | 11 | 无 |
| `chat.go` | 188 | 3 | 2 | 无 |

### 根因

这些文件依赖 Wails runtime、外部进程或 LLM provider，mock 成本较高。纯函数部分（如 `compareVersions`、`sanitizeWindowsCommand`）本应优先覆盖但被忽略。

### 实施方案

**Phase 1: 纯函数测试 — 零 mock 成本 (1 天)**

```go
// updater_test.go — 版本比较
func TestCompareVersions(t *testing.T) {
    t.Parallel()
    cases := []struct{ a, b string; want int }{
        {"1.0.0", "1.0.1", -1},
        {"2.0.0", "1.9.9", 1},
        {"1.0.0", "1.0.0", 0},
        {"1.10.0", "1.9.0", 1},
    }
    for _, tc := range cases {
        got := compareVersions(tc.a, tc.b)
        if got != tc.want {
            t.Errorf("compareVersions(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
        }
    }
}

// shell_test.go — 命令净化（补充现有 security_test.go 的间接覆盖）
func TestRedactSensitiveOutput(t *testing.T) {
    t.Parallel()
    // ...
}

func TestMaskSensitiveValue(t *testing.T) {
    t.Parallel()
    // ...
}

func TestExtractCommandName(t *testing.T) {
    t.Parallel()
    // ...
}
```

预计可覆盖 ~15 个纯函数。

**Phase 2: 接口 mock 测试 (1.5 天)**

为 `chat.go` 编写测试，mock AP Agent 接口：

```go
// chat_test.go
type mockAgent struct {
    streamCh chan ap.StreamEvent
}

func (m *mockAgent) StreamRun(ctx context.Context, msg ap.Message) (<-chan ap.StreamEvent, error) {
    return m.streamCh, nil
}

func TestSendMessageEx_StreamsTokens(t *testing.T) {
    // 设置 mock agent → 发送消息 → 验证事件序列
}

func TestGetOrCreateAgent_CachesPerSession(t *testing.T) {
    // 验证同一 session 返回相同 agent
}
```

**Phase 3: notification.go 测试 (0.5 天)**

Notification 函数主要是 Wails runtime 调用，使用 interface mock：

```go
// notification_test.go
func TestSendNotification_FormatsMessage(t *testing.T) {
    // 测试通知文本格式化逻辑
}
```

**Phase 4: updater.go HTTP 测试 (1 天)**

使用 `httptest.Server` 测试下载逻辑：

```go
func TestSilentDownload_Success(t *testing.T) {
    ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("fake binary content"))
    }))
    defer ts.Close()
    // ...
}

func TestSilentDownload_CancelOnContextDone(t *testing.T) {
    // 验证 M21 修复的 context 取消逻辑
}
```

### 工作量: 3-4 天

---

## M19 — go.mod replace 本地路径

### 现状

`go.mod:51`:

```
replace agentprimordia => ../../agentprimordia/agentprimordia
```

要求 `agentprimordia` 模块位于项目目录的上两级 `../../agentprimordia/agentprimordia`。CI 和其他开发者 clone 后必须手动创建此目录结构才能编译。

### 根因

`agentprimordia` 框架尚未发布为公开 Go module，处于与 CodeCast 并行开发阶段。

### 实施方案

**方案 A: 发布为私有 Go Module (推荐)**

**Phase 1: agentprimordia 仓库初始化 (0.5 天)**

1. 为 `agentprimordia` 创建独立 Git 仓库
2. 添加 `go.mod` 声明 module 路径（如 `github.com/yourorg/agentprimordia`）
3. 打 tag `v0.1.0`

**Phase 2: CodeCast 引用更新 (0.5 天)**

```go
// go.mod — Before
require agentprimordia v0.0.0-00010101000000-000000000000
replace agentprimordia => ../../agentprimordia/agentprimordia

// go.mod — After
require github.com/yourorg/agentprimordia v0.1.0
// replace 指令移除
```

**Phase 3: CI 配置认证 (0.5 天)**

```yaml
# .github/workflows/ci.yml
- name: Configure Go private module access
  run: |
    git config --global url."https://${{ secrets.GO_MODULE_TOKEN }}@github.com".insteadOf "https://github.com"
  env:
    GOPRIVATE: github.com/yourorg/agentprimordia
```

**方案 B: Go Workspace (过渡方案)**

如果暂不发布，使用 Go 1.18+ workspace 模式：

```go
// go.work (项目根目录)
go 1.26

use (
    ./CodeCast-desktop
    ../agentprimordia/agentprimordia
)
```

`go.work` 不进入版本控制（加入 `.gitignore`），每位开发者本地创建。`go.mod` 中使用正式版本号（非零值伪版本），CI 通过 `go.work` 提供本地路径。

### 工作量: 1-2 天

---

## 依赖关系与推荐执行顺序

```
Phase 1 (第 1 周)
├── M19: go.mod replace → 解除构建瓶颈
├── M4 Phase 1-2: 锁命名统一 + persistSession 修复 → 消除已知竞争
└── M18 Phase 1: 纯函数测试 → 建立安全网

Phase 2 (第 2 周)
├── M6 Phase 1-2: 持久化 store → 解决数据丢失
├── M16 Phase 1-2: catch 类型收窄 → 前端类型安全
└── M18 Phase 2-4: mock 测试 → 提升覆盖率

Phase 3 (第 3 周)
├── M8 Phase 1-3: PowerShell 切换 → 安全加固
├── M13 Phase 1-2: devtools + store 拆分 → 开发体验
└── M18 补充 + M6 Phase 3: 收尾
```

## 验收标准

| 编号 | 验收条件 |
|------|----------|
| M4 | 所有 caller-locked 方法带 `Locked` 后缀；`persistSession` 无数据竞争（`go test -race` 通过）|
| M6 | `todoStore` / `globalScheduleStore` / `pluginStore` 重启后数据恢复；`go vet` 通过 |
| M8 | Windows 上 `echo %USERNAME%` 不泄露值；`sanitizePowerShellCommand` 单元测试全绿 |
| M13 | `useAppStore` 带 devtools；`ModelSlice` < 200 行；React DevTools 可查看状态 |
| M16 | 零 `catch (e: any)`；`useUnknownInCatchVariables: true` 编译通过 |
| M18 | 4 个文件各有 ≥5 个测试函数；`go test -cover` 显示 ≥30% 覆盖率 |
| M19 | CI 无需本地 `../../agentprimordia` 目录即可构建；`go build` 成功 |
