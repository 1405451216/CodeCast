// frontend/src/v2/store/slices/__tests__/projectSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('projectSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetProjects).mockReset();
    vi.mocked(App.GetCurrentProject).mockReset();
    vi.mocked(App.SetCurrentProject).mockReset();
    vi.mocked(App.AddProject).mockReset();
    vi.mocked(App.SetNoProjectMode).mockReset();
    useAppStore.setState({ projects: [], currentProjectId: null, currentProject: null, noProjectMode: false, projectLoading: false, errors: {} });
  });

  it('loadProjects: fetches projects and current', async () => {
    vi.mocked(App.GetProjects).mockResolvedValueOnce([
      { id: 'p1', path: '/foo', name: 'Foo' },
      { id: 'p2', path: '/bar', name: 'Bar' },
    ] as any);
    vi.mocked(App.GetCurrentProject).mockResolvedValueOnce({ id: 'p1', path: '/foo', name: 'Foo' } as any);

    await useAppStore.getState().loadProjects();

    const state = useAppStore.getState();
    expect(state.projects).toHaveLength(2);
    expect(state.currentProjectId).toBe('p1');
    expect(state.currentProject?.id).toBe('p1');
  });

  it('loadProjects: failure sets project error', async () => {
    vi.mocked(App.GetProjects).mockRejectedValueOnce(new Error('proj-err'));
    vi.mocked(App.GetCurrentProject).mockResolvedValueOnce(null);

    await useAppStore.getState().loadProjects();
    expect(useAppStore.getState().errors.project).toBe('proj-err');
  });

  it('switchProject: calls SetCurrentProject and updates local state', () => {
    useAppStore.getState().switchProject('p2');
    expect(App.SetCurrentProject).toHaveBeenCalledWith('p2');
    expect(useAppStore.getState().currentProjectId).toBe('p2');
  });

  it('addProject: calls AddProject and appends to list', async () => {
    vi.mocked(App.AddProject).mockResolvedValueOnce({ id: 'p3', path: '/new', name: 'New' } as any);
    const result = await useAppStore.getState().addProject('/new');
    expect(App.AddProject).toHaveBeenCalledWith('/new');
    expect(result.id).toBe('p3');
    expect(useAppStore.getState().projects).toHaveLength(1);
  });

  it('setNoProject: calls SetNoProjectMode and updates state', async () => {
    await useAppStore.getState().setNoProject(true);
    expect(App.SetNoProjectMode).toHaveBeenCalledWith(true);
    expect(useAppStore.getState().noProjectMode).toBe(true);
  });
});
