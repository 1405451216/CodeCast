import { Button } from '../primitives/Button';
import { useI18n } from '../../lib/useI18n';
export function InterruptedNotice({ onResume }: { onResume: () => void }) {
  const t = useI18n();
  return <div style={{ padding: 8, fontSize: 12, color: 'var(--c-warn)', background: 'var(--c-bgSub)', border: '1px solid var(--c-border)', borderRadius: 4, margin: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
    <span>⚠ {t.errors.streamInterrupted}</span>
    <div style={{ flex: 1 }} />
    <Button variant="ghost" onClick={onResume}>{t.errors.retry}</Button>
  </div>;
}
