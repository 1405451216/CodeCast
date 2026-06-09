import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  icon?: ReactNode;
}

const base: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 'var(--r-md, 8px)',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid transparent',
  whiteSpace: 'nowrap' as const,
  transition: 'all var(--dur-fast, 120ms) var(--ease, cubic-bezier(0.16, 1, 0.3, 1))',
  // outline: none removed — let :focus-visible CSS handle focus ring
};

const vs: Record<Variant, { base: React.CSSProperties; hover: React.CSSProperties; active: React.CSSProperties }> = {
  primary: {
    base: { background: 'var(--c-accent)', color: '#fff', borderColor: 'var(--c-accent)' },
    hover: { filter: 'brightness(1.1)' },
    active: { filter: 'brightness(0.9)', transform: 'scale(0.97)' },
  },
  secondary: {
    base: { background: 'var(--c-bg)', color: 'var(--c-text)', borderColor: 'var(--c-border)', boxShadow: 'var(--shadow-sm)' },
    hover: { background: 'var(--c-surface-hover)' },
    active: { background: 'var(--c-border)', transform: 'scale(0.97)' },
  },
  ghost: {
    base: { background: 'transparent', color: 'var(--c-textSub)', borderColor: 'transparent' },
    hover: { background: 'var(--c-surface-hover)', color: 'var(--c-text)' },
    active: { background: 'var(--c-border)', transform: 'scale(0.97)' },
  },
  danger: {
    base: { background: 'var(--c-danger)', color: '#fff', borderColor: 'var(--c-danger)' },
    hover: { filter: 'brightness(1.1)' },
    active: { filter: 'brightness(0.9)', transform: 'scale(0.97)' },
  },
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
};

const focusVisibleStyle: React.CSSProperties = {
  outline: '2px solid var(--c-accent)',
  outlineOffset: '2px',
};

export function Button({ variant = 'secondary', style, icon, children, disabled, className, ...rest }: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const v = vs[variant];
  const stateStyle = disabled
    ? disabledStyle
    : pressed
      ? v.active
      : hovered
        ? v.hover
        : {};

  return (
    <button
      {...rest}
      disabled={disabled}
      className={`cc-btn${className ? ` ${className}` : ''}`}
      style={{
        ...base,
        ...v.base,
        ...stateStyle,
        ...style,
      }}
      onMouseEnter={(e) => { setHovered(true); rest.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); setPressed(false); rest.onMouseLeave?.(e); }}
      onMouseDown={(e) => { setPressed(true); rest.onMouseDown?.(e); }}
      onMouseUp={(e) => { setPressed(false); rest.onMouseUp?.(e); }}
    >
      {icon}
      {children}
    </button>
  );
}
