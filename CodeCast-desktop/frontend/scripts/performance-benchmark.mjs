#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class PerformanceBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      metrics: {},
      thresholds: {
        firstContentfulPaint: 1500,
        largestContentfulPaint: 2500,
        timeToInteractive: 3000,
        totalBlockingTime: 200,
        cumulativeLayoutShift: 0.1,
        firstInputDelay: 100,
        memoryUsage: 200,
        fps: 30,
        bundleSize: 500
      },
      status: 'unknown',
      score: 0
    };
  }

  async run() {
    console.log('🚀 CodeCast 性能基准测试\n');

    const browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage();
    
    await this.collectCoreWebVitals(page);
    await this.collectRuntimeMetrics(page);
    await this.collectBundleMetrics(page);

    await browser.close();

    this.calculateScore();
    this.generateReport();
    this.saveResults();
  }

  async collectCoreWebVitals(page) {
    console.log('📊 采集 Core Web Vitals...');

    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const data = {};

        if ('PerformanceObserver' in window) {
          const fcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntriesByName('first-contentful-paint');
            if (entries.length > 0) {
              data.firstContentfulPaint = entries[0].startTime;
            }
          });
          fcpObserver.observe({ type: 'paint', buffered: true });

          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              data.largestContentfulPaint = entries[entries.length - 1].startTime;
            }
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

          const clsObserver = new PerformanceObserver((list) => {
            let clsValue = 0;
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            data.cumulativeLayoutShift = clsValue;
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        }

        setTimeout(() => resolve(data), 3000);
      });
    });

    this.results.metrics = { ...this.results.metrics, ...metrics };
    console.log(`   ✅ FCP: ${this.results.metrics.firstContentfulPaint || 'N/A'}ms`);
    console.log(`   ✅ LCP: ${this.results.metrics.largestContentfulPaint || 'N/A'}ms`);
    console.log(`   ✅ CLS: ${this.results.metrics.cumulativeLayoutShift || 'N/A'}`);
  }

  async collectRuntimeMetrics(page) {
    console.log('\n⚡ 采集运行时性能指标...');

    const runtimeMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frameCount = 0;
        let lastTime = performance.now();
        let fpsValues = [];

        const measureFPS = () => {
          frameCount++;
          const now = performance.now();
          
          if (now - lastTime >= 1000) {
            fpsValues.push(frameCount);
            frameCount = 0;
            lastTime = now;
            
            if (fpsValues.length >= 5) {
              const avgFPS = Math.round(
                fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length
              );
              
              resolve({
                averageFPS: avgFPS,
                minFPS: Math.min(...fpsValues),
                maxFPS: Math.max(...fpsValues),
                memoryUsage: performance.memory ? 
                  Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 : 
                  null,
                jsHeapSizeLimit: performance.memory ?
                  Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) :
                  null
              });
              return;
            }
          }
          
          requestAnimationFrame(measureFPS);
        };

        requestAnimationFrame(measureFPS);
        
        setTimeout(() => {
          resolve({
            averageFPS: fpsValues.length > 0 ? 
              Math.round(fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length) : 
              null,
            minFPS: fpsValues.length > 0 ? Math.min(...fpsValues) : null,
            maxFPS: fpsValues.length > 0 ? Math.max(...fpsValues) : null,
            memoryUsage: performance.memory ?
              Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100 :
              null,
            jsHeapSizeLimit: performance.memory ?
              Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) :
              null
          });
        }, 6000);
      });
    });

    this.results.metrics = { ...this.results.metrics, ...runtimeMetrics };
    console.log(`   ✅ 平均 FPS: ${this.results.metrics.averageFPS || 'N/A'}`);
    console.log(`   ✅ 内存使用: ${this.results.metrics.memoryUsage || 'N/A'}MB`);
  }

  async collectBundleMetrics(page) {
    console.log('\n📦 采集 Bundle 大小指标...');

    const bundleMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource')
        .filter(r => r.name.includes('.js') || r.name.includes('.css'));
      
      const totalSize = resources.reduce((sum, r) => sum + r.transferSize, 0);
      const jsSize = resources
        .filter(r => r.name.includes('.js'))
        .reduce((sum, r) => sum + r.transferSize, 0);
      const cssSize = resources
        .filter(r => r.name.includes('.css'))
        .reduce((sum, r) => sum + r.transferSize, 0);

      return {
        totalBundleSize: Math.round(totalSize / 1024),
        jsBundleSize: Math.round(jsSize / 1024),
        cssBundleSize: Math.round(cssSize / 1024),
        resourceCount: resources.length
      };
    });

    this.results.metrics = { ...this.results.metrics, ...bundleMetrics };
    console.log(`   ✅ 总 Bundle 大小: ${this.results.metrics.totalBundleSize}KB`);
    console.log(`   ✅ JS Bundle: ${this.results.metrics.jsBundleSize}KB`);
    console.log(`   ✅ CSS Bundle: ${this.results.metrics.cssBundleSize}KB`);
  }

  calculateScore() {
    console.log('\n🎯 计算性能评分...');

    let score = 100;
    const deductions = [];
    const t = this.results.thresholds;
    const m = this.results.metrics;

    if (m.firstContentfulPaint && m.firstContentfulPaint > t.firstContentfulPaint) {
      const deduction = Math.min(20, (m.firstContentfulPaint - t.firstContentfulPaint) / 50);
      score -= deduction;
      deductions.push(`FCP 超标: -${deduction.toFixed(1)}分`);
    }

    if (m.largestContentfulPaint && m.largestContentfulPaint > t.largestContentfulPaint) {
      const deduction = Math.min(25, (m.largestContentfulPaint - t.largestContentfulPaint) / 40);
      score -= deduction;
      deductions.push(`LCP 超标: -${deduction.toFixed(1)}分`);
    }

    if (m.cumulativeLayoutShift && m.cumulativeLayoutShift > t.cumulativeLayoutShift) {
      const deduction = Math.min(15, (m.cumulativeLayoutShift - t.cumulativeLayoutShift) * 100);
      score -= deduction;
      deductions.push(`CLS 超标: -${deduction.toFixed(1)}分`);
    }

    if (m.averageFPS && m.averageFPS < t.fps) {
      const deduction = Math.min(20, (t.fps - m.averageFPS) / 2);
      score -= deduction;
      deductions.push(`FPS 过低: -${deduction.toFixed(1)}分`);
    }

    if (m.memoryUsage && m.memoryUsage > t.memoryUsage) {
      const deduction = Math.min(15, (m.memoryUsage - t.memoryUsage) / 10);
      score -= deduction;
      deductions.push(`内存过高: -${deduction.toFixed(1)}分`);
    }

    if (m.totalBundleSize && m.totalBundleSize > t.bundleSize) {
      const deduction = Math.min(10, (m.totalBundleSize - t.bundleSize) / 20);
      score -= deduction;
      deductions.push(`Bundle 过大: -${deduction.toFixed(1)}分`);
    }

    this.results.score = Math.max(0, Math.round(score));
    this.results.deductions = deductions;

    if (score >= 90) {
      this.results.status = 'excellent';
    } else if (score >= 70) {
      this.results.status = 'good';
    } else if (score >= 50) {
      this.results.status = 'needs-improvement';
    } else {
      this.results.status = 'poor';
    }

    console.log(`   🏆 最终得分: ${this.results.score}/100 (${this.results.status})`);
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CodeCast 性能基准测试报告');
    console.log('='.repeat(60));
    console.log(`\n⏰ 测试时间: ${this.results.timestamp}`);
    console.log(`🌐 环境: ${this.results.environment}\n`);

    console.log('┌─────────────────────┬──────────────┬────────────┐');
    console.log('│ 指标                 │ 实际值       │ 阈值       │');
    console.log('├─────────────────────┼──────────────┼────────────┤');

    const metrics = [
      ['First Contentful Paint', `${this.results.metrics.firstContentfulPaint || 'N/A'}ms`, `${this.results.thresholds.firstContentfulPaint}ms`],
      ['Largest Contentful Paint', `${this.results.metrics.largestContentfulPaint || 'N/A'}ms`, `${this.results.thresholds.largestContentfulPaint}ms`],
      ['Cumulative Layout Shift', `${this.results.metrics.cumulativeLayoutShift || 'N/A'}`, `${this.results.thresholds.cumulativeLayoutShift}`],
      ['Average FPS', `${this.results.metrics.averageFPS || 'N/A'}`, `≥${this.results.thresholds.fps}`],
      ['Memory Usage', `${this.results.metrics.memoryUsage || 'N/A'}MB`, `≤${this.results.thresholds.memoryUsage}MB`],
      ['Total Bundle Size', `${this.results.metrics.totalBundleSize || 'N/A'}KB`, `≤${this.results.thresholds.bundleSize}KB`],
    ];

    metrics.forEach(([metric, value, threshold]) => {
      console.log(`│ ${metric.padEnd(19)} │ ${value.padEnd(12)} │ ${threshold.padEnd(10)} │`);
    });

    console.log('└─────────────────────┴──────────────┴────────────┘');

    console.log(`\n🎯 总体得分: ${this.results.score}/100 [${this.results.getStatusLabel()}]`);

    if (this.results.deductions?.length > 0) {
      console.log('\n⚠️  扣分项:');
      this.results.deductions.forEach(d => console.log(`   • ${d}`));
    }

    console.log('\n💡 建议:');
    this.printRecommendations();

    console.log('\n' + '='.repeat(60) + '\n');
  }

  getStatusLabel() {
    const labels = {
      'excellent': '优秀 ✨',
      'good': '良好 👍',
      'needs-improvement': '需改进 ⚠️',
      'poor': '较差 ❌'
    };
    return labels[this.results.status] || this.results.status;
  }

  printRecommendations() {
    const m = this.results.metrics;
    const t = this.results.thresholds;

    if (m.firstContentfulPaint && m.firstContentfulPaint > t.firstContentfulPaint) {
      console.log('   • 优化关键渲染路径，减少阻塞资源');
    }
    if (m.largestContentfulPaint && m.largestContentfulPaint > t.largestContentfulPaint) {
      console.log('   • 延迟加载非关键资源，优化图片大小');
    }
    if (m.cumulativeLayoutShift && m.cumulativeLayoutShift > t.cumulativeLayoutShift) {
      console.log('   • 为动态内容设置尺寸属性，避免布局偏移');
    }
    if (m.averageFPS && m.averageFPS < t.fps) {
      console.log('   • 使用虚拟滚动，减少 DOM 节点数量');
    }
    if (m.memoryUsage && m.memoryUsage > t.memoryUsage) {
      console.log('   • 清理不必要的缓存，优化数据结构');
    }
    if (m.totalBundleSize && m.totalBundleSize > t.bundleSize) {
      console.log('   • 启用 Tree Shaking，按需加载模块');
    }
  }

  saveResults() {
    const resultsDir = path.join(__dirname, '..', 'performance-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    fs.writeFileSync(
      path.join(resultsDir, `benchmark-${timestamp}.json`),
      JSON.stringify(this.results, null, 2)
    );

    console.log(`✅ 结果已保存到: performance-results/benchmark-${timestamp}.json`);

    this.updateHistory();
  }

  updateHistory() {
    const historyFile = path.join(__dirname, '..', 'performance-results', 'history.json');
    let history = [];

    if (fs.existsSync(historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      } catch (e) {
        console.warn('读取历史记录失败:', e.message);
      }
    }

    history.push({
      date: this.results.timestamp,
      score: this.results.score,
      status: this.results.status,
      metrics: this.results.metrics
    });

    history = history.slice(-20);

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    console.log('✅ 已更新性能历史记录');
  }
}

const benchmark = new PerformanceBenchmark();
benchmark.run().catch(console.error);
