import { useCallback, useRef } from 'react';
import { useAppStore, Message, AppState } from '../store';
import * as api from '../api';
import { toSession, toMessage } from '../api/types';
import { EventsOn } from '../../wailsjs/runtime/runtime';

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
  const streamingRef = useRef(false);

  const handleSendMessage = useCallback(async (text: string) => {
    if (isLoading) return;

    let sessionId: string | null = currentSessionId;

    if (!sessionId) {
      try {
        const session = await api.createSession('新对话', '');
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

    // 监听流式事件
    const eventName = `stream:${sessionId}`;
    const cleanup = EventsOn(eventName, (data: any) => {
      if (data.type === 'start') {
        streamingRef.current = true;
        // 添加一个空的 assistant 消息作为流式占位
        addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', reasoning: '', timestamp: Date.now() });
      } else if (data.type === 'reasoning') {
        // 追加思考内容到最后一条消息
        updateLastMessage((last) => {
          if (last && last.role === 'assistant') {
            return { ...last, reasoning: (last.reasoning || '') + data.content };
          }
          return last;
        });
      } else if (data.type === 'content') {
        // 追加正文内容到最后一条消息
        updateLastMessage((last) => {
          if (last && last.role === 'assistant') {
            return { ...last, content: last.content + data.content };
          }
          return last;
        });
      } else if (data.type === 'done') {
        // 流式结束，不做额外处理，等 sendMessageEx 返回
      }
    });

    try {
      const resp = await api.sendMessageEx(sessionId, text, selectedModel, thinkingMode);
      // 如果没有收到流式事件（回退模式），用完整响应替换
      if (!streamingRef.current && resp && resp.length > 0) {
        addMessage(toMessage(resp[0]));
      }
    } catch (e: any) {
      if (!streamingRef.current) {
        addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '抱歉，发生了错误: ' + (e.message || e), timestamp: Date.now() });
      } else {
        // 流式过程中出错，更新最后一条消息
        updateLastMessage((last) => {
          if (last && last.role === 'assistant' && !last.content) {
            return { ...last, content: '抱歉，发生了错误: ' + (e.message || e) };
          }
          return last;
        });
      }
    } finally {
      if (cleanup) cleanup();
      setIsLoading(false);
      streamingRef.current = false;
    }
  }, [isLoading, currentSessionId, selectedModel, thinkingMode, setCurrentSessionId, addSession, addMessage, updateLastMessage, setView, setTitle, setIsLoading]);

  return { handleSendMessage };
}
