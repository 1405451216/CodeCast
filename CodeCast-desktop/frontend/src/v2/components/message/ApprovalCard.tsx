import { Kbd } from '../primitives/Kbd';
import { Button } from '../primitives/Button';
import { useI18n } from '../../lib/useI18n';
interface Props { toolName: string; target: string; risk: 'low' | 'medium' | 'high'; onApprove: () => void; onReject: () => void; }
export function ApprovalCard({ toolName, target, risk, onApprove, onReject }: Props) {
  const t = useI18n();
  const color = risk === 'high' ? 'var(--c-danger)' : risk === 'medium' ? 'var(--c-warn)' : 'var(--c-textSub)';
  return <div style={{ margin: '8px 0', padding: 12, border: '1px solid var(--c-border)', borderRadius: 6, borderLeft: `3px solid ${color}`, background: 'var(--c-bgSub)', fontSize: 13, color: 'var(--c-text)' }}>
    <div>{t.approval.prompt(toolName, target)}</div>
    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
      <Button variant="primary" onClick={onApprove}><Kbd>Y</Kbd> {t.approval.approve}</Button>
      <Button variant="secondary" onClick={onReject}><Kbd>n</Kbd> {t.approval.reject}</Button>
    </div>
  </div>;
}
