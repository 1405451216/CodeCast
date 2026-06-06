import type { ButtonHTMLAttributes, ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; children: ReactNode; }
const vs: Record<Variant, React.CSSProperties> = {
  primary:   { background: 'var(--c-accent)', color: '#fff', border: '1px solid var(--c-accent)' },
  secondary: { background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)' },
  ghost:     { background: 'transparent', color: 'var(--c-textSub)', border: '1px solid transparent' },
  danger:    { background: 'var(--c-danger)', color: '#fff', border: '1px solid var(--c-danger)' },
};
export function Button({ variant = 'secondary', style, children, ...rest }: Props) {
  return <button {...rest} style={{ padding: '4px 12px', borderRadius: 4, fontSize: 13, cursor: 'pointer', ...vs[variant], ...style }}>{children}</button>;
}
