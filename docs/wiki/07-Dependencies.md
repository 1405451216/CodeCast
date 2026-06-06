# 07 · 依赖关系

> Go 模块（`CodeCast-desktop/go.mod`）+ 前端（`CodeCast-desktop/frontend/package.json`）。
> 重点：版本约束、AP 本地模块、CI 上的 replace 策略。

---

## 1. Go 依赖（`go.mod`）

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/go.mod)

| 类别 | 模块 | 版本 | 用途 |
|------|------|------|------|
| **本地** | `agentprimordia` | v0.0.0-00010101000000-000000000000 | AP 框架（开发中） |
| Wails | `github.com/wailsapp/wails/v2` | v2.12.0 | 桌面运行时 |
| 通知 | `git.sr.ht/~jackmordaunt/go-toast/v2` | v2.0.3 | Windows toast 通知 |
| UUID | `github.com/google/uuid` | v1.6.0 | 会话 / 任务 ID |
| **间接** | `modernc.org/sqlite` | v1.50.1 | 纯 Go SQLite（FTS5） |
| | `modernc.org/libc` | v1.72.3 | libc 绑定 |
| | `modernc.org/mathutil` | v1.7.1 | — |
| | `modernc.org/memory` | v1.11.0 | — |
| | `github.com/wailsapp/go-webview2` | v1.0.22 | WebView2 绑定 |
| | `github.com/wailsapp/mimetype` | v1.4.1 | MIME 推断 |
| | `golang.org/x/crypto` | v0.33.0 | AES-256-GCM |
| | `golang.org/x/net` | v0.35.0 | — |
| | `golang.org/x/sys` | v0.42.0 | OS 抽象 |
| | `golang.org/x/text` | v0.22.0 | i18n |
| | `github.com/gorilla/websocket` | v1.5.3 | MCP WebSocket |
| | `github.com/labstack/echo/v4` | v4.13.3 | AP 内部用 |
| | `github.com/samber/lo` | v1.49.1 | 辅助 |

### 1.1 `replace` 指令（关键）

```go
replace agentprimordia => ../../agentprimordia/agentprimordia
```

- 仓库里 AP 框架以 sibling 目录开发，不发布到公共 module
- 两种解析方式：
  1. **推荐**：在 `CodeCast-desktop/` 下创建 `go.work`（git-ignored）：
     ```go
     go 1.26
     use .
     use ../../../agentprimordia/agentprimordia
     ```
  2. **fallback**：`replace` 指令；AP 发布为正式模块后移除
- CI 上需要确保路径可解析，否则会构建失败

### 1.2 Go 版本

`go 1.26`（仓库写的是 1.26，但 Wails 实际需要 Go 1.24+；README 写 1.24+。本地装 Go 1.24+ 即可）。

---

## 2. 前端依赖（`package.json`）

> [source](file:///e:/codecast/CodeCast/CodeCast-desktop/frontend/package.json)

### 2.1 运行时依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `react` / `react-dom` | 18.3.1 | UI |
| `zustand` | 4.5.0 | 状态管理（slice pattern） |
| `@agentprimordia/sdk` | file:../../../agentprimordia/agentprimordia/sdk/typescript | AP TypeScript SDK（本地） |
| `@sentry/react` | ^10.54.0 | 前端错误监控 |
| `@sentry/tracing` | ^7.120.4 | 链路追踪 |
| `@tanstack/react-virtual` | ^3.13.25 | 虚拟滚动 |
| `dompurify` | ^3.4.5 | XSS 防护 |
| `highlight.js` | ^11.11.1 | 代码高亮 |
| `katex` | ^0.17.0 | LaTeX |
| `marked` | ^18.0.4 | Markdown |
| `mermaid` | ^11.15.0 | 图表（流程/时序） |

### 2.2 开发依赖

| 包 | 版本 | 用途 |
|----|------|------|
| `vite` | ^5.4.0 | 构建 |
| `typescript` | ^5.5.0 | 类型 |
| `vitest` | ^2.1.8 | 单元测试 |
| `@playwright/test` | ^1.60.0 | E2E |
| `@vitejs/plugin-react` | ^4.3.0 | React 插件 |
| `eslint` + `@typescript-eslint/*` | 8 / 7 | 静态检查 |
| `prettier` | ^3.2.5 | 格式化 |
| `rollup-plugin-visualizer` | ^5.9.2 | Bundle 分析 |
| `terser` | ^5.48.0 | 压缩 |
| `fake-indexeddb` / `jsdom` | — | 测试垫片 |
| `@testing-library/{react,user-event,jest-dom}` | 14/14/6 | 组件测试 |

### 2.3 脚本

```jsonc
{
  "dev":   "vite",
  "build": "tsc && vite build",
  "typecheck": "tsc --noEmit",
  "lint":  "eslint src/ --ext .ts,.tsx --max-warnings=0",
  "test":  "vitest run",
  "test:e2e": "playwright test",
  "ci":    "npm run typecheck && npm run lint && npm run format:check && npm run test && npm run test:e2e",
  "analyze": "ANALYZE=true vite build"
}
```

---

## 3. 仓库根目录 CI 文件

| 文件 | 平台 / 范围 |
|------|-------------|
| `.github/workflows/build-windows.yml` | Windows 构建 |
| `.github/workflows/build-macos.yml` | macOS 构建（arm64 + amd64） |
| `.github/workflows/build-linux.yml` | Linux 构建 |
| `.github/workflows/ci.yml` | 全平台 CI |
| `.github/workflows/release.yml` | Release 发布 |
| `.gitee-ci.yml` | Gitee 镜像 CI |
| `.gitlink-ci.yml` | GitLink 镜像 CI |
| `.github/dependabot.yml` | 自动依赖更新 |
| `setup-gitlink.bat` | GitLink 初始化脚本（Windows） |

`.github/scripts/` 包含 Gitee 上传、GitHub 下载等工具脚本（`package.json` 名为 `@codecast/scripts`）。

---

## 4. 依赖图（简化）

```
CodeCast (Go binary)
├── agentprimordia  (LOCAL — Big Bang 替换核心)
│   ├── modernc.org/sqlite       (SQLite + FTS5)
│   ├── golang.org/x/crypto      (AES-GCM)
│   └── ...
├── wails v2
│   ├── go-webview2              (Windows)
│   ├── mimetype / ansi-parser
│   └── labstack/echo (AP 内部)
├── google/uuid
└── go-toast/v2                  (Windows 通知)

CodeCast-desktop/frontend (Vite + React)
├── @agentprimordia/sdk  (LOCAL — TypeScript SDK)
├── React 18 / Zustand 4
├── Sentry 10
├── highlight.js / katex / mermaid / marked / dompurify
└── Vite 5 / TS 5 / Vitest / Playwright
```

---

## 5. 升级注意事项

- **AP 模块**：随 sibling 目录频繁更新。CI 前先 `cd ../../agentprimordia/agentprimordia && git pull && go mod tidy`，再回到本仓库。
- **Wails**：升级需重新生成 `frontend/wailsjs/` 绑定（`wails generate module`）。
- **前端**：`npm outdated` 常规巡检；React 19 / Vite 6 需评估 Zustand 4 兼容性。
- **SQLite**：`modernc.org/sqlite` 跨平台，建议固定到主版本。
