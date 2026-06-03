import React, { useCallback, useState } from 'react';
import { useT } from '../i18n';

/**
 * A generic confirm/prompt dialog component using existing cast-confirm CSS styles.
 * Replaces native `window.confirm()` and `window.prompt()`.
 */
export interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  mode: 'confirm' | 'prompt';
  defaultValue?: string;
  onResolve?: (value: string | boolean | null) => void;
}

const INITIAL_STATE: ConfirmDialogState = {
  open: false,
  title: '',
  message: '',
  mode: 'confirm',
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(INITIAL_STATE);
  const [inputValue, setInputValue] = useState('');
  const t = useT();

  const confirm = useCallback((message: string, title?: string): Promise<boolean> => {
    const resolvedTitle = title ?? t('confirmDialog.confirmAction');
    return new Promise((resolve) => {
      setState({
        open: true,
        title: resolvedTitle,
        message,
        mode: 'confirm',
        onResolve: (value) => resolve(!!value),
      });
      setInputValue('');
    });
  }, []);

  const prompt = useCallback((message: string, defaultValue = '', title?: string): Promise<string | null> => {
    const resolvedTitle = title ?? t('confirmDialog.pleaseEnter');
    return new Promise((resolve) => {
      setState({
        open: true,
        title: resolvedTitle,
        message,
        mode: 'prompt',
        defaultValue,
        onResolve: (value) => resolve(typeof value === 'string' ? value : null),
      });
      setInputValue(defaultValue);
    });
  }, []);

  const handleClose = useCallback((result: string | boolean | null) => {
    state.onResolve?.(result);
    setState(INITIAL_STATE);
  }, [state]);

  const handleSubmit = useCallback(() => {
    if (state.mode === 'prompt') {
      handleClose(inputValue);
    } else {
      handleClose(true);
    }
  }, [state.mode, inputValue, handleClose]);

  const dialogElement = state.open ? (
    <div className="cast-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(null); }}>
      <div className="cast-confirm-dialog">
        <div className="cast-confirm-header">
          <span className="cast-confirm-icon">{state.mode === 'confirm' ? '⚠️' : '✏️'}</span>
          <h3>{state.title}</h3>
        </div>
        <div className="cast-confirm-body">
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-disabled)' }}>
            {state.message}
          </p>
          {state.mode === 'prompt' && (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--color-border-chip)',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'var(--color-text-primary)',
                color: 'var(--color-bg-secondary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>
        <div className="cast-confirm-actions">
          <button className="confirm-btn deny" onClick={() => handleClose(null)}>
            {t('common.cancel')}
          </button>
          <button className="confirm-btn allow-once" onClick={handleSubmit}>
            {state.mode === 'confirm' ? t('confirmDialog.confirm') : t('confirmDialog.determine')}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, prompt, dialogElement };
}

export default function ConfirmDialog({ state, onResolve }: {
  state: ConfirmDialogState;
  onResolve: (value: string | boolean | null) => void;
}) {
  const t = useT();
  if (!state.open) return null;

  return (
    <div className="cast-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onResolve(null); }}>
      <div className="cast-confirm-dialog">
        <div className="cast-confirm-header">
          <span className="cast-confirm-icon">{state.mode === 'confirm' ? '⚠️' : '✏️'}</span>
          <h3>{state.title}</h3>
        </div>
        <div className="cast-confirm-body">
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-disabled)' }}>
            {state.message}
          </p>
        </div>
        <div className="cast-confirm-actions">
          <button className="confirm-btn deny" onClick={() => onResolve(null)}>
            {t('common.cancel')}
          </button>
          <button className="confirm-btn allow-once" onClick={() => onResolve(true)}>
            {t('confirmDialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
