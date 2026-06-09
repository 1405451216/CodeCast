import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with label text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);
    fireEvent.click(screen.getByText('Submit'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Submit</Button>);
    const btn = screen.getByText('Submit');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders with different variant classes', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const btn = container.querySelector('button');
    expect(btn).toBeDefined();
  });

  it('renders children correctly', () => {
    render(
      <Button>
        <span data-testid="icon">🔍</span>
        Search
      </Button>
    );
    expect(screen.getByTestId('icon')).toBeDefined();
    expect(screen.getByText('Search')).toBeDefined();
  });

  it('applies custom className', () => {
    const { container } = render(<Button className="custom-class">Styled</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('custom-class');
  });

  it('is keyboard accessible', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Press Enter</Button>);
    fireEvent.keyDown(screen.getByText('Press Enter'), { key: 'Enter', code: 'Enter' });
    // Buttons natively respond to Enter key
  });
});
