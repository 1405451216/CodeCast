import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts, detectShortcutConflicts } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('should register keyboard event listener on mount', () => {
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save'
      }
    ];

    const { unmount } = renderHook(() =>
      useKeyboardShortcuts(shortcuts)
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );

    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );
  });

  it('should call handler when shortcut is triggered', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler,
        description: 'Save'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const keydownEvent = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false
    });

    act(() => {
      window.dispatchEvent(keydownEvent);
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not call handler when shortcut does not match', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler,
        description: 'Save'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const wrongKeyEvent = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false
    });

    act(() => {
      window.dispatchEvent(wrongKeyEvent);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should respect modifier keys', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        shift: true,
        handler,
        description: 'Save As'
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const eventWithoutShift = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false
    });

    act(() => {
      window.dispatchEvent(eventWithoutShift);
    });

    expect(handler).not.toHaveBeenCalled();

    const eventWithShift = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false
    });

    act(() => {
      window.dispatchEvent(eventWithShift);
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when enabled is false', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler,
        description: 'Save'
      }
    ];

    renderHook(() =>
      useKeyboardShortcuts(shortcuts, { enabled: false })
    );

    const keydownEvent = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false
    });

    act(() => {
      window.dispatchEvent(keydownEvent);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should respect scope option - input scope', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler,
        description: 'Save'
      }
    ];

    renderHook(() =>
      useKeyboardShortcuts(shortcuts, { scope: 'input' })
    );

    const inputElement = document.createElement('input');
    document.body.appendChild(inputElement);

    const keydownEvent = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false
    });

    Object.defineProperty(keydownEvent, 'target', { value: inputElement });

    act(() => {
      window.dispatchEvent(keydownEvent);
    });

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(inputElement);
  });
});

describe('detectShortcutConflicts', () => {
  it('should detect conflicting shortcuts', () => {
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save'
      },
      {
        key: 's',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save Document'
      }
    ];

    const conflicts = detectShortcutConflicts(shortcuts);

    expect(conflicts.size).toBe(1);
    expect(conflicts.has('ctrl+s')).toBe(true);
    expect(conflicts.get('ctrl+s')).toHaveLength(2);
  });

  it('should return empty map when no conflicts', () => {
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save'
      },
      {
        key: 'c',
        ctrl: true,
        handler: vi.fn(),
        description: 'Copy'
      }
    ];

    const conflicts = detectShortcutConflicts(shortcuts);

    expect(conflicts.size).toBe(0);
  });

  it('should detect multiple conflict groups', () => {
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save 1'
      },
      {
        key: 's',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save 2'
      },
      {
        key: 'c',
        ctrl: true,
        handler: vi.fn(),
        description: 'Copy 1'
      },
      {
        key: 'c',
        ctrl: true,
        handler: vi.fn(),
        description: 'Copy 2'
      }
    ];

    const conflicts = detectShortcutConflicts(shortcuts);

    expect(conflicts.size).toBe(2);
    expect(conflicts.has('ctrl+s')).toBe(true);
    expect(conflicts.has('ctrl+c')).toBe(true);
  });

  it('should not flag different modifiers as conflicts', () => {
    const shortcuts = [
      {
        key: 's',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save'
      },
      {
        key: 's',
        ctrl: true,
        shift: true,
        handler: vi.fn(),
        description: 'Save All'
      }
    ];

    const conflicts = detectShortcutConflicts(shortcuts);

    expect(conflicts.size).toBe(0);
  });

  it('should handle case-insensitive key matching', () => {
    const shortcuts = [
      {
        key: 'S',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save uppercase'
      },
      {
        key: 's',
        ctrl: true,
        handler: vi.fn(),
        description: 'Save lowercase'
      }
    ];

    const conflicts = detectShortcutConflicts(shortcuts);

    expect(conflicts.size).toBe(1);
  });
});
