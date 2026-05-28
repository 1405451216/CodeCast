# 错误监控体系文档

## 概述

CodeCast 集成了 **Sentry** 错误监控系统，提供生产级的错误追踪、性能监控和用户行为回放能力。

## 快速开始

### 1. 获取 Sentry DSN

1. 访问 [Sentry.io](https://sentry.io)
2. 创建新项目（选择 React）
3. 复制 **DSN**（Data Source Name）

### 2. 配置环境变量

```bash
cp .env.sentry.example .env.local
```

编辑 `.env.local`：

```env
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_SENTRY_SAMPLE_RATE=0.2
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

### 3. 启动应用

```bash
npm run dev
```

Sentry 会自动初始化并开始收集错误。

---

## 功能特性

### ✅ 错误捕获

#### 自动捕获的错误类型

| 类型 | 来源 | 级别 |
|------|------|------|
| **React 渲染错误** | ErrorBoundary | Error/Fatal |
| **JavaScript 异常** | window.onerror | Error |
| **Promise 拒绝** | unhandledrejection | Warning |
| **资源加载失败** | img/script/link 加载失败 | Warning |
| **API 错误** | 手动调用 captureException | 可配置 |

#### 增强的 ErrorBoundary

[ErrorBoundary.tsx](./src/components/ErrorBoundary.tsx) 已集成 Sentry：

```typescript
// 自动上报：
- ✅ 错误堆栈信息
- ✅ 组件渲染上下文
- ✅ 性能指标（FPS/内存/渲染时间）
- ✅ 错误计数和恢复建议
- ✅ 用户环境和 URL
```

### ✅ 性能追踪

自动采集 Core Web Vitals：
- **FCP** (First Contentful Paint)
- **LCP** (Largest Contentful Paint)
- **CLS** (Cumulative Layout Shift)
- **TTI** (Time to Interactive)

### ✅ 用户会话回放（Session Replay）

在发生错误时，自动录制最后几秒的用户操作：
- 🎬 鼠标移动和点击
- ⌨️ 键盘输入（已脱敏）
- 📱 页面滚动
- 🔗 导航路径

> **隐私保护**: 所有文本内容自动脱敏，密码字段被屏蔽。

---

## 使用指南

### 手动捕获错误

```typescript
import { captureException, captureMessage } from '@/utils/sentry';

// 捕获异常
try {
  riskyOperation();
} catch (error) {
  captureException(error, {
    tags: { feature: 'user-auth' },
    extra: { userId: user.id },
    level: 'error'
  });
}

// 记录消息
captureMessage('用户登录成功', 'info', {
  tags: { action: 'login' },
  extra: { method: 'oauth' }
});
```

### 设置用户上下文

```typescript
import { setUser } from '@/utils/sentry';

setUser({
  id: '12345',
  email: 'user@example.com',
  username: 'johndoe'
});
```

### 添加面包屑（Breadcrumbs）

```typescript
import { addBreadcrumb } from '@/utils/sentry';

addBreadcrumb({
  category: 'ui',
  message: '用户点击了保存按钮',
  level: 'info',
  data: { formId: 'settings-form' }
});
```

### 设置额外上下文

```typescript
import { setContext } from '@/utils/sentry';

setContext('app_state', {
  theme: 'dark',
  language: 'zh-CN',
  version: '1.0.0'
});
```

---

## 配置选项

### 环境变量

| 变量名 | 说明 | 默认值 | 推荐值 |
|--------|------|--------|--------|
| `VITE_SENTRY_DSN` | Sentry 数据源名称 | - | 必填 |
| `VITE_SENTRY_SAMPLE_RATE` | 错误采样率 | 0.2 | 生产: 0.1-0.2 |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | 性能追踪采样率 | 0.1 | 生产: 0.05-0.1 |
| `VITE_APP_VERSION` | 应用版本号 | 1.0.0 | 从 package.json 读取 |

### 高级配置

编辑 [sentry.ts](./src/utils/sentry.ts)：

```typescript
Sentry.init({
  // 忽略特定错误
  ignoreErrors: [
    /Non-Error promise rejection captured/,
    /ResizeObserver loop limit exceeded/,
  ],

  // 屏蔽第三方扩展错误
  denyUrls: [
    /extensions\//i,
    /^chrome-extension:\/\//i,
  ],

  // 自定义数据过滤
  beforeSend(event) {
    // 移除敏感信息
    delete event.user?.email;
    delete event.user?.ip_address;
    
    return event;
  },
});
```

---

## 隐私与安全

### ✅ 内置保护措施

1. **IP 地址匿名化**
   ```typescript
   delete event.user.ip_address;
   ```

2. **敏感数据脱敏**
   - 密码字段：`******`
   - Email：仅保留域名
   - API Key：完全移除

3. **文本内容屏蔽**
   ```typescript
   new Sentry.Replay({
     maskAllText: true,  // 屏蔽所有文本
     blockAllMedia: true, // 阻止媒体元素
   });
   ```

4. **请求头过滤**
   - Authorization
   - Cookie
   - X-API-Key

### GDPR 合规性

- ❌ 不收集 PII（个人身份信息）
- ✅ 支持数据导出请求
- ✅ 支持账户删除
- ✅ 提供数据处理协议（DPA）

---

## 监控仪表板

### 关键指标

在 Sentry Dashboard 中查看：

| 指标 | 描述 | 告警阈值 |
|------|------|---------|
| **错误率** | 每分钟错误数量 | > 10/min |
| **崩溃率** | 导致应用崩溃的错误 | > 5% |
| **P50 延迟** | 中位数响应时间 | > 3s |
| **P95 延迟** | 95分位响应时间 | > 8s |
| **Apdex 分数** | 用户满意度指数 | < 0.7 |

### 告警规则示例

```yaml
# 错误数量激增
- name: "错误激增"
  condition: "errors > 100 in 5m"
  actions:
    - notify: slack:#alerts
    - severity: critical

# 新出现的错误类型
- name: "新错误"
  condition: "new issue created"
  actions:
    - notify: email:team@codecast.cloud
    - severity: warning
```

---

## 本地开发

### 禁用 Sentry

如果不想在本地开发时发送数据：

```bash
# 方法 1：不设置 VITE_SENTRY_DSN
# Sentry 会自动跳过初始化

# 方法 2：设置空字符串
VITE_SENTRY_DSN=
```

### 调试模式

```typescript
// 在浏览器控制台查看 Sentry 日志
window.__SENTRY__?.logger.enable();
```

---

## CI/CD 集成

### GitHub Actions 示例

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: your-org
          SENTRY_PROJECT: your-project
          
      - name: Create Sentry Release
        run: npx @sentry/cli releases -o $SENTRY_ORG -p $SENTRY_PROJECT new ${{ github.sha }}
        
      - name: Upload Source Maps
        run: npx @sentry/cli releases -o $SENTRY_ORG -p $SENTRY_PROJECT files ${{ github.sha }} upload-sourcemaps ./dist --url-prefix '~/'
        
      - name: Finalize Release
        run: npx @sentry/cli releases -o $SENTRY_ORG -p $SENTRY_PROJECT finalize ${{ github.sha }}
```

### Source Maps 上传

```json
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true  // 启用 Source Maps 用于错误定位
  }
})
```

---

## 故障排查

### 问题：Sentry 未收到错误

**检查清单**：
- [ ] `VITE_SENTRY_DSN` 是否正确设置？
- [ ] 网络连接是否正常？（检查 CORS）
- [ ] 是否在 `ignoreErrors` 列表中？

**调试方法**：
```javascript
// 在控制台手动触发测试错误
throw new Error('Test Sentry Integration');
```

### 问题：Source Maps 未生效

**解决方案**：
1. 确保 `build.sourcemap: true`
2. 上传 Source Maps 到 Sentry
3. 设置正确的 `urlPrefix`
4. 清除浏览器缓存

### 问题：性能追踪数据过多

**优化方案**：
```env
VITE_SENTRY_TRACES_SAMPLE_RATE=0.01  # 降低到 1%
```

---

## 最佳实践

### ✅ 推荐做法

1. **为关键业务流程添加 Breadcrumbs**
   ```typescript
   addBreadcrumb({ category: 'auth', message: 'Login started' });
   ```

2. **使用 Tags 进行分类**
   ```typescript
   captureException(err, { tags: { feature: 'payment' } });
   ```

3. **设置合理的采样率**
   - 开发环境：100%
   - 测试环境：50%
   - 生产环境：10-20%

4. **定期清理旧数据**
   - Sentry 免费版保留 30 天
   - 建议定期归档和删除

### ❌ 避免做法

1. **不要记录敏感信息**
   ```typescript
   // ❌ 错误
   captureMessage(`User password: ${password}`);
   
   // ✅ 正确
   captureMessage('Password validation failed');
   ```

2. **不要过度使用**
   ```typescript
   // ❌ 错误：每秒发送 10 次
   setInterval(() => captureMessage('ping'), 100);
   
   // ✅ 正确：聚合后批量发送
   let errors = [];
   setInterval(() => {
     if (errors.length > 0) {
       captureMessage(`${errors.length} errors occurred`);
       errors = [];
     }
   }, 60000);
   ```

---

## 相关链接

- [Sentry 官方文档](https://docs.sentry.io/)
- [React 集成指南](https://docs.sentry.io/platforms/react/)
- [Performance Monitoring](https://docs.sentry.io/performance-monitoring/)
- [Session Replay](https://docs.sentry.io/session-replay/)

---

## 更新日志

### v1.0.0 (2026-05-28)

- ✅ 初始化 Sentry 集成
- ✅ 增强 ErrorBoundary 错误上报
- ✅ 实现全局错误处理器
- ✅ 支持 Session Replay
- ✅ 性能追踪集成
- ✅ 隐私保护和 GDPR 合规
