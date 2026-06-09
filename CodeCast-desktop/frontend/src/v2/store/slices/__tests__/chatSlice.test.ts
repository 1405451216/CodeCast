// frontend/src/v2/store/slices/__tests__/chatSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as App from '@wailsjs/go/main/App';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import { useAppStore } from '../../index';

describe('chatSlice', () => {
  beforeEach(() => {
    vi.mocked(App.SendMessageEx).mockReset();
    vi.mocked(App.CancelSessionRequest).mockReset();
    vi.mocked(EventsOn).mockReset();
    vi.mocked(EventsOff).mockReset();
    useAppStore.setState({ messages: {}, isStreaming: false, interrupted: false, abort: null, errors: {} });
  });

  it('send: failure sets chat error, does NOT throw', async () => {
    vi.mocked(App.SendMessageEx).mockRejectedValueOnce(new Error('fail'));
    await expect(useAppStore.getState().send('s1', 'hi')).resolves.toBeUndefined();
    expect(useAppStore.getState().errors.chat).toBe('fail');
    expect(useAppStore.getState().isStreaming).toBe(false);
  });

  it('resume: no-op when not interrupted', async () => {
    await useAppStore.getState().resume('s1');
    expect(App.SendMessageEx).not.toHaveBeenCalled();
  });

  it('resume: no-op when last message is assistant', async () => {
    useAppStore.setState({
      interrupted: true,
      messages: { s1: [{ role: 'assistant', content: 'partial' }] },
    });
    await useAppStore.getState().resume('s1');
    expect(App.SendMessageEx).not.toHaveBeenCalled();
  });

  it('resume: re-sends when interrupted + last is user', async () => {
    useAppStore.setState({
      interrupted: true,
      messages: { s1: [{ role: 'user', content: 'help' }] },
    });
    vi.mocked(App.SendMessageEx).mockResolvedValueOnce([]);
    await useAppStore.getState().resume('s1');
    expect(App.SendMessageEx).toHaveBeenCalledWith('s1', 'help', '', '');
  });

  it('cancel: marks interrupted, calls Chat.cancel', async () => {
    useAppStore.setState({ isStreaming: true });
    useAppStore.getState().cancel('s1');
    expect(useAppStore.getState().isStreaming).toBe(false);
    expect(useAppStore.getState().interrupted).toBe(true);
    expect(App.CancelSessionRequest).toHaveBeenCalledWith('s1');
  });

  it('send: assigns an AbortController to store, then nulls it after cancel', async () => {
    vi.mocked(App.SendMessageEx).mockResolvedValueOnce([]);
    // Make EventsOn return a noop unsubscribe and abort sync the cleanup.
    vi.mocked(EventsOn).mockReturnValueOnce(() => { /* noop */ });

    // Start send (don't await — we want to inspect mid-flight state)
    const p = useAppStore.getState().send('s1', 'hi');
    // After send begins, abort should be a real AbortController.
    const mid = useAppStore.getState().abort;
    expect(mid).not.toBeNull();
    expect(typeof mid!.abort).toBe('function');

    // Cancel mid-flight
    useAppStore.getState().cancel('s1');
    expect(useAppStore.getState().abort).toBeNull();
    expect(useAppStore.getState().isStreaming).toBe(false);
    expect(useAppStore.getState().interrupted).toBe(true);

    await p;
  });
});
