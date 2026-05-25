import { describe, it, expect } from 'vitest';
import { detectShortcutConflicts } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  describe('detectShortcutConflicts', () => {
    it('returns empty map when no conflicts exist', () => {
      const shortcuts = [
        { key: 'k', ctrl: true, handler: () => {}, description: 'Command Palette' },
        { key: 'p', ctrl: true, handler: () => {}, description: 'Settings' }
      ];

      const conflicts = detectShortcutConflicts(shortcuts);

      expect(conflicts.size).toBe(0);
    });

    it('detects conflicts with same key combination', () => {
      const shortcuts = [
        { key: 'k', ctrl: true, handler: () => {}, description: 'Command Palette' },
        { key: 'k', ctrl: true, handler: () => {}, description: 'Another Command' }
      ];

      const conflicts = detectShortcutConflicts(shortcuts);

      expect(conflicts.size).toBe(1);
      expect(conflicts.has('ctrl+k')).toBe(true);
    });

    it('handles case-insensitive key matching', () => {
      const shortcuts = [
        { key: 'K', ctrl: true, handler: () => {}, description: 'Command A' },
        { key: 'k', ctrl: true, handler: () => {}, description: 'Command B' }
      ];

      const conflicts = detectShortcutConflicts(shortcuts);

      expect(conflicts.size).toBe(1);
    });

    it('distinguishes between different modifier combinations', () => {
      const shortcuts = [
        { key: 'k', ctrl: true, handler: () => {}, description: 'Ctrl+K' },
        { key: 'k', ctrl: true, shift: true, handler: () => {}, description: 'Ctrl+Shift+K' },
        { key: 'k', meta: true, handler: () => {}, description: 'Meta+K' }
      ];

      const conflicts = detectShortcutConflicts(shortcuts);

      expect(conflicts.size).toBe(0);
    });

    it('returns all conflicting shortcuts in the array', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const handler3 = () => {};

      const shortcuts = [
        { key: 's', ctrl: true, handler: handler1, description: 'Save 1' },
        { key: 's', ctrl: true, handler: handler2, description: 'Save 2' },
        { key: 's', ctrl: true, handler: handler3, description: 'Save 3' }
      ];

      const conflicts = detectShortcutConflicts(shortcuts);
      const conflictArray = conflicts.get('ctrl+s');

      expect(conflictArray).toBeDefined();
      expect(conflictArray?.length).toBe(3);
    });

    it('handles empty shortcuts array', () => {
      const conflicts = detectShortcutConflicts([]);

      expect(conflicts.size).toBe(0);
    });
  });
});