// frontend/src/v2/lib/__tests__/useFirstTool.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../store';
import { useFirstTool } from '../useFirstTool';

describe('useFirstTool', () => {
  beforeEach(() => {
    vi.mocked(App.GetToolCatalog).mockReset();
    useAppStore.setState({
      castTools: [],
      castToolByCategory: {},
      castToolLoading: false,
      errors: {},
    });
  });

  it('returns available=false when category has no tools', () => {
    useAppStore.setState({
      castToolByCategory: { writing: [{ name: 'a', category: 'writing', description: '' }] },
    });
    const { result } = renderHook(() => useFirstTool('translation'));
    expect(result.current.available).toBe(false);
    expect(result.current.tool).toBeNull();
    expect(result.current.tools).toEqual([]);
  });

  it('returns first tool when category is present', () => {
    useAppStore.setState({
      castToolByCategory: {
        writing: [
          { name: 'first', category: 'writing', description: 'one' },
          { name: 'second', category: 'writing', description: 'two' },
        ],
      },
    });
    const { result } = renderHook(() => useFirstTool('writing'));
    expect(result.current.available).toBe(true);
    expect(result.current.tool?.name).toBe('first');
    expect(result.current.tools).toHaveLength(2);
  });

  it('reflects catalog loading state', async () => {
    vi.mocked(App.GetToolCatalog).mockResolvedValueOnce([
      { name: 'x', category: 'email', description: '' },
    ] as any);
    const { result } = renderHook(() => useFirstTool('email'));
    const before = result.current;
    expect(before.loading).toBe(false);
    expect(before.available).toBe(false);

    await result.current.load();

    const after = result.current;
    expect(after.available).toBe(true);
    expect(after.tool?.name).toBe('x');
  });
});
