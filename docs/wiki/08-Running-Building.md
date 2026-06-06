# 08 · 运行与构建

> 跨平台开发、生产构建、CI 产物。

---

## 1. 环境要求

| 工具 | 版本 | 用途 |
|------|------|------|
| Go | 1.24+（`go.mod` 写 1.26） | 后端编译 |
| Node.js | 20+ | 前端 |
| npm | 10+ | 依赖安装 |
| Wails CLI | latest | 桌面运行时 + 构建 |
| CGO | 默认关闭（Wails 在 Windows/macOS 需要） | SQLite 是 pure Go，无 CGO |
| Windows | WebView2 Runtime | 桌面渲染（Win11 自带，Win10 多数自带） |
| macOS | Xcode CommandLineTools | WKWebView |

### 安装 Wails CLI

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

验证：

```bash
wails doctor
```

---

## 2. 本地开发

### 2.1 准备 AP 模块（首次或 AP 更新后）

```bash
# 假设仓库布局：codecast/CodeCast + codecast/agentprimordia
cd ../../agentprimordia/agentprimordia
git pull
go mod tidy
cd ../../CodeCast/CodeCast-desktop
```

创建 `go.work`（推荐；CI 不提交）：

```go
// go.work
go 1.26
use .
use ../../../agentprimordia/agentprimordia
```

### 2.2 安装前端依赖

```bash
cd frontend
npm install
```

> 注：本仓库没有提交 `frontend/src/`，仅保留 `package.json` / 配置 / `dist/` 嵌入。如需修改前端，请先在另一个仓库中开发、构建，再把 `dist/` 嵌入本仓库。

### 2.3 启动开发模式（带热重载）

```bash
cd CodeCast-desktop
wails dev
```

- 自动启动 Vite + Wails 绑定生成
- 前端 `http://localhost:5173`（HMR）
- Go 端热重载（修改 .go 自动编译）

### 2.4 只跑前端

```bash
cd frontend
npm run dev
```

---

## 3. 生产构建

### 3.1 当前平台

```bash
cd CodeCast-desktop
wails build
```

产物：
- Windows：`build/bin/CodeCast.exe`
- macOS：`build/bin/CodeCast.app`
- Linux：`build/bin/CodeCast`

### 3.2 跨平台

```bash
wails build -platform windows/amd64
wails build -platform darwin/arm64
wails build -platform darwin/amd64
wails build -platform linux/amd64
```

### 3.3 Bundle 分析

```bash
cd frontend
npm run analyze
# 报告：dist/stats.html（rollup-plugin-visualizer）
```

---

## 4. 测试

### 4.1 Go（带 race 检测）

```bash
cd CodeCast-desktop
go test -v -race ./...
```

### 4.2 前端

```bash
cd frontend
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run format:check  # prettier
npm test              # vitest run
npm run test:e2e      # playwright test
npm run ci            # 全部
```

E2E 产物：`frontend/e2e-results/index.html` + `results.json` + 截图快照（`e2e/visual-regression.spec.ts-snapshots/`）。

---

## 5. CI / CD

> 仓库根目录 `.github/workflows/`：

| Workflow | 触发 | 产物 |
|----------|------|------|
| `ci.yml` | PR / push | 跑 lint / typecheck / test |
| `build-windows.yml` | tag `v*` | `CodeCast.exe` 上传 artifact |
| `build-macos.yml` | tag `v*` | `CodeCast-macOS-arm64.dmg` + `-amd64.dmg` |
| `build-linux.yml` | tag `v*` | `CodeCast` Linux 二进制 |
| `release.yml` | tag `v*` | 自动发 GitHub Release |
| `.gitee-ci.yml` | push | Gitee 镜像同步 |
| `.gitlink-ci.yml` | push | GitLink 镜像同步 |

---

## 6. 数据目录

启动后（典型路径）：

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%\CodeCast\` |
| macOS | `~/Library/Application Support/CodeCast/` |
| Linux | `~/.config/CodeCast/` |

内容：

- `settings.json`（加密）
- `memory.db`（AP SQLite + FTS5）
- `checkpoints.db`（AP Checkpoint）
- `sessions/<sessionID>.json`（持久化会话）
- `cast_*.json`（Cast 工具状态）

清理方式：直接删除该目录（会丢失所有本地数据）。

---

## 7. 常见问题

| 问题 | 处理 |
|------|------|
| `wails: command not found` | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` 并把 `$GOPATH/bin` 加 PATH |
| `cannot find module agentprimordia` | 创建 `go.work` 或确认 sibling 目录存在 |
| 前端热重载失败 | `npm run clean` 后重试 |
| macOS 上 `wails dev` 报 WebKit 错 | 安装 Xcode CommandLineTools |
| Windows 上白屏 | 安装 WebView2 Runtime |
| SQLite lock | 关闭所有 CodeCast 进程后重启 |
| 凭据丢失 | 删 `%APPDATA%\CodeCast\settings.json` 重置（API Key 需重配） |
