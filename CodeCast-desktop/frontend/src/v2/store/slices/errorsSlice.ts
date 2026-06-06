// frontend/src/v2/store/slices/errorsSlice.ts
import type { StateCreator } from 'zustand';

export type SliceName =
  | 'session' | 'chat' | 'model' | 'project' | 'cast'
  | 'castTool' | 'memory' | 'mcp' | 'git' | 'settings'
  | 'notification' | 'workflow' | 'plugin'
  | 'updater' | 'orchestration' | 'agent' | 'cost';

export interface ErrorsSlice {
  errors: Partial<Record<SliceName, string>>;
  setError: (slice: SliceName, msg: string) => void;
  clearError: (slice: SliceName) => void;
}

export const createErrorsSlice: StateCreator<ErrorsSlice, [], [], ErrorsSlice> = (set) => ({
  errors: {},
  setError: (slice, msg) => set((s) => ({ errors: { ...s.errors, [slice]: msg } })),
  clearError: (slice) => set((s) => {
    if (!(slice in s.errors)) return s;
    const next = { ...s.errors };
    delete next[slice];
    return { errors: next };
  }),
});
