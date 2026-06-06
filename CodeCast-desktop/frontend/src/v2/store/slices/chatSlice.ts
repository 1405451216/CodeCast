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
  send: (sessionId: string, text: string, model?: string) => Promise<void>;
  cancel: (sessionId: string) => void;
  resume: (sessionId: string) => Promise<void>;
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set, get) => ({
  messages: {},
  isStreaming: false,
  interrupted: false,
  abort: null,

  send: async (sessionId, text, model) => {
    set({ isStreaming: true, interrupted: false });
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: [...(s.messages[sessionId] || []), { id: `u-${Date.now()}`, role: 'user' as const, content: text }],
      },
    }));
    const buf = createStreamBuffer({ flushSize: 1, flushIntervalMs: 200 });
    const guard = createStreamGuard({
      timeoutMs: 60_000,
      onTimeout: () => { set({ isStreaming: false, interrupted: true }); buf.dispose(); guard.dispose(); },
    });
    buf.onFlush = (chunk) => {
      set((s) => {
        const list = s.messages[sessionId] || [];
        const last = list[list.length - 1];
        if (last?.role === 'assistant') {
          return { messages: { ...s.messages, [sessionId]: [...list.slice(0, -1), { ...last, content: (last.content || '') + chunk }] } };
        }
        return { messages: { ...s.messages, [sessionId]: [...list, { id: `a-${Date.now()}`, role: 'assistant' as const, content: chunk }] } };
      });
      guard.reset();
    };
    guard.start();
    const unsubscribe = onStreamChunk(sessionId, (evt) => {
      if (evt.type === 'content' && evt.content) buf.push(evt.content);
      if (evt.type === 'done')  { buf.dispose(); guard.dispose(); unsubscribe(); set({ isStreaming: false }); }
      if (evt.type === 'error') { buf.dispose(); guard.dispose(); unsubscribe(); set({ isStreaming: false, interrupted: true }); }
    });
    try {
      await Chat.send(sessionId, text, model);
    } catch (e) {
      buf.dispose(); guard.dispose(); unsubscribe();
      set({ isStreaming: false, interrupted: true });
      reportError('chat', e);
      // 不 throw — 由 UI 决定呈现
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
