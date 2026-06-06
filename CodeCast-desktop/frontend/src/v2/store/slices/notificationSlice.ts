// frontend/src/v2/store/slices/notificationSlice.ts
import type { StateCreator } from 'zustand';
import type { NotificationPayload } from '../../wails/types';

export interface NotificationSlice {
  notifications: NotificationPayload[];
  unreadCount: number;
  pushNotification: (n: NotificationPayload) => void;
  dismissNotification: (index: number) => void;
  clearAllNotifications: () => void;
}

export const createNotificationSlice: StateCreator<NotificationSlice, [], [], NotificationSlice> = (set) => ({
  notifications: [],
  unreadCount: 0,

  pushNotification: (n) => set((s) => ({
    notifications: [n, ...s.notifications],
    unreadCount: s.unreadCount + 1,
  })),

  dismissNotification: (index) => set((s) => ({
    notifications: s.notifications.filter((_, i) => i !== index),
    unreadCount: Math.max(0, s.unreadCount - 1),
  })),

  clearAllNotifications: () => set({ notifications: [], unreadCount: 0 }),
});
