import type { StateCreator } from 'zustand';
import type { Session } from '../../wails/types';
import { Sessions } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

export interface SessionSlice {
  sessions: Session[];
  currentId: string | null;
  loading: boolean;
  loadSessions: () => Promise<void>;
  createSession: (name: string, skillID?: string, mode?: string) => Promise<Session>;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  searchSessions: (keyword: string) => Promise<Session[]>;
  renameSession: (id: string, newName: string) => Promise<void>;
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

  createSession: async (name, skillID = '', mode = '') => {
    try {
      const session = await Sessions.create(name, skillID, mode);
      set((s) => ({ sessions: [session, ...s.sessions], currentId: session.id }));
      return session;
    } catch (e) {
      reportError('session', e);
      throw e;
    }
  },

  // Go 没有 SwitchSession 方法，前端自行管理 currentId
  switchSession: (id) => {
    set({ currentId: id });
  },

  deleteSession: async (id) => {
    try {
      await Sessions.delete(id);
      set((s) => {
        const sessions = s.sessions.filter((x) => x.id !== id);
        const currentId = s.currentId === id ? (sessions[0]?.id ?? null) : s.currentId;
        return { sessions, currentId };
      });
    } catch (e) {
      reportError('session', e);
    }
  },

  searchSessions: async (keyword) => {
    try {
      return await Sessions.search(keyword);
    } catch (e) {
      reportError('session', e);
      return [];
    }
  },

  renameSession: async (id, newName) => {
    try {
      await Sessions.rename(id, newName);
      set((s) => ({
        sessions: s.sessions.map((x) => x.id === id ? { ...x, name: newName } : x),
      }));
    } catch (e) {
      reportError('session', e);
    }
  },
});
