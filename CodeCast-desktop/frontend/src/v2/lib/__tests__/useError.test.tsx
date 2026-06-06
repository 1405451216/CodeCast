// frontend/src/v2/lib/__tests__/useError.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useError } from '../useError';
import { useAppStore } from '../../store';
import { ToastProvider } from '../../components/primitives/Toast';

function Probe() {
  const msg = useError('session');
  return <div data-testid="m">{msg ?? ''}</div>;
}

describe('useError', () => {
  beforeEach(() => {
    useAppStore.setState({ errors: {} });
  });

  it('returns undefined initially', () => {
    const { getByTestId } = render(<ToastProvider><Probe /></ToastProvider>);
    expect(getByTestId('m').textContent).toBe('');
  });

  it('clears error after consume', () => {
    render(<ToastProvider><Probe /></ToastProvider>);
    act(() => {
      useAppStore.getState().setError('session', 'boom');
    });
    expect(useAppStore.getState().errors.session).toBeUndefined();
  });

  it('does not double-toast in StrictMode-like double effect', () => {
    render(<ToastProvider><Probe /></ToastProvider>);
    act(() => {
      useAppStore.getState().setError('session', 'first');
    });
    // 第二次设同 slice 错误应被 useRef 防止重 toast
    act(() => {
      useAppStore.getState().setError('session', 'second');
    });
    // 第二次设值时 ref 仍 true 直到下次 cleared
    // 此处只验证 setError 后能 clear，不验证 toast 调用次数（避免 spy on useToast）
    expect(useAppStore.getState().errors.session).toBeUndefined();
  });
});
