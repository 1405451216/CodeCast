import { AvailableModel, DEFAULT_MODEL } from './types';
import type { SliceSet } from './storeTypes';

interface ModelSlice {
  selectedModel: AvailableModel;
  setSelectedModel: (model: AvailableModel) => void;
  thinkingMode: boolean;
  toggleThinkingMode: () => void;
}

const createModelSlice = (set: SliceSet): ModelSlice => ({
  selectedModel: DEFAULT_MODEL,
  setSelectedModel: (model) => set({ selectedModel: model }),
  thinkingMode: false,
  toggleThinkingMode: () => set((state) => ({ thinkingMode: !state.thinkingMode })),
});

export { type ModelSlice, createModelSlice };
