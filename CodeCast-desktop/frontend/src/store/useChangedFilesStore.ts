import { ChangedFile } from './types';
import type { SliceSet } from './storeTypes';

interface ChangedFilesSlice {
  changedFiles: ChangedFile[];
  setChangedFiles: (files: ChangedFile[]) => void;
  contextCompression: number;
  setContextCompression: (value: number) => void;
}

const createChangedFilesSlice = (set: SliceSet): ChangedFilesSlice => ({
  changedFiles: [],
  setChangedFiles: (files) => set({ changedFiles: files }),
  contextCompression: 0,
  setContextCompression: (value) => set({ contextCompression: value }),
});

export { type ChangedFilesSlice, createChangedFilesSlice };
