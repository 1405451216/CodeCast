import { Message } from './types';
import type { SliceSet } from './storeTypes';

interface MessagesSlice {
  messages: Message[];
  setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;
  addMessage: (msg: Message) => void;
  updateLastMessage: (updater: (msg: Message) => Message) => void;
  clearMessages: () => void;
}

const createMessagesSlice = (set: SliceSet): MessagesSlice => ({
  messages: [],
  setMessages: (msgs) =>
    set((state) => {
      const resolved = typeof msgs === 'function' ? msgs(state.messages as Message[]) : msgs;
      return {
        messages: resolved.map((m: Message) => ({ ...m, id: m.id || crypto.randomUUID() })),
      };
    }),
  addMessage: (msg) =>
    set((state) => ({
      messages: [...(state.messages as Message[]), { ...msg, id: msg.id || crypto.randomUUID() }],
    })),
  updateLastMessage: (updater) =>
    set((state) => {
      const messages = state.messages as Message[];
      const updated = [...messages];
      if (updated.length > 0) {
        updated[updated.length - 1] = updater(updated[updated.length - 1]);
      }
      return { messages: updated };
    }),
  clearMessages: () => set({ messages: [] }),
});

export { type MessagesSlice, createMessagesSlice };
