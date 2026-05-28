# 性能基准测试系统

## 概述

CodeCast 的性能基准测试系统用于量化应用性能指标，确保每次发布都符合生产级标准。

## 快速开始

```bash
# 运行完整性能基准测试
npm run test:performance

# 运行基准测试并生成详细报告
node scripts/performance-benchmark.mjs

# 查看历史趋势
cat performance-results/history.json | jq '.[] | {date, score}'
```

## 核心指标

### 1. Core Web Vitals（核心网页指标）

| 指标 | 描述 | 目标值 | 权重 |
|------|------|--------|------|
| **FCP** (First Contentful Paint) | 首次内容绘制时间 | ≤ 1.5s | 20% |
| **LCP** (Largest Contentful Paint) | 最大内容绘制时间 | ≤ 2.5s | 25% |
| **CLS** (Cumulative Layout Shift) | 累积布局偏移 | ≤ 0.1 | 15% |

### 2. 运行时性能指标

| 指标 | 描述 | 目标值 | 权重 |
|------|------|--------|------|
| **Average FPS** | 平均帧率 | ≥ 30 FPS | 20% |
| **Memory Usage** | JavaScript 堆内存使用 | ≤ 200 MB | 15% |
| **Min/Max FPS** | 帧率波动范围 | 稳定 | - |

### 3. Bundle Size 指标

| 指标 | 描述 | 目标值 | 权重 |
|------|------|--------|------|
| **Total Bundle Size** | 总资源大小（JS+CSS） | ≤ 500 KB | 10% |
| **JS Bundle Size** | JavaScript 包大小 | ≤ 400 KB | - |
| **CSS Bundle Size** | CSS 样式包大小 | ≤ 100 KB | - |

## 评分标准

```
90-100 分: ✨ 优秀 (Excellent)
70-89 分:  👍 良好 (Good)
50-69 分:  ⚠️ 需改进 (Needs Improvement)
0-49 分:   ❌ 较差 (Poor)
```

## 测试流程

### 自动化测试（CI）

```yaml
# GitHub Actions 示例
- name: Run Performance Benchmark
  run: npm run test:performance
  
- name: Check Performance Score
  run: |
    SCORE=$(node -e "console.log(require('./performance-results/latest.json').score)")
    if [ $SCORE -lt 70 ]; then
      echo "❌ 性能不达标: $SCORE/100"
      exit 1
    fi
    echo "✅ 性能达标: $SCORE/100"
```

### 本地开发

```bash
# 1. 启动应用
npm run dev

# 2. 新开终端运行基准测试
npm run test:performance

# 3. 查看详细报告
# 报告会自动输出到控制台和文件
```

## 性能优化建议

### FCP 优化（> 1.5s）
- ✅ 减少关键路径上的阻塞资源
- ✅ 内联关键 CSS
- ✅ 使用预加载（preload）关键资源
- ✅ 启用服务端压缩（gzip/brotli）

### LCP 优化（> 2.5s）
- ✅ 优化首屏图片（使用 WebP/AVIF 格式）
- ✅ 实现图片懒加载
- ✅ 使用 CDN 加速静态资源
- ✅ 预连接到第三方域名

### CLS 优化（> 0.1）
- ✅ 为图片和视频设置明确的尺寸属性
- ✅ 动态插入的内容预留空间
- ✅ 避免在现有内容上方插入广告
- ✅ 使用 CSS transform 代替改变盒模型属性

### FPS 优化（< 30）
- ✅ 使用虚拟滚动处理长列表
- ✅ 减少 DOM 节点数量
- ✅ 避免强制同步布局（layout thrashing）
- ✅ 使用 will-change 和 GPU 加速

### 内存优化（> 200MB）
- ✅ 及时清理不再需要的事件监听器
- ✅ 使用对象池复用对象
- ✅ 避免内存泄漏（闭包、定时器等）
- ✅ 实现合理的缓存淘汰策略

### Bundle 优化（> 500KB）
- ✅ 启用 Tree Shaking（ES Modules）
- ✅ 代码分割（Code Splitting）
- ✅ 按需加载（Lazy Loading）
- ✅ 移除未使用的依赖

## 历史趋势分析

```bash
# 查看最近 10 次测试的分数趋势
node scripts/performance-trend.mjs --limit 10

# 导出为 CSV 格式用于可视化
node scripts/performance-export.mjs --format csv
```

## 性能预算（Performance Budget）

在 `package.json` 中配置：

```json
{
  "performance": {
    "budgets": [
      {
        "type": "fcp",
        "max": 1500,
        "warning": 1200
      },
      {
        "type": "lcp",
        "max": 2500,
        "warning": 2000
      },
      {
        "type": "bundle",
        "max": 500,
        "unit": "kb"
      },
      {
        "type": "memory",
        "max": 200,
        "unit": "mb"
      }
    ]
  }
}
```

## 与 CI/CD 集成

### 失败阈值

- **阻止发布**: 得分 < 70 或任何核心指标超过阈值 50%
- **警告**: 得分 < 85 或单项指标超标
- **通过**: 得分 ≥ 85 且所有指标在阈值内

### 性能回归检测

```bash
# 对比两次构建的性能差异
npm run test:performance-compare -- --base main --head feature-branch

# 如果性能下降超过 10%，CI 将失败
```

## 监控与告警

建议集成以下工具：
- **Lighthouse CI**: 自动化性能审计
- **Web Vitals Library**: 真实用户数据采集（RUM）
- **Sentry Performance**: 错误追踪 + 性能监控

## 参考资源

- [Web Vitals](https://web.dev/vitals/)
- [Performance Best Practices](https://web.dev/performance/)
- [React Performance](https://react.dev/reference/react/performance)
