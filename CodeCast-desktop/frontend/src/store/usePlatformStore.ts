import type { SliceSet } from './storeTypes';

interface PlatformSlice {
  platform: 'windows' | 'darwin' | 'linux';
  setPlatform: (platform: 'windows' | 'darwin' | 'linux') => void;
}

const createPlatformSlice = (set: SliceSet): PlatformSlice => ({
  platform: 'windows',
  setPlatform: (platform) => set({ platform }),
});

export { type PlatformSlice, createPlatformSlice };
