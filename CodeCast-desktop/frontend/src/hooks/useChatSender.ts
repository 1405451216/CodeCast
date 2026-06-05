import { useCallback, useRef, useEffect } from 'react';
import { useAppStore, Message, AppState } from '../store';
import * as api from '../api';
import { toSession, toMessage } from '../api/types';
import { EventsOn } from '../../wailsjs/runtime/runtime';

import { toError } from '../utils/errors';

// AP StreamRun event types (from chat.go)
type APStreamEventType = 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'error' | 'done';

export function useChatSender() {
  const currentSessionId = useAppStore((s: AppState) => s.currentSessionId);
  const selectedModel = useAppStore((s: AppState) => s.selectedModel);
  const thinkingMode = useAppStore((s: AppState) => s.thinkingMode);
  const isLoading = useAppStore((s: AppState) => s.isLoading);
  const setCurrentSessionId = useAppStore((s: AppState) => s.setCurrentSessionId);
  const addSession = useAppStore((s: AppState) => s.addSession);
  const addMessage = useAppStore((s: AppState) => s.addMessage);
  const updateLastMessage = useAppStore((s: AppState) => s.updateLastMessage);
  const setView = useAppStore((s: AppState) => s.setView);
  const setTitle = useAppStore((s: AppState) => s.setTitle);
  const setIsLoading = useAppStore((s: AppState) => s.setIsLoading);
  const pendingMode = useAppStore((s: AppState) => s.pendingMode);
  const streamingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    if (isLoading) return;

    let sessionId: string | null = currentSessionId;

    if (!sessionId) {
      try {
        const session = await api.createSession('新对话', '', pendingMode ?? '');
        sessionId = session.ID;
        setCurrentSessionId(sessionId);
        addSession(toSession(session));
      } catch (e) {
        console.error('Create session failed:', e);
        return;
      }
    }

    if (!sessionId) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    addMessage(userMsg);
    setView('chat');
    setTitle('新对话');
    setIsLoading(true);
    streamingRef.current = false;

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Listen for AP stream events (from chat.go StreamRun)
    const eventName = `stream:${sessionId}`;
    const cleanup = EventsOn(eventName, (data: { type: APStreamEventType; content?: string }) => {
      switch (data.type) {
        case 'content':
          if (!streamingRef.current) {
            streamingRef.current = true;
            addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', reasoning: '', timestamp: Date.now() });
          }
          updateLastMessage((last) => {
            if (last && last.role === 'assistant') {
              return { ...last, content: last.content + (data.content || '') };
            }
            return last;
          });
          break;
        case 'reasoning':
          if (!streamingRef.current) {
            streamingRef.current = true;
            addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', reasoning: '', timestamp: Date.now() });
          }
          updateLastMessage((last) => {
            if (last && last.role === 'assistant') {
              return { ...last, reasoning: (last.reasoning || '') + (data.content || '') };
            }
            return last;
          });
          break;
        case 'tool_call':
          // Tool call started — agent is executing a tool
          break;
        case 'tool_result':
          // Tool result received — agent continues reasoning
          break;
        case 'error':
          updateLastMessage((last) => {
            if (last && last.role === 'assistant' && !last.content) {
              return { ...last, content: '抱歉，发生了错误: ' + (data.content || '未知错误') };
            }
            return last;
          });
          break;
        case 'done':
          // Stream complete
          break;
      }
    });

    cleanupRef.current = cleanup;

    try {
      const resp = await api.sendMessageEx(sessionId, text, selectedModel, thinkingMode);
      // Fallback: if no streaming events were received, use the full response
      if (!streamingRef.current && resp && resp.length > 0) {
        addMessage(toMessage(resp[0]));
      }
    } catch (e: unknown) {
      if (!streamingRef.current) {
        addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '抱歉，发生了错误: ' + (toError(e).message || e), timestamp: Date.now() });
      } else {
        updateLastMessage((last) => {
          if (last && last.role === 'assistant' && !last.content) {
            return { ...last, content: '抱歉，发生了错误: ' + (toError(e).message || e) };
          }
          return last;
        });
      }
    } finally {
      setTimeout(() => {
        if (cleanup) cleanup();
      }, 100);
      setIsLoading(false);
      streamingRef.current = false;
    }
  }, [isLoading, currentSessionId, selectedModel, thinkingMode, pendingMode, setCurrentSessionId, addSession, addMessage, updateLastMessage, setView, setTitle, setIsLoading]);

  return { handleSendMessage };
}
