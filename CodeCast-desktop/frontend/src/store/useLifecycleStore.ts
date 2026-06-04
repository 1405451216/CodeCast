import type { SliceSet } from './storeTypes';
import type { LifecycleState } from '../api/types';

export interface LifecycleSlice {
  globalState: LifecycleState;
  agentStates: Record<string, LifecycleState>;
  setGlobalState: (state: LifecycleState) => void;
  setAgentStates: (states: Record<string, LifecycleState>) => void;
  handleLifecycleEvent: (states: Record<string, string>) => void;
}

export const createLifecycleSlice = (set: SliceSet): LifecycleSlice => ({
  globalState: 'idle',
  agentStates: {},

  setGlobalState: (state) => set({ globalState: state }),
  setAgentStates: (states) => set({ agentStates: states }),

  handleLifecycleEvent: (states) =>
    set({
      agentStates: Object.fromEntries(
        Object.entries(states).map(([k, v]) => [k, v as LifecycleState])
      ),
    }),
});
