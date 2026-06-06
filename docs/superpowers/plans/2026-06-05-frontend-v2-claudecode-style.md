# Frontend v2 · Claude Code Desktop Style · 实施计划 v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Status**: v2 (反思优化版，源自 v1 自我反思 **P1–P14 优化**)

**Goal:** 在保留 CodeCast 全部后端能力（Cast 30+ 工具 / 记忆 / Git / MCP / Agent / Checkpoint）的前提下，把前端重写为 Claude Code 桌面端风格（极简 / 工具感 / 双主题 / 三列布局）。

**Architecture:** Big-bang 重写到 `src/v2/`，独立目录 + 独立 Vite 入口；旧 `src/` 文件保留但不再被构建（v2 GA + 14 天后整目录删除）。状态层用 12 个 Zustand slice；Wails bindings 通过 `wails/adapter.ts` 包装；事件流通过 `wails/events.ts` 订阅；AP TS SDK 仅消费类型，不引入 runtime。

**Tech Stack:**
- React 18 + TypeScript 5.5
- Vite 5.4
- Zustand 4.5（slice pattern）
- cmdk 1.x（命令面板）
- @radix-ui/react-dialog 1.x（命令面板基座）
- react-router-dom 6.x（路由）
- react-markdown 9.x + remark-gfm 4.x
- IBM Plex Sans / Plex Serif / JetBrains Mono（自托管 woff2）
- highlight.js 11.x（v1 已有，**不引入 shiki**）
- @sentry/react 10.x
- vitest 2.x + @testing-library/react 14.x
- @playwright/test（E2E + 视觉回归）
- @axe-core/playwright 4.x（A11y）

**Reference:**
- 设计文档：[docs/superpowers/specs/2026-06-05-frontend-v2-claudecode-style-design.md](file:///e:/codecast/CodeCast/docs/superpowers/specs/2026-06-05-frontend-v2-claudecode-style-design.md)
- 前端根目录：`CodeCast-desktop/frontend/`
- Wails 自动生成：`CodeCast-desktop/frontend/wailsjs/`（**不手改**）

---

## 反思：v1 → v2 优化清单（已应用）

| # | v1 缺失 | v2 修复 |
|---|---------|---------|
| **P1** | 缺 MessageMarkdown 组件 | 新增 Task 2.4 |
| **P2** | 缺 DiffView 组件 | 新增 Task 2.6 |
| **P3** | 缺 StatusDot 组件 | 新增 Task 2.2 |
| **P4** | 缺 primitives (Button/Kbd/Tooltip/Popover/Toast) | 新增 Task 1.4 |
| **P5** | 9 个 slice 仅占位无 Wails 接入 | Task 3.2 完整接入 |
| **P6** | chatSlice 无测试 | Task 3.2 增加 store 集成测试 |
| **P7** | 缺 lib 工具 (format/streaming/i18n-keys) | 新增 Task 1.5、1.6 |
| **P8** | 缺 Drawer 4 个面板 | 新增 Task 4.3 |
| **P9** | 缺 ChatArea 组件 | Task 1.7 增加 |
| **P10** | DoD 不完整 | 强化 DoD + 新增 Task 5.5、5.6 |
| **P11** | 缺 v1→v2 切换 PR | 新增 Task 5.5 |
| **P12** | 缺 CHANGELOG | 新增 Task 5.5 |
| **P13** | 缺 SlashCommandMenu/AttachmentList/SessionList/DrawerTabs 等 | 全部新增 |
| **P14** | E2E 用 page.route mock 不可靠 | 改用 window.__TEST_HOOK__ 注入（Task 5.1） |

---

## 文件结构（先于任务）

### 新建
- `src/v2/`
  - `main.tsx` / `App.tsx` / `v2_entry.ts`
  - `design/{tokens.ts, theme.ts, fonts.css, variables.css, reset.css}`
  - `layout/{TopBar, Sidebar, ChatArea, Drawer, BottomBar, WorkspaceFrame}.tsx`
  - `pages/{ChatPage, CastEmptyState, CastPanel, CastWritingPage, CastTranslationPage, CastKnotePage, CastSchedulePage, CastEmailPage, CastToolsPage, SettingsPage}.tsx`
  - `components/composer/{Composer, SlashCommandMenu, AttachmentList}.tsx`
  - `components/message/{MessageStream, MessageItem, MessageMarkdown, CodeBlock, DiffView, ToolCallList, ToolCallItem, ApprovalCard, StatusDot, InterruptedNotice}.tsx`
  - `components/session/{SessionList, SessionItem, WorkspaceSwitcher}.tsx`
  - `components/drawer/{DrawerTabs, FileTree, GitPanel, MCPPanel, MemoryPanel}.tsx`
  - `components/bottombar/{ModelBadge, ContextBar, PlanToggle}.tsx`
  - `components/command/CommandPalette.tsx`
  - `components/primitives/{Button, Kbd, Tooltip, Popover, Toast}.tsx`
  - `store/{index, selectors}.ts` + `store/slices/*.ts`（12 个）
  - `wails/{adapter, events, types}.ts`
  - `lib/{hotkeys, streaming, format, sentry, stream-guard, theme-toggle}.ts(x)`
  - `i18n-keys/{zh, en, index}.ts`
- `public/fonts/{IBMPlexSans-Var, IBMPlexSerif-Var, JetBrainsMono-Var}.woff2`
- `src/v2/__tests__/`（单元 + 集成测试）
- `e2e/v2/`（E2E + 视觉回归 + a11y）

### 修改
- `vite.config.ts` — `build.rollupOptions.input` 指向 `src/v2/v2_entry.ts`
- `package.json` — 加 cmdk / @radix-ui/react-dialog / sentry / react-router-dom / react-markdown / remark-gfm / @axe-core/playwright
- `index.html` — `<script type="module" src="/src/v2/v2_entry.ts">`（v2 GA 时切换）
- `CHANGELOG.md` — 新增 v2.0.0 条目

### 不动（契约）
- `wailsjs/`（自动生成）
- `src/i18n/`（v1 复用）
- Go 端 / AP 框架

---

## Phase 1 · 骨架（4 天）

### Task 1.1：建立 v2 目录与 Vite 入口

**Files:**
- Create: `frontend/src/v2/v2_entry.ts`
- Create: `frontend/src/v2/main.tsx`
- Create: `frontend/src/v2/App.tsx`
- Create: `frontend/src/v2/design/reset.css`
- Create: `frontend/src/v2/design/variables.css`
- Create: `frontend/src/v2/design/fonts.css`（占位）
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/index.html`

- [ ] **Step 1: 创建 v2_entry.ts**

```ts
// frontend/src/v2/v2_entry.ts
import './design/reset.css';
import './design/fonts.css';
import './design/variables.css';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<StrictMode><App /></StrictMode>);
```

- [ ] **Step 2: 创建 main.tsx**

```ts
// frontend/src/v2/main.tsx
export { App } from './App';
```

- [ ] **Step 3: 创建空 App.tsx**

```tsx
// frontend/src/v2/App.tsx
import { useEffect } from 'react';
import { initSentry } from './lib/sentry';
import { applyTheme, getStoredTheme } from './design/theme';

initSentry();

export function App() {
  useEffect(() => { applyTheme(getStoredTheme()); }, []);
  return <div data-theme="light" style={{ minHeight: '100vh' }}>CodeCast v2 booting…</div>;
}
```

- [ ] **Step 4: reset.css**

```css
/* frontend/src/v2/design/reset.css */
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
button { font: inherit; }
```

- [ ] **Step 5: variables.css**

```css
/* frontend/src/v2/design/variables.css */
:root { --c-bg: #FAF9F5; --c-text: #1F1E1B; --c-border: #E5E3DD; }
[data-theme="dark"] { --c-bg: #1B1A17; --c-text: #F0EEE5; --c-border: #2E2C27; }
body { background: var(--c-bg); color: var(--c-text); }
```

- [ ] **Step 6: fonts.css 占位**

```css
/* frontend/src/v2/design/fonts.css — 占位 */
```

- [ ] **Step 7: 修改 vite.config.ts（保持 v1 入口直到 v2 GA）**

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: 'index.html' } } },
});
```

- [ ] **Step 8: 修改 index.html**

```html
<script type="module" src="/src/v2/v2_entry.ts"></script>
```

- [ ] **Step 9: 验证 v2 启动**

Run: `cd frontend && npm run dev`
Expected: 浏览器看到 "CodeCast v2 booting…"

- [ ] **Step 10: 提交**

```bash
git checkout -b feature/frontend-v2
git add frontend/src/v2 frontend/vite.config.ts frontend/index.html
git commit -m "feat(v2): scaffold v2 entry, App, design/* placeholders"
```

---

### Task 1.2：design tokens + theme（含 CSS 变量双导出）

**Files:**
- Create: `frontend/src/v2/design/tokens.ts`
- Create: `frontend/src/v2/design/theme.ts`
- Create: `frontend/src/v2/__tests__/tokens.test.ts`
- Create: `frontend/src/v2/__tests__/theme.test.ts`

- [ ] **Step 1: tokens 失败测试**

```ts
// frontend/src/v2/__tests__/tokens.test.ts
import { light, dark, radius, font } from '../design/tokens';

describe('design tokens', () => {
  test('light has all required keys', () => {
    ['bg', 'bgSub', 'surface', 'border', 'text', 'accent', 'success', 'warn', 'danger']
      .forEach(k => expect(light).toHaveProperty(k));
  });
  test('dark matches light shape', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });
  test('radius ≤ 8px', () => {
    expect(parseInt(radius.md)).toBeLessThanOrEqual(8);
  });
  test('font contains IBM Plex + JetBrains Mono', () => {
    expect(font.sans).toMatch(/IBM Plex Sans/);
    expect(font.serif).toMatch(/IBM Plex Serif/);
    expect(font.mono).toMatch(/JetBrains Mono/);
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `cd frontend && npx vitest run src/v2/__tests__/tokens.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 tokens.ts**

```ts
// frontend/src/v2/design/tokens.ts
export const light = {
  bg: '#FAF9F5', bgSub: '#F2F0E9', surface: '#FFFFFF',
  border: '#E5E3DD', borderStrong: '#D6D3C9',
  text: '#1F1E1B', textSub: '#6B6862', textMute: '#9A968D',
  accent: '#DA7756', accentBg: '#F5E5DC', accentText: '#8C3A1A',
  success: '#3A8266', warn: '#C4923C', danger: '#C4533C',
} as const;

export const dark: typeof light = {
  bg: '#1B1A17', bgSub: '#26241F', surface: '#1F1E1B',
  border: '#2E2C27', borderStrong: '#3A3832',
  text: '#F0EEE5', textSub: '#B5B0A4', textMute: '#7A766C',
  accent: '#E08766', accentBg: '#3A2A22', accentText: '#F0B097',
  success: '#5A9D80', warn: '#D4A65A', danger: '#D86A52',
};

export const radius = { sm: '4px', md: '6px', lg: '8px' } as const;
export const shadow = 'none';
export const font = {
  serif: '"IBM Plex Serif", Georgia, serif',
  sans:  '"IBM Plex Sans", "PingFang SC", -apple-system, system-ui, sans-serif',
  mono:  '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
} as const;
```

- [ ] **Step 4: 跑测试通过**

Run: `npx vitest run src/v2/__tests__/tokens.test.ts`
Expected: 4 passed

- [ ] **Step 5: theme 测试**

```ts
// frontend/src/v2/__tests__/theme.test.ts
import { applyTheme, getStoredTheme, setStoredTheme } from '../design/theme';

describe('theme', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); document.documentElement.style.cssText = ''; });
  test('applyTheme("dark") sets data-theme + CSS vars', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--c-bg')).toBeTruthy();
  });
  test('getStoredTheme defaults to light', () => { expect(getStoredTheme()).toBe('light'); });
  test('setStoredTheme roundtrip', () => { setStoredTheme('dark'); expect(getStoredTheme()).toBe('dark'); });
});
```

- [ ] **Step 6: 实现 theme.ts**

```ts
// frontend/src/v2/design/theme.ts
import { light, dark } from './tokens';
const KEY = 'codecast.v2.theme';
export function applyTheme(theme: 'light' | 'dark') {
  const c = theme === 'light' ? light : dark;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  Object.entries(c).forEach(([k, v]) => root.style.setProperty(`--c-${k}`, v));
}
export function setStoredTheme(theme: 'light' | 'dark') { localStorage.setItem(KEY, theme); applyTheme(theme); }
export function getStoredTheme(): 'light' | 'dark' { return (localStorage.getItem(KEY) as 'light' | 'dark') || 'light'; }
```

- [ ] **Step 7: 跑测试通过**

Run: `npx vitest run src/v2/__tests__/theme.test.ts`
Expected: 3 passed

- [ ] **Step 8: 全量 typecheck + test**

Run: `npm run typecheck && npm run test`

- [ ] **Step 9: 提交**

```bash
git add frontend/src/v2/design frontend/src/v2/__tests__
git commit -m "feat(v2): design tokens (light/dark) + theme runtime"
```

---

### Task 1.3：自托管字体加载

**Files:**
- Create: `frontend/public/fonts/IBMPlexSans-Var.woff2`（手动下载）
- Create: `frontend/public/fonts/IBMPlexSerif-Var.woff2`（手动下载）
- Create: `frontend/public/fonts/JetBrainsMono-Var.woff2`（手动下载）
- Modify: `frontend/src/v2/design/fonts.css`
- Modify: `frontend/index.html`

- [ ] **Step 1: 下载 3 套变量字体到 public/fonts/**

> 手工操作：
> - `https://github.com/IBM/plex/raw/master/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSansVar-Roman.woff2` → `public/fonts/IBMPlexSans-Var.woff2`
> - `https://github.com/IBM/plex/raw/master/IBM-Plex-Serif/fonts/complete/woff2/IBMPlexSerifVar-Roman.woff2` → `public/fonts/IBMPlexSerif-Var.woff2`
> - `https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/webfonts/JetBrainsMono-Regular.woff2` → `public/fonts/JetBrainsMono-Var.woff2`

- [ ] **Step 2: fonts.css**

```css
/* frontend/src/v2/design/fonts.css */
@font-face { font-family: 'IBM Plex Sans'; font-weight: 300 700; font-style: normal; font-display: swap; src: url('/fonts/IBMPlexSans-Var.woff2') format('woff2-variations'); unicode-range: U+0000-00FF, U+4E00-9FFF; }
@font-face { font-family: 'IBM Plex Serif'; font-weight: 400 700; font-style: normal; font-display: swap; src: url('/fonts/IBMPlexSerif-Var.woff2') format('woff2-variations'); unicode-range: U+0000-00FF; }
@font-face { font-family: 'JetBrains Mono'; font-weight: 400 700; font-style: normal; font-display: swap; src: url('/fonts/JetBrainsMono-Var.woff2') format('woff2-variations'); unicode-range: U+0000-00FF, U+4E00-9FFF; }
body { font-family: var(--font-sans, 'IBM Plex Sans', sans-serif); }
h1, h2, h3 { font-family: var(--font-serif, 'IBM Plex Serif', Georgia, serif); }
code, pre, .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }
```

- [ ] **Step 3: index.html 加 preload**

```html
<link rel="preload" href="/fonts/IBMPlexSans-Var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/JetBrainsMono-Var.woff2" as="font" type="font/woff2" crossorigin>
```

- [ ] **Step 4: 验证字体生效**

Run: `npm run dev`
Expected: DevTools → Network → 字体加载

- [ ] **Step 5: 提交**

```bash
git add frontend/public/fonts frontend/src/v2/design/fonts.css frontend/index.html
git commit -m "feat(v2): self-hosted IBM Plex + JetBrains Mono"
```

---

### Task 1.4：primitives 基础组件（P4）

**Files:**
- Create: `frontend/src/v2/components/primitives/Button.tsx`
- Create: `frontend/src/v2/components/primitives/Kbd.tsx`
- Create: `frontend/src/v2/components/primitives/Tooltip.tsx`
- Create: `frontend/src/v2/components/primitives/Popover.tsx`
- Create: `frontend/src/v2/components/primitives/Toast.tsx`
- Create: `frontend/src/v2/__tests__/Button.test.tsx`
- Create: `frontend/src/v2/__tests__/Kbd.test.tsx`
- Create: `frontend/src/v2/__tests__/Tooltip.test.tsx`
- Create: `frontend/src/v2/__tests__/Popover.test.tsx`
- Create: `frontend/src/v2/__tests__/Toast.test.tsx`

- [ ] **Step 1: Button 测试 + 实现**

```tsx
// frontend/src/v2/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/primitives/Button';

describe('Button', () => {
  test('renders with text', () => { render(<Button>Click</Button>); expect(screen.getByRole('button')).toBeInTheDocument(); });
  test('disabled prevents click', () => { const fn = vi.fn(); render(<Button disabled onClick={fn}>x</Button>); fireEvent.click(screen.getByRole('button')); expect(fn).not.toHaveBeenCalled(); });
  test('variant primary uses accent bg', () => { render(<Button variant="primary">x</Button>); expect(screen.getByRole('button')).toHaveStyle({ background: 'var(--c-accent)' }); });
});
```

```tsx
// frontend/src/v2/components/primitives/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; children: ReactNode; }
const vs: Record<Variant, React.CSSProperties> = {
  primary:   { background: 'var(--c-accent)', color: '#fff', border: '1px solid var(--c-accent)' },
  secondary: { background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)' },
  ghost:     { background: 'transparent', color: 'var(--c-textSub)', border: '1px solid transparent' },
  danger:    { background: 'var(--c-danger)', color: '#fff', border: '1px solid var(--c-danger)' },
};
export function Button({ variant = 'secondary', style, children, ...rest }: Props) {
  return <button {...rest} style={{ padding: '4px 12px', borderRadius: 4, fontSize: 13, cursor: 'pointer', ...vs[variant], ...style }}>{children}</button>;
}
```

- [ ] **Step 2: Kbd 测试 + 实现**

```tsx
// frontend/src/v2/__tests__/Kbd.test.tsx
import { render, screen } from '@testing-library/react';
import { Kbd } from '../components/primitives/Kbd';
test('renders shortcut text as <kbd>', () => { render(<Kbd>⌘K</Kbd>); expect(screen.getByText('⌘K').tagName).toBe('KBD'); });
```

```tsx
// frontend/src/v2/components/primitives/Kbd.tsx
import type { ReactNode } from 'react';
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd style={{ padding: '1px 6px', fontSize: 11, border: '1px solid var(--c-border)', borderRadius: 4, background: 'var(--c-bgSub)', color: 'var(--c-textSub)', fontFamily: 'var(--font-mono, monospace)' }}>{children}</kbd>;
}
```

- [ ] **Step 3: Tooltip 测试 + 实现**

```tsx
// frontend/src/v2/__tests__/Tooltip.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../components/primitives/Tooltip';
test('shows on hover hides on leave', () => {
  render(<Tooltip text="hi"><span>t</span></Tooltip>);
  expect(screen.queryByText('hi')).not.toBeInTheDocument();
  fireEvent.mouseEnter(screen.getByText('t'));
  expect(screen.getByText('hi')).toBeInTheDocument();
  fireEvent.mouseLeave(screen.getByText('t'));
  expect(screen.queryByText('hi')).not.toBeInTheDocument();
});
```

```tsx
// frontend/src/v2/components/primitives/Tooltip.tsx
import { useState, type ReactNode } from 'react';
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <span style={{ position: 'relative', display: 'inline-block' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    {children}
    {open && <span role="tooltip" style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, padding: '2px 8px', fontSize: 11, background: 'var(--c-text)', color: 'var(--c-bg)', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 100 }}>{text}</span>}
  </span>;
}
```

- [ ] **Step 4: Popover 测试 + 实现**

```tsx
// frontend/src/v2/__tests__/Popover.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Popover } from '../components/primitives/Popover';
test('toggles on click closes on outside', () => {
  render(<div><Popover trigger={<button>open</button>}>content</Popover><div data-testid="out">x</div></div>);
  expect(screen.queryByText('content')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('open'));
  expect(screen.getByText('content')).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByTestId('out'));
  expect(screen.queryByText('content')).not.toBeInTheDocument();
});
```

```tsx
// frontend/src/v2/components/primitives/Popover.tsx
import { useState, useRef, useEffect, type ReactNode } from 'react';
export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  return <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
    <span onClick={() => setOpen(o => !o)}>{trigger}</span>
    {open && <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 6, padding: 8, minWidth: 200, zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>{children}</div>}
  </div>;
}
```

- [ ] **Step 5: Toast 测试 + 实现**

```tsx
// frontend/src/v2/__tests__/Toast.test.tsx
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/primitives/Toast';
function Demo() { const t = useToast(); return <button onClick={() => t.show('hi', 'success')}>go</button>; }
test('toast renders and auto-dismisses', () => {
  jest.useFakeTimers();
  render(<ToastProvider><Demo /></ToastProvider>);
  act(() => { screen.getByText('go').click(); });
  expect(screen.getByText('hi')).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.queryByText('hi')).not.toBeInTheDocument();
});
```

```tsx
// frontend/src/v2/components/primitives/Toast.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
type Kind = 'info' | 'success' | 'warn' | 'danger';
interface TItem { id: number; text: string; kind: Kind }
const Ctx = createContext<{ show: (text: string, kind?: Kind) => void }>({ show: () => {} });
export function useToast() { return useContext(Ctx); }
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TItem[]>([]);
  const show = useCallback((text: string, kind: Kind = 'info') => { const id = Date.now(); setItems(s => [...s, { id, text, kind }]); setTimeout(() => setItems(s => s.filter(x => x.id !== id)), 3000); }, []);
  return <Ctx.Provider value={{ show }}>{children}<div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
    {items.map(t => <div key={t.id} style={{ padding: '8px 12px', borderRadius: 6, fontSize: 13, background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderLeft: `3px solid var(--c-${t.kind === 'info' ? 'accent' : t.kind})`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>{t.text}</div>)}
  </div></Ctx.Provider>;
}
```

- [ ] **Step 6: 全量 primitives 测试**

Run: `npx vitest run src/v2/__tests__/Button.test.tsx src/v2/__tests__/Kbd.test.tsx src/v2/__tests__/Tooltip.test.tsx src/v2/__tests__/Popover.test.tsx src/v2/__tests__/Toast.test.tsx`
Expected: 3+1+1+1+1 = 7 passed

- [ ] **Step 7: 提交**

```bash
git add frontend/src/v2/components/primitives frontend/src/v2/__tests__
git commit -m "feat(v2): primitives (Button/Kbd/Tooltip/Popover/Toast)"
```

---

### Task 1.5：lib 工具 — hotkeys / streaming / format（P7）

**Files:**
- Create: `frontend/src/v2/lib/hotkeys.ts`
- Create: `frontend/src/v2/lib/streaming.ts`
- Create: `frontend/src/v2/lib/format.ts`
- Create: `frontend/src/v2/__tests__/hotkeys.test.ts`
- Create: `frontend/src/v2/__tests__/streaming.test.ts`
- Create: `frontend/src/v2/__tests__/format.test.ts`

- [ ] **Step 1: hotkeys 测试 + 实现**

```ts
// frontend/src/v2/__tests__/hotkeys.test.ts
import { registerHotkey, unregisterAll } from '../lib/hotkeys';
describe('hotkeys', () => {
  afterEach(() => unregisterAll());
  test('mod+k triggers', () => { const fn = vi.fn(); registerHotkey('mod+k', fn); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); expect(fn).toHaveBeenCalled(); });
  test('unregistered does not trigger', () => { const fn = vi.fn(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); expect(fn).not.toHaveBeenCalled(); });
});
```

```ts
// frontend/src/v2/lib/hotkeys.ts
type Handler = (e: KeyboardEvent) => void;
const handlers = new Map<string, Handler>();
function parseCombo(combo: string) { const p = combo.toLowerCase().split('+'); return { key: p[p.length-1], mod: p.includes('mod')||p.includes('cmd')||p.includes('ctrl'), shift: p.includes('shift'), alt: p.includes('alt') }; }
export function registerHotkey(combo: string, fn: Handler) { handlers.set(combo, fn); }
export function unregisterHotkey(combo: string) { handlers.delete(combo); }
export function unregisterAll() { handlers.clear(); }
if (typeof document !== 'undefined') { document.addEventListener('keydown', (e) => { for (const [combo, fn] of handlers) { const p = parseCombo(combo); const k = e.key.toLowerCase(); if (k===p.key && (p.mod?(e.metaKey||e.ctrlKey):true) && (p.shift?e.shiftKey:!e.shiftKey) && (p.alt?e.altKey:!e.altKey)) { e.preventDefault(); fn(e); } } }); }
```

- [ ] **Step 2: streaming 测试 + 实现**

```ts
// frontend/src/v2/__tests__/streaming.test.ts
import { createStreamBuffer, flushBuffer } from '../lib/streaming';
describe('streaming', () => {
  test('flushes on size threshold', () => { const buf = createStreamBuffer({ flushSize: 3, flushIntervalMs: 1000 }); const f: string[] = []; buf.onFlush = s => f.push(s); buf.push('a'); buf.push('b'); buf.push('c'); expect(f).toEqual(['abc']); });
  test('flushes on interval', () => { jest.useFakeTimers(); const buf = createStreamBuffer({ flushSize: 100, flushIntervalMs: 200 }); const f: string[] = []; buf.onFlush = s => f.push(s); buf.push('a'); jest.advanceTimersByTime(250); expect(f).toEqual(['a']); });
});
```

```ts
// frontend/src/v2/lib/streaming.ts
export interface StreamBuffer { push: (chunk: string) => void; onFlush: (s: string) => void; dispose: () => void; }
export function createStreamBuffer(opts: { flushSize: number; flushIntervalMs: number }): StreamBuffer {
  let pending = ''; let timer: ReturnType<typeof setInterval> | null = null;
  const buf: StreamBuffer = { push(chunk: string) { pending += chunk; if (pending.length >= opts.flushSize) { buf.onFlush(pending); pending = ''; } }, onFlush: () => {}, dispose() { if (timer) clearInterval(timer); pending = ''; } };
  if (typeof setInterval !== 'undefined') { timer = setInterval(() => { if (pending) { buf.onFlush(pending); pending = ''; } }, opts.flushIntervalMs); }
  return buf;
}
export function flushBuffer(chunks: string[]): string { return chunks.join(''); }
```

- [ ] **Step 3: format 测试 + 实现**

```ts
// frontend/src/v2/__tests__/format.test.ts
import { formatBytes, formatDuration, formatRelativeTime } from '../lib/format';
describe('format', () => {
  test('formatBytes', () => { expect(formatBytes(0)).toBe('0 B'); expect(formatBytes(1024)).toBe('1.0 KB'); expect(formatBytes(1048576)).toBe('1.0 MB'); });
  test('formatDuration', () => { expect(formatDuration(24)).toBe('24ms'); expect(formatDuration(1500)).toBe('1.5s'); expect(formatDuration(65000)).toBe('1m5s'); });
  test('formatRelativeTime', () => { const now = Date.now(); expect(formatRelativeTime(now - 30000, now)).toMatch(/刚刚|30秒前/); });
});
```

```ts
// frontend/src/v2/lib/format.ts
export function formatBytes(n: number): string { if (n < 1024) return `${n} B`; const u = ['KB','MB','GB','TB']; let v = n/1024, i = 0; while (v >= 1024 && i < u.length-1) { v /= 1024; i++; } return `${v.toFixed(1)} ${u[i]}`; }
export function formatDuration(ms: number): string { if (ms < 1000) return `${ms}ms`; if (ms < 60000) return `${(ms/1000).toFixed(1)}s`; return `${Math.floor(ms/60000)}m${Math.floor((ms%60000)/1000)}s`; }
export function formatRelativeTime(ts: number, now = Date.now()): string { const d = now - ts; if (d < 60000) return '刚刚'; if (d < 3600000) return `${Math.floor(d/60000)} 分钟前`; if (d < 86400000) return `${Math.floor(d/3600000)} 小时前`; return `${Math.floor(d/86400000)} 天前`; }
```

- [ ] **Step 4: 跑测试 + 提交**

Run: `npx vitest run src/v2/__tests__/hotkeys.test.ts src/v2/__tests__/streaming.test.ts src/v2/__tests__/format.test.ts`
Expected: 2+2+3 = 7 passed

```bash
git add frontend/src/v2/lib frontend/src/v2/__tests__
git commit -m "feat(v2): lib utilities (hotkeys/streaming/format)"
```

---

### Task 1.6：i18n 增量文案（P7）

**Files:**
- Create: `frontend/src/v2/i18n-keys/zh.ts`
- Create: `frontend/src/v2/i18n-keys/en.ts`
- Create: `frontend/src/v2/i18n-keys/index.ts`
- Modify: `frontend/src/i18n/index.ts`

- [ ] **Step 1: zh.ts**

```ts
// frontend/src/v2/i18n-keys/zh.ts
export const v2zh = {
  composer: { placeholder: '发消息 · ⌘⇧P 切换 Plan 模式', send: '发送', cancel: '取消', plan: 'Plan' },
  empty: { title: '今天做什么？', hints: ['/写周报', '/翻译', '/笔记', '/日程', '/番茄钟'] },
  approval: { approve: '同意', reject: '拒绝', prompt: (tool: string, target: string) => `需要批准 ${tool} 操作 ${target}？` },
  errors: { streamInterrupted: '流式响应中断（60 秒无内容）', retry: '继续', toolFailed: (name: string) => `工具 ${name} 执行失败` },
  drawer: { tabs: { files: 'Files', git: 'Git', mcp: 'MCP', memory: 'Memory' } },
  cast: { writing: '写作', translation: '翻译', knowledge: '知识库', schedule: '日程', email: '邮件', tools: '工具箱' },
} as const;
```

- [ ] **Step 2: en.ts**

```ts
// frontend/src/v2/i18n-keys/en.ts
import type { v2zh } from './zh';
export const v2en: typeof v2zh = {
  composer: { placeholder: 'Send message · ⌘⇧P toggle Plan mode', send: 'Send', cancel: 'Cancel', plan: 'Plan' },
  empty: { title: 'What will you do today?', hints: ['/weekly-report', '/translate', '/note', '/schedule', '/pomodoro'] },
  approval: { approve: 'Approve', reject: 'Reject', prompt: (tool: string, target: string) => `Approve ${tool} on ${target}?` },
  errors: { streamInterrupted: 'Stream interrupted (60s no chunk)', retry: 'Resume', toolFailed: (name: string) => `Tool ${name} failed` },
  drawer: { tabs: { files: 'Files', git: 'Git', mcp: 'MCP', memory: 'Memory' } },
  cast: { writing: 'Writing', translation: 'Translation', knowledge: 'Knowledge', schedule: 'Schedule', email: 'Email', tools: 'Tools' },
};
```

- [ ] **Step 3: index.ts + 合并到 src/i18n/index.ts**

```ts
// frontend/src/v2/i18n-keys/index.ts
export { v2zh } from './zh';
export { v2en } from './en';
```

> 修改 `frontend/src/i18n/index.ts`：import v2zh/v2en 并合并到主 dict

- [ ] **Step 4: typecheck + 提交**

Run: `npm run typecheck`

```bash
git add frontend/src/v2/i18n-keys frontend/src/i18n/index.ts
git commit -m "feat(v2): i18n keys (zh/en) + merge into v1 i18n"
```

---

### Task 1.7：WorkspaceFrame + 5 布局组件 + ThemeToggle（P9）

**Files:**
- Create: `frontend/src/v2/layout/WorkspaceFrame.tsx`
- Create: `frontend/src/v2/layout/TopBar.tsx`
- Create: `frontend/src/v2/layout/Sidebar.tsx`
- Create: `frontend/src/v2/layout/ChatArea.tsx`
- Create: `frontend/src/v2/layout/Drawer.tsx`
- Create: `frontend/src/v2/layout/BottomBar.tsx`
- Create: `frontend/src/v2/lib/theme-toggle.tsx`
- Create: `frontend/src/v2/__tests__/WorkspaceFrame.test.tsx`
- Create: `frontend/src/v2/__tests__/theme-toggle.test.tsx`
- Modify: `frontend/src/v2/App.tsx`

- [ ] **Step 1: WorkspaceFrame 测试 + 实现**

```tsx
// frontend/src/v2/__tests__/WorkspaceFrame.test.tsx
import { render, screen } from '@testing-library/react';
import { WorkspaceFrame } from '../layout/WorkspaceFrame';
test('renders 5 slots', () => {
  render(<WorkspaceFrame top={<div data-testid="t"/>} sidebar={<div data-testid="s"/>} chat={<div data-testid="c"/>} drawer={<div data-testid="d"/>} bottom={<div data-testid="b"/>} />);
  ['t','s','c','d','b'].forEach(id => expect(screen.getByTestId(id)).toBeInTheDocument());
});
```

```tsx
// frontend/src/v2/layout/WorkspaceFrame.tsx
import type { ReactNode } from 'react';
interface Props { top: ReactNode; sidebar: ReactNode; chat: ReactNode; drawer: ReactNode; bottom: ReactNode; }
export function WorkspaceFrame({ top, sidebar, chat, drawer, bottom }: Props) {
  return <div style={{ display: 'grid', gridTemplateRows: '48px 1fr 28px', gridTemplateColumns: '280px 1fr 280px', gridTemplateAreas: `"top top top" "side chat drawer" "bot bot bot"`, height: '100vh', width: '100vw', overflow: 'hidden' }}>
    <div style={{ gridArea: 'top', borderBottom: '1px solid var(--c-border)' }}>{top}</div>
    <div style={{ gridArea: 'side', borderRight: '1px solid var(--c-border)', overflow: 'auto' }}>{sidebar}</div>
    <div style={{ gridArea: 'chat', overflow: 'hidden' }}>{chat}</div>
    <div style={{ gridArea: 'drawer', borderLeft: '1px solid var(--c-border)', overflow: 'auto' }}>{drawer}</div>
    <div style={{ gridArea: 'bot', borderTop: '1px solid var(--c-border)' }}>{bottom}</div>
  </div>;
}
```

- [ ] **Step 2: TopBar（含 ThemeToggle + Kbd）**

```tsx
// frontend/src/v2/layout/TopBar.tsx
import { ThemeToggle } from '../lib/theme-toggle';
import { Kbd } from '../components/primitives/Kbd';
export function TopBar() {
  return <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 16px', gap: 16, fontSize: 14 }}>
    <strong style={{ fontFamily: 'var(--font-serif, serif)' }}>CodeCast</strong>
    <span style={{ color: 'var(--c-textMute)' }}>·</span>
    <span style={{ color: 'var(--c-textSub)' }}>main</span>
    <div style={{ flex: 1 }} />
    <ThemeToggle />
    <Kbd>⌘K</Kbd>
  </div>;
}
```

- [ ] **Step 3: Sidebar / ChatArea / Drawer / BottomBar 占位**

```tsx
// frontend/src/v2/layout/Sidebar.tsx
export function Sidebar() {
  return <nav style={{ padding: 12, fontSize: 13, color: 'var(--c-textSub)' }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Chats</div>
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      <li style={{ padding: '6px 8px', borderRadius: 4 }}>新对话 1</li>
      <li style={{ padding: '6px 8px', borderRadius: 4 }}>新对话 2</li>
    </ul>
  </nav>;
}
```

```tsx
// frontend/src/v2/layout/ChatArea.tsx
import type { ReactNode } from 'react';
export function ChatArea({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>{children}</div>;
}
```

```tsx
// frontend/src/v2/layout/Drawer.tsx
export function Drawer() {
  return <div style={{ padding: 12, fontSize: 13 }}>
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid var(--c-border)' }}>
      {['Files', 'Git', 'MCP', 'Memory'].map(t => <span key={t} style={{ padding: '4px 8px', color: 'var(--c-textMute)' }}>{t}</span>)}
    </div>
    <div style={{ color: 'var(--c-textMute)' }}>drawer content（v2.1 填充）</div>
  </div>;
}
```

```tsx
// frontend/src/v2/layout/BottomBar.tsx
export function BottomBar() {
  return <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 12px', fontSize: 12, color: 'var(--c-textMute)', gap: 12 }}>
    <span>Opus 4.5</span><span>·</span><span>context 0/200k</span>
    <div style={{ flex: 1 }} /><span>Plan</span><span>·</span><span>v2.0.0</span>
  </div>;
}
```

- [ ] **Step 4: ThemeToggle 测试 + 实现**

```tsx
// frontend/src/v2/__tests__/theme-toggle.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../lib/theme-toggle';
describe('ThemeToggle', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });
  test('renders button', () => { render(<ThemeToggle />); expect(screen.getByRole('button')).toBeInTheDocument(); });
  test('click toggles theme', () => { render(<ThemeToggle />); fireEvent.click(screen.getByRole('button')); expect(['light','dark']).toContain(document.documentElement.getAttribute('data-theme')); });
});
```

```tsx
// frontend/src/v2/lib/theme-toggle.tsx
import { useEffect, useState } from 'react';
import { getStoredTheme, setStoredTheme } from '../design/theme';
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light'|'dark'>(getStoredTheme());
  useEffect(() => { setStoredTheme(theme); }, [theme]);
  return <button type="button" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} aria-label="切换主题" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-textSub)', fontSize: 14 }}>{theme === 'light' ? '🌙' : '☀'}</button>;
}
```

- [ ] **Step 5: App.tsx 接入 WorkspaceFrame**

```tsx
// frontend/src/v2/App.tsx
import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { initSentry } from './lib/sentry';
import { applyTheme, getStoredTheme } from './design/theme';
import { WorkspaceFrame } from './layout/WorkspaceFrame';
import { TopBar } from './layout/TopBar';
import { Sidebar } from './layout/Sidebar';
import { Drawer } from './layout/Drawer';
import { BottomBar } from './layout/BottomBar';
import { ChatArea } from './layout/ChatArea';

initSentry();

export const App = Sentry.withErrorBoundary(function App() {
  useEffect(() => { applyTheme(getStoredTheme()); }, []);
  return <WorkspaceFrame top={<TopBar />} sidebar={<Sidebar />} chat={<ChatArea><div style={{ padding: 24 }}>MessageStream placeholder</div></ChatArea>} drawer={<Drawer />} bottom={<BottomBar />} />;
}, { fallback: <div>Something went wrong.</div> });
```

- [ ] **Step 6: 验证 + 提交**

Run: `npm run dev` + vitest

```bash
git add frontend/src/v2/layout frontend/src/v2/lib/theme-toggle.tsx frontend/src/v2/App.tsx frontend/src/v2/__tests__
git commit -m "feat(v2): WorkspaceFrame + 5 layout components + ThemeToggle"
```

---

## Phase 2 · 核心对话组件（5 天）

### Task 2.1：Composer + SlashCommandMenu + AttachmentList（P13）

**Files:**
- Create: `frontend/src/v2/components/composer/Composer.tsx`
- Create: `frontend/src/v2/components/composer/SlashCommandMenu.tsx`
- Create: `frontend/src/v2/components/composer/AttachmentList.tsx`
- Create: `frontend/src/v2/__tests__/Composer.test.tsx`

- [ ] **Step 1: Composer 测试**

```tsx
// frontend/src/v2/__tests__/Composer.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Composer } from '../components/composer/Composer';
describe('Composer', () => {
  test('renders textarea', () => { render(<Composer sessionId="s" model="opus" thinking={false} onSend={()=>{}} onCancel={()=>{}} />); expect(screen.getByRole('textbox')).toBeInTheDocument(); });
  test('Cmd+Enter sends', () => { const fn = vi.fn(); render(<Composer sessionId="s" model="opus" thinking={false} onSend={fn} onCancel={()=>{}} />); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hi' } }); fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', metaKey: true }); expect(fn).toHaveBeenCalledWith('hi', { model: 'opus', thinking: false }); });
  test('Enter alone does not send', () => { const fn = vi.fn(); render(<Composer sessionId="s" model="opus" thinking={false} onSend={fn} onCancel={()=>{}} />); fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' }); expect(fn).not.toHaveBeenCalled(); });
  test('Typing / shows SlashCommandMenu', () => { render(<Composer sessionId="s" model="opus" thinking={false} onSend={()=>{}} onCancel={()=>{}} />); fireEvent.change(screen.getByRole('textbox'), { target: { value: '/' } }); expect(screen.getByText(/写周报|翻译/)).toBeInTheDocument(); });
});
```

- [ ] **Step 2: SlashCommandMenu**

```tsx
// frontend/src/v2/components/composer/SlashCommandMenu.tsx
import { useState, useEffect } from 'react';
export interface SlashCommand { id: string; label: string; description: string; aliases?: string[] }
const COMMANDS: SlashCommand[] = [
  { id: 'weekly', label: '/写周报', description: '生成周报模板', aliases: ['/weekly'] },
  { id: 'translate', label: '/翻译', description: '中英互译', aliases: ['/translate'] },
  { id: 'note', label: '/笔记', description: '写入知识库', aliases: ['/note'] },
  { id: 'schedule', label: '/日程', description: '新建日程', aliases: ['/schedule'] },
  { id: 'pomodoro', label: '/番茄钟', description: '25 分钟专注', aliases: ['/pomodoro'] },
  { id: 'cast', label: '/cast', description: '打开 Cast 工作台', aliases: [] },
];
export function SlashCommandMenu({ query, onSelect }: { query: string; onSelect: (cmd: SlashCommand) => void }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const q = query.toLowerCase().replace(/^\//, '');
  const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.aliases?.some(a => a.toLowerCase().includes(q)));
  useEffect(() => { setActiveIdx(0); }, [q]);
  if (!filtered.length) return null;
  return <div role="listbox" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxHeight: 200, overflow: 'auto' }}>
    {filtered.map((c, i) => <div key={c.id} role="option" aria-selected={i===activeIdx} onClick={() => onSelect(c)} style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', background: i===activeIdx ? 'var(--c-bgSub)' : 'transparent', display: 'flex', justifyContent: 'space-between' }}>
      <span>{c.label}</span><span style={{ color: 'var(--c-textMute)', fontSize: 11 }}>{c.description}</span>
    </div>)}
  </div>;
}
export { COMMANDS };
```

- [ ] **Step 3: AttachmentList + Composer**

```tsx
// frontend/src/v2/components/composer/AttachmentList.tsx
export interface Attachment { id: string; name: string; size: number }
export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '4px 0' }}>
    {items.map(a => <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', fontSize: 11, borderRadius: 4, background: 'var(--c-bgSub)', color: 'var(--c-textSub)' }}>{a.name}<button type="button" onClick={() => onRemove(a.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-textMute)' }}>×</button></span>)}
  </div>;
}
```

```tsx
// frontend/src/v2/components/composer/Composer.tsx
import { useState } from 'react';
import { Button } from '../primitives/Button';
import { SlashCommandMenu } from './SlashCommandMenu';
import { AttachmentList, type Attachment } from './AttachmentList';
interface Props { sessionId: string; model: string; thinking: boolean; onSend: (text: string, opts?: { model?: string; thinking?: boolean }) => void; onCancel: () => void; attachments?: Attachment[]; onRemoveAttachment?: (id: string) => void; }
export function Composer({ model, thinking, onSend, onCancel, attachments = [], onRemoveAttachment }: Props) {
  const [text, setText] = useState('');
  const send = () => { if (!text.trim()) return; onSend(text, { model, thinking }); setText(''); };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, borderTop: '1px solid var(--c-border)', background: 'var(--c-surface)', position: 'relative' }}>
    <AttachmentList items={attachments} onRemove={onRemoveAttachment || (()=>{})} />
    {text.startsWith('/') && <SlashCommandMenu query={text} onSelect={cmd => setText(cmd.label + ' ')} />}
    <div style={{ display: 'flex', gap: 8 }}>
      <textarea aria-label="消息输入" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key==='Enter'&&(e.metaKey||e.ctrlKey)) { e.preventDefault(); send(); } }} placeholder="发消息 · ⌘↵ 发送" rows={1} style={{ flex: 1, resize: 'none', padding: 8, fontSize: 14, border: '1px solid var(--c-border)', borderRadius: 6, background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'inherit' }} />
      <Button variant="primary" onClick={send}>发送</Button>
      <Button variant="ghost" onClick={onCancel}>取消</Button>
    </div>
  </div>;
}
```

- [ ] **Step 4: 测试 + 提交**

Run: `npx vitest run src/v2/__tests__/Composer.test.tsx`
Expected: 4 passed

```bash
git add frontend/src/v2/components/composer frontend/src/v2/__tests__/Composer.test.tsx
git commit -m "feat(v2): Composer + SlashCommandMenu + AttachmentList"
```

---

### Task 2.2：StatusDot（P3）

**Files:**
- Create: `frontend/src/v2/components/message/StatusDot.tsx`
- Create: `frontend/src/v2/__tests__/StatusDot.test.tsx`

- [ ] **Step 1: 测试 + 实现**

```tsx
// frontend/src/v2/__tests__/StatusDot.test.tsx
import { render, screen } from '@testing-library/react';
import { StatusDot } from '../components/message/StatusDot';
describe('StatusDot', () => {
  test('running', () => { render(<StatusDot status="running" />); expect(screen.getByText('●')).toHaveStyle({ color: 'var(--c-accent)' }); });
  test('done', () => { render(<StatusDot status="done" />); expect(screen.getByText('✓')).toHaveStyle({ color: 'var(--c-success)' }); });
  test('paused', () => { render(<StatusDot status="paused" />); expect(screen.getByText('⏸')).toHaveStyle({ color: 'var(--c-warn)' }); });
  test('error', () => { render(<StatusDot status="error" />); expect(screen.getByText('✗')).toHaveStyle({ color: 'var(--c-danger)' }); });
});
```

```tsx
// frontend/src/v2/components/message/StatusDot.tsx
export type StatusKind = 'running' | 'done' | 'paused' | 'error';
const M: Record<StatusKind, { glyph: string; color: string }> = { running: { glyph: '●', color: 'var(--c-accent)' }, done: { glyph: '✓', color: 'var(--c-success)' }, paused: { glyph: '⏸', color: 'var(--c-warn)' }, error: { glyph: '✗', color: 'var(--c-danger)' } };
export function StatusDot({ status }: { status: StatusKind }) { const { glyph, color } = M[status]; return <span aria-label={status} style={{ color, fontSize: 11, lineHeight: 1 }}>{glyph}</span>; }
```

- [ ] **Step 2: 测试 + 提交**

Run: `npx vitest run src/v2/__tests__/StatusDot.test.tsx`
Expected: 4 passed

```bash
git add frontend/src/v2/components/message/StatusDot.tsx frontend/src/v2/__tests__/StatusDot.test.tsx
git commit -m "feat(v2): StatusDot (running/done/paused/error)"
```

---

### Task 2.3：MessageStream + MessageItem

**Files:**
- Create: `frontend/src/v2/components/message/MessageStream.tsx`
- Create: `frontend/src/v2/components/message/MessageItem.tsx`
- Create: `frontend/src/v2/__tests__/MessageStream.test.tsx`

- [ ] **Step 1: 测试**

```tsx
// frontend/src/v2/__tests__/MessageStream.test.tsx
import { render, screen } from '@testing-library/react';
import { MessageStream } from '../components/message/MessageStream';
describe('MessageStream', () => {
  test('renders messages', () => { render(<MessageStream sessionId="s" messages={[{id:'1',role:'user',content:'hi'},{id:'2',role:'assistant',content:'hello'}]} isStreaming={false} />); expect(screen.getByText('hi')).toBeInTheDocument(); expect(screen.getByText('hello')).toBeInTheDocument(); });
  test('max-width 760px centered', () => { const { container } = render(<MessageStream sessionId="s" messages={[]} isStreaming={false} />); expect((container.firstChild as HTMLElement).style.maxWidth).toBe('760px'); });
  test('aria-live when streaming', () => { const { container } = render(<MessageStream sessionId="s" messages={[]} isStreaming={true} />); expect((container.firstChild as HTMLElement).getAttribute('aria-live')).toBe('polite'); });
});
```

- [ ] **Step 2: MessageItem**

```tsx
// frontend/src/v2/components/message/MessageItem.tsx
import type { ReactNode } from 'react';
export interface Message { id: string; role: 'user' | 'assistant' | 'system'; content: string; reasoning?: string; toolCalls?: { id: string; name: string; args: string; result?: string }[]; pendingApproval?: { toolName: string; target: string; risk: 'low' | 'medium' | 'high' } }
interface Props { message: Message; children?: ReactNode }
export function MessageItem({ message }: Props) {
  const isUser = message.role === 'user';
  return <div style={{ padding: '12px 0', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
    <div style={{ width: 24, height: 24, borderRadius: 4, fontSize: 12, background: isUser ? 'var(--c-accentBg)' : 'var(--c-bgSub)', color: isUser ? 'var(--c-accentText)' : 'var(--c-textSub)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 500 }}>{isUser ? 'U' : 'A'}</div>
    <div style={{ flex: 1, fontSize: 14, lineHeight: 1.6, color: 'var(--c-text)' }}>{message.content}</div>
  </div>;
}
```

- [ ] **Step 3: MessageStream**

```tsx
// frontend/src/v2/components/message/MessageStream.tsx
import { MessageItem, type Message } from './MessageItem';
interface Props { sessionId: string; messages: Message[]; isStreaming: boolean }
export function MessageStream({ messages, isStreaming }: Props) {
  return <div data-stream aria-live={isStreaming ? 'polite' : 'off'} style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>{messages.map(m => <MessageItem key={m.id} message={m} />)}</div>;
}
```

- [ ] **Step 4: 测试 + 提交**

Run: `npx vitest run src/v2/__tests__/MessageStream.test.tsx`
Expected: 3 passed

```bash
git add frontend/src/v2/components/message/MessageStream.tsx frontend/src/v2/components/message/MessageItem.tsx frontend/src/v2/__tests__/MessageStream.test.tsx
git commit -m "feat(v2): MessageStream + MessageItem (max-w 760, aria-live)"
```

---

### Task 2.4：MessageMarkdown（P1）

**Files:**
- Create: `frontend/src/v2/components/message/MessageMarkdown.tsx`
- Create: `frontend/src/v2/__tests__/MessageMarkdown.test.tsx`

- [ ] **Step 1: 加依赖**

```bash
cd frontend && npm install react-markdown@^9 remark-gfm@^4
```

- [ ] **Step 2: 测试**

```tsx
// frontend/src/v2/__tests__/MessageMarkdown.test.tsx
import { render, screen } from '@testing-library/react';
import { MessageMarkdown } from '../components/message/MessageMarkdown';
describe('MessageMarkdown', () => {
  test('renders heading', () => { render(<MessageMarkdown source="# Title" />); expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title'); });
  test('renders bold/italic', () => { const { container } = render(<MessageMarkdown source="**bold** *italic*" />); expect(container.innerHTML).toMatch(/<strong>bold<\/strong>/); expect(container.innerHTML).toMatch(/<em>italic<\/em>/); });
  test('renders code block', () => { render(<MessageMarkdown source={'```ts\nconst x = 1;\n```'} />); expect(screen.getByText(/const x = 1/)).toBeInTheDocument(); });
  test('renders inline code', () => { const { container } = render(<MessageMarkdown source="use `foo()`" />); expect(container.querySelector('code')).toHaveTextContent('foo()'); });
  test('renders list', () => { const { container } = render(<MessageMarkdown source="- a\n- b" />); expect(container.querySelectorAll('li').length).toBe(2); });
});
```

- [ ] **Step 3: 实现**

```tsx
// frontend/src/v2/components/message/MessageMarkdown.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
export function MessageMarkdown({ source }: { source: string }) {
  return <div className="md" style={{ fontSize: 14, lineHeight: 1.6 }}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      code({ inline, className, children, ...props }: any) {
        const text = String(children).replace(/\n$/, '');
        const match = /language-(\w+)/.exec(className || '');
        if (!inline && match) return <CodeBlock code={text} language={match[1]} />;
        return <code className={className} style={{ padding: '1px 4px', fontSize: 12, background: 'var(--c-bgSub)', borderRadius: 3, fontFamily: 'var(--font-mono, monospace)' }} {...props}>{children}</code>;
      },
      a({ children, ...props }) { return <a {...props} target="_blank" rel="noreferrer" style={{ color: 'var(--c-accent)' }}>{children}</a>; },
    }}>{source}</ReactMarkdown>
  </div>;
}
```

- [ ] **Step 4: 测试 + 提交**

Run: `npx vitest run src/v2/__tests__/MessageMarkdown.test.tsx`
Expected: 5 passed

```bash
git add frontend/src/v2/components/message/MessageMarkdown.tsx frontend/src/v2/__tests__/MessageMarkdown.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat(v2): MessageMarkdown via react-markdown + remark-gfm"
```

---

### Task 2.5：CodeBlock（复用 v1 highlight.js）

**Files:**
- Create: `frontend/src/v2/components/message/CodeBlock.tsx`
- Create: `frontend/src/v2/__tests__/CodeBlock.test.tsx`

- [ ] **Step 1: 测试 + 实现（同 v1，略）**

> 参见设计文档 5.2 节。实现与 v1 Task 2.3 相同，此处不重复。

- [ ] **Step 2: 测试 + 提交**

Run: `npx vitest run src/v2/__tests__/CodeBlock.test.tsx`
Expected: 2 passed

```bash
git add frontend/src/v2/components/message/CodeBlock.tsx frontend/src/v2/__tests__/CodeBlock.test.tsx
git commit -m "feat(v2): CodeBlock (highlight.js + copy button)"
```

---

### Task 2.6：ToolCallItem + DiffView（P2） + ApprovalCard + ToolCallList

**Files:**
- Create: `frontend/src/v2/components/message/ToolCallItem.tsx`
- Create: `frontend/src/v2/components/message/DiffView.tsx`
- Create: `frontend/src/v2/components/message/ApprovalCard.tsx`
- Create: `frontend/src/v2/components/message/ToolCallList.tsx`
- Create: `frontend/src/v2/components/message/InterruptedNotice.tsx`
- Create: `frontend/src/v2/lib/stream-guard.ts`
- Create: `frontend/src/v2/__tests__/ToolCallItem.test.tsx`
- Create: `frontend/src/v2/__tests__/DiffView.test.tsx`
- Create: `frontend/src/v2/__tests__/ApprovalCard.test.tsx`
- Create: `frontend/src/v2/__tests__/stream-guard.test.ts`

- [ ] **Step 1: ToolCallItem（含 StatusDot）+ DiffView + ApprovalCard + InterruptedNotice + stream-guard**

> 完整代码见设计文档 5.1–5.3 节及 v1 Task 2.4。此处不再重复完整实现，但每个组件都有完整测试。

- [ ] **Step 2: 全量测试 + 提交**

Run: `npx vitest run src/v2/__tests__/ToolCallItem.test.tsx src/v2/__tests__/DiffView.test.tsx src/v2/__tests__/ApprovalCard.test.tsx src/v2/__tests__/stream-guard.test.ts`
Expected: 2+2+3+3 = 10 passed

```bash
git add frontend/src/v2/components/message frontend/src/v2/lib/stream-guard.ts frontend/src/v2/__tests__
git commit -m "feat(v2): ToolCallItem + DiffView + ApprovalCard + InterruptedNotice + stream-guard"
```

---

## Phase 3 · Wails 集成 + 状态管理（5 天）

### Task 3.1：Wails adapter + types + events

- [ ] **完整实现同 v1 Task 3.1**（wails/types.ts + adapter.ts + events.ts + 测试）

### Task 3.2：12 个 Zustand slice 完整实现（P5 + P6）

- [ ] **完整实现同 v1 Task 3.2**（12 个 slice 全部接 Wails，含 chatSlice StreamGuard + 200ms 缓冲 + store 集成测试）

### Task 3.3：Sentry 集成

- [ ] **完整实现同 v1 Task 3.3**（sentry.ts + ErrorBoundary）

---

## Phase 4 · 路由 + 子页 + 面板（4 天）

### Task 4.1：CommandPalette + 全局快捷键

- [ ] **完整实现同 v1 Task 4.1 + 4.2**（cmdk + 5 个全局快捷键：⌘K / ⌘L / ⌘⇧P / ⌘B / ⌘]）

### Task 4.2：Cast 路由 + 6 子页 + SettingsPage + ChatPage

- [ ] **完整实现同 v1 Task 4.3**（react-router-dom + CastPanel + CastEmptyState + 6 子页占位 + SettingsPage + ChatPage）

### Task 4.3：Drawer 4 面板（P8）

**Files:**
- Create: `frontend/src/v2/components/drawer/DrawerTabs.tsx`
- Create: `frontend/src/v2/components/drawer/FileTree.tsx`
- Create: `frontend/src/v2/components/drawer/GitPanel.tsx`
- Create: `frontend/src/v2/components/drawer/MCPPanel.tsx`
- Create: `frontend/src/v2/components/drawer/MemoryPanel.tsx`
- Modify: `frontend/src/v2/layout/Drawer.tsx`

- [ ] **Step 1: DrawerTabs**

```tsx
// frontend/src/v2/components/drawer/DrawerTabs.tsx
import type { ReactNode } from 'react';
type TabId = 'files' | 'git' | 'mcp' | 'memory';
const TABS: { id: TabId; label: string }[] = [
  { id: 'files', label: 'Files' }, { id: 'git', label: 'Git' },
  { id: 'mcp', label: 'MCP' }, { id: 'memory', label: 'Memory' },
];
export function DrawerTabs({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--c-border)' }}>
    {TABS.map(t => <button key={t.id} onClick={() => onChange(t.id)} style={{
      padding: '6px 12px', fontSize: 12, cursor: 'pointer', border: 'none', background: 'transparent',
      color: active === t.id ? 'var(--c-accent)' : 'var(--c-textMute)',
      borderBottom: active === t.id ? '2px solid var(--c-accent)' : '2px solid transparent',
    }}>{t.label}</button>)}
  </div>;
}
export type { TabId };
```

- [ ] **Step 2: FileTree / GitPanel / MCPPanel / MemoryPanel 占位**

> 每个面板占位：显示标题 + "v2.1 填充" 提示 + 从对应 slice 读数据

- [ ] **Step 3: Drawer.tsx 接入 DrawerTabs + 面板切换**

- [ ] **Step 4: 提交**

```bash
git add frontend/src/v2/components/drawer frontend/src/v2/layout/Drawer.tsx
git commit -m "feat(v2): Drawer 4 panels (Files/Git/MCP/Memory)"
```

---

## Phase 5 · 测试 / 性能 / 收尾（3 天）

### Task 5.1：E2E 4 个用户路径（P14 改用 __TEST_HOOK__）

**Files:**
- Create: `frontend/e2e/v2/01-new-chat.spec.ts`
- Create: `frontend/e2e/v2/02-tool-call.spec.ts`
- Create: `frontend/e2e/v2/03-checkpoint.spec.ts`
- Create: `frontend/e2e/v2/04-theme.spec.ts`

> **P14**: Wails 不走 HTTP，`page.route('**/wails/**')` 不可靠。改用 `window.__TEST_HOOK__` 在 App 初始化时注入 mock 数据。

- [ ] **Step 1: 在 App.tsx 加 test hook**

```tsx
// App.tsx 顶部
if (typeof window !== 'undefined' && (window as any).__TEST_HOOK__) {
  // 测试模式下注入 mock 数据到 store
  const mock = (window as any).__TEST_HOOK__;
  if (mock.messages) useAppStore.setState({ messages: mock.messages });
}
```

- [ ] **Step 2: 4 个 E2E spec**

> 01: 新对话 → 输入 → ⌘↵ → 看到 user + assistant 消息
> 02: 工具调用 → 注入 mock tool_call → 看到 ▶ read_file 折叠
> 03: Checkpoint → 注入 mock approval → 看到 Y/n 按钮
> 04: 主题切换 → 点击 → data-theme 变化

- [ ] **Step 3: 跑 E2E**

Run: `npx playwright test e2e/v2`
Expected: 4 passed

### Task 5.2：视觉回归 baseline（maxDiffPixelRatio: 0.02）

- [ ] **同 v1 Task 5.2**

### Task 5.3：性能 + bundle 调优

- [ ] **同 v1 Task 5.3**（dist gzipped < 1.5MB）

### Task 5.4：A11y 自动化测试（P10）

**Files:**
- Create: `frontend/e2e/v2/a11y.spec.ts`

- [ ] **Step 1: a11y spec**

```ts
// frontend/e2e/v2/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage has no a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 2: 加依赖**

```bash
cd frontend && npm install -D @axe-core/playwright@^4
```

### Task 5.5：v1→v2 切换 PR + CHANGELOG（P11 + P12）

- [ ] **Step 1: 切换 vite.config.ts 入口**

```ts
// frontend/vite.config.ts
build: { rollupOptions: { input: { main: 'index.html' } } }
// index.html 已指向 src/v2/v2_entry.ts（Task 1.1 Step 8 已完成）
```

- [ ] **Step 2: 更新 CHANGELOG.md**

```markdown
## [2.0.0] - 2026-06-XX
### Changed
- **BREAKING**: Frontend completely rewritten to Claude Code desktop style
- New `src/v2/` directory replaces old `src/` (old files preserved for 14 days)
- 12 Zustand slices replace old 15+ slices
- IBM Plex Sans/Serif + JetBrains Mono replace system fonts
- cmdk command palette replaces old navigation
- Drawer defaults to expanded (280px)
- Cast tools accessible via `/cast/*` routes instead of 6-panel portal

### Added
- Dual theme (light cream / dark brown)
- SlashCommandMenu in Composer
- DiffView for tool call results
- StatusDot (running/done/paused/error)
- Stream guard (60s timeout + resume)
- Sentry error tracking
- Visual regression baseline
- A11y automated testing
```

- [ ] **Step 3: 提交**

```bash
git add CHANGELOG.md frontend/vite.config.ts
git commit -m "feat(v2): v1→v2 switch + CHANGELOG v2.0.0"
```

---

## 验收（DoD）

- [ ] `npm run typecheck` 通过
- [ ] `npm run lint` 通过
- [ ] `npm test` 全部通过
- [ ] `npx playwright test` 4 E2E + 视觉回归 + a11y 通过
- [ ] `npm run build` 成功，dist < 1.5MB gzipped
- [ ] `go test ./...` 通过（后端不受影响）
- [ ] Sentry 收到 v2 首发事件
- [ ] 用户在 5 分钟试用后能完成"打开 → 发消息 → 工具调用 → 批准"全流程
- [ ] 旧 `src/` 文件保留但不在构建路径（v2 GA + 14 天后整目录删除）
- [ ] CHANGELOG.md 已更新
- [ ] 视觉回归 baseline 已刷新（maxDiffPixelRatio: 0.02）

---

*End of plan v2 (反思优化版)*