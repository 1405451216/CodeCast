import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/useI18n';
export interface CommandItem { id: string; label: string; shortcut?: string; group: string; keywords?: string[] }
interface Props { open: boolean; onClose: () => void; onCommand: (item: CommandItem) => void; items?: CommandItem[] }
export function CommandPalette({ open, onClose, onCommand, items }: Props) {
  const t = useI18n();
  const defaultItems: CommandItem[] = useMemo(() => [
    { id: 'new', label: t.commandPalette.newSession, group: t.commandPalette.groupSession, shortcut: '⌘N' },
    { id: 'clear', label: t.commandPalette.clearSession, group: t.commandPalette.groupSession },
    { id: 'theme', label: t.commandPalette.toggleTheme, group: t.commandPalette.groupSystem },
    { id: 'cast.writing', label: t.commandPalette.openWriting, group: 'Cast', shortcut: '⌘2' },
    { id: 'cast.translation', label: t.commandPalette.openTranslation, group: 'Cast', shortcut: '⌘3' },
    { id: 'cast.knowledge', label: t.commandPalette.openKnowledge, group: 'Cast', shortcut: '⌘4' },
    { id: 'cast.schedule', label: t.commandPalette.openSchedule, group: 'Cast' },
    { id: 'cast.email', label: t.commandPalette.openEmail, group: 'Cast', shortcut: '⌘5' },
    { id: 'cast.tools', label: t.commandPalette.openTools, group: 'Cast', shortcut: '⌘6' },
    { id: 'settings', label: t.commandPalette.openSettings, group: t.commandPalette.groupSystem },
    { id: 'cost', label: t.commandPalette.viewCost, group: t.commandPalette.groupSystem },
    { id: 'plugins', label: t.commandPalette.managePlugins, group: t.commandPalette.groupSystem },
    { id: 'inference', label: t.commandPalette.goToInference, group: t.commandPalette.groupSystem },
    { id: 'sidebar', label: t.commandPalette.toggleSidebar, group: t.commandPalette.groupSystem, shortcut: '⌘B' },
    { id: 'drawer', label: t.commandPalette.toggleDrawer, group: t.commandPalette.groupSystem, shortcut: '⌘J' },
  ], [t]);
  const resolvedItems = items ?? defaultItems;
  const [value, setValue] = useState('');
  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler); }, [open, onClose]);
  if (!open) return null;
  const groups = [t.commandPalette.groupSession, 'Cast', t.commandPalette.groupSystem];
  return <div role="dialog" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100, zIndex: 1000 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, width: 480, maxHeight: 400, overflow: 'auto' }}>
      <Command value={value} onValueChange={setValue} label={t.commandPalette.label}>
        <Command.Input autoFocus placeholder={t.commandPalette.placeholder} style={{ width: '100%', padding: 12, fontSize: 14, border: 'none', borderBottom: '1px solid var(--c-border)', background: 'transparent', outline: 'none', color: 'var(--c-text)' }} />
        <Command.List>
          <Command.Empty style={{ padding: 16, color: 'var(--c-textMute)' }}>{t.commandPalette.noResults}</Command.Empty>
          {groups.map(group => (
            <Command.Group key={group} heading={group} style={{ padding: 4 }}>
              {resolvedItems.filter(i => i.group === group).map(item => (
                <Command.Item key={item.id} value={item.label} onSelect={() => { onCommand(item); onClose(); }} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{item.label}</span>
                  {item.shortcut && <kbd style={{ fontSize: 11 }}>{item.shortcut}</kbd>}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  </div>;
}
