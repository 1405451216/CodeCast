# CodeCast 产品优化建议报告

> 以高频用户视角，对 CodeCast Desktop 全栈（前端 UI/UX、后端 Go、前后端集成）进行深度审查。  
> 审查范围：13 个页面、25+ 组件、339 个后端方法、数据模型、主题系统、可访问性。

---

## P0 — 数据安全风险（必须立即修复）

### 1. 破坏性操作缺少确认对话框

以下操作点击即执行，无任何二次确认，误触会导致数据永久丢失：

| 页面 | 操作 | 位置 |
|------|------|------|
| CostPage | "重置费用数据" — 描述写着"不可逆"，但单击即清空 | `handleReset` line 89 |
| SettingsPage | "删除技能" — 无确认直接删除 | `handleDelete` line 386 |
| PluginsPage | "卸载插件" — 单击即卸载 | `handleUnload` line 76 |
| InferenceConfigPage | "恢复默认" — 单击即重置全部配置 | `handleReset` line 160 |

**建议**：实现统一的 `<ConfirmDialog>` 组件，所有破坏性操作统一走确认流程。

### 2. InferenceConfigPage 保存状态检测 Bug

`saveMsg` 的错误检测使用英文匹配 `saveMsg.includes('failed')`，但实际错误消息是中文 `'保存失败'`。结果：保存失败时错误信息被当成成功消息（绿色）展示，用户完全无法感知配置保存失败。

### 3. InferenceConfigPage TagInput 组件无法添加标签

"允许的域名"输入框的 `<input>` 始终 `value=""`，onChange 只检测逗号但从不将输入值添加到列表。用户无法添加任何新域名限制。

---

## P1 — 功能失效（按钮/菜单无响应）

大量 UI 元素看似可交互但实际无任何响应，严重影响用户信任感：

### CastEmptyState（Cast 模式首页）
- **"添加附件"按钮** — 有 `title="Add attachment"` 但无 onClick，用户点击无反应
- **模型选择器** — 显示当前模型和下拉箭头，但无 onClick
- **"项目工作区"按钮** — 无 onClick

### CodeEmptyState（Coding 模式首页）
- **编辑菜单 5 项中 4 项** — "模式"、"请求权限"、"计划模式"、"绕过权限" 全部只关闭弹窗无操作
- **添加工具菜单 6 项** — "添加文件"、"添加文件夹"、"导入 GitHub 问题"、"斜线命令"、"添加连接器"、"添加插件" 全部只关闭弹窗无操作
- **标签切换（本地/CodeCast-desktop/main/工作树）** — 仅切换视觉状态，不改变任何工作区上下文

### InferenceConfigPage
- **搜索框** — 无 onChange/value 绑定，纯装饰
- **"导出"按钮** — 无 onClick
- **"CC Switch"按钮** — 无 onClick
- **"测试连接"和"测试模型发现"按钮** — 无 onClick
- **添加模型用 `window.prompt()`** — 在桌面应用中使用浏览器原生弹窗，体验极差

### SettingsPage
- **快捷键清除按钮** — `onClear={() => {}}` 空函数，X 按钮不可用
- **"查看安全最佳实践"链接** — `<a>` 标签无 href
- **选择工作目录后用 `window.alert()`** — 浏览器阻塞弹窗

---

## P1 — 主题/视觉问题

### InferenceConfigPage 完全不支持暗色模式

整个页面的颜色使用硬编码浅色值（`bg: '#ffffff'`, `text: '#1a1a1a'` 等）。当用户切换到暗色主题时，这个页面会刺眼地白。这是全应用最严重的主题违规，其他所有页面都正确使用了 CSS 变量。

### CodeEmptyState 热力图使用假数据

热力图 182 个格子使用 `Math.random()` 生成，每次切换时间段（全部/30天/7天）所有数据重新随机。看起来像真实使用数据但实际是假的，对用户有误导性。统计数据（会话数 15、消息 7353、Token 39.1M）也是硬编码值，未连接后端。

### @keyframes spin 重复定义

旋转动画在至少 4 个文件中内联重复定义（CastEmailPage、CastKnotePage、CastSchedulePage、CastToolsPage），应提取为全局样式。

---

## P2 — 错误处理缺陷

### 剪贴板复制不统一

三个页面使用三种不同的剪贴板处理方式：
- **CastEmailPage** — 有 fallback 但 fallback 内部又调用了已失败的 API，实际无效
- **CastWritingPage** — 无 `.catch()`，Promise rejection 被静默吞掉
- **CastTranslationPage** — 同上

**建议**：实现统一的 `copyToClipboard()` 工具函数，带完整 fallback（创建 textarea + execCommand）。

### 技能操作错误被完全吞掉

SettingsPage 的 SkillsSection 中所有 catch 块都是 `catch { /* ignore */ }`。用户执行技能增删改操作失败时完全无感知。

### Go 后端级联初始化失败

`main.go` 的 `startup()` 中，如果 Provider 初始化失败，整个 Agent Pool、RAG 存储、摘要器、结构化提取器全部被跳过且无任何用户提示。应用看起来正常启动但实际没有任何 AI 能力。

---

## P2 — 功能缺失（用户核心期望）

### 日程管理（CastSchedulePage）
- 创建的任务**不可编辑、不可删除**
- 任务状态标签只是展示性的，无法标记完成
- 无排序、无过滤、无批量操作
- Ctrl+Enter 快捷键创建任务无撤销

### 翻译（CastTranslationPage）
- 仅支持中英互译，无其他语言
- 结果区与输入区样式完全一样，用户会尝试编辑翻译结果
- 无翻译历史、无自动检测语言

### 写作（CastWritingPage）
- 生成结果不可编辑（纯 div 展示）
- 无字数统计
- 仅 5 个硬编码风格预设，不可自定义
- 无生成历史（覆盖即丢失）

### 知识库（CastKnotePage）
- 无"添加知识条目"能力 — 空状态说"请先添加条目"但没有入口
- 检索结果无复制按钮
- 无分页（大量数据会卡顿）

### 聊天（ChatPage）
- 消息 key 使用数组索引（`msg-${i}`），消息插入/删除会导致 React 状态错乱
- 无会话内搜索
- 无重新生成/重试
- 无消息编辑
- 无滚动到底部按钮
- 无会话导出

### Git 集成极其有限
后端仅暴露 `GetGitStatus` 和 `ConfirmGitCommit`。对于一个编程助手，缺少：diff、log、branch、checkout、push、pull、stash 等基本操作。

### 邮件（CastEmailPage）
- 无 CC/BCC 字段
- 模板切换会直接覆盖用户已填写内容，无确认
- 无邮件发送集成 — 仅生成文本
- 无草稿自动保存

---

## P2 — 前后端类型不匹配（运行时数据损坏风险）

以下 Go 结构体与 TypeScript 类型定义存在根本性不一致：

| 模块 | Go 返回 | TypeScript 期望 | 影响 |
|------|---------|----------------|------|
| CodeReviewResult | `Issues []string` | `issues: Array<{severity, line, message}>` | 代码审查结果无法显示行号和严重度 |
| RefactoringResult | `Changes []string` | `changes: Array<{description, line}>` | 重构建议缺少行号定位 |
| TestPipelineResult | `TestCode`, `Coverage` | `testsGenerated`, `testsPassed` | 字段名完全不同 |
| Session.createdAt | `time.Time`（ISO 字符串） | `number`（Unix 时间戳） | 时间解析可能出错 |
| Message | 无 timestamp 字段 | 期望能显示时间 | 消息永远没有时间戳 |
| Message | 无 model 字段 | — | 用户无法知道哪个模型生成了回复 |

adapter.ts 通过 `as unknown as Promise<T>` 强制转换来掩盖这些不匹配。

---

## P3 — 可访问性（Accessibility）

### 非语义化交互元素
大量可点击元素使用 `<div>` 或 `<span>` + onClick，而非 `<button>`：
- CastToolsPage 的工具卡片
- CastEmailPage 的模板选择器
- 各页面的分类标签/芯片

这导致键盘用户完全无法使用 Tab 键导航和 Enter 键激活。

### 缺少 ARIA 属性
- Toggle 开关组件无 `aria-label`，屏幕阅读器无法知道开关控制什么
- 无 `<main>`、`<nav>`、`<section>` 等地标角色
- 焦点样式依赖 JS `onFocus`/`onBlur` 修改内联样式，键盘导航和高对比度模式下不可见

### 应使用 `:focus-visible` CSS
当前的 JS 焦点管理在程序化焦点转移、高对比度模式、键盘导航场景下全部失效。

---

## P3 — 性能隐患

### 大列表无虚拟化
- CastKnotePage 的知识条目列表一次性渲染全部
- CastToolsPage 的工具网格无虚拟滚动
- 消息列表（MessageStream）在长对话中会越来越慢

### 配置保存阻塞主线程
`config.go` 的 `saveSettingsToFile` 在持有写锁期间进行文件 I/O。在机械硬盘上可能导致整个应用（包括聊天）短暂卡顿。

### 并发安全的 Map 读写
`main.go` 的 `GetAPMetricsSnapshot` 读取 `TokenUsageByModel` map 时，metrics collector 可能在并发写入。Go map 的并发读写会触发 panic。

---

## P3 — 代码质量

### 死代码
- CodeEmptyState 定义了 `SwitchIcon` 和 `PixelBot` 组件但从未使用
- CodeEmptyState 在模块顶层直接操作 DOM 注入 `<style>` 标签

### 内联样式架构
所有页面使用内联 style 对象（无 CSS 模块/CSS-in-JS 库），导致：
- 无法使用 `:hover`、`:focus`、`:disabled` 等伪类（用 JS 事件替代）
- 无法使用 `@media` 查询（无响应式断点）
- 大量样式对象跨文件重复

---

## 优先修复路线图建议

**第一周 — 数据安全 + 关键 Bug**
1. 实现 ConfirmDialog 组件，覆盖所有破坏性操作
2. 修复 InferenceConfigPage 保存状态检测（中文匹配）
3. 修复 TagInput 组件
4. 统一 `copyToClipboard` 工具函数

**第二周 — 功能补全**
5. 补全 CastEmptyState/CodeEmptyState 的非响应按钮（要么实现功能，要么移除入口）
6. CastSchedulePage 添加任务编辑/删除/状态切换
7. ChatPage 添加消息重试、滚动到底部、会话导出

**第三周 — 体验优化**
8. InferenceConfigPage 接入主题系统（替换硬编码颜色为 CSS 变量）
9. 热力图接入真实后端数据
10. 所有交互元素改为语义化 `<button>`，添加 ARIA 属性

**第四周 — 架构升级**
11. 修复 Go ↔ TypeScript 类型不匹配
12. 统一 focus 管理为 `:focus-visible`
13. 大列表引入虚拟化（react-window / react-virtuoso）
14. 提取公共样式到 CSS 变量/主题文件
