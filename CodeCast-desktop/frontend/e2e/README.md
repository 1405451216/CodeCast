# E2E 测试指南

## 快速开始

```bash
# 安装依赖（首次）
npm install

# 安装浏览器（首次）
npx playwright install chromium

# 运行所有 E2E 测试
npm run test:e2e

# 使用 UI 模式运行（推荐调试时使用）
npm run test:e2e:ui

# 调试模式
npm run test:e2e:debug
```

## 测试覆盖范围

### 1. 应用基础测试 (`app-basic.spec.ts`)
- ✅ 应用启动与 UI 渲染
- ✅ 页面标题验证
- ✅ 导航元素可见性
- ✅ Tab 切换功能
- ✅ 响应式设计（平板/移动端）
- ✅ 性能指标（加载时间、控制台错误）
- ✅ 可访问性检查

### 2. 交互流程测试 (`interactions.spec.ts`)
- ✅ 性能仪表板功能
- ✅ 插件管理器功能
- ✅ 标签切换循环
- ✅ 快速连续点击稳定性

### 3. 视觉回归测试 (`visual-regression.spec.ts`)
- ✅ 初始页面快照
- ✅ 激活状态快照
- ✅ 布局稳定性检测
- ✅ Footer 定位验证

## CI 集成

E2E 测试已集成到 CI 流程：
```bash
npm run ci  # 包含单元测试 + E2E 测试
```

## 测试报告

测试完成后生成以下报告：
- **HTML 报告**: `e2e-results/index.html`
- **JSON 结果**: `e2e-results/results.json`
- **截图/视频**: 仅在失败时保留

## 最佳实践

1. **运行单个测试文件**:
   ```bash
   npx playwright test e2e/app-basic.spec.ts
   ```

2. **运行特定测试用例**:
   ```bash
   npx playwright test -g "应用应该正确加载"
   ```

3. **更新视觉快照**:
   ```bash
   npx playwright test --update-snapshots
   ```

4. **查看详细报告**:
   ```bash
   npx playwright show-report
   ```
