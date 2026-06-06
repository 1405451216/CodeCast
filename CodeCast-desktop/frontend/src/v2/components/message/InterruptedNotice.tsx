import { Button } from '../primitives/Button';
export function InterruptedNotice({ onResume }: { onResume: () => void }) {
  return <div style={{ padding: 8, fontSize: 12, color: 'var(--c-warn)', background: 'var(--c-bgSub)', border: '1px solid var(--c-border)', borderRadius: 4, margin: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
    <span>⚠ 流式响应中断（60 秒无内容）</span>
    <div style={{ flex: 1 }} />
    <Button variant="ghost" onClick={onResume}>继续</Button>
  </div>;
}
