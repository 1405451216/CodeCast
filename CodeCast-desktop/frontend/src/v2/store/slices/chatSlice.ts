import type { StateCreator } from 'zustand';
import type { Message } from '../../wails/types';
import { Chat } from '../../wails/adapter';
import { onStreamChunk } from '../../wails/events';
import { createStreamBuffer } from '../../lib/streaming';
import { createStreamGuard } from '../../lib/stream-guard';
import { reportError } from '../../lib/reportError';

export interface ChatSlice {
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  interrupted: boolean;
  abort: AbortController | null;
  send: (sessionId: string, text: string, model?: string, thinking?: string) => Promise<void>;
  cancel: (sessionId: string) => void;
  resume: (sessionId: string) => Promise<void>;
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set, get) => ({
  messages: {},
  isStreaming: false,
  interrupted: false,
  abort: null,

  send: async (sessionId, text, model = '', thinking = '') => {
    set({ isStreaming: true, interrupted: false });
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] || []), { role: 'user' as const, content: text }],
      },
    }));
    const buf = createStreamBuffer({ flushSize: 1, flushIntervalMs: 200 });
    const guard = createStreamGuard({
      timeoutMs: 60_000,
      onTimeout: () => { set({ isStreaming: false, interrupted: true }); buf.dispose(); guard.dispose(); },
    });
    let reasoningBuf = '';
    buf.onFlush = (chunk) => {
      set((s) => {
        const list = s.messages[sessionId] || [];
        const last = list[list.length - 1];
        if (last?.role === 'assistant') {
          return { messages: { ...s.messages, [sessionId]: [...list.slice(0, -1), { ...last, content: (last.content || '') + chunk }] } };
        }
        return { messages: { ...s.messages, [sessionId]: [...list, { role: 'assistant' as const, content: chunk, reasoning: reasoningBuf || undefined }] } };
      });
      guard.reset();
    };
    guard.start();
    const unsubscribe = onStreamChunk(sessionId, (evt) => {
      switch (evt.type) {
        case 'content':
          if (evt.content) buf.push(evt.content);
          break;
        case 'reasoning':
          reasoningBuf += evt.content ?? '';
          break;
        case 'tool_call':
          set((s) => ({
            messages: {
              ...s.messages,
              [sessionId]: [...(s.messages[sessionId] || []), {
                role: 'assistant' as const,
                content: '',
                tool_calls: [{ id: `tc-${Date.now()}`, name: evt.toolName ?? '', args: evt.args ?? '', result: undefined }],
              }],
            },
          }));
          break;
        case 'tool_result':
          set((s) => {
            const list = s.messages[sessionId] || [];
            const last = list[list.length - 1];
            if (last?.tool_calls?.length) {
              const tc = [...last.tool_calls];
              tc[tc.length - 1] = { ...tc[tc.length - 1], result: evt.result ?? evt.content ?? '' };
              return { messages: { ...s.messages, [sessionId]: [...list.slice(0, -1), { ...last, tool_calls: tc }] } };
            }
            return s;
          });
          break;
        case 'done':
          buf.dispose(); guard.dispose(); unsubscribe();
          set({ isStreaming: false });
          break;
        case 'error':
          buf.dispose(); guard.dispose(); unsubscribe();
          set({ isStreaming: false, interrupted: true });
          if (evt.error) reportError('chat', evt.error);
          break;
      }
    });
    try {
      await Chat.send(sessionId, text, model, thinking);
    } catch (e) {
      buf.dispose(); guard.dispose(); unsubscribe();
      set({ isStreaming: false, interrupted: true });
      reportError('chat', e);
    }
  },

  cancel: (sessionId) => {
    get().abort?.abort();
    Chat.cancel(sessionId);
    set({ isStreaming: false, interrupted: true });
  },

  resume: async (sessionId) => {
    if (!get().interrupted) return;
    const last = get().messages[sessionId]?.slice(-1)[0];
    if (!last || last.role !== 'user') return;
    await get().send(sessionId, last.content);
  },
});
