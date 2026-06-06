export type DiffLineKind = 'add' | 'remove' | 'context';
export interface DiffLine { kind: DiffLineKind; text: string }
export function parseUnifiedDiff(text: string): DiffLine[] {
  return text.split('\n').map(line => {
    if (line.startsWith('+')) return { kind: 'add', text: line };
    if (line.startsWith('-')) return { kind: 'remove', text: line };
    return { kind: 'context', text: line };
  });
}
export function DiffView({ diff }: { diff: string }) {
  const lines = parseUnifiedDiff(diff);
  return <pre style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, lineHeight: 1.5, background: 'var(--c-bgSub)', border: '1px solid var(--c-border)', borderRadius: 4, padding: 8, margin: '8px 0', overflow: 'auto' }}>
    {lines.map((l, i) => <div key={i} style={{ color: l.kind === 'add' ? 'var(--c-success)' : l.kind === 'remove' ? 'var(--c-danger)' : 'var(--c-textSub)' }}>{l.text}</div>)}
  </pre>;
}
