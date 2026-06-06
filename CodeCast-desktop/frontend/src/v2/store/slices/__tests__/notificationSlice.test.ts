// frontend/src/v2/store/slices/__tests__/notificationSlice.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../index';

describe('notificationSlice', () => {
  beforeEach(() => {
    useAppStore.setState({ notifications: [], unreadCount: 0 });
  });

  it('pushNotification adds to front and increments unreadCount', () => {
    useAppStore.getState().pushNotification({ title: 't1', body: 'hello', type: 'info' });
    const state = useAppStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].body).toBe('hello');
    expect(state.unreadCount).toBe(1);
  });

  it('pushNotification prepends newer notifications', () => {
    useAppStore.getState().pushNotification({ title: 't1', body: 'first', type: 'info' });
    useAppStore.getState().pushNotification({ title: 't2', body: 'second', type: 'error' });
    const state = useAppStore.getState();
    expect(state.notifications).toHaveLength(2);
    expect(state.notifications[0].body).toBe('second');
    expect(state.unreadCount).toBe(2);
  });

  it('dismissNotification removes by index and decrements unreadCount', () => {
    useAppStore.getState().pushNotification({ title: 't1', body: 'a', type: 'info' });
    useAppStore.getState().pushNotification({ title: 't2', body: 'b', type: 'info' });
    useAppStore.getState().dismissNotification(0);
    const state = useAppStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].body).toBe('a');
    expect(state.unreadCount).toBe(1);
  });

  it('clearAllNotifications empties everything', () => {
    useAppStore.getState().pushNotification({ title: 't', body: 'x', type: 'info' });
    useAppStore.getState().clearAllNotifications();
    const state = useAppStore.getState();
    expect(state.notifications).toHaveLength(0);
    expect(state.unreadCount).toBe(0);
  });
});
