export interface Attachment { id: string; name: string; size: number }
export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '4px 0' }}>
    {items.map(a => <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', fontSize: 11, borderRadius: 4, background: 'var(--c-bgSub)', color: 'var(--c-textSub)' }}>{a.name}<button type="button" onClick={() => onRemove(a.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-textMute)' }}>×</button></span>)}
  </div>;
}
