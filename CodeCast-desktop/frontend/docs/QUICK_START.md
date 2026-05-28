# CodeCast 5 分钟快速入门

> **从安装到第一次对话，只需 5 分钟！**

---

## ⏱️ 时间线

```
0:00 - 下载安装
1:00 - 配置 API Key
2:00 - 开始第一个对话
3:00 - 探索核心功能
5:00 - 成为 CodeCast 高手 ✨
```

---

## 📥 第一步：下载与安装 (1 分钟)

### Windows 用户

1. 访问 [GitHub Releases](https://github.com/1405451216/CodeCast/releases)
2. 下载 **`CodeCast-Setup-x.x.x.exe`**（最新版本）
3. 双击运行安装程序
4. 点击"下一步"直到完成

### macOS 用户

1. 下载 **`CodeCast-macOS-arm64.dmg`**（Apple Silicon）
   或 **`CodeCast-macOS-amd64.dmg`**（Intel 芯片）
2. 双击 `.dmg` 文件
3. 将 CodeCast 拖入 Applications 文件夹
4. 从 Launchpad 启动

✅ **安装完成！你应该能看到 CodeCast 的欢迎界面了。**

---

## 🔑 第二步：配置 AI 提供商 (1 分钟)

### 推荐使用 DeepSeek（高性价比）

1. **获取 API Key**
   - 打开浏览器访问：[platform.deepseek.com](https://platform.deepseek.com)
   - 注册账号（支持手机号或邮箱）
   - 登录后点击 **API Keys** → **创建 API Key**
   - 复制生成的 Key（格式：`sk-xxxxxxxxxxxxxxxxxxxx`）

2. **在 CodeCast 中配置**
   - 点击界面左下角的 **⚙️ 设置图标**（或按 `Ctrl + ,`）
   - 选择 **模型管理** 标签页
   - 点击 **DeepSeek** 卡片
   - 在 API Key 输入框中粘贴你的 Key
   - 选择模型：**deepseek-chat**（推荐）或 **deepseek-coder**
   - 点击 **保存并测试**

3. **验证配置**
   - 如果显示 "✅ 连接成功"，说明配置正确！
   - 如果失败，检查：
     - Key 是否完整复制（包含 `sk-` 前缀）
     - 网络连接是否正常

### 其他提供商（可选）

如果你想使用其他 AI 模型：

| 提供商 | 注册地址 | 特点 |
|--------|---------|------|
| **OpenAI** | [openai.com](https://openai.com) | GPT-4o 全能型 |
| **Anthropic** | [anthropic.com](https://anthropic.com) | Claude 最强推理 |
| **Google** | [ai.google.dev](https://ai.google.dev) | Gemini 百万上下文 |
| **Ollama** | [ollama.ai](https://ollama.ai) | 本地运行，免费 |

💡 **提示**: 你可以同时配置多个 Provider，随时切换！

---

## 💬 第三步：开始第一次对话 (30 秒)

现在开始体验 CodeCast 的魔力！

### 示例 1：生成代码

在底部的输入框中输入：

```
用 React + TypeScript 写一个计数器组件
```

按 **Enter** 或点击发送按钮。

🎉 **几秒钟后，你将看到完整的代码实现！**

### 示例 2：解释代码

如果你有看不懂的代码，直接粘贴：

```
这段代码是什么意思？
[paste your code here]
```

AI 会逐行解释代码的作用和原理。

### 示例 3：调试错误

遇到 Bug？直接粘贴错误信息：

```
我的应用报错了：
TypeError: Cannot read properties of undefined (reading 'map')
```

AI 会帮你分析原因并提供修复方案。

---

## 🎯 第四步：探索核心功能 (2 分钟)

### 1️⃣ 创建新会话

点击左侧边栏的 **➕ 新建对话** 按钮（快捷键 `Ctrl + N`）

每个会话是独立的，可以针对不同项目或任务。

### 2️⃣ 打开项目文件夹

点击左侧的 **📁 项目** 面板 → **打开文件夹**

选择你的项目目录，AI 就能理解整个项目的上下文了！

**示例**:
```
你: 帮我在 src/components/ 下添加一个 Header 组件

AI: ✅ 已检测到这是一个 React + TypeScript 项目，
   我将在 src/components/Header.tsx 中创建组件...
```

### 3️⃣ 使用 Agent 自主执行模式

对于复杂任务，让 AI 自动执行：

**输入**: 
```
帮我重构 Login 组件，提取表单验证逻辑到单独的文件
```

**Agent 会自动**:
1. 🔍 分析当前代码结构
2. 📝 制定执行计划
3. ✏️ 创建新文件 `validator.ts`
4. 🔧 更新 `Login.tsx`
5. ✅ 展示变更预览（Diff）
6. ⏸️ 等待你确认后再继续

### 4️⃣ 体验代码补全

打开任意 `.tsx` 或 `.ts` 文件，开始输入代码：

```typescript
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  
  // 光标停在这里，按 Tab 键 →
  // AI 会自动补全下面的代码！
}
```

**快捷键**:
- `Tab`: 触发补全
- `↑↓`: 选择候选项
- `Esc`: 关闭补全

### 5️⃣ 尝试 Git 集成

修改了一些代码后？

1. 查看 Git 面板（左侧）
2. 点击 **🤖 AI Commit** 按钮
3. AI 自动分析修改内容
4. 生成规范的 commit message
5. 一键提交！

---

## 🌟 第五步：成为高手 (30 秒)

### 必知的 5 个技巧

#### 技巧 1: 使用斜杠命令加速

输入 `/` 呼出命令菜单：

| 命令 | 功能 |
|------|------|
| `/code` | 进入代码生成模式 |
| `/review` | 代码审查模式 |
| `/debug` | 调试助手模式 |
| `/doc` | 文档生成模式 |

#### 技巧 2: 开启深度思考

对于复杂问题，开启深度思考模式：

设置 → 对话设置 → ✅ 启用深度思考

AI 会进行更深入的推理，适合算法设计、架构决策。

#### 技巧 3: 利用情景记忆系统

CodeCast 会记住你的对话历史！

新对话时，AI 会自动检索相关记忆，所以你不需要重复解释项目背景。

查看记忆：侧边栏 → 🧠 记忆图标

#### 技巧 4: 切换模型适应场景

不同任务用不同的模型：

- **日常聊天** → DeepSeek Chat（快、便宜）
- **复杂推理** → Claude Opus（强）
- **大型代码库** → Gemini Pro（上下文长）

切换位置：聊天界面左下角模型选择器

#### 技巧 5: 使用 Cast 模式处理非编程任务

点击顶部导航栏的 **Cast** 按钮：

- ✍️ 写作：技术文档、博客文章
- 🌐 翻译：多语言互译
- 📋 日程：AI 智能排期
- 📧 邮件：商务邮件起草

---

## 🎉 恭喜你！

你已经掌握了 CodeCast 的核心用法！

### 下一步建议

1. **阅读完整用户指南**: [USER_GUIDE.md](./USER_GUIDE.md)
2. **观看视频教程**: [YouTube 频道](https://youtube.com/@codecast)
3. **加入社区 Discord**: 与其他用户交流经验
4. **探索高级功能**:
   - 自动化定时任务
   - MCP 协议集成
   - 插件开发

---

## ❓ 遇到问题？

### 常见问题速查

**Q: 提示 "API Key 无效"？**
A: 检查 Key 是否完整复制，确保包含 `sk-` 前缀

**Q: 响应很慢？**
A: 尝试切换到更快的模型（如 DeepSeek），或关闭深度思考

**Q: 找不到某个功能？**
A: 按 `Ctrl + Shift + P` 打开命令面板搜索

**Q: 如何备份数据？**
A: 设置 → 数据管理 → 导出全部数据

### 获取帮助

- 📖 **内置帮助**: 按 `F1`
- 💬 **Discord 社区**: [discord.gg/codecast](https://discord.gg/codecast)
- 🐛 **报告 Bug**: [GitHub Issues](https://github.com/1405451216/CodeCast/issues)
- 📧 **邮件支持**: support@codecast.cloud

---

## 📊 功能速查卡

打印这张卡片放在桌面上随时参考！

```
┌─────────────────────────────────────┐
│      CodeCast 快捷键速查表          │
├─────────────────────────────────────┤
│ Ctrl+N    新建对话                   │
│ Ctrl+B    切换侧边栏                 │
│ Ctrl+P    切换预览面板               │
│ Ctrl+E    切换文件面板               │
│ Ctrl+,    打开设置                   │
│ /         斜杠命令                   │
│ Tab       代码补全                   │
│ Esc       停止生成                   │
└─────────────────────────────────────┘
```

---

**准备好提升你的编程效率了吗？开始探索吧！** 🚀

*需要更多帮助？查看完整的 [用户指南](./USER_GUIDE.md)*
