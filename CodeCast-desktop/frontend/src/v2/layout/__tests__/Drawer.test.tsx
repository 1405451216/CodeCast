import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from '../Drawer';
import { useAppStore } from '../../store';

/* Mock child panels */
vi.mock('../../components/drawer/FileTree', () => ({
  FileTree: () => <div data-testid="file-tree">FileTree</div>,
}));
vi.mock('../../components/drawer/GitPanel', () => ({
  GitPanel: () => <div data-testid="git-panel">GitPanel</div>,
}));
vi.mock('../../components/drawer/MCPPanel', () => ({
  MCPPanel: () => <div data-testid="mcp-panel">MCPPanel</div>,
}));
vi.mock('../../components/drawer/MemoryPanel', () => ({
  MemoryPanel: () => <div data-testid="memory-panel">MemoryPanel</div>,
}));
vi.mock('../../components/drawer/DrawerTabs', () => ({
  DrawerTabs: ({ active, onChange }: { active: string; onChange: (id: string) => void }) => (
    <div data-testid="drawer-tabs">
      <span data-testid="active-tab">{active}</span>
      <button onClick={() => onChange('files')}>files</button>
      <button onClick={() => onChange('git')}>git</button>
      <button onClick={() => onChange('mcp')}>mcp</button>
      <button onClick={() => onChange('memory')}>memory</button>
    </div>
  ),
}));

vi.mock('../../components/primitives/Toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

beforeEach(() => {
  useAppStore.setState({ errors: {} } as any);
});

describe('<Drawer />', () => {
  it('renders with default files tab', () => {
    render(<Drawer />);
    expect(screen.getByTestId('drawer-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('file-tree')).toBeInTheDocument();
  });

  it('switches to git panel', () => {
    render(<Drawer />);
    fireEvent.click(screen.getByText('git'));
    expect(screen.getByTestId('git-panel')).toBeInTheDocument();
  });

  it('switches to mcp panel', () => {
    render(<Drawer />);
    fireEvent.click(screen.getByText('mcp'));
    expect(screen.getByTestId('mcp-panel')).toBeInTheDocument();
  });

  it('switches to memory panel', () => {
    render(<Drawer />);
    fireEvent.click(screen.getByText('memory'));
    expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
  });

  it('updates active tab indicator', () => {
    render(<Drawer />);
    fireEvent.click(screen.getByText('git'));
    expect(screen.getByTestId('active-tab').textContent).toBe('git');
  });
});
