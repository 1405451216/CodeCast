import { useState, useEffect } from 'react';
export interface SlashCommand { id: string; label: string; description: string; aliases?: string[] }
const COMMANDS: SlashCommand[] = [
  { id: 'weekly', label: '/写周报', description: '生成周报模板', aliases: ['/weekly'] },
  { id: 'translate', label: '/翻译', description: '中英互译', aliases: ['/translate'] },
  { id: 'note', label: '/笔记', description: '写入知识库', aliases: ['/note'] },
  { id: 'schedule', label: '/日程', description: '新建日程', aliases: ['/schedule'] },
  { id: 'pomodoro', label: '/番茄钟', description: '25 分钟专注', aliases: ['/pomodoro'] },
  { id: 'cast', label: '/cast', description: '打开 Cast 工作台', aliases: [] },
];
export function SlashCommandMenu({ query, onSelect }: { query: string; onSelect: (cmd: SlashCommand) => void }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const q = query.toLowerCase().replace(/^\//, '');
  const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.aliases?.some(a => a.toLowerCase().includes(q)));
  useEffect(() => { setActiveIdx(0); }, [q]);
  if (!filtered.length) return null;
  return <div role="listbox" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxHeight: 200, overflow: 'auto' }}>
    {filtered.map((c, i) => <div key={c.id} role="option" aria-selected={i === activeIdx} onClick={() => onSelect(c)} style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer', background: i === activeIdx ? 'var(--c-bgSub)' : 'transparent', display: 'flex', justifyContent: 'space-between' }}>
      <span>{c.label}</span><span style={{ color: 'var(--c-textMute)', fontSize: 11 }}>{c.description}</span>
    </div>)}
  </div>;
}
export { COMMANDS };
