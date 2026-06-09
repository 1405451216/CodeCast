import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeBlock } from '../CodeBlock';

describe('CodeBlock', () => {
  it('renders code content', () => {
    render(<CodeBlock code="echo hello" />);
    expect(screen.getByText(/echo hello/)).toBeDefined();
  });

  it('renders with language label', () => {
    const { container } = render(<CodeBlock code="const x = 1;" language="typescript" />);
    expect(container.textContent).toContain('const x = 1');
  });

  it('renders without language prop', () => {
    render(<CodeBlock code="test" />);
    expect(screen.getByText('test')).toBeDefined();
  });
});
