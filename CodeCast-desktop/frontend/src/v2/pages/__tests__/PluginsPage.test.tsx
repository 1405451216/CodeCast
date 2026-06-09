// frontend/src/v2/pages/__tests__/PluginsPage.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../store';
import { PluginsPage } from '../PluginsPage';

beforeEach(() => {
  vi.mocked(App.ListPlugins).mockReset();
  vi.mocked(App.GetPluginStatus).mockReset();
  vi.mocked(App.LoadPlugin).mockReset();
  vi.mocked(App.UnloadPlugin).mockReset();
  vi.mocked(App.SelectFolder).mockReset();
  // Default: ListPlugins returns [] (the bootstrap path)
  vi.mocked(App.ListPlugins).mockResolvedValue([]);
  vi.mocked(App.GetPluginStatus).mockResolvedValue({ loadedPlugins: 0, totalPlugins: 0, httpTransportRunning: false } as any);
  useAppStore.setState({
    plugins: [],
    pluginStatus: { loadedPlugins: 0, totalPlugins: 0, httpTransportRunning: false } as any,
    pluginLoading: false,
    errors: {},
  });
});

describe('<PluginsPage />', () => {
  it('renders empty state when no plugins loaded', async () => {
    render(<MemoryRouter><PluginsPage /></MemoryRouter>);
    // Wait for the bootstrap refreshPlugins() effect to resolve.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('暂无插件')).toBeInTheDocument();
  });

  it('lists loaded plugins with name + version + unload button', () => {
    useAppStore.setState({
      plugins: [
        { id: 'p1', name: 'Plugin One', version: '1.0.0' },
        { id: 'p2', name: 'Plugin Two' },
      ] as any,
    });
    render(<MemoryRouter><PluginsPage /></MemoryRouter>);
    expect(screen.getByText('Plugin One')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('Plugin Two')).toBeInTheDocument();
  });

  it('loads a plugin when "加载" is clicked with a path', async () => {
    vi.mocked(App.LoadPlugin).mockResolvedValueOnce({} as any);
    render(<MemoryRouter><PluginsPage /></MemoryRouter>);
    // Let the bootstrap refresh resolve so the button is not disabled.
    await new Promise((r) => setTimeout(r, 0));
    const input = screen.getByLabelText(/插件路径/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '/path/to/plugin' } });
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByText('加载'));
    await new Promise((r) => setTimeout(r, 0));
    expect(App.LoadPlugin).toHaveBeenCalledWith('/path/to/plugin');
  });

  it('unloads a plugin when its 卸载 button is clicked', async () => {
    useAppStore.setState({
      plugins: [{ id: 'p1', name: 'Plugin One', version: '1.0.0' }] as any,
    });
    vi.mocked(App.UnloadPlugin).mockResolvedValueOnce(undefined);
    render(<MemoryRouter><PluginsPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('卸载'));
    // ConfirmDialog 弹出后点击"卸载"确认
    fireEvent.click(screen.getAllByText('卸载')[1]);
    await new Promise((r) => setTimeout(r, 0));
    expect(App.UnloadPlugin).toHaveBeenCalledWith('p1');
  });

  it('"浏览" button calls Files.selectFolder and prefills the input', async () => {
    vi.mocked(App.SelectFolder).mockResolvedValueOnce('/chosen/path' as any);
    render(<MemoryRouter><PluginsPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('浏览'));
    await new Promise((r) => setTimeout(r, 0));
    expect(App.SelectFolder).toHaveBeenCalled();
    expect((screen.getByLabelText(/插件路径/) as HTMLInputElement).value).toBe('/chosen/path');
  });
});
