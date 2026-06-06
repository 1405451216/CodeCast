// frontend/src/v2/store/slices/__tests__/sessionSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { useAppStore } from '../../index';

describe('sessionSlice', () => {
  beforeEach(() => {
    vi.mocked(App.GetSessions).mockReset();
    vi.mocked(App.CreateSession).mockReset();
    useAppStore.setState({ sessions: [], currentSessionId: null, sessionLoading: false, errors: {} });
  });

  it('loadSessions: success populates sessions + sets currentSessionId', async () => {
    vi.mocked(App.GetSessions).mockResolvedValueOnce([
      { id: 's1', title: 'S1', projectId: '', createdAt: 1, updatedAt: 1 },
    ] as any);
    await useAppStore.getState().loadSessions();
    expect(useAppStore.getState().sessions).toHaveLength(1);
    expect(useAppStore.getState().currentSessionId).toBe('s1');
  });

  it('loadSessions: failure sets session error and turns off sessionLoading', async () => {
    vi.mocked(App.GetSessions).mockRejectedValueOnce(new Error('net'));
    await useAppStore.getState().loadSessions();
    expect(useAppStore.getState().errors.session).toBe('net');
    expect(useAppStore.getState().sessionLoading).toBe(false);
  });

  it('createSession prepends and sets currentSessionId', async () => {
    vi.mocked(App.CreateSession).mockResolvedValueOnce({ id: 's2', title: 'S2', projectId: '', createdAt: 2, updatedAt: 2 } as any);
    const s = await useAppStore.getState().createSession();
    expect(s.id).toBe('s2');
    expect(useAppStore.getState().currentSessionId).toBe('s2');
  });

  it('switchSession sets currentSessionId', async () => {
    useAppStore.setState({ sessions: [{ id: 'a', title: '', projectId: '', createdAt: 0, updatedAt: 0 }, { id: 'b', title: '', projectId: '', createdAt: 0, updatedAt: 0 }] });
    await useAppStore.getState().switchSession('b');
    expect(useAppStore.getState().currentSessionId).toBe('b');
  });

  it('deleteSession removes from list', async () => {
    useAppStore.setState({ sessions: [{ id: 'a', title: '', projectId: '', createdAt: 0, updatedAt: 0 }, { id: 'b', title: '', projectId: '', createdAt: 0, updatedAt: 0 }], currentSessionId: 'a' });
    await useAppStore.getState().deleteSession('a');
    expect(useAppStore.getState().sessions).toHaveLength(1);
  });
});
