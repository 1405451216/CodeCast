# CodeCast 常见问题解答 (FAQ)

> **遇到问题？先在这里找答案！**

---

## 📋 目录

- [安装与配置](#安装与配置)
- [使用问题](#使用问题)
- [功能相关](#功能相关)
- [性能与优化](#性能与优化)
- [安全与隐私](#安全与隐私)
- [故障排除](#故障排除)

---

## 安装与配置

### Q1: 系统要求是什么？

**最低要求**:
- **操作系统**: Windows 10+ / macOS 11+ (Big Sur)
- **内存**: 4 GB RAM（推荐 8 GB）
- **磁盘空间**: 500 MB 可用空间
- **网络**: 需要互联网连接（除非使用 Ollama 本地模型）

**推荐配置**:
- 内存: 16 GB RAM
- SSD 固态硬盘
- 稳定的网络连接

---

### Q2: 如何更新到最新版本？

**Windows**:
1. CodeCast 会自动检查更新
2. 或者访问 [GitHub Releases](https://github.com/1405451216/CodeCast/releases) 下载最新版

**macOS**:
```bash
# 使用 Homebrew (如果通过 brew 安装)
brew upgrade codecast

# 或手动下载最新 .dmg 文件
```

---

### Q3: 可以安装多个版本吗？

不建议同时安装多个版本，可能会导致：
- 配置文件冲突
- 数据库版本不兼容

建议卸载旧版本后再安装新版本。

---

### Q4: API Key 在哪里配置最安全？

✅ **最佳实践**:
1. 只在 CodeCast 设置中输入一次
2. 不要分享给他人
3. 定期轮换（更换）API Key
4. 如果怀疑泄露，立即在提供商平台重新生成

⚠️ **不要**:
- ❌ 将 API Key 写在代码中
- ❌ 提交到 Git 仓库
- ❌ 通过聊天工具发送
- ❌ 截图时包含 Key

---

## 使用问题

### Q5: 如何开始第一个对话？

1. 确保 AI 提供商已配置完成（见 Q4）
2. 在底部输入框输入你的问题
3. 按 Enter 或点击发送按钮
4. 等待 AI 响应

**示例对话**:
```
你: 用 Python 写一个快速排序算法
AI: [生成完整的代码实现和解释]
```

---

### Q6: 支持哪些语言？

CodeCast 的 UI 支持：
- 🇨🇳 简体中文（默认）
- 🇺🇸 English
- 🇯🇵 日本語（即将支持）
- 🇰🇷 한국어（即将支持）

编程语言支持：所有主流语言（见 Q7）

---

### Q7: 支持哪些编程语言？

完全支持：
- ✅ JavaScript / TypeScript
- ✅ Python
- ✅ Java / Kotlin
- ✅ Go / Rust
- ✅ C / C++ / C#
- ✅ Ruby / PHP
- ✅ Swift / Objective-C
- ✅ SQL / Shell / Docker
- ✅ HTML / CSS
- ✅ YAML / JSON / XML
- ✅ 其他所有文本格式

---

### Q8: 如何上传文件或图片？

**方法 1: 拖拽**
直接将文件拖入对话框

**方法 2: 点击附件图标**
点击输入框左侧的 📎 图标 → 选择文件

**支持的格式**:
- 代码文件 (.js, .ts, .py, .java ...)
- 图片 (.png, .jpg, .gif) - 用于视觉理解
- 文档 (.md, .txt)
- 最大单文件大小: 10 MB

---

### Q9: 对话历史保存在哪里？

**本地存储位置**:

| 系统 | 路径 |
|------|------|
| Windows | `%APPDATA%/CodeCast/data/` |
| macOS | `~/Library/Application Support/CodeCast/data/` |
| Linux | `~/.config/CodeCast/data/` |

数据格式：SQLite 数据库（`.db` 文件）

---

### Q10: 如何删除对话历史？

**单个删除**:
1. 右键点击侧边栏中的会话
2. 选择"删除"

**批量清理**:
设置 → 数据管理 → 清理历史记录
- 可选择时间范围
- 可选择保留星标会话

**彻底清除**:
设置 → 高级 → 重置所有数据 ⚠️ （不可恢复）

---

## 功能相关

### Q11: 什么是 Agent 模式？什么时候用？

**Agent 模式** 是 CodeCast 的自主执行能力，让 AI 不只是"说"，还能"做"。

**适合使用的场景**:
- ✅ 重构代码（需要修改多个文件）
- ✅ 添加新功能（创建新文件、修改现有文件）
- ✅ 运行测试和调试
- ✅ Git 操作（commit、创建分支）

**不适合的场景**:
- ❌ 简单的问答（用普通对话模式即可）
- ❌ 需要创意性思考的任务
- ❌ 快速原型设计

**示例**:
```
普通模式: "如何实现用户认证？" → AI 给出方案
Agent 模式: "帮我实现用户认证" → AI 直接写代码、改文件、跑测试
```

---

### Q12: Checkpoint 机制是什么？

**Checkpoint** 是 Agent 模式的安全保护机制：

当 AI 执行**高危操作**时会暂停：
- 📝 写入/覆盖文件
- 🗑️ 删除文件
- 🚀 推送代码到远程仓库
- 💻 执行危险的 Shell 命令

**流程**:
1. AI 展示将要执行的变更（Diff 预览）
2. 显示风险等级评估
3. 等待你确认
4. 你可以选择批准、拒绝或查看详情

**好处**: 完全掌控 AI 的行为，避免误操作！

---

### Q13: 情景记忆系统如何工作？

**工作原理**:
```
你说话 → AI 自动提取摘要和标签 → 存储到本地数据库
                                          ↓
新对话 → 自动检索相关记忆 → 注入上下文 → AI "记得"之前的对话
```

**实际效果**:
```
会话 1: "我的项目是 React + TypeScript 的电商后台"
        ↓ 记忆保存
会话 2: "帮我添加购物车功能"
        ↓ AI 自动回忆
AI: "基于你之前提到的 React + TypeScript 电商项目，
     我将在 src/components/Cart.tsx 中创建购物车组件..."
```

**配置选项**:
- 记忆保留天数（默认 30 天）
- 自动提取开关
- 手动添加标签
- 导出/导入记忆

---

### Q14: 代码补全不准确怎么办？

**提高准确率的方法**:

1. **确保项目已打开**
   - 打开项目文件夹后，AI 能理解整个代码库
   
2. **提供更多上下文**
   ```typescript
   // ❌ 上下文不足
   const data = [
   
   // ✅ 有明确类型提示
   interface User {
     id: number;
     name: string;
     email: string;
   }
   const users: User[] = [
   ```

3. **切换模型**
   - DeepSeek Coder: 专精代码
   - GPT-4o: 综合能力强

4. **手动触发补全**
   - 按 `Ctrl + Space` 强制刷新

5. **等待索引完成**
   - 首次打开项目需要建立符号索引
   - 通常需要 1-3 分钟

---

### Q15: 如何使用 Git 集成？

**前提条件**:
- 项目目录已初始化 Git (`git init`)
- 项目文件夹已在 CodeCast 中打开

**可用功能**:

| 功能 | 操作方式 |
|------|---------|
| 查看状态 | 左侧 Git 面板自动显示 |
| AI Commit | 点击"AI Commit"按钮 |
| 创建分支 | 右键菜单 → 创建分支 |
| 查看 Diff | 点击文件查看变更 |
| 解决冲突 | AI 辅助合并 |

**AI Commit 示例**:
```
修改了 3 个文件后...

点击 [🤖 AI Commit]

AI 分析结果:
feat(auth): add login with OAuth2 providers

- Implement Google and GitHub OAuth login
- Add token storage in localStorage
- Update auth interceptor to handle new tokens

[应用] [编辑] [取消]
```

---

## 性能与优化

### Q16: 应用卡顿怎么解决？

**常见原因和解决方案**:

#### 原因 1: 内存占用过高
**症状**: 界面响应慢，风扇狂转
**解决**:
- 设置 → 高级 → 清理缓存
- 减少记忆保留天数（30天 → 7天）
- 关闭不必要的面板

#### 原因 2: 模型响应慢
**症状**: AI 回复很慢
**解决**:
- 切换到更快的模型（DeepSeek Chat）
- 关闭深度思考模式
- 检查网络连接

#### 原因 3: 项目太大
**症状**: 文件加载慢，搜索慢
**解决**:
- 在 `.codecastignore` 排除不需要的目录：
  ```
  node_modules/
  dist/
  .git/
  *.log
  ```
- 使用虚拟滚动（长列表场景）

#### 原因 4: 浏览器资源竞争
**症状**: 同时开很多标签页
**解决**:
- 关闭其他不用的应用
- CodeCast 是桌面应用，本身较轻量

---

### Q17: 如何减少 API 费用？

**省钱技巧**:

1. **选择性价比高的模型**
   - 日常任务: DeepSeek Chat（约 $0.001/1K tokens）
   - 复杂推理: Claude Sonnet（比 Opus 便宜 5 倍）

2. **使用本地模型（免费！）**
   - 安装 Ollama: https://ollama.ai
   - 下载模型: `ollama pull codellama:13b`
   - 完全离线，零成本！

3. **优化 Prompt**
   - 明确的需求描述减少来回对话
   - 一次说清楚，避免重复询问

4. **利用缓存**
   - 相似的问题会命中缓存
   - 缓存命中率 >40% 时费用大幅降低

5. **监控用量**
   - 设置 → 用量统计
   - 查看 Token 消耗趋势

---

### Q18: 本地运行 Ollama 的性能要求？

**最低配置**:
- CPU: 4 核以上
- 内存: 8 GB RAM（7B 模型）/ 16 GB（13B 模型）
- 磁盘: 4-8 GB 空间（存储模型文件）

**推荐配置**:
- GPU: NVIDIA 显卡（4GB+ VRAM）加速明显
- 内存: 32 GB RAM
- SSD: 读取模型更快

**常用模型大小**:

| 模型 | 参数量 | 内存需求 | 速度 | 质量 |
|------|--------|---------|------|------|
| codellama:7b | 7B | 6 GB | ⚡快 | ★★★☆ |
| codellama:13b | 13B | 10 GB | 🐢中 | ★★★★ |
| codellama:34b | 34B | 24 GB | 🐌慢 | ★★★★★ |

**安装步骤**:
```bash
# 1. 安装 Ollama
# macOS: brew install ollama
# Windows: 从 ollama.ai 下载安装包

# 2. 启动服务
ollama serve

# 3. 下载模型（选择适合你电脑的）
ollama pull codellama:13b

# 4. 测试
ollama run codellama:13b "Hello, world!"
```

---

## 安全与隐私

### Q19: 我的数据安全吗？

✅ **非常安全！CodeCast 采用多层防护：**

#### 数据加密
- **API Key**: AES-256-GCM 加密存储
- **本地数据库**: SQLite 加密（可选开启）
- **传输层**: HTTPS/TLS 1.3

#### 数据存储
- 所有数据**仅存储在你的本地电脑**
- 不会上传到我们的服务器
- 只有你主动发送给 AI 的内容才会通过 API 传输

#### 沙箱机制
- 文件操作路径校验（防目录穿越）
- Shell 命令危险拦截
- 文件大小限制（读 4MB / 写 10MB）

#### 隐私保护
- IP 地址匿名化
- 用户数据脱敏
- 符合 GDPR 合规要求

**简单来说**: 你的代码只属于你自己！🔒

---

### Q20: CodeCast 会收集什么信息？

**我们收集的信息**（用于改进产品）:
- ✅ 匿名化的错误报告（通过 Sentry）
- ✅ 性能指标（FPS、内存使用等）
- ✅ 功能使用频率统计

**我们不收集**:
- ❌ 你的代码内容
- ❌ 对话记录
- ❌ API Keys
- ❌ 个人身份信息（PII）
- ❌ 文件内容

**你可以随时关闭**:
设置 → 隐私 → 关闭遥测数据收集

---

### Q21: 企业级部署安全吗？

✅ **支持企业级安全要求**:

1. **私有化部署**
   - 可部署在企业内网
   - 数据不出内网
   - 支持离线模式（Ollama）

2. **审计日志**
   - 记录所有操作
   - 支持导出审计报告
   - 符合 SOC 2 标准

3. **权限控制**
   - 多用户角色管理
   - 细粒度权限设置
   - SSO 单点登录集成

4. **合规认证**
   - GDPR
   - HIPAA（医疗行业）
   - ISO 27001

**联系我们获取企业版**: enterprise@codecast.cloud

---

## 故障排除

### Q22: 无法启动应用？

**Windows**:
1. 检查是否被杀毒软件拦截
   - 将 CodeCast 添加到白名单
2. 以管理员身份运行
3. 检查 .NET 运行时是否安装

**macOS**:
1. 系统偏好设置 → 安全性与隐私 → 允许
2. 终端运行:
   ```bash
   xattr -cr /Applications/CodeCast.app
   ```

**通用排查**:
1. 查看日志文件:
   - `%APPDATA%/CodeCast/logs/` (Windows)
   - `~/Library/Logs/CodeCast/` (macOS)
2. 重新安装应用
3. 联系技术支持

---

### Q23: 连接 AI 提供商失败？

**检查清单**:
- [ ] API Key 是否正确（包含完整字符串）
- [ ] 网络连接正常吗？（尝试打开浏览器访问其他网站）
- [ ] API Key 是否有余额/额度？
- [ ] 是否触发了速率限制（Rate Limit）？

**错误码对照表**:

| 错误 | 含义 | 解决方案 |
|------|------|---------|
| `401` | API Key 无效 | 检查 Key 是否正确 |
| `429` | 请求过于频繁 | 等待 1 分钟后重试 |
| `500` | 服务器内部错误 | 稍后重试或联系提供商 |
| `503` | 服务不可用 | 切换到其他 Provider |

**临时解决方案**:
- 切换到其他 AI 提供商
- 使用 Ollama 本地模型（无需网络）

---

### Q24: 代码补全不工作？

**逐步排查**:

1. **检查项目是否打开**
   - 文件面板应该显示文件树

2. **等待索引完成**
   - 首次打开项目需 1-3 分钟
   - 状态栏显示 "Indexing..." 时请等待

3. **检查文件类型**
   - 仅支持 `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go` 等
   - 不支持 `.json`, `.css`, `.html` 补全

4. **手动触发**
   - 按 `Ctrl + Space` 强制触发

5. **重启补全引擎**
   - 设置 → 高级 → 重启补全服务

**仍不工作?**
- 查看 FAQ #14 获取更多优化建议
- 提交 Issue 并附上日志

---

### Q25: 如何重置应用到初始状态？

⚠️ **警告: 此操作将删除所有数据，不可恢复！**

**方法 1: 通过界面**
1. 设置 → 高级
2. 点击"重置所有数据"
3. 输入确认: `RESET`
4. 确认重置

**方法 2: 手动删除**

**Windows**:
```powershell
# 关闭 CodeCast
taskkill /f /im CodeCast.exe

# 删除数据文件夹
Remove-Item "$env:APPDATA\CodeCast" -Recurse -Force
```

**macOS**:
```bash
# 关闭 CodeCast
killall CodeCast

# 删除数据文件夹
rm -rf ~/Library/Application\ Support/CodeCast
```

**重置后**:
- 所有对话历史将被清除
- 设置恢复默认值
- 需要重新配置 API Key

---

### Q26: 日志在哪里？如何查看？

**日志位置**:

| 系统 | 路径 |
|------|------|
| Windows | `%APPDATA%/CodeCast/logs/` |
| macOS | `~/Library/Logs/CodeCast/` |
| Linux | `~/.local/share/CodeCast/logs/` |

**日志文件说明**:
- `app.log`: 主应用日志
- `error.log`: 错误日志
- `performance.log`: 性能指标日志

**查看方法**:
1. 直接用文本编辑器打开
2. 或在设置 → 高级 → "打开日志文件夹"

**提交 Bug 时请附上**:
- 最近 100 行 error.log
- 复现步骤
- 截图/录屏

---

### Q27: 如何联系技术支持？

**优先级渠道**:

1. **自助服务** (最快)
   - 📖 查阅本文档
   - 🔍 搜索 Discord 历史消息
   - 📖 查看用户指南

2. **社区支持** (24小时内)
   - 💬 Discord: [discord.gg/codecast](https://discord.gg/codecast)
   - 🐦 Twitter/X: [@CodeCastApp](https://twitter.com/codecastapp)

3. **官方支持** (1-3个工作日)
   - 📧 Email: support@codecast.cloud
   - 🐛 GitHub Issues: [提交问题](https://github.com/1405451216/CodeCast/issues)

4. **企业客户** (专属通道)
   - 📞 专属客服: enterprise@codecast.cloud
   - 🔒 私有频道: Discord 企业群

**提交问题时请包含**:
- 操作系统及版本
- CodeCast 版本号
- 问题描述和复现步骤
- 截图/屏幕录制
- 相关日志（见 Q26）

---

## 其他问题

### Q28: 有移动端 App 吗？

**当前状态**: ❌ 暂无

**计划中**:
- 📱 iOS App (预计 2026 Q3)
- 📱 Android App (预计 2026 Q4)

**替代方案**:
- 使用 Web 版本（浏览器访问）
- 远程桌面连接到运行 CodeCast 的电脑

**订阅更新通知**:
- 关注我们的 [Twitter/X](https://twitter.com/codecastapp)
- 加入 Discord 公告频道

---

### Q29: 如何贡献代码或翻译？

**代码贡献**:
1. Fork 仓库: github.com/1405451216/CodeCast
2. 创建特性分支: `git checkout -b feature/my-feature`
3. 提交更改: `git commit -m 'Add my feature'`
4. 推送分支: `git push origin feature/my-feature`
5. 创建 Pull Request

**文档改进**:
- 修正错别字或错误
- 添加示例代码
- 翻译成其他语言

**翻译贡献**:
- 我们支持社区翻译
- 查看 `src/i18n/locales/` 目录
- 提交 PR 包含新的语言包

**感谢每一位贡献者！** 🙏

---

### Q30: 价格和许可证？

**个人版** (当前):
- ✅ **完全免费**
- ✅ 无功能限制
- ✅ 无广告
- ✅ 开源 (MIT 许可证)

**企业版** (规划中):
- 👥 多用户协作
- 🔒 私有化部署
- 📊 高级分析报表
- 🎓 专属技术支持
- 💰 订阅制（价格待定）

**为什么免费?**
- 我们相信 AI 工具应该人人可用
- 通过云服务 API 产生收入（可选）
- 社区驱动开发模式

---

## 🎯 还没有找到答案？

如果你在上面没有找到问题的解决方案：

1. **搜索知识库**: [docs.codecast.cloud](https://docs.codecast.cloud)
2. **提问社区**: [Discord](https://discord.gg/codecast)
3. **联系官方**: support@codecast.cloud

我们会持续更新这个文档，感谢你的反馈！💙

---

*最后更新: 2026-05-28 | 文档版本: v1.0.0*
