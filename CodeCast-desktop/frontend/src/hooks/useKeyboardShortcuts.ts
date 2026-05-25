import { useEffect, useCallback, useState } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  scope?: 'global' | 'input' | 'none';
}

function getShortcutSignature(shortcut: ShortcutConfig): string {
  const parts = [];
  if (shortcut.ctrl) parts.push('ctrl');
  if (shortcut.meta) parts.push('meta');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.alt) parts.push('alt');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
}

export function detectShortcutConflicts(shortcuts: ShortcutConfig[]): Map<string, ShortcutConfig[]> {
  const signatureMap = new Map<string, ShortcutConfig[]>();

  for (const shortcut of shortcuts) {
    const signature = getShortcutSignature(shortcut);
    if (!signatureMap.has(signature)) {
      signatureMap.set(signature, []);
    }
    signatureMap.get(signature)!.push(shortcut);
  }

  const conflicts = new Map<string, ShortcutConfig[]>();
  for (const [signature, configs] of signatureMap) {
    if (configs.length > 1) {
      conflicts.set(signature, configs);
    }
  }

  return conflicts;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, scope = 'global' } = options;

  useEffect(() => {
    if (import.meta.env.DEV) {
      const conflicts = detectShortcutConflicts(shortcuts);
      if (conflicts.size > 0) {
        console.group('%c⚠️ 快捷键冲突检测', 'color: orange; font-weight: bold; font-size: 14px;');
        console.warn('检测到以下快捷键冲突：');

        for (const [signature, conflictingShortcuts] of conflicts) {
          console.warn(`快捷键组合: ${signature}`);
          console.table(conflictingShortcuts.map(s => ({
            '按键': s.key,
            '描述': s.description,
            'Ctrl': s.ctrl || false,
            'Shift': s.shift || false,
            'Alt': s.alt || false,
            'Meta': s.meta || false
          })));
        }

        console.groupEnd();
      }
    }
  }, [shortcuts]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    if (scope === 'input') {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
    }

    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
      const shiftMatch = !!shortcut.shift === e.shiftKey;
      const altMatch = !!shortcut.alt === e.altKey;
      const metaMatch = !!shortcut.meta === e.metaKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        e.preventDefault();
        shortcut.handler(e);
        return;
      }
    }
  }, [shortcuts, enabled, scope]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      handler: () => setIsOpen(prev => !prev),
      description: '打开/关闭命令面板'
    },
    {
      key: 'Escape',
      handler: () => setIsOpen(false),
      description: '关闭命令面板'
    }
  ]);

  return { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false), toggle: () => setIsOpen(prev => !prev) };
}
