import type { StateCreator } from 'zustand';
import type { Session } from '../../wails/types';
import { Sessions } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface SessionSlice {
  sessions: Session[];
  currentId: string | null;
  loading: boolean;
  loadSessions: () => Promise<void>;
  createSession: () => Promise<Session>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

export const createSessionSlice: StateCreator<SessionSlice, [], [], SessionSlice> = (set) => ({
  sessions: [],
  currentId: null,
  loading: false,

  loadSessions: async () => {
    set({ loading: true });
    try {
      const sessions = await Sessions.list();
      set({ sessions, loading: false, currentId: sessions[0]?.id ?? null });
    } catch (e) {
      set({ loading: false });
      reportError('session', e);
    }
  },

  createSession: async () => {
    const session = await Sessions.create();
    set((s) => ({ sessions: [session, ...s.sessions], currentId: session.id }));
    return session;
  },

  switchSession: async (id) => {
    await Sessions.switch(id);
    set({ currentId: id });
  },

  deleteSession: async (id) => {
    await Sessions.delete(id);
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
  },
});
