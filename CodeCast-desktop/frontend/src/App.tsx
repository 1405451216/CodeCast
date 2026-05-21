import React, { useEffect, useState } from 'react';
import { useAppStore, Message, Session } from './store';
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
import NotificationCenter from './components/NotificationCenter';

const App: React.FC = () => {
  const {
    sessions,
    currentSessionId,
    selectedModel,
    thinkingMode,
    setSessions,
    setCurrentSessionId,
    addSession,
    removeSession,
    setAttachments,
    activePanel,
    setActivePanel,
  } = useAppStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('CodeCast');
  const [view, setView] = useState<'welcome' | 'chat'>('welcome');

  // Initialize: load sessions and settings
  useEffect(() => {
    initApp();
  }, []);

  // Listen for clear-session event from TitleBar
  useEffect(() => {
    const handler = () => handleClearSession();
    window.addEventListener('clear-session', handler);
    return () => window.removeEventListener('clear-session', handler);
  }, [currentSessionId]);

  const initApp = async () => {
    // Init theme
    const savedTheme = localStorage.getItem('codecast_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Load settings
    try {
      const settings = await api.getSettings();
      if (settings) {
        if (settings.theme) {
          document.documentElement.setAttribute('data-theme', settings.theme);
          localStorage.setItem('codecast_theme', settings.theme);
        }
        if (settings.font_size) {
          document.documentElement.style.setProperty(
            '--font-size-base',
            settings.font_size === 'small' ? '12px' : settings.font_size === 'large' ? '16px' : '14px'
          );
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }

    // Load sessions
    try {
      const data = await api.getSessions();
      setSessions(data || []);
    } catch (e) {
      setSessions([]);
    }
  };

  const handleNewSession = () => {
    setCurrentSessionId(null);
    setAttachments([]);
    setMessages([]);
    setTitle('CodeCast');
    setView('welcome');
    setActivePanel(null);
  };

  const handleSelectSession = async (id: string) => {
    setCurrentSessionId(id);
    setActivePanel(null);
    try {
      const s = await api.getSession(id);
      if (s) {
        setTitle(s.Name);
        setMessages(s.Messages || []);
        setView('chat');
      }
    } catch (e) {
      const s = sessions.find((x) => x.ID === id);
      if (s) {
        setTitle(s.Name);
        setMessages(s.Messages || []);
        setView('chat');
      }
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await api.deleteSession(id);
      removeSession(id);
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
        setTitle('CodeCast');
        setView('welcome');
      }
    } catch (e) {
      console.error('Delete session failed:', e);
    }
  };

  const handleClearSession = () => {
    if (currentSessionId) {
      handleDeleteSession(currentSessionId);
    }
  };

  const handleSendMessage = async (text: string) => {
    // Guard against duplicate sends while loading
    if (isLoading) return;

    let sessionId: string | null = currentSessionId;

    // Create session if needed
    if (!sessionId) {
      try {
        const session = await api.createSession('新对话', '');
        sessionId = session.ID;
        setCurrentSessionId(sessionId);
        addSession(session);
      } catch (e) {
        console.error('Create session failed:', e);
        return;
      }
    }

    // At this point sessionId is guaranteed non-null
    if (!sessionId) return;

    // Show user message
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setView('chat');
    setTitle('新对话');
    setIsLoading(true);

    try {
      const resp = await api.sendMessageEx(sessionId, text, selectedModel, thinkingMode);
      if (resp && resp.length > 0) {
        setMessages((prev) => [...prev, resp[0]]);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '抱歉，发生了错误: ' + (e.message || e) }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <TitleBar />
      <div className="app">
        <Sidebar
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
        />
        <div className="main">
          <TopBar title={title} />
          <div className="chat-area" id="chatArea">
            {view === 'welcome' ? (
              <WelcomeView onSend={handleSendMessage} />
            ) : (
              <MessagesView messages={messages} isLoading={isLoading} />
            )}
          </div>
          {view === 'chat' && <ChatInput onSend={handleSendMessage} />}
          {/* Panel overlays inside .main */}
          <PluginsPanel />
          <AutomationPanel />
          <ProjectsPanel />
        </div>
        <PreviewPanel />
        <FilesPanel />
      </div>
      <SettingsPage />
      <NotificationCenter />
    </>
  );
};

export default App;
