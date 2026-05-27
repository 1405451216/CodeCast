import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { performanceMonitor, cacheManager, type Bottleneck } from '../utils/performance';

interface PerformanceDashboardProps {
  className?: string;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ className = '' }) => {
  const [metrics, setMetrics] = useState(performanceMonitor.getCurrentMetrics());
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [cacheStats, setCacheStats] = useState(cacheManager.getStats());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const performanceMode = useAppStore((state) => state.performanceMode);
  const setPerformanceMode = useAppStore((state) => state.setPerformanceMode);
  
  const virtualScrollEnabled = useAppStore((state) => state.virtualScrollEnabled);
  const toggleVirtualScroll = useAppStore((state) => state.toggleVirtualScroll);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      const currentMetrics = performanceMonitor.getCurrentMetrics();
      setMetrics(currentMetrics);
      
      if (performanceMode === 'performance') {
        setBottlenecks([]);
      } else {
        setBottlenecks(performanceMonitor.detectBottlenecks());
      }
      
      setCacheStats(cacheManager.getStats());

      useAppStore.getState().addPerformanceSnapshot({
        timestamp: Date.now(),
        fps: currentMetrics.fps,
        memoryUsage: currentMetrics.memoryUsage,
        renderTime: currentMetrics.renderTime
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, performanceMode]);

  const handleClearCache = async () => {
    await cacheManager.clear();
    setCacheStats(cacheManager.getStats());
  };

  const handleCleanupCache = async () => {
    const cleaned = await cacheManager.cleanup();
    alert(`已清理 ${cleaned} 条过期数据`);
    setCacheStats(cacheManager.getStats());
  };

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#22c55e';
    if (fps >= 30) return '#eab308';
    return '#ef4444';
  };

  const getMemoryColor = (mb: number) => {
    if (mb < 200) return '#22c55e';
    if (mb < 400) return '#eab308';
    return '#ef4444';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#eab308';
      case 'low': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div className={`performance-dashboard ${className}`}>
      <style>{`
        .performance-dashboard {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          max-width: 900px;
          margin: 0 auto;
        }

        .perf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .perf-title {
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .perf-controls {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .toggle-switch {
          position: relative;
          width: 44px;
          height: 24px;
          background: #d1d5db;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .toggle-switch.active {
          background: #3b82f6;
        }

        .toggle-switch::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
        }

        .toggle-switch.active::after {
          transform: translateX(20px);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .metric-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          transition: all 0.2s;
        }

        .metric-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .metric-label {
          font-size: 13px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .metric-value {
          font-size: 32px;
          font-weight: 700;
          line-height: 1;
        }

        .metric-unit {
          font-size: 14px;
          color: #9ca3af;
          margin-left: 4px;
        }

        .section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .bottleneck-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: #fef2f2;
          border-left: 3px solid;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .bottleneck-severity {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
        }

        .bottleneck-text {
          flex: 1;
          font-size: 14px;
          color: #374151;
        }

        .mode-selector {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .mode-option {
          flex: 1;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }

        .mode-option:hover {
          border-color: #d1d5db;
        }

        .mode-option.active {
          border-color: #3b82f6;
          background: #eff6ff;
        }

        .mode-icon {
          font-size: 24px;
          margin-bottom: 4px;
        }

        .mode-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .cache-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-danger {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .btn-danger:hover {
          background: #fee2e2;
        }

        .empty-state {
          text-align: center;
          padding: 32px;
          color: #9ca3af;
        }
      `}</style>

      <div className="perf-header">
        <h2 className="perf-title">
          ⚡ 性能监控中心
        </h2>
        <div className="perf-controls">
          <span style={{ fontSize: '14px', color: '#6b7280' }}>自动刷新</span>
          <div
            className={`toggle-switch ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            role="switch"
            aria-checked={autoRefresh}
            tabIndex={0}
          />
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">帧率 (FPS)</div>
          <div className="metric-value" style={{ color: getFpsColor(metrics.fps) }}>
            {metrics.fps}
            <span className="metric-unit">fps</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">内存占用</div>
          <div className="metric-value" style={{ color: getMemoryColor(metrics.memoryUsage) }}>
            {metrics.memoryUsage.toFixed(1)}
            <span className="metric-unit">MB</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">渲染时间</div>
          <div className="metric-value" style={{ color: metrics.renderTime > 50 ? '#ef4444' : '#22c55e' }}>
            {metrics.renderTime.toFixed(1)}
            <span className="metric-unit">ms</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">组件数量</div>
          <div className="metric-value" style={{ color: '#3b82f6' }}>
            {metrics.componentCount}
            <span className="metric-unit">个</span>
          </div>
        </div>
      </div>

      {bottlenecks.length > 0 && (
        <div className="section">
          <h3 className="section-title">⚠️ 检测到的性能瓶颈</h3>
          {bottlenecks.map((bottleneck, index) => (
            <div
              key={index}
              className="bottleneck-item"
              style={{ borderColor: getSeverityColor(bottleneck.severity) }}
            >
              <span
                className="bottleneck-severity"
                style={{ background: getSeverityColor(bottleneck.severity) }}
              >
                {bottleneck.severity}
              </span>
              <div className="bottleneck-text">{bottleneck.suggestion}</div>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <h3 className="section-title">⚙️ 性能模式</h3>
        <div className="mode-selector">
          <div
            className={`mode-option ${performanceMode === 'balanced' ? 'active' : ''}`}
            onClick={() => setPerformanceMode('balanced')}
            role="radio"
            aria-checked={performanceMode === 'balanced'}
            tabIndex={0}
          >
            <div className="mode-icon">⚖️</div>
            <div className="mode-label">均衡模式</div>
          </div>
          <div
            className={`mode-option ${performanceMode === 'performance' ? 'active' : ''}`}
            onClick={() => setPerformanceMode('performance')}
            role="radio"
            aria-checked={performanceMode === 'performance'}
            tabIndex={0}
          >
            <div className="mode-icon">🚀</div>
            <div className="mode-label">高性能</div>
          </div>
          <div
            className={`mode-option ${performanceMode === 'battery-saver' ? 'active' : ''}`}
            onClick={() => setPerformanceMode('battery-saver')}
            role="radio"
            aria-checked={performanceMode === 'battery-saver'}
            tabIndex={0}
          >
            <div className="mode-icon">🔋</div>
            <div className="mode-label">省电模式</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
          <span style={{ fontSize: '14px', color: '#374151' }}>启用虚拟滚动</span>
          <div
            className={`toggle-switch ${virtualScrollEnabled ? 'active' : ''}`}
            onClick={() => {
              const newValue = !virtualScrollEnabled;
              toggleVirtualScroll();
            }}
            role="switch"
            aria-checked={virtualScrollEnabled}
            tabIndex={0}
          />
        </div>
      </div>

      <div className="section">
        <h3 className="section-title">💾 缓存管理</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div className="metric-label">内存缓存大小</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1f2937' }}>
              {cacheStats.memorySize} MB
            </div>
          </div>
          <div>
            <div className="metric-label">缓存项目数</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1f2937' }}>
              {cacheStats.memoryItemCount} 项
            </div>
          </div>
          <div>
            <div className="metric-label">命中率</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: cacheStats.hitRate > 80 ? '#22c55e' : '#eab308' }}>
              {cacheStats.hitRate}%
            </div>
          </div>
        </div>

        <div className="cache-actions">
          <button className="btn btn-secondary" onClick={handleCleanupCache}>
            清理过期数据
          </button>
          <button className="btn btn-danger" onClick={handleClearCache}>
            清空所有缓存
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
