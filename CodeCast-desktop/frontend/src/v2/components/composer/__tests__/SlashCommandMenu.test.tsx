import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlashCommandMenu } from '../SlashCommandMenu';

/* Mock the adapter */
vi.mock('../../../wails/adapter', () => ({
  SlashCommands: {
    list: vi.fn(async () => [
      { id: 'cmd1', name: 'help', description: 'Show help' },
      { id: 'cmd2', name: 'clear', description: 'Clear chat' },
      { id: 'cmd3', name: 'review', description: 'Code review' },
    ]),
  },
}));

vi.mock('../../../store', async () => {
  const actual = await vi.importActual<any>('../../../store');
  return { ...actual };
});

describe('<SlashCommandMenu />', () => {
  it('returns null when no commands match', async () => {
    const { container } = render(
      <SlashCommandMenu query="zzzzz" onSelect={vi.fn()} />,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('renders matching commands', async () => {
    render(<SlashCommandMenu query="" onSelect={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText('/help')).toBeInTheDocument();
    expect(screen.getByText('/clear')).toBeInTheDocument();
    expect(screen.getByText('/review')).toBeInTheDocument();
  });

  it('filters commands by query', async () => {
    render(<SlashCommandMenu query="cle" onSelect={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText('/clear')).toBeInTheDocument();
    expect(screen.queryByText('/help')).toBeNull();
    expect(screen.queryByText('/review')).toBeNull();
  });

  it('strips leading slash from query', async () => {
    render(<SlashCommandMenu query="/rev" onSelect={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText('/review')).toBeInTheDocument();
  });

  it('calls onSelect when a command is clicked', async () => {
    const onSelect = vi.fn();
    render(<SlashCommandMenu query="" onSelect={onSelect} />);
    await new Promise((r) => setTimeout(r, 30));
    fireEvent.click(screen.getByText('/help'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cmd1', label: '/help' }),
    );
  });

  it('renders role=listbox and role=option', async () => {
    render(<SlashCommandMenu query="" onSelect={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option').length).toBeGreaterThanOrEqual(1);
  });

  it('shows descriptions', async () => {
    render(<SlashCommandMenu query="" onSelect={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText('Show help')).toBeInTheDocument();
    expect(screen.getByText('Clear chat')).toBeInTheDocument();
  });
});
