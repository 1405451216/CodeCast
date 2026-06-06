// frontend/src/v2/store/slices/projectSlice.ts
import type { StateCreator } from 'zustand';
import { Projects } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';
import type { Project } from '../../wails/types';

export interface ProjectSlice {
  projects: Project[];
  currentId: string | null;
  noProjectMode: boolean;
  loading: boolean;
  load: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  setNoProject: (b: boolean) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set) => ({
  projects: [], currentId: null, noProjectMode: false, loading: false,
  load: async () => {
    set({ loading: true });
    try {
      const projects = await Projects.list();
      set({ projects, currentId: projects[0]?.id ?? null, loading: false });
    } catch (e) { set({ loading: false }); reportError('project', e); }
  },
  switchProject: async (id) => {
    await Projects.switch(id);
    set({ currentId: id });
  },
  setNoProject: (b) => set({ noProjectMode: b }),
});
