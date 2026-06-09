import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallItem } from '../ToolCallItem';

const mockCall = {
  id: 'tc-1',
  name: 'read_file',
  args: '{"path":"/src/app.ts"}',
  result: 'file content here',
  status: 'done' as const,
  durationMs: 150,
};

describe('ToolCallItem', () => {
  it('renders tool name', () => {
    render(<ToolCallItem call={mockCall} />);
    expect(screen.getByText(/read_file/)).toBeDefined();
  });

  it('renders duration', () => {
    render(<ToolCallItem call={mockCall} />);
    expect(screen.getByText(/150/)).toBeDefined();
  });

  it('expands on click to show details', () => {
    render(<ToolCallItem call={mockCall} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    // After expand, should show args or result
    expect(screen.getByText(/"\/src\/app\.ts"/)).toBeDefined();
  });

  it('handles running status', () => {
    const runningCall = { ...mockCall, status: 'running' as const, result: undefined };
    render(<ToolCallItem call={runningCall} />);
    expect(screen.getByText(/read_file/)).toBeDefined();
  });

  it('handles error status', () => {
    const errorCall = { ...mockCall, status: 'error' as const, result: 'Error: access denied' };
    render(<ToolCallItem call={errorCall} />);
    expect(screen.getByText(/read_file/)).toBeDefined();
  });
});
