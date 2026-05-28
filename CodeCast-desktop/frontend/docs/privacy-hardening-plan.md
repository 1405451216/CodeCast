# 🔒 CodeCast 隐私加固计划清单

> 创建时间: 2026-05-27 18:30
> 状态: 待执行
> 目标: 确认并强化 CodeCast 作为「纯本地 Agent」的安全定位

---

## 一、安全审计结论

### 当前评分: 85/100（良好，但需加固）

### ✅ 已确认安全的模块（无数据外传风险）

| 模块 | 存储方式 | 数据范围 |
|------|---------|---------|
| Memory v2.0 | localStorage | 仅本地浏览器 |
| Scheduler | localStorage | 仅本地 |
| Settings | localStorage + AES-256加密 | API密钥本地加密存储 |
| Learning Loop | localStorage | 操作日志不外传 |
| SOUL Personality | localStorage | 人格配置本地 |
| Collaboration | BroadcastChannel | 同源跨窗口，不出设备 |
| API Server | BroadcastChannel + 内存 | 纯进程内通信 |
| Sandbox | Function构造函数 | 已禁止fetch/XMLHttpRequest |
| FileSystem | Go API / localStorage VFS | 本地文件系统 |
| Plugin Marketplace | OFFICIAL_PLUGINS硬编码在代码中 | 无远程拉取 |

### ⚠️ 4个外部通信点（需管控）

#### #1 LLM API 调用 — `api.sendMessageEx()`
- **等级**: 🟡 必要风险（AI功能核心依赖）
- **目标**: 用户自选的 DeepSeek/OpenAI/Anthropic/Gemini/Ollama
- **外传数据**: 用户输入的 prompt + 上下文
- **现状**: 用户自行配置API Key，符合预期
- **加固**: 添加发送前确认提示（可选开关）

#### #2 Webhook 通道 — `cast-channels-engine.ts` L279
- **等级**: 🟢 用户主动触发（需手动配置URL）
- **目标**: 飞书/钉钉/企业微信/Slack/Discord/自定义URL
- **外传数据**: 用户配置的事件payload
- **现状**: 必须用户手动创建Channel并填写URL才触发
- **加固**: 出站前弹出确认对话框，显示即将发送的数据摘要

#### #3 浏览器自动化 — `cast-browser-engine.ts`
- **等级**: 🟢 用户主动触发
- **目标**: 用户指定的任意URL
- **外传数据**: 用户导航到的网页内容
- **现状**: 用户主动输入URL才访问
- **加固**: 导航到非白名单域名时弹窗警告

#### #4 ⚠️ 死代码 — `cast-marketplace.ts` L94
```typescript
private registryUrl = 'https://marketplace.codecast.dev/api';
```
- **等级**: 🔴 已定义但当前未使用（死代码）
- **操作**: 删除或注释掉，避免未来误用导致远程请求

---

## 二、待执行任务清单（按优先级排序）

### P0 - 必须立即完成（隐私核心）

- [ ] **T1**: 创建 `utils/cast/cast-privacy-manager.ts` — PrivacyManager 核心模块
  - 网络出站审计日志（记录所有 fetch/XMLHttpRequest 调用）
  - 出站控制策略引擎（allowlist/denylist/prompt模式）
  - 数据分类标记（public/private/sensitive）
  - 外传统计仪表盘数据源
  - 关键方法: `auditOutbound()`, `shouldAllowOutbound()`, `getPrivacyReport()`

- [ ] **T2**: 创建 `types/cast-privacy.ts` — 隐私相关类型定义
  - `PrivacyLevel`: 'public' | 'private' | 'sensitive' | 'restricted'
  - `OutboundAuditLog`: id/url/method/dataSize/timestamp/category/reason/userConfirmed
  - `PrivacyPolicyConfig`: mode(allowAll|promptAll|denyAll|custom)/rules[]/exemptDomains[]
  - `SecurityManifest`: 常量对象声明 CodeCast 安全承诺

- [ ] **T3**: 创建 `store/useCastPrivacyStore.ts` — 隐私状态管理
  - Zustand store: `cast-privacy-store`
  - 出站审计日志 CRUD
  - 隐私策略配置持久化
  - 统计数据计算

### P1 - 高优先级（用户体验+安全）

- [ ] **T4**: 创建 `components/cast/SecurityDashboard.tsx` — 安全仪表盘面板
  - 安全状态总览卡片（绿/黄/红指示）
  - 出站审计日志时间线（最近100条）
  - 数据存储位置可视化（localStorage用量/分布）
  - 外部通信点状态列表（4个通信点的实时状态）
  - 隐私策略快速切换开关
  - 「一键清除所有远程数据」按钮

- [ ] **T5**: Webhook 出站确认对话框
  - 修改 `cast-channels-engine.ts` 的 `sendWebhook()` 方法
  - 发送前通过事件机制通知UI层弹窗
  - 弹窗显示: 目标URL、数据大小、敏感字段脱敏预览
  - 用户可选择: 允许 / 允许且记住此域名 / 拒绝

- [ ] **T6**: Browser 自动化导航警告
  - 修改 `cast-browser-engine.ts` 的 navigate 方法
  - 导航到新域名时触发警告事件
  - 显示目标域名 + 安全提示

### P2 - 中优先级（完善+清理）

- [ ] **T7**: 清理 `cast-marketplace.ts` 死代码
  - 删除 L94 `private registryUrl = 'https://marketplace.codecast.dev/api';`
  - 删除所有未使用的远程 marketplace 相关方法占位符
  - 添加注释说明: "CodeCast Marketplace is fully local, no remote registry"

- [ ] **T8**: Settings 新增「隐私与安全」设置分组
  - 修改 `store/useCastSettingsStore.ts` 添加 privacy 分组
  - 修改 `components/cast/CastSettings.tsx` 添加左侧导航项
  - 设置项:
    - 出站控制模式 (允许全部 / 逐次确认 / 全部禁止)
    - 审计日志保留天数 (7/30/90天)
    - 敏感数据自动脱敏 (开/关)
    - LLM调用数据最小化 (开/关)
    - 清除审计日志按钮
    - 导出隐私报告按钮

- [ ] **T9**: 创建 `utils/cast/cast-security-manifest.ts` — 安全声明常量
  - `CAST_SECURITY_MANIFEST` 对象导出:
    ```typescript
    export const CAST_SECURITY_MANIFEST = {
      version: '1.0.0',
      principle: 'LOCAL_FIRST',
      dataResidence: 'DEVICE_ONLY',
      cloudSync: false,
      telemetry: false,
      thirdPartyAnalytics: false,
      outboundPoints: ['llm_api', 'webhook', 'browser'],
      encryption: 'AES_256_GCM',
      storage: 'LOCAL_STORAGE',
      lastAudited: '2026-05-27',
      guarantees: [
        '所有用户数据存储在用户本地设备',
        '不向任何云服务器同步用户数据',
        '不内置遥测或分析SDK',
        'LLM调用仅限用户自配的API Key',
        '插件市场完全离线运行',
        'API Key使用AES-256-GCM加密存储'
      ]
    } as const;
    ```

### P3 - 锦上添花

- [ ] **T10**: 在 CastModeWorkspace 主界面添加安全状态指示器
  - Header 区域添加小盾牌图标 🛡️
  - 绿色=安全 / 黄色=有出站待确认 / 红色=有异常
  - 点击展开 SecurityDashboard 抽屉

- [ ] **T11**: 添加 `styles/cast-security.css` — 安全相关样式
  - `.cast-security-*` 前缀样式族
  - 审计日志时间线样式
  - 数据流向图可视化样式
  - 脱敏文本样式 (.masked-text)

- [ ] **T12**: 为 Sandbox 补充网络拦截测试用例
  - 验证 fetch 被正确禁止
  - 验证 XMLHttpRequest 被正确禁止
  - 验证 WebSocket 被正确禁止
  - 验证 import() 动态导入被正确禁止

---

## 三、文件变更清单

### 新建文件（8个）

| 文件路径 | 说明 | 行数估计 |
|---------|------|---------|
| `src/types/cast-privacy.ts` | 隐私类型定义 | ~80行 |
| `src/utils/cast/cast-privacy-manager.ts` | 隐私管理器核心 | ~350行 |
| `src/utils/cast/cast-security-manifest.ts` | 安全声明常量 | ~40行 |
| `src/store/useCastPrivacyStore.ts` | 隐私状态管理 | ~200行 |
| `src/components/cast/SecurityDashboard.tsx` | 安全仪表盘组件 | ~450行 |
| `src/components/cast/OutboundConfirmDialog.tsx` | 出站确认对话框 | ~180行 |
| `src/styles/cast-security.css` | 安全样式 | ~300行 |

### 修改文件（6个）

| 文件路径 | 改动说明 |
|---------|---------|
| `src/utils/cast/cast-channels-engine.ts` | sendWebhook() 添加确认回调 |
| `src/utils/cast/cast-browser-engine.ts` | navigate() 添加域名检查 |
| `src/utils/cast/cast-marketplace.ts` | 删除registryUrl死代码 |
| `src/store/useCastSettingsStore.ts` | 添加privacy设置分组 |
| `src/components/cast/CastSettings.tsx` | 添加隐私与安全Tab |
| `src/components/cast/CastModeWorkspace.tsx` | 集成安全指示器 |

---

## 四、执行顺序建议

```
第一步: T2 (类型) → T9 (安全声明) → T7 (清理死代码)
       ↓
第二步: T1 (PrivacyManager核心) → T3 (PrivacyStore)
       ↓
第三步: T4 (SecurityDashboard) → T5 (Webhook确认) → T6 (Browser警告)
       ↓
第四步: T8 (Settings分组) → T10 (主界面指示器) → T11 (CSS)
       ↓
第五步: tsc 编译验证 → 手动测试
```

---

## 五、验收标准

- [ ] 所有外部网络调用都有审计记录
- [ ] Webhook/Browser 出站前有用户确认（可配置跳过）
- [ ] 无任何死代码引用远程服务器URL
- [ ] 设置页面可见「隐私与安全」完整配置项
- [ ] SecurityDashboard 可查看实时安全状态
- [ ] CAST_SECURITY_MANIFEST 可导出供第三方审查
- [ ] TypeScript 编译 0 错误
- [ ] 所有 localStorage key 以 `codecast_cast_` 或 `cast_` 前缀统一管理
