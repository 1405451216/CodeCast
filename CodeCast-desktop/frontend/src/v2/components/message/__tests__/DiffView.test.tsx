import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from '../DiffView';

describe('DiffView', () => {
  it('export exists', async () => {
    const mod = await import('../DiffView');
    expect(mod.DiffView).toBeDefined();
  });

  describe('parseUnifiedDiff', () => {
    it('parses additions', () => {
      const result = parseUnifiedDiff('+added line');
      expect(result[0].kind).toBe('add');
      expect(result[0].text).toContain('added line');
    });

    it('parses removals', () => {
      const result = parseUnifiedDiff('-removed line');
      expect(result[0].kind).toBe('remove');
      expect(result[0].text).toContain('removed line');
    });

    it('parses context lines', () => {
      const result = parseUnifiedDiff(' unchanged');
      expect(result[0].kind).toBe('context');
      expect(result[0].text).toContain('unchanged');
    });

    it('parses multi-line diff', () => {
      const diff = '-old\n+new\n unchanged';
      const result = parseUnifiedDiff(diff);
      expect(result).toHaveLength(3);
      expect(result[0].kind).toBe('remove');
      expect(result[1].kind).toBe('add');
      expect(result[2].kind).toBe('context');
    });

    it('handles empty input', () => {
      const result = parseUnifiedDiff('');
      // Empty string splits to [''] by \n, and '' does NOT start with + or -, so it's context
      expect(result[0].kind).toBe('context');
    });
  });

  it('renders diff lines', async () => {
    const { render } = await import('@testing-library/react');
    const { DiffView } = await import('../DiffView');
    const { container } = render(<DiffView diff="+added\n-removed" />);
    expect(container.textContent).toContain('+added');
    expect(container.textContent).toContain('-removed');
  });
});
