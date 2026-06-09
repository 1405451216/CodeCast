import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kbd } from '../Kbd';

describe('Kbd', () => {
  it('renders a kbd element', () => {
    render(<Kbd>Ctrl+S</Kbd>);
    const el = screen.getByText('Ctrl+S');
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe('KBD');
  });

  it('renders with correct text content', () => {
    render(<Kbd>⌘+K</Kbd>);
    expect(screen.getByText('⌘+K')).toBeInTheDocument();
  });

  it('applies monospace font style', () => {
    render(<Kbd>Enter</Kbd>);
    const el = screen.getByText('Enter');
    expect(el.style.fontFamily).toContain('mono');
  });
});
