import { Project } from './types';
import type { SliceSet } from './storeTypes';

interface ProjectSlice {
  projects: Project[];
  currentProject: string | null;
  noProjectMode: boolean;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (id: string | null) => void;
  setNoProjectMode: (enabled: boolean) => void;
}

const createProjectSlice = (set: SliceSet): ProjectSlice => ({
  projects: [],
  currentProject: null,
  noProjectMode: false,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (id) => set({ currentProject: id, noProjectMode: id === null }),
  setNoProjectMode: (enabled) =>
    enabled
      ? set({ noProjectMode: true, currentProject: null })
      : set({ noProjectMode: false }),
});

export { type ProjectSlice, createProjectSlice };
