import { useCallback } from 'react';
import { useAppStore, Session, AppState } from '../store';
import * as api from '../api';
import { toMessage } from '../api/types';

interface UseSessionActionsReturn {
  handleNewSession: () => void;
  handleSelectSession: (id: string) => Promise<void>;
  handleDeleteSession: (id: string) => Promise<void>;
  handleClearSession: () => void;
}

export function useSessionActions(): UseSessionActionsReturn {
  const sessions = useAppStore((s: AppState) => s.sessions);
  const currentSessionId = useAppStore((s: AppState) => s.currentSessionId);
  const setCurrentSessionId = useAppStore((s: AppState) => s.setCurrentSessionId);
  const addSession = useAppStore((s: AppState) => s.addSession);
  const removeSession = useAppStore((s: AppState) => s.removeSession);
  const setAttachments = useAppStore((s: AppState) => s.setAttachments);
  const setActivePanel = useAppStore((s: AppState) => s.setActivePanel);
  const setMessages = useAppStore((s: AppState) => s.setMessages);
  const clearMessages = useAppStore((s: AppState) => s.clearMessages);
  const setTitle = useAppStore((s: AppState) => s.setTitle);
  const setView = useAppStore((s: AppState) => s.setView);

  const handleNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setAttachments([]);
    clearMessages();
    setTitle('CodeCast');
    setView('welcome');
    setActivePanel(null);
  }, [setCurrentSessionId, setAttachments, setActivePanel, clearMessages, setTitle, setView]);

  const handleSelectSession = useCallback(async (id: string) => {
    setCurrentSessionId(id);
    setActivePanel(null);
    try {
      const s = await api.getSession(id);
      if (s) {
        setTitle(s.Name);
        setMessages((s.Messages || []).map(toMessage));
        setView('chat');
      }
    } catch (e) {
      const s = sessions.find((x: Session) => x.ID === id);
      if (s) {
        setTitle(s.Name);
        setMessages(s.Messages || []);
        setView('chat');
      }
    }
  }, [sessions, setCurrentSessionId, setActivePanel, setMessages, setTitle, setView]);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await api.deleteSession(id);
      removeSession(id);
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        clearMessages();
        setTitle('CodeCast');
        setView('welcome');
      }
    } catch (e) {
      console.error('Delete session failed:', e);
    }
  }, [currentSessionId, removeSession, setCurrentSessionId, clearMessages, setTitle, setView]);

  const handleClearSession = useCallback(() => {
    if (currentSessionId) {
      handleDeleteSession(currentSessionId);
    }
  }, [currentSessionId, handleDeleteSession]);

  return { handleNewSession, handleSelectSession, handleDeleteSession, handleClearSession };
}
