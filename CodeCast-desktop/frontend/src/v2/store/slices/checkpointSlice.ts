// frontend/src/v2/store/slices/checkpointSlice.ts
//
// Tracks agent checkpoints exposed by the Go backend. Two layers:
//
//   1. `checkpoints` — full historical list for a session (loaded on demand).
//   2. `pending`     — the single checkpoint currently awaiting user approval.
//                       The chat thread renders an inline card for it.
//
// The backend exposes `GetCheckpoints / LoadCheckpoint / DeleteCheckpoint /
// ResolveCheckpoint` via the adapter. The slice does not poll — it relies
// on consumers calling `loadCheckpoints` after key transitions, and on
// the App-level event bridge (TODO in P1.4) to populate `pending` from
// a backend event when the agent pauses.

import type { StateCreator } from 'zustand';
import type { CheckpointInfo } from '../../wails/types';
import { Checkpoint } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';

/** A checkpoint awaiting user approval. Mirrors the backend
 * CheckpointInfo plus the source agent turn so the UI can render context. */
export interface PendingCheckpoint extends CheckpointInfo {
  /** Optional human-readable reason. Backend may include this in Status
   * (e.g. "tool:shell:needs-approval"). */
  reason?: string;
}

export interface CheckpointSlice {
  /** Historical checkpoints for the current session, newest first. */
  checkpoints: CheckpointInfo[];
  checkpointLoading: boolean;
  /** The single checkpoint awaiting approval, or null. */
  pending: PendingCheckpoint | null;

  loadCheckpoints: (sessionID: string, limit?: number) => Promise<void>;
  loadCheckpoint: (id: string) => Promise<void>;
  deleteCheckpoint: (id: string) => Promise<void>;
  resolve: (id: string, approved: boolean) => Promise<void>;
  setPending: (cp: PendingCheckpoint | null) => void;
}

export const createCheckpointSlice: StateCreator<CheckpointSlice, [], [], CheckpointSlice> = (set) => ({
  checkpoints: [],
  checkpointLoading: false,
  pending: null,

  loadCheckpoints: async (sessionID, limit = 50) => {
    set({ checkpointLoading: true });
    try {
      set({ checkpoints: await Checkpoint.list(sessionID, limit), checkpointLoading: false });
    } catch (e) {
      set({ checkpointLoading: false });
      reportError('checkpoint', e);
    }
  },

  loadCheckpoint: async (id) => {
    try {
      // Backend returns a CheckpointInfo on success; we don't keep a
      // separate "current" field — the chat thread reads `pending` and
      // the history list reads `checkpoints`. This call is here for
      // future "load details" UX.
      await Checkpoint.load(id);
    } catch (e) {
      reportError('checkpoint', e);
    }
  },

  deleteCheckpoint: async (id) => {
    try {
      await Checkpoint.remove(id);
      set((s) => ({
        checkpoints: s.checkpoints.filter((c) => c.ID !== id),
        pending: s.pending?.ID === id ? null : s.pending,
      }));
    } catch (e) {
      reportError('checkpoint', e);
    }
  },

  resolve: async (id, approved) => {
    try {
      await Checkpoint.resolve(id, approved);
      set((s) => ({
        pending: s.pending?.ID === id ? null : s.pending,
        // Reflect resolution in the cached list when we can match by id.
        checkpoints: s.checkpoints.map((c) =>
          c.ID === id ? { ...c, Status: approved ? 'approved' : 'denied' } : c,
        ),
      }));
    } catch (e) {
      reportError('checkpoint', e);
    }
  },

  setPending: (cp) => {
    set({ pending: cp });
  },
});
