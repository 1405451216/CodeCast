export type StatusKind = 'running' | 'done' | 'paused' | 'error';
const M: Record<StatusKind, { glyph: string; color: string }> = {
  running: { glyph: '●', color: 'var(--c-accent)' },
  done: { glyph: '✓', color: 'var(--c-success)' },
  paused: { glyph: '⏸', color: 'var(--c-warn)' },
  error: { glyph: '✗', color: 'var(--c-danger)' },
};
export function StatusDot({ status }: { status: StatusKind }) {
  const { glyph, color } = M[status];
  return <span aria-label={status} style={{ color, fontSize: 11, lineHeight: 1 }}>{glyph}</span>;
}
