import { useEffect, useState, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { initSentry } from './lib/sentry';
import { applyTheme } from './design/theme';
import { registerHotkey, unregisterAll } from './lib/hotkeys';
import { useAppStore } from './store';
import { WorkspaceFrame } from './layout/WorkspaceFrame';
import { TopBar } from './layout/TopBar';
import { Sidebar } from './layout/Sidebar';
import { BottomBar } from './layout/BottomBar';
import { ChatArea } from './layout/ChatArea';
import { RightPanel } from './layout/RightPanel';
import { CommandPalette } from './components/command/CommandPalette';
import { MenuPanel, type MenuItem } from './components/menu/MenuPanel';
import { mainMenu } from './components/menu/mainMenu';
import { ToastProvider, useToast } from './components/primitives/Toast';
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
  const { theme, togglePlanMode, mode, currentSessionId, messages, isStreaming, send, cancel, current, currentVersion } = useAppStore();
  const toast = useToast();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  // 只在"已有对话"时显示右侧浮动面板；新建对话（空状态）不显示
  const hasMessages = !!currentSessionId && (messages[currentSessionId]?.length ?? 0) > 0;

  useEffect(() => { applyTheme(theme); }, [theme]);

  // ---- Bootstrap: load data from Go backend on startup ----
  useEffect(() => {
    const s = useAppStore.getState();
    s.loadSessions();
    s.loadModels();
    s.loadProjects();
    s.loadSettings();
    s.loadCatalog();
    s.refreshGit();
  }, []);

  // ---- Message send / cancel wired to real store dispatches ----
  const handleSend = useCallback((text: string) => {
    if (currentSessionId) send(currentSessionId, text);
  }, [currentSessionId, send]);

  const handleCancel = useCallback(() => {
    if (currentSessionId) cancel(currentSessionId);
  }, [currentSessionId, cancel]);

  useEffect(() => {
    registerHotkey('mod+k', () => setPaletteOpen(true));
    registerHotkey('mod+p', () => setPaletteOpen(true));
    registerHotkey('mod+l', () => document.querySelector<HTMLTextAreaElement>('textarea')?.focus());
    registerHotkey('mod+shift+p', () => togglePlanMode());
    return () => unregisterAll();
  }, [togglePlanMode, setPaletteOpen]);

  // ---- Go backend event subscriptions ----
  useEffect(() => {
    const unsubs = [
      onNotification((n) => {
        useAppStore.getState().pushNotification(n);
        toast.show(n.body, n.type === 'error' ? 'danger' : 'info');
      }),
      onMetricsSnapshot((snap) => {
        useAppStore.getState().setMetricsSnap(snap);
      }),
      onLifecycleStates((states) => {
        useAppStore.getState().setAgentStates(states);
      }),
      onSummaryReady(({ sessionID, summary }) => {
        toast.show(`[${sessionID.slice(0, 8)}] ${summary.slice(0, 40)}…`, 'info');
      }),
      onGitCommitConfirm(({ file }) => {
        if (window.confirm(`Git 提交确认: ${file}?`)) {
          useAppStore.getState().confirmCommit(file);
        }
      }),
      onUpdateProgress((p) => {
        if (p.phase === 'download') {
          toast.show(`更新下载: ${p.percent}%`, 'info');
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
        if (p.error) toast.show(`Agent 停止: ${p.error}`, 'danger');
      }),
      onAgentError((p) => {
        useAppStore.getState().appendAgentEvent({ ...p, _type: 'agent:error', _ts: Date.now() });
        toast.show(`Agent 错误: ${p.error || '未知错误'}`, 'danger');
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
      onLLMCall(() => { /* high-frequency, tracked via metricsSnap */ }),
      onLLMResponse(() => { /* high-frequency, tracked via metricsSnap */ }),
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
          toast.show(`环境问题: ${report.Summary}`, 'warn');
        }
      }),
      // ---- Silent download (updater) ----
      onSilentDownloadProgress((p) => {
        if (p.percent % 25 === 0) {
          toast.show(`后台下载: ${p.percent}%`, 'info');
        }
      }),
      onSilentDownloadComplete((p) => {
        if (p.success) {
          toast.show('后台下载完成', 'success');
        } else if (p.error) {
          toast.show(`下载失败: ${p.error}`, 'danger');
        }
      }),
      // ---- Popout / Window ----
      onPopoutRequested(() => { /* handled by Wails window manager */ }),
      // ---- Orchestration ----
      onOrchestrationEvent('start', (p) => {
        toast.show(`编排开始: ${p.type}`, 'info');
      }),
      onOrchestrationEvent('complete', (p) => {
        if (p.error) toast.show(`编排完成 (有错误): ${p.type}`, 'warn');
        else toast.show(`编排完成: ${p.type}`, 'success');
      }),
      onOrchestrationEvent('error', (p) => {
        toast.show(`编排错误: ${p.error || p.type}`, 'danger');
      }),
      // ---- Workflow ----
      onWorkflowStarted((p) => {
        toast.show(`工作流启动: ${p.name || p.type}`, 'info');
      }),
      onWorkflowComplete((p) => {
        if (p.error) toast.show(`工作流失败: ${p.error}`, 'danger');
        else toast.show(`工作流完成: ${p.name || p.type}`, 'success');
      }),
      onWorkflowPaused(() => {}),
      onWorkflowResumed(() => {}),
      onWorkflowCancelled(() => {}),
      onWorkflowNodeEvent(() => {}),
    ];
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
      case 'copy': document.execCommand('copy'); break;
      case 'paste': document.execCommand('paste'); break;
      case 'select-all': document.execCommand('selectAll'); break;
      case 'find': toast.show('查找：' + (window.getSelection()?.toString() || '')); break;
      case 'reload': window.location.reload(); break;
      case 'actual-size': (document.body.style as any).zoom = ''; break;
      case 'zoom-in': (document.body.style as any).zoom = ((Number((document.body.style as any).zoom) || 100) + 10) + '%'; break;
      case 'zoom-out': (document.body.style as any).zoom = ((Number((document.body.style as any).zoom) || 100) - 10) + '%'; break;
      case 'copy-url':
        navigator.clipboard?.writeText(window.location.href);
        toast.show('已复制 URL', 'success');
        break;
      case 'open-mcp-log': toast.show('打开 MCP 日志…（需 Wails 后端）'); break;
      case 'reload-mcp': toast.show('重新加载 MCP 配置…'); break;
      case 'config-third-party': navigate('/settings'); break;
      case 'open-app-config': toast.show('打开应用配置文件…'); break;
      case 'open-dev-config': toast.show('打开开发者配置文件…'); break;
      case 'show-devtools': toast.show('显示开发者工具（Wails 后端）'); break;
      case 'show-all-devtools': toast.show('显示所有开发者工具'); break;
      case 'enable-main-debugger': toast.show('Enable Main Process Debugger'); break;
      case 'record-perf': toast.show('Record Performance Trace'); break;
      case 'heap-snapshot': toast.show('Write Main Process Heap Snapshot'); break;
      case 'record-mem': toast.show('Record Memory Trace'); break;
      case 'open-docs': window.open('https://docs.anthropic.com/zh-CN/docs/claude-code', '_blank'); break;
      case 'check-update': toast.show(`检查更新… v${currentVersion || '…'} 已是最新`); break;
      case 'get-support': window.open('https://support.anthropic.com', '_blank'); break;
      case 'about': toast.show(`CodeCast v${currentVersion || '…'} · Claude Code 风格前端`); break;
      case 'ext-installed': toast.show('已安装的扩展'); break;
      case 'ext-market': toast.show('扩展市场'); break;
      case 'ext-install-local': toast.show('从本地文件安装扩展'); break;
      case 'reset-session': toast.show('重置当前会话'); break;
      case 'clear-cache': toast.show('清除本地缓存'); break;
      case 'view-logs': toast.show('查看运行日志'); break;
      case 'report-bug': window.open('https://github.com/anthropics/claude-code/issues', '_blank'); break;
    }
  }, [navigate, toast]);

  return (
    <>
      <WorkspaceFrame
        top={
          <TopBar
            menuButtonRef={menuBtnRef}
            menuOpen={menuOpen}
            onOpenMenu={openMenu}
            onOpenSearch={() => setPaletteOpen(true)}
            onMinimize={() => Window.minimise()}
            onMaximize={() => Window.maximise()}
            onClose={() => Window.close()}
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
            </Routes>
          </ChatArea>
        }
        rightPanel={hasMessages ? <RightPanel /> : null}
        bottom={<BottomBar />}
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
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppShell paletteOpen={paletteOpen} setPaletteOpen={setPaletteOpen} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onCommand={() => {}} />
      </BrowserRouter>
    </ToastProvider>
  );
}, { fallback: <div style={{ padding: 24 }}>Something went wrong.</div> });

