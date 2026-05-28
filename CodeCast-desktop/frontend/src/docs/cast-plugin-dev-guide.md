# Cast 插件开发指南

## 目录
- [1. 快速开始](#1-快速开始)
  - [1.1 最小插件示例](#11-最小插件示例)
  - [1.2 5分钟创建你的第一个插件](#12-5分钟创建你的第一个插件)
  - [1.3 插件文件结构约定](#13-插件文件结构约定)
- [2. ICastTool 接口详解](#2-icasttool-接口详解)
  - [2.1 必填字段说明](#21-必填字段说明)
  - [2.2 可选字段说明](#22-可选字段说明)
  - [2.3 uiSchema 完整参考](#23-uischema-完整参考)
  - [2.4 权限声明最佳实践](#24-权限声明最佳实践)
  - [2.5 execute 函数编写规范](#25-execute-函数编写规范)
- [3. 工具类别与命名规范](#3-工具类别与命名规范)
  - [3.1 8大分类及适用场景](#31-8大分类及适用场景)
  - [3.2 ID命名规则](#32-id命名规则)
  - [3.3 版本号语义化](#33-版本号语义化)
- [4. 高级功能](#4-高级功能)
  - [4.1 流式输出工具](#41-流式输出工具)
  - [4.2 多工具协作](#42-多工具协作)
  - [4.3 工具间上下文传递](#43-工具间上下文传递)
  - [4.4 错误处理与重试](#44-错误处理与重试)
  - [4.5 ToolContext 可用资源详解](#45-toolcontext-可用资源详解)
- [5. 插件 Manifest 格式](#5-插件-manifest-格式)
  - [5.1 完整字段参考](#51-完整字段参考)
  - [5.2 manifest.json 示例](#52-manifestjson-示例)
  - [5.3 版本兼容性](#53-版本兼容性)
- [6. 调试技巧](#6-调试技巧)
  - [6.1 使用 Cast Sandbox 测试插件代码](#61-使用-cast-sandbox-测试插件代码)
  - [6.2 console.log 输出到哪里](#62-consolelog-输出到哪里)
  - [6.3 常见问题排查](#63-常见问题排查)
- [7. 发布 checklist](#7-发布-checklist)
  - [7.1 代码质量](#71-代码质量)
  - [7.2 测试覆盖](#72-测试覆盖)
  - [7.3 文档完整性](#73-文档完整性)
  - [7.4 安全审查](#74-安全审查)
- [8. API 参考](#8-api-参考)
  - [8.1 CastToolRegistry API](#81-casttoolregistry-api)
  - [8.2 plugin-loader API](#82-plugin-loader-api)
  - [8.3 castMarketplace API](#83-castmarketplace-api)
  - [8.4 castApiServer REST API](#84-castapiserver-rest-api)
- [附录 A: uiSchema 控件完整示例](#附录-a-uischema-控件完整示例)
- [附录 B: 50个工具创意灵感列表](#附录-b-50个工具创意灵感列表)
- [附录 C: 常用代码片段模板](#附录-c-常用代码片段模板)

---

## 1. 快速开始

### 1.1 最小插件示例

以下是一个**最小可运行**的 Cast 插件示例：

```typescript
// plugins/my-plugin/index.ts
import type { ICastTool, ToolResult } from '../../types/cast-plugin';

const myTool: ICastTool = {
  id: 'my_tool',
  name: '我的工具',
  description: '这是一个示例工具',
  version: '1.0.0',
  author: 'Your Name',
  category: 'utility',
  icon: '🔧',
  color: '#6366f1',
  tags: ['example', 'demo'],

  async execute(params, context): Promise<ToolResult> {
    return {
      success: true,
      output: 'Hello from my tool!',
      metadata: { timestamp: new Date().toISOString() }
    };
  }
};

export default [myTool];
```

### 1.2 5分钟创建你的第一个插件

**步骤 1**: 创建插件目录
```
plugins/BuiltinPlugins/hello-world/
```

**步骤 2**: 创建 `index.ts` 文件
```typescript
// plugins/BuiltinPlugins/hello-world/index.ts
import type { ICastTool, ToolResult, UISchema, ToolContext } from '../../../types/cast-plugin';

const helloTool: ICastTool = {
  id: 'hello_world',
  name: '世界你好',
  description: '向指定对象发送问候语',
  version: '1.0.0',
  author: 'Your Name',
  category: 'productivity',
  icon: '👋',
  color: '#10b981',
  tags: ['greeting', 'hello'],

  uiSchema: [
    { type: 'text', name: 'name', label: '名称', required: true, placeholder: '输入要问候的对象' }
  ] as UISchema[],

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const name = (params.name as string) || 'World';
    return {
      success: true,
      output: `👋 你好, ${name}! 欢迎使用 Cast 插件系统。`,
      metadata: { greetedAt: new Date().toISOString() }
    };
  }
};

export default [helloTool];
```

**步骤 3**: 注册到系统（自动或手动）
```typescript
// 在 bootstrapBuiltinCastTools 或初始化代码中
import helloWorldPlugin from './plugins/BuiltinPlugins/hello-world';

// 方式1: 通过 Registry 注册
registry.loadPlugin({
  name: 'hello-world',
  version: '1.0.0',
  description: '问候工具',
  author: 'You',
  entry: './index.ts',
  tools: helloWorldPlugin,
  permissions: []
});
```

### 1.3 插件文件结构约定

推荐的标准目录结构：

```
plugins/
├── BuiltinPlugins/                    # 内置插件（官方维护）
│   ├── weather/                       # 天气查询插件
│   │   ├── index.ts                   # 主入口（导出 ICastTool[]）
│   │   └── manifest.json              # 可选：插件清单
│   ├── github-notifier/
│   │   └── index.ts
│   └── ...                            # 更多内置插件
├── CommunityPlugins/                   # 社区插件（用户安装）
│   └── awesome-tool/
│       ├── index.ts
│       ├── manifest.json
│       └── README.md                  # 可选：使用说明
└── index.ts                           # 插件索引（可选）
```

**关键约定**:
- 每个 **插件目录** 必须包含 `index.ts` 作为主入口
- `index.ts` 必须 **default export** 一个 `ICastTool[]` 数组
- 文件名使用 **kebab-case**（如 `json-tools`、`unit-converter`）

---

## 2. ICastTool 接口详解

### 2.1 必填字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | `string` | 全局唯一标识符，使用 snake_case | `'weather_query'` |
| `name` | `string` | 显示名称（中文） | `'天气查询'` |
| `description` | `string` | 功能描述，用于搜索和展示 | `'查询全球城市的实时天气信息'` |
| `version` | `string` | 语义化版本号 | `'1.0.0'` |
| `author` | `string` | 作者/组织名 | `'CodeCast Official'` |
| `category` | `CastToolCategory` | 工具类别（见3.1节） | `'productivity'` |
| `icon` | `string` | 图标（Emoji 或图标名） | `'🌤️'` |
| `color` | `string` | 主题色（十六进制） | `'#0ea5e9'` |
| `tags` | `string[]` | 搜索标签 | `['weather', 'city']` |
| `execute` | `Function` | 执行函数（核心逻辑） | 见下方 |

### 2.2 可选字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `uiSchema` | `UISchema[]` | `undefined` | UI 表单配置（见2.3节） |
| `streaming` | `boolean` | `false` | 是否支持流式输出 |
| `permissions` | `Permission[]` | `[]` | 权限声明（见2.4节） |
| `dependencies` | `string[]` | `undefined` | 依赖的其他工具ID |
| `metadata` | `object` | `undefined` | 扩展元数据 |

### 2.3 uiSchema 完整参考

`UISchema` 定义了工具的参数输入界面，支持 **9种控件类型**：

#### 控件类型一览

```typescript
type UISchemaType = 'text' | 'textarea' | 'number' | 'select' | 'toggle'
                 | 'json' | 'file' | 'color' | 'slider';
```

#### 各类型详细说明

##### 1. text - 单行文本输入
```typescript
{
  type: 'text',
  name: 'city',              // 参数名（对应 params.key）
  label: '城市名称',          // 显示标签
  required: true,            // 是否必填
  placeholder: '北京/Tokyo...', // 占位提示
  validation: /^[a-zA-Z\u4e00-\u9fa5\s]+$/ // 正则校验
}
```

##### 2. textarea - 多行文本输入
```typescript
{
  type: 'textarea',
  name: 'code',
  label: '代码内容',
  placeholder: '粘贴代码...',
  defaultValue: ''           // 默认值
}
```

##### 3. number - 数字输入
```typescript
{
  type: 'number',
  name: 'count',
  label: '数量',
  min: 1,                    // 最小值
  max: 100,                  // 最大值
  step: 1,                   // 步长
  defaultValue: 10
}
```

##### 4. select - 下拉选择
```typescript
{
  type: 'select',
  name: 'language',
  label: '编程语言',
  options: [
    { label: 'TypeScript', value: 'ts' },
    { label: 'Python', value: 'py' },
    { label: 'Go', value: 'go' }
  ]
}
```

##### 5. toggle - 开关切换
```typescript
{
  type: 'toggle',
  name: 'verbose',
  label: '详细输出',
  defaultValue: false
}
```

##### 6. JSON 编辑器
```typescript
{
  type: 'json',
  name: 'config',
  label: 'JSON 配置',
  defaultValue: '{"key": "value"}'
}
```

##### 7. file - 文件上传
```typescript
{
  type: 'file',
  name: 'document',
  label: '上传文件',
  accept: ['.pdf', '.docx']   // 接受的文件类型
}
```

##### 8. color - 颜色选择器
```typescript
{
  type: 'color',
  name: 'themeColor',
  label: '主题颜色',
  defaultValue: '#6366f1'
}
```

##### 9. slider - 滑块
```typescript
{
  type: 'slider',
  name: 'opacity',
  label: '透明度',
  min: 0,
  max: 1,
  step: 0.1,
  defaultValue: 0.8
}
```

### 2.4 权限声明最佳实践

#### 权限类型

```typescript
type Permission = 'none' | 'read' | 'write' | 'execute' | 'network' | 'filesystem';
```

| 权限 | 含义 | 适用场景 |
|------|------|----------|
| `'none'` | 无需特殊权限 | 纯计算类工具 |
| `'read'` | 只读访问 | 信息查询、读取配置 |
| `'write'` | 写入权限 | 修改文件、保存数据 |
| `'execute'` | 执行命令 | 运行脚本、调用外部程序 |
| `'network'` | 网络访问 | API 调用、HTTP 请求 |
| `'filesystem'` | 文件系统访问 | 读写本地文件 |

#### 最佳实践

```typescript
// ✅ 正确：只声明实际需要的最小权限
permissions: ['network']  // 天气API需要网络访问

// ❌ 错误：过度声明权限
permissions: ['network', 'filesystem', 'execute', 'write']
```

### 2.5 execute 函数编写规范

#### 函数签名

```typescript
async execute(
  params: Record<string, unknown>,  // 用户输入的参数
  context: ToolContext               // 运行时上下文
): Promise<ToolResult>               // 返回结果
```

#### 标准模板

```typescript
async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
  // 1. 解析和验证参数
  const value = (params.value as string) || '';
  if (!value) {
    return {
      success: false,
      output: '❌ 缺少必要参数',
      error: 'Missing required parameter'
    };
  }

  try {
    // 2. 尝试使用 LLM（如果有 sendMessage）
    const sendMessage = (context as any)?.sendMessage;
    if (typeof sendMessage === 'function') {
      const result = await sendMessage(`处理: ${value}`);
      return {
        success: true,
        output: result,
        metadata: { processedAt: new Date().toISOString() }
      };
    }

    // 3. Fallback 到本地逻辑
    return {
      success: true,
      output: `处理结果: ${value}`,
      metadata: { simulated: true }
    };

  } catch (error: any) {
    // 4. 统一错误处理
    return {
      success: false,
      output: `❌ 处理失败: ${error.message}`,
      error: error.message
    };
  }
}
```

#### ToolResult 结构

```typescript
interface ToolResult {
  success: boolean;           // 是否成功
  output: string;             // 输出内容（展示给用户）
  data?: unknown;             // 结构化数据（供其他工具使用）
  error?: string;             // 错误信息（success=false 时填写）
  metadata?: Record<string, unknown>;  // 元数据
  streaming?: boolean;        // 是否流式输出
}
```

---

## 3. 工具类别与命名规范

### 3.1 8大分类及适用场景

| 分类 | 值 | 适用场景 | 示例工具 |
|------|-----|----------|----------|
| 分析 | `analysis` | 数据分析、代码分析 | 代码复杂度分析、性能剖析 |
| 会议 | `meeting` | 会议相关 | 会议纪要生成、议程管理 |
| 管理 | `management` | 项目管理、任务管理 | 任务分配、进度跟踪 |
| 实用工具 | `utility` | 通用工具 | JSON格式化、单位换算 |
| 创意 | `creative` | 内容创作 | 文案生成、创意灵感 |
| 通信 | `communication` | 通信相关 | 邮件撰写、消息翻译 |
| 效率 | `productivity` | 提升效率 | 天气查询、新闻摘要 |
| 自定义 | `custom` | 其他未分类 | 特殊用途工具 |

### 3.2 ID命名规则

**规则**:
- 使用 **snake_case**（小写+下划线）
- 格式：`{功能域}_{具体动作}`
- 保持简短但有描述性

**正确示例**:
```typescript
✅ 'weather_query'          // 天气_查询
✅ 'github_repo_stats'      // github_仓库_统计
✅ 'json_format'            // json_格式化
✅ 'unit_convert'           // 单位_转换
✅ 'code_review'            // 代码_审查
```

**错误示例**:
```typescript
❌ 'WeatherQuery'           // 不用驼峰
❌ 'weather-query'          // 不用 kebab-case
❌ 'wq'                     // 过于简短
❌ 'getTheWeatherInfoForCity' // 过于冗长
```

### 3.3 版本号语义化

遵循 [SemVer 2.0](https://semver.org/lang/zh-CN/) 规范：

```
MAJOR.MINOR.PATCH
  │      │      │
  │      │      └── Bug修复（向后兼容）
  │      └──────── 新功能（向后兼容）
  └───────────── 不兼容的API变更
```

**示例**:
- `1.0.0` → 首次发布
- `1.1.0` → 新增流式输出支持
- `1.1.1` → 修复边界条件bug
- `2.0.0` → 重构 execute 函数签名

---

## 4. 高级功能

### 4.1 流式输出工具

适用于耗时较长或需要实时反馈的场景：

```typescript
const streamingTool: ICastTool = {
  id: 'streaming_example',
  name: '流式输出示例',
  description: '演示流式输出功能',
  // ... 其他字段
  streaming: true,

  async execute(params, context): Promise<ToolResult> {
    const chunks = ['正在处理...', '分析中...', '完成!'];
    let fullOutput = '';

    for (const chunk of chunks) {
      fullOutput += chunk + '\n';

      if (context.signal?.aborted) {
        return { success: false, output: '已取消', error: 'Aborted by user' };
      }

      // 模拟流式输出
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      success: true,
      output: fullOutput,
      streaming: true
    };
  }
};
```

**关键点**:
1. 设置 `streaming: true`
2. 监听 `context.signal` 支持取消
3. 分块返回结果

### 4.2 多工具协作

通过 `dependencies` 声明依赖关系：

```typescript
const dataFetcher: ICastTool = {
  id: 'data_fetcher',
  name: '数据获取器',
  dependencies: ['auth_manager'],  // 依赖认证工具
  // ...
};

const reportGenerator: ICastTool = {
  id: 'report_generator',
  name: '报告生成器',
  dependencies: ['data_fetcher', 'data_analyzer'],  // 依赖多个工具
  // ...
};
```

### 4.3 工具间上下文传递

通过 `context.tools` 访问其他工具：

```typescript
async execute(params, context): Promise<ToolResult> {
  const otherTool = context.tools?.get('other_tool_id');
  if (otherTool) {
    const result = await otherTool.execute(
      { input: 'data' },
      context
    );
    // 使用其他工具的结果...
  }

  return { success: true, output: 'Done!' };
}
```

### 4.4 错误处理与重试

#### 统一错误处理模式

```typescript
async execute(params, context): Promise<ToolResult> {
  try {
    // 主逻辑
    return { success: true, output: result };
  } catch (error: any) {
    // 分类错误
    if (error.name === 'TimeoutError') {
      return {
        success: false,
        output: '⏱️ 操作超时，请稍后重试',
        error: 'TIMEOUT',
        metadata: { retryable: true }
      };
    }

    if (error.message.includes('401')) {
      return {
        success: false,
        output: '🔒 认证失败，请检查 API 密钥',
        error: 'AUTH_FAILED'
      };
    }

    // 默认错误
    return {
      success: false,
      output: `❌ 失败: ${error.message}`,
      error: error.message
    };
  }
}
```

#### 重试机制

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 4.5 ToolContext 可用资源详解

```typescript
interface ToolContext {
  sessionId?: string;         // 当前会话ID
  userId?: string;            // 当前用户ID
  workspacePath?: string;     // 工作空间路径
  signal?: AbortSignal;       // 取消信号
  sendMessage?: (message: string) => void;  // 发送消息到LLM
  tools?: Map<string, ICastTool>;           // 已注册的工具映射
}
```

**使用示例**:

```typescript
async execute(params, context): Promise<ToolResult> {
  // 获取会话信息
  console.log('Session:', context.sessionId);

  // 检查是否被取消
  if (context.signal?.aborted) {
    return { success: false, output: 'Cancelled' };
  }

  // 发送消息给LLM
  await context.sendMessage?.('请帮我分析这段代码');

  // 访问其他工具
  const allTools = Array.from(context.tools?.values() || []);

  return { success: true, output: 'Done' };
}
```

---

## 5. 插件 Manifest 格式

### 5.1 完整字段参考

```typescript
interface CastPluginManifest {
  name: string;               // 插件名称（唯一标识）
  version: string;            // 版本号
  description: string;        // 描述
  author: string;             // 作者
  entry: string;              // 入口文件路径
  tools: ICastTool[];         // 包含的工具列表
  permissions: Permission[];  // 所需权限
  dependencies?: string[];    // 依赖的其他插件
  castMinVersion?: string;    // 最低Cast版本要求
  keywords?: string[];        // 搜索关键词
}
```

### 5.2 manifest.json 示例

```json
{
  "name": "awesome-tools",
  "version": "1.2.0",
  "description": "一组实用的开发工具集",
  "author": "Developer Name",
  "entry": "./index.ts",
  "tools": [
    {
      "id": "json_format",
      "name": "JSON格式化"
    },
    {
      "id": "base64_encode",
      "name": "Base64编码"
    }
  ],
  "permissions": ["none"],
  "keywords": ["json", "encoding", "format"],
  "castMinVersion": "1.0.0"
}
```

### 5.3 版本兼容性

- `castMinVersion`: 声明最低兼容版本
- 当 Cast 版本低于此值时，插件加载会失败并给出警告
- 建议：使用新API前检查版本

---

## 6. 调试技巧

### 6.1 使用 Cast Sandbox 测试插件代码

1. 打开 **SandboxPanel** 组件
2. 粘贴插件代码
3. 点击"运行"测试
4. 查看控制台输出和返回值

### 6.2 console.log 输出到哪里

- 开发环境：浏览器 DevTools Console
- 生产环境：通过日志收集系统查看
- 建议：使用结构化日志

```typescript
// ✅ 推荐：结构化日志
console.log('[MyPlugin]', { action: 'execute', params, duration: 123 });

// ❌ 不推荐：无意义日志
console.log('here');
console.log('debug');
```

### 6.3 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 插件不显示 | 未注册或注册失败 | 检查 Registry 日志 |
| execute 报错 | 类型错误或空值 | 添加参数验证 |
| 权限不足 | 未声明所需权限 | 更新 permissions 字段 |
| 依赖缺失 | dependencies 配置错误 | 检查依赖工具是否存在 |
| 性能问题 | 同步阻塞操作 | 改用异步 + 流式 |

---

## 7. 发布 Checklist

### 7.1 代码质量

- [ ] TypeScript 编译无错误 (`tsc --noEmit`)
- [ ] ESLint 检查通过
- [ ] 所有必填字段已填写
- [ ] 无硬编码密钥或敏感信息
- [ ] 错误处理覆盖所有分支

### 7.2 测试覆盖

- [ ] 单元测试覆盖率 > 80%
- [ ] 边界条件测试（空值、极大值、特殊字符）
- [ ] 异常流程测试（网络超时、权限拒绝）
- [ ] 集成测试（与其他工具配合）

### 7.3 文档完整性

- [ ] README.md 包含使用说明
- [ ] 所有公开 API 有 JSDoc 注释
- [ ] 示例代码可正常运行
- [ ] 变更日志更新

### 7.4 安全审查

- [ ] 无 XSS 风险（用户输入经过转义）
- [ ] 无注入风险（SQL/命令注入）
- [ ] 权限声明准确且最小化
- [ ] 无敏感数据泄露（日志中不含密码等）

---

## 8. API 参考

### 8.1 CastToolRegistry API

```typescript
class CastToolRegistry {
  register(tool: ICastTool): boolean;           // 注册单个工具
  unregister(toolId: string): boolean;          // 注销工具
  get(toolId: string): ICastTool | undefined;   // 获取工具
  getAll(): ICastTool[];                        // 获取所有工具
  search(query: string): ICastTool[];           // 搜索工具
  count(): number;                              // 工具数量
  has(toolId: string): boolean;                 // 检查是否存在
  loadPlugin(manifest: CastPluginManifest): PluginLoadResult;  // 加载插件
  unloadPlugin(pluginName: string): boolean;    // 卸载插件
  getPluginTools(pluginName: string): ICastTool[];  // 获取插件的工具
  subscribe(callback: (event: RegistryEvent) => void): () => void;  // 订阅事件
  getSnapshot(): CastToolRegistryState;         // 获取状态快照
}
```

**使用示例**:

```typescript
import { registry } from '../tools/CastToolRegistry';

// 注册
registry.register(myTool);

// 查询
const tool = registry.get('weather_query');
const results = registry.search('天气');

// 批量加载
const result = registry.loadPlugin(manifest);
console.log(result.tools);    // 加载成功的工具
console.log(result.errors);   // 错误信息
```

### 8.2 plugin-loader API

```typescript
const pluginLoader = {
  async loadFromLocal(path: string): Promise<PluginLoadResult>;
  async loadFromUrl(url: string): Promise<PluginLoadResult>;
  async loadFromManifest(manifest: CastPluginManifest): Promise<PluginLoadResult>;
  validateManifest(manifest: unknown): { valid: boolean; errors: string[] };
};
```

### 8.3 castMarketplace API

```typescript
const castMarketplace = {
  OFFICIAL_PLUGINS: PluginInfo[];              // 官方插件列表
  getPlugin(id: string): PluginInfo | undefined;
  searchPlugins(query: string): PluginInfo[];
  getCategoryPlugins(category: string): PluginInfo[];
};
```

### 8.4 castApiServer REST API

详见 Postman 集合文件 `cast-api-postman-collection.json`。

**主要端点**:

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/memory` | 获取所有记忆 |
| POST | `/api/v1/memory` | 添加记忆 |
| DELETE | `/api/v1/memory/:id` | 删除记忆 |
| GET | `/api/v1/scheduler/jobs` | 获取任务列表 |
| POST | `/api/v1/scheduler/jobs` | 创建任务 |
| GET | `/api/v1/tools` | 获取工具列表 |
| GET | `/api/v1/health` | 健康检查 |

---

## 附录 A: uiSchema 控件完整示例

### 复杂表单示例

```typescript
const complexUiSchema: UISchema[] = [
  // 基本信息
  { type: 'text', name: 'title', label: '标题', required: true },
  { type: 'textarea', name: 'description', label: '描述', placeholder: '详细描述...' },

  // 配置选项
  { type: 'select', name: 'mode', label: '模式', options: [
    { label: '快速模式', value: 'fast' },
    { label: '精确模式', value: 'precise' },
    { label: '自定义', value: 'custom' }
  ]},

  // 数值调节
  { type: 'number', name: 'timeout', label: '超时时间(秒)', min: 1, max: 300, defaultValue: 30 },
  { type: 'slider', name: 'quality', label: '质量', min: 0, max: 100, defaultValue: 80 },

  // 开关选项
  { type: 'toggle', name: 'verbose', label: '详细输出' },
  { type: 'toggle', name: 'saveResult', label: '保存结果' },

  // 高级配置
  { type: 'json', name: 'advancedConfig', label: '高级配置(JSON)', defaultValue: '{}' },
  { type: 'color', name: 'accentColor', label: '强调色', defaultValue: '#6366f1' }
];
```

### 条件显示（动态表单）

虽然当前 uiSchema 不原生支持条件显示，但可以通过以下方式实现：

```typescript
// 在 execute 中根据参数动态调整行为
async execute(params, context) {
  const mode = params.mode as string;

  if (mode === 'custom') {
    // 自定义模式需要额外参数
    const config = params.advancedConfig as string;
    // ...
  }
  // ...
}
```

---

## 附录 B: 50个工具创意灵感列表

### 🛠️ 开发者工具 (1-10)
1. **代码审查助手** - 自动审查代码质量
2. **API 文档生成** - 从代码注释生成 OpenAPI 规范
3. **正则表达式测试** - 可视化正则匹配过程
4. **SQL 查询构建** - 自然语言转 SQL
5. **Git 日志分析** - 可视化提交历史
6. **Docker Compose 生成** - 从描述生成 docker-compose.yml
7. **环境变量管理** - 加密存储和管理 .env
8. **依赖更新检查** - 检查过时的 npm/pip 包
9. **性能分析报告** - 分析代码性能瓶颈
10. **错误日志解析** - 智能解析堆栈跟踪

### 📊 数据与分析 (11-20)
11. **CSV/Excel 数据可视化** - 生成交互式图表
12. **数据清洗工具** - 去重、格式标准化
13. **统计分析计算** - 均值、方差、回归分析
14. **A/B 测试计算器** - 统计显著性检验
15. **数据库 Schema 设计** - ER图生成
16. **API 响应模拟** - Mock Server 数据生成
17. **日志聚合分析** - 多源日志统一查询
18. **指标仪表盘** - 自定义 KPI 展示
19. **数据脱敏工具** - PII 数据匿名化
20. **ETL 流程设计** - 可视化数据管道

### ✍️ 内容创作 (21-30)
21. **SEO 关键词研究** - 竞争分析和建议
22. **多语言翻译** - 上下文感知翻译
23. **文案风格转换** - 正式/口语/技术风格
24. **社交媒体帖子** - 多平台适配
25. **邮件模板生成** - 商务邮件自动化
26. **README 生成器** - 项目文档一键生成
27. **技术博客大纲** - 文章结构规划
28. **产品描述优化** - 转化率优化文案
29. **幻灯片内容** - PPT 要点提取
30. **视频脚本撰写** - 短视频/长视频脚本

### 🎨 设计与创意 (31-35)
31. **配色方案生成** - 色彩理论和调色板
32. **UI 组件代码生成** - Figma 转 React/Vue
33. **图标库搜索** - 语义化图标推荐
34. **字体配对建议** - 字体组合推荐
35. **Logo 设计构思** - 品牌视觉元素

### 🔐 安全与合规 (36-40)
36. **密码强度检测** - 熵值计算和建议
37. **安全扫描报告** - 依赖漏洞检查
38. **GDPR 合规检查** - 隐私政策生成
39. **权限矩阵生成** - RBAC 配置可视化
40. **加密/解密工具** - Base64/Hash/AES

### 📈 项目管理 (41-45)
41. **Sprint 规划助手** - 故事点估算
42. **风险识别清单** - 项目风险评估
43. **会议纪要整理** - 录音转文字+要点
44. **工时追踪** - 时间记录和分析
45. **OKR 对齐检查** - 目标一致性验证

### 🌐 互联网工具 (46-50)
46. **网页截图对比** - 视觉回归测试
47. **URL 缩短服务** - 自托管短链接
48. **RSS 聚合器** - 多源资讯整合
49. **网站性能评分** - Lighthouse 指标
50. **域名可用性检查** - 批量查询 WHOIS

---

## 附录 C: 常用代码片段模板

### 模板 1: 基础工具骨架

```typescript
import type { ICastTool, ToolContext, ToolResult, UISchema } from '../../types/cast-plugin';

const TOOL_ID = 'your_tool_name';

const yourTool: ICastTool = {
  id: TOOL_ID,
  name: '工具名称',
  description: '一句话描述功能',
  version: '1.0.0',
  author: 'Your Name',
  category: 'utility',
  icon: '🔧',
  color: '#6366f1',
  tags: ['tag1', 'tag2'],

  uiSchema: [] as UISchema[],

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.process(params, context);
      return {
        success: true,
        output: result,
        metadata: { processedAt: new Date().toISOString() }
      };
    } catch (error: any) {
      return {
        success: false,
        output: `❌ 失败: ${error.message}`,
        error: error.message
      };
    }
  },

  private async process(params: Record<string, unknown>, context: ToolContext): Promise<string> {
    // 你的业务逻辑
    return 'result';
  }
};

export default [yourTool];
```

### 模板 2: 带 UI 的交互式工具

```typescript
const interactiveTool: ICastTool = {
  id: 'interactive_demo',
  name: '交互式演示',
  description: '带完整 UI 的工具示例',
  version: '1.0.0',
  author: 'Author',
  category: 'productivity',
  icon: '🎯',
  color: '#f59e0b',
  tags: ['demo', 'interactive'],

  uiSchema: [
    { type: 'text', name: 'input', label: '输入', required: true },
    { type: 'select', name: 'option', label: '选项', options: [
      { label: '选项A', value: 'a' },
      { label: '选项B', value: 'b' }
    ]},
    { type: 'toggle', name: 'advanced', label: '高级模式' }
  ] as UISchema[],

  async execute(params, context): Promise<ToolResult> {
    const input = params.input as string;
    const option = params.option as string;
    const advanced = params.advanced as boolean;

    let output = `📥 输入: ${input}\n`;
    output += `🎚️ 选项: ${option}\n`;
    output += `⚡ 高级模式: ${advanced ? '开启' : '关闭'}\n\n`;

    output += `✅ 处理完成!`;

    return { success: true, output };
  }
};
```

### 模板 3: 流式输出工具

```typescript
const streamTool: ICastTool = {
  id: 'streaming_tool',
  name: '流式输出工具',
  description: '支持实时反馈的长耗时操作',
  version: '1.0.0',
  author: 'Author',
  category: 'analysis',
  icon: '📡',
  color: '#8b5cf6',
  tags: ['streaming', 'real-time'],
  streaming: true,

  async execute(params, context): Promise<ToolResult> {
    const steps = [
      '🔄 初始化...',
      '📊 收集数据...',
      '🔍 分析中...',
      '📝 生成报告...',
      '✅ 完成!'
    ];

    let output = '';

    for (const step of steps) {
      if (context.signal?.aborted) {
        return { success: false, output, error: 'User cancelled' };
      }

      output += step + '\n';
      await new Promise(r => setTimeout(r, 800));
    }

    return { success: true, output, streaming: true };
  }
};
```

### 模板 4: 多工具协作

```typescript
// 工具A: 数据获取
const fetcher: ICastTool = {
  id: 'data_fetcher',
  name: '数据获取器',
  // ...基础配置
  async execute(params, context): Promise<ToolResult> {
    const data = { items: [1, 2, 3], total: 3 };
    return {
      success: true,
      output: JSON.stringify(data),
      data  // 将结构化数据传递给下游工具
    };
  }
};

// 工具B: 数据处理（依赖工具A）
const processor: ICastTool = {
  id: 'data_processor',
  name: '数据处理器',
  dependencies: ['data_fetcher'],  // 声明依赖
  async execute(params, context): Promise<ToolResult> {
    const fetcher = context.tools?.get('data_fetcher');
    if (!fetcher) {
      return { success: false, output: '缺少依赖: data_fetcher' };
    }

    const fetched = await fetcher.execute({}, context);
    const data = fetched.data as { items: number[] };

    const processed = data.items.map(x => x * 2);
    return {
      success: true,
      output: `处理后: ${processed.join(', ')}`
    };
  }
};
```

---

## 更新日志

### v1.0.0 (2025-01)
- 初始版本发布
- 包含完整的接口文档和最佳实践
- 提供 5 个官方示例插件
- Postman API 集合
- 架构决策记录

---

**文档版本**: 1.0.0
**最后更新**: 2025-01
**适用 Cast 版本**: >= 1.0.0
