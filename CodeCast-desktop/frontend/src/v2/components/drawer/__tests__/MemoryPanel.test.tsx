import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryPanel } from '../MemoryPanel';
import { useAppStore } from '../../../store';

vi.mock('../../../lib/useError', () => ({
  useError: vi.fn(() => undefined),
}));

beforeEach(() => {
  useAppStore.setState({
    stats: { totalEpisodes: 42, sizeBytes: 2048 },
    memoryLoading: false,
    recallResults: [{ id: '1' }, { id: '2' }],
    searchQuery: '',
    refreshMemory: vi.fn(),
    searchMemory: vi.fn(),
    errors: {},
  } as any);
});

describe('<MemoryPanel />', () => {
  it('renders header and stats', () => {
    render(<MemoryPanel />);
    expect(screen.getByText(/Memory/)).toBeInTheDocument();
    expect(screen.getByText('Episodes: 42')).toBeInTheDocument();
    expect(screen.getByText('Size: 2.0 KB')).toBeInTheDocument();
  });

  it('formats bytes correctly for small values', () => {
    useAppStore.setState({ stats: { totalEpisodes: 0, sizeBytes: 512 } } as any);
    render(<MemoryPanel />);
    expect(screen.getByText('Size: 512 B')).toBeInTheDocument();
  });

  it('formats bytes correctly for MB values', () => {
    useAppStore.setState({ stats: { totalEpisodes: 0, sizeBytes: 5 * 1024 * 1024 } } as any);
    render(<MemoryPanel />);
    expect(screen.getByText('Size: 5.0 MB')).toBeInTheDocument();
  });

  it('shows loading indicator', () => {
    useAppStore.setState({ memoryLoading: true } as any);
    render(<MemoryPanel />);
    expect(screen.getByText(/loading…/)).toBeInTheDocument();
  });

  it('calls searchMemory on search button click', () => {
    const searchMemory = vi.fn();
    useAppStore.setState({ searchMemory } as any);
    render(<MemoryPanel />);
    const input = screen.getByPlaceholderText('搜索 memory…');
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.click(screen.getByText('搜索'));
    expect(searchMemory).toHaveBeenCalledWith('test query');
  });

  it('calls searchMemory on Enter key', () => {
    const searchMemory = vi.fn();
    useAppStore.setState({ searchMemory } as any);
    render(<MemoryPanel />);
    const input = screen.getByPlaceholderText('搜索 memory…');
    fireEvent.change(input, { target: { value: 'enter search' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(searchMemory).toHaveBeenCalledWith('enter search');
  });

  it('clears search on Escape key', () => {
    const searchMemory = vi.fn();
    useAppStore.setState({ searchMemory } as any);
    render(<MemoryPanel />);
    const input = screen.getByPlaceholderText('搜索 memory…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'something' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(searchMemory).toHaveBeenCalledWith('');
  });

  it('shows search results summary when searchQuery is set', () => {
    useAppStore.setState({
      searchQuery: 'active',
      recallResults: [{ id: '1' }],
    } as any);
    render(<MemoryPanel />);
    expect(screen.getByText(/匹配 1 \/ 42 条/)).toBeInTheDocument();
  });

  it('shows clear button when searchQuery is set', () => {
    useAppStore.setState({ searchQuery: 'active' } as any);
    render(<MemoryPanel />);
    const clearBtn = screen.getByTitle('清除搜索');
    expect(clearBtn).toBeInTheDocument();
  });

  it('calls refreshMemory on Refresh click', () => {
    const refreshMemory = vi.fn();
    useAppStore.setState({ refreshMemory } as any);
    render(<MemoryPanel />);
    fireEvent.click(screen.getByText('Refresh'));
    expect(refreshMemory).toHaveBeenCalled();
  });
});
