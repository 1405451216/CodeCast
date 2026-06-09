import { useEffect, useState, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { initSentry } from './lib/sentry';
import { applyTheme } from './design/theme';
import { registerHotkey, unregisterAll } from './lib/hotkeys';
import { useAppStore } from './store';
import { bootstrapStore } from './store/bootstrap';
import { WorkspaceFrame } from './layout/WorkspaceFrame';
import { TopBar } from './layout/TopBar';
import { Sidebar } from './layout/Sidebar';
import { BottomBar } from './layout/BottomBar';
import { ChatArea } from './layout/ChatArea';
import { RightPanel } from './layout/RightPanel';
import { Drawer } from './layout/Drawer';
import { CommandPalette, type CommandItem } from './components/command/CommandPalette';
import { MenuPanel, type MenuItem } from './components/menu/MenuPanel';
import { mainMenu } from './components/menu/mainMenu';
import { ToastProvider, useToast } from './components/primitives/Toast';
import { useI18n } from './lib/useI18n';
import { CastEmptyState } from './pages/CastEmptyState';
import { CodeEmptyState } from './pages/CodeEmptyState';
import { ChatPage } from './pages/ChatPage';
import { Window } from './wails/adapter';
import { CastWritingPage } from './pages/CastWritingPage';
import { CastTranslationPage } from './pages/CastTranslationPage';
import { CastKnotePage } from './pages/CastKnotePage';
import { CastSchedulePage } from './pages/CastSchedulePage';
import { CastEmailPage } from './pages/CastEmailPage';
import { CastToolsPage } from './pages/CastToolsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CostPage } from './pages/CostPage';
import { PluginsPage } from './pages/PluginsPage';
import { InferenceConfigPage } from './pages/InferenceConfigPage';
import { UpdateBanner } from './components/updater/UpdateBanner';
import {
  onNotification,
  onMetricsSnapshot,
  onLifecycleStates,
  onSummaryReady,
  onGitCommitConfirm,
  onUpdateProgress,
  onCostSummary,
  onCacheStats,
  onAgentStart,
  onAgentStop,
  onAgentError,
  onAgentTurn,
  onAgentTurnEnd,
  onAgentTool,
  onAgentToolResult,
  onLLMCall,
  onLLMResponse,
  onPoolDispatch,
  onPoolComplete,
  onEnvCheckReport,
  onSilentDownloadProgress,
  onSilentDownloadComplete,
  onPopoutRequested,
  onOrchestrationEvent,
  onWorkflowStarted,
  onWorkflowComplete,
  onWorkflowPaused,
  onWorkflowResumed,
  onWorkflowCancelled,
  onWorkflowNodeEvent,
} from './wails/events';

initSentry();

function AppShell({ paletteOpen: _paletteOpen, setPaletteOpen }: { paletteOpen: boolean; setPaletteOpen: (v: boolean) => void }) {
  const navigate = useNavigate();
  const t = useI18n();
  const { theme, togglePlanMode, mode, currentSessionId, sessions, messages, isStreaming, send, cancel, current, currentVersion, switchSession, checkUpdate, sidebarOpen, toggleSidebar, drawerOpen, toggleDrawer } = useAppStore();
  const toast = useToast();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [booted, setBooted] = useState(false);
  // 只在"已有对话"时显示右侧浮动面板；新建对话（空状态）不显示
  // 同时检查当前会话是否属于当前 mode
  const currentSession = currentSessionId ? sessions.find((s) => s.id === currentSessionId) : null;
  const sessionModeMatch = currentSession ? (currentSession.mode || 'daily') === (mode === 'cast' ? 'daily' : 'coding') : false;
  const hasMessages = !!currentSessionId && sessionModeMatch && (messages[currentSessionId]?.length ?? 0) > 0;

  useEffect(() => { applyTheme(theme); }, [theme]);

  // ---- Bootstrap: load data from Go backend on startup ----
  useEffect(() => {
    void bootstrapStore(useAppStore.getState()).finally(() => setBooted(true));
  }, []);

  // ---- Message send / cancel wired to real store dispatches ----
  const handleSend = useCallback((text: string) => {
    if (currentSessionId) send(currentSessionId, text);
  }, [currentSessionId, send]);

  const handleCancel = useCallback(() => {
    if (currentSessionId) cancel(currentSessionId);
  }, [currentSessionId, cancel]);

  // ---- Session navigation (prev / next) — only within current mode ----
  const modeSessions = sessions.filter((s) => (s.mode || 'daily') === (mode === 'cast' ? 'daily' : 'coding'));
  const handlePrevSession = useCallback(() => {
    if (!currentSessionId || modeSessions.length <= 1) return;
    const idx = modeSessions.findIndex((s) => s.id === currentSessionId);
    const prev = idx > 0 ? modeSessions[idx - 1] : modeSessions[modeSessions.length - 1];
    switchSession(prev.id);
  }, [currentSessionId, modeSessions, switchSession]);

  const handleNextSession = useCallback(() => {
    if (!currentSessionId || modeSessions.length <= 1) return;
    const idx = modeSessions.findIndex((s) => s.id === currentSessionId);
    const next = idx < modeSessions.length - 1 ? modeSessions[idx + 1] : modeSessions[0];
    switchSession(next.id);
  }, [currentSessionId, modeSessions, switchSession]);

  const [splitView, setSplitView] = useState(false);
  void splitView; // Used by TopBar's onToggleSplit callback

  useEffect(() => {
    registerHotkey('mod+k', () => setPaletteOpen(true));
    registerHotkey('mod+p', () => setPaletteOpen(true));
    registerHotkey('mod+l', () => document.querySelector<HTMLTextAreaElement>('textarea')?.focus());
    registerHotkey('mod+shift+p', () => togglePlanMode());
    registerHotkey('mod+b', () => toggleSidebar());
    registerHotkey('mod+j', () => toggleDrawer());
    // Page navigation shortcuts (Ctrl+1~6)
    registerHotkey('mod+1', () => navigate('/'));
    registerHotkey('mod+2', () => navigate('/cast/writing'));
    registerHotkey('mod+3', () => navigate('/cast/translation'));
    registerHotkey('mod+4', () => navigate('/cast/knowledge'));
    registerHotkey('mod+5', () => navigate('/cast/email'));
    registerHotkey('mod+6', () => navigate('/cast/tools'));
    return () => unregisterAll();
  }, [togglePlanMode, setPaletteOpen, toggleSidebar, toggleDrawer, navigate]);

  // Toast dedup: prevent identical messages within 2s window
  const lastToastRef = useRef({ msg: '', time: 0 });
  const showDedupedToast = useCallback((msg: string, type?: 'info' | 'success' | 'danger') => {
    const now = Date.now();
    if (msg !== lastToastRef.current.msg || now - lastToastRef.current.time > 2000) {
      lastToastRef.current = { msg, time: now };
      toast.show(msg, type);
    }
  }, [toast]);

  // ---- Go backend event subscriptions ----
  useEffect(() => {
    let unsubs: (() => void)[] = [];
    try {
      unsubs = [
      onNotification((n) => {
        useAppStore.getState().pushNotification(n);
        showDedupedToast(n.body, n.type === 'error' ? 'danger' : 'info');
      }),
      onMetricsSnapshot((snap) => {
        useAppStore.getState().setMetricsSnap(snap);
      }),
      onLifecycleStates((states) => {
        useAppStore.getState().setAgentStates(states);
      }),
      onSummaryReady(({ sessionID, summary }) => {
        showDedupedToast(`[${sessionID.slice(0, 8)}] ${summary.slice(0, 40)}…`, 'info');
      }),
      onGitCommitConfirm(({ file }) => {
        if (window.confirm(`Git commit: ${file}?`)) {
          useAppStore.getState().confirmCommit(file);
        }
      }),
      onUpdateProgress((p) => {
        if (p.phase === 'download') {
          showDedupedToast(t.app.updateDownload(p.percent), 'info');
        }
      }),
      // ---- Cost tracking ----
      onCostSummary((cost) => {
        useAppStore.getState().setCostSummary(cost);
      }),
      // ---- Cache stats ----
      onCacheStats((stats) => {
        useAppStore.getState().setCacheStats(stats);
      }),
      // ---- Agent lifecycle ----
      onAgentStart((p) => {
        useAppStore.getState().appendAgentEvent({ ...p, _type: 'agent:start', _ts: Date.now() });
      }),
      onAgentStop((p) => {
        useAppStore.getState().appendAgentEvent({ ...p, _type: 'agent:stop', _ts: Date.now() });
        if (p.error) toast.show(t.app.agentStopped(p.error), 'danger');
      }),
      onAgentError((p) => {
        useAppStore.getState().appendAgentEvent({ ...p, _type: 'agent:error', _ts: Date.now() });
        toast.show(t.app.agentError(p.error || t.app.unknownError), 'danger');
      }),
      onAgentTurn((p) => {
        useAppStore.getState().appendAgentEvent({ ...p, _type: 'agent:turn', _ts: Date.now() });
      }),
      onAgentTurnEnd((p) => {
        useAppStore.getState().appendAgentEvent({ ...p, _type: 'agent:turn_end', _ts: Date.now() });
      }),
      onAgentTool((p) => {
        useAppStore.getState().appendAgentEvent({ ...p, _type: 'agent:tool', _ts: Date.now() });
      }),
      onAgentToolResult((p) => {
        useAppStore.getState().appendAgentEvent({ ...p, _type: 'agent:tool_result', _ts: Date.now() });
      }),
      // ---- LLM events (store only, no toast) ----
      // Intentionally not subscribed: high-frequency, tracked via metricsSnap
      // ---- Pool events ----
      onPoolDispatch((p) => {
        useAppStore.getState().setPoolQueue(p.queueLength ?? 0);
      }),
      onPoolComplete((p) => {
        useAppStore.getState().setPoolQueue(p.queueLength ?? 0);
      }),
      // ---- Environment check ----
      onEnvCheckReport((report) => {
        useAppStore.getState().setEnvCheckReport(report);
        if (report.OverallStatus !== 'ok') {
          toast.show(t.app.envIssue(report.Summary), 'warn');
        }
      }),
      // ---- Silent download (updater) ----
      onSilentDownloadProgress((p) => {
        if (p.percent % 25 === 0) {
          toast.show(t.app.backgroundDownload(p.percent), 'info');
        }
      }),
      onSilentDownloadComplete((p) => {
        if (p.success) {
          toast.show(t.app.backgroundDownloadDone, 'success');
        } else if (p.error) {
          toast.show(t.app.downloadFailed(p.error), 'danger');
        }
      }),
      // ---- Popout / Window ----
      onPopoutRequested(() => { /* handled by Wails window manager */ }),
      // ---- Orchestration ----
      onOrchestrationEvent('start', (p) => {
        toast.show(t.app.orchestrationStart(p.type), 'info');
      }),
      onOrchestrationEvent('complete', (p) => {
        if (p.error) toast.show(t.app.orchestrationCompleteWithError(p.type), 'warn');
        else toast.show(t.app.orchestrationComplete(p.type), 'success');
      }),
      onOrchestrationEvent('error', (p) => {
        toast.show(t.app.orchestrationError(p.error || p.type), 'danger');
      }),
      // ---- Workflow ----
      onWorkflowStarted((p) => {
        toast.show(t.app.workflowStarted(p.name || p.type || ''), 'info');
      }),
      onWorkflowComplete((p) => {
        if (p.error) toast.show(t.app.workflowFailed(p.error), 'danger');
        else toast.show(t.app.workflowComplete(p.name || p.type || ''), 'success');
      }),
      onWorkflowPaused(() => {}),
      onWorkflowResumed(() => {}),
      onWorkflowCancelled(() => {}),
      onWorkflowNodeEvent(() => {}),
      ];
    } catch {
      // Wails runtime not available (browser-only preview mode)
    }
    return () => unsubs.forEach((fn) => fn());
  }, [toast]);

  const openMenu = useCallback(() => {
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (r) setMenuAnchor({ x: r.left, y: r.bottom + 4 });
    setMenuOpen(true);
  }, []);

  const handleMenuItem = useCallback((it: MenuItem) => {
    if (it.kind !== 'action') return;
    const id = it.id;
    switch (id) {
      case 'new': navigate('/'); break;
      case 'settings': navigate('/settings'); break;
      case 'close-window': window.close(); break;
      case 'quit': window.close(); break;
      case 'undo': document.execCommand('undo'); break;
      case 'redo': document.execCommand('redo'); break;
      case 'cut': document.execCommand('cut'); break;
      case 'copy': {
        const sel = window.getSelection()?.toString();
        if (sel) navigator.clipboard?.writeText(sel);
        break;
      }
      case 'paste': {
        navigator.clipboard?.readText().then((text) => {
          document.execCommand('insertText', false, text);
        });
        break;
      }
      case 'select-all': document.execCommand('selectAll'); break;
      case 'find': toast.show(t.app.findPrefix + (window.getSelection()?.toString() || '')); break;
      case 'reload': window.location.reload(); break;
      case 'actual-size': document.body.style.zoom = ''; break;
      case 'zoom-in': document.body.style.zoom = ((Number(document.body.style.zoom) || 100) + 10) + '%'; break;
      case 'zoom-out': document.body.style.zoom = ((Number(document.body.style.zoom) || 100) - 10) + '%'; break;
      case 'copy-url':
        navigator.clipboard?.writeText(window.location.href);
        toast.show(t.app.copiedUrl, 'success');
        break;
      case 'open-mcp-log': navigate('/settings'); break;
      case 'reload-mcp': navigate('/settings'); break;
      case 'config-third-party': navigate('/settings'); break;
      case 'open-app-config': navigate('/settings'); break;
      case 'open-dev-config': navigate('/settings'); break;
      case 'show-devtools': { try { (window as any).__WAILS_RUNTIME__?.Call('Runtime.BrowserOpenURL', 'devtools://devtools/bundled/inspector.html'); } catch {} toast.show(t.app.devtoolsViaWails, 'info'); break; }
      case 'show-all-devtools': toast.show(t.app.devtoolsViaWails, 'info'); break;
      case 'enable-main-debugger': toast.show(t.app.mainDebuggerViaWails, 'info'); break;
      case 'record-perf': toast.show(t.app.perfTraceNeedsWails, 'info'); break;
      case 'heap-snapshot': toast.show(t.app.heapSnapshotNeedsWails, 'info'); break;
      case 'record-mem': toast.show(t.app.memTraceNeedsWails, 'info'); break;
      case 'open-docs': window.open('https://docs.anthropic.com/zh-CN/docs/claude-code', '_blank'); break;
      case 'check-update': {
        checkUpdate().then(() => {
          const info = useAppStore.getState().updateInfo;
          if (info && info.version !== currentVersion) {
            toast.show(t.app.updateFound(info.version, info.title), 'success');
          } else {
            toast.show(t.app.upToDate(currentVersion || '…'), 'info');
          }
        });
        break;
      }
      case 'get-support': window.open('https://support.anthropic.com', '_blank'); break;
      case 'about': toast.show(t.app.about(currentVersion || '…')); break;
      case 'ext-installed': navigate('/plugins'); break;
      case 'ext-market': navigate('/plugins'); break;
      case 'ext-install-local': navigate('/plugins'); break;
      case 'reset-session': { const sid = useAppStore.getState().currentSessionId; if (sid) { useAppStore.getState().deleteSession(sid); toast.show(t.app.sessionReset, 'success'); } break; }
      case 'clear-cache': { try { localStorage.clear(); } catch {} toast.show(t.app.cacheCleared, 'success'); break; }
      case 'view-logs': toast.show(t.app.viewLogsWip, 'info'); break;
      case 'report-bug': window.open('https://github.com/anthropics/claude-code/issues', '_blank'); break;
    }
  }, [navigate, toast, checkUpdate, currentVersion]);

  // Skeleton loading screen during bootstrap
  if (!booted) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: 'var(--c-bg)', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid var(--c-border)',
            borderTopColor: 'var(--c-accent)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: 13, color: 'var(--c-textMute)' }}>{t.app.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <UpdateBanner />
      <WorkspaceFrame
        top={
          <TopBar
            menuButtonRef={menuBtnRef}
            menuOpen={menuOpen}
            onOpenMenu={openMenu}
            onOpenSearch={() => setPaletteOpen(true)}
            onPrevSession={handlePrevSession}
            onNextSession={handleNextSession}
            onToggleSplit={() => setSplitView((v) => !v)}
            onMinimize={() => Window.minimise()}
            onMaximize={() => Window.maximise()}
            onClose={() => Window.close()}
            sessionName={currentSession?.name}
          />
        }
        sidebar={<Sidebar />}
        chat={
          <ChatArea>
            <Routes>
              <Route
                path="/"
                element={
                  hasMessages && currentSessionId ? (
                    <ChatPage
                      sessionId={currentSessionId}
                      messages={messages[currentSessionId!] || []}
                      isStreaming={isStreaming}
                      model={current || '—'}
                      thinking={false}
                      onSend={handleSend}
                      onCancel={handleCancel}
                    />
                  ) : mode === 'cast' ? (
                    <CastEmptyState
                      onSend={handleSend}
                      onNavigate={navigate}
                      model={current || '—'}
                      thinking={false}
                      onCancel={handleCancel}
                    />
                  ) : (
                    <CodeEmptyState
                      onSend={handleSend}
                      onCancel={handleCancel}
                      model={current || 'MiniMax-M3'}
                      sessionName="SD session"
                      projectName="AgentPrimordia"
                      thinking={false}
                    />
                  )
                }
              />
              <Route path="/cast" element={<CastEmptyState onNavigate={navigate} />} />
              <Route path="/cast/writing" element={<CastWritingPage />} />
              <Route path="/cast/translation" element={<CastTranslationPage />} />
              <Route path="/cast/knowledge" element={<CastKnotePage />} />
              <Route path="/cast/schedule" element={<CastSchedulePage />} />
              <Route path="/cast/email" element={<CastEmailPage />} />
              <Route path="/cast/tools" element={<CastToolsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/cost" element={<CostPage />} />
              <Route path="/plugins" element={<PluginsPage />} />
              <Route path="/inference" element={<InferenceConfigPage />} />
            </Routes>
          </ChatArea>
        }
        rightPanel={hasMessages ? <RightPanel /> : null}
        bottom={<BottomBar />}
        drawer={<Drawer />}
        drawerOpen={drawerOpen}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
      />
      {menuOpen && menuAnchor && (
        <MenuPanel
          items={mainMenu}
          anchor={menuAnchor}
          align="below"
          onClose={() => setMenuOpen(false)}
          onItemClick={handleMenuItem}
        />
      )}
    </>
  );
}

export const App = Sentry.withErrorBoundary(function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const t = useI18n();
  const store = useAppStore;

  const handleCommand = useCallback((item: { id: string; label: string }) => {
    const s = store.getState();
    switch (item.id) {
      case 'new':
        s.createSession('New Session', '', s.mode === 'cast' ? 'daily' : 'coding');
        navigate('/');
        break;
      case 'clear':
        if (s.currentSessionId) { s.deleteSession(s.currentSessionId); }
        break;
      case 'theme':
        s.setTheme(s.theme === 'dark' ? 'light' : 'dark');
        break;
      case 'cast.writing': navigate('/cast/writing'); break;
      case 'cast.translation': navigate('/cast/translation'); break;
      case 'cast.knowledge': navigate('/cast/knowledge'); break;
      case 'cast.schedule': navigate('/cast/schedule'); break;
      case 'cast.email': navigate('/cast/email'); break;
      case 'cast.tools': navigate('/cast/tools'); break;
      case 'settings': navigate('/settings'); break;
      case 'cost': navigate('/cost'); break;
      case 'plugins': navigate('/plugins'); break;
      case 'inference': navigate('/inference'); break;
      case 'sidebar': s.toggleSidebar(); break;
      case 'drawer': s.toggleDrawer(); break;
      default: break;
    }
  }, [navigate, store]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <AppShell paletteOpen={paletteOpen} setPaletteOpen={setPaletteOpen} />
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onCommand={handleCommand}
          items={useAppStore.getState().sessions?.slice(0, 10).map(s => ({
            id: `session:${s.id}`,
            label: s.name || 'Untitled',
            group: t.app.sessionGroup,
            icon: '💬',
          }))}
        />
      </BrowserRouter>
    </ToastProvider>
  );
}, {
  fallback: <ErrorFallback />,
});

function ErrorFallback() {
  const t = useI18n();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, padding: 32, textAlign: 'center' }}>
      <svg width="48" height="48" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--c-danger, #e74c3c)' }}>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M8 4.5v4M8 10.5v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--c-text)' }}>{t.app.errorTitle}</h2>
      <p style={{ fontSize: 14, color: 'var(--c-textMute)', maxWidth: 400 }}>
        {t.app.errorDesc}
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 20px', background: 'var(--c-accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          {t.app.reload}
        </button>
        <button
          onClick={() => window.open('https://github.com/anthropics/claude-code/issues', '_blank')}
          style={{ padding: '8px 20px', background: 'transparent', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-md)', fontSize: 14, cursor: 'pointer' }}
        >
          {t.app.reportIssue}
        </button>
      </div>
    </div>
  );
}

