import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
export interface CommandItem { id: string; label: string; shortcut?: string; group: string; keywords?: string[] }
const defaultItems: CommandItem[] = [
  { id: 'new', label: '新建对话', group: '会话', shortcut: '⌘N' },
  { id: 'clear', label: '清空当前对话', group: '会话' },
  { id: 'theme', label: '切换主题', group: '系统' },
  { id: 'cast.writing', label: '打开写作', group: 'Cast', shortcut: '⌘2' },
  { id: 'cast.translation', label: '打开翻译', group: 'Cast', shortcut: '⌘3' },
  { id: 'cast.knowledge', label: '打开知识库', group: 'Cast', shortcut: '⌘4' },
  { id: 'cast.schedule', label: '打开日程', group: 'Cast' },
  { id: 'cast.email', label: '打开邮件', group: 'Cast', shortcut: '⌘5' },
  { id: 'cast.tools', label: '打开工具箱', group: 'Cast', shortcut: '⌘6' },
  { id: 'settings', label: '打开设置', group: '系统' },
  { id: 'cost', label: '查看成本', group: '系统' },
  { id: 'plugins', label: '管理插件', group: '系统' },
  { id: 'inference', label: '推理配置', group: '系统' },
  { id: 'sidebar', label: '切换侧边栏', group: '系统', shortcut: '⌘B' },
  { id: 'drawer', label: '切换面板', group: '系统', shortcut: '⌘J' },
];
interface Props { open: boolean; onClose: () => void; onCommand: (item: CommandItem) => void; items?: CommandItem[] }
export function CommandPalette({ open, onClose, onCommand, items = defaultItems }: Props) {
  const [value, setValue] = useState('');
  useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler); }, [open, onClose]);
  if (!open) return null;
  return <div role="dialog" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100, zIndex: 1000 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, width: 480, maxHeight: 400, overflow: 'auto' }}>
      <Command value={value} onValueChange={setValue} label="命令面板">
        <Command.Input autoFocus placeholder="搜索命令..." style={{ width: '100%', padding: 12, fontSize: 14, border: 'none', borderBottom: '1px solid var(--c-border)', background: 'transparent', outline: 'none', color: 'var(--c-text)' }} />
        <Command.List>
          <Command.Empty style={{ padding: 16, color: 'var(--c-textMute)' }}>没有匹配的命令</Command.Empty>
          {['会话', 'Cast', '系统'].map(group => (
            <Command.Group key={group} heading={group} style={{ padding: 4 }}>
              {items.filter(i => i.group === group).map(item => (
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
