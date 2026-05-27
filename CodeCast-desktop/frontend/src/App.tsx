import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useAppStore, AppState } from './store';
import { useAppInit } from './hooks/useAppInit';
import { useSessionActions } from './hooks/useSessionActions';
import { useChatSender } from './hooks/useChatSender';
import { useCommandPalette } from './hooks/useKeyboardShortcuts';
import { WebVitalsDashboard, useWebVitals } from './utils/WebVitalsMonitor';
import { performanceMonitor, cacheManager } from './utils/performance';
import * as api from './api';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';
import DemoPreview from './components/DemoPreview';

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration';
import ThemeSwitcher from './components/ThemeSwitcher';
import CommandPalette from './components/CommandPalette';

const WelcomeView = lazy(() => import('./components/WelcomeView'));
const MessagesView = lazy(() => import('./components/MessagesView'));
const ChatInput = lazy(() => import('./components/ChatInput'));
const PreviewPanel = lazy(() => import('./components/PreviewPanel'));
const FilesPanel = lazy(() => import('./components/FilesPanel'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const PluginsPanel = lazy(() => import('./components/PluginsPanel'));
const AutomationPanel = lazy(() => import('./components/AutomationPanel'));
const ProjectsPanel = lazy(() => import('./components/ProjectsPanel'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
const PanelResizer = lazy(() => import('./components/PanelResizer'));
const CodeModeWorkspace = lazy(() => import('./components/CodeModeWorkspace'));

const App: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [previewWidth, setPreviewWidth] = useState(420);
  const [filesWidth, setFilesWidth] = useState(240);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette();

  useWebVitals({
    showDashboard: import.meta.env.DEV,
    reportInterval: 30000
  });

  useEffect(() => {
    performanceMonitor.startMonitoring();

    const reportInterval = setInterval(() => {
      const metrics = performanceMonitor.getCurrentMetrics();
      console.log(`[Perf] FPS: ${metrics.fps}, Memory: ${metrics.memoryUsage}MB, Render: ${metrics.renderTime}ms`);

      const bottlenecks = performanceMonitor.detectBottlenecks();
      if (bottlenecks.length > 0) {
        console.warn('[Perf] Bottlenecks detected:', bottlenecks);
      }
    }, import.meta.env.DEV ? 10000 : 60000);

    const cleanupInterval = setInterval(async () => {
      const cleaned = await cacheManager.cleanup();
      if (cleaned > 0) {
        console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
      }
    }, 5 * 60 * 1000);

    return () => {
      performanceMonitor.stopMonitoring();
      clearInterval(reportInterval);
      clearInterval(cleanupInterval);
    };
  }, []);

  const sidebarVisible = useAppStore((s: AppState) => s.sidebarVisible);
  const previewPanelVisible = useAppStore((s: AppState) => s.previewPanelVisible);
  const filesPanelVisible = useAppStore((s: AppState) => s.filesPanelVisible);
  const view = useAppStore((s: AppState) => s.view);
  const currentSession = useAppStore((s: AppState) => s.currentSessionId);
  const sessions = useAppStore((s: AppState) => s.sessions);
  const isLoading = useAppStore((s: AppState) => s.isLoading);

  const currentMode = sessions.find(s => s.ID === currentSession)?.Mode || '';

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
      if (window.innerWidth >= 640 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }, 150);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      (handleResize as any).cancel?.();
    };
  }, [mobileMenuOpen]);

  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(180, Math.min(500, w + delta)));
  }, []);

  const handlePreviewResize = useCallback((delta: number) => {
    setPreviewWidth((w) => Math.max(250, Math.min(800, w - delta)));
  }, []);

  const handleFilesResize = useCallback((delta: number) => {
    setFilesWidth((w) => Math.max(160, Math.min(500, w - delta)));
  }, []);

  const isWailsEnvironment = typeof window !== 'undefined' && 'go' in window;

  if (!isWailsEnvironment) {
    return <DemoPreview />;
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
        
        {sidebarVisible && !mobileMenuOpen && (
          <Suspense fallback={<LoadingFallback message="调整侧边栏..." />}>
            <PanelResizer onResize={handleSidebarResize} />
          </Suspense>
        )}
        
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
          
          {currentMode === 'coding' && view === 'chat' && (
            <Suspense fallback={<LoadingFallback message="加载 Code 工作台..." />}>
              <CodeModeWorkspace visible mode="coding" />
            </Suspense>
          )}
          
          <Suspense fallback={null}>
            <PluginsPanel />
          </Suspense>
          <Suspense fallback={null}>
            <AutomationPanel />
          </Suspense>
          <Suspense fallback={null}>
            <ProjectsPanel />
          </Suspense>
        </div>
        
        {(previewPanelVisible || true) && (
          <Suspense fallback={null}>
            <PanelResizer onResize={handlePreviewResize} />
          </Suspense>
        )}
        <Suspense fallback={<LoadingFallback message="加载预览..." />}>
          <PreviewPanel style={previewPanelVisible ? { width: previewWidth } : undefined} />
        </Suspense>
        
        {(filesPanelVisible || true) && (
          <Suspense fallback={null}>
            <PanelResizer onResize={handleFilesResize} />
          </Suspense>
        )}
        <Suspense fallback={<LoadingFallback message="加载文件..." />}>
          <FilesPanel style={filesPanelVisible ? { width: filesWidth } : undefined} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>
      <Suspense fallback={null}>
        <NotificationCenter />
      </Suspense>

      <WebVitalsDashboard />

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
            id: 'toggle-preview',
            title: '切换预览面板',
            description: '显示或隐藏预览面板',
            icon: '👁️',
            shortcut: ['Ctrl', 'P'],
            category: 'view',
            action: () => useAppStore.getState().togglePreviewPanel()
          },
          {
            id: 'toggle-files',
            title: '切换文件面板',
            description: '显示或隐藏文件管理面板',
            icon: '📁',
            shortcut: ['Ctrl', 'E'],
            category: 'view',
            action: () => useAppStore.getState().toggleFilesPanel()
          },
          {
            id: 'focus-input',
            title: '聚焦输入框',
            description: '将光标移动到消息输入框',
            icon: '✏️',
            shortcut: ['/'],
            category: 'navigation',
            action: () => {
              const input = document.querySelector('textarea, [contenteditable="true"]') as HTMLElement;
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
              const btn = document.querySelector('.theme-toggle-btn') as HTMLButtonElement;
              btn?.click();
            }
          }
        ]}
      />
    </ErrorBoundary>
  );
};

export default App;
