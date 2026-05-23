import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore, AppState } from './store';
import { useAppInit } from './hooks/useAppInit';
import { useSessionActions } from './hooks/useSessionActions';
import { useChatSender } from './hooks/useChatSender';
import * as api from './api';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import WelcomeView from './components/WelcomeView';
import MessagesView from './components/MessagesView';
import ChatInput from './components/ChatInput';
import PreviewPanel from './components/PreviewPanel';
import FilesPanel from './components/FilesPanel';
import SettingsPage from './components/SettingsPage';
import PluginsPanel from './components/PluginsPanel';
import AutomationPanel from './components/AutomationPanel';
import ProjectsPanel from './components/ProjectsPanel';
import AgentsPanel from './components/AgentsPanel';
import NotificationCenter from './components/NotificationCenter';
import PanelResizer from './components/PanelResizer';

const App: React.FC = () => {
  // Panel widths
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [previewWidth, setPreviewWidth] = useState(420);
  const [filesWidth, setFilesWidth] = useState(240);

  const sidebarVisible = useAppStore((s: AppState) => s.sidebarVisible);
  const previewPanelVisible = useAppStore((s: AppState) => s.previewPanelVisible);
  const filesPanelVisible = useAppStore((s: AppState) => s.filesPanelVisible);
  const activePanel = useAppStore((s: AppState) => s.activePanel);
  const view = useAppStore((s: AppState) => s.view);
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

  // Resize handlers
  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(180, Math.min(500, w + delta)));
  }, []);

  const handlePreviewResize = useCallback((delta: number) => {
    setPreviewWidth((w) => Math.max(250, Math.min(800, w - delta)));
  }, []);

  const handleFilesResize = useCallback((delta: number) => {
    setFilesWidth((w) => Math.max(160, Math.min(500, w - delta)));
  }, []);

  return (
    <>
      <TitleBar />
      <div className="app">
        <Sidebar
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          style={sidebarVisible ? { width: sidebarWidth } : undefined}
        />
        {sidebarVisible && (
          <PanelResizer onResize={handleSidebarResize} />
        )}
        <div className="main">
          <TopBar />
          <div className="chat-area" id="chatArea">
            {view === 'welcome' ? (
              <WelcomeView onSend={handleSendMessage} />
            ) : (
              <MessagesView isLoading={isLoading} />
            )}
          </div>
          {view === 'chat' && <ChatInput onSend={handleSendMessage} isLoading={isLoading} onStop={handleStop} />}
          <PluginsPanel />
          <AutomationPanel />
          <ProjectsPanel />
          {activePanel === 'agents' && <AgentsPanel />}
        </div>
        {previewPanelVisible && (
          <PanelResizer onResize={handlePreviewResize} />
        )}
        <PreviewPanel style={previewPanelVisible ? { width: previewWidth } : undefined} />
        {filesPanelVisible && (
          <PanelResizer onResize={handleFilesResize} />
        )}
        <FilesPanel style={filesPanelVisible ? { width: filesWidth } : undefined} />
      </div>
      <SettingsPage />
      <NotificationCenter />
    </>
  );
};

export default App;
