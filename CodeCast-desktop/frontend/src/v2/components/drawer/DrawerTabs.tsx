export type TabId = 'files' | 'git' | 'mcp' | 'memory';
const TABS: { id: TabId; label: string }[] = [
  { id: 'files', label: 'Files' }, { id: 'git', label: 'Git' },
  { id: 'mcp', label: 'MCP' }, { id: 'memory', label: 'Memory' },
];
export function DrawerTabs({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--c-border)' }}>
    {TABS.map(t => <button key={t.id} onClick={() => onChange(t.id)} style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', border: 'none', background: 'transparent', color: active === t.id ? 'var(--c-accent)' : 'var(--c-textMute)', borderBottom: active === t.id ? '2px solid var(--c-accent)' : '2px solid transparent' }}>{t.label}</button>)}
  </div>;
}
