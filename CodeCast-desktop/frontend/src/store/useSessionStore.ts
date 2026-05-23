import { Session } from './types';
import type { SliceSet } from './storeTypes';

interface SessionSlice {
  sessions: Session[];
  currentSessionId: string | null;
  setSessions: (sessions: Session[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
}

const createSessionSlice = (set: SliceSet): SessionSlice => ({
  sessions: [],
  currentSessionId: null,
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  addSession: (session) =>
    set((state) => ({ sessions: [...(state.sessions as Session[]), session] })),
  removeSession: (id) =>
    set((state) => ({
      sessions: (state.sessions as Session[]).filter((s) => s.ID !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
    })),
});

export { type SessionSlice, createSessionSlice };
