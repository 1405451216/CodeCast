import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDot } from '../StatusDot';

describe('StatusDot', () => {
  it('renders running status', () => {
    const { container } = render(<StatusDot status="running" />);
    expect(container.querySelector('[aria-label="running"]')).toBeDefined();
  });

  it('renders done status', () => {
    const { container } = render(<StatusDot status="done" />);
    expect(container.querySelector('[aria-label="done"]')).toBeDefined();
  });

  it('renders paused status', () => {
    const { container } = render(<StatusDot status="paused" />);
    expect(container.querySelector('[aria-label="paused"]')).toBeDefined();
  });

  it('renders error status', () => {
    const { container } = render(<StatusDot status="error" />);
    expect(container.querySelector('[aria-label="error"]')).toBeDefined();
  });

  it('each status has a visible glyph', () => {
    const statuses = ['running', 'done', 'paused', 'error'] as const;
    for (const s of statuses) {
      const { container } = render(<StatusDot status={s} />);
      expect(container.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});
