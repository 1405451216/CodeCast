import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrawerTabs } from '../DrawerTabs';

describe('DrawerTabs', () => {
  it('renders all 4 tabs', () => {
    render(<DrawerTabs active="files" onChange={vi.fn()} />);
    expect(screen.getByText(/Files|文件/)).toBeDefined();
    expect(screen.getByText(/Git/)).toBeDefined();
    expect(screen.getByText(/MCP/)).toBeDefined();
    expect(screen.getByText(/Memory|记忆/)).toBeDefined();
  });

  it('calls onChange when tab clicked', () => {
    const onChange = vi.fn();
    render(<DrawerTabs active="files" onChange={onChange} />);
    fireEvent.click(screen.getByText('Git'));
    expect(onChange).toHaveBeenCalledWith('git');
  });

  it('highlights active tab', () => {
    render(<DrawerTabs active="mcp" onChange={vi.fn()} />);
    const mcpTab = screen.getByText('MCP');
    expect(mcpTab).toBeDefined();
  });

  it('all tabs are clickable', () => {
    const onChange = vi.fn();
    render(<DrawerTabs active="files" onChange={onChange} />);
    fireEvent.click(screen.getByText(/Memory|记忆/));
    expect(onChange).toHaveBeenCalledWith('memory');
    fireEvent.click(screen.getByText('MCP'));
    expect(onChange).toHaveBeenCalledWith('mcp');
  });
});
