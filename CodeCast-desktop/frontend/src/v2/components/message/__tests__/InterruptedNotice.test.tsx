import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InterruptedNotice } from '../InterruptedNotice';

describe('InterruptedNotice', () => {
  it('renders with resume button', () => {
    render(<InterruptedNotice onResume={vi.fn()} />);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('calls onResume when button clicked', () => {
    const onResume = vi.fn();
    render(<InterruptedNotice onResume={onResume} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('shows warning icon', () => {
    const { container } = render(<InterruptedNotice onResume={vi.fn()} />);
    expect(container.textContent).toContain('⚠');
  });
});
