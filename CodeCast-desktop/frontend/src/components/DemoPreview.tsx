import React, { useState } from 'react';
import PerformanceDashboard from './PerformanceDashboard';
import PluginManagerPanel from './PluginManagerPanel';

type DemoTab = 'performance' | 'plugins';

const DemoPreview: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DemoTab>('performance');

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #7c7cff, #a78bfa)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              boxShadow: '0 4px 20px rgba(124, 124, 255, 0.3)',
            }}
          >
            CC
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #7c7cff, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              CodeCast 第三阶段功能演示
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              性能优化系统 + 插件生态系统 | P3-4 全局集成预览
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(124, 124, 255, 0.15)',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#a78bfa',
            border: '1px solid rgba(124, 124, 255, 0.3)',
          }}
        >
          🚀 演示模式 | 浏览器预览
        </div>
      </header>

      {/* Tab Navigation */}
      <nav
        style={{
          padding: '20px 40px',
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <button
          onClick={() => setActiveTab('performance')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'performance'
              ? 'linear-gradient(135deg, #7c7cff, #6366f1)'
              : 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            border: activeTab === 'performance'
              ? 'none'
              : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: activeTab === 'performance'
              ? '0 4px 20px rgba(99, 102, 241, 0.4)'
              : 'none',
            transform: activeTab === 'performance' ? 'translateY(-2px)' : 'translateY(0)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseOver={(e) => {
            if (activeTab !== 'performance') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(124, 124, 255, 0.5)';
            }
          }}
          onMouseOut={(e) => {
            if (activeTab !== 'performance') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          ⚡ 性能优化中心
        </button>

        <button
          onClick={() => setActiveTab('plugins')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'plugins'
              ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
              : 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            border: activeTab === 'plugins'
              ? 'none'
              : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: activeTab === 'plugins'
              ? '0 4px 20px rgba(245, 158, 11, 0.4)'
              : 'none',
            transform: activeTab === 'plugins' ? 'translateY(-2px)' : 'translateY(0)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseOver={(e) => {
            if (activeTab !== 'plugins') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
            }
          }}
          onMouseOut={(e) => {
            if (activeTab !== 'plugins') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          🔌 插件管理器
        </button>
      </nav>

      {/* Content Area */}
      <main style={{ padding: '30px 40px' }}>
        {activeTab === 'performance' && (
          <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div
              style={{
                marginBottom: '24px',
                padding: '16px 20px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '12px',
                borderLeft: '4px solid #6366f1',
                fontSize: '14px',
                lineHeight: 1.6,
              }}
            >
              <strong>💡 功能说明：</strong>
              此面板展示实时性能监控数据（FPS、内存、渲染时间），支持性能模式切换和缓存管理。
              所有指标每 2 秒自动刷新。
            </div>
            <PerformanceDashboard />
          </div>
        )}

        {activeTab === 'plugins' && (
          <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div
              style={{
                marginBottom: '24px',
                padding: '16px 20px',
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '12px',
                borderLeft: '4px solid #f59e0b',
                fontSize: '14px',
                lineHeight: 1.6,
              }}
            >
              <strong>🎯 使用提示：</strong>
              插件管理器支持安装、启用、停用和卸载插件。
              点击任意插件卡片可查看详细信息（权限、描述、链接等）。
              右侧事件日志实时记录所有操作。
            </div>
            <PluginManagerPanel />
          </div>
        )}
      </main>

      {/* Footer Stats */}
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          color: 'rgba(255, 255, 255, 0.6)',
        }}
      >
        <span>📦 CodeCast v3.0 | React + TypeScript + Vite</span>
        <span>
          ✅ 构建成功 | ⚡ HMR 已启用 | 🕐{' '}
          {new Date().toLocaleTimeString()}
        </span>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(124, 124, 255, 0.3);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(124, 124, 255, 0.5);
        }
      `}</style>
    </div>
  );
};

export default DemoPreview;