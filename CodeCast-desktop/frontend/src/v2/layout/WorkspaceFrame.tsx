import { useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
  top: ReactNode;
  sidebar: ReactNode;
  chat: ReactNode;
  rightPanel?: ReactNode;
  bottom: ReactNode;
  drawer?: ReactNode;
  drawerOpen?: boolean;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

/**
 * Claude Code 风格布局（支持拖拽调整列宽）：
 *   - 顶栏
 *   - 左侧 Sidebar（可拖拽调整宽度）
 *   - 中间 Chat 区域（剩余空间）
 *   - 右侧浮动面板（可选，叠加在 Chat 上方）
 *   - 底栏
 *
 * 拖拽分栏线可调整 Sidebar 宽度，实现三段式左右拉动
 */
export function WorkspaceFrame({ top, sidebar, chat, rightPanel, bottom, drawer, drawerOpen, sidebarOpen = true, onToggleSidebar }: Props) {
  const COLLAPSED_WIDTH = 48;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    // 从 localStorage 恢复或使用 CSS 变量默认值
    try {
      const saved = localStorage.getItem('codecast-sidebar-width');
      if (saved) return Math.max(160, Math.min(500, Number(saved)));
    } catch { /* ignore */ }
    // 读取 CSS 变量 --sidebar-w 的默认值
    const root = document.documentElement;
    const computed = getComputedStyle(root).getPropertyValue('--sidebar-w').trim();
    if (computed) {
      const num = parseInt(computed.replace('px', ''), 10);
      if (!isNaN(num)) return num;
    }
    return 240; // 默认值
  });

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(sidebarWidth);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(160, Math.min(500, startWidth.current + delta));
      setSidebarWidth(newWidth);
      // 同步更新 CSS 变量，让子组件能响应宽度变化
      document.documentElement.style.setProperty('--sidebar-w', `${newWidth}px`);
    };

    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // 持久化到 localStorage
      try {
        localStorage.setItem('codecast-sidebar-width', String(sidebarWidth));
      } catch { /* ignore */ }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'var(--topbar-h) 1fr var(--bottombar-h)',
        gridTemplateColumns: `${sidebarOpen ? sidebarWidth : COLLAPSED_WIDTH}px 5px 1fr`,
        gridTemplateAreas: '"top top top" "side divider chat" "bot bot bot"',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--c-bg)',
      }}
    >
      {/* 顶栏 */}
      <div
        role="banner"
        style={{
          gridArea: 'top',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-bg)',
          zIndex: 10,
        }}
      >
        {top}
      </div>

      {/* 侧边栏 */}
      <div
        role="navigation"
        aria-label="主导航"
        style={{
          gridArea: 'side',
          borderRight: 'none',
          overflow: 'hidden',
          background: 'var(--c-bg)',
          transition: 'opacity var(--dur-fast) var(--ease)',
          opacity: sidebarOpen ? 1 : 0.6,
        }}
      >
        {sidebarOpen ? sidebar : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4 }}>
            <button
              onClick={onToggleSidebar}
              aria-label="展开侧边栏"
              title="展开侧边栏 (Ctrl+B)"
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--r-md)',
                color: 'var(--c-textMute)',
                cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 可拖拽分栏线 */}
      <div
        style={{
          gridArea: 'divider',
          width: 5,
          cursor: 'col-resize',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
          transition: dragging.current ? 'none' : 'background 0.15s ease',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          if (!dragging.current) {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--c-borderStrong, #ccc)';
          }
        }}
        onMouseLeave={(e) => {
          if (!dragging.current) {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }
        }}
      >
        {/* 分栏线视觉指示器 */}
        <div
          style={{
            width: 1,
            height: 32,
            borderRadius: 1,
            background: dragging.current ? 'var(--c-accent, #1677ff)' : 'var(--c-border, #e0e0e0)',
            transition: dragging.current ? 'none' : 'background 0.15s ease',
            opacity: dragging.current ? 1 : 0.6,
          }}
        />
      </div>

      {/* 主内容区 */}
      <div
        role="main"
        aria-label="主内容"
        style={{
          gridArea: 'chat',
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--c-bg)',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          {chat}
          {rightPanel}
        </div>
        {drawerOpen && drawer && (
          <>
            <div
              style={{
                height: 1,
                background: 'var(--c-border)',
                flexShrink: 0,
              }}
            />
            <div
              style={{
                height: 200,
                overflow: 'auto',
                flexShrink: 0,
                borderTop: '1px solid var(--c-border)',
                background: 'var(--c-surface)',
              }}
            >
              {drawer}
            </div>
          </>
        )}
      </div>

      {/* 底栏 */}
      <div
        role="contentinfo"
        style={{
          gridArea: 'bot',
          borderTop: '1px solid var(--c-border)',
          background: 'var(--c-bg)',
        }}
      >
        {bottom}
      </div>
    </div>
  );
}
