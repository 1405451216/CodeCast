import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore, AppState } from './store';
import { useAppInit } from './hooks/useAppInit';
import { useSessionActions } from './hooks/useSessionActions';
import { useChatSender } from './hooks/useChatSender';
import { useCommandPalette } from './hooks/useKeyboardShortcuts';
import { useWebVitals } from './utils/WebVitalsMonitor';
import { debounce } from './utils';
import * as api from './api';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';

import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration';
import ThemeSwitcher from './components/ThemeSwitcher';
import CommandPalette from './components/CommandPalette';

const WelcomeView = lazy(() => import('./components/WelcomeView'));
const MessagesView = lazy(() => import('./components/MessagesView'));
const ChatInput = lazy(() => import('./components/ChatInput'));
const PluginsPanel = lazy(() => import('./components/PluginsPanel'));
const AutomationPanel = lazy(() => import('./components/AutomationPanel'));
const ProjectsPanel = lazy(() => import('./components/ProjectsPanel'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
const ToolPanel = lazy(() => import('./components/ToolPanel'));

/**
 * CodeCast 主应用 — Claude Code 桌面版风格
 *
 * 布局：
 * ┌──────────────────────────────────────────────────┐
 * │  TitleBar                                        │
 * ├──────────┬───────────────────────────────────────┤
 * │          │  TopBar                                │
 * │  Sidebar ├───────────────────────────────────────┤
 * │  (会话)   │  Chat Area (WelcomeView / MessagesView)│
 * │          ├───────────────────────────────────────┤
 * │          │  ChatInput                             │
 * │          ├───────────────────────────────────────┤
 * │          │  [overlay panels: Plugin/Auto/Project] │
 * └──────────┴───────────────────────────────────────┘
 *
 * 右侧面板（Preview/Files/Tools）以叠加层形式按需显示，
 * 不会挤占主聊天区宽度。
 */
const App: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuOpenRef = useRef(mobileMenuOpen);
  mobileMenuOpenRef.current = mobileMenuOpen;

  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();

  useWebVitals({
    showDashboard: import.meta.env.DEV,
    reportInterval: 30000
  });

  const sidebarVisible = useAppStore((s: AppState) => s.sidebarVisible);
  const view = useAppStore((s: AppState) => s.view);
  const currentSession = useAppStore((s: AppState) => s.currentSessionId);
  const sessions = useAppStore((s: AppState) => s.sessions);
  const isLoading = useAppStore((s: AppState) => s.isLoading);

  useAppInit();

  const { handleNewSession, handleSelectSession, handleDeleteSession, handleClearSession } =
    useSessionActions();

  const { handleSendMessage } = useChatSender();

  const handleStop = useCallback(async () => {
    try {
      await api.cancelRequest();
    } catch (e) {
      console.error('Cancel request failed:', e);
    }
    useAppStore.getState().setIsLoading(false);
  }, []);

  useEffect(() => {
    const handler = () => handleClearSession();
    window.addEventListener('clear-session', handler);
    return () => window.removeEventListener('clear-session', handler);
  }, [handleClearSession]);

  useEffect(() => {
    const handleResize = debounce(() => {
      if (window.innerWidth >= 640 && mobileMenuOpenRef.current) {
        setMobileMenuOpen(false);
      }
    }, 150);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      (handleResize as any).cancel?.();
    };
  }, []);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(180, Math.min(500, w + delta)));
  }, []);

  const isWailsEnvironment = typeof window !== 'undefined' && 'go' in window;

  if (!isWailsEnvironment) {
    return <div style={{padding: 40}}>CodeCast 必须在 Wails 桌面环境中运行</div>;
  }

  return (
    <ErrorBoundary>
      <ServiceWorkerRegistration />

      <a href="#main-content" className="skip-link">
        跳转到主要内容
      </a>

      <TitleBar 
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        mobileMenuOpen={mobileMenuOpen}
      />

      {sidebarVisible && (
        <div 
          className={`sidebar-overlay ${mobileMenuOpen ? 'visible' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden={!mobileMenuOpen}
        />
      )}

      <div className="app" role="application" aria-label="CodeCast 主界面">
        <Sidebar
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          style={sidebarVisible ? { width: sidebarWidth } : undefined}
          className={mobileMenuOpen ? 'mobile-open' : ''}
          onCloseMobile={() => setMobileMenuOpen(false)}
          isMobileMenuOpen={mobileMenuOpen}
        />
        
        <div className="main" id="main-content" tabIndex={-1}>
          <TopBar />
          <div className="chat-area" id="chatArea" role="main">
            <Suspense fallback={<LoadingFallback message="加载内容..." />}>
              {view === 'welcome' ? (
                <WelcomeView onSend={handleSendMessage} />
              ) : (
                <MessagesView isLoading={isLoading} />
              )}
            </Suspense>
          </div>

          {view === 'chat' && (
            <Suspense fallback={<LoadingFallback message="加载输入框..." />}>
              <ChatInput onSend={handleSendMessage} isLoading={isLoading} onStop={handleStop} />
            </Suspense>
          )}

          {/* Overlay panels — 按需叠加在 main 区域上 */}
          <Suspense fallback={null}>
            <PluginsPanel />
          </Suspense>
          <Suspense fallback={null}>
            <AutomationPanel />
          </Suspense>
          <Suspense fallback={null}>
            <ProjectsPanel />
          </Suspense>
          <Suspense fallback={null}>
            <ToolPanel />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <NotificationCenter />
      </Suspense>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        commands={[
          {
            id: 'new-chat',
            title: '新建对话',
            description: '创建一个新的AI对话',
            icon: '💬',
            shortcut: ['Ctrl', 'N'],
            category: 'actions',
            action: () => handleNewSession()
          },
          {
            id: 'toggle-sidebar',
            title: '切换侧边栏',
            description: '显示或隐藏侧边栏面板',
            icon: '📂',
            shortcut: ['Ctrl', 'B'],
            category: 'view',
            action: () => useAppStore.getState().toggleSidebar()
          },
          {
            id: 'focus-input',
            title: '聚焦输入框',
            description: '将光标移动到消息输入框',
            icon: '✏️',
            shortcut: ['/'],
            category: 'navigation',
            action: () => {
              const input = document.querySelector('#chatArea textarea, #chatArea [contenteditable="true"]') as HTMLElement;
              input?.focus();
            }
          },
          {
            id: 'clear-session',
            title: '清空当前对话',
            description: '清除当前会话的所有消息',
            icon: '🗑️',
            shortcut: ['Ctrl', 'Shift', 'D'],
            category: 'actions',
            action: () => handleClearSession()
          },
          {
            id: 'stop-generation',
            title: '停止生成',
            description: '停止当前AI回复生成',
            icon: '⏹️',
            shortcut: ['Escape'],
            category: 'ai',
            action: () => handleStop()
          },
          {
            id: 'open-settings',
            title: '打开设置',
            description: '打开应用设置页面',
            icon: '⚙️',
            shortcut: ['Ctrl', ','],
            category: 'settings',
            action: () => useAppStore.getState().toggleSettings()
          },
          {
            id: 'theme-toggle',
            title: '切换主题',
            description: '在深色/浅色模式间切换',
            icon: '🎨',
            shortcut: ['Ctrl', 'Shift', 'T'],
            category: 'settings',
            action: () => {
              const btn = document.querySelector('[data-testid="theme-toggle"], button[aria-label*="主题"], .theme-toggle-btn') as HTMLButtonElement;
              btn?.click();
            }
          }
        ]}
      />
    </ErrorBoundary>
  );
};

export default App;
