import { Kbd } from '../primitives/Kbd';
import { Button } from '../primitives/Button';
interface Props { toolName: string; target: string; risk: 'low' | 'medium' | 'high'; onApprove: () => void; onReject: () => void; }
export function ApprovalCard({ toolName, target, risk, onApprove, onReject }: Props) {
  const color = risk === 'high' ? 'var(--c-danger)' : risk === 'medium' ? 'var(--c-warn)' : 'var(--c-textSub)';
  return <div style={{ margin: '8px 0', padding: 12, border: '1px solid var(--c-border)', borderRadius: 6, borderLeft: `3px solid ${color}`, background: 'var(--c-bgSub)', fontSize: 13, color: 'var(--c-text)' }}>
    <div>需要批准 <code>{toolName}</code> 操作 <code>{target}</code>？</div>
    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
      <Button variant="primary" onClick={onApprove}><Kbd>Y</Kbd> 同意</Button>
      <Button variant="secondary" onClick={onReject}><Kbd>n</Kbd> 拒绝</Button>
    </div>
  </div>;
}
