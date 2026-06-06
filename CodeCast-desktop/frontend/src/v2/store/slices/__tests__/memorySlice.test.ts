// frontend/src/v2/store/slices/__tests__/memorySlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('memorySlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetAPMetricsSnapshot).mockReset();
    useAppStore.setState({
      episodes: [], recallResults: [],
      stats: { totalEpisodes: 0, sizeBytes: 0 },
      memoryLoading: false, searchQuery: '', errors: {},
    });
  });

  it('searchMemory with no query returns all episodes', async () => {
    vi.mocked(App.GetAPMetricsSnapshot).mockResolvedValueOnce({
      episodes: [
        { title: 'Meeting notes', summary: 'Q2 planning' },
        { title: 'Code review', summary: 'Fix bug #42' },
      ],
      totalEpisodes: 2,
      memorySizeBytes: 1024,
    } as any);

    await useAppStore.getState().searchMemory('');
    const state = useAppStore.getState();
    expect(state.recallResults).toHaveLength(2);
    expect(state.stats.totalEpisodes).toBe(2);
  });

  it('searchMemory with query filters episodes client-side', async () => {
    vi.mocked(App.GetAPMetricsSnapshot).mockResolvedValueOnce({
      episodes: [
        { title: 'Meeting notes', summary: 'Q2 planning' },
        { title: 'Code review', summary: 'Fix bug #42' },
        { title: 'Design doc', summary: 'API redesign' },
      ],
      totalEpisodes: 3,
      memorySizeBytes: 2048,
    } as any);

    await useAppStore.getState().searchMemory('code');
    const state = useAppStore.getState();
    expect(state.episodes).toHaveLength(3);
    expect(state.recallResults).toHaveLength(1);
    expect(state.recallResults[0].title).toBe('Code review');
    expect(state.searchQuery).toBe('code');
  });

  it('searchMemory failure sets memory error', async () => {
    vi.mocked(App.GetAPMetricsSnapshot).mockRejectedValueOnce(new Error('mem-err'));
    await useAppStore.getState().searchMemory('test');
    expect(useAppStore.getState().errors.memory).toBe('mem-err');
  });

  it('refreshMemory re-applies current filter', async () => {
    vi.mocked(App.GetAPMetricsSnapshot)
      .mockResolvedValueOnce({
        episodes: [{ title: 'A', summary: 'hello' }, { title: 'B', summary: 'world' }],
        totalEpisodes: 2, memorySizeBytes: 512,
      } as any)
      .mockResolvedValueOnce({
        episodes: [{ title: 'A', summary: 'hello' }, { title: 'B', summary: 'world' }, { title: 'C', summary: 'hello world' }],
        totalEpisodes: 3, memorySizeBytes: 768,
      } as any);

    // First search with query
    await useAppStore.getState().searchMemory('hello');
    expect(useAppStore.getState().recallResults).toHaveLength(1);

    // Refresh should re-apply the 'hello' filter
    await useAppStore.getState().refreshMemory();
    expect(useAppStore.getState().recallResults).toHaveLength(2); // A and C match 'hello'
    expect(useAppStore.getState().stats.totalEpisodes).toBe(3);
  });

  it('refreshMemory with no query returns all episodes', async () => {
    vi.mocked(App.GetAPMetricsSnapshot).mockResolvedValueOnce({
      episodes: [{ title: 'X' }],
      totalEpisodes: 1, memorySizeBytes: 256,
    } as any);

    await useAppStore.getState().refreshMemory();
    expect(useAppStore.getState().recallResults).toHaveLength(1);
    expect(useAppStore.getState().searchQuery).toBe('');
  });
});
