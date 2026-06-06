// frontend/src/v2/store/slices/projectSlice.ts
import type { StateCreator } from 'zustand';
import { Projects } from '../../wails/adapter';
import { reportError } from '../../lib/reportError';
import type { Project } from '../../wails/types';

export interface ProjectSlice {
  projects: Project[];
  currentId: string | null;
  currentProject: Project | null;
  noProjectMode: boolean;
  loading: boolean;
  loadProjects: () => Promise<void>;
  switchProject: (id: string) => void;
  addProject: (path: string) => Promise<Project>;
  setNoProject: (b: boolean) => Promise<void>;
}

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set) => ({
  projects: [], currentId: null, currentProject: null, noProjectMode: false, loading: false,

  loadProjects: async () => {
    set({ loading: true });
    try {
      const [projects, current] = await Promise.all([Projects.list(), Projects.current()]);
      set({ projects, currentId: current?.id ?? projects[0]?.id ?? null, currentProject: current, loading: false });
    } catch (e) { set({ loading: false }); reportError('project', e); }
  },

  // Go SetCurrentProject 无返回值，纯前端 + adapter 调用
  switchProject: (id) => {
    Projects.switch(id);
    set({ currentId: id });
  },

  addProject: async (path) => {
    try {
      const project = await Projects.add(path);
      set((s) => ({ projects: [...s.projects, project] }));
      return project;
    } catch (e) {
      reportError('project', e);
      throw e;
    }
  },

  setNoProject: async (b) => {
    Projects.setNoProject(b);
    set({ noProjectMode: b });
  },
});
