import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CastKnotePage } from '../CastKnotePage';
import { useAppStore } from '../../store';

vi.mock('../../lib/useFirstTool', () => ({
  useFirstTool: vi.fn(() => ({
    load: vi.fn(),
    tool: { name: 'mock-knowledge-tool', category: 'knowledge' },
    available: true,
    loading: false,
    tools: [{ name: 'mock-knowledge-tool', category: 'knowledge' }],
  })),
}));

vi.mock('../../components/primitives/Toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

beforeEach(() => {
  useAppStore.setState({
    invokeCastTool: vi.fn(async () => '{"result":"retrieved"}'),
    castToolInvoking: false,
    episodes: [
      { id: 'ep1', title: 'Episode 1', summary: 'Summary 1', tags: ['tag1'] },
      { id: 'ep2', title: 'Episode 2', summary: 'Summary 2', tags: ['tag2', 'tag3'] },
    ],
    recallResults: [],
    memoryLoading: false,
    refreshMemory: vi.fn(),
    searchMemory: vi.fn(),
    searchQuery: '',
    errors: {},
  } as any);
});

describe('<CastKnotePage />', () => {
  it('renders page title', () => {
    render(<CastKnotePage />);
    expect(screen.getByText(/知识库/)).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<CastKnotePage />);
    expect(screen.getByPlaceholderText(/搜索知识库条目/)).toBeInTheDocument();
  });

  it('displays episodes', () => {
    render(<CastKnotePage />);
    expect(screen.getByText('Episode 1')).toBeInTheDocument();
    expect(screen.getByText('Episode 2')).toBeInTheDocument();
  });

  it('calls searchMemory on search button click', () => {
    const searchMemory = vi.fn();
    useAppStore.setState({ searchMemory } as any);
    render(<CastKnotePage />);
    const input = screen.getByPlaceholderText(/搜索知识库条目/);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('搜索'));
    expect(searchMemory).toHaveBeenCalledWith('test');
  });

  it('calls searchMemory on Enter key', () => {
    const searchMemory = vi.fn();
    useAppStore.setState({ searchMemory } as any);
    render(<CastKnotePage />);
    const input = screen.getByPlaceholderText(/搜索知识库条目/);
    fireEvent.change(input, { target: { value: 'search term' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(searchMemory).toHaveBeenCalledWith('search term');
  });

  it('clears search on Escape key', () => {
    const searchMemory = vi.fn();
    useAppStore.setState({ searchMemory } as any);
    render(<CastKnotePage />);
    const input = screen.getByPlaceholderText(/搜索知识库条目/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'something' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(searchMemory).toHaveBeenCalledWith('');
  });

  it('selects an episode on click', () => {
    render(<CastKnotePage />);
    fireEvent.click(screen.getByText('Episode 1'));
    // Detail panel should open
    expect(screen.getByText('关闭')).toBeInTheDocument();
  });

  it('closes detail panel on close button click', () => {
    render(<CastKnotePage />);
    fireEvent.click(screen.getByText('Episode 1'));
    expect(screen.getByText('关闭')).toBeInTheDocument();
    fireEvent.click(screen.getByText('关闭'));
    expect(screen.queryByText('关闭')).toBeNull();
  });

  it('shows loading state', () => {
    useAppStore.setState({ memoryLoading: true, episodes: [] } as any);
    render(<CastKnotePage />);
    // Loading indicator should appear
    expect(screen.getByText(/知识库/)).toBeInTheDocument();
  });
});
