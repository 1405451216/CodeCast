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
    const resetReasoning = () => { reasoningBuf = ''; };
    guard.start();
    // Wire the Wails stream subscription to an AbortController so that
    // `cancel()` can tear it down deterministically. Aborting the controller
    // runs the cleanup closure that disposes the stream buffer / guard and
    // unsubscribes from Wails events in one place.
    const controller = new AbortController();
    controller.signal.addEventListener('abort', resetReasoning);
    const unsubscribe = onStreamChunk(sessionId, (evt) => {
      if (controller.signal.aborted) return;
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
          controller.abort();
          set({ isStreaming: false });
          break;
        case 'error':
          controller.abort();
          set({ isStreaming: false, interrupted: true });
          if (evt.error) reportError('chat', evt.error);
          break;
      }
    });
    // Tie cleanup to abort so cancel() and 'done' / 'error' paths share it.
    controller.signal.addEventListener('abort', () => {
      buf.dispose();
      guard.dispose();
      unsubscribe();
    });
    set({ abort: controller });
    try {
      await Chat.send(sessionId, text, model, thinking);
    } catch (e) {
      controller.abort();
      set({ isStreaming: false, interrupted: true });
      reportError('chat', e);
    }
  },

  cancel: (sessionId) => {
    // Aborting the controller runs the cleanup listener: disposes the
    // stream buffer/guard and tears down the Wails subscription. After
    // cleanup we null the field so subsequent sends start fresh.
    get().abort?.abort();
    set({ abort: null, isStreaming: false, interrupted: true });
    // Best-effort: ask the backend to stop the in-flight request too.
    // We don't await — the local abort already gives the UI immediate
    // feedback, and the backend typically finishes quickly.
    try {
      void Chat.cancel(sessionId);
    } catch (e) {
      reportError('chat', e);
    }
  },

  resume: async (sessionId) => {
    if (!get().interrupted) return;
    const msgs = get().messages[sessionId] || [];
    // Find the last user message (assistant may have a partial response after interrupt)
    let lastUser: Message | undefined;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUser = msgs[i];
        break;
      }
    }
    if (!lastUser) return;
    await get().send(sessionId, lastUser.content);
  },
});
