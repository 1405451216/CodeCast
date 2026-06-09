import { useEffect, useCallback, type ReactNode } from 'react';
import { useI18n } from '../../lib/useI18n';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.45)',
};

const dialog: React.CSSProperties = {
  background: 'var(--c-surface, #fff)',
  border: '1px solid var(--c-border, #e8e8e8)',
  borderRadius: 'var(--r-lg, 12px)',
  padding: '24px 28px',
  minWidth: 340,
  maxWidth: 460,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--c-text, #1a1a1a)',
  margin: '0 0 8px',
};

const messageStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--c-textSub, #555)',
  lineHeight: 1.6,
  margin: '0 0 22px',
};

const actionsRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const btnBase: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: 'var(--r-md, 8px)',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid var(--c-border, #e8e8e8)',
  outline: 'none',
  transition: 'all var(--dur-fast, 120ms) var(--ease, cubic-bezier(0.16, 1, 0.3, 1))',
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  const t = useI18n();
  const resolvedConfirmLabel = confirmLabel ?? t.common.confirm;
  const resolvedCancelLabel = cancelLabel ?? t.common.cancel;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const confirmBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: danger ? 'var(--c-danger, #e55)' : 'var(--c-accent, #1677ff)',
    color: '#fff',
    borderColor: danger ? 'var(--c-danger, #e55)' : 'var(--c-accent, #1677ff)',
  };

  const cancelBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: 'var(--c-bg, #f9f9f9)',
    color: 'var(--c-text, #1a1a1a)',
  };

  return (
    <div style={overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>{title}</h3>
        <p style={messageStyle}>{message}</p>
        <div style={actionsRow}>
          <button style={cancelBtnStyle} onClick={onCancel}>
            {resolvedCancelLabel}
          </button>
          <button style={confirmBtnStyle} onClick={onConfirm}>
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
