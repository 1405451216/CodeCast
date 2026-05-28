import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../index';
import type { Project, ChangedFile } from '../types';

describe('Project Store', () => {
  beforeEach(() => {
    useAppStore.setState({
      projects: [],
      currentProject: null,
      changedFiles: []
    });
  });

  it('should set projects', () => {
    const project: Project = {
      id: 'proj-1',
      name: 'Test Project',
      path: '/path/to/project'
    };

    useAppStore.getState().setProjects([project]);

    expect(useAppStore.getState().projects).toHaveLength(1);
    expect(useAppStore.getState().projects[0]).toEqual(project);
  });

  it('should set current project', () => {
    useAppStore.getState().setCurrentProject('proj-123');

    expect(useAppStore.getState().currentProject).toBe('proj-123');
  });

  it('should clear current project', () => {
    useAppStore.setState({ currentProject: 'proj-1' });
    useAppStore.getState().setCurrentProject(null);

    expect(useAppStore.getState().currentProject).toBeNull();
  });

  it('should set no project mode', () => {
    useAppStore.getState().setNoProjectMode(true);

    expect(useAppStore.getState().noProjectMode).toBe(true);
    expect(useAppStore.getState().currentProject).toBeNull();
  });

  it('should track changed files', () => {
    const file: ChangedFile = {
      name: 'test.ts',
      status: 'modified'
    };

    useAppStore.getState().setChangedFiles([file]);

    expect(useAppStore.getState().changedFiles).toHaveLength(1);
  });

  it('should clear changed files', () => {
    const files: ChangedFile[] = [
      { name: 'file1.ts', status: 'modified' },
      { name: 'file2.tsx', status: 'added' }
    ];

    useAppStore.setState({ changedFiles: files });
    useAppStore.getState().setChangedFiles([]);

    expect(useAppStore.getState().changedFiles).toHaveLength(0);
  });
});

describe('Plugin Store', () => {
  beforeEach(() => {
    useAppStore.setState({
      loadedPlugins: [],
      selectedPluginId: null
    });
  });

  it('should load plugins', async () => {
    const { LoadedPlugin } = await import('../../plugins/PluginTypes');
    
    const plugins: LoadedPlugin[] = [
      { manifest: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0', entry: '' }, status: 'active', instance: null },
      { manifest: { id: 'plugin-2', name: 'Plugin 2', version: '1.0.0', entry: '' }, status: 'inactive', instance: null }
    ];

    useAppStore.getState().setLoadedPlugins(plugins);

    expect(useAppStore.getState().loadedPlugins).toHaveLength(2);
  });

  it('should add loaded plugin', async () => {
    const { LoadedPlugin } = await import('../../plugins/PluginTypes');
    
    const plugin: LoadedPlugin = {
      manifest: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0', entry: '' },
      status: 'active',
      instance: null
    };

    useAppStore.getState().addLoadedPlugin(plugin);

    expect(useAppStore.getState().loadedPlugins).toHaveLength(1);
  });

  it('should remove loaded plugin', async () => {
    const { LoadedPlugin } = await import('../../plugins/PluginTypes');
    
    const plugin: LoadedPlugin = {
      manifest: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0', entry: '' },
      status: 'active',
      instance: null
    };

    useAppStore.setState({ loadedPlugins: [plugin] });
    useAppStore.getState().removeLoadedPlugin('plugin-1');

    expect(useAppStore.getState().loadedPlugins).toHaveLength(0);
  });

  it('should set selected plugin ID', () => {
    useAppStore.getState().setSelectedPluginId('plugin-1');

    expect(useAppStore.getState().selectedPluginId).toBe('plugin-1');
  });

  it('should track enabled plugins', () => {
    useAppStore.getState().setEnabledPlugins(['plugin-1', 'plugin-2']);

    expect(useAppStore.getState().enabledPlugins).toEqual(['plugin-1', 'plugin-2']);
  });
});

describe('Slash Commands Store', () => {
  beforeEach(() => {
    useAppStore.setState({
      slashCommands: []
    });
  });

  it('should load slash commands', () => {
    const commands = [
      {
        id: 'cmd-1',
        name: '/help',
        description: 'Show help',
        fill_text: 'Help me with'
      }
    ];

    useAppStore.getState().setSlashCommands(commands);

    expect(useAppStore.getState().slashCommands).toHaveLength(1);
  });

  it('should find command by filtering', () => {
    const commands = [
      { id: 'cmd-1', name: '/help', description: 'Show help', fill_text: '' },
      { id: 'cmd-2', name: '/clear', description: 'Clear chat', fill_text: '' }
    ];

    useAppStore.setState({ slashCommands: commands });
    const found = useAppStore.getState().slashCommands.find(cmd => cmd.name === '/help');

    expect(found).toBeDefined();
    expect(found?.name).toBe('/help');
  });
});

describe('Performance Store', () => {
  it('should add performance snapshot', () => {
    useAppStore.getState().addPerformanceSnapshot({
      timestamp: Date.now(),
      fps: 60,
      memoryUsage: 45,
      renderTime: 16.7
    });

    expect(useAppStore.getState().performanceHistory).toHaveLength(1);
    expect(useAppStore.getState().performanceHistory[0].fps).toBe(60);
  });

  it('should clear performance history', () => {
    useAppStore.setState({
      performanceHistory: [
        { timestamp: Date.now(), fps: 60, memoryUsage: 50, renderTime: 16 },
        { timestamp: Date.now(), fps: 55, memoryUsage: 52, renderTime: 18 }
      ]
    });

    useAppStore.getState().clearPerformanceHistory();

    expect(useAppStore.getState().performanceHistory).toHaveLength(0);
  });

  it('should set performance mode', () => {
    useAppStore.getState().setPerformanceMode('performance');

    expect(useAppStore.getState().performanceMode).toBe('performance');
  });

  it('should toggle virtual scroll', () => {
    const initial = useAppStore.getState().virtualScrollEnabled;
    useAppStore.getState().toggleVirtualScroll();

    expect(useAppStore.getState().virtualScrollEnabled).toBe(!initial);
  });
});

describe('Menu Store', () => {
  it('should open and close menus', () => {
    useAppStore.getState().setActiveMenu('file');

    expect(useAppStore.getState().activeMenu).toBe('file');

    useAppStore.getState().closeMenus();

    expect(useAppStore.getState().activeMenu).toBeNull();
  });
});

describe('Platform Store', () => {
  it('should detect platform', () => {
    const platform = useAppStore.getState().platform;

    expect(['windows', 'darwin', 'linux']).toContain(platform);
  });

  it('should have platform setter', () => {
    useAppStore.getState().setPlatform('windows');

    expect(useAppStore.getState().platform).toBe('windows');
  });
});
